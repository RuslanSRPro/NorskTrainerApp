create or replace function public.runtime_release_lexical_class_codes_v2(p_release_code text)
returns table(class_code text,relevance_sources text[]) language sql stable set search_path to 'public','pg_catalog' as $$
with rel as (select id from public.grammar_runtime_releases where code=p_release_code), refs as (
 select distinct t.trigger_key class_code,'trigger'::text relevance_source from rel join public.grammar_runtime_release_rules rr on rr.release_id=rel.id and rr.is_enabled join public.grammar_rule_triggers t on t.rule_id=rr.rule_id and t.is_active and t.trigger_type='lexical_class'
 union all
 select distinct f.fact_key,'dependency_snapshot'::text from rel join public.grammar_runtime_release_dependency_facts_v1 f on f.release_id=rel.id and f.is_enabled and f.fact_type='lexical_class_dependency'
)
select class_code,array_agg(distinct relevance_source order by relevance_source)::text[] from refs group by class_code order by class_code;
$$;

do $$ declare d text; begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_grammar_lexical_classes_v1' limit 1;
 d:=replace(d,'resolve_grammar_lexical_classes_v1(p_normalized text, p_surface_candidates jsonb DEFAULT ''[]''::jsonb, p_release_code text DEFAULT NULL::text)','resolve_grammar_lexical_classes_v2(p_normalized text, p_surface_candidates jsonb DEFAULT ''[]''::jsonb, p_release_code text DEFAULT NULL::text)');
 d:=replace(d,'public.runtime_release_lexical_class_codes_v1','public.runtime_release_lexical_class_codes_v2'); execute d; end $$;

do $$ declare d text; begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_token_grammar_lexical_classes_v1' limit 1;
 d:=replace(d,'resolve_token_grammar_lexical_classes_v1(p_normalized text, p_surface_candidates jsonb DEFAULT ''[]''::jsonb, p_release_code text DEFAULT NULL::text)','resolve_token_grammar_lexical_classes_v2(p_normalized text, p_surface_candidates jsonb DEFAULT ''[]''::jsonb, p_release_code text DEFAULT NULL::text)');
 d:=replace(d,'public.resolve_grammar_lexical_classes_v1','public.resolve_grammar_lexical_classes_v2'); execute d; end $$;

do $$ declare d text; begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='build_shadow_token_lexical_v1' limit 1;
 d:=replace(d,'build_shadow_token_lexical_v1(p_token_index integer, p_surface text, p_normalized text, p_prev_token text, p_next_token text, p_release_id uuid)','build_shadow_token_lexical_v2(p_token_index integer, p_surface text, p_normalized text, p_prev_token text, p_next_token text, p_release_id uuid)');
 d:=replace(d,'public.resolve_token_grammar_lexical_classes_v1','public.resolve_token_grammar_lexical_classes_v2');
 d:=replace(d,'''lexical-class-resolver-v1''','''lexical-class-resolver-v2'''); execute d; end $$;

do $$ declare d text; begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='build_structural_token_v1' limit 1;
 d:=replace(d,'build_structural_token_v1(p_token_index integer, p_surface text, p_normalized text, p_prev_token text, p_next_token text, p_release_id uuid)','build_structural_token_v2(p_token_index integer, p_surface text, p_normalized text, p_prev_token text, p_next_token text, p_release_id uuid)');
 d:=replace(d,'public.build_shadow_token_lexical_v1','public.build_shadow_token_lexical_v2'); execute d; end $$;

do $$ declare d text; begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='analyze_text_structural_shadow_core_v32' limit 1;
 d:=replace(d,'public.build_structural_token_v1','public.build_structural_token_v2'); execute d; end $$;
