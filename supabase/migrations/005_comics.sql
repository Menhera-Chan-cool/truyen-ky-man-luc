-- Apply once after 004. Separate TT records; existing VI/EN content is untouched.
begin;
create table public.comic_assets (
 path text primary key check(path ~ '^[a-f0-9-]{36}/comics/[a-f0-9-]{36}\.(png|jpg|webp)$'),
 content_type text not null check(content_type in ('image/png','image/jpeg','image/webp')),
 bytes integer not null check(bytes between 1 and 20971520),
 width integer not null check(width>0), height integer not null check(height>0),
 hash text not null check(hash ~ '^[a-f0-9]{64}$'),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 check(width::bigint*height<=40000000)
);
create table public.comic_versions (
 id uuid primary key default gen_random_uuid(), chapter_id text not null references public.chapters(id),
 title text not null check(length(trim(title)) between 1 and 300),
 direction text not null check(direction in ('ltr','rtl')),
 pages jsonb not null check(jsonb_typeof(pages)='array' and jsonb_array_length(pages)<=300 and octet_length(pages::text)<=1048576),
 revision integer not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp(),
 unique(chapter_id,revision)
);
create table public.comic_editions (
 chapter_id text primary key references public.chapters(id), draft_id uuid references public.comic_versions(id),
 published_id uuid references public.comic_versions(id), revision integer not null default 0
);
alter table public.comic_assets enable row level security;
alter table public.comic_versions enable row level security;
alter table public.comic_editions enable row level security;
revoke all on public.comic_assets,public.comic_versions,public.comic_editions from public,anon,authenticated;
grant select on public.comic_assets,public.comic_versions,public.comic_editions to authenticated;
grant all on public.comic_assets,public.comic_versions,public.comic_editions to service_role;
create policy comic_assets_editor_read on public.comic_assets for select to authenticated using(public.is_editor());
create policy comic_versions_editor_read on public.comic_versions for select to authenticated using(public.is_editor());
create policy comic_editions_editor_read on public.comic_editions for select to authenticated using(public.is_editor());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('comic-assets','comic-assets',false,20971520,array['image/png','image/jpeg','image/webp']);
-- Immutable object names. No authenticated overwrite/delete can damage a published page.
create policy comic_storage_read on storage.objects for select to authenticated
 using(bucket_id='comic-assets' and public.is_editor());
create policy comic_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='comic-assets' and public.is_editor() and name ~ ('^'||auth.uid()::text||'/comics/[a-f0-9-]{36}\.(png|jpg|webp)$'));

