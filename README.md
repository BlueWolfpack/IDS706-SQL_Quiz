# IDS706-SQL_Quiz

Project name: IDS706-SQL-Quiz

consider changing init.sql and query.py with stuff for quiz

remember to update .env with password and other information

To clean up/restart the table:

inside the Supabase SQL editor
```
DROP TABLE restaurants;
```

to delete whole project: **Project Settings --> General --> Delete project**.

## Things I don't understand
**from Step 2. Fill in the files**

Three things to notice:

- The %s placeholders. Never build SQL with f-strings; let psycopg2 substitute the values for you. This avoids SQL injection and quoting bugs (like the apostrophe in Queeny's).
- Nothing is saved until conn.commit(). If the script crashed before that line, the database would be unchanged.
- Host, port, user and password are passed as separate arguments, not glued into one URL. That is why a password containing @ or / does not break anything.

**from Step 4. Create the table and look at it**

What is RLS (row level security) and when should it be/not be enabled?

**from Step 6. (Optional) Connect the VS Code PostgreSQL Explorer**

I am really not sure what I am supposed to be doing here. Am I making a new .env file?

## Quiz website (`web/`)

A static site (plain HTML/JS, no build step) where a signed-in user answers the 6-question, 20-point crop yield SQL quiz:
pick a question, write SQL, run it against Supabase, and see the result table. Each question has a hint with the expected SQL and expected result.

- `web/questions.js` holds the questions, hints and expected results (also in `datasets/quiz_questions.md`).
- `web/config.js` holds the Supabase URL and the public **anon** key (safe to commit; never put the `service_role` key here).
- Queries run through the Postgres function `public.run_quiz_sql` (see `supabase/run_quiz_sql.sql`): signed-in users only, one read-only `SELECT`/`WITH` statement, max 1000 rows shown, 8 s time limit.

### Deploy on Vercel
1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** `BlueWolfpack/IDS706-SQL_Quiz`.
3. Set **Root Directory** to `web`, Framework Preset **Other**, leave Build Command empty. Click **Deploy**.
4. Every push to `main` redeploys automatically.

### Supabase auth settings (Dashboard → Authentication)
- **URL Configuration → Site URL**: set to the Vercel URL (e.g. `https://ids706-sql-quiz.vercel.app`) so confirmation emails link back to the site.
- **Sign In / Providers → Email**: if "Confirm email" is on, new users must click an emailed link before signing in (Supabase's built-in email sender only sends a few emails per hour). Turn it off for easier grading, or create grader accounts under **Users → Add user**.
