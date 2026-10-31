import {it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
import {headingFontId,headingFontFamily,fontFileInfo} from "../src/lib/heading-fonts";
const actor="11111111-1111-4111-8111-111111111111",font="22222222-2222-4222-8222-222222222222";
it("uses only canonical font IDs in CSS and validates font containers",()=>{
 expect(headingFontId(undefined)).toBe("default");expect(headingFontId('x";url(https://evil)')).toBe("default");
 expect(headingFontFamily(font)).toContain(font);expect(headingFontFamily('bad"')).not.toContain('bad"');
 expect(()=>fontFileInfo("bad.ttf",new Uint8Array([0,1,0,0]))).toThrow();
 const file=new Uint8Array(64),view=new DataView(file.buffer);file.set([0,1,0,0]);view.setUint16(4,2);file.set(new TextEncoder().encode("cmap"),12);view.setUint32(20,44);view.setUint32(24,4);file.set(new TextEncoder().encode("name"),28);view.setUint32(36,48);view.setUint32(40,4);
 expect(fontFileInfo("one.ttf",file)).toMatchObject({format:"ttf",mime:"font/ttf"});view.setUint32(24,10000);expect(()=>fontFileInfo("one.ttf",file)).toThrow();
});
it("protects shared fonts, keeps draft/published choices independent, and refuses deletion while used",async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
 for(const file of ["001_book.sql","002_safe_updates.sql","003_public_book_index.sql","004_collaboration.sql","20261031103949_restrict_management_rpc.sql","20261031134023_heading_fonts.sql"])await db.exec(await readFile("supabase/migrations/"+file,"utf8"));
 await db.query("insert into auth.users values($1,'editor@example.test')",[actor]);await db.query("insert into public.members(user_id,email,role) values($1,'editor@example.test','editor')",[actor]);
 await db.query("insert into public.heading_fonts(id,label,path,format,bytes,hash,created_by) values($1,'Calligraphy',$2,'ttf',64,$3,$4)",[font,actor+"/"+font+".ttf","a".repeat(64),actor]);
 const as=(role:string)=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${role==="authenticated"?actor:""}',false);set role ${role};`);
 await as("anon");await expect(db.query("select * from public.heading_fonts")).rejects.toThrow(/permission/i);await expect(db.query("select public.archive_heading_font($1)",[font])).rejects.toThrow(/permission/i);
 expect((await db.query<{allowed:boolean}>("select public.can_read_heading_font($1) as allowed",[font])).rows[0].allowed).toBe(false);
 await as("authenticated");expect((await db.query("select id from public.heading_fonts")).rows).toHaveLength(1);await expect(db.query("delete from public.heading_fonts where id=$1",[font])).rejects.toThrow(/permission/i);
 await db.exec("reset role;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;");await as("authenticated");
 await db.query("insert into storage.objects(bucket_id,name) values('heading-fonts',$1)",[actor+"/"+font+".ttf"]);
 await expect(db.query("insert into storage.objects(bucket_id,name) values('heading-fonts',$1)",[font+"/"+font+".ttf"])).rejects.toThrow(/row.level/i);
 await db.query("delete from storage.objects where bucket_id='heading-fonts'");expect((await db.query("select id from storage.objects where bucket_id='heading-fonts'")).rows).toHaveLength(1);
 const meta={vi:{title:"VI",summary:"",frontCover:"/book/cover.jpg",headingFont:font},en:{title:"EN",summary:"",frontCover:"/book/cover.jpg"}};
 await db.query("select public.save_book($1,0,false)",[JSON.stringify(meta)]);
 expect((await db.query<{b:any}>("select public.get_public_book_index() as b")).rows[0].b.meta.vi.headingFont).toBeUndefined();
 await expect(db.query("select public.archive_heading_font($1)",[font])).rejects.toThrow(/in use/i);
 await db.query("select public.save_book($1,1,true)",[JSON.stringify(meta)]);
 const published=(await db.query<{b:any}>("select public.get_public_book_index() as b")).rows[0].b;
 expect(published.meta.vi.headingFont).toBe(font);expect(published.meta.en.headingFont).toBeUndefined();
 expect((await db.query<{allowed:boolean}>("select public.can_read_heading_font($1) as allowed",[font])).rows[0].allowed).toBe(true);
 await expect(db.query("select public.save_book($1,1,true)",[JSON.stringify(meta)])).rejects.toThrow(/conflict/i);
 await expect(db.query("select public.save_book($1,2,false)",[JSON.stringify({...meta,vi:{...meta.vi,headingFont:actor}})])).rejects.toThrow(/heading font/i);
 const reset={...meta,vi:{...meta.vi,headingFont:"default"}};await db.query("select public.save_book($1,2,false)",[JSON.stringify(reset)]);
 await expect(db.query("select public.archive_heading_font($1)",[font])).rejects.toThrow(/in use/i);
 await db.query("select public.save_book($1,3,true)",[JSON.stringify(reset)]);await db.query("select public.archive_heading_font($1)",[font]);
 expect((await db.query<{archived:boolean}>("select archived from public.heading_fonts where id=$1",[font])).rows[0].archived).toBe(true);
 await expect(db.query("select public.save_book($1,4,false)",[JSON.stringify(meta)])).rejects.toThrow(/heading font/i);
 await as("anon");expect((await db.query<{allowed:boolean}>("select public.can_read_heading_font($1) as allowed",[font])).rows[0].allowed).toBe(false);
 await db.exec("reset role");await db.query("update public.members set active=false where user_id=$1",[actor]);await as("authenticated");expect((await db.query("select id from public.heading_fonts")).rows).toHaveLength(0);await expect(db.query("select public.archive_heading_font($1)",[font])).rejects.toThrow(/forbidden/i);
 await expect(db.query("insert into storage.objects(bucket_id,name) values('heading-fonts',$1)",[actor+"/"+actor+".ttf"])).rejects.toThrow(/row.level/i);
 }finally{await db.close();}
});
