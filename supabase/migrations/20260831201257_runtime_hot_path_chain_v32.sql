do $$ declare d text; begin
select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_core_v2' limit 1;
d:=replace(d,'analyze_text_structural_shadow_core_v2(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.2''::text)','analyze_text_structural_shadow_core_v32_tokenized(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.32''::text)');
d:=replace(d,'public.analyze_text_structural_shadow_core_v1(v_structural_text,p_release_code)','public.analyze_text_structural_shadow_core_v32(v_structural_text,p_release_code)'); execute d; end $$;

do $$ declare d text; begin
select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_v2' limit 1;
d:=replace(d,'analyze_text_structural_shadow_v2(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.2''::text)','analyze_text_structural_shadow_v32_sentence(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.32''::text)');
d:=replace(d,'public.analyze_text_structural_shadow_core_v2(p_text,p_release_code)','public.analyze_text_structural_shadow_core_v32_tokenized(p_text,p_release_code)'); execute d; end $$;

do $$ declare d text; begin
select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_v3' limit 1;
d:=replace(d,'analyze_text_structural_shadow_v3(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.3''::text)','analyze_text_structural_shadow_v32_document(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.32''::text)');
d:=replace(d,'public.analyze_text_structural_shadow_v2(v_sentence.sentence_text,p_release_code)','public.analyze_text_structural_shadow_v32_sentence(v_sentence.sentence_text,p_release_code)'); execute d; end $$;

do $$ declare d text; begin
select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_v4' limit 1;
d:=replace(d,'analyze_text_structural_shadow_v4(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.4''::text)','analyze_text_structural_shadow_v32_morph(p_text text, p_release_code text DEFAULT ''runtime-structural-v1.32''::text)');
d:=replace(d,'public.analyze_text_structural_shadow_v3(p_text,p_release_code)','public.analyze_text_structural_shadow_v32_document(p_text,p_release_code)'); execute d; end $$;
