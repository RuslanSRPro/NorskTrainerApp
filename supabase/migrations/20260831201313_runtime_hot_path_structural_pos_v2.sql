do $$
declare d text; repl text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='collect_structural_pos_evidence_v1' limit 1;
 d:=replace(d,'collect_structural_pos_evidence_v1(p_analysis jsonb, p_release_code text)','collect_structural_pos_evidence_v2(p_analysis jsonb, p_release_code text)');
 repl := 'select nullif(public.runtime_source_fact_v1(''verb.modal_auxiliary.bare_infinitive'')->''payload'',''{}''::jsonb) into v_modal_source;'
      || chr(10)||chr(10) ||
      '  select nullif(public.runtime_source_fact_v1(''verb.modal_auxiliary.core_profile'')->''payload'',''{}''::jsonb) into v_profile_source;'
      || chr(10)||chr(10) ||
      '  select jsonb_build_object(''rule_id'',r.id,''rule_code'',r.code,''constraint_strength'',r.result->>''constraint_strength'')';
 d:=regexp_replace(d,
   'select jsonb_build_object\(''candidate_id'',id,''candidate_code'',extracted_payload->>''candidate_code'',''source_section'',source_section,''verification_status'',status\)(.|[[:space:]])*?select jsonb_build_object\(''rule_id'',r\.id,''rule_code'',r\.code,''constraint_strength'',r\.result->>''constraint_strength''\)',
   repl,'i');
 if position('grammar_knowledge_candidates' in d)>0 then raise exception 'structural pos v2 still references source graph'; end if;
 execute d;
end $$;

do $$ declare d text; begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_structural_pos_refinement_v1' limit 1;
 d:=replace(d,'resolve_structural_pos_refinement_v1(p_analysis jsonb, p_release_code text)','resolve_structural_pos_refinement_v2(p_analysis jsonb, p_release_code text)');
 d:=replace(d,'public.collect_structural_pos_evidence_v1(p_analysis,p_release_code)','public.collect_structural_pos_evidence_v2(p_analysis,p_release_code)');
 d:=replace(d,'''structural-pos-refinement-v1''','''structural-pos-refinement-v2'''); execute d; end $$;

create or replace function public.apply_structural_pos_refinement_v2(p_analysis jsonb,p_release_code text)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare v_layer jsonb; v_graph jsonb:=coalesce(p_analysis->'language_graph','{}'::jsonb);
begin v_layer:=public.resolve_structural_pos_refinement_v2(p_analysis,p_release_code); v_graph:=jsonb_set(v_graph,'{structural_pos_v1}',v_layer,true); return jsonb_set(p_analysis,'{language_graph}',v_graph,true); end;
$$;

do $$ declare d text; begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_v32' limit 1;
 d:=replace(d,'public.analyze_text_structural_shadow_v4(p_text,p_release_code)','public.analyze_text_structural_shadow_v32_morph(p_text,p_release_code)');
 d:=replace(d,'public.apply_structural_pos_refinement_v1(a,p_release_code)','public.apply_structural_pos_refinement_v2(a,p_release_code)'); execute d; end $$;
