-- Invitation-only, single-book publishing schema.
begin;
create table public.members (
  user_id uuid primary key references auth.users(id), email text not null unique,
  role text not null check(role in ('owner','editor')), active boolean not null default true,
  created_at timestamptz not null default now()
);
create function public.is_editor() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.members where user_id=auth.uid() and active)
$$;
create function public.is_owner() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.members where user_id=auth.uid() and active and role='owner')
$$;
create table public.book (
  id text primary key default 'truyen-ky-man-luc' check(id='truyen-ky-man-luc'),
  author text not null default 'Nguyễn Dữ', draft jsonb not null default '{"vi":{},"en":{}}',
  published jsonb not null default '{"vi":{},"en":{}}', revision integer not null default 0
);
insert into public.book(id) values ('truyen-ky-man-luc');
create table public.chapters (
  id text primary key check(id ~ '^[a-z0-9-]{1,80}$'), sort_order numeric not null,
  archived boolean not null default false
);
create table public.chapter_versions (
  id uuid primary key default gen_random_uuid(), chapter_id text not null references public.chapters(id),
  locale text not null check(locale in ('vi','en')), title text not null check(length(title) between 1 and 300),
  html text not null check(octet_length(html)<=2097152), kind text not null check(kind in ('text','illustration','pdf')),
  pdf_path text, revision integer not null, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  unique(chapter_id,locale,revision)
);
create table public.chapter_editions (
  chapter_id text not null references public.chapters(id), locale text not null check(locale in ('vi','en')),
  draft_id uuid references public.chapter_versions(id), published_id uuid references public.chapter_versions(id),
  revision integer not null default 0, primary key(chapter_id,locale)
);
create table public.assets (
  path text primary key check(path ~ '^[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|gif|webp|pdf)$'),
  content_type text not null check(content_type in ('image/jpeg','image/png','image/gif','image/webp','application/pdf')),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.members enable row level security;
alter table public.book enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_versions enable row level security;
alter table public.chapter_editions enable row level security;
alter table public.assets enable row level security;
create policy member_read on public.members for select to authenticated using(user_id=auth.uid() or public.is_owner());
create policy owner_members on public.members for all to authenticated using(public.is_owner()) with check(public.is_owner());
create policy editor_book on public.book for select to authenticated using(public.is_editor());
create policy editor_chapters on public.chapters for select to authenticated using(public.is_editor());
create policy editor_versions on public.chapter_versions for select to authenticated using(public.is_editor());
create policy editor_editions on public.chapter_editions for select to authenticated using(public.is_editor());
create policy editor_assets on public.assets for select to authenticated using(public.is_editor());
create policy editor_assets_insert on public.assets for insert to authenticated with check(public.is_editor() and created_by=auth.uid());
revoke all on public.members,public.book,public.chapters,public.chapter_versions,public.chapter_editions,public.assets from anon,authenticated;
grant select on public.members,public.book,public.chapters,public.chapter_versions,public.chapter_editions,public.assets to authenticated;
grant insert,update,delete on public.members to authenticated;
grant insert on public.assets to authenticated;
grant all on public.members,public.book,public.chapters,public.chapter_versions,public.chapter_editions,public.assets to service_role;

create function public.protect_last_owner() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(832771);
  if old.role='owner' and old.active and (tg_op='DELETE' or new.role<>'owner' or not new.active) then
    if not exists(select 1 from public.members where user_id<>old.user_id and role='owner' and active) then
      raise exception 'Cannot revoke the last owner';
    end if;
  end if;
  if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger last_owner before update or delete on public.members for each row execute function public.protect_last_owner();

create function public.save_chapter(p_id text,p_locale text,p_title text,p_html text,p_kind text,p_pdf_path text,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_revision integer; new_id uuid; next_order numeric;
begin
  if not public.is_editor() then raise exception 'Forbidden';end if;
  if p_locale not in ('vi','en') or p_id !~ '^[a-z0-9-]{1,80}$' or p_expected_revision is null then raise exception 'Invalid chapter';end if;
  -- Serialize chapter creation and ordering, including first imports by multiple editors.
  perform pg_advisory_xact_lock(832772);
  select coalesce(max(sort_order),-1)+1 into next_order from public.chapters;
  insert into public.chapters(id,sort_order) values(p_id,next_order) on conflict(id) do nothing;
  insert into public.chapter_editions(chapter_id,locale) values(p_id,p_locale) on conflict do nothing;
  select revision into current_revision from public.chapter_editions where chapter_id=p_id and locale=p_locale for update;
  if current_revision<>p_expected_revision then raise exception 'Conflict: reload the latest chapter';end if;
  if p_kind='pdf' and (p_pdf_path is null or not exists(select 1 from public.assets where path=p_pdf_path and content_type='application/pdf')) then raise exception 'Invalid PDF asset';end if;
  insert into public.chapter_versions(chapter_id,locale,title,html,kind,pdf_path,revision,created_by)
    values(p_id,p_locale,p_title,p_html,p_kind,p_pdf_path,current_revision+1,auth.uid()) returning id into new_id;
  update public.chapter_editions set draft_id=new_id,revision=current_revision+1 where chapter_id=p_id and locale=p_locale;
  update public.chapters set archived=false where id=p_id;
  return jsonb_build_object('id',new_id,'revision',current_revision+1);
end $$;
create function public.save_chapters(p_items jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; results jsonb:='[]';
begin
  if not public.is_editor() then raise exception 'Forbidden';end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid import selection';end if;
  for item in select * from jsonb_array_elements(p_items) loop
    results:=results||jsonb_build_array(public.save_chapter(item->>'id',item->>'locale',item->>'title',item->>'html',coalesce(item->>'kind','text'),item->>'pdfPath',(item->>'expectedRevision')::integer));
  end loop;return results;
end $$;
create function public.publish_chapter(p_id text,p_locale text,p_expected_revision integer,p_withdraw boolean default false)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare edition public.chapter_editions;
begin
  if not public.is_editor() then raise exception 'Forbidden';end if;
  select * into edition from public.chapter_editions where chapter_id=p_id and locale=p_locale for update;
  if p_expected_revision is null or edition.revision is null or edition.revision<>p_expected_revision then raise exception 'Conflict: reload the latest chapter';end if;
  update public.chapter_editions set published_id=case when p_withdraw then null else draft_id end where chapter_id=p_id and locale=p_locale;
end $$;
create function public.publish_chapters(p_items jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb;
begin
  if not public.is_editor() then raise exception 'Forbidden';end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid publication selection';end if;
  for item in select * from jsonb_array_elements(p_items) loop
    perform public.publish_chapter(item->>'id',item->>'locale',(item->>'expectedRevision')::integer,false);
  end loop;
end $$;
create function public.save_book(p_meta jsonb,p_expected_revision integer,p_publish boolean default false)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare current_revision integer;
begin
  if not public.is_editor() then raise exception 'Forbidden';end if;
  if jsonb_typeof(p_meta->'vi')<>'object' or jsonb_typeof(p_meta->'en')<>'object' then raise exception 'Invalid bilingual metadata';end if;
  select revision into current_revision from public.book for update;
  if p_expected_revision is null or current_revision<>p_expected_revision then raise exception 'Conflict: reload the book';end if;
  update public.book set draft=p_meta,published=case when p_publish then p_meta else published end,revision=revision+1 where id='truyen-ky-man-luc';
  return current_revision+1;
end $$;
create function public.reorder_chapters(p_ids text[],p_expected_revision integer) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare current_revision integer; item text; pos integer:=0;
begin
  if not public.is_editor() then raise exception 'Forbidden';end if;
  select revision into current_revision from public.book for update;
  if p_expected_revision is null or current_revision<>p_expected_revision then raise exception 'Conflict: reload the book';end if;
  if cardinality(p_ids)<>(select count(*) from public.chapters where not archived) or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) then raise exception 'Incomplete chapter order';end if;
  foreach item in array p_ids loop
    update public.chapters set sort_order=pos where id=item and not archived;
    if not found then raise exception 'Invalid chapter';end if;pos:=pos+1;
  end loop;
  update public.book set revision=revision+1 where id='truyen-ky-man-luc';return current_revision+1;
end $$;
create function public.archive_chapter(p_id text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_editor() then raise exception 'Forbidden';end if;
  update public.chapters set archived=true where id=p_id;
  update public.book set revision=revision+1 where id='truyen-ky-man-luc';
end $$;
create function public.get_public_book() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',b.id,'author',b.author,'meta',b.published,'revision',b.revision,'chapters',
    coalesce((select jsonb_agg(section order by position) from (
      select c.sort_order as position,jsonb_build_object('id',c.id,'order',c.sort_order)||jsonb_object_agg(e.locale,
        jsonb_strip_nulls(jsonb_build_object('title',v.title,'html',v.html,'revision',v.revision,'kind',v.kind,'pdfPath',v.pdf_path))) as section
      from public.chapters c join public.chapter_editions e on e.chapter_id=c.id join public.chapter_versions v on v.id=e.published_id
      where not c.archived group by c.id,c.sort_order
    ) sections),'[]'::jsonb)) from public.book b
$$;
create function public.can_read_asset(p_path text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.assets a where a.path=p_path and (
    exists(select 1 from public.book b where '/api/assets/'||p_path in (
      b.published->'vi'->>'frontCover',b.published->'vi'->>'backCover',b.published->'en'->>'frontCover',b.published->'en'->>'backCover'))
    or exists(select 1 from public.chapter_versions v join public.chapter_editions e on e.published_id=v.id join public.chapters c on c.id=e.chapter_id
      where not c.archived and (v.pdf_path=p_path or exists(
        select 1 from regexp_matches(v.html,'<img\s[^>]*?src="(/api/assets/[a-zA-Z0-9/_-]+\.[a-z]+)"[^>]*>','g') m
        where m[1]='/api/assets/'||p_path)))
  ))
$$;

create function public.seed_book(p_book jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare chapter jsonb; lang text; edition jsonb; version_id uuid;
begin
  if exists(select 1 from public.chapters) then raise exception 'Book already contains chapters. Seed will not overwrite them.';end if;
  if p_book->>'id'<>'truyen-ky-man-luc' or jsonb_array_length(p_book->'chapters') not between 1 and 100 then raise exception 'Invalid seed book';end if;
  update public.book set author=p_book->>'author',draft=p_book->'meta',published=p_book->'meta',revision=1 where id='truyen-ky-man-luc';
  for chapter in select * from jsonb_array_elements(p_book->'chapters') loop
    insert into public.chapters(id,sort_order) values(chapter->>'id',(chapter->>'order')::numeric);
    foreach lang in array array['vi','en'] loop
      edition:=chapter->lang;
      if edition is not null then
        insert into public.chapter_versions(chapter_id,locale,title,html,kind,pdf_path,revision)
          values(chapter->>'id',lang,edition->>'title',edition->>'html',edition->>'kind',edition->>'pdfPath',1) returning id into version_id;
        insert into public.chapter_editions(chapter_id,locale,draft_id,published_id,revision) values(chapter->>'id',lang,version_id,version_id,1);
      end if;
    end loop;
  end loop;
end $$;
revoke execute on function public.seed_book(jsonb),public.publish_chapters(jsonb) from public,anon;
grant execute on function public.seed_book(jsonb) to service_role;
grant execute on function public.publish_chapters(jsonb) to authenticated,service_role;

revoke execute on function public.is_editor(),public.is_owner(),public.protect_last_owner(),public.save_chapter(text,text,text,text,text,text,integer),public.save_chapters(jsonb),public.publish_chapter(text,text,integer,boolean),public.save_book(jsonb,integer,boolean),public.reorder_chapters(text[],integer),public.archive_chapter(text),public.get_public_book(),public.can_read_asset(text) from public,anon;
grant execute on function public.is_editor(),public.is_owner(),public.save_chapter(text,text,text,text,text,text,integer),public.save_chapters(jsonb),public.publish_chapter(text,text,integer,boolean),public.save_book(jsonb,integer,boolean),public.reorder_chapters(text[],integer),public.archive_chapter(text) to authenticated,service_role;
grant execute on function public.get_public_book(),public.can_read_asset(text) to anon,authenticated,service_role;
revoke execute on function public.seed_book(jsonb),public.protect_last_owner() from authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('book-assets','book-assets',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','application/pdf']),
 ('book-sources','book-sources',false,52428800,array['application/epub+zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/pdf','text/plain','text/html','application/zip','application/octet-stream'])
 on conflict(id) do nothing;
create policy book_storage_read on storage.objects for select to authenticated using(bucket_id in ('book-assets','book-sources') and public.is_editor());
create policy book_storage_insert on storage.objects for insert to authenticated with check(bucket_id in ('book-assets','book-sources') and public.is_editor());
create policy book_storage_delete on storage.objects for delete to authenticated using(bucket_id in ('book-assets','book-sources') and public.is_editor());
commit;
