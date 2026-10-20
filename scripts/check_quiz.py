"""CI check for the crop yield SQL quiz.

Connects to the Supabase Postgres database through the Session pooler (sslmode=require),
using the password from the POSTGRES_PASSWORD GitHub secret, and checks that:
  1. every table has the expected number of rows,
  2. every quiz question's expected SQL returns exactly its expected result,
  3. the audit log is append-only (an UPDATE is rejected).

Values that change per query are passed as parameters (%s), never pasted into SQL strings.
Exits non-zero if any check fails, so the GitHub Actions run fails.
"""

import json
import os
import subprocess
import sys
from decimal import Decimal

import psycopg2

EXPECTED_ROWS = {"yield": 56717, "pesticides": 4349, "rainfall": 6727, "temp": 27479, "yield_df": 15610}
# Table names can't be query parameters, so they come only from this fixed allow-list.
COUNT_SQL = {name: f"SELECT COUNT(*) FROM public.{name}" for name in EXPECTED_ROWS}


def load_questions():
    """Read the questions (expected SQL + expected result) straight from the website's questions.js."""
    js = "global.window = {}; require('./web/questions.js'); console.log(JSON.stringify(window.QUIZ_QUESTIONS));"
    return json.loads(subprocess.check_output(["node", "-e", js], text=True))


def normalise(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def main():
    password = os.environ.get("POSTGRES_PASSWORD")
    if not password:
        sys.exit("POSTGRES_PASSWORD is not set (it should come from the GitHub secret).")

    conn = psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ.get("POSTGRES_DB", "postgres"),
        user=os.environ["POSTGRES_USER"],
        password=password,
        sslmode=os.environ.get("DB_SSLMODE", "require"),
        connect_timeout=20,
    )
    conn.set_session(readonly=True)
    failures = 0
    cur = conn.cursor()
    print(f"Connected to {os.environ['DB_HOST']} as {os.environ['POSTGRES_USER']}")

    # 1. Row counts
    for name, expected in EXPECTED_ROWS.items():
        cur.execute(COUNT_SQL[name])
        got = cur.fetchone()[0]
        ok = got == expected
        failures += not ok
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {got} rows (expected {expected})")

    # Parameterised spot check: number of maize rows in 2013
    cur.execute("SELECT COUNT(*) FROM public.yield WHERE item = %s AND year = %s", ("Maize", 2013))
    print(f"[INFO] maize rows in 2013 (parameterised query): {cur.fetchone()[0]}")

    # 2. Every question's expected SQL returns its expected result
    for q in load_questions():
        cur.execute(q["sql"])
        columns = [d[0] for d in cur.description]
        rows = [[normalise(v) for v in r] for r in cur.fetchall()]
        expected_rows = [[normalise(v) for v in r] for r in q["expected"]["rows"]]
        ok = columns == q["expected"]["columns"] and rows == expected_rows
        failures += not ok
        print(f"[{'PASS' if ok else 'FAIL'}] {q['id']} ({q['points']} pts) {q['title']}: {len(rows)} rows")
        if not ok:
            print(f"       got columns {columns}\n       got rows    {rows}")
    conn.rollback()

    # 3. Integrity: the audit log must reject UPDATE (append-only trigger). Rolled back either way.
    conn.set_session(readonly=False)
    try:
        cur.execute("UPDATE public.audit_log SET success = success WHERE id = %s", (-1,))
        # No row has id -1, so a row trigger would not fire; also try a statement that touches every row.
        cur.execute("UPDATE public.audit_log SET success = success")
        cur.execute("SELECT COUNT(*) FROM public.audit_log")
        n = cur.fetchone()[0]
        ok = n == 0  # only acceptable if the log is still empty
        print(f"[{'PASS' if ok else 'FAIL'}] audit_log UPDATE was not rejected ({n} rows in log)")
        failures += not ok
    except psycopg2.Error as err:
        reason = (err.pgerror or str(err)).strip().splitlines()[0]
        print(f"[PASS] audit_log is append-only: {reason}")
    finally:
        conn.rollback()

    conn.close()
    total = sum(q["points"] for q in load_questions())
    print(f"\nQuiz total: {total} points")
    if total != 20:
        print("[FAIL] quiz points must sum to 20")
        failures += 1
    if failures:
        sys.exit(f"{failures} check(s) failed")
    print("All checks passed.")


if __name__ == "__main__":
    main()
