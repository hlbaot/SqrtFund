-- Fixture database only after migrations 0001–0009. All writes rolled back.
begin;
insert into public.organizer_applications(id,wallet_address,organization_name,contact_email,reason,status,updated_at) values
 ('40000000-0000-4000-8000-000000000001','0x0404040404040404040404040404040404040404','Fixture target','target@example.invalid','Fixture review target','pending','2026-10-01T00:00:00Z'),
 ('40000000-0000-4000-8000-000000000002','0x0404040404040404040404040404040404040404','Fixture peer','peer@example.invalid','Fixture review peer','approved','2026-10-01T00:00:00Z'),
 ('40000000-0000-4000-8000-000000000003','0x0404040404040404040404040404040404040404','Fixture pending','pending@example.invalid','Fixture pending stays pending','pending','2026-10-01T00:00:00Z'),
 ('40000000-0000-4000-8000-000000000004','0x'||repeat('5',40),'Fixture other','other@example.invalid','Fixture other stays approved','approved','2026-10-01T00:00:00Z');
do $$
declare r jsonb; old_version timestamptz:='2026-10-01T00:00:00Z';
begin
 if has_function_privilege('anon','public.review_organizer_application(uuid,text,timestamptz,text,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.review_organizer_application(uuid,text,timestamptz,text,text,text)','EXECUTE') then raise exception 'public review allowed'; end if;
 if not has_function_privilege('service_role','public.review_organizer_application(uuid,text,timestamptz,text,text,text)','EXECUTE') then raise exception 'server review missing'; end if;
 r:=public.review_organizer_application('40000000-0000-4000-8000-000000000001','approved',old_version,'0x'||repeat('a',40));
 if r->>'status'<>'OK' or r->'application'->>'status'<>'approved' then raise exception 'approval not persisted'; end if;
 if (r->'application'->>'updated_at')::timestamptz<=old_version then raise exception 'revision did not advance'; end if;
 r:=public.review_organizer_application('40000000-0000-4000-8000-000000000001','rejected',old_version,'0x'||repeat('a',40));
 if r->>'status'<>'CHANGED' then raise exception 'stale review overwrote row'; end if;
 r:=public.review_organizer_application('40000000-0000-4000-8000-000000000003','revoked',old_version,'0x'||repeat('a',40),null,'Fixture reason');
 if r->>'status'<>'CHANGED' then raise exception 'pending application was revoked'; end if;
end $$;
-- Make one row of the wallet-wide operation fail to prove rollback of all rows.
create temporary sequence sf04_review_write_count;
create function pg_temp.fail_sf04_peer() returns trigger language plpgsql as $$
begin
 if new.status='revoked' and new.wallet_address='0x0404040404040404040404040404040404040404'
   and nextval('pg_temp.sf04_review_write_count')=2 then
  raise exception 'FIXTURE_REVIEW_FAILURE' using errcode='23514';
 end if;
 return new;
end $$;
create trigger sf04_fail_peer before update on public.organizer_applications for each row execute function pg_temp.fail_sf04_peer();
do $$
declare revision timestamptz; r jsonb;
begin
 select updated_at into revision from public.organizer_applications where id='40000000-0000-4000-8000-000000000001';
 begin
  r:=public.review_organizer_application('40000000-0000-4000-8000-000000000001','revoked',revision,'0x'||repeat('a',40),null,'Fixture reason');
  raise exception 'expected forced failure';
 exception when check_violation then if sqlerrm<>'FIXTURE_REVIEW_FAILURE' then raise; end if; end;
 if currval('pg_temp.sf04_review_write_count')<>2 then raise exception 'failure did not occur after an earlier row update'; end if;
 if exists(select 1 from public.organizer_applications where id in ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002') and status<>'approved') then
  raise exception 'partial review persisted'; end if;
 if (select updated_at from public.organizer_applications where id='40000000-0000-4000-8000-000000000001')<>revision then
  raise exception 'failed review changed revision'; end if;
end $$;
drop trigger sf04_fail_peer on public.organizer_applications;
do $$
declare revision timestamptz; r jsonb; reviewed timestamptz;
begin
 select updated_at into revision from public.organizer_applications where id='40000000-0000-4000-8000-000000000001';
 r:=public.review_organizer_application('40000000-0000-4000-8000-000000000001','revoked',revision,'0x'||repeat('a',40),'0x'||repeat('b',64),'Fixture reason');
 if r->>'status'<>'OK' or r->'application'->>'status'<>'revoked' then raise exception 'revocation failed'; end if;
 if (select count(*) from public.organizer_applications where wallet_address='0x0404040404040404040404040404040404040404' and status='revoked')<>2 then raise exception 'approved peers not revoked'; end if;
 if (select status from public.organizer_applications where id='40000000-0000-4000-8000-000000000003')<>'pending' then raise exception 'pending row changed'; end if;
 if (select status from public.organizer_applications where id='40000000-0000-4000-8000-000000000004')<>'approved' then raise exception 'other wallet changed'; end if;
 if (select count(distinct updated_at) from public.organizer_applications where wallet_address='0x0404040404040404040404040404040404040404' and status='revoked')<>1 then raise exception 'inconsistent revision stamps'; end if;
end $$;
rollback;
