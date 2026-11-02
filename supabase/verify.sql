-- Run in Supabase SQL Editor after 001_progress.sql.
-- Every result in the final column must be true.
select 'public summary readable by visitors' as check_name,
       has_any_column_privilege('anon', 'public.mltraining_public', 'select') as pass
union all
select 'private state not readable by visitors',
       not has_any_column_privilege('anon', 'public.mltraining_private', 'select')
union all
select 'visitors cannot update private state',
       not has_table_privilege('anon', 'public.mltraining_private', 'update')
union all
select 'visitors cannot execute save',
       not has_function_privilege('anon', 'public.mltraining_save(jsonb,jsonb,bigint)', 'execute')
union all
select 'authenticated users can call save (owner checked inside)',
       has_function_privilege('authenticated', 'public.mltraining_save(jsonb,jsonb,bigint)', 'execute')
union all
select 'RLS enabled on private state',
       (select relrowsecurity from pg_class where oid = 'public.mltraining_private'::regclass)
union all
select 'RLS enabled on public summary',
       (select relrowsecurity from pg_class where oid = 'public.mltraining_public'::regclass)
union all
select 'RLS enabled on backups',
       (select relrowsecurity from pg_class where oid = 'public.mltraining_backups'::regclass);
