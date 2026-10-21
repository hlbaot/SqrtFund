-- Migration: 0002_organizer_applications.sql
-- Table to store organizer authorization applications for SqrtFund MVP
begin;

create table if not exists public.organizer_applications (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null check (wallet_address ~* '^0x[0-9a-f]{40}$'),
  organization_name text not null check (char_length(organization_name) between 2 and 120),
  contact_email text not null check (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  reason text not null check (char_length(reason) between 5 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  tx_hash text check (tx_hash is null or tx_hash ~* '^0x[0-9a-f]{64}$'),
  reviewed_by text check (reviewed_by is null or reviewed_by ~* '^0x[0-9a-f]{40}$'),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organizer_applications_wallet on public.organizer_applications(lower(wallet_address));
create index if not exists idx_organizer_applications_status on public.organizer_applications(status, created_at desc);

alter table public.organizer_applications enable row level security;
revoke all on public.organizer_applications from public, anon, authenticated;
grant all on public.organizer_applications to service_role;

commit;
