-- Saving quiz answers + append-only audit log (extra credit).
-- Run after datasets/cleaned/schema.sql and the CSV imports. Creates the run_quiz_sql function the website calls.
--
-- Design
--  * quiz_answers: each signed-in user can read/insert/update/delete only their own saved answers (RLS).
--    Signed-out users (anon) have no access at all, so they cannot save.
--  * audit_log: one row per query run and per save (who, what, when, success).
--    - Takers can read only their own rows and cannot insert, update or delete any row (no grants, no policies).
--    - A trigger rejects UPDATE, DELETE and TRUNCATE for every role, so the log is append-only.
--  * run_quiz_sql runs as the dedicated low-privilege role quiz_runner (SECURITY DEFINER):
--    it may SELECT the quiz tables and INSERT into audit_log, nothing else, and it has no BYPASSRLS.
--    The student's SQL is wrapped as a subquery, so it cannot contain INSERT/UPDATE/DELETE,
--    which means a student's query can never write to the audit log; only the function body can.

-- ---------- role that runs student queries ----------
do $$ begin
  create role quiz_runner nologin noinherit;
exception when duplicate_object then null; end $$;
grant quiz_runner to postgres;   -- lets the project owner make it a function owner

grant usage on schema public to quiz_runner;
grant create on schema public to quiz_runner;   -- temporary: needed to own functions; revoked at the end
grant select on public.yield, public.pesticides, public.rainfall, public.temp, public.yield_df to quiz_runner;

-- ---------- saved answers ----------
create table if not exists public.quiz_answers (
  user_id      uuid        not null default auth.uid(),
  question_id  text        not null,
  sql          text        not null,
  saved_at     timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.quiz_answers enable row level security;
revoke all on public.quiz_answers from anon, public;
grant select, insert, update, delete on public.quiz_answers to authenticated;
do $$ begin
  create policy "own answers: read"   on public.quiz_answers for select to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own answers: insert" on public.quiz_answers for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own answers: update" on public.quiz_answers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own answers: delete" on public.quiz_answers for delete to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ---------- audit log ----------
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  user_id      uuid,
  user_email   text,
  action       text        not null check (action in ('run', 'save')),
  question_id  text,
  sql          text,
  success      boolean     not null,
  row_count    integer,
  error        text
);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated, public;
grant select on public.audit_log to authenticated;            -- own rows only, via the policy below
grant insert on public.audit_log to quiz_runner;
do $$ begin
  create policy "own log rows: read" on public.audit_log for select to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "runner: insert"     on public.audit_log for insert to quiz_runner with check (true);
exception when duplicate_object then null; end $$;

-- Append-only: block UPDATE / DELETE / TRUNCATE for everyone.
create or replace function public.audit_log_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only: % is not allowed', tg_op;
end $$;
create or replace trigger audit_log_no_update_delete before update or delete on public.audit_log
  for each row execute function public.audit_log_append_only();
create or replace trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_append_only();

-- Log every save (insert or update of a saved answer).
create or replace function public.log_answer_save()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (user_id, user_email, action, question_id, sql, success)
  values (new.user_id,
          nullif(current_setting('request.jwt.claims', true), '')::json ->> 'email',
          'save', new.question_id, new.sql, true);
  return new;
end $$;
alter function public.log_answer_save() owner to quiz_runner;
revoke all on function public.log_answer_save() from public, anon, authenticated;
create or replace trigger quiz_answers_audit after insert or update on public.quiz_answers
  for each row execute function public.log_answer_save();

-- ---------- query runner (logs every run) ----------
-- Returns a JSON array of rows on success, or {"error": "..."} on failure (so the failed run is still logged).
-- Supabase's linter warns that signed-in users can call this SECURITY DEFINER function. That is intended:
-- it runs as quiz_runner, which can only SELECT the quiz tables and INSERT into audit_log.
create or replace function public.run_quiz_sql(query text, question_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  -- identity is read BEFORE the student's SQL runs, so the query cannot change who gets logged
  claims  json := nullif(current_setting('request.jwt.claims', true), '')::json;
  uid     uuid := (claims ->> 'sub')::uuid;
  email   text := claims ->> 'email';
  q       text := regexp_replace(coalesce(query, ''), '[;[:space:]]+$', '');
  bare    text;
  result  json;
  msg     text;
begin
  if uid is null then
    raise exception 'Sign in to run queries.';
  end if;

  bare := regexp_replace(regexp_replace(q, '--[^\n]*', '', 'g'), '^[[:space:]]+', '');
  if bare = '' then
    msg := 'Query is empty.';
  elsif position(';' in q) > 0 then
    msg := 'Only one statement is allowed (remove the semicolon in the middle).';
  elsif lower(bare) !~ '^(select|with)[[:space:](]' then
    msg := 'Only SELECT or WITH queries are allowed.';
  end if;

  if msg is null then
    begin
      -- Wrapping as a subquery blocks INSERT/UPDATE/DELETE, including inside a WITH clause.
      -- The newline before ")" keeps a trailing -- comment from swallowing the wrapper.
      execute format(
        E'select coalesce(json_agg(t), ''[]''::json) from (select * from (%s\n) s limit 1001) t', q)
      into result;
    exception when others then
      msg := sqlerrm;
    end;
  end if;

  insert into public.audit_log (user_id, user_email, action, question_id, sql, success, row_count, error)
  values (uid, email, 'run', question_id, left(query, 10000), msg is null,
          case when msg is null then json_array_length(result) end, msg);

  if msg is not null then
    return json_build_object('error', msg);
  end if;
  return result;
end;
$$;
alter function public.run_quiz_sql(text, text) owner to quiz_runner;
revoke all on function public.run_quiz_sql(text, text) from public, anon;
grant execute on function public.run_quiz_sql(text, text) to authenticated;

-- One-argument form (used by older versions of the site): same as above without a question id.
create or replace function public.run_quiz_sql(query text)
returns json language sql security invoker set search_path = public as $$
  select public.run_quiz_sql(query, null::text)
$$;
revoke all on function public.run_quiz_sql(text) from public, anon;
grant execute on function public.run_quiz_sql(text) to authenticated;

revoke create on schema public from quiz_runner;
