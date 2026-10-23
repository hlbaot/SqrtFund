-- Chạy sau migrations 0001–0006 trên database thử nghiệm. Không giữ dữ liệu test.
begin;
do $$
declare
  a text := '0x' || repeat('1',40);
  b text := '0x' || repeat('2',40);
  c text := '0x' || repeat('3',40);
  id text := '0x' || repeat('a',64);
  legacy text := '0x' || repeat('b',64);
  registry text := '0x' || repeat('9',40);
  response jsonb;
begin
  response := public.enforce_plain_email_wallet('Student+club@School.edu.vn', a, false, id, legacy);
  if response->>'verificationId' <> id then raise exception 'New identity must be the random ID'; end if;
  if exists(select 1 from public.email_wallet_links where email='student@school.edu.vn' and wallet_address is not null) then
    raise exception 'Requesting OTP must not claim an email'; end if;
  response := public.enforce_plain_email_wallet('student@school.edu.vn', b, false, '0x'||repeat('c',64), legacy);
  if response->>'verificationId' <> id then raise exception 'Resend must retain the original identity'; end if;
  response := public.enforce_plain_email_wallet('student@school.edu.vn', a, true, id, legacy);
  if response->>'status' <> 'OK' then raise exception 'Verified identity claim failed'; end if;
  response := public.enforce_plain_email_wallet('student@school.edu.vn', b, true, id, legacy);
  if response->>'status' <> 'EMAIL_ALREADY_USED' then raise exception 'Email must not belong to two wallets'; end if;
  response := public.enforce_plain_email_wallet('different@school.edu.vn', a, true, '0x'||repeat('d',64), '0x'||repeat('e',64));
  if response->>'status' <> 'WALLET_ALREADY_VERIFIED' then raise exception 'Wallet must not belong to two emails'; end if;

  begin
    insert into public.email_wallet_links(email,wallet_address,verification_id)
      values('direct-duplicate@school.edu.vn',a,'0x'||repeat('4',64));
    raise exception 'UNIQUE(wallet_address) not enforced';
  exception when unique_violation then null; end;
  insert into public.verifications(address,registry_address,email_hash,email_domain,email)
    values(a,registry,id,'school.edu.vn','student@school.edu.vn');
  response := public.enforce_plain_email_wallet('student+organizer@school.edu.vn', a, true, id, legacy);
  if response->>'status' <> 'OK' then raise exception 'Same identity must be usable for both roles'; end if;
  begin
    insert into public.verifications(address,registry_address,email_hash,email_domain,email)
      values(b,registry,id,'school.edu.vn','student@school.edu.vn');
    raise exception 'Expected rejection of mismatched verified wallet';
  exception when unique_violation then null; end;

  -- Dữ liệu Student cũ chỉ có hash: giữ nguyên ID đã dùng trên contract.
  insert into public.verifications(address,registry_address,email_hash,email_domain)
    values(c,registry,'0x'||repeat('f',64),'school.edu.vn');
  response := public.enforce_plain_email_wallet('legacy@school.edu.vn', c, true, id, '0x'||repeat('f',64));
  if response->>'verificationId' <> '0x'||repeat('f',64) then raise exception 'Legacy contract ID changed'; end if;
  response := public.enforce_plain_email_wallet('legacy@school.edu.vn', b, true, id, '0x'||repeat('f',64));
  if response->>'status' <> 'EMAIL_ALREADY_USED' then raise exception 'Legacy ownership lost'; end if;

  insert into public.organizer_applications(wallet_address,organization_name,contact_email,reason,email_verified_at)
    values('0x'||repeat('5',40),'Legacy Club','club+organizer@school.edu.vn','Funding round',now());
  response := public.enforce_plain_email_wallet('club@school.edu.vn', b, true, '0x'||repeat('6',64), '0x'||repeat('7',64));
  if response->>'status' <> 'EMAIL_ALREADY_USED' then raise exception 'Legacy Organizer email was reassigned'; end if;
  response := public.enforce_plain_email_wallet('another@school.edu.vn','0x'||repeat('5',40),true,'0x'||repeat('8',64),'0x'||repeat('9',64));
  if response->>'status' <> 'WALLET_ALREADY_VERIFIED' then raise exception 'Legacy Organizer wallet was reassigned'; end if;

  if has_table_privilege('anon','public.email_wallet_links','SELECT') then raise exception 'Anonymous email read allowed'; end if;
  if has_function_privilege('anon','public.enforce_plain_email_wallet(text,text,boolean,text,text)','EXECUTE') then raise exception 'Anonymous binding allowed'; end if;
  if has_function_privilege('service_role','public.enforce_email_wallet(text,text,boolean)','EXECUTE') then raise exception 'Legacy API can bypass plain email binding'; end if;
  if not has_function_privilege('service_role','public.enforce_plain_email_wallet(text,text,boolean,text,text)','EXECUTE') then raise exception 'Service cannot bind identities'; end if;
end $$;
rollback;
