-- Safe to apply after 001: adds explicit book predicates; preserves data, grants and RLS.
begin;

create or replace function public.save_book(p_meta jsonb,p_expected_revision integer,p_publish boolean default false)
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

create or replace function public.reorder_chapters(p_ids text[],p_expected_revision integer) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
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

create or replace function public.archive_chapter(p_id text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_editor() then raise exception 'Forbidden';end if;
  update public.chapters set archived=true where id=p_id;
  update public.book set revision=revision+1 where id='truyen-ky-man-luc';
end $$;

create or replace function public.seed_book(p_book jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
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

commit;
