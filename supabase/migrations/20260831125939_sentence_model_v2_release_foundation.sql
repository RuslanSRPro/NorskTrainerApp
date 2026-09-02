do $migration$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.14';
  if v_parent.id is null or v_parent.status<>'shadow' then
    raise exception 'Parent runtime-structural-v1.14 must exist in shadow';
  end if;
  if exists(select 1 from public.grammar_runtime_releases where code='runtime-structural-v1.15') then
    raise exception 'runtime-structural-v1.15 already exists';
  end if;

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values (
    'runtime-structural-v1.15',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v15',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,null,
    v_parent.metadata || jsonb_build_object(
      'purpose','Sentence Model V2',
      'parent_release','runtime-structural-v1.14',
      'next_layer','Pedagogical Projection V1',
      'child_only_rules',0,
      'parent_runtime_unchanged',true,
      'sentence_model_contract','sentence-model-v2',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.sentence_model_v2',
      'sentence_model_role','canonical self-contained sentence projection; no reparsing and no new grammar claim',
      'sentence_model_source_policy','all grammar claims and reason codes are inherited from upstream materialized layers; Sentence Model V2 adds projection/integrity metadata only',
      'sentence_model_sections',jsonb_build_array('sentence','tokens','syntax','semantics','validation','entity_index','unresolved_index','source_layers','summary'),
      'sentence_model_status_policy','status mirrors Grammar Validation V2 overall_status; missing validation => incomplete',
      'sentence_model_token_policy','full Tokenizer V2 sentence-local source token stream including punctuation, enriched by existing morphology/POS facts; both sentence-local and document-global offsets are retained',
      'sentence_model_unresolved_policy','active unresolved index begins at unresolved/blocked construction resolution and propagates through predicate/clause/interpretation; superseded upstream phrase hypotheses remain evidence but are not counted as active unresolved state',
      'deferred_sentence_model_capabilities',jsonb_build_array('cross_sentence_relations','document_level_coreference','discourse_graph','pedagogical_projection','visual_layout','semantic_role_graph','full_clause_extent'),
      'rules_active',false
    )
  ) returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata
  from public.grammar_runtime_release_rules where release_id=v_parent.id;

  update public.grammar_runtime_releases
  set checksum=md5('runtime-structural-v1.15|'||coalesce(v_parent.checksum,'')||'|sentence-model-v2|projection-only')
  where id=v_child_id;
end;
$migration$;

create or replace function public.sentence_model_contract_v2()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'version','sentence-model-v2',
  'input','document_graph.sentences[].{metadata,analysis.language_graph.*}',
  'authoritative_output','analysis.language_graph.sentence_model_v2',
  'sections',jsonb_build_array('sentence','tokens','syntax','semantics','validation','entity_index','unresolved_index','source_layers','summary'),
  'status_values',jsonb_build_array('valid','unresolved','blocked','invalid','warning','incomplete'),
  'token_contract',jsonb_build_object(
    'surface_stream','analysis.source_tokens / Tokenizer V2, including punctuation',
    'local_offsets','sentence-local Unicode [start,end)',
    'document_offsets','sentence.document_start_char + local offsets',
    'grammar_enrichment','join existing language_graph token, morphology_v1 and structural_pos_v1 facts by sentence-local token_index',
    'no_new_disambiguation',true
  ),
  'syntax_contract',jsonb_build_object(
    'phrases','Phrase Build V1 resolved_phrases + phrase_hypotheses',
    'constructions','Construction Recognition V1 candidates + Construction Resolution V1 groups/decisions/relations',
    'predicates','Predicate Build V1 resolved/hypothesis/blocked',
    'clauses','Clause Build V1 resolved/hypothesis/blocked',
    'dependencies','Dependency Build V2 authoritative dependencies'
  ),
  'semantic_contract','Interpretation V2 facts/hypotheses/blocked are copied by value without reinterpretation',
  'validation_contract','Grammar Validation V2 summary/events/diagnostics are copied by value; model status mirrors overall_status',
  'unresolved_contract','Only causally live unresolved/blocked states from construction resolution onward enter unresolved_index; upstream phrase hypotheses may remain evidence without making the final model unresolved',
  'entity_identity','Upstream entity ids are preserved; tokens use tok:<sentence-local-token-index>',
  'immutability','Sentence Model V2 is additive and must not mutate any upstream layer',
  'non_goals',jsonb_build_array('reparse','resolve_new_grammar','semantic_roles','control_PRO','passive_recovery','cross_sentence_coreference','pedagogical_projection','visual_layout')
);
$function$;

