create or replace function public.runtime_compiler_base_code_v1(p_manifest_code text)
returns text
language sql
immutable
security invoker
set search_path=''
as $function$
select 'nrg_rt_v1.'||case when left(p_manifest_code,3)='ir.' then substr(p_manifest_code,4) else p_manifest_code end;
$function$;
