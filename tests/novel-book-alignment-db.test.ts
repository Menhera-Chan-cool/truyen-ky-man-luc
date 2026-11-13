import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

it('keeps the current LaBSE run serving while switching jobs to the book recipe and enforcing role grants',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,public to anon,authenticated,service_role;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;
   grant usage on schema storage to service_role;grant all on storage.objects,storage.buckets to service_role;`);
  for(const file of ['001_book.sql','002_safe_updates.sql','003_public_book_index.sql','20261112043121_novel_alignment.sql','20261113082758_contextual_novel_alignment.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  const actor='11111111-1111-4111-8111-111111111111';
  await db.exec(`insert into auth.users values('${actor}','editor@example.test');insert into public.members(user_id,email,role) values('${actor}','editor@example.test','editor');select set_config('request.jwt.claim.sub','${actor}',false);set role authenticated;`);
  for(const locale of ['vi','en']){
   await db.query("select public.save_chapter('chapter-1',$1,'Published','<p>PUBLIC</p>','text',null,0)",[locale]);
   await db.query("select public.publish_chapter('chapter-1',$1,1,false)",[locale]);
  }
  await db.exec('reset role;set role service_role');
  const old=(await db.query<{j:any}>('select public.claim_novel_alignment_job() j')).rows[0].j;
  const oldFile=old.id+'/'+('a'.repeat(64))+'.json';
  await db.query("insert into storage.objects(bucket_id,name) values('novel-alignments',$1)",[oldFile]);
  await db.query('select public.finish_novel_alignment_job($1,$2,$3,$4,123,null)',[old.id,old.lease_id,oldFile,'a'.repeat(64)]);
  await db.exec('reset role');
  await db.exec(await readFile('supabase/migrations/20261113131339_book_specific_novel_alignment.sql','utf8'));
  await db.exec('set role anon');
  const visible=async()=>(await db.query<{a:any}>("select public.get_public_novel_alignment('chapter-1') a")).rows[0].a;
  expect((await visible()).run.path).toBe(oldFile);
  await expect(db.query("select public.queue_novel_alignment('chapter-1')")).rejects.toThrow(/permission denied/i);
  await db.exec('reset role;set role service_role');
  await db.query("select public.queue_novel_alignment('chapter-1')");
  const job=(await db.query<{j:any}>('select public.claim_novel_alignment_job() j')).rows[0].j;
  expect(job.algorithm).toBe('labse-book-mbert-2');
  expect((await visible()).run.path).toBe(oldFile);
  const file=job.id+'/'+('b'.repeat(64))+'.json';
  await db.query("insert into storage.objects(bucket_id,name) values('novel-alignments',$1)",[file]);
  await db.query('select public.finish_novel_alignment_job($1,$2,$3,$4,123,null)',[job.id,job.lease_id,file,'b'.repeat(64)]);
  await db.exec('reset role;set role anon');
  expect((await visible()).run.algorithm).toBe('labse-book-mbert-2');
  await db.exec('reset role');
  expect((await db.query('select * from public.novel_alignment_runs')).rows).toHaveLength(2);
 }finally{await db.close();}
},20000);
