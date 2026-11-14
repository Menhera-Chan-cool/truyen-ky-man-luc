begin;

-- Switch recipes under the publication lock; retain existing serving runs.
select 1 from public.book where id='truyen-ky-man-luc' for update;
alter table public.novel_alignment_jobs alter column algorithm set default 'labse-poetry-mbert-3';
update public.novel_alignment_jobs set state='obsolete',lease_id=null,lease_until=null,updated_at=clock_timestamp()
where algorithm<>'labse-poetry-mbert-3' and state in ('pending','running');

create or replace function public.queue_novel_alignment(p_chapter text,p_force boolean default false) returns uuid
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
 update public.novel_alignment_jobs set state='obsolete',lease_id=null,lease_until=null,updated_at=clock_timestamp()
 where chapter_id=p_chapter and state in ('pending','running','failed') and
 (vi is null or en is null or vi_version<>vi or en_version<>en or (algorithm<>'labse-poetry-mbert-3' and state in ('pending','running')));
 if vi is null or en is null then return null;end if;
 insert into public.novel_alignment_jobs(chapter_id,vi_version,en_version,codec,algorithm)
 values(p_chapter,vi,en,'reader-dom-1','labse-poetry-mbert-3')
 on conflict(chapter_id,vi_version,en_version,codec,algorithm) do nothing returning id into result;
 if result is null then
  select id into result from public.novel_alignment_jobs where chapter_id=p_chapter and vi_version=vi and en_version=en and codec='reader-dom-1' and algorithm='labse-poetry-mbert-3';
  if p_force or exists(select 1 from public.novel_alignment_jobs where id=result and state='obsolete') then
   update public.novel_alignment_jobs set state='pending',attempts=0,lease_id=null,lease_until=null,last_error=null,next_attempt_at=clock_timestamp(),updated_at=clock_timestamp()
   where id=result and (state<>'running' or lease_until is null or lease_until<=clock_timestamp());
  end if;
 end if;
 return result;
end $$;

create or replace function public.claim_novel_alignment_job() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.novel_alignment_jobs; result jsonb;
begin
 perform 1 from public.book where id='truyen-ky-man-luc' for update;
 update public.novel_alignment_jobs j set state='obsolete',lease_id=null,lease_until=null,updated_at=clock_timestamp()
 where j.state in ('pending','running','failed') and
 ((j.algorithm<>'labse-poetry-mbert-3' and j.state in ('pending','running')) or not exists(
  select 1 from public.chapters c join public.chapter_editions v on v.chapter_id=c.id and v.locale='vi'
  join public.chapter_editions e on e.chapter_id=c.id and e.locale='en'
  where c.id=j.chapter_id and not c.archived and v.published_id=j.vi_version and e.published_id=j.en_version
 ));
 update public.novel_alignment_jobs set state='failed',lease_id=null,lease_until=null,last_error='Worker lease expired after retry limit',updated_at=clock_timestamp()
 where algorithm='labse-poetry-mbert-3' and codec='reader-dom-1' and state='running' and attempts>=3 and lease_until<=clock_timestamp();
 select * into job from public.novel_alignment_jobs j
 where j.attempts<3 and j.algorithm='labse-poetry-mbert-3' and j.codec='reader-dom-1'
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

create or replace function public.get_public_novel_alignment(p_chapter text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('chapterId',c.id,
 'vi',case when v.id is null then null else jsonb_build_object('versionId',v.id,'revision',v.revision,'kind',v.kind) end,
 'en',case when e.id is null then null else jsonb_build_object('versionId',e.id,'revision',e.revision,'kind',e.kind) end,
 'run',case when r.path is null then null else jsonb_build_object('path',r.path,'sha256',r.sha256,'bytes',r.bytes,'codec',r.codec,'algorithm',r.algorithm,'createdAt',r.created_at) end)
 from public.chapters c
 left join public.chapter_editions a on a.chapter_id=c.id and a.locale='vi'
 left join public.chapter_versions v on v.id=a.published_id
 left join public.chapter_editions b on b.chapter_id=c.id and b.locale='en'
 left join public.chapter_versions e on e.id=b.published_id
 left join lateral (
  select runs.path,runs.sha256,runs.bytes,runs.created_at,j.codec,j.algorithm
  from public.novel_alignment_jobs j join public.novel_alignment_runs runs on runs.job_id=j.id
  where j.chapter_id=c.id and j.vi_version=v.id and j.en_version=e.id and v.kind='text' and e.kind='text'
   and j.codec='reader-dom-1' and j.algorithm in ('labse-poetry-mbert-3','labse-book-mbert-2','labse-context-mbert-1','e5-mbert-uts95-1')
  order by case j.algorithm when 'labse-poetry-mbert-3' then 4 when 'labse-book-mbert-2' then 3 when 'labse-context-mbert-1' then 2 else 1 end desc,runs.created_at desc,j.id limit 1
 ) r on true
 where c.id=p_chapter and not c.archived and (v.id is not null or e.id is not null)
$$;

revoke all on function public.queue_novel_alignment(text,boolean),public.claim_novel_alignment_job(),public.get_public_novel_alignment(text) from public,anon,authenticated;
grant execute on function public.queue_novel_alignment(text,boolean),public.claim_novel_alignment_job() to service_role;
grant execute on function public.get_public_novel_alignment(text) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
