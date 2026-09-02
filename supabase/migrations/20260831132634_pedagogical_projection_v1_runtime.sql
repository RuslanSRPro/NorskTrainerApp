create or replace function public.pedagogical_predicate_token_indices_v1(p_model jsonb,p_predicate_id text)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select coalesce((
  select coalesce(p->'member_token_indices','[]'::jsonb)
  from jsonb_array_elements(coalesce(p_model#>'{syntax,predicates}','[]'::jsonb)) p
  where p->>'id'=p_predicate_id limit 1
),'[]'::jsonb);
$function$;

create or replace function public.pedagogical_token_surface_v1(p_model jsonb,p_idx integer)
returns text
language sql
immutable
security invoker
set search_path=''
as $function$
select t->>'surface' from jsonb_array_elements(coalesce(p_model->'tokens','[]'::jsonb)) t
where nullif(t->>'token_index','')::int=p_idx limit 1;
$function$;

create or replace function public.pedagogical_learning_points_v1(p_model jsonb)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
with facts as (
  select f
  from jsonb_array_elements(coalesce(p_model#>'{semantics,interpretations}','[]'::jsonb)) f
  where f->>'status'='resolved'
), raw_points as (
  select
    'pp1:subject_predicate:'||(f->>'id') point_id,
    'subject_predicate' concept_code,
    'syntax' knowledge_dimension,
    40 priority,
    'supporting' focus_level,
    'pedagogy.subject_predicate' display_key,
    'explain_structure' display_intent,
    'sentence.structure.predicate' topic_code,
    jsonb_build_array('sentence.structure.subject') related_topic_codes,
    f->>'id' trigger_fact_id,
    f->>'family' trigger_family,
    coalesce(f->>'predicate_id','') predicate_id,
    coalesce(f->>'clause_id','') clause_id,
    coalesce(f->>'subject_surface','') surface,
    (case when nullif(f->>'subject_token_index','') is null then '[]'::jsonb else jsonb_build_array((f->>'subject_token_index')::int) end)
      || public.pedagogical_predicate_token_indices_v1(p_model,f->>'predicate_id') highlight_indices,
    (case when nullif(f->>'subject_token_index','') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('token_index',(f->>'subject_token_index')::int,'role','subject')) end)
      || coalesce((select jsonb_agg(jsonb_build_object('token_index',x::int,'role','predicate') order by x::int) from jsonb_array_elements_text(public.pedagogical_predicate_token_indices_v1(p_model,f->>'predicate_id')) x),'[]'::jsonb) highlight_roles,
    public.pedagogical_provenance_codes_v1(f) source_codes,
    f->>'reason_code' reason_code
  from facts where f->>'family'='finite_predication'

  union all

  select
    'pp1:tense:'||(f->>'id'),
    case f#>>'{value,morphological_tense}' when 'present' then 'present' when 'preterite' then 'preterite' else 'tense' end,
    'morphology',
    70,
    'supporting',
    case f#>>'{value,morphological_tense}' when 'present' then 'pedagogy.tense.present' when 'preterite' then 'pedagogy.tense.preterite' else 'pedagogy.tense' end,
    'show_form',
    case f#>>'{value,morphological_tense}' when 'present' then 'verb.forms.present' when 'preterite' then 'verb.forms.preterite' else 'verb.forms' end,
    '[]'::jsonb,
    f->>'id',f->>'family',coalesce(f->>'predicate_id',''),coalesce(f->>'clause_id',''),coalesce(f->>'surface',''),
    case when nullif(f->>'finite_token_index','') is null then '[]'::jsonb else jsonb_build_array((f->>'finite_token_index')::int) end,
    case when nullif(f->>'finite_token_index','') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('token_index',(f->>'finite_token_index')::int,'role','finite_head')) end,
    public.pedagogical_provenance_codes_v1(f),f->>'reason_code'
  from facts where f->>'family'='morphological_tense' and f#>>'{value,morphological_tense}' in ('present','preterite')

  union all

  select
    'pp1:perfect:'||(f->>'id'),
    case f#>>'{value,tense_form}' when 'present_perfect' then 'present_perfect' when 'preterite_perfect' then 'preterite_perfect' else 'perfect' end,
    'construction',
    100,
    'primary',
    case f#>>'{value,tense_form}' when 'present_perfect' then 'pedagogy.tense.present_perfect' when 'preterite_perfect' then 'pedagogy.tense.preterite_perfect' else 'pedagogy.tense.perfect' end,
    'explain_form',
    case f#>>'{value,tense_form}' when 'present_perfect' then 'verb.forms.present_perfect' when 'preterite_perfect' then 'verb.forms.preterite_perfect' else 'verb.forms' end,
    jsonb_build_array('verb.auxiliary'),
    f->>'id',f->>'family',coalesce(f->>'predicate_id',''),coalesce(f->>'clause_id',''),coalesce(f->>'surface',''),
    (case when nullif(f->>'finite_token_index','') is null then '[]'::jsonb else jsonb_build_array((f->>'finite_token_index')::int) end)
      || (case when nullif(f->>'lexical_head_token_index','') is null then '[]'::jsonb else jsonb_build_array((f->>'lexical_head_token_index')::int) end),
    (case when nullif(f->>'finite_token_index','') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('token_index',(f->>'finite_token_index')::int,'role','finite_head')) end)
      || (case when nullif(f->>'lexical_head_token_index','') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('token_index',(f->>'lexical_head_token_index')::int,'role','lexical_head')) end),
    public.pedagogical_provenance_codes_v1(f),f->>'reason_code'
  from facts where f->>'family'='perfect_tense_form' and f#>>'{value,tense_form}' in ('present_perfect','preterite_perfect')

  union all

  select
    'pp1:modal:'||(f->>'id'),
    'modal_verbs',
    'construction',
    95,
    'primary',
    'pedagogy.modal.structure',
    'explain_construction',
    'verb.modal',
    jsonb_build_array('verb.forms.infinitive'),
    f->>'id',f->>'family',coalesce(f->>'predicate_id',''),coalesce(f->>'clause_id',''),coalesce(f->>'surface',''),
    coalesce(f#>'{value,member_token_indices}','[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
      'token_index',x::int,
      'role',case when (f#>'{value,modal_operator_token_indices}') @> to_jsonb(array[x::int]) then 'modal_chain' when x::int=nullif(f#>>'{value,lexical_head_token_index}','')::int then 'lexical_head' else 'predicate' end
    ) order by x::int) from jsonb_array_elements_text(coalesce(f#>'{value,member_token_indices}','[]'::jsonb)) x),'[]'::jsonb),
    public.pedagogical_provenance_codes_v1(f),f->>'reason_code'
  from facts where f->>'family'='modal_structure'

  union all

  select
    'pp1:copular:'||(f->>'id'),
    'copular_predication',
    'syntax',
    95,
    'primary',
    'pedagogy.copular.predication',
    'explain_structure',
    'sentence.structure.predicative.fixed_subject.copula',
    jsonb_build_array('sentence.structure.subject','sentence.structure.predicate'),
    f->>'id',f->>'family',coalesce(f->>'predicate_id',''),coalesce(f->>'clause_id',''),coalesce(f->>'surface',''),
    jsonb_build_array((f#>>'{value,subject_token_index}')::int,(f#>>'{value,copula_token_index}')::int,(f#>>'{value,predicative_complement_token_index}')::int),
    jsonb_build_array(
      jsonb_build_object('token_index',(f#>>'{value,subject_token_index}')::int,'role','subject'),
      jsonb_build_object('token_index',(f#>>'{value,copula_token_index}')::int,'role','copula'),
      jsonb_build_object('token_index',(f#>>'{value,predicative_complement_token_index}')::int,'role','predicative')
    ),
    public.pedagogical_provenance_codes_v1(f),f->>'reason_code'
  from facts where f->>'family'='copular_predication'
    and nullif(f#>>'{value,subject_token_index}','') is not null
    and nullif(f#>>'{value,copula_token_index}','') is not null
    and nullif(f#>>'{value,predicative_complement_token_index}','') is not null

  union all

  select
    'pp1:infinitive:'||(f->>'id'),
    'marked_infinitive',
    'construction',
    90,
    'primary',
    'pedagogy.infinitive.marked',
    'explain_construction',
    'sentence.subordinate_clause.explicative.nominal.infinitive_construction',
    jsonb_build_array('verb.forms.infinitive'),
    f->>'id',f->>'family',coalesce(f->>'predicate_id',''),coalesce(f->>'clause_id',''),coalesce(f->>'surface',''),
    public.pedagogical_predicate_token_indices_v1(p_model,f->>'predicate_id'),
    coalesce((select jsonb_agg(jsonb_build_object(
      'token_index',x::int,
      'role',case when public.pedagogical_token_surface_v1(p_model,x::int)='å' then 'infinitive_marker' else 'infinitive_head' end
    ) order by x::int) from jsonb_array_elements_text(public.pedagogical_predicate_token_indices_v1(p_model,f->>'predicate_id')) x),'[]'::jsonb),
    public.pedagogical_provenance_codes_v1(f),f->>'reason_code'
  from facts where f->>'family'='nonfinite_infinitive_profile'
), points as (
  select jsonb_build_object(
    'id',point_id,
    'status','resolved',
    'concept_code',concept_code,
    'knowledge_dimension',knowledge_dimension,
    'priority',priority,
    'focus_level',focus_level,
    'display_key',display_key,
    'display_intent',display_intent,
    'topic',public.pedagogical_topic_ref_v1(topic_code),
    'related_topics',coalesce((select jsonb_agg(public.pedagogical_topic_ref_v1(c) order by c) from jsonb_array_elements_text(related_topic_codes) c),'[]'::jsonb),
    'trigger',jsonb_build_object('fact_id',trigger_fact_id,'family',trigger_family,'predicate_id',nullif(predicate_id,''),'clause_id',nullif(clause_id,''),'reason_code',reason_code),
    'surface',surface,
    'highlight_token_indices',highlight_indices,
    'highlight_roles',highlight_roles,
    'source_candidate_codes',source_codes,
    'technical_trace_visible_default',false,
    'natural_language_explanation_status','deferred_to_content_localization_layer'
  ) p, priority, point_id
  from raw_points
)
select coalesce(jsonb_agg(p order by priority desc,point_id),'[]'::jsonb) from points;
$function$;

create or replace function public.build_pedagogical_projection_v1(p_sentence jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_model jsonb := coalesce(p_sentence#>'{analysis,language_graph,sentence_model_v2}','{}'::jsonb);
  v_model_status text := coalesce(v_model->>'status','incomplete');
  v_projection_status text;
  v_points jsonb := '[]'::jsonb;
  v_highlights jsonb := '[]'::jsonb;
  v_notices jsonb := '[]'::jsonb;
  v_hooks jsonb := '{}'::jsonb;
  v_reasons jsonb := '[]'::jsonb;
begin
  if v_model_status='valid' then
    v_projection_status := 'ready';
    v_points := public.pedagogical_learning_points_v1(v_model);
  elsif v_model_status='unresolved' then
    v_projection_status := 'limited';
  elsif v_model_status='blocked' then
    v_projection_status := 'blocked';
  elsif v_model_status='invalid' then
    v_projection_status := 'internal_invalid';
  else
    v_projection_status := 'incomplete';
  end if;

  select coalesce(jsonb_agg(distinct u->>'reason_code' order by u->>'reason_code') filter (where coalesce(u->>'reason_code','')<>''),'[]'::jsonb)
  into v_reasons
  from jsonb_array_elements(coalesce(v_model->'unresolved_index','[]'::jsonb)) u;

  if v_model_status='unresolved' then
    v_notices := jsonb_build_array(jsonb_build_object(
      'id','ppn1:analysis_unresolved',
      'code','analysis_unresolved',
      'status','info',
      'message_key','analysis.unresolved',
      'classification','analysis_uncertainty',
      'reason_codes',v_reasons,
      'grammar_error_claim',false,
      'learner_correction_claim',false,
      'technical_details_visible_default',false
    ));
  elsif v_model_status='blocked' then
    v_notices := jsonb_build_array(jsonb_build_object(
      'id','ppn1:analysis_capability_limited',
      'code','analysis_capability_limited',
      'status','info',
      'message_key','analysis.capability_limited',
      'classification','runtime_capability_limit',
      'reason_codes',v_reasons,
      'grammar_error_claim',false,
      'learner_correction_claim',false,
      'technical_details_visible_default',false
    ));
  elsif v_model_status='invalid' then
    v_notices := jsonb_build_array(jsonb_build_object(
      'id','ppn1:analysis_internal_invalid',
      'code','analysis_internal_invalid',
      'status','internal_error',
      'message_key','analysis.internal_invalid',
      'classification','internal_graph_validation_failure',
      'grammar_error_claim',false,
      'learner_correction_claim',false,
      'technical_details_visible_default',false
    ));
  elsif v_model_status not in ('valid','unresolved','blocked','invalid') then
    v_notices := jsonb_build_array(jsonb_build_object(
      'id','ppn1:analysis_incomplete',
      'code','analysis_incomplete',
      'status','info',
      'message_key','analysis.incomplete',
      'classification','analysis_incomplete',
      'grammar_error_claim',false,
      'learner_correction_claim',false,
      'technical_details_visible_default',false
    ));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id','pphl1:'||(p->>'id'),
    'learning_point_id',p->>'id',
    'concept_code',p->>'concept_code',
    'display_intent',p->>'display_intent',
    'token_indices',coalesce(p->'highlight_token_indices','[]'::jsonb),
    'roles',coalesce(p->'highlight_roles','[]'::jsonb)
  ) order by (p->>'priority')::int desc,p->>'id'),'[]'::jsonb)
  into v_highlights
  from jsonb_array_elements(v_points) p;

  select jsonb_build_object(
    'concept_codes',coalesce(jsonb_agg(distinct p->>'concept_code' order by p->>'concept_code') filter (where coalesce(p->>'concept_code','')<>''),'[]'::jsonb),
    'topic_ids',coalesce(jsonb_agg(distinct p#>>'{topic,topic_id}' order by p#>>'{topic,topic_id}') filter (where coalesce(p#>>'{topic,topic_id}','')<>''),'[]'::jsonb),
    'topic_codes',coalesce(jsonb_agg(distinct p#>>'{topic,topic_code}' order by p#>>'{topic,topic_code}') filter (where coalesce(p#>>'{topic,topic_code}','')<>''),'[]'::jsonb),
    'current_progress_binding','none_v1',
    'learning_progress_table_scope','lexeme_scoped_not_grammar_topic_scoped',
    'personalized_ranking_status','deferred'
  ) into v_hooks from jsonb_array_elements(v_points) p;

  return jsonb_build_object(
    'version','pedagogical-projection-v1',
    'status',v_projection_status,
    'sentence_model_status',v_model_status,
    'release_code',p_release_code,
    'learning_points',v_points,
    'highlights',v_highlights,
    'analysis_notices',v_notices,
    'personalization_hooks',coalesce(v_hooks,jsonb_build_object(
      'concept_codes','[]'::jsonb,'topic_ids','[]'::jsonb,'topic_codes','[]'::jsonb,
      'current_progress_binding','none_v1','learning_progress_table_scope','lexeme_scoped_not_grammar_topic_scoped','personalized_ranking_status','deferred'
    )),
    'summary',jsonb_build_object(
      'learning_point_count',jsonb_array_length(v_points),
      'primary_point_count',(select count(*) from jsonb_array_elements(v_points) p where p->>'focus_level'='primary'),
      'supporting_point_count',(select count(*) from jsonb_array_elements(v_points) p where p->>'focus_level'='supporting'),
      'highlight_count',jsonb_array_length(v_highlights),
      'notice_count',jsonb_array_length(v_notices),
      'uk_localization_missing_count',(select count(*) from jsonb_array_elements(v_points) p where p#>>'{topic,localization_status,uk}'='missing'),
      'natural_language_explanations_generated',0,
      'learner_error_claims',0
    )
  );
end;
$function$;

create or replace function public.apply_pedagogical_projection_v1(p_doc jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_sentences jsonb := '[]'::jsonb;
  v_sentence jsonb;
  v_projected jsonb;
begin
  for v_sentence in select value from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences}','[]'::jsonb))
  loop
    v_projected := public.build_pedagogical_projection_v1(v_sentence,p_release_code);
    v_sentence := jsonb_set(v_sentence,'{analysis,language_graph,pedagogical_projection_v1}',v_projected,true);
    v_sentences := v_sentences || jsonb_build_array(v_sentence);
  end loop;
  return jsonb_set(p_doc,'{document_graph,sentences}',v_sentences,true);
end;
$function$;

create or replace function public.analyze_text_structural_shadow_v16(p_text text,p_release_code text default 'runtime-structural-v1.16')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_doc jsonb;
begin
  v_doc := public.analyze_text_structural_shadow_v15(p_text,p_release_code);
  v_doc := public.apply_pedagogical_projection_v1(v_doc,p_release_code);
  return v_doc;
end;
$function$;
