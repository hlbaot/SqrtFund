-- Fixture-only; all changes rolled back. Run after migrations 0001–0007.
begin;
\ir ../recovery/sf02_orphan_recovery.sql
 do $$
 declare
  wallet text := '0x'||repeat('6',40);
  identity text := '0x'||repeat('6',64);
  response jsonb;
 begin
  response := public.enforce_plain_email_wallet('orphan@fixture.test',wallet,true,identity,'0x'||repeat('7',64));
  if response->>'status'<>'OK' then raise exception 'fixture claim failed'; end if;
  insert into public.organizer_contact_otps(id,wallet_address,email_hash,ip_hash,otp_hash)
    values('60000000-0000-4000-8000-000000000001',wallet,identity,'fixture','fixture');
  begin
    perform pg_temp.sf02_release_orphan('orphan@fixture.test',wallet,identity,false,true,true);
    raise exception 'expected review refusal';
  exception when raise_exception then if sqlerrm<>'RECOVERY_REVIEW_REQUIRED' then raise; end if; end;
  begin
    perform pg_temp.sf02_release_orphan('orphan@fixture.test',wallet,'0x'||repeat('8',64),true,true,true);
    raise exception 'expected stale state refusal';
  exception when raise_exception then if sqlerrm<>'RECOVERY_STATE_CHANGED' then raise; end if; end;
  perform pg_temp.sf02_release_orphan('orphan@fixture.test',wallet,identity,true,true,true);
  if exists(select 1 from public.email_wallet_links where email='orphan@fixture.test' and wallet_address is not null)
    then raise exception 'orphan not released'; end if;
  if exists(select 1 from public.organizer_contact_otps where email_hash=identity and not used)
    then raise exception 'old OTP remains usable'; end if;
  response := public.enforce_plain_email_wallet('rightful@fixture.test',wallet,true,'0x'||repeat('9',64),'0x'||repeat('a',64));
  if response->>'status'<>'OK' then raise exception 'wallet cannot bind correct email after recovery'; end if;
  insert into public.verifications(address,registry_address,email_hash,email_domain,email)
    values(wallet,'0x'||repeat('1',40),'0x'||repeat('9',64),'fixture.test','rightful@fixture.test');
  begin
    perform pg_temp.sf02_release_orphan('rightful@fixture.test',wallet,'0x'||repeat('9',64),true,true,true);
    raise exception 'expected attestation history refusal';
  exception when raise_exception then if sqlerrm<>'RECOVERY_HAS_HISTORY' then raise; end if; end;
  response := public.enforce_plain_email_wallet('club@fixture.test','0x'||repeat('8',40),true,'0x'||repeat('8',64),'0x'||repeat('b',64));
  insert into public.organizer_applications(wallet_address,organization_name,contact_email,reason)
    values('0x'||repeat('8',40),'Fixture Club','club@fixture.test','Fixture recovery test');
  begin
    perform pg_temp.sf02_release_orphan('club@fixture.test','0x'||repeat('8',40),'0x'||repeat('8',64),true,true,true);
    raise exception 'expected organizer history refusal';
  exception when raise_exception then if sqlerrm<>'RECOVERY_HAS_HISTORY' then raise; end if; end;
 end $$;
rollback;
