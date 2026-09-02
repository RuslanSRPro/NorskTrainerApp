do $migration$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.15';
  if v_parent.id is null or v_parent.status<>'shadow' then
    raise exception 'Parent runtime-structural-v1.15 must exist in shadow';
  end if;
  if exists(select 1 from public.grammar_runtime_releases where code='runtime-structural-v1.16') then
    raise exception 'runtime-structural-v1.16 already exists';
  end if;

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values (
    'runtime-structural-v1.16',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v16',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,null,
    v_parent.metadata || jsonb_build_object(
      'purpose','Pedagogical Projection V1',
      'parent_release','runtime-structural-v1.15',
      'next_layer','Document Runtime Contract V1',
      'child_only_rules',0,
      'parent_runtime_unchanged',true,
      'pedagogical_projection_contract','pedagogical-projection-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.pedagogical_projection_v1',
      'pedagogical_projection_role','learner-facing projection plan over Sentence Model V2; no grammar reanalysis and no generated natural-language explanation',
      'pedagogical_sections',jsonb_build_array('learning_points','highlights','analysis_notices','personalization_hooks','summary'),
      'pedagogical_topic_source','public.grammar_topics stable topic ids/codes and available localized labels',
      'pedagogical_localization_policy','runtime emits title_no/title_en/title_ru and title_uk=null; missing Ukrainian must remain explicit and must never silently fall back to Russian',
      'pedagogical_personalization_policy','projection is deterministic and user-independent; learning_progress is not read by runtime and may be joined later by a separate personalization/scheduler layer',
      'pedagogical_validity_policy','only resolved Interpretation V2 facts from a valid Sentence Model become learning_points; unresolved/blocked/invalid/incomplete states become analysis_notices, not learner grammar errors',
      'pedagogical_technical_evidence_policy','source candidate refs and upstream entity ids are retained for traceability but technical evidence is hidden by default from learner presentation',
      'pedagogical_concept_families',jsonb_build_array('subject_predicate','present','preterite','present_perfect','preterite_perfect','modal_verbs','copular_predication','marked_infinitive'),
      'deferred_pedagogical_capabilities',jsonb_build_array('natural_language_explanation_generation','ukrainian_localization_content','exercise_generation','error_correction','CEFR_difficulty_model','prerequisite_graph','personalized_ranking','spaced_repetition_writeback','cross_sentence_teaching_points'),
      'rules_active',false
    )
  ) returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata
  from public.grammar_runtime_release_rules where release_id=v_parent.id;

  update public.grammar_runtime_releases
  set checksum=md5('runtime-structural-v1.16|'||coalesce(v_parent.checksum,'')||'|pedagogical-projection-v1|projection-only')
  where id=v_child_id;
end;
$migration$;

create or replace function public.pedagogical_projection_contract_v1()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'version','pedagogical-projection-v1',
  'input','language_graph.sentence_model_v2',
  'authoritative_output','language_graph.pedagogical_projection_v1',
  'sections',jsonb_build_array('learning_points','highlights','analysis_notices','personalization_hooks','summary'),
  'projection_status_values',jsonb_build_array('ready','limited','blocked','internal_invalid','incomplete'),
  'learning_point_status','resolved_only',
  'policy',jsonb_build_array(
    'do not reparse or create new grammar claims',
    'emit learning points only from resolved Interpretation V2 facts when Sentence Model V2 status is valid',
    'map learning points to stable grammar_topics when an exact supported topic exists',
    'preserve source candidate codes and upstream entity ids as hidden technical trace',
    'unresolved and blocked analysis states become learner-safe analysis notices rather than grammar-error claims',
    'internal invalidity is an analysis-system state, never evidence that the learner sentence is ungrammatical',
    'no natural-language explanation text is generated in V1; emit message/display keys and topic refs for a separate localization/content layer',
    'Ukrainian localization is explicit-missing when unavailable and never silently falls back to Russian',
    'learning_progress is not read; projection is deterministic for the same Sentence Model'
  ),
  'learning_point_families',jsonb_build_array('subject_predicate','present','preterite','present_perfect','preterite_perfect','modal_verbs','copular_predication','marked_infinitive'),
  'highlight_roles',jsonb_build_array('subject','predicate','finite_head','lexical_head','modal_chain','copula','predicative','infinitive_marker','infinitive_head'),
  'notice_codes',jsonb_build_array('analysis_unresolved','analysis_capability_limited','analysis_internal_invalid','analysis_incomplete'),
  'non_goals',jsonb_build_array('error_correction','acceptability_judgment','exercise_generation','CEFR_ranking','personalized_selection','spaced_repetition_updates','natural_language_explanation_generation')
);
$function$;

create or replace function public.pedagogical_topic_ref_v1(p_topic_code text)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select coalesce((
  select jsonb_build_object(
    'topic_id',t.id,
    'topic_code',t.code,
    'knowledge_type',t.knowledge_type,
    'nrg_section_code',t.nrg_section_code,
    'title_no',t.title_no,
    'title_en',t.title_en,
    'title_ru',t.title_ru,
    'title_uk',null,
    'description',t.description,
    'localization_status',jsonb_build_object(
      'no',case when t.title_no is null then 'missing' else 'available' end,
      'en',case when t.title_en is null then 'missing' else 'available' end,
      'ru',case when t.title_ru is null then 'missing' else 'available' end,
      'uk','missing'
    )
  ) from public.grammar_topics t where t.code=p_topic_code and t.is_active limit 1
),'{}'::jsonb);
$function$;

create or replace function public.pedagogical_provenance_codes_v1(p_fact jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select coalesce(jsonb_agg(distinct p->>'candidate_code' order by p->>'candidate_code') filter (where coalesce(p->>'candidate_code','')<>''),'[]'::jsonb)
from jsonb_array_elements(coalesce(p_fact->'provenance','[]'::jsonb)) p;
$function$;
