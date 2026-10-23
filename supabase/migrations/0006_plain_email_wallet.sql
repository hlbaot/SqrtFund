begin;

-- Email được lưu trực tiếp, chuẩn hoá chữ thường và alias +tag.
-- Một email có một ID ổn định; chỉ OTP thành công mới liên kết ID với ví.
create table public.email_wallet_links (
  email text primary key check (email = lower(btrim(email)) and char_length(email) <= 254),
  wallet_address text unique check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  verification_id text not null unique check (verification_id ~ '^0x[0-9a-f]{64}$'),
  verified_at timestamptz
);
alter table public.email_wallet_links enable row level security;
revoke all on public.email_wallet_links from public, anon, authenticated;
grant all on public.email_wallet_links to service_role;
alter table public.otp_requests add column email text;
alter table public.verifications add column email text;

create function public.normalize_identity_email(value text) returns text
language sql immutable strict set search_path = '' as $$
  select split_part(split_part(lower(btrim(value)), '@', 1), '+', 1) || '@' || split_part(lower(btrim(value)), '@', 2);
$$;
revoke all on function public.normalize_identity_email(text) from public, anon, authenticated;
create index organizer_application_identity_email on public.organizer_applications(public.normalize_identity_email(contact_email)) where email_verified_at is not null;
create index email_wallet_binding_wallet on public.email_wallet_bindings(wallet_address);

create function public.enforce_plain_email_wallet(
  p_email text, p_wallet_address text, p_claim boolean, p_new_identity text, p_legacy_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  canonical text := public.normalize_identity_email(p_email);
  wallet text := lower(p_wallet_address);
  identity text;
  bound_wallet text;
  legacy_wallet text;
  lock_key bigint;
begin
  if p_email is null or p_wallet_address is null or p_claim is null or p_new_identity is null or p_legacy_hash is null
    or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(p_email) > 254
    or canonical !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or wallet !~ '^0x[0-9a-f]{40}$' or p_new_identity !~ '^0x[0-9a-f]{64}$'
    or p_legacy_hash !~ '^0x[0-9a-f]{64}$' then
    raise exception 'INVALID_IDENTITY';
  end if;
  -- Khoá cả email và ví theo thứ tự cố định, kể cả hai xác nhận đồng thời.
  for lock_key in select k from unnest(array[
    pg_catalog.hashtextextended('plain-email:' || canonical, 0),
    pg_catalog.hashtextextended('plain-wallet:' || wallet, 0)
  ]) k order by k loop perform pg_catalog.pg_advisory_xact_lock(lock_key); end loop;

  select b.wallet_address into legacy_wallet from public.email_wallet_bindings b where b.email_hash = p_legacy_hash;
  if legacy_wallet is not null and legacy_wallet <> wallet then
    return jsonb_build_object('status', 'EMAIL_ALREADY_USED');
  end if;
  -- Không xoá/chuyển quyền của các đơn Organizer cũ đã xác thực.
  if exists (select 1 from public.organizer_applications a where a.email_verified_at is not null
    and public.normalize_identity_email(a.contact_email) = canonical and lower(a.wallet_address) <> wallet) then
    return jsonb_build_object('status', 'EMAIL_ALREADY_USED');
  end if;
  if exists (select 1 from public.organizer_applications a where a.email_verified_at is not null
    and lower(a.wallet_address) = wallet and public.normalize_identity_email(a.contact_email) <> canonical) then
    return jsonb_build_object('status', 'WALLET_ALREADY_VERIFIED');
  end if;

  insert into public.email_wallet_links(email, verification_id)
    values(canonical, case when legacy_wallet is not null then p_legacy_hash else p_new_identity end)
    on conflict (email) do nothing;
  select b.verification_id, b.wallet_address into identity, bound_wallet
    from public.email_wallet_links b where b.email = canonical for update;
  if bound_wallet is not null and bound_wallet <> wallet then
    return jsonb_build_object('status', 'EMAIL_ALREADY_USED');
  end if;
  if exists (select 1 from public.email_wallet_links b where b.wallet_address = wallet and b.email <> canonical)
    or exists (select 1 from public.email_wallet_bindings b where b.wallet_address = wallet
      and b.email_hash <> p_legacy_hash and b.email_hash <> identity) then
    return jsonb_build_object('status', 'WALLET_ALREADY_VERIFIED');
  end if;
  if p_claim then
    update public.email_wallet_links set wallet_address = wallet, verified_at = coalesce(verified_at, now()) where email = canonical;
  end if;
  return jsonb_build_object('status', 'OK', 'verificationId', identity);
end; $$;
revoke all on function public.enforce_plain_email_wallet(text,text,boolean,text,text) from public, anon, authenticated;
grant execute on function public.enforce_plain_email_wallet(text,text,boolean,text,text) to service_role;

-- API cũ phải dừng, không được tạo liên kết hash song song với mô hình mới.
-- Trigger SECURITY DEFINER vẫn dùng được hàm cũ cho dữ liệu legacy.
revoke execute on function public.enforce_email_wallet(text,text,boolean) from service_role;
create or replace function public.bind_student_email_wallet() returns trigger
language plpgsql security definer set search_path = '' as $$
declare checked jsonb;
begin
  if new.email is not null then
    new.email := public.normalize_identity_email(new.email);
    -- ID đã được cấp ở bước request OTP; trigger chỉ đối chiếu bản ghi chuẩn.
    if not exists (select 1 from public.email_wallet_links b where b.email = new.email
      and b.wallet_address = new.address and b.verification_id = new.email_hash) then
      raise exception 'IDENTITY_MISMATCH' using errcode = '23505';
    end if;
  end if;
  checked := public.enforce_email_wallet(new.email_hash, new.address, true);
  if checked->>'status' <> 'OK' then raise exception 'EMAIL_ALREADY_USED' using errcode = '23505'; end if;
  return new;
end; $$;

-- OTP cũ không có email trực tiếp: yêu cầu gửi mã mới sau khi nâng cấp.
update public.otp_requests set used_at = now() where used_at is null;
update public.organizer_contact_otps set used = true where not used;
commit;
