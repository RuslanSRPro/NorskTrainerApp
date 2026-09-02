create or replace function public.predicate_build_group_member_indices_v1(p_analysis jsonb,p_group jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select coalesce(jsonb_agg(to_jsonb(s.i) order by s.i),'[]'::jsonb)
from (
  select distinct idx.value::integer i
  from jsonb_array_elements_text(coalesce(p_group->'construction_ids','[]'::jsonb)) cid(value)
  cross join lateral jsonb_array_elements_text(coalesce((public.predicate_build_construction_by_id_v1(p_analysis,cid.value))->'member_token_indices','[]'::jsonb)) idx(value)
  union
  select distinct idx2.value::integer i
  from jsonb_array_elements(coalesce(p_group->'blocked_events','[]'::jsonb)) be
  cross join lateral jsonb_array_elements_text(coalesce(be->'member_token_indices','[]'::jsonb)) idx2(value)
) s;
$function$;
