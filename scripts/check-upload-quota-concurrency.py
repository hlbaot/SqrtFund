"""CI-only fixture check. POSTGRES_CONTAINER must identify the isolated CI database."""
import concurrent.futures
import os
import subprocess

container = os.environ["POSTGRES_CONTAINER"]
command = ["docker", "exec", container, "psql", "-U", "postgres", "-d", "sqrtfund_ci", "-v", "ON_ERROR_STOP=1", "-qAt"]
wallet = "0x" + "9" * 40


def reserve(index):
    sql = f"SELECT public.reserve_project_upload('{wallet}',md5('ci-concurrent-{index}'),100)->>'status'"
    return subprocess.check_output(command + ["-c", sql], text=True).strip()


try:
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(reserve, range(12)))
    if results.count("OK") != 5 or results.count("RATE_LIMITED") != 7:
        raise SystemExit("Concurrent upload quota check failed")
    print("Concurrent upload quota: 5 accepted, 7 rejected; PASS")
finally:
    subprocess.run(command + ["-c", f"DELETE FROM public.project_upload_reservations WHERE wallet='{wallet}'"], check=True)
