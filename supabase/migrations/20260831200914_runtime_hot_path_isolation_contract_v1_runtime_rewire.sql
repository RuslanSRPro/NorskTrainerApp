do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='build_subordinate_clause_foundation_v1' limit 1;
  d:=replace(d,'build_subordinate_clause_foundation_v1(p_sentence jsonb)','build_subordinate_clause_foundation_v2(p_sentence jsonb, p_release_code text)');
  d:=replace(d,'subordinate_connector_match_v1(tok)','subordinate_connector_match_v2(tok,p_release_code)');
  d:=replace(d,'subordinate_connector_match_v1(x)','subordinate_connector_match_v2(x,p_release_code)');
  d:=replace(d,'subordinate_connector_inventory_v1()','subordinate_connector_inventory_v2(p_release_code)');
  d:=replace(d,'''subordinate-clause-foundation-v1''','''subordinate-clause-foundation-v2''');
  execute d;
end $$;

create or replace function public.apply_subordinate_clause_foundation_v2(p_doc jsonb,p_release_code text)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare s jsonb; outa jsonb:='[]'::jsonb; layer jsonb; cs jsonb; c jsonb; members jsonb;
begin
 for s in select value from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences}','[]'::jsonb)) loop
   layer:=public.build_subordinate_clause_foundation_v2(s,p_release_code); cs:='[]'::jsonb;
   for c in select value from jsonb_array_elements(coalesce(layer->'clauses','[]'::jsonb)) loop
     select coalesce(jsonb_agg(v order by v),'[]'::jsonb) into members from (select distinct (x.value)::text::int v from jsonb_array_elements_text(coalesce(c->'member_token_indices','[]'::jsonb)) x(value)) q;
     c:=jsonb_set(c,'{member_token_indices}',members,true); cs:=cs||jsonb_build_array(c);
   end loop;
   layer:=jsonb_set(layer,'{clauses}',cs,true);
   s:=jsonb_set(s,'{analysis,language_graph,subordinate_clause_foundation_v2}',layer,true);
   outa:=outa||jsonb_build_array(s);
 end loop;
 return jsonb_set(p_doc,'{document_graph,sentences}',outa,true);
end;
$$;

do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_v30' limit 1;
  d:=replace(d,'analyze_text_structural_shadow_v30(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.30''::text)','analyze_text_structural_shadow_v32(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.32''::text)');
  d:=replace(d,'d:=public.apply_pedagogical_projection_v1(d,p_release_code); d:=public.apply_rule_execution_pilot_v1(d,p_release_code);','d:=public.apply_pedagogical_projection_v1(d,p_release_code);');
  d:=replace(d,'d:=public.apply_rule_execution_plane_v1(d,p_release_code); d:=public.apply_representative_rule_suite_v1(d,''representative-rule-suite-v1''); d:=public.apply_compiler_execution_closure_v2(d,p_release_code);','d:=public.apply_rule_execution_plane_v1(d,p_release_code);');
  d:=replace(d,'d:=public.apply_upstream_capability_closure_v1(d); d:=public.apply_subordinate_clause_foundation_v1(d);','d:=public.apply_upstream_capability_closure_v1(d); d:=public.apply_subordinate_clause_foundation_v2(d,p_release_code);');
  d:=replace(d,'''grammar-structural-shadow-v30''','''grammar-structural-shadow-v32''');
  execute d;
end $$;

create or replace function public.augment_runtime_document_with_offline_diagnostics_v1(p_doc jsonb,p_release_code text)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare d jsonb:=p_doc;
begin
 d:=public.apply_rule_execution_pilot_v1(d,p_release_code);
 d:=public.apply_representative_rule_suite_v1(d,'representative-rule-suite-v1');
 d:=public.apply_compiler_execution_closure_v2(d,p_release_code);
 return d;
end;
$$;

create or replace function public.runtime_hot_path_isolation_summary_v1(p_release_code text default 'runtime-structural-v1.32')
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
select jsonb_build_object(
 'version','runtime-hot-path-isolation-summary-v1',
 'release_code',p_release_code,
 'contract',public.runtime_hot_path_contract_v1(),
 'hot_path_audit',public.runtime_hot_path_isolation_audit_v1('analyze_text_structural_shadow_v32',64),
 'diagnostic_path_audit',public.runtime_hot_path_isolation_audit_v1('augment_runtime_document_with_offline_diagnostics_v1',64),
 'runtime_overlay',public.subordinate_connector_inventory_v2(p_release_code),
 'source_graph_hash',public.grammar_source_graph_semantic_hash_v1(),
 'inheritance',public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.31')
);
$$;
