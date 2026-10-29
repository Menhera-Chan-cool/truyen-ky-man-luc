import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111",
  editor = "22222222-2222-4222-8222-222222222222";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;
 insert into auth.users values('${owner}','owner@example.test'),('${editor}','editor@example.test');`);
  for (const f of [
    "001_book.sql",
    "002_safe_updates.sql",
    "003_public_book_index.sql",
    "004_collaboration.sql",
  ])
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `insert into public.members(user_id,email,role) values('${owner}','owner@example.test','owner'),('${editor}','editor@example.test','editor');`,
  );
});
afterAll(() => db?.close());
async function as(id: string, sql: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
  return db.query(sql);
}
it("logs draft/import/publication changes atomically and denies audit tampering", async () => {
  await as(
    owner,
    `select public.save_chapters_with_reason('[{"id":"chapter-1","locale":"vi","title":"One","html":"<p>Text</p>","kind":"text","expectedRevision":0}]','import')`,
  );
  await as(editor, `select public.publish_chapter('chapter-1','vi',1,false)`);
  const r = await as(
    owner,
    `select action,actor_email from public.admin_audit where entity_id='chapter-1' order by created_at,id`,
  );
  expect(r.rows).toEqual(
    expect.arrayContaining([
      { action: "import", actor_email: "owner@example.test" },
      { action: "publish", actor_email: "editor@example.test" },
    ]),
  );
  await expect(as(editor, `delete from public.admin_audit`)).rejects.toThrow(
    /permission|policy/i,
  );
  await expect(
    as(
      editor,
      `select public.save_chapters_with_reason('[{"id":"chapter-2","locale":"vi","title":"Two","html":"<p>x</p>","kind":"text","expectedRevision":0},{"id":"chapter-1","locale":"vi","title":"One","html":"<p>x</p>","kind":"text","expectedRevision":0}]','replace')`,
    ),
  ).rejects.toThrow(/conflict/i);
  expect(
    (
      await as(
        owner,
        `select * from public.admin_audit where entity_id='chapter-2'`,
      )
    ).rows,
  ).toHaveLength(0);
  await as(owner, `select public.archive_chapter('chapter-1')`);
  await expect(
    as(
      owner,
      `select public.save_chapters_with_reason('[{"id":"chapter-1","locale":"vi","title":"One","html":"<p>x</p>","kind":"text","expectedRevision":1}]','replace')`,
    ),
  ).rejects.toThrow(/conflict/i);
  await db.exec(
    "reset role;update public.chapters set archived=false where id='chapter-1'",
  );
});
it("publishes recent presence under the verified identity, rejects revoked/anonymous users", async () => {
  await as(
    editor,
    `select public.editor_heartbeat('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','chapter-1','vi',false)`,
  );
  const r = await as(
    owner,
    `select email,chapter_id,locale from public.editor_presence`,
  );
  expect(r.rows).toEqual([
    { email: "editor@example.test", chapter_id: "chapter-1", locale: "vi" },
  ]);
  await as(
    owner,
    `update public.members set active=false where user_id='${editor}'`,
  );
  await expect(
    as(
      editor,
      `select public.editor_heartbeat('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','chapter-1','vi',false)`,
    ),
  ).rejects.toThrow(/forbidden/i);
  expect(
    (await as(editor, `select * from public.admin_audit`)).rows,
  ).toHaveLength(0);
  await db.exec("reset role;set role anon");
  await expect(db.query("select * from public.admin_audit")).rejects.toThrow(
    /permission/i,
  );
  await expect(
    db.query("select * from public.editor_presence"),
  ).rejects.toThrow(/permission/i);
});
