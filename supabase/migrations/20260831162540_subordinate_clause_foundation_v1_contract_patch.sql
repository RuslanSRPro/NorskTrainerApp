create or replace function public.assess_runtime_rule_execution_v4(p_rule_id uuid)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare r record; base jsonb; st text; ready boolean; op text; branch text; closure text; blockers jsonb;
begin
 select gr.* into r from public.grammar_rules gr where gr.id=p_rule_id;
 if r.id is null then return jsonb_build_object('status','rule_not_found','rule_id',p_rule_id); end if;
 base:=public.assess_runtime_rule_execution_v3(p_rule_id);
 st:=base->>'execution_status'; ready:=coalesce((base->>'ready_without_runtime_code_change')::boolean,false);
 blockers:=coalesce(base->'upstream_blockers','[]'::jsonb);
 op:=coalesce(r.pattern->>'graph_operation',r.pattern->>'clause_operation'); branch:=r.pattern->>'branch_id'; closure:=base->>'upstream_closure';
 if r.pattern_type='clause_pattern' and op='assign_schema' and r.pattern->>'schema'='B' then
   st:='executable_via_subordinate_clause_foundation_v1'; ready:=true; closure:='subordinate-clause-foundation-v1'; blockers:='[]'::jsonb;
 elsif r.pattern_type='graph_pattern' and op='assign_field' and r.pattern->>'field'='f' then
   st:='executable_via_subordinate_clause_foundation_v1'; ready:=true; closure:='subordinate-clause-foundation-v1'; blockers:='[]'::jsonb;
 elsif r.pattern_type='relative_order' and branch='B' then
   st:='executable_via_subordinate_clause_foundation_v1'; ready:=true; closure:='subordinate-clause-foundation-v1'; blockers:='[]'::jsonb;
 end if;
 return base||jsonb_build_object(
   'version','runtime-rule-execution-assessment-v4','execution_status',st,'upstream_blockers',blockers,
   'ready_without_runtime_code_change',ready,'upstream_closure',closure
 );
end;
$$;

-- Canonicalize subordinate member indices in output without changing inference.
create or replace function public.apply_subordinate_clause_foundation_v1(p_doc jsonb)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare s jsonb; outa jsonb:='[]'::jsonb; layer jsonb; cs jsonb:='[]'::jsonb; c jsonb; members jsonb;
begin
 for s in select value from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences}','[]'::jsonb)) loop
   layer:=public.build_subordinate_clause_foundation_v1(s);
   cs:='[]'::jsonb;
   for c in select value from jsonb_array_elements(coalesce(layer->'clauses','[]'::jsonb)) loop
     select coalesce(jsonb_agg(v order by v),'[]'::jsonb) into members
     from (select distinct (x.value)::text::int as v from jsonb_array_elements_text(coalesce(c->'member_token_indices','[]'::jsonb)) x(value)) q;
     c:=jsonb_set(c,'{member_token_indices}',members,true);
     cs:=cs||jsonb_build_array(c);
   end loop;
   layer:=jsonb_set(layer,'{clauses}',cs,true);
   s:=jsonb_set(s,'{analysis,language_graph,subordinate_clause_foundation_v1}',layer,true);
   outa:=outa||jsonb_build_array(s);
 end loop;
 return jsonb_set(p_doc,'{document_graph,sentences}',outa,true);
end;
$$;
