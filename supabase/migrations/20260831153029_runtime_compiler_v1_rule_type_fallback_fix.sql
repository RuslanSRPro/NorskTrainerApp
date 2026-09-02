create or replace function public.runtime_compiler_rule_type_v1(p_pattern_type text,p_manifest jsonb)
returns text
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare a jsonb; v_role text; v_action text;
begin
 case p_pattern_type
  when 'candidate_constraint' then return 'disambiguation';
  when 'phrase_pattern' then return 'construction';
  when 'dependency_pattern' then return 'dependency';
  when 'clause_pattern' then return 'clause';
  when 'feature_unification' then return 'agreement';
  when 'relative_order' then return 'word_order';
  else null;
 end case;
 if p_pattern_type='graph_pattern' then
   for a in select value from jsonb_array_elements(coalesce(p_manifest->'actions','[]'::jsonb)) loop
     v_action:=a->>'action'; v_role:=coalesce(a#>>'{value,role}',a->>'relation');
     if v_action='create_dependency' then return 'binding'; end if;
     if v_action='set_role' and v_role='predicate' then return 'construction'; end if;
     if v_action='set_role' and v_role='connector_field' then return 'clause'; end if;
     if v_action='set_role' and v_role='midfield_adverbial' then return 'interpretation'; end if;
   end loop;
   return 'construction';
 end if;
 return 'construction';
end;
$function$;
