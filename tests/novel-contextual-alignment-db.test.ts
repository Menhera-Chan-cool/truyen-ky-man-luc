import {beforeAll,beforeEach,afterEach,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

let db:PGlite,oldPath:string;
const actor='11111111-1111-4111-8111-111111111111';
type Job={id:string;lease_id:string;algorithm:string;editions:Record<string,{html:string}>};
const role=(name:'anon'|'authenticated'|'service_role')=>db.exec(`reset role;set role ${name}`);
const claim=async()=>(await db.query<{value:Job|null}>('select public.claim_novel_alignment_job() as value')).rows[0].value;
async function queue(){await role('service_role');return (await db.query<{id:string}>("select public.queue_novel_alignment('chapter-1',true) as id")).rows[0].id;}
async function visible(){await role('anon');return (await db.query<{value:any}>("select public.get_public_novel_alignment('chapter-1') as value")).rows[0].value;}
async function finish(job:Job,hash='b'.repeat(64)){
 const file=`${job.id}/${hash}.json`;
 await db.query("insert into storage.objects(bucket_id,name) values('novel-alignments',$1)",[file]);
 await db.query('select public.finish_novel_alignment_job($1,$2,$3,$4,123,null)',[job.id,job.lease_id,file,hash]);
 return file;
}
async function denied(sql:string){
 await db.exec('savepoint expected_denial');
 await expect(db.query(sql)).rejects.toThrow(/permission denied/i);
 await db.exec('rollback to savepoint expected_denial');
}

beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;create table auth.users(id uuid primary key,email text);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,public to anon,authenticated,service_role;
  create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;
  grant usage on schema storage to service_role;grant all on storage.objects,storage.buckets to service_role;`);
 for(const file of ['001_book.sql','002_safe_updates.sql','003_public_book_index.sql','20261112043121_novel_alignment.sql'])
  await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 await db.exec(`insert into auth.users values('${actor}','editor@example.test');insert into public.members(user_id,email,role) values('${actor}','editor@example.test','editor');select set_config('request.jwt.claim.sub','${actor}',false);set role authenticated;`);
 for(let n=1;n<=4;n++)for(const locale of ['vi','en']){
  await db.query("select public.save_chapter($1,$2,'Published','<p>PUBLIC</p>','text',null,0)",[`chapter-${n}`,locale]);
  await db.query('select public.publish_chapter($1,$2,1,false)',[`chapter-${n}`,locale]);
 }
 await db.query("select public.save_chapter('chapter-1','vi','PRIVATE','<p>PRIVATE DRAFT</p>','text',null,1)");
 await role('service_role');oldPath=await finish((await claim())!,'a'.repeat(64));
 await db.exec(`reset role;
  update public.novel_alignment_jobs set state='running',attempts=1,lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '15 minutes' where chapter_id='chapter-3';
  update public.novel_alignment_jobs set algorithm='semantic-align-1' where chapter_id='chapter-4';
  alter default privileges in schema public grant execute on functions to anon,authenticated;`);
 await db.exec(await readFile('supabase/migrations/20261113082758_contextual_novel_alignment.sql','utf8'));
},15000);
beforeEach(()=>db.exec('begin'));
afterEach(()=>db.exec('rollback;reset role'));
afterAll(()=>db?.close());

it('retires old pending and running recipes without autoqueueing or deleting ready fallback runs',async()=>{
 const rows=(await db.query<{state:string;algorithm:string;lease_id:string|null}>("select state,algorithm,lease_id from public.novel_alignment_jobs order by chapter_id")).rows;
 expect(rows.map(r=>r.state)).toEqual(['ready','obsolete','obsolete','obsolete']);
 expect(rows.slice(1).every(r=>r.lease_id===null)).toBe(true);
 expect(rows.some(r=>r.algorithm==='labse-context-mbert-1')).toBe(false);
 expect((await db.query('select * from public.novel_alignment_runs')).rows).toHaveLength(1);
 expect((await visible()).run.path).toBe(oldPath);
});

it('queues and claims only the local recipe using the published pair instead of the saved draft',async()=>{
 const id=await queue();expect(await queue()).toBe(id);
 await db.exec(`reset role;update public.novel_alignment_jobs set state='pending' where chapter_id='chapter-2';
  update public.novel_alignment_jobs set state='running',lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '15 minutes' where chapter_id='chapter-4';set role service_role;`);
 const job=(await claim())!;
 expect(job.id).toBe(id);expect(job.algorithm).toBe('labse-context-mbert-1');
 expect(job.editions.vi.html).toContain('PUBLIC');expect(JSON.stringify(job)).not.toContain('PRIVATE');
 await db.exec('reset role');
 const heads=(await db.query<{same:boolean}>(`select j.vi_version=e.published_id and j.vi_version<>e.draft_id as same from public.novel_alignment_jobs j join public.chapter_editions e on e.chapter_id=j.chapter_id and e.locale='vi' where j.id=$1`,[id])).rows;
 expect(heads[0].same).toBe(true);
 expect((await db.query<{state:string}>("select state from public.novel_alignment_jobs where chapter_id in ('chapter-2','chapter-4')")).rows.every(r=>r.state==='obsolete')).toBe(true);
});

it('serves e5 until a current local artifact is finished, then prefers local over newer old metadata',async()=>{
 expect((await visible()).run.path).toBe(oldPath);
 await queue();expect((await visible()).run.path).toBe(oldPath);
 await role('service_role');const job=(await claim())!;
 expect((await visible()).run.path).toBe(oldPath);
 await role('service_role');const file=await finish(job);
 await db.exec("reset role;update public.novel_alignment_runs set created_at=clock_timestamp()+interval '1 day' where path like '%/aaaaaaaa%' ");
 const data=await visible();
 expect(data.run.path).toBe(file);expect(data.run.algorithm).toBe('labse-context-mbert-1');expect(data.vi.revision).toBe(1);
 expect(JSON.stringify(data)).not.toContain('PRIVATE');
});

it('allows public metadata but denies anon and editor internal queue/claim mutations, with no defer endpoint',async()=>{
 for(const name of ['anon','authenticated'] as const){
  await role(name);
  const data=(await db.query<{value:any}>("select public.get_public_novel_alignment('chapter-1') as value")).rows[0].value;
  expect(data.vi.revision).toBe(1);expect(data.run.path).toBe(oldPath);expect(JSON.stringify(data)).not.toContain('PRIVATE');
  await denied("select public.queue_novel_alignment('chapter-1',true)");
  await denied('select public.claim_novel_alignment_job()');
  await denied("update public.novel_alignment_jobs set state='pending'");
 }
 await db.exec('reset role');
 expect((await db.query<{fn:string|null}>("select to_regprocedure('public.defer_novel_alignment_job(uuid,uuid,integer,text)')::text as fn")).rows[0].fn).toBeNull();
 expect((await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where relname in ('novel_alignment_jobs','novel_alignment_runs')")).rows.every(r=>r.relrowsecurity)).toBe(true);
});

it('invalidates previous heads and rejects their completion when a new version is published',async()=>{
 await queue();const job=(await claim())!;
 await role('authenticated');await db.query("select public.publish_chapter('chapter-1','vi',2,false)");
 await role('service_role');
 const finished=(await db.query<{value:{state:string}}>('select public.finish_novel_alignment_job($1,$2,null,null,null,null) as value',[job.id,job.lease_id])).rows[0].value;
 expect(finished.state).toBe('obsolete');
 const data=await visible();expect(data.vi.revision).toBe(2);expect(data.run).toBeNull();
 await db.exec('reset role');
 expect((await db.query<{algorithm:string}>("select algorithm from public.novel_alignment_jobs where state='pending'")).rows.every(r=>r.algorithm==='labse-context-mbert-1')).toBe(true);
});
