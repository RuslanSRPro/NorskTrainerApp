create or replace function public.validate_grammar_rule_pattern_v2(p_pattern_type text, p_pattern jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path='public','pg_catalog'
as $$
begin
  if p_pattern_type <> 'morphological_inflection' then
    return public.validate_grammar_rule_pattern(p_pattern_type,p_pattern);
  end if;
  if p_pattern is null or jsonb_typeof(p_pattern)<>'object' or nullif(trim(p_pattern->>'morph_operation'),'') is null then
    return false;
  end if;
  if coalesce(p_pattern->>'composition_role','primary')='post_transform_adjustment' then
    return (not (p_pattern ? 'source_endings') or jsonb_typeof(p_pattern->'source_endings')='array')
       and (not (p_pattern ? 'suffix') or jsonb_typeof(p_pattern->'suffix')='string');
  end if;
  return nullif(trim(p_pattern->>'source_form_key'),'') is not null
    and nullif(trim(p_pattern->>'target_form_key'),'') is not null
    and (not (p_pattern ? 'source_endings') or jsonb_typeof(p_pattern->'source_endings')='array')
    and (not (p_pattern ? 'suffix') or jsonb_typeof(p_pattern->'suffix')='string');
end;
$$;
