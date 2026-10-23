-- Chạy sau migrations 0001–0007 trên database thử nghiệm; mọi dữ liệu được rollback.
begin;
do $$
declare
  student_id uuid := gen_random_uuid();
  organizer_id uuid := gen_random_uuid();
  wallet text := '0x'||repeat('1',40);
  registry text := '0x'||repeat('9',40);
  identity text := '0x'||repeat('a',64);
  otp text := repeat('b',64);
  response jsonb;
  deadline timestamptz;
begin
  response := public.reserve_otp(student_id,identity,'school.edu.vn',wallet,registry,'student-ip',otp);
  if response->>'status' <> 'OK' then raise exception 'Student reserve failed'; end if;
  select expires_at into deadline from public.otp_requests where id=student_id;
  if deadline < clock_timestamp()+interval '299 seconds' or deadline > clock_timestamp()+interval '301 seconds' then
    raise exception 'Student deadline must be five minutes'; end if;
  -- Sau hơn một phút, mã vẫn hợp lệ nếu còn trong hạn năm phút.
  update public.otp_requests set created_at=clock_timestamp()-interval '4 minutes',expires_at=clock_timestamp()+interval '1 minute' where id=student_id;
  response := public.consume_otp(student_id,repeat('c',64));
  if response->>'status' <> 'WRONG' then raise exception 'Wrong Student code accepted'; end if;
  if exists(select 1 from public.otp_requests where id=student_id and used_at is not null) then raise exception 'Wrong code consumed a valid challenge'; end if;
  response := public.consume_otp(student_id,otp);
  if response->>'status' <> 'OK' then raise exception 'Student code incorrectly expired after one minute'; end if;
  if not exists(select 1 from public.otp_requests where id=student_id and used_at is not null) then raise exception 'Student code was not immediately revoked'; end if;
  response := public.consume_otp(student_id,otp);
  if response->>'status' <> 'EXPIRED' then raise exception 'Student OTP replay accepted'; end if;

  response := public.reserve_organizer_contact_otp(organizer_id,wallet,identity,'organizer-ip',otp);
  if response->>'status' <> 'OK' then raise exception 'Organizer reserve failed'; end if;
  select expires_at into deadline from public.organizer_contact_otps where id=organizer_id;
  if deadline < clock_timestamp()+interval '299 seconds' or deadline > clock_timestamp()+interval '301 seconds' then
    raise exception 'Organizer deadline must be five minutes'; end if;
  update public.organizer_contact_otps set created_at=clock_timestamp()-interval '4 minutes',expires_at=clock_timestamp()+interval '1 minute' where id=organizer_id;
  response := public.consume_organizer_contact_otp(organizer_id,wallet,identity,otp);
  if response->>'status' <> 'OK' then raise exception 'Organizer code incorrectly expired after one minute'; end if;
  if not exists(select 1 from public.organizer_contact_otps where id=organizer_id and used) then raise exception 'Organizer code was not immediately revoked'; end if;
  response := public.consume_organizer_contact_otp(organizer_id,wallet,identity,otp);
  if response->>'status' <> 'EXPIRED' then raise exception 'Organizer OTP replay accepted'; end if;

  update public.otp_requests set used_at=null,expires_at=clock_timestamp()-interval '1 second' where id=student_id;
  response := public.consume_otp(student_id,otp);
  if response->>'status' <> 'EXPIRED' then raise exception 'Expired Student OTP accepted'; end if;
  update public.organizer_contact_otps set used=false,expires_at=clock_timestamp()-interval '1 second' where id=organizer_id;
  response := public.consume_organizer_contact_otp(organizer_id,wallet,identity,otp);
  if response->>'status' <> 'EXPIRED' then raise exception 'Expired Organizer OTP accepted'; end if;
end $$;
rollback;
