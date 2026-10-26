-- Fixture database only, after migrations 0001–0008. All data rolled back.
begin;
do $$
declare r jsonb; w text:='0x'||repeat('1',40); i integer;
begin
  if has_table_privilege('anon','public.project_upload_reservations','SELECT')
    or has_function_privilege('anon','public.reserve_project_upload(text,text,bigint)','EXECUTE')
    or has_function_privilege('authenticated','public.reserve_project_upload(text,text,bigint)','EXECUTE') then raise exception 'public quota access'; end if;
  if not has_function_privilege('service_role','public.reserve_project_upload(text,text,bigint)','EXECUTE') then raise exception 'missing server quota access'; end if;
  r:=public.reserve_project_upload(w,md5('first'),100);
  if r->>'status'<>'OK' then raise exception 'valid reservation rejected'; end if;
  r:=public.reserve_project_upload(w,md5('first'),100);
  if r->>'status'<>'REPLAY' then raise exception 'replay accepted'; end if;
  for i in 2..5 loop perform public.reserve_project_upload(w,md5(i::text),100); end loop;
  r:=public.reserve_project_upload(w,md5('sixth'),100);
  if r->>'status'<>'RATE_LIMITED' then raise exception 'hourly quota bypass'; end if;
  if (select count(*) from public.project_upload_reservations)<>5 then raise exception 'rejected request was inserted'; end if;
  update public.project_upload_reservations set created_at=now()-interval '2 hours';
  for i in 6..20 loop
    r:=public.reserve_project_upload(w,md5(i::text),100);
    if r->>'status'<>'OK' then raise exception 'expected daily capacity'; end if;
    update public.project_upload_reservations set created_at=now()-interval '2 hours';
  end loop;
  r:=public.reserve_project_upload(w,md5('twentyfirst'),100);
  if r->>'status'<>'RATE_LIMITED' then raise exception 'daily quota bypass'; end if;
  delete from public.project_upload_reservations;
  for i in 1..100 loop
    r:=public.reserve_project_upload('0x'||lpad(to_hex(i),40,'0'),md5('global'||i),100);
    if r->>'status'<>'OK' then raise exception 'global capacity early rejection'; end if;
  end loop;
  r:=public.reserve_project_upload('0x'||repeat('f',40),md5('global-over'),100);
  if r->>'status'<>'RATE_LIMITED' then raise exception 'global count bypass'; end if;
  delete from public.project_upload_reservations;
  for i in 1..50 loop
    r:=public.reserve_project_upload('0x'||lpad(to_hex(i),40,'0'),md5('bytes'||i),4194304);
    if r->>'status'<>'OK' then raise exception 'byte capacity early rejection'; end if;
  end loop;
  r:=public.reserve_project_upload('0x'||repeat('f',40),md5('bytes-over'),1);
  if r->>'status'<>'RATE_LIMITED' then raise exception 'global byte limit bypass'; end if;
  update public.project_upload_reservations set created_at=now()-interval '25 hours';
  r:=public.reserve_project_upload(w,md5('window-reset'),100);
  if r->>'status'<>'OK' then raise exception 'rolling window did not reset'; end if;
end $$;
rollback;
