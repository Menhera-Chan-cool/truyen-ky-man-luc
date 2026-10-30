import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111", editor = "22222222-2222-4222-8222-222222222222";
const path = `${editor}/comics/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;
const pages = JSON.stringify([{id:"p1",name:"one.png",path:`/api/comic/assets/${path}`,width:100,height:200,bytes:100,hash:"a".repeat(64)}]);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;
    insert into auth.users values('${owner}','owner@example.test'),('${editor}','editor@example.test');`);
  for (const name of ["001_book.sql","002_safe_updates.sql","003_public_book_index.sql","004_collaboration.sql","005_comics.sql"])
    await db.exec(await readFile("supabase/migrations/"+name,"utf8"));
  await db.exec(`insert into public.members(user_id,email,role) values('${owner}','owner@example.test','owner'),('${editor}','editor@example.test','editor');
    insert into public.chapters(id,sort_order) values('chapter-1',1),('chapter-2',2);`);
});
afterAll(() => db?.close());
async function as(id: string | null, sql: string) {
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id??""}',false);set role ${id?"authenticated":"anon"};`);
  return db.query<any>(sql);
}
it("installs private TT data and an immutable private image bucket", async () => {
  expect((await db.query<any>("select to_regclass('public.comic_editions')::text as name")).rows[0].name).toBe("comic_editions");
  expect((await db.query<any>("select public from storage.buckets where id='comic-assets'")).rows[0].public).toBe(false);
  await expect(as(null,"select * from public.comic_versions")).rejects.toThrow(/permission/i);
  await expect(as(editor,"insert into public.comic_assets(path) values('forged')")).rejects.toThrow(/permission/i);
});
it("separates drafts, atomically publishes, prevents stale edits and revokes public image access", async () => {
  await db.exec(`reset role;insert into public.comic_assets(path,content_type,bytes,width,height,hash,created_by)
    values('${path}','image/png',100,100,200,'${"a".repeat(64)}','${editor}');`);
  await as(editor,`select public.save_comic('chapter-1','First','ltr','${pages}',0)`);
  expect((await as(null,"select public.get_public_comic('chapter-1') as edition")).rows[0].edition).toBeNull();
  expect((await as(null,`select public.can_read_comic_asset('${path}') as ok`)).rows[0].ok).toBe(false);
  await as(editor,"select public.publish_comic('chapter-1',1,false)");
  expect((await as(null,"select public.get_public_comic('chapter-1') as edition")).rows[0].edition.title).toBe("First");
  expect((await as(null,`select public.can_read_comic_asset('${path}') as ok`)).rows[0].ok).toBe(true);
  await expect(as(editor,`select public.save_comic('chapter-1','Stale','ltr','${pages}',1)`)).rejects.toThrow(/conflict/i);
  await as(editor,`select public.save_comic('chapter-1','Private next draft','rtl','${pages}',2)`);
  expect((await as(null,"select public.get_public_comic('chapter-1') as edition")).rows[0].edition.title).toBe("First");
  await expect(as(editor,"select public.publish_comic('chapter-1',2,true)")).rejects.toThrow(/conflict/i);
  await as(editor,"select public.publish_comic('chapter-1',3,true)");
  expect((await as(null,"select public.get_public_comic('chapter-1') as edition")).rows[0].edition).toBeNull();
  expect((await as(null,`select public.can_read_comic_asset('${path}') as ok`)).rows[0].ok).toBe(false);
  await as(owner,"select public.publish_comic('chapter-1',4,false)");
  await db.exec("reset role;update public.chapters set archived=true where id='chapter-1'");
  expect((await as(null,"select public.get_public_comic('chapter-1') as edition")).rows[0].edition).toBeNull();
  expect((await as(null,`select public.can_read_comic_asset('${path}') as ok`)).rows[0].ok).toBe(false);
  const actions=(await as(owner,"select action from public.admin_audit where entity_type='comic'")).rows.map(r=>r.action);
  expect(actions).toEqual(["save","publish","save","withdraw","publish"]);
});
it("rejects unregistered or forged page metadata, empty publication and revoked editor RPCs", async () => {
  await expect(as(editor,`select public.save_comic('chapter-2','Bad','ltr','${pages.replace('one.png','bad.png').replace('"width":100','"width":101')}',0)`)).rejects.toThrow(/asset/i);
  await as(editor,"select public.save_comic('chapter-2','Empty','ltr','[]',0)");
  await expect(as(editor,"select public.publish_comic('chapter-2',1,false)")).rejects.toThrow(/empty/i);
  await expect(as(null,"select public.save_comic('chapter-2','Bad','ltr','[]',1)")).rejects.toThrow();
  await db.exec(`reset role;update public.members set active=false where user_id='${editor}'`);
  await expect(as(editor,"select public.save_comic('chapter-2','Bad','ltr','[]',1)")).rejects.toThrow(/forbidden/i);
  expect((await as(editor,"select * from public.comic_versions")).rows).toHaveLength(0);
});
it("upgrades old comics into VI and keeps EN saves, publication, conflicts and withdrawal independent",async()=>{
  await db.exec("reset role;insert into public.chapters(id,sort_order) values('chapter-3',3)");
  await as(owner,`select public.save_comic('chapter-3','Existing VI','ltr','${pages}',0)`);
  await as(owner,"select public.publish_comic('chapter-3',1,false)");
  await db.exec("reset role");
  await db.exec(await readFile("supabase/migrations/006_comic_locales.sql","utf8"));
  expect((await db.query<any>("select column_name from information_schema.columns where table_name='comic_editions' and column_name='locale'")).rows[0]?.column_name).toBe("locale");
  expect((await as(null,"select public.get_public_comic('chapter-3','vi') as edition")).rows[0].edition.title).toBe("Existing VI");
  expect((await as(null,"select public.get_public_comic('chapter-3','en') as edition")).rows[0].edition).toBeNull();
  await as(owner,`select public.save_comic('chapter-3','English comic','ltr','${pages}',0,'en')`);
  await as(owner,"select public.publish_comic('chapter-3',1,false,'en')");
  expect((await as(null,"select public.get_public_comic('chapter-3') as edition")).rows[0].edition.title).toBe("Existing VI");
  expect((await as(null,"select public.get_public_comic('chapter-3','en') as edition")).rows[0].edition.title).toBe("English comic");
  await expect(as(owner,`select public.save_comic('chapter-3','Stale','ltr','${pages}',0,'en')`)).rejects.toThrow(/conflict/i);
  await as(owner,"select public.publish_comic('chapter-3',2,true,'vi')");
  expect((await as(null,"select public.get_public_comic('chapter-3','vi') as edition")).rows[0].edition).toBeNull();
  expect((await as(null,`select public.can_read_comic_asset('${path}') as ok`)).rows[0].ok).toBe(true);
  await as(owner,"select public.publish_comic('chapter-3',2,true,'en')");
  expect((await as(null,`select public.can_read_comic_asset('${path}') as ok`)).rows[0].ok).toBe(false);
  await expect(as(editor,`select public.save_comic('chapter-3','Revoked','ltr','${pages}',3,'en')`)).rejects.toThrow(/forbidden/i);
  await expect(as(owner,`select public.save_comic('chapter-3','Invalid','ltr','${pages}',3,'fr')`)).rejects.toThrow(/locale/i);
  expect((await as(owner,"select distinct locale from public.admin_audit where entity_type='comic' and entity_id='chapter-3' and locale is not null order by locale")).rows.map(r=>r.locale)).toEqual(["en","vi"]);
});