create function public.save_comic(p_id text,p_title text,p_direction text,p_pages jsonb,p_expected_revision integer)
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_revision integer; version_id uuid; page jsonb; total_bytes bigint:=0; cleaned jsonb:='[]'; asset public.comic_assets;
begin
 if not public.is_editor() then raise exception 'Forbidden';end if;
 if p_expected_revision is null or p_expected_revision<0 or p_title is null or length(trim(p_title)) not between 1 and 300
   or p_direction is null or p_direction not in ('ltr','rtl') or jsonb_typeof(p_pages) is distinct from 'array'
   or jsonb_array_length(p_pages)>300 or octet_length(p_pages::text)>1048576 then raise exception 'Invalid comic draft';end if;
 perform 1 from public.chapters where id=p_id and not archived for share;
 if not found then raise exception 'Invalid chapter';end if;
 insert into public.comic_editions(chapter_id) values(p_id) on conflict do nothing;
 select revision into current_revision from public.comic_editions where chapter_id=p_id for update;
 if current_revision<>p_expected_revision then raise exception 'Conflict: reload the latest comic draft';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_pages))<>jsonb_array_length(p_pages) then raise exception 'Invalid page IDs';end if;
 for page in select * from jsonb_array_elements(p_pages) loop
   if jsonb_typeof(page) is distinct from 'object' or coalesce(page->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$'
    or length(coalesce(page->>'name','')) not between 1 and 250 then raise exception 'Invalid page';end if;
   select * into asset from public.comic_assets where '/api/comic/assets/'||path=page->>'path';
   if not found or (page->>'width')::integer is distinct from asset.width or (page->>'height')::integer is distinct from asset.height
    or (page->>'bytes')::integer is distinct from asset.bytes or page->>'hash' is distinct from asset.hash then raise exception 'Invalid or unregistered comic asset';end if;
   total_bytes:=total_bytes+asset.bytes;
   cleaned:=cleaned||jsonb_build_array(jsonb_build_object('id',page->>'id','name',page->>'name','path','/api/comic/assets/'||asset.path,
    'width',asset.width,'height',asset.height,'bytes',asset.bytes,'hash',asset.hash));
 end loop;
 if total_bytes>209715200 then raise exception 'Comic exceeds 200 MB';end if;
 insert into public.comic_versions(chapter_id,title,direction,pages,revision,created_by)
  values(p_id,trim(p_title),p_direction,cleaned,current_revision+1,auth.uid()) returning id into version_id;
 update public.comic_editions set draft_id=version_id,revision=current_revision+1 where chapter_id=p_id;
 insert into public.admin_audit(actor_id,actor_email,action,entity_type,entity_id,revision)
  select auth.uid(),email,'save','comic',p_id,current_revision+1 from public.members where user_id=auth.uid();
 return jsonb_build_object('revision',current_revision+1,'id',version_id);
end $$;

create function public.publish_comic(p_id text,p_expected_revision integer,p_withdraw boolean default false)
 returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare edition public.comic_editions;
begin
 if not public.is_editor() then raise exception 'Forbidden';end if;
 perform 1 from public.chapters where id=p_id and not archived for share;
 if not found then raise exception 'Invalid chapter';end if;
 select * into edition from public.comic_editions where chapter_id=p_id for update;
 if p_expected_revision is null or edition.revision is null or edition.revision<>p_expected_revision then raise exception 'Conflict: reload the latest comic draft';end if;
 if p_withdraw is null then raise exception 'Invalid publication';end if;
 if not p_withdraw and not exists(select 1 from public.comic_versions where id=edition.draft_id and jsonb_array_length(pages)>0) then raise exception 'Cannot publish an empty comic';end if;
 update public.comic_editions set published_id=case when p_withdraw then null else draft_id end,revision=revision+1 where chapter_id=p_id;
 insert into public.admin_audit(actor_id,actor_email,action,entity_type,entity_id,revision)
  select auth.uid(),email,case when p_withdraw then 'withdraw' else 'publish' end,'comic',p_id,edition.revision+1 from public.members where user_id=auth.uid();
 return edition.revision+1;
end $$;

create function public.get_public_comic(p_id text) returns jsonb
 language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',v.chapter_id,'title',v.title,'pages',v.pages,'direction',v.direction,'revision',v.revision,
  'updatedAt',floor(extract(epoch from v.created_at)*1000))
 from public.comic_versions v join public.comic_editions e on e.published_id=v.id join public.chapters c on c.id=e.chapter_id
 where c.id=p_id and not c.archived
$$;
create function public.get_public_comic_index() returns jsonb
 language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',v.title,'pages',jsonb_array_length(v.pages),'source','published',
  'updatedAt',floor(extract(epoch from v.created_at)*1000)) order by c.sort_order),'[]'::jsonb)
 from public.comic_versions v join public.comic_editions e on e.published_id=v.id join public.chapters c on c.id=e.chapter_id where not c.archived
$$;
create function public.can_read_comic_asset(p_path text) returns boolean
 language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.comic_versions v join public.comic_editions e on e.published_id=v.id
  join public.chapters c on c.id=e.chapter_id where not c.archived
  and v.pages @> jsonb_build_array(jsonb_build_object('path','/api/comic/assets/'||p_path)))
$$;
revoke all on function public.save_comic(text,text,text,jsonb,integer),public.publish_comic(text,integer,boolean),public.get_public_comic(text),public.get_public_comic_index(),public.can_read_comic_asset(text) from public,anon,authenticated;
grant execute on function public.save_comic(text,text,text,jsonb,integer),public.publish_comic(text,integer,boolean) to authenticated;
grant execute on function public.get_public_comic(text),public.get_public_comic_index(),public.can_read_comic_asset(text) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
