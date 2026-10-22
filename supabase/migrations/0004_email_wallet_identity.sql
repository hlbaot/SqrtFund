begin;

-- Một email chỉ thuộc một ví; cùng ví được phép vừa là sinh viên vừa là Organizer.
create table public.email_wallet_bindings (
  email_hash text primary key check (email_hash ~ '^0x[0-9a-f]{64}$'),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  verified_at timestamptz not null default now()
);
alter table public.email_wallet_bindings enable row level security;
revoke all on public.email_wallet_bindings from public, anon, authenticated;
grant all on public.email_wallet_bindings to service_role;

-- Email sinh viên đã xác thực không thể bị đăng ký lại bằng ví Organizer khác.
insert into public.email_wallet_bindings(email_hash, wallet_address, verified_at)
select lower(email_hash), lower(address), verified_at from public.verifications;

create function public.enforce_email_wallet(p_email_hash text, p_wallet_address text, p_claim boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare bound_wallet text;
begin
  if p_claim then
    insert into public.email_wallet_bindings(email_hash, wallet_address)
      values (lower(p_email_hash), lower(p_wallet_address)) on conflict (email_hash) do nothing;
  end if;
  select b.wallet_address into bound_wallet from public.email_wallet_bindings b where b.email_hash = lower(p_email_hash);
  if bound_wallet is not null and bound_wallet <> lower(p_wallet_address) then
    return jsonb_build_object('status', 'EMAIL_ALREADY_USED');
  end if;
  return jsonb_build_object('status', 'OK');
end; $$;
revoke all on function public.enforce_email_wallet(text,text,boolean) from public, anon, authenticated;
grant execute on function public.enforce_email_wallet(text,text,boolean) to service_role;

-- Giữ ràng buộc ở tầng DB cho luồng sinh viên, kể cả khi có nhiều instance API.
create function public.bind_student_email_wallet() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.enforce_email_wallet(new.email_hash, new.address, true)->>'status' <> 'OK' then
    raise exception 'EMAIL_ALREADY_USED' using errcode = '23505';
  end if;
  return new;
end; $$;
revoke all on function public.bind_student_email_wallet() from public, anon, authenticated;
create trigger student_email_wallet_binding before insert or update on public.verifications
for each row execute function public.bind_student_email_wallet();

commit;
