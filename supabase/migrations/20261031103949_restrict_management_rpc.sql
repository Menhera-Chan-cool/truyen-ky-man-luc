-- Explicit role grants survive REVOKE FROM PUBLIC in hosted Supabase.
begin;
revoke execute on function public.is_editor(),
  public.is_owner(),
  public.protect_last_owner(),
  public.save_chapter(text,text,text,text,text,text,integer),
  public.save_chapters(jsonb),
  public.publish_chapter(text,text,integer,boolean),
  public.publish_chapters(jsonb),
  public.save_book(jsonb,integer,boolean),
  public.reorder_chapters(text[],integer),
  public.archive_chapter(text),
  public.seed_book(jsonb) from public,anon;
revoke execute on function public.seed_book(jsonb),public.protect_last_owner() from authenticated;
grant execute on function public.is_editor(),
  public.is_owner(),
  public.save_chapter(text,text,text,text,text,text,integer),
  public.save_chapters(jsonb),
  public.publish_chapter(text,text,integer,boolean),
  public.publish_chapters(jsonb),
  public.save_book(jsonb,integer,boolean),
  public.reorder_chapters(text[],integer),
  public.archive_chapter(text) to authenticated,service_role;
grant execute on function public.seed_book(jsonb) to service_role;
commit;
