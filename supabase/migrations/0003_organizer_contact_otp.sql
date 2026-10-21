begin;

-- Đơn cũ để null, không gắn nhãn đã xác thực cho email chưa từng qua OTP.
alter table public.organizer_applications add column email_verified_at timestamptz;

-- OTP liên hệ tách riêng hoàn toàn khỏi xác minh sinh viên và chữ ký on-chain.
create table public.organizer_contact_otps (
  id uuid primary key,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  email_hash text not null,
  ip_hash text not null,
  otp_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  attempts integer not null default 0,
  used boolean not null default false
);
create index on public.organizer_contact_otps(email_hash, created_at);
create index on public.organizer_contact_otps(wallet_address, created_at);
create index on public.organizer_contact_otps(ip_hash, created_at);
alter table public.organizer_contact_otps enable row level security;
revoke all on public.organizer_contact_otps from public, anon, authenticated;
grant all on public.organizer_contact_otps to service_role;

create function public.reserve_organizer_contact_otp(p_id uuid, p_wallet text, p_email_hash text, p_ip_hash text, p_otp_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare last_request timestamptz;
begin
  -- Giữ kiểm tra hạn mức và ghi OTP trong cùng transaction để chặn gửi đồng thời.
  perform pg_advisory_xact_lock(hashtextextended('organizer-contact-otp', 0));
  delete from organizer_contact_otps where created_at < now() - interval '1 day';
  select max(created_at) into last_request from organizer_contact_otps
    where email_hash = p_email_hash or wallet_address = p_wallet;
  if last_request > now() - interval '60 seconds' then
    return jsonb_build_object('status', 'RATE_LIMITED', 'retryAfter', ceil(60 - extract(epoch from now() - last_request))::integer);
  end if;
  if (select count(*) from organizer_contact_otps where created_at > now() - interval '1 hour' and email_hash = p_email_hash) >= 5
    or (select count(*) from organizer_contact_otps where created_at > now() - interval '1 hour' and wallet_address = p_wallet) >= 5
    or (select count(*) from organizer_contact_otps where created_at > now() - interval '1 hour' and ip_hash = p_ip_hash) >= 20 then
    return jsonb_build_object('status', 'RATE_LIMITED', 'retryAfter', 3600);
  end if;
  -- Gửi lại sẽ vô hiệu mã cũ của cùng ví/email.
  update organizer_contact_otps set used = true where wallet_address = p_wallet and email_hash = p_email_hash;
  insert into organizer_contact_otps(id, wallet_address, email_hash, ip_hash, otp_hash)
    values (p_id, p_wallet, p_email_hash, p_ip_hash, p_otp_hash);
  return jsonb_build_object('status', 'OK', 'expiresAt', now() + interval '10 minutes');
end; $$;

create function public.consume_organizer_contact_otp(p_id uuid, p_wallet text, p_email_hash text, p_otp_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare challenge organizer_contact_otps%rowtype;
begin
  -- Khóa hàng để một mã không thể xác thực thành công hai lần đồng thời.
  select * into challenge from organizer_contact_otps where id = p_id for update;
  if not found or challenge.used or challenge.expires_at <= now() then
    return jsonb_build_object('status', 'EXPIRED');
  end if;
  if challenge.attempts >= 5 then return jsonb_build_object('status', 'LOCKED'); end if;
  update organizer_contact_otps set attempts = attempts + 1 where id = p_id;
  if challenge.wallet_address <> p_wallet or challenge.email_hash <> p_email_hash or challenge.otp_hash <> p_otp_hash then
    return jsonb_build_object('status', case when challenge.attempts + 1 >= 5 then 'LOCKED' else 'WRONG' end, 'attemptsLeft', greatest(0, 4 - challenge.attempts));
  end if;
  update organizer_contact_otps set used = true where id = p_id;
  return jsonb_build_object('status', 'OK');
end; $$;
revoke all on function public.reserve_organizer_contact_otp(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.consume_organizer_contact_otp(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.reserve_organizer_contact_otp(uuid,text,text,text,text) to service_role;
grant execute on function public.consume_organizer_contact_otp(uuid,text,text,text) to service_role;

commit;
