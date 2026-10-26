begin;
create table public.project_upload_reservations (
  nonce text primary key check(nonce ~ '^[a-f0-9]{32}$'),
  wallet text not null check(wallet ~ '^0x[0-9a-f]{40}$'),
  bytes bigint not null check(bytes between 1 and 4194304),
  created_at timestamptz not null default clock_timestamp()
);
create index on public.project_upload_reservations(wallet,created_at);
create index on public.project_upload_reservations(created_at);
alter table public.project_upload_reservations enable row level security;
revoke all on public.project_upload_reservations from public,anon,authenticated;
grant all on public.project_upload_reservations to service_role;
create function public.reserve_project_upload(p_wallet text,p_nonce text,p_bytes bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare now_at timestamptz := clock_timestamp(); hour_count bigint; day_count bigint; global_count bigint; global_bytes bigint;
begin
  if p_wallet is null or p_wallet !~ '^0x[0-9a-f]{40}$' or p_nonce is null or p_nonce !~ '^[a-f0-9]{32}$'
    or p_bytes is null or p_bytes<1 or p_bytes>4194304 then raise exception 'INVALID_UPLOAD'; end if;
  -- One global lock serializes check+reserve across wallets and all Vercel instances.
  perform pg_advisory_xact_lock(hashtextextended('sqrtfund-project-upload-quota',0));
  now_at := clock_timestamp();
  delete from public.project_upload_reservations where created_at < now_at-interval '7 days';
  if exists(select 1 from public.project_upload_reservations where nonce=p_nonce) then return jsonb_build_object('status','REPLAY'); end if;
  select count(*) filter(where wallet=p_wallet and created_at>now_at-interval '1 hour'),
    count(*) filter(where wallet=p_wallet),count(*),coalesce(sum(bytes),0)
    into hour_count,day_count,global_count,global_bytes
    from public.project_upload_reservations where created_at>now_at-interval '24 hours';
  if hour_count>=5 or day_count>=20 or global_count>=100 or global_bytes+p_bytes>209715200 then
    return jsonb_build_object('status','RATE_LIMITED','retryAfter',3600);
  end if;
  insert into public.project_upload_reservations(nonce,wallet,bytes,created_at) values(p_nonce,p_wallet,p_bytes,now_at);
  return jsonb_build_object('status','OK');
end $$;
revoke all on function public.reserve_project_upload(text,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_project_upload(text,text,bigint) to service_role;
commit;
