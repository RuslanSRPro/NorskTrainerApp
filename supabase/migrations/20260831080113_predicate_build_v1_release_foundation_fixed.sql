do $migration$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
  v_sources jsonb;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.9';
  if v_parent.id is null or v_parent.status<>'shadow' then raise exception 'Parent runtime-structural-v1.9 must exist in shadow'; end if;
  if exists(select 1 from public.grammar_runtime_releases where code='runtime-structural-v1.10') then raise exception 'runtime-structural-v1.10 already exists'; end if;
  select coalesce(jsonb_object_agg(candidate_code,snapshot),'{}'::jsonb) into v_sources from (
    select distinct on (extracted_payload->>'candidate_code') extracted_payload->>'candidate_code' candidate_code,
      jsonb_build_object('candidate_id',id,'candidate_code',extracted_payload->>'candidate_code','source_section',source_section,'verification_status',status,'title',title) snapshot
    from public.grammar_knowledge_candidates
    where status in ('verified','source_verified') and extracted_payload->>'candidate_code' in (
      'verb.phrase.predicate','verb.phrase.head.finite','verb.phrase.simple_compound','verb.form.finite.predicate_head',
      'verb.form.finite.auxiliary_compound','verb.compound_form.semantic_unit_predicate','verb.compound_form.finite_aux_nonfinite_main',
      'verb.auxiliary.complement.nonfinite_main','verb.modal_auxiliary.chain','verb.modal_auxiliary.chain.finiteness',
      'grammar.foundations.phrase.copula_predicative_link','grammar.foundations.sentence.finite_predicate',
      'grammar.foundations.sentence.subject_predicate_core','verb.infinitive.construction_head'
    ) order by extracted_payload->>'candidate_code', verified_at desc nulls last, id
  ) q;
  insert into public.grammar_runtime_releases(code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,manifest_count,rule_count,checksum,metadata)
  values('runtime-structural-v1.10',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v10',v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,null,
    v_parent.metadata||jsonb_build_object('purpose','Predicate Build V1','parent_release','runtime-structural-v1.9','next_layer','Clause Build V1','child_only_rules',0,'parent_runtime_unchanged',true,
      'predicate_build_contract','predicate-build-v1','authoritative_output','document_graph.sentences[].analysis.language_graph.predicate_build_v1.predicates',
      'hypothesis_output','document_graph.sentences[].analysis.language_graph.predicate_build_v1.predicate_hypotheses',
      'blocked_output','document_graph.sentences[].analysis.language_graph.predicate_build_v1.blocked_predicates','predicate_build_compiled_sources',v_sources,
      'supported_predicate_kinds',jsonb_build_array('simple_verbal','modal_compound','modal_chain','auxiliary_compound','copular','nonfinite_infinitive'),
      'deferred_predicate_capabilities',jsonb_build_array('passive_predicate_recovery','modal_ellipsis_recovery','semantic_head_roles','valency_frames','argument_structure','semantic_roles'),'rules_active',false))
  returning id into v_child_id;
  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata from public.grammar_runtime_release_rules where release_id=v_parent.id;
  update public.grammar_runtime_releases set checksum=md5('runtime-structural-v1.10|'||coalesce(v_parent.checksum,'')||'|predicate-build-v1|'||v_sources::text) where id=v_child_id;
end;
$migration$;

