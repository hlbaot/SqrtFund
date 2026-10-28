begin;
create table if not exists public.project_profiles (
  chain_id integer not null default 43113 check(chain_id=43113),
  round_address text not null check(round_address ~ '^0x[0-9a-f]{40}$'),
  project_id bigint not null check(project_id>0),
  owner_address text not null check(owner_address ~ '^0x[0-9a-f]{40}$'),
  profile jsonb not null check(jsonb_typeof(profile)='object' and octet_length(profile::text)<=32000),
  reports jsonb not null default '[]' check(jsonb_typeof(reports)='array' and jsonb_array_length(reports)<=12),
  revision integer not null check(revision>0), updated_at timestamptz not null default clock_timestamp(),
  primary key(chain_id,round_address,project_id)
);
alter table public.project_profiles enable row level security;
revoke all on public.project_profiles from public,anon,authenticated;
grant select,insert,update on public.project_profiles to service_role;
create or replace function public.save_project_profile(p_round text,p_project bigint,p_owner text,p_revision integer,p_profile jsonb,p_report jsonb default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare saved public.project_profiles; report_item jsonb;
begin
  if p_revision is null or p_revision<0 or p_revision>=2147483647 then raise exception 'Invalid revision'; end if;
  if p_report is not null then
    if jsonb_typeof(p_report)<>'object' or length(coalesce(p_report->>'text','')) not between 1 and 3000 or length(coalesce(p_report->>'evidenceUrl',''))>500 then raise exception 'Invalid report'; end if;
    report_item=jsonb_build_array(jsonb_build_object('text',p_report->>'text','evidenceUrl',coalesce(p_report->>'evidenceUrl',''),'publishedAt',clock_timestamp()));
  else report_item='[]'::jsonb; end if;
  if p_revision=0 then
    insert into public.project_profiles(chain_id,round_address,project_id,owner_address,profile,reports,revision)
      values(43113,p_round,p_project,p_owner,p_profile,report_item,1)
      on conflict do nothing returning * into saved;
  else
    update public.project_profiles set profile=p_profile,reports=reports||report_item,revision=revision+1,updated_at=clock_timestamp()
      where chain_id=43113 and round_address=p_round and project_id=p_project and owner_address=p_owner and revision=p_revision returning * into saved;
  end if;
  if saved.revision is null then return jsonb_build_object('status','CONFLICT'); end if;
  return jsonb_build_object('status','OK','document',jsonb_build_object('profile',saved.profile,'reports',saved.reports,'revision',saved.revision,'updated_at',saved.updated_at));
end $$;
revoke all on function public.save_project_profile(text,bigint,text,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_project_profile(text,bigint,text,integer,jsonb,jsonb) to service_role;
commit;
