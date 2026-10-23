begin;
create or replace function public.get_public_book_index() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',b.id,'author',b.author,'meta',b.published,'revision',b.revision,'chapters',
    coalesce((select jsonb_agg(section order by position) from (
      select c.sort_order as position,jsonb_build_object('id',c.id,'order',c.sort_order)||jsonb_object_agg(e.locale,
        jsonb_strip_nulls(jsonb_build_object('title',v.title,'revision',v.revision,'kind',v.kind,'pdfPath',v.pdf_path))) as section
      from public.chapters c join public.chapter_editions e on e.chapter_id=c.id
      join public.chapter_versions v on v.id=e.published_id
      where not c.archived group by c.id,c.sort_order
    ) sections),'[]'::jsonb)) from public.book b where b.id='truyen-ky-man-luc'
$$;
revoke all on function public.get_public_book_index() from public;
grant execute on function public.get_public_book_index() to anon,authenticated,service_role;
notify pgrst, 'reload schema';
commit;
