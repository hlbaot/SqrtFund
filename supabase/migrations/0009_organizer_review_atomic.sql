begin;
-- Database errors must not leave a target revoked but other approved records active.
-- Re-running this migration updates the existing function without dropping it or its data.
create or replace function public.review_organizer_application(
  p_id uuid, p_status text, p_expected_updated_at timestamptz, p_reviewed_by text,
  p_tx_hash text default null, p_revocation_reason text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  wallet text;
  application public.organizer_applications%rowtype;
  changed_at timestamptz;
begin
  if p_status is null or p_status not in ('approved','rejected','revoked')
    or p_expected_updated_at is null or p_reviewed_by is null or p_reviewed_by !~* '^0x[0-9a-f]{40}$'
    or (p_status='revoked' and (p_revocation_reason is null or length(trim(p_revocation_reason))<3)) then
    raise exception 'INVALID_REVIEW' using errcode='22023';
  end if;
  select lower(a.wallet_address) into wallet from public.organizer_applications a where a.id=p_id;
  if not found then return jsonb_build_object('status','CHANGED'); end if;
  -- Serialize reviews for one wallet; lock/re-read the signed revision after waiting.
  perform pg_advisory_xact_lock(hashtextextended('organizer-review:'||wallet,0));
  select * into application from public.organizer_applications a where a.id=p_id for update;
  if not found or application.updated_at is distinct from p_expected_updated_at
    or (p_status='revoked' and application.status<>'approved') then
    return jsonb_build_object('status','CHANGED');
  end if;
  changed_at:=greatest(clock_timestamp(),application.updated_at+interval '1 microsecond');
  if p_status='revoked' then
    update public.organizer_applications a set status='revoked',tx_hash=p_tx_hash,
      revocation_reason=trim(p_revocation_reason),reviewed_by=lower(p_reviewed_by),
      reviewed_at=changed_at,updated_at=changed_at
      where lower(a.wallet_address)=wallet and a.status='approved';
    select * into application from public.organizer_applications a where a.id=p_id;
  else
    update public.organizer_applications a set status=p_status,tx_hash=p_tx_hash,revocation_reason=null,
      reviewed_by=lower(p_reviewed_by),reviewed_at=changed_at,updated_at=changed_at
      where a.id=p_id returning * into application;
  end if;
  return jsonb_build_object('status','OK','application',to_jsonb(application));
end $$;
revoke all on function public.review_organizer_application(uuid,text,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.review_organizer_application(uuid,text,timestamptz,text,text,text) to service_role;
commit;
