begin;
-- Reuse the signed, immutable publication store for owner-selected categories.
alter table public.round_governance drop constraint if exists round_governance_kind_check;
alter table public.round_governance add constraint round_governance_kind_check check(kind in ('policy','review','category'));
alter table public.round_governance drop constraint if exists round_governance_check;
alter table public.round_governance drop constraint if exists round_governance_entry_check;
alter table public.round_governance add constraint round_governance_entry_check check(
  (kind='policy' and entry_key='policy' and transaction_hash is null) or
  (kind='review' and entry_key ~ '^review:[1-9][0-9]{0,18}$' and transaction_hash is not null) or
  (kind='category' and entry_key ~ '^category:[1-9][0-9]{0,18}$' and transaction_hash is null
   and payload->>'kind' is not distinct from 'category' and payload->>'projectId' is not null and payload->>'projectId'=substring(entry_key from 10)
   and payload->>'category' is not null and payload->>'category' in ('technology','education','community','environment','arts'))
);
commit;
