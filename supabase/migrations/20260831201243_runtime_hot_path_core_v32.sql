do $$
declare d text; repl text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_core_v1' limit 1;
  d:=replace(d,'analyze_text_structural_shadow_core_v1(p_text text, p_release_code text DEFAULT ''runtime-structural-v1''::text)','analyze_text_structural_shadow_core_v32(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.32''::text)');
  repl := 'SELECT f.fact_key INTO v_article_class FROM public.grammar_runtime_release_dependency_facts_v1 f WHERE f.release_id=v_release_id AND f.fact_type=''structural_core_article_class'' AND f.is_enabled ORDER BY f.fact_key LIMIT 1;'
       || chr(10)||chr(10) ||
       '  SELECT f.fact_key INTO v_subject_class FROM public.grammar_runtime_release_dependency_facts_v1 f WHERE f.release_id=v_release_id AND f.fact_type=''structural_core_subject_class'' AND f.is_enabled ORDER BY f.fact_key LIMIT 1;'
       || chr(10)||chr(10) ||
       '  SELECT t.trigger_key INTO v_connector_class';
  d:=regexp_replace(d,'SELECT d\.value[[:space:]]+INTO v_article_class(.|[[:space:]])*?SELECT t\.trigger_key[[:space:]]+INTO v_connector_class',repl,'i');
  if position('grammar_runtime_manifests' in d)>0 then raise exception 'core_v32 still references manifests'; end if;
  execute d;
end $$;
