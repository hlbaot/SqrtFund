begin;
-- OTP có hiệu lực 5 phút. Thời gian chờ gửi lại vẫn là 60 giây.
-- API cũng ghi expires_at qua setOtpExpiry(); default này bảo đảm DB có cùng chính sách.
alter table public.otp_requests alter column expires_at set default (now() + interval '5 minutes');
alter table public.organizer_contact_otps alter column expires_at set default (now() + interval '5 minutes');

create or replace function public.reserve_otp(
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
 values(p_id, p_email_hash, p_email_domain, p_address, p_registry_address, p_ip_hash, p_otp_hash, t, t + interval '5 minutes');
 return jsonb_build_object('status', 'OK', 'expiresAt', t + interval '5 minutes');
end $$;

create or replace function public.reserve_organizer_contact_otp(p_id uuid, p_wallet text, p_email_hash text, p_ip_hash text, p_otp_hash text)
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
  return jsonb_build_object('status', 'OK', 'expiresAt', now() + interval '5 minutes');
end; $$;

create or replace function public.consume_organizer_contact_otp(p_id uuid, p_wallet text, p_email_hash text, p_otp_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare challenge organizer_contact_otps%rowtype;
begin
  -- Khóa hàng để một mã không thể xác thực thành công hai lần đồng thời.
  select * into challenge from organizer_contact_otps where id = p_id for update;
  -- Chưa có mã / đã dùng / đã hết 5 phút: đều không được xác thực lại.
  if not found or challenge.used or challenge.expires_at <= clock_timestamp() then
    return jsonb_build_object('status', 'EXPIRED');
  end if;
  if challenge.attempts >= 5 then return jsonb_build_object('status', 'LOCKED'); end if;
  update organizer_contact_otps set attempts = attempts + 1 where id = p_id;
  if challenge.wallet_address <> p_wallet or challenge.email_hash <> p_email_hash or challenge.otp_hash <> p_otp_hash then
    return jsonb_build_object('status', case when challenge.attempts + 1 >= 5 then 'LOCKED' else 'WRONG' end, 'attemptsLeft', greatest(0, 4 - challenge.attempts));
  end if;
  -- Mã đúng: revoke NGAY tại đây, không chờ hết 5 phút và không xoá dòng OTP.
  -- Giữ dòng để tiếp tục tính hạn mức gửi mã; lần consume sau sẽ gặp used=true.
  update organizer_contact_otps set used = true where id = p_id;
  return jsonb_build_object('status', 'OK');
end; $$;

-- Không gia hạn các mã đang tồn tại. Hai hàm consume khoá dòng trước khi
-- kiểm tra và đánh dấu used/used_at, nên một mã chỉ có thể thành công một lần.
-- Sinh viên dùng consume_otp ở migration 0001: tương tự nhưng ghi used_at thay vì used.
commit;
