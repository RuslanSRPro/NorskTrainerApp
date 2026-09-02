create or replace function public.validate_runtime_child_release_inheritance_v1(p_child_code text)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare p_parent text;
begin
  select metadata->>'parent_release' into p_parent from public.grammar_runtime_releases where code=p_child_code;
  if p_parent is null then return jsonb_build_object('valid',false,'status','parent_release_missing','child',p_child_code); end if;
  return public.validate_runtime_child_release_inheritance_v1(p_child_code,p_parent);
end;
$$;
create or replace function public.validate_runtime_materialized_fact_inheritance_v1(p_child_code text)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare p_parent text;
begin
  select metadata->>'parent_release' into p_parent from public.grammar_runtime_releases where code=p_child_code;
  if p_parent is null then return jsonb_build_object('valid',false,'status','parent_release_missing','child',p_child_code); end if;
  return public.validate_runtime_materialized_fact_inheritance_v1(p_child_code,p_parent);
end;
$$;
