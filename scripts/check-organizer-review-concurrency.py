"""CI-only competing-review fixture on the isolated sqrtfund_ci database."""
import concurrent.futures
import os
import subprocess

command = ["docker", "exec", os.environ["POSTGRES_CONTAINER"], "psql", "-U", "postgres", "-d", "sqrtfund_ci", "-v", "ON_ERROR_STOP=1", "-qAt"]
application = "49000000-0000-4000-8000-000000000001"


def sql(statement):
    return subprocess.check_output(command + ["-c", statement], text=True).strip()


def review(status):
    return sql(f"SELECT public.review_organizer_application('{application}','{status}','2026-10-01T00:00:00Z','0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')->>'status'")


try:
    sql(f"INSERT INTO public.organizer_applications(id,wallet_address,organization_name,contact_email,reason,status,updated_at) VALUES('{application}','0x4444444444444444444444444444444444444444','Review fixture','fixture@example.invalid','Concurrent review fixture','pending','2026-10-01T00:00:00Z')")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(review, ["approved", "rejected"]))
    if results.count("OK") != 1 or results.count("CHANGED") != 1:
        raise SystemExit("Competing organizer reviews did not preserve the signed revision")
    print("Concurrent organizer review: 1 accepted, 1 stale revision; PASS")
finally:
    sql(f"DELETE FROM public.organizer_applications WHERE id='{application}'")
