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