create or replace function public.sentence_model_token_projection_v2(p_sentence jsonb)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
with a as (
  select coalesce(p_sentence->'analysis','{}'::jsonb) analysis,
         coalesce(nullif(p_sentence->>'start_char','')::int,0) doc_sentence_start,
         coalesce(nullif(p_sentence->>'start_source_token_index','')::int,1) doc_source_token_start
), src as (
  select s tok
  from a, jsonb_array_elements(coalesce(a.analysis->'source_tokens','[]'::jsonb)) s
), enriched as (
  select
    src.tok,
    lg,
    m,
    pos,
    a.doc_sentence_start,
    a.doc_source_token_start
  from a, src
  left join lateral (
    select x lg from jsonb_array_elements(coalesce(a.analysis#>'{language_graph,tokens}','[]'::jsonb)) x
    where nullif(x->>'token_index','')::int=nullif(src.tok->>'token_index','')::int limit 1
  ) l on true
  left join lateral (
    select x m from jsonb_array_elements(coalesce(a.analysis#>'{language_graph,morphology_v1}','[]'::jsonb)) x
    where nullif(x->>'token_index','')::int=nullif(src.tok->>'token_index','')::int limit 1
  ) mm on true
  left join lateral (
    select x pos from jsonb_array_elements(coalesce(a.analysis#>'{language_graph,structural_pos_v1,refined_local_pos}','[]'::jsonb)) x
    where nullif(x->>'token_index','')::int=nullif(src.tok->>'token_index','')::int limit 1
  ) pp on true
)
select coalesce(jsonb_agg(jsonb_build_object(
  'id','tok:'||(tok->>'token_index'),
  'token_index',nullif(tok->>'token_index','')::int,
  'document_source_token_index',doc_source_token_start + nullif(tok->>'token_index','')::int - 1,
  'surface',tok->>'surface',
  'normalized',tok->'normalized_token',
  'token_type',tok->>'token_type',
  'is_sentence_terminal_candidate',coalesce((tok->>'is_sentence_terminal_candidate')::boolean,false),
  'sentence_start_char',nullif(tok->>'start_char','')::int,
  'sentence_end_char',nullif(tok->>'end_char','')::int,
  'document_start_char',doc_sentence_start + nullif(tok->>'start_char','')::int,
  'document_end_char',doc_sentence_start + nullif(tok->>'end_char','')::int,
  'analysis_status',case when lg is null then 'surface_only' else 'analyzed' end,
  'morphology',case when m is null then null else jsonb_build_object(
      'status',m->>'status','confidence',m->'confidence','selected_lemma',m->'selected_lemma',
      'selected_source_pos',m->'selected_source_pos','selected_reading_id',m->'selected_reading_id',
      'selected_candidate_id',m->'selected_candidate_id','features',m#>'{selected_reading,features}'
    ) end,
  'pos',case when pos is null then null else jsonb_build_object(
      'status',pos->>'status','confidence',pos->'confidence','selected_grammar_pos',pos->'selected_grammar_pos',
      'competing_pos',coalesce(pos->'competing_pos','[]'::jsonb),'reason_code',pos->'reason_code',
      'selected_source_candidate_ids',coalesce(pos->'selected_source_candidate_ids','[]'::jsonb)
    ) end,
  'lexical_classes',coalesce((select jsonb_agg(jsonb_build_object(
      'class_code',c->>'class_code','grammar_pos',c->>'grammar_pos','lemma',c->>'lemma','confidence',c->'confidence','class_type',c->>'class_type'
    ) order by c->>'class_code') from jsonb_array_elements(coalesce(lg->'lexical_classes','[]'::jsonb)) c),'[]'::jsonb)
) order by nullif(tok->>'token_index','')::int),'[]'::jsonb)
from enriched;
$function$;

create or replace function public.sentence_model_entity_index_v2(p_analysis jsonb)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
with entities as (
  select 'phrase'::text entity_type, x->>'id' entity_id, x->>'status' status, x->>'surface' surface, x->>'type' subtype,
         nullif(x->>'span_start','')::int span_start,nullif(x->>'span_end','')::int span_end,'phrase_build_v1'::text source_layer
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,phrase_build_v1,resolved_phrases}','[]'::jsonb)) x
  union all
  select 'phrase_hypothesis',x->>'id',x->>'status',x->>'surface',x->>'type',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,'phrase_build_v1'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,phrase_build_v1,phrase_hypotheses}','[]'::jsonb)) x
  union all
  select 'construction',x->>'id',x->>'status',x->>'surface',x->>'family',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,'construction_recognition_v1'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,construction_recognition_v1,constructions}','[]'::jsonb)) x
  union all
  select 'predicate',x->>'id',x->>'status',x->>'surface',x->>'predicate_kind',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,'predicate_build_v1'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicates}','[]'::jsonb)) x
  union all
  select 'predicate_hypothesis',x->>'id',x->>'status',x->>'surface',x->>'predicate_kind',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,'predicate_build_v1'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicate_hypotheses}','[]'::jsonb)) x
  union all
  select 'blocked_predicate',x->>'id',x->>'status',x->>'surface',x->>'predicate_kind',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,'predicate_build_v1'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,blocked_predicates}','[]'::jsonb)) x
  union all
  select 'clause',x->>'id',x->>'status',x->>'surface',x->>'clause_type',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,'clause_build_v1'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,clauses}','[]'::jsonb)) x
  union all
  select 'clause_hypothesis',x->>'id',x->>'status',x->>'surface',x->>'clause_type',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,'clause_build_v1'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,clause_hypotheses}','[]'::jsonb)) x
  union all
  select 'blocked_clause',x->>'id',x->>'status',x->>'surface',x->>'clause_type',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,'clause_build_v1'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,blocked_clauses}','[]'::jsonb)) x
  union all
  select 'interpretation',x->>'id',x->>'status',x->>'surface',x->>'family',null::int,null::int,'interpretation_v2'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,interpretation_v2,interpretations}','[]'::jsonb)) x
  union all
  select 'interpretation_hypothesis',x->>'id',x->>'status',x->>'surface',x->>'family',null::int,null::int,'interpretation_v2'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,interpretation_v2,interpretation_hypotheses}','[]'::jsonb)) x
  union all
  select 'blocked_interpretation',x->>'id',x->>'status',x->>'surface',x->>'family',null::int,null::int,'interpretation_v2'
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,interpretation_v2,blocked_interpretations}','[]'::jsonb)) x
)
select coalesce(jsonb_agg(jsonb_build_object(
  'entity_type',entity_type,'entity_id',entity_id,'status',status,'surface',surface,'subtype',subtype,
  'span_start',span_start,'span_end',span_end,'source_layer',source_layer
) order by source_layer,entity_type,entity_id),'[]'::jsonb) from entities;
$function$;

