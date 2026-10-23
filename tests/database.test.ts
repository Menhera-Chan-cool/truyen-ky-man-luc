import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

describe("PostgreSQL publication and permission boundaries", () => {
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
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
      alter table storage.objects enable row level security;
      insert into auth.users values ('${owner}','owner@example.test'),('${editor}','editor@example.test');`);
    const schema = await readFile("supabase/migrations/001_book.sql", "utf8");
    // Exercise the upgrade from the original routines, not only a fresh install.
    await db.exec(schema.replaceAll(" where id='truyen-ky-man-luc';", ";"));
    await db.exec(
      await readFile("supabase/migrations/002_safe_updates.sql", "utf8"),
    );
    await db.exec(
      await readFile("supabase/migrations/003_public_book_index.sql", "utf8"),
    );
  });
  afterAll(async () => {
    await db?.close();
  });
  const asUser = async (id: string | null) => {
    await db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${id ?? ""}',false);set role ${id ? "authenticated" : "anon"};`,
    );
  };
  it("installs protected tables", async () => {
    expect(
      (
        await db.query<{ name: string | null }>(
          "select to_regclass('public.members')::text as name",
        )
      ).rows[0].name,
    ).toBe("members");
  });
  it("upgrades all four book routines without resetting grants", async () => {
    const result = await db.query<{ prosrc: string }>(
      `select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('save_book','reorder_chapters','archive_chapter','seed_book')`,
    );
    expect(result.rows).toHaveLength(4);
    for (const row of result.rows)
      expect(row.prosrc).toMatch(
        /update public\.book[^;]*where id='truyen-ky-man-luc'/i,
      );
    await asUser(editor);
    await expect(
      db.query("select public.seed_book('{}'::jsonb)"),
    ).rejects.toThrow(/permission denied/i);
    await db.exec("reset role");
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege('service_role','public.seed_book(jsonb)','EXECUTE') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
  });
  it("publishes only an explicit revision and rejects stale saves", async () => {
    await db.exec(
      `insert into public.members(user_id,email,role) values ('${owner}','owner@example.test','owner'),('${editor}','editor@example.test','editor');`,
    );
    await asUser(editor);
    await db.query(
      `select public.save_chapter('chapter-1','en','One','<p>First edition</p>','text',null,0)`,
    );
    await expect(
      db.query(
        `select public.save_chapter('chapter-1','en','Wrong','<p>Stale</p>','text',null,0)`,
      ),
    ).rejects.toThrow(/conflict/i);
    await db.query(`select public.publish_chapter('chapter-1','en',1,false)`);
    await db.query(
      `select public.save_chapter('chapter-1','en','Draft secret','<p>PRIVATE DRAFT</p>','text',null,1)`,
    );
    await asUser(null);
    const result = await db.query<{ book: unknown }>(
      "select public.get_public_book() as book",
    );
    expect(JSON.stringify(result.rows)).toContain("First edition");
    expect(JSON.stringify(result.rows)).not.toContain("PRIVATE DRAFT");
    await expect(
      db.query("select * from public.chapter_versions"),
    ).rejects.toThrow(/permission denied/i);
  });
  it("rejects anonymous and revoked editor writes", async () => {
    await expect(
      db.query(
        `select public.save_chapter('chapter-2','en','Two','<p>x</p>','text',null,0)`,
      ),
    ).rejects.toThrow();
  });
  it("returns only published metadata without any chapter HTML", async () => {
    await asUser(null);
    const result = await db.query<{
      book: { chapters: { en?: { html?: string; title: string } }[] };
    }>("select public.get_public_book_index() as book");
    const book = result.rows[0].book;
    expect(book.chapters[0].en?.title).toBe("One");
    expect(book.chapters[0].en).not.toHaveProperty("html");
    expect(JSON.stringify(book)).not.toContain("PRIVATE DRAFT");
    expect(JSON.stringify(book)).not.toContain("First edition");
  });
  it("rejects revoked editor writes", async () => {
    await expect(
      db.query(
        `select public.save_chapter('chapter-2','en','Two','<p>x</p>','text',null,0)`,
      ),
    ).rejects.toThrow();
    await db.exec("reset role");
    await db.query(`update public.members set active=false where user_id=$1`, [
      editor,
    ]);
    await asUser(editor);
    await expect(
      db.query(
        `select public.save_chapter('chapter-2','en','Two','<p>x</p>','text',null,0)`,
      ),
    ).rejects.toThrow(/forbidden/i);
    await db.exec("reset role");
    await db.query(`update public.members set active=true where user_id=$1`, [
      editor,
    ]);
  });
  it("does not let an editor elevate privileges or change membership", async () => {
    await asUser(editor);
    await db.query(`update public.members set role='owner' where user_id=$1`, [
      editor,
    ]);
    await db.exec("reset role");
    expect(
      (
        await db.query<{ role: string }>(
          "select role from public.members where user_id=$1",
          [editor],
        )
      ).rows[0].role,
    ).toBe("editor");
  });
  it("rolls back a batch import when any selected chapter conflicts", async () => {
    await asUser(editor);
    const items = [
      {
        id: "chapter-2",
        locale: "en",
        title: "Two",
        html: "<p>Two</p>",
        kind: "text",
        expectedRevision: 0,
      },
      {
        id: "chapter-1",
        locale: "en",
        title: "Conflict",
        html: "<p>Wrong</p>",
        kind: "text",
        expectedRevision: 0,
      },
    ];
    await expect(
      db.query("select public.save_chapters($1::jsonb)", [
        JSON.stringify(items),
      ]),
    ).rejects.toThrow(/conflict/i);
    expect(
      (await db.query("select id from public.chapters where id='chapter-2'"))
        .rows,
    ).toHaveLength(0);
  });
  it("keeps source and draft assets private and withdraws publication", async () => {
    await asUser(null);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.can_read_asset('private-source.pdf') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    await asUser(editor);
    await db.query(`select public.publish_chapter('chapter-1','en',2,true)`);
    await asUser(null);
    expect(
      JSON.stringify((await db.query("select public.get_public_book()")).rows),
    ).not.toContain("First edition");
    expect(
      JSON.stringify(
        (await db.query("select public.get_public_book_index()")).rows,
      ),
    ).not.toContain("chapter-1");
  });
  it("cannot revoke the last active owner", async () => {
    await asUser(owner);
    await expect(
      db.query(`update public.members set active=false where user_id=$1`, [
        owner,
      ]),
    ).rejects.toThrow(/last owner/i);
  });
  it("requires an expected revision even for direct RPC callers", async () => {
    await asUser(editor);
    await expect(
      db.query(`select public.publish_chapter('chapter-1','en',null,false)`),
    ).rejects.toThrow(/revision|invalid|conflict/i);
  });
  it("rolls back a batch publication if any edition has changed", async () => {
    await asUser(editor);
    await db.query(
      `select public.save_chapter('batch-test','en','Batch only','<p>Batch only</p>','text',null,0)`,
    );
    await expect(
      db.query("select public.publish_chapters($1::jsonb)", [
        JSON.stringify([
          { id: "batch-test", locale: "en", expectedRevision: 1 },
          { id: "chapter-1", locale: "en", expectedRevision: 999 },
        ]),
      ]),
    ).rejects.toThrow(/conflict/i);
    await asUser(null);
    expect(
      JSON.stringify((await db.query("select public.get_public_book()")).rows),
    ).not.toContain("Batch only");
  });
  it("does not make a private asset public merely because its path appears in prose", async () => {
    await asUser(editor);
    await db.query(
      `insert into public.assets(path,content_type,created_by) values ('test/private.png','image/png',$1),('test/public.png','image/png',$1)`,
      [editor],
    );
    await db.query(
      `select public.save_chapter('asset-test','en','Images','<p>A private path: /api/assets/test/private.png</p><img src="/api/assets/test/public.png">','text',null,0)`,
    );
    await db.query(`select public.publish_chapter('asset-test','en',1,false)`);
    await asUser(null);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.can_read_asset('test/private.png') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.can_read_asset('test/public.png') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
    await asUser(editor);
    await db.query(`select public.publish_chapter('asset-test','en',1,true)`);
    await asUser(null);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.can_read_asset('test/public.png') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  it("seeds all 41 editions atomically and refuses to overwrite existing chapters", async () => {
    await db.exec(
      "reset role;truncate public.chapter_editions,public.chapter_versions,public.chapters cascade;set role service_role;",
    );
    const book = JSON.parse(await readFile("src/data/book.json", "utf8"));
    await db.query("select public.seed_book($1::jsonb)", [
      JSON.stringify(book),
    ]);
    const result = (
      await db.query<{ book: { chapters: { vi?: unknown; en?: unknown }[] } }>(
        "select public.get_public_book() as book",
      )
    ).rows[0].book;
    expect(result.chapters.filter((c) => c.vi)).toHaveLength(21);
    expect(result.chapters.filter((c) => c.en)).toHaveLength(20);
    await expect(
      db.query("select public.seed_book($1::jsonb)", [JSON.stringify(book)]),
    ).rejects.toThrow(/not overwrite/i);
  });
});
