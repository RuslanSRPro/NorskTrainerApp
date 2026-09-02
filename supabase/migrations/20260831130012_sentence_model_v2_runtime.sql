create or replace function public.build_sentence_model_v2(p_sentence jsonb,p_release_code text default 'runtime-structural-v1.15')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  a jsonb:=coalesce(p_sentence->'analysis','{}'::jsonb);
  lg jsonb:=coalesce(p_sentence#>'{analysis,language_graph}','{}'::jsonb);
  v_status text:=coalesce(p_sentence#>>'{analysis,language_graph,grammar_validation_v2,summary,overall_status}','incomplete');
  v_tokens jsonb; v_index jsonb; v_unresolved jsonb;
begin
  v_tokens:=public.sentence_model_token_projection_v2(p_sentence);
  v_index:=public.sentence_model_entity_index_v2(a);
  v_unresolved:=public.sentence_model_unresolved_index_v2(a);
  return jsonb_build_object(
    'version','sentence-model-v2','status',v_status,'release_code',p_release_code,
    'sentence',jsonb_build_object(
      'sentence_index',nullif(p_sentence->>'sentence_index','')::int,
      'text',p_sentence->>'text','is_complete',coalesce((p_sentence->>'is_complete')::boolean,false),
      'boundary_type',p_sentence->>'boundary_type','terminal_surface',p_sentence->'terminal_surface',
      'document_start_char',nullif(p_sentence->>'start_char','')::int,'document_end_char',nullif(p_sentence->>'end_char','')::int,
      'document_start_source_token_index',nullif(p_sentence->>'start_source_token_index','')::int,
      'document_end_source_token_index',nullif(p_sentence->>'end_source_token_index','')::int,
      'terminal_document_source_token_indices',coalesce(p_sentence->'terminal_source_token_indices','[]'::jsonb)
    ),
    'tokens',v_tokens,
    'syntax',jsonb_build_object(
      'phrases',coalesce(lg#>'{phrase_build_v1,resolved_phrases}','[]'::jsonb),
      'phrase_hypotheses',coalesce(lg#>'{phrase_build_v1,phrase_hypotheses}','[]'::jsonb),
      'constructions',coalesce(lg#>'{construction_recognition_v1,constructions}','[]'::jsonb),
      'construction_hypotheses',coalesce(lg#>'{construction_recognition_v1,hypotheses}','[]'::jsonb),
      'construction_resolution_groups',coalesce(lg#>'{construction_resolution_v1,resolution_groups}','[]'::jsonb),
      'construction_decisions',coalesce(lg#>'{construction_resolution_v1,construction_decisions}','[]'::jsonb),
      'construction_relations',coalesce(lg#>'{construction_resolution_v1,resolved_relations}','[]'::jsonb),
      'predicates',coalesce(lg#>'{predicate_build_v1,predicates}','[]'::jsonb),
      'predicate_hypotheses',coalesce(lg#>'{predicate_build_v1,predicate_hypotheses}','[]'::jsonb),
      'blocked_predicates',coalesce(lg#>'{predicate_build_v1,blocked_predicates}','[]'::jsonb),
      'clauses',coalesce(lg#>'{clause_build_v1,clauses}','[]'::jsonb),
      'clause_hypotheses',coalesce(lg#>'{clause_build_v1,clause_hypotheses}','[]'::jsonb),
      'blocked_clauses',coalesce(lg#>'{clause_build_v1,blocked_clauses}','[]'::jsonb),
      'dependencies',coalesce(lg#>'{dependency_build_v2,dependencies}','[]'::jsonb)
    ),
    'semantics',jsonb_build_object(
      'interpretations',coalesce(lg#>'{interpretation_v2,interpretations}','[]'::jsonb),
      'interpretation_hypotheses',coalesce(lg#>'{interpretation_v2,interpretation_hypotheses}','[]'::jsonb),
      'blocked_interpretations',coalesce(lg#>'{interpretation_v2,blocked_interpretations}','[]'::jsonb)
    ),
    'validation',jsonb_build_object(
      'summary',coalesce(lg#>'{grammar_validation_v2,summary}','{}'::jsonb),
      'events',coalesce(lg#>'{grammar_validation_v2,validation_events}','[]'::jsonb),
      'diagnostics',coalesce(lg#>'{grammar_validation_v2,diagnostics}','[]'::jsonb)
    ),
    'entity_index',v_index,'unresolved_index',v_unresolved,
    'source_layers',jsonb_build_object(
      'tokenizer',coalesce(a->'tokenizer','{}'::jsonb),
      'morphology','morphological-disambiguation-v1','pos','structural-pos-refinement-v1',
      'phrases','phrase-build-v1','constructions','construction-resolution-v1','predicates','predicate-build-v1',
      'clauses','clause-build-v1','dependencies','dependency-build-v2','validation','grammar-validation-v2','interpretation','interpretation-v2'
    ),
    'summary',jsonb_build_object(
      'token_count',jsonb_array_length(v_tokens),
      'analyzed_token_count',(select count(*) from jsonb_array_elements(v_tokens) x where x->>'analysis_status'='analyzed'),
      'surface_only_token_count',(select count(*) from jsonb_array_elements(v_tokens) x where x->>'analysis_status'='surface_only'),
      'phrase_count',jsonb_array_length(coalesce(lg#>'{phrase_build_v1,resolved_phrases}','[]'::jsonb)),
      'construction_count',jsonb_array_length(coalesce(lg#>'{construction_recognition_v1,constructions}','[]'::jsonb)),
      'predicate_count',jsonb_array_length(coalesce(lg#>'{predicate_build_v1,predicates}','[]'::jsonb)),
      'clause_count',jsonb_array_length(coalesce(lg#>'{clause_build_v1,clauses}','[]'::jsonb)),
      'dependency_count',jsonb_array_length(coalesce(lg#>'{dependency_build_v2,dependencies}','[]'::jsonb)),
      'interpretation_count',jsonb_array_length(coalesce(lg#>'{interpretation_v2,interpretations}','[]'::jsonb)),
      'unresolved_count',jsonb_array_length(v_unresolved),
      'validation_status',v_status
    )
  );
end;
$function$;

create or replace function public.analyze_text_structural_shadow_v15(p_text text,p_release_code text default 'runtime-structural-v1.15')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare d jsonb; out_s jsonb:='[]'::jsonb; s jsonb; a jsonb; m jsonb;
begin
  d:=public.analyze_text_structural_shadow_v14(p_text,p_release_code);
  for s in select x from jsonb_array_elements(coalesce(d#>'{document_graph,sentences}','[]'::jsonb)) x loop
    a:=coalesce(s->'analysis','{}'::jsonb);
    m:=public.build_sentence_model_v2(s,p_release_code);
    a:=jsonb_set(a,'{language_graph,sentence_model_v2}',m,true);
    out_s:=out_s||jsonb_build_array(jsonb_set(s,'{analysis}',a,true));
  end loop;
  return jsonb_set(d,'{document_graph,sentences}',out_s,true);
end;
$function$;
