-- Session-local operator tool, NOT an API/migration. Load inside an explicit transaction.
-- No production invocation without independently checked ownership, chain state and case review.
-- Parameters and return data must never be pasted into public logs/issues.
create or replace function pg_temp.sf02_release_orphan(
  p_email text, p_wallet text, p_expected_identity text,
  p_wallet_and_email_proven boolean, p_onchain_clear boolean, p_issuance_window_elapsed boolean
) returns void language plpgsql as $$
declare bound public.email_wallet_links%rowtype;
begin
  if p_wallet_and_email_proven is distinct from true or p_onchain_clear is distinct from true
    or p_issuance_window_elapsed is distinct from true then
    raise exception 'RECOVERY_REVIEW_REQUIRED';
  end if;
  -- Block concurrent writes from OTP/claim/create paths while inspecting and releasing.
  lock table public.email_wallet_links, public.email_wallet_bindings, public.verifications,
    public.organizer_applications, public.otp_requests, public.organizer_contact_otps in share row exclusive mode;
  select * into bound from public.email_wallet_links where email=public.normalize_identity_email(p_email) for update;
  if not found or bound.wallet_address is distinct from lower(p_wallet)
    or bound.verification_id is distinct from p_expected_identity then
    raise exception 'RECOVERY_STATE_CHANGED';
  end if;
  -- Even a failed/rejected/revoked application or an off-chain attestation blocks automatic release.
  if exists(select 1 from public.verifications where lower(address)=lower(p_wallet) or email_hash=p_expected_identity
      or public.normalize_identity_email(email)=bound.email)
    or exists(select 1 from public.organizer_applications where lower(wallet_address)=lower(p_wallet)
      or public.normalize_identity_email(contact_email)=bound.email)
    or exists(select 1 from public.email_wallet_bindings where wallet_address=lower(p_wallet) and email_hash<>p_expected_identity) then
    raise exception 'RECOVERY_HAS_HISTORY';
  end if;
  update public.otp_requests set used_at=coalesce(used_at,clock_timestamp())
    where address=lower(p_wallet) or email_hash=p_expected_identity;
  update public.organizer_contact_otps set used=true
    where wallet_address=lower(p_wallet) or email_hash=p_expected_identity;
  delete from public.email_wallet_bindings where email_hash=p_expected_identity and wallet_address=lower(p_wallet);
  -- Retain the stable random identity. Never move a binding to another wallet/email here.
  update public.email_wallet_links set wallet_address=null, verified_at=null where email=bound.email;
end $$;
