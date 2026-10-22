-- Migration: 0005_revocation_reason.sql
-- Add revocation_reason column and 'revoked' status to organizer_applications
begin;

-- Drop existing check constraint on status to add 'revoked' value
alter table public.organizer_applications
  drop constraint if exists organizer_applications_status_check;

-- Re-create with expanded status values: pending, approved, rejected, revoked
alter table public.organizer_applications
  add constraint organizer_applications_status_check
  check (status in ('pending', 'approved', 'rejected', 'revoked'));

-- Add revocation_reason column (nullable, only populated when status = 'revoked')
alter table public.organizer_applications
  add column if not exists revocation_reason text;

-- Index for fast lookup of revoked applications
create index if not exists idx_organizer_applications_revoked
  on public.organizer_applications(status)
  where status = 'revoked';

commit;
