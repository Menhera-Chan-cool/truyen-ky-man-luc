begin;
create table public.novel_alignment_jobs (
 id uuid primary key default gen_random_uuid(), chapter_id text not null references public.chapters(id),
 vi_version uuid not null references public.chapter_versions(id), en_version uuid not null references public.chapter_versions(id),
 codec text not null default 'reader-dom-1', algorithm text not null default 'e5-mbert-uts95-1',
 state text not null default 'pending' check(state in ('pending','running','ready','failed','obsolete')),
 attempts integer not null default 0 check(attempts>=0), lease_id uuid, lease_until timestamptz,
 next_attempt_at timestamptz not null default clock_timestamp(), last_error text check(length(last_error)<=500),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(chapter_id,vi_version,en_version,codec,algorithm)
);
create index novel_alignment_queue on public.novel_alignment_jobs(state,next_attempt_at,created_at);
create table public.novel_alignment_runs (
 job_id uuid primary key references public.novel_alignment_jobs(id), path text not null,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'), bytes integer not null check(bytes between 1 and 16777216),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.novel_alignment_jobs enable row level security;
alter table public.novel_alignment_runs enable row level security;
revoke all on public.novel_alignment_jobs,public.novel_alignment_runs from public,anon,authenticated;
grant select on public.novel_alignment_jobs,public.novel_alignment_runs to authenticated;
grant all on public.novel_alignment_jobs,public.novel_alignment_runs to service_role;
create policy editor_alignment_jobs on public.novel_alignment_jobs for select to authenticated using(public.is_editor());
create policy editor_alignment_runs on public.novel_alignment_runs for select to authenticated using(public.is_editor());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('novel-alignments','novel-alignments',false,16777216,array['application/json']) on conflict(id) do nothing;

create function public.queue_novel_alignment(p_chapter text,p_force boolean default false) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare vi uuid; en uuid; result uuid;
begin
 perform 1 from public.book where id='truyen-ky-man-luc' for update;
 perform 1 from public.chapters where id=p_chapter and not archived for update;
 if not found then return null;end if;
 select v.id,t.id into vi,en from public.chapter_editions e
 join public.chapter_versions v on v.id=e.published_id and v.kind='text'
 join public.chapter_editions f on f.chapter_id=e.chapter_id and f.locale='en'
 join public.chapter_versions t on t.id=f.published_id and t.kind='text'
 where e.chapter_id=p_chapter and e.locale='vi';
 update public.novel_alignment_jobs set state='obsolete',updated_at=clock_timestamp()
 where chapter_id=p_chapter and state in ('pending','running','failed') and
 (vi is null or en is null or vi_version<>vi or en_version<>en);
 if vi is null or en is null then return null;end if;
 insert into public.novel_alignment_jobs(chapter_id,vi_version,en_version) values(p_chapter,vi,en)
 on conflict(chapter_id,vi_version,en_version,codec,algorithm) do nothing returning id into result;
 if result is null then
  select id into result from public.novel_alignment_jobs where chapter_id=p_chapter and vi_version=vi and en_version=en and codec='reader-dom-1' and algorithm='e5-mbert-uts95-1';
  if p_force or exists(select 1 from public.novel_alignment_jobs where id=result and state='obsolete') then update public.novel_alignment_jobs set state='pending',attempts=0,lease_id=null,lease_until=null,last_error=null,next_attempt_at=clock_timestamp(),updated_at=clock_timestamp()
   where id=result and not(state='running' and lease_until>clock_timestamp());end if;
 end if;
 return result;
end $$;

create function public.on_novel_publication() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' or new.published_id is distinct from old.published_id then perform public.queue_novel_alignment(new.chapter_id,false);end if;
 return new;
end $$;
create trigger enqueue_novel_alignment after insert or update on public.chapter_editions for each row execute function public.on_novel_publication();

create function public.request_novel_alignment(p_chapter text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_editor() then raise exception 'Forbidden';end if;
 return public.queue_novel_alignment(p_chapter,true);
end $$;

create function public.claim_novel_alignment_job() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.novel_alignment_jobs; result jsonb;
begin
 update public.novel_alignment_jobs j set state='obsolete',updated_at=clock_timestamp()
 where j.state in ('pending','running','failed') and not exists(
  select 1 from public.chapters c join public.chapter_editions v on v.chapter_id=c.id and v.locale='vi'
  join public.chapter_editions e on e.chapter_id=c.id and e.locale='en'
  where c.id=j.chapter_id and not c.archived and v.published_id=j.vi_version and e.published_id=j.en_version
 );
 update public.novel_alignment_jobs set state='failed',lease_id=null,lease_until=null,last_error='Worker lease expired after retry limit',updated_at=clock_timestamp()
 where state='running' and attempts>=3 and lease_until<=clock_timestamp();
 select * into job from public.novel_alignment_jobs j
 where j.attempts<3 and j.algorithm='e5-mbert-uts95-1' and j.codec='reader-dom-1'
 and ((j.state in ('pending','failed') and j.next_attempt_at<=clock_timestamp()) or (j.state='running' and j.lease_until<=clock_timestamp()))
 order by j.created_at,j.id for update skip locked limit 1;
 if not found then return null;end if;
 update public.novel_alignment_jobs set state='running',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '15 minutes',updated_at=clock_timestamp()
 where id=job.id returning * into job;
 select jsonb_build_object('id',job.id,'lease_id',job.lease_id,'chapterId',job.chapter_id,'codec',job.codec,'algorithm',job.algorithm,
 'editions',jsonb_build_object('vi',jsonb_build_object('versionId',v.id,'revision',v.revision,'html',v.html),
 'en',jsonb_build_object('versionId',e.id,'revision',e.revision,'html',e.html))) into result
 from public.chapter_versions v,public.chapter_versions e where v.id=job.vi_version and e.id=job.en_version;
 return result;
end $$;

create function public.finish_novel_alignment_job(p_job uuid,p_lease uuid,p_path text,p_hash text,p_bytes integer,p_error text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.novel_alignment_jobs;
begin
 select * into job from public.novel_alignment_jobs where id=p_job for update;
 if not found then raise exception 'Unknown alignment lease';end if;
 if job.state='obsolete' then return jsonb_build_object('state','obsolete');end if;
 if job.state<>'running' or job.lease_id is distinct from p_lease or job.lease_until<=clock_timestamp() then raise exception 'Stale alignment lease';end if;
 if not exists(select 1 from public.chapters c join public.chapter_editions v on v.chapter_id=c.id and v.locale='vi'
  join public.chapter_editions e on e.chapter_id=c.id and e.locale='en'
  where c.id=job.chapter_id and not c.archived and v.published_id=job.vi_version and e.published_id=job.en_version) then
  update public.novel_alignment_jobs set state='obsolete',updated_at=clock_timestamp() where id=p_job;
  return jsonb_build_object('state','obsolete');
 end if;
 if p_error is not null then
  update public.novel_alignment_jobs set state='failed',last_error=left(p_error,500),lease_id=null,lease_until=null,next_attempt_at=clock_timestamp()+interval '30 minutes',updated_at=clock_timestamp() where id=p_job;
  return jsonb_build_object('state','failed');
 end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_path is distinct from p_job::text||'/'||p_hash||'.json' or p_bytes is null or p_bytes not between 1 and 16777216 then raise exception 'Invalid alignment artifact';end if;
 if not exists(select 1 from storage.objects where bucket_id='novel-alignments' and name=p_path) then raise exception 'Alignment upload missing';end if;
 insert into public.novel_alignment_runs(job_id,path,sha256,bytes) values(p_job,p_path,p_hash,p_bytes)
 on conflict(job_id) do update set path=excluded.path,sha256=excluded.sha256,bytes=excluded.bytes,created_at=clock_timestamp();
 update public.novel_alignment_jobs set state='ready',last_error=null,lease_id=null,lease_until=null,updated_at=clock_timestamp() where id=p_job;
 return jsonb_build_object('state','ready');
end $$;

create function public.get_public_novel_alignment(p_chapter text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('chapterId',c.id,
 'vi',case when v.id is null then null else jsonb_build_object('versionId',v.id,'revision',v.revision,'kind',v.kind) end,
 'en',case when e.id is null then null else jsonb_build_object('versionId',e.id,'revision',e.revision,'kind',e.kind) end,
 'run',case when r.job_id is null then null else jsonb_build_object('path',r.path,'sha256',r.sha256,'bytes',r.bytes,'codec',j.codec,'algorithm',j.algorithm,'createdAt',r.created_at) end)
 from public.chapters c
 left join public.chapter_editions a on a.chapter_id=c.id and a.locale='vi'
 left join public.chapter_versions v on v.id=a.published_id
 left join public.chapter_editions b on b.chapter_id=c.id and b.locale='en'
 left join public.chapter_versions e on e.id=b.published_id
 left join public.novel_alignment_jobs j on j.chapter_id=c.id and j.vi_version=v.id and j.en_version=e.id and j.codec='reader-dom-1' and j.algorithm='e5-mbert-uts95-1'
 left join public.novel_alignment_runs r on r.job_id=j.id
 where c.id=p_chapter and not c.archived and (v.id is not null or e.id is not null)
$$;

revoke all on function public.queue_novel_alignment(text,boolean),public.on_novel_publication(),public.request_novel_alignment(text),public.claim_novel_alignment_job(),public.finish_novel_alignment_job(uuid,uuid,text,text,integer,text),public.get_public_novel_alignment(text) from public,anon,authenticated;
grant execute on function public.queue_novel_alignment(text,boolean),public.claim_novel_alignment_job(),public.finish_novel_alignment_job(uuid,uuid,text,text,integer,text) to service_role;
grant execute on function public.request_novel_alignment(text) to authenticated;
grant execute on function public.get_public_novel_alignment(text) to anon,authenticated,service_role;
select public.queue_novel_alignment(id,false) from public.chapters where not archived;
notify pgrst,'reload schema';
commit;
