create or replace function public.normalize_interpretation_output_v2(p_result jsonb,p_analysis jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare
  v_out jsonb:='[]'::jsonb; v_i jsonb; v_pred jsonb; v_lh int; v_ops jsonb; v_opidx jsonb; v_members jsonb; v_member_surfaces jsonb; v_family_counts jsonb;
begin
  if coalesce(p_result->>'status','')='gated_invalid' then return p_result; end if;
  for v_i in select x from jsonb_array_elements(coalesce(p_result->'interpretations','[]'::jsonb)) x loop
    if v_i->>'family'='finite_predication' and v_i->>'finiteness'<>'finite' then
      continue;
    elsif v_i->>'family'='modal_structure' then
      select p into v_pred from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicates}','[]'::jsonb)) p where p->>'id'=v_i->>'predicate_id' limit 1;
      v_lh:=nullif(v_pred->>'lexical_head_token_index','')::int;
      v_members:=coalesce(v_pred->'member_token_indices','[]'::jsonb);
      select coalesce(jsonb_agg(to_jsonb(idx) order by idx),'[]'::jsonb), coalesce(jsonb_agg(t->>'surface' order by idx),'[]'::jsonb)
      into v_opidx,v_ops
      from (select value::int idx from jsonb_array_elements_text(v_members)) m
      left join lateral (select z t from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) z where nullif(z->>'token_index','')::int=m.idx limit 1) tt on true
      where m.idx<>v_lh;
      select coalesce(jsonb_agg(t->>'surface' order by idx),'[]'::jsonb)
      into v_member_surfaces
      from (select value::int idx from jsonb_array_elements_text(v_members)) m
      left join lateral (select z t from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) z where nullif(z->>'token_index','')::int=m.idx limit 1) tt on true;
      v_i:=jsonb_set(v_i,'{value}',(v_i->'value') - 'operator_order' - 'operator_count' || jsonb_build_object(
        'modal_operator_order',v_ops,'modal_operator_token_indices',v_opidx,'modal_operator_count',jsonb_array_length(v_ops),
        'predicate_member_order',v_member_surfaces,'lexical_head_token_index',v_lh
      ),true);
      v_out:=v_out||jsonb_build_array(v_i);
    else
      v_out:=v_out||jsonb_build_array(v_i);
    end if;
  end loop;
  select coalesce(jsonb_object_agg(f,c),'{}'::jsonb) into v_family_counts
  from (select x->>'family' f,count(*) c from jsonb_array_elements(v_out) x group by 1) q;
  return jsonb_set(jsonb_set(jsonb_set(p_result,'{interpretations}',v_out,true),'{summary,resolved_count}',to_jsonb(jsonb_array_length(v_out)),true),'{summary,family_counts}',v_family_counts,true);
end;
$function$;