create or replace function public.predicate_build_contract_v1() returns jsonb language sql immutable security invoker set search_path='' as $function$
select jsonb_build_object('version','predicate-build-v1','input_layers',jsonb_build_array('construction_resolution_v1','construction_recognition_v1','phrase_build_v1','structural_pos_v1','morphology_v1','legacy finite clause anchors'),
'authoritative_output','language_graph.predicate_build_v1.predicates','hypothesis_output','language_graph.predicate_build_v1.predicate_hypotheses','blocked_output','language_graph.predicate_build_v1.blocked_predicates',
'predicate_kinds',jsonb_build_array('simple_verbal','modal_compound','modal_chain','auxiliary_compound','copular','nonfinite_infinitive'),'finiteness',jsonb_build_array('finite','nonfinite'),
'head_model',jsonb_build_object('finite_token_index','finite grammatical member when present','grammatical_head_token_index','finite verbal head for finite predicates; lexical verb for nonfinite predicates','lexical_head_token_index','lexical main verb where construction evidence supplies one','predicative_complement_token_index','copular complement where present'),
'policy',jsonb_build_array('resolved Construction Resolution groups produce authoritative predicates','unresolved construction groups produce predicate hypotheses rather than authoritative predicates','blocked groups produce blocked_predicates and suppress false simple finite fallback on the same finite anchor','a finite clause anchor not covered by a construction group produces a simple_verbal predicate','marked infinitive constructions produce nonfinite predicate units independently of the matrix finite predicate','compatible construction components are folded into the selected composite predicate instead of becoming duplicate predicates','legacy language_graph clauses and phrase outputs are immutable compatibility inputs'),
'statuses',jsonb_build_array('resolved','hypothesis','blocked'),'non_goals',jsonb_build_array('subject attachment','argument structure','valency','semantic roles','clause rebuilding','passive recovery','ellipsis recovery','tense/aspect interpretation','modal scope'),
'architecture_closed_criterion','New known resolved construction families map to common predicate head/member roles without mutating Construction Resolution or legacy clause logic.');
$function$;

create or replace function public.predicate_build_source_v1(p_release_code text,p_candidate_code text) returns jsonb language sql stable security invoker set search_path='public','pg_catalog' as $function$
select coalesce(r.metadata#>array['predicate_build_compiled_sources',p_candidate_code],'{}'::jsonb) from public.grammar_runtime_releases r where r.code=p_release_code;
$function$;

create or replace function public.predicate_build_construction_by_id_v1(p_analysis jsonb,p_id text) returns jsonb language sql immutable security invoker set search_path='' as $function$
select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,construction_recognition_v1,constructions}','[]'::jsonb)) x where x->>'id'=p_id limit 1;
$function$;

create or replace function public.predicate_build_token_by_index_v1(p_analysis jsonb,p_idx integer) returns jsonb language sql immutable security invoker set search_path='' as $function$
select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) x where nullif(x->>'token_index','')::integer=p_idx limit 1;
$function$;

create or replace function public.predicate_build_surface_v1(p_analysis jsonb,p_indices jsonb) returns text language sql immutable security invoker set search_path='' as $function$
select string_agg(t->>'surface',' ' order by (t->>'token_index')::integer) from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) t
where (t->>'token_index')::integer in (select e.value::integer from jsonb_array_elements_text(coalesce(p_indices,'[]'::jsonb)) e(value));
$function$;

create or replace function public.predicate_build_group_member_indices_v1(p_analysis jsonb,p_group jsonb) returns jsonb language sql immutable security invoker set search_path='' as $function$
select coalesce(jsonb_agg(to_jsonb(s.i) order by s.i),'[]'::jsonb) from (
  select distinct idx.value::integer i
  from jsonb_array_elements_text(coalesce(p_group->'construction_ids','[]'::jsonb)) cid(value)
  cross join lateral jsonb_array_elements_text(coalesce((public.predicate_build_construction_by_id_v1(p_analysis,cid.value))->'member_token_indices','[]'::jsonb)) idx(value)
) s;
$function$;

create or replace function public.predicate_build_finite_index_v1(p_analysis jsonb,p_start integer,p_end integer) returns integer language sql immutable security invoker set search_path='' as $function$
select nullif(c->>'finite_token_index','')::integer from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clauses}','[]'::jsonb)) c
where nullif(c->>'finite_token_index','')::integer between p_start and p_end order by nullif(c->>'finite_token_index','')::integer limit 1;
$function$;

create or replace function public.predicate_build_last_verb_index_v1(p_analysis jsonb,p_indices jsonb) returns integer language sql immutable security invoker set search_path='' as $function$
select max(s.i) from (select e.value::integer i from jsonb_array_elements_text(coalesce(p_indices,'[]'::jsonb)) e(value)) s
where public.construction_recognition_refined_pos_v1(p_analysis,s.i)='verb';
$function$;
