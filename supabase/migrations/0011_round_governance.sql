begin;
-- One immutable policy per round and one immutable explanation per project.
create table if not exists public.round_governance (
  id bigint generated always as identity primary key,
  chain_id integer not null check(chain_id=43113),
  round_address text not null check(round_address ~ '^0x[0-9a-f]{40}$'),
  kind text not null check(kind in ('policy','review')),
  entry_key text not null,
  owner_address text not null check(owner_address ~ '^0x[0-9a-f]{40}$'),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=48000),
  transaction_hash text check(transaction_hash ~ '^0x[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  unique(chain_id,round_address,entry_key),
  check((kind='policy' and entry_key='policy' and transaction_hash is null) or
        (kind='review' and entry_key ~ '^review:[1-9][0-9]{0,18}$' and transaction_hash is not null))
);
alter table public.round_governance enable row level security;
revoke all on public.round_governance from public,anon,authenticated,service_role;
grant select,insert on public.round_governance to service_role;
grant usage,select on sequence public.round_governance_id_seq to service_role;
create or replace function public.prevent_round_governance_mutation() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin raise exception 'Published governance records are immutable'; end $$;
drop trigger if exists round_governance_immutable on public.round_governance;
create trigger round_governance_immutable before update or delete on public.round_governance for each row execute function public.prevent_round_governance_mutation();
commit;
