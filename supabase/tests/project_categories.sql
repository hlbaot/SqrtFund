begin;
set local role service_role;
insert into public.round_governance(chain_id,round_address,kind,entry_key,owner_address,payload)
values(43113,'0x1111111111111111111111111111111111111111','category','category:7','0x2222222222222222222222222222222222222222','{"kind":"category","projectId":"7","category":"community"}');
do $$
begin
  begin
    insert into public.round_governance(chain_id,round_address,kind,entry_key,owner_address,payload)
    values(43113,'0x1111111111111111111111111111111111111111','category','category:7','0x2222222222222222222222222222222222222222','{"kind":"category","projectId":"7","category":"arts"}');
    raise exception 'duplicate category accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.round_governance(chain_id,round_address,kind,entry_key,owner_address,payload)
    values(43113,'0x1111111111111111111111111111111111111111','category','category:8','0x2222222222222222222222222222222222222222','{"kind":"category","projectId":"8","category":"unknown"}');
    raise exception 'invalid category accepted';
  exception when check_violation then null; end;
  begin
    insert into public.round_governance(chain_id,round_address,kind,entry_key,owner_address,payload)
    values(43113,'0x1111111111111111111111111111111111111111','category','category:8','0x2222222222222222222222222222222222222222','{"kind":"category","projectId":"9","category":"arts"}');
    raise exception 'mismatched project accepted';
  exception when check_violation then null; end;
end $$;
reset role;
rollback;
