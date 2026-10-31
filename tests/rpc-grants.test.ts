import {it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
const migration="supabase/migrations/20261031103949_restrict_management_rpc.sql";
const privateNames=["is_editor","is_owner","protect_last_owner","save_chapter","save_chapters","publish_chapter","publish_chapters","save_book","reorder_chapters","archive_chapter","seed_book"];
async function setup(){
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
  for(const name of ["001_book.sql","002_safe_updates.sql","003_public_book_index.sql","004_collaboration.sql","005_comics.sql","006_comic_locales.sql"])await db.exec(await readFile("supabase/migrations/"+name,"utf8"));
  return db;
}
async function boundaries(db:PGlite){
  const rows=(await db.query<{proname:string;anon:boolean;editor:boolean;service:boolean}>(`select proname,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as editor,has_function_privilege('service_role',p.oid,'EXECUTE') as service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`)).rows;
  for(const row of rows.filter(r=>privateNames.includes(r.proname))){expect(row.anon,row.proname).toBe(false);if(["seed_book","protect_last_owner"].includes(row.proname))expect(row.editor,row.proname).toBe(false);else expect(row.editor,row.proname).toBe(true);}
  for(const name of ["get_public_book","get_public_book_index","can_read_asset","get_public_comic","get_public_comic_index","can_read_comic_asset"])for(const row of rows.filter(r=>r.proname===name))expect(row.anon,name).toBe(true);
  expect(rows.find(r=>r.proname==="seed_book")?.service).toBe(true);
  await db.exec("set role anon");await expect(db.query("select public.archive_chapter('unused')")).rejects.toThrow(/permission denied/i);
  expect((await db.query("select public.get_public_book_index() as book")).rows).toHaveLength(1);
  await db.exec("reset role;set role authenticated");await expect(db.query("select public.seed_book('{}')")).rejects.toThrow(/permission denied/i);await db.exec("reset role");
}
it("bootstrap restricts private RPCs even with Supabase explicit default grants",async()=>{const db=await setup();try{await boundaries(db);}finally{await db.close();}});
it("upgrade removes legacy explicit grants while preserving public reads and editor writes",async()=>{
  const db=await setup();try{
    await db.exec(`do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('${privateNames.join("','")}') loop execute format('grant execute on function %s to anon,authenticated',f.signature);end loop;end $$;`);
    await db.exec(await readFile(migration,"utf8"));await boundaries(db);
    const actor="11111111-1111-4111-8111-111111111111";
    await db.exec(`insert into auth.users values('${actor}','owner@example.test');insert into public.members(user_id,email,role) values('${actor}','owner@example.test','owner');select set_config('request.jwt.claim.sub','${actor}',false);set role authenticated;`);
    await db.query("select public.save_chapter('chapter-1','vi','One','<p>First</p>','text',null,0)");
    await db.query("select public.publish_chapter('chapter-1','vi',1,false)");
    await expect(db.query("update public.members set active=false")).rejects.toThrow(/last owner/i);
  }finally{await db.close();}
});
