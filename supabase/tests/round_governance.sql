begin;
insert into public.round_governance(chain_id,round_address,kind,entry_key,owner_address,payload)
values(43113,'0x1111111111111111111111111111111111111111','policy','policy','0x2222222222222222222222222222222222222222','{"kind":"policy"}');
do $$
begin
  begin
    insert into public.round_governance(chain_id,round_address,kind,entry_key,owner_address,payload)
    values(43113,'0x1111111111111111111111111111111111111111','policy','policy','0x2222222222222222222222222222222222222222','{}');
    raise exception 'duplicate policy accepted';
  exception when unique_violation then null; end;
  begin
    update public.round_governance set payload='{}' where round_address='0x1111111111111111111111111111111111111111';
    raise exception 'mutation accepted';
  exception when raise_exception then
    if sqlerrm <> 'Published governance records are immutable' then raise; end if;
  end;
  if has_table_privilege('anon','public.round_governance','SELECT') or
     has_table_privilege('authenticated','public.round_governance','INSERT') or
     has_table_privilege('service_role','public.round_governance','UPDATE') or
     has_table_privilege('service_role','public.round_governance','DELETE') then
    raise exception 'unexpected governance access';
  end if;
end $$;
set local role service_role;
insert into public.round_governance(chain_id,round_address,kind,entry_key,owner_address,payload,transaction_hash)
values(43113,'0x1111111111111111111111111111111111111111','review','review:1','0x2222222222222222222222222222222222222222','{"kind":"review"}','0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
select count(*) from public.round_governance;
reset role;
rollback;
