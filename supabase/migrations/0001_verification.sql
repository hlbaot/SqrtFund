begin;
create table public.otp_requests (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null check (email_hash ~ '^0x[0-9a-f]{64}$'),
  email_domain text not null,
  address text not null check (address ~ '^0x[0-9a-f]{40}$'),
  registry_address text not null check (registry_address ~ '^0x[0-9a-f]{40}$'),
  ip_hash text not null,
  otp_hash text not null check (otp_hash ~ '^[0-9a-f]{64}$'),
  attempts int not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.otp_requests(email_hash, created_at);
create index on public.otp_requests(ip_hash, created_at);
create index on public.otp_requests(address, created_at);
create table public.verifications (
  address text not null,
  registry_address text not null,
  email_hash text not null,
  email_domain text not null,
  verified_at timestamptz not null default now(),
  unique(email_hash),
  unique(address)
);
alter table public.otp_requests enable row level security;
alter table public.verifications enable row level security;
revoke all on public.otp_requests, public.verifications from public, anon, authenticated;
grant all on public.otp_requests, public.verifications to service_role;

create function public.consume_otp(p_id uuid, p_otp_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.otp_requests%rowtype;
begin
  select * into r from public.otp_requests where id = p_id for update;
  if not found then return jsonb_build_object('status', 'EXPIRED'); end if;
  if r.attempts >= 5 then return jsonb_build_object('status', 'LOCKED'); end if;
  if r.used_at is not null or r.expires_at <= clock_timestamp() then
    return jsonb_build_object('status', 'EXPIRED');
  end if;
  if r.otp_hash <> p_otp_hash then
    update public.otp_requests set attempts = attempts + 1 where id = p_id;
    return jsonb_build_object('status', 'WRONG', 'attemptsLeft', 4 - r.attempts);
  end if;
  update public.otp_requests set used_at = clock_timestamp() where id = p_id;
  return jsonb_build_object('status', 'OK');
end $$;

-- Serialize all overlapping rate-limit identities, in a fixed order. Counts and
-- insertion share one transaction so concurrent Vercel instances cannot bypass limits.
create function public.reserve_otp(
 p_id uuid, p_email_hash text, p_email_domain text, p_address text,
 p_registry_address text, p_ip_hash text, p_otp_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare rule record; n int; oldest timestamptz; retry int := 0; t timestamptz := clock_timestamp(); k bigint;
begin
 for k in select distinct x from unnest(array[
  pg_catalog.hashtextextended('email:' || p_email_hash, 0),
  pg_catalog.hashtextextended('ip:' || p_ip_hash, 0),
  pg_catalog.hashtextextended('wallet:' || p_address, 0)
 ]) x order by x loop perform pg_catalog.pg_advisory_xact_lock(k); end loop;
 if exists (select 1 from public.verifications where email_hash = p_email_hash and address <> p_address) then
   return jsonb_build_object('status', 'EMAIL_ALREADY_USED');
 end if;
 if exists (select 1 from public.verifications where address = p_address and email_hash <> p_email_hash) then
   return jsonb_build_object('status', 'WALLET_ALREADY_VERIFIED');
 end if;
 if exists (select 1 from public.verifications where address = p_address and email_hash = p_email_hash) then
   return jsonb_build_object('status', 'ALREADY_VERIFIED');
 end if;
 for rule in select * from (values
  ('pair', 60, 1), ('email', 600, 3), ('ip', 600, 10), ('wallet', 3600, 5)
 ) v(kind, seconds, maximum) loop
  select count(*), min(created_at) into n, oldest from public.otp_requests
  where created_at > t - make_interval(secs => rule.seconds)
    and case rule.kind
      when 'pair' then email_hash = p_email_hash and address = p_address
      when 'email' then email_hash = p_email_hash
      when 'ip' then ip_hash = p_ip_hash
      else address = p_address end;
  if n >= rule.maximum then
    retry := greatest(retry, ceil(extract(epoch from oldest + make_interval(secs => rule.seconds) - t))::int);
  end if;
 end loop;
 if retry > 0 then return jsonb_build_object('status', 'RATE_LIMITED', 'retryAfter', retry); end if;
 update public.otp_requests set used_at = t
  where email_hash = p_email_hash and address = p_address and used_at is null;
 insert into public.otp_requests(id, email_hash, email_domain, address, registry_address, ip_hash, otp_hash, created_at, expires_at)
 values(p_id, p_email_hash, p_email_domain, p_address, p_registry_address, p_ip_hash, p_otp_hash, t, t + interval '10 minutes');
 return jsonb_build_object('status', 'OK', 'expiresAt', t + interval '10 minutes');
end $$;
create function public.verification_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('totalVerified', (select count(distinct address) from public.verifications),
 'byDomain', coalesce((select jsonb_object_agg(email_domain, n) from
 (select email_domain, count(distinct address) n from public.verifications group by email_domain) d), '{}'::jsonb));
$$;
revoke all on function public.consume_otp(uuid,text) from public, anon, authenticated;
revoke all on function public.reserve_otp(uuid,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.verification_stats() from public, anon, authenticated;
grant execute on function public.consume_otp(uuid,text), public.reserve_otp(uuid,text,text,text,text,text,text), public.verification_stats() to service_role;
commit;
