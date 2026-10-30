-- Apply once after 005. Preserve current TT as VI; EN starts independently.
begin;
alter table public.comic_versions add column locale text not null default 'vi' check(locale in ('vi','en'));
alter table public.comic_editions add column locale text not null default 'vi' check(locale in ('vi','en'));
alter table public.comic_versions drop constraint comic_versions_chapter_id_revision_key;
alter table public.comic_versions add unique(chapter_id,locale,revision);
alter table public.comic_editions drop constraint comic_editions_pkey;
alter table public.comic_editions add primary key(chapter_id,locale);
create function public.save_comic(p_id text,p_title text,p_direction text,p_pages jsonb,p_expected_revision integer,p_locale text)
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_revision integer; version_id uuid; page jsonb; total_bytes bigint:=0; cleaned jsonb:='[]'; asset public.comic_assets;
begin
 if not public.is_editor() then raise exception 'Forbidden';end if;
 if p_locale is null or p_locale not in ('vi','en') then raise exception 'Invalid comic locale';end if;
 if p_expected_revision is null or p_expected_revision<0 or p_title is null or length(trim(p_title)) not between 1 and 300
   or p_direction is null or p_direction not in ('ltr','rtl') or jsonb_typeof(p_pages) is distinct from 'array'
   or jsonb_array_length(p_pages)>300 or octet_length(p_pages::text)>1048576 then raise exception 'Invalid comic draft';end if;
 perform 1 from public.chapters where id=p_id and not archived for share;
 if not found then raise exception 'Invalid chapter';end if;
 insert into public.comic_editions(chapter_id,locale) values(p_id,p_locale) on conflict do nothing;
 select revision into current_revision from public.comic_editions where chapter_id=p_id and locale=p_locale for update;
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
 insert into public.comic_versions(chapter_id,locale,title,direction,pages,revision,created_by)
  values(p_id,p_locale,trim(p_title),p_direction,cleaned,current_revision+1,auth.uid()) returning id into version_id;
 update public.comic_editions set draft_id=version_id,revision=current_revision+1 where chapter_id=p_id and locale=p_locale;
 insert into public.admin_audit(actor_id,actor_email,action,entity_type,entity_id,locale,revision)
  select auth.uid(),email,'save','comic',p_id,p_locale,current_revision+1 from public.members where user_id=auth.uid();
 return jsonb_build_object('revision',current_revision+1,'id',version_id);
end $$;

create function public.publish_comic(p_id text,p_expected_revision integer,p_withdraw boolean,p_locale text)
 returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare edition public.comic_editions;
begin
 if not public.is_editor() then raise exception 'Forbidden';end if;
 if p_locale is null or p_locale not in ('vi','en') then raise exception 'Invalid comic locale';end if;
 perform 1 from public.chapters where id=p_id and not archived for share;
 if not found then raise exception 'Invalid chapter';end if;
 select * into edition from public.comic_editions where chapter_id=p_id and locale=p_locale for update;
 if p_expected_revision is null or edition.revision is null or edition.revision<>p_expected_revision then raise exception 'Conflict: reload the latest comic draft';end if;
 if p_withdraw is null then raise exception 'Invalid publication';end if;
 if not p_withdraw and not exists(select 1 from public.comic_versions where id=edition.draft_id and chapter_id=p_id and locale=p_locale and jsonb_array_length(pages)>0) then raise exception 'Cannot publish an empty comic';end if;
 update public.comic_editions set published_id=case when p_withdraw then null else draft_id end,revision=revision+1 where chapter_id=p_id and locale=p_locale;
 insert into public.admin_audit(actor_id,actor_email,action,entity_type,entity_id,locale,revision)
  select auth.uid(),email,case when p_withdraw then 'withdraw' else 'publish' end,'comic',p_id,p_locale,edition.revision+1 from public.members where user_id=auth.uid();
 return edition.revision+1;
end $$;

create function public.get_public_comic(p_id text,p_locale text) returns jsonb
 language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',v.chapter_id,'title',v.title,'pages',v.pages,'direction',v.direction,'revision',v.revision,
  'updatedAt',floor(extract(epoch from v.created_at)*1000))
 from public.comic_versions v join public.comic_editions e on e.published_id=v.id join public.chapters c on c.id=e.chapter_id
 where c.id=p_id and v.locale=p_locale and not c.archived
$$;

create function public.get_public_comic_index(p_locale text) returns jsonb
 language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',v.title,'pages',jsonb_array_length(v.pages),'source','published',
  'updatedAt',floor(extract(epoch from v.created_at)*1000)) order by c.sort_order),'[]'::jsonb)
 from public.comic_versions v join public.comic_editions e on e.published_id=v.id join public.chapters c on c.id=e.chapter_id where not c.archived and v.locale=p_locale
$$;
-- Keep old deployed clients VI-only during rollout; never infer or fall back to EN.
create or replace function public.save_comic(p_id text,p_title text,p_direction text,p_pages jsonb,p_expected_revision integer) returns jsonb language sql security definer set search_path=public,pg_temp as $$select public.save_comic(p_id,p_title,p_direction,p_pages,p_expected_revision,'vi')$$;
create or replace function public.publish_comic(p_id text,p_expected_revision integer,p_withdraw boolean default false) returns integer language sql security definer set search_path=public,pg_temp as $$select public.publish_comic(p_id,p_expected_revision,p_withdraw,'vi')$$;
create or replace function public.get_public_comic(p_id text) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$select public.get_public_comic(p_id,'vi')$$;
create or replace function public.get_public_comic_index() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$select public.get_public_comic_index('vi')$$;
revoke all on function public.save_comic(text,text,text,jsonb,integer,text),public.publish_comic(text,integer,boolean,text),public.get_public_comic(text,text),public.get_public_comic_index(text) from public,anon,authenticated;
grant execute on function public.save_comic(text,text,text,jsonb,integer,text),public.publish_comic(text,integer,boolean,text) to authenticated;
grant execute on function public.get_public_comic(text,text),public.get_public_comic_index(text) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