create or replace function public.sentence_model_unresolved_index_v2(p_analysis jsonb)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
with u as (
  select 'construction_resolution_v1'::text source_layer,'construction_group'::text entity_type,x->>'group_id' entity_id,x->>'status' status,
         null::text surface,x->>'reason_code' reason_code,nullif(x->>'span_start','')::int span_start,nullif(x->>'span_end','')::int span_end,coalesce(x->'blocked_events','[]'::jsonb) blocked_events
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,construction_resolution_v1,resolution_groups}','[]'::jsonb)) x
  where x->>'status' in ('unresolved','blocked')
  union all
  select 'construction_resolution_v1','construction',x->>'construction_id','unresolved',x->>'surface',x->>'reason_code',null::int,null::int,'[]'::jsonb
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,construction_resolution_v1,construction_decisions}','[]'::jsonb)) x where x->>'decision'='unresolved'
  union all
  select 'predicate_build_v1','predicate',x->>'id',x->>'status',x->>'surface',x->>'reason_code',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,coalesce(x->'blocked_events','[]'::jsonb)
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicate_hypotheses}','[]'::jsonb)) x
  union all
  select 'predicate_build_v1','predicate',x->>'id',x->>'status',x->>'surface',x->>'reason_code',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,coalesce(x->'blocked_events','[]'::jsonb)
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,blocked_predicates}','[]'::jsonb)) x
  union all
  select 'clause_build_v1','clause',x->>'id',x->>'status',x->>'surface',x->>'reason_code',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,coalesce(x->'blocked_events','[]'::jsonb)
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,clause_hypotheses}','[]'::jsonb)) x
  union all
  select 'clause_build_v1','clause',x->>'id',x->>'status',x->>'surface',x->>'reason_code',nullif(x->>'span_start','')::int,nullif(x->>'span_end','')::int,coalesce(x->'blocked_events','[]'::jsonb)
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,blocked_clauses}','[]'::jsonb)) x
  union all
  select 'interpretation_v2','interpretation',x->>'id',x->>'status',x->>'surface',x->>'reason_code',null::int,null::int,coalesce(x->'blocked_events','[]'::jsonb)
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,interpretation_v2,interpretation_hypotheses}','[]'::jsonb)) x
  union all
  select 'interpretation_v2','interpretation',x->>'id',x->>'status',x->>'surface',x->>'reason_code',null::int,null::int,coalesce(x->'blocked_events','[]'::jsonb)
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,interpretation_v2,blocked_interpretations}','[]'::jsonb)) x
)
select coalesce(jsonb_agg(jsonb_build_object(
  'source_layer',source_layer,'entity_type',entity_type,'entity_id',entity_id,'status',status,'surface',surface,
  'reason_code',reason_code,'span_start',span_start,'span_end',span_end,'blocked_events',blocked_events
) order by source_layer,entity_type,entity_id),'[]'::jsonb) from u;
$function$;
