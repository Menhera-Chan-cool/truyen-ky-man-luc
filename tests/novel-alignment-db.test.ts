import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
let db:PGlite,job:{id:string;lease_id:string;editions:Record<string,{html:string}>};
const actor='11111111-1111-4111-8111-111111111111';
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;grant usage on schema storage to service_role;grant all on storage.objects,storage.buckets to service_role;`);
 for(const f of ['001_book.sql','002_safe_updates.sql','003_public_book_index.sql','20261112043121_novel_alignment.sql'])await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 await db.exec(`insert into auth.users values('${actor}','editor@example.test');insert into public.members(user_id,email,role) values('${actor}','editor@example.test','editor');select set_config('request.jwt.claim.sub','${actor}',false);set role authenticated;`);
 await db.query(`select public.save_chapter('chapter-1','vi','VI','<p>VI published</p>','text',null,0)`);
 await db.query(`select public.publish_chapter('chapter-1','vi',1,false)`);
 await db.query(`select public.save_chapter('chapter-1','en','EN','<p>EN published</p>','text',null,0)`);
 await db.query(`select public.publish_chapter('chapter-1','en',1,false)`);
 await db.query(`select public.save_chapter('chapter-1','vi','PRIVATE','<p>PRIVATE DRAFT</p>','text',null,1)`);
 await db.exec('reset role');
});
afterAll(()=>db?.close());
it('creates one job from the published pair, not from an unsaved draft',async()=>{
 const r=await db.query<{count:number}>(`select count(*)::int as count from public.novel_alignment_jobs`);expect(r.rows[0].count).toBe(1);
 const h=await db.query<{same:boolean}>(`select j.vi_version=e.published_id and j.vi_version<>e.draft_id as same from public.novel_alignment_jobs j join public.chapter_editions e on e.chapter_id=j.chapter_id and e.locale='vi'`);expect(h.rows[0].same).toBe(true);
});
it('denies anonymous job/worker access while serving only public metadata',async()=>{
 await db.exec('set role anon');
 await expect(db.query('select * from public.novel_alignment_jobs')).rejects.toThrow(/permission denied/i);
 await expect(db.query('select public.claim_novel_alignment_job()')).rejects.toThrow(/permission denied/i);
 const r=await db.query<{value:any}>(`select public.get_public_novel_alignment('chapter-1') as value`);
 expect(r.rows[0].value.vi.revision).toBe(1);expect(r.rows[0].value.run).toBeNull();expect(JSON.stringify(r.rows)).not.toContain('PRIVATE');
 await db.exec('reset role');
});
it('claims with a lease and refuses completion with a different lease',async()=>{
 await db.exec('set role service_role');
 const r=await db.query<{value:any}>('select public.claim_novel_alignment_job() as value');job=r.rows[0].value;
 expect(job.id).toBeTruthy();expect(job.editions.vi.html).toContain('VI published');expect(JSON.stringify(job)).not.toContain('PRIVATE');
 await expect(db.query(`select public.finish_novel_alignment_job($1,$2,null,null,null,'failed')`,[job.id,actor])).rejects.toThrow(/lease|conflict/i);
});
it('publishes an immutable private artifact only after completion',async()=>{
 const hash='a'.repeat(64),file=job.id+'/'+hash+'.json';
 await db.query(`insert into storage.objects(bucket_id,name) values('novel-alignments',$1)`,[file]);
 await db.query(`select public.finish_novel_alignment_job($1,$2,$3,$4,123,null)`,[job.id,job.lease_id,file,hash]);
 await db.exec('reset role;set role anon');
 const r=await db.query<{value:any}>(`select public.get_public_novel_alignment('chapter-1') as value`);expect(r.rows[0].value.run.path).toBe(file);
 await db.exec('reset role');
 expect((await db.query<{public:boolean}>(`select public from storage.buckets where id='novel-alignments'`)).rows[0].public).toBe(false);
});
it('invalidates the old result and discards work when either published side changes',async()=>{
 await db.exec('set role authenticated');await db.query(`select public.publish_chapter('chapter-1','vi',2,false)`);
 await db.exec('reset role;set role service_role');const r=await db.query<{value:any}>('select public.claim_novel_alignment_job() as value');const stale=r.rows[0].value;
 await db.exec('reset role;set role authenticated');await db.query(`select public.save_chapter('chapter-1','en','New','<p>New</p>','text',null,1)`);await db.query(`select public.publish_chapter('chapter-1','en',2,false)`);
 await db.exec('reset role;set role service_role');const finished=await db.query<{value:any}>(`select public.finish_novel_alignment_job($1,$2,null,null,null,'source changed') as value`,[stale.id,stale.lease_id]);expect(finished.rows[0].value.state).toBe('obsolete');
 await db.exec('reset role;set role anon');const current=await db.query<{value:any}>(`select public.get_public_novel_alignment('chapter-1') as value`);expect(current.rows[0].value.run).toBeNull();expect(current.rows[0].value.vi.revision).toBe(2);await db.exec('reset role');
});
it('stops expired workers after the bounded retry budget',async()=>{
 await db.exec(`reset role;update public.novel_alignment_jobs set state='running',attempts=3,lease_id=gen_random_uuid(),lease_until=clock_timestamp()-interval '1 minute' where state='pending';set role service_role`);
 const r=await db.query<{value:unknown}>('select public.claim_novel_alignment_job() as value');expect(r.rows[0].value).toBeNull();
 await db.exec('reset role');expect((await db.query<{count:number}>(`select count(*)::int as count from public.novel_alignment_jobs where state='running'`)).rows[0].count).toBe(0);
});
it('requeues a withdrawn then republished pair without manual editor alignment',async()=>{
 await db.exec('set role authenticated');await db.query(`select public.publish_chapter('chapter-1','en',2,true)`);await db.query(`select public.publish_chapter('chapter-1','en',2,false)`);
 await db.exec('reset role');expect((await db.query<{state:string}>(`select state from public.novel_alignment_jobs where vi_version=(select published_id from public.chapter_editions where chapter_id='chapter-1' and locale='vi') and en_version=(select published_id from public.chapter_editions where chapter_id='chapter-1' and locale='en')`)).rows[0].state).toBe('pending');
});
it('lets an active editor retry but rejects revoked membership',async()=>{
 await db.exec('set role authenticated');await expect(db.query(`select public.request_novel_alignment('chapter-1')`)).resolves.toBeTruthy();
 await db.exec(`reset role;update public.members set active=false where user_id='${actor}';set role authenticated`);
 await expect(db.query(`select public.request_novel_alignment('chapter-1')`)).rejects.toThrow(/forbidden/i);await db.exec('reset role');
});
