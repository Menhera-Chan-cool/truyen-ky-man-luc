-- Apply after 003. Adds private collaboration records; does not rewrite book content.
begin;
create table if not exists public.admin_audit (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default clock_timestamp(),
 actor_id uuid references auth.users(id), actor_email text not null, action text not null,
 entity_type text not null, entity_id text not null, locale text, revision integer
);
create index if not exists admin_audit_recent on public.admin_audit(created_at desc,id desc);
create table if not exists public.editor_presence (
 user_id uuid primary key references public.members(user_id), lease_id uuid not null,
 email text not null, chapter_id text not null references public.chapters(id),
 locale text not null check(locale in ('vi','en')), seen_at timestamptz not null default clock_timestamp()
);
alter table public.admin_audit enable row level security;
alter table public.editor_presence enable row level security;
revoke all on public.admin_audit,public.editor_presence from public,anon,authenticated;
grant select on public.admin_audit,public.editor_presence to authenticated;
grant all on public.admin_audit,public.editor_presence to service_role;
drop policy if exists editor_audit_read on public.admin_audit;
create policy editor_audit_read on public.admin_audit for select to authenticated using(public.is_editor());
drop policy if exists editor_presence_read on public.editor_presence;
create policy editor_presence_read on public.editor_presence for select to authenticated using(public.is_editor());

create or replace function public.record_admin_action() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb:=to_jsonb(new); previous jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 action_name text; entity text; lang text; rev integer; actor uuid:=auth.uid(); actor_mail text;
begin
 if tg_table_name='chapter_versions' then
  action_name:=coalesce(nullif(current_setting('book.audit_reason',true),''),'save_draft');
  entity:=item->>'chapter_id';lang:=item->>'locale';rev:=(item->>'revision')::integer;
 elsif tg_table_name='chapter_editions' then
  if (item->>'published_id') is not distinct from (previous->>'published_id') then return new;end if;
  action_name:=case when item->>'published_id' is null then 'withdraw' else 'publish' end;
  entity:=item->>'chapter_id';lang:=item->>'locale';rev:=(item->>'revision')::integer;
 elsif tg_table_name='chapters' then
  if (item->>'archived') is distinct from (previous->>'archived') then
   action_name:=case when (item->>'archived')::boolean then 'archive' else 'restore_chapter' end;
  elsif (item->>'sort_order') is distinct from (previous->>'sort_order') then action_name:='reorder';
  else return new;end if;entity:=item->>'id';
 elsif tg_table_name='book' then
  if (item->'published') is distinct from (previous->'published') then action_name:='publish_book';
  elsif (item->'draft') is distinct from (previous->'draft') then action_name:='save_book';
  else return new;end if;entity:=item->>'id';rev:=(item->>'revision')::integer;
 elsif tg_table_name='assets' then action_name:='upload';entity:=item->>'path';
 elsif tg_table_name='members' then
  if tg_op='UPDATE' and (item->>'active')=(previous->>'active') and (item->>'role')=(previous->>'role') and (item->>'email')=(previous->>'email') then return new;end if;
  action_name:='member_changed';entity:=item->>'user_id';
  if not (item->>'active')::boolean then delete from public.editor_presence where user_id=(item->>'user_id')::uuid;end if;
 else return new;end if;
 select email into actor_mail from public.members where user_id=actor;
 insert into public.admin_audit(actor_id,actor_email,action,entity_type,entity_id,locale,revision)
 values(actor,coalesce(actor_mail,'system'),action_name,tg_table_name,entity,lang,rev);
 return new;
end $$;
revoke all on function public.record_admin_action() from public,anon,authenticated;
drop trigger if exists audit_version on public.chapter_versions;
create trigger audit_version after insert on public.chapter_versions for each row execute function public.record_admin_action();
drop trigger if exists audit_publication on public.chapter_editions;
create trigger audit_publication after insert or update on public.chapter_editions for each row execute function public.record_admin_action();
drop trigger if exists audit_chapter on public.chapters;
create trigger audit_chapter after update on public.chapters for each row execute function public.record_admin_action();
drop trigger if exists audit_book on public.book;
create trigger audit_book after update on public.book for each row execute function public.record_admin_action();
drop trigger if exists audit_asset on public.assets;
create trigger audit_asset after insert on public.assets for each row execute function public.record_admin_action();
drop trigger if exists audit_member on public.members;
create trigger audit_member after insert or update on public.members for each row execute function public.record_admin_action();

create or replace function public.save_chapters_with_reason(p_items jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; item jsonb; prior text:=coalesce(current_setting('book.audit_reason',true),'');
begin
 if not public.is_editor() then raise exception 'Forbidden';end if;
 if p_reason is null or p_reason not in ('import','replace') then raise exception 'Invalid audit reason';end if;
 if p_reason='replace' then
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid replacement selection';end if;
  perform pg_advisory_xact_lock(832772);
  for item in select * from jsonb_array_elements(p_items) loop
   perform 1 from public.chapters where id=item->>'id' and not archived for update;
   if not found then raise exception 'Conflict: chapter was removed';end if;
  end loop;
 end if;
 perform set_config('book.audit_reason',p_reason,true);
 result:=public.save_chapters(p_items);
 perform set_config('book.audit_reason',prior,true);
 return result;
end $$;
revoke all on function public.save_chapters_with_reason(jsonb,text) from public,anon;
grant execute on function public.save_chapters_with_reason(jsonb,text) to authenticated,service_role;

create or replace function public.editor_heartbeat(p_lease uuid,p_chapter text,p_locale text,p_leave boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); actor_mail text;
begin
 select email into actor_mail from public.members where user_id=actor and active for share;
 if not found then raise exception 'Forbidden';end if;
 if p_lease is null then raise exception 'Invalid editing session';end if;
 if p_leave then delete from public.editor_presence where user_id=actor and lease_id=p_lease;return;end if;
 if p_locale is null or p_locale not in ('vi','en') or not exists(select 1 from public.chapters where id=p_chapter and not archived) then raise exception 'Invalid editing chapter';end if;
 delete from public.editor_presence where seen_at<clock_timestamp()-interval '5 minutes';
 insert into public.editor_presence(user_id,lease_id,email,chapter_id,locale,seen_at)
 values(actor,p_lease,actor_mail,p_chapter,p_locale,clock_timestamp())
 on conflict(user_id) do update set lease_id=excluded.lease_id,email=excluded.email,chapter_id=excluded.chapter_id,locale=excluded.locale,seen_at=excluded.seen_at;
end $$;
revoke all on function public.editor_heartbeat(uuid,text,text,boolean) from public,anon;
grant execute on function public.editor_heartbeat(uuid,text,text,boolean) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
