begin;
create table public.heading_fonts (
 id uuid primary key, label text not null check(length(label) between 1 and 120),
 path text unique not null check(path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(ttf|otf|woff|woff2)$'),
 format text not null check(format in ('ttf','otf','woff','woff2')),
 bytes integer not null check(bytes between 4 and 3145728), hash text not null check(hash ~ '^[a-f0-9]{64}$'),
 created_by uuid references auth.users(id), archived boolean not null default false, created_at timestamptz not null default now()
);
alter table public.heading_fonts enable row level security;
revoke all on public.heading_fonts from public,anon,authenticated;
grant select on public.heading_fonts to authenticated;
grant all on public.heading_fonts to service_role;
create policy heading_fonts_editor_read on public.heading_fonts for select to authenticated using ((select public.is_editor()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('heading-fonts','heading-fonts',false,3145728,array['font/ttf','font/otf','font/woff','font/woff2']);
create policy heading_fonts_upload on storage.objects for insert to authenticated with check (
 bucket_id='heading-fonts' and (select public.is_editor()) and name ~ ('^'||(select auth.uid())::text||'/[a-f0-9-]{36}\.(ttf|otf|woff|woff2)$')
);
create policy heading_fonts_storage_read on storage.objects for select to authenticated using (bucket_id='heading-fonts' and (select public.is_editor()));

create function public.can_read_heading_font(p_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.heading_fonts f cross join public.book b where f.id=p_id and b.id='truyen-ky-man-luc' and
 (b.published->'vi'->>'headingFont'=f.id::text or b.published->'en'->>'headingFont'=f.id::text))
$$;
revoke all on function public.can_read_heading_font(uuid) from public,anon,authenticated;
grant execute on function public.can_read_heading_font(uuid) to anon,authenticated,service_role;

create function public.validate_book_heading_fonts() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare lang text; meta jsonb; chosen text;
begin
 foreach lang in array array['vi','en'] loop
  foreach meta in array array[new.draft,new.published] loop
   chosen=meta->lang->>'headingFont';
   if chosen is null or chosen='default' then continue;end if;
   if chosen !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'Invalid heading font';end if;
   if not exists(select 1 from public.heading_fonts where id=chosen::uuid and not archived) then raise exception 'Invalid or removed heading font';end if;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function public.validate_book_heading_fonts() from public,anon,authenticated;
create trigger book_heading_font_guard before insert or update of draft,published on public.book for each row execute function public.validate_book_heading_fonts();

create function public.archive_heading_font(p_id uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_editor() then raise exception 'Forbidden';end if;
 perform 1 from public.book where id='truyen-ky-man-luc' for update;
 if exists(select 1 from public.book where id='truyen-ky-man-luc' and
  (draft->'vi'->>'headingFont'=p_id::text or draft->'en'->>'headingFont'=p_id::text or published->'vi'->>'headingFont'=p_id::text or published->'en'->>'headingFont'=p_id::text)) then
  raise exception 'Font is in use. Choose another font and save/publish first';
 end if;
 update public.heading_fonts set archived=true where id=p_id and not archived;
 return found;
end $$;
revoke all on function public.archive_heading_font(uuid) from public,anon,authenticated;
grant execute on function public.archive_heading_font(uuid) to authenticated,service_role;
create function public.record_heading_font_action() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare actor uuid:=coalesce(auth.uid(),new.created_by);
begin
 if tg_op='UPDATE' and old.archived=new.archived then return new;end if;
 insert into public.admin_audit(actor_id,actor_email,action,entity_type,entity_id)
 select actor,coalesce(m.email,'system'),case when tg_op='INSERT' then 'add_heading_font' else 'remove_heading_font' end,'heading_fonts',new.id::text
 from (select 1) s left join public.members m on m.user_id=actor;
 return new;
end $$;
revoke all on function public.record_heading_font_action() from public,anon,authenticated;
create trigger audit_heading_font after insert or update of archived on public.heading_fonts for each row execute function public.record_heading_font_action();
notify pgrst,'reload schema';
commit;
