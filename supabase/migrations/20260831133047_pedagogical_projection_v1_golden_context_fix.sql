create or replace function public.run_pedagogical_projection_golden_v1(p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_results jsonb := '[]'::jsonb;
  v_case jsonb;
  v_doc jsonb;
  v_p jsonb;
  v_pass boolean;
  v_batch uuid := gen_random_uuid();
begin
  for v_case in select * from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('code','simple_present_primary','text','Han reiser.','check','simple_present'),
    jsonb_build_object('code','simple_preterite_primary','text','Han gikk.','check','simple_preterite'),
    jsonb_build_object('code','present_perfect_primary','text','Han har gått.','check','present_perfect'),
    jsonb_build_object('code','preterite_perfect_primary','text','Han hadde gått.','check','preterite_perfect'),
    jsonb_build_object('code','modal_compound_primary','text','Han kan ringe.','check','modal'),
    jsonb_build_object('code','modal_chain_roles','text','Han vil kunne gå.','check','modal_chain'),
    jsonb_build_object('code','copular_primary','text','Han er lærer.','check','copular'),
    jsonb_build_object('code','marked_infinitive_primary','text','Jeg liker å lese.','check','infinitive'),
    jsonb_build_object('code','unresolved_no_learning_points','text','Han er sky.','check','unresolved'),
    jsonb_build_object('code','passive_blocker_no_learning_points','text','Han blir rost.','check','unresolved_blocker'),
    jsonb_build_object('code','blocked_no_learning_points','text','Han skal hjem.','check','blocked'),
    jsonb_build_object('code','no_predicate_sentence_ready','text','Hei.','check','empty_ready'),
    jsonb_build_object('code','topic_ids_present','text','Han har gått.','check','topic_ids'),
    jsonb_build_object('code','uk_missing_explicit','text','Han har gått.','check','uk_missing'),
    jsonb_build_object('code','no_ru_fallback_for_uk','text','Han har gått.','check','no_uk_fallback'),
    jsonb_build_object('code','technical_trace_hidden','text','Han kan ringe.','check','trace_hidden'),
    jsonb_build_object('code','no_natural_language_generated','text','Han can ringe.','check','no_nlg'),
    jsonb_build_object('code','no_learner_error_claims_valid','text','Han kan ringe.','check','no_error_claim'),
    jsonb_build_object('code','no_learner_error_claims_unresolved','text','Han er sky.','check','no_error_claim'),
    jsonb_build_object('code','learning_progress_not_bound','text','Han kan ringe.','check','no_progress_binding'),
    jsonb_build_object('code','source_provenance_present','text','Han kan ringe.','check','provenance'),
    jsonb_build_object('code','subject_predicate_supporting','text','Han kan ringe.','check','subject_predicate'),
    jsonb_build_object('code','perfect_tense_supporting','text','Han har gått.','check','perfect_tense_supporting'),
    jsonb_build_object('code','modal_tense_supporting','text','Han kan ringe.','check','modal_tense_supporting'),
    jsonb_build_object('code','infinitive_highlight_exact','text','Jeg liker å lese.','check','infinitive_highlight'),
    jsonb_build_object('code','copular_highlight_exact','text','Han er lærer.','check','copular_highlight'),
    jsonb_build_object('code','perfect_highlight_exact','text','Han har gått.','check','perfect_highlight'),
    jsonb_build_object('code','sentence_model_immutable','text','Han vil kunne gå.','check','sentence_model_immutable'),
    jsonb_build_object('code','interpretation_immutable','text','Han vil kunne gå.','check','interpretation_immutable'),
    jsonb_build_object('code','multi_sentence_isolation','text','Han kan ringe. Jeg liker å lese.','check','multi_sentence'),
    jsonb_build_object('code','multi_sentence_topic_separation','text','Han kan ringe. Jeg liker å lese.','check','multi_topic'),
    jsonb_build_object('code','unresolved_reason_preserved','text','Han er sky.','check','unresolved_reason'),
    jsonb_build_object('code','blocked_reason_preserved','text','Han skal hjem.','check','blocked_reason'),
    jsonb_build_object('code','runtime_release_code','text','Han kan ringe.','check','release_code'),
    jsonb_build_object('code','deterministic_projection','text','Han kan ringe.','check','deterministic'),
    jsonb_build_object('code','no_child_grammar_claims','text','Han can ringe.','check','contract_only')
  )) loop
    v_doc := public.analyze_text_structural_shadow_v16(v_case->>'text',p_release_code);
    v_p := v_doc#>'{document_graph,sentences,0,analysis,language_graph,pedagogical_projection_v1}';
    v_pass := case v_case->>'check'
      when 'simple_present' then v_p->>'status'='ready' and exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='present' and x->>'focus_level'='primary')
      when 'simple_preterite' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='preterite' and x->>'focus_level'='primary')
      when 'present_perfect' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='present_perfect' and x->>'focus_level'='primary')
      when 'preterite_perfect' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='preterite_perfect' and x->>'focus_level'='primary')
      when 'modal' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='modal_verbs' and x->>'focus_level'='primary')
      when 'modal_chain' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='modal_verbs' and x->'highlight_token_indices'='[2,3,4]'::jsonb and (select count(*) from jsonb_array_elements(x->'highlight_roles') r where r->>'role'='modal_chain')=2)
      when 'copular' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='copular_predication' and x#>>'{topic,topic_code}'='sentence.structure.predicative.fixed_subject.copula')
      when 'infinitive' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='marked_infinitive' and x->>'focus_level'='primary')
      when 'unresolved' then v_p->>'status'='limited' and jsonb_array_length(v_p->'learning_points')=0 and v_p#>>'{analysis_notices,0,code}'='analysis_unresolved'
      when 'unresolved_blocker' then v_p->>'status'='limited' and jsonb_array_length(v_p->'learning_points')=0 and (v_p#>'{analysis_notices,0,reason_codes}') @> '["blocked_competitor_overlap"]'::jsonb
      when 'blocked' then v_p->>'status'='blocked' and jsonb_array_length(v_p->'learning_points')=0 and v_p#>>'{analysis_notices,0,code}'='analysis_capability_limited'
      when 'empty_ready' then v_p->>'status'='ready' and jsonb_array_length(v_p->'learning_points')=0 and jsonb_array_length(v_p->'analysis_notices')=0
      when 'topic_ids' then not exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where coalesce(x#>>'{topic,topic_id}','')='')
      when 'uk_missing' then (v_p#>>'{summary,uk_localization_missing_count}')::int=jsonb_array_length(v_p->'learning_points')
      when 'no_uk_fallback' then not exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x#>'{topic,title_uk}' is distinct from 'null'::jsonb)
      when 'trace_hidden' then not exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where coalesce((x->>'technical_trace_visible_default')::boolean,true))
      when 'no_nlg' then (v_p#>>'{summary,natural_language_explanations_generated}')::int=0
      when 'no_error_claim' then (v_p#>>'{summary,learner_error_claims}')::int=0 and not exists(select 1 from jsonb_array_elements(v_p->'analysis_notices') x where coalesce((x->>'grammar_error_claim')::boolean,false))
      when 'no_progress_binding' then v_p#>>'{personalization_hooks,current_progress_binding}'='none_v1' and v_p#>>'{personalization_hooks,personalized_ranking_status}'='deferred'
      when 'provenance' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='modal_verbs' and jsonb_array_length(x->'source_candidate_codes')>=3)
      when 'subject_predicate' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='subject_predicate' and x->>'focus_level'='supporting')
      when 'perfect_tense_supporting' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='present' and x->>'focus_level'='supporting')
      when 'modal_tense_supporting' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='present' and x->>'focus_level'='supporting')
      when 'infinitive_highlight' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='marked_infinitive' and x->'highlight_token_indices'='[3,4]'::jsonb)
      when 'copular_highlight' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='copular_predication' and x->'highlight_token_indices'='[1,2,3]'::jsonb)
      when 'perfect_highlight' then exists(select 1 from jsonb_array_elements(v_p->'learning_points') x where x->>'concept_code'='present_perfect' and x->'highlight_token_indices'='[2,3]'::jsonb)
      when 'sentence_model_immutable' then (public.analyze_text_structural_shadow_v15(v_case->>'text',p_release_code)#>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}')=(v_doc#>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}')
      when 'interpretation_immutable' then (public.analyze_text_structural_shadow_v15(v_case->>'text',p_release_code)#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2}')=(v_doc#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2}')
      when 'multi_sentence' then jsonb_array_length(v_doc#>'{document_graph,sentences}')=2 and v_doc#>>'{document_graph,sentences,0,analysis,language_graph,pedagogical_projection_v1,status}'='ready' and v_doc#>>'{document_graph,sentences,1,analysis,language_graph,pedagogical_projection_v1,status}'='ready'
      when 'multi_topic' then (v_doc#>'{document_graph,sentences,0,analysis,language_graph,pedagogical_projection_v1,personalization_hooks,concept_codes}') @> '["modal_verbs"]'::jsonb and (v_doc#>'{document_graph,sentences,1,analysis,language_graph,pedagogical_projection_v1,personalization_hooks,concept_codes}') @> '["marked_infinitive"]'::jsonb
      when 'unresolved_reason' then (v_p#>'{analysis_notices,0,reason_codes}') @> '["recognition_hypothesis_requires_discriminating_evidence"]'::jsonb
      when 'blocked_reason' then (v_p#>'{analysis_notices,0,reason_codes}') @> '["ellipsis_recovery_not_in_construction_recognition_v1"]'::jsonb
      when 'release_code' then v_p->>'release_code'=p_release_code
      when 'deterministic' then v_p=(public.analyze_text_structural_shadow_v16(v_case->>'text',p_release_code)#>'{document_graph,sentences,0,analysis,language_graph,pedagogical_projection_v1}')
      when 'contract_only' then (select count(*) from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id where r.code=p_release_code)=(select rule_count from public.grammar_runtime_releases where code=p_release_code)
      else false end;
    v_results := v_results || jsonb_build_array(jsonb_build_object('code',v_case->>'code','passed',v_pass));
  end loop;
  return jsonb_build_object('version','pedagogical-projection-golden-v1','batch_id',v_batch,'total',jsonb_array_length(v_results),
    'passed',(select count(*) from jsonb_array_elements(v_results) x where (x->>'passed')::boolean),
    'failed',(select count(*) from jsonb_array_elements(v_results) x where not (x->>'passed')::boolean),
    'failures',coalesce((select jsonb_agg(x) from jsonb_array_elements(v_results) x where not (x->>'passed')::boolean),'[]'::jsonb));
end;
$function$;
