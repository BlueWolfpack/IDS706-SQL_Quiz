-- Read-only SQL runner used by the quiz website (web/app.js calls it with supabase.rpc).
-- Already applied to the Supabase project; kept here for reference / to recreate it.
--
-- Safety:
--  * SECURITY INVOKER: runs with the signed-in user's own rights, so the select-only RLS
--    policies on yield / pesticides / rainfall / temp still apply (no writes possible).
--  * Only one SELECT or WITH statement; it is wrapped as a subquery, which also blocks
--    INSERT/UPDATE/DELETE hidden inside a WITH clause.
--  * Max 1001 rows returned; Supabase's 8s statement_timeout for `authenticated` caps run time.
--  * Only the `authenticated` role can call it (not anonymous visitors).

create or replace function public.run_quiz_sql(query text)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  q text := regexp_replace(query, '[;[:space:]]+$', '');   -- drop trailing semicolons/whitespace
  bare text;                                              -- query without -- comments, for checks
  result json;
begin
  bare := regexp_replace(regexp_replace(q, '--[^\n]*', '', 'g'), '^[[:space:]]+', '');

  if bare = '' then
    raise exception 'Query is empty.';
  end if;
  if position(';' in q) > 0 then
    raise exception 'Only one statement is allowed (remove the semicolon in the middle).';
  end if;
  if lower(bare) !~ '^(select|with)[[:space:](]' then
    raise exception 'Only SELECT or WITH queries are allowed.';
  end if;

  -- The newline before ")" keeps a trailing -- comment from swallowing the wrapper.
  execute format(
    E'select coalesce(json_agg(t), ''[]''::json) from (select * from (%s\n) s limit 1001) t', q)
  into result;
  return result;
end;
$$;

revoke all on function public.run_quiz_sql(text) from public, anon;
grant execute on function public.run_quiz_sql(text) to authenticated;
