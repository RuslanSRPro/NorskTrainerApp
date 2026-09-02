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
), has_primary_construction as (
  select exists(select 1 from facts where f->>'family' in ('perfect_tense_form','modal_structure','copular_predication','nonfinite_infinitive_profile')) v
), raw_points as (
  select
    'pp1:subject_predicate:'||(f->>'id') point_id,'subject_predicate' concept_code,'syntax' knowledge_dimension,
    40 priority,'supporting' focus_level,'pedagogy.subject_predicate' display_key,'explain_structure' display_intent,
    'sentence.structure.predicate' topic_code,jsonb_build_array('sentence.structure.subject') related_topic_codes,
    f->>'id' trigger_fact_id,f->>'family' trigger_family,coalesce(f->>'predicate_id','') predicate_id,coalesce(f->>'clause_id','') clause_id,
    coalesce(f->>'surface','') surface,
    (case when nullif(f->>'subject_token_index','') is null then '[]'::jsonb else jsonb_build_array((f->>'subject_token_index')::int) end)
      || public.pedagogical_predicate_token_indices_v1(p_model,f->>'predicate_id') highlight_indices,
    (case when nullif(f->>'subject_token_index','') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('token_index',(f->>'subject_token_index')::int,'role','subject')) end)
      || coalesce((select jsonb_agg(jsonb_build_object('token_index',x::int,'role','predicate') order by x::int) from jsonb_array_elements_text(public.pedagogical_predicate_token_indices_v1(p_model,f->>'predicate_id')) x),'[]'::jsonb) highlight_roles,
    public.pedagogical_provenance_codes_v1(f) source_codes,f->>'reason_code' reason_code
  from facts where f->>'family'='finite_predication'

  union all

  select
    'pp1:tense:'||(f->>'id'),
    case f#>>'{value,morphological_tense}' when 'present' then 'present' when 'preterite' then 'preterite' else 'tense' end,
    'morphology',
    case when h.v then 70 else 90 end,
    case when h.v then 'supporting' else 'primary' end,
    case f#>>'{value,morphological_tense}' when 'present' then 'pedagogy.tense.present' when 'preterite' then 'pedagogy.tense.preterite' else 'pedagogy.tense' end,
    'show_form',
    case f#>>'{value,morphological_tense}' when 'present' then 'verb.forms.present' when 'preterite' then 'verb.forms.preterite' else 'verb.forms' end,
    '[]'::jsonb,
    f->>'id',f->>'family',coalesce(f->>'predicate_id',''),coalesce(f->>'clause_id',''),coalesce(f->>'surface',''),
    case when nullif(f->>'finite_token_index','') is null then '[]'::jsonb else jsonb_build_array((f->>'finite_token_index')::int) end,
    case when nullif(f->>'finite_token_index','') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('token_index',(f->>'finite_token_index')::int,'role','finite_head')) end,
    public.pedagogical_provenance_codes_v1(f),f->>'reason_code'
  from facts cross join has_primary_construction h
  where f->>'family'='morphological_tense' and f#>>'{value,morphological_tense}' in ('present','preterite')

  union all

  select
    'pp1:perfect:'||(f->>'id'),
    case f#>>'{value,tense_form}' when 'present_perfect' then 'present_perfect' when 'preterite_perfect' then 'preterite_perfect' else 'perfect' end,
    'construction',100,'primary',
    case f#>>'{value,tense_form}' when 'present_perfect' then 'pedagogy.tense.present_perfect' when 'preterite_perfect' then 'pedagogy.tense.preterite_perfect' else 'pedagogy.tense.perfect' end,
    'explain_form',
    case f#>>'{value,tense_form}' when 'present_perfect' then 'verb.forms.present_perfect' when 'preterite_perfect' then 'verb.forms.preterite_perfect' else 'verb.forms' end,
    jsonb_build_array('verb.auxiliary'),f->>'id',f->>'family',coalesce(f->>'predicate_id',''),coalesce(f->>'clause_id',''),coalesce(f->>'surface',''),
    (case when nullif(f->>'finite_token_index','') is null then '[]'::jsonb else jsonb_build_array((f->>'finite_token_index')::int) end)
      || (case when nullif(f->>'lexical_head_token_index','') is null then '[]'::jsonb else jsonb_build_array((f->>'lexical_head_token_index')::int) end),
    (case when nullif(f->>'finite_token_index','') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('token_index',(f->>'finite_token_index')::int,'role','finite_head')) end)
      || (case when nullif(f->>'lexical_head_token_index','') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('token_index',(f->>'lexical_head_token_index')::int,'role','lexical_head')) end),
    public.pedagogical_provenance_codes_v1(f),f->>'reason_code'
  from facts where f->>'family'='perfect_tense_form' and f#>>'{value,tense_form}' in ('present_perfect','preterite_perfect')

  union all

  select
    'pp1:modal:'||(f->>'id'),'modal_verbs','construction',95,'primary','pedagogy.modal.structure','explain_construction','verb.modal',jsonb_build_array('verb.forms.infinitive'),
    f->>'id',f->>'family',coalesce(f->>'predicate_id',''),coalesce(f->>'clause_id',''),coalesce(f->>'surface',''),coalesce(f#>'{value,member_token_indices}','[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
      'token_index',x::int,
      'role',case when (f#>'{value,modal_operator_token_indices}') @> to_jsonb(array[x::int]) then 'modal_chain' when x::int=nullif(f#>>'{value,lexical_head_token_index}','')::int then 'lexical_head' else 'predicate' end
    ) order by x::int) from jsonb_array_elements_text(coalesce(f#>'{value,member_token_indices}','[]'::jsonb)) x),'[]'::jsonb),
    public.pedagogical_provenance_codes_v1(f),f->>'reason_code'
  from facts where f->>'family'='modal_structure'

  union all

  select
    'pp1:copular:'||(f->>'id'),'copular_predication','syntax',95,'primary','pedagogy.copular.predication','explain_structure','sentence.structure.predicative.fixed_subject.copula',
    jsonb_build_array('sentence.structure.subject','sentence.structure.predicate'),f->>'id',f->>'family',coalesce(f->>'predicate_id',''),coalesce(f->>'clause_id',''),coalesce(f->>'surface',''),
    jsonb_build_array((f#>>'{value,subject_token_index}')::int,(f#>>'{value,copula_token_index}')::int,(f#>>'{value,predicative_complement_token_index}')::int),
    jsonb_build_array(jsonb_build_object('token_index',(f#>>'{value,subject_token_index}')::int,'role','subject'),jsonb_build_object('token_index',(f#>>'{value,copula_token_index}')::int,'role','copula'),jsonb_build_object('token_index',(f#>>'{value,predicative_complement_token_index}')::int,'role','predicative')),
    public.pedagogical_provenance_codes_v1(f),f->>'reason_code'
  from facts where f->>'family'='copular_predication'
    and nullif(f#>>'{value,subject_token_index}','') is not null and nullif(f#>>'{value,copula_token_index}','') is not null and nullif(f#>>'{value,predicative_complement_token_index}','') is not null

  union all

  select
    'pp1:infinitive:'||(f->>'id'),'marked_infinitive','construction',90,'primary','pedagogy.infinitive.marked','explain_construction','sentence.subordinate_clause.explicative.nominal.infinitive_construction',
    jsonb_build_array('verb.forms.infinitive'),f->>'id',f->>'family',coalesce(f->>'predicate_id',''),coalesce(f->>'clause_id',''),coalesce(f->>'surface',''),
    public.pedagogical_predicate_token_indices_v1(p_model,f->>'predicate_id'),
    coalesce((select jsonb_agg(jsonb_build_object('token_index',x::int,'role',case when public.pedagogical_token_surface_v1(p_model,x::int)='å' then 'infinitive_marker' else 'infinitive_head' end) order by x::int)
      from jsonb_array_elements_text(public.pedagogical_predicate_token_indices_v1(p_model,f->>'predicate_id')) x),'[]'::jsonb),
    public.pedagogical_provenance_codes_v1(f),f->>'reason_code'
  from facts where f->>'family'='nonfinite_infinitive_profile'
), points as (
  select jsonb_build_object(
    'id',point_id,'status','resolved','concept_code',concept_code,'knowledge_dimension',knowledge_dimension,'priority',priority,'focus_level',focus_level,
    'display_key',display_key,'display_intent',display_intent,'topic',public.pedagogical_topic_ref_v1(topic_code),
    'related_topics',coalesce((select jsonb_agg(public.pedagogical_topic_ref_v1(c) order by c) from jsonb_array_elements_text(related_topic_codes) c),'[]'::jsonb),
    'trigger',jsonb_build_object('fact_id',trigger_fact_id,'family',trigger_family,'predicate_id',nullif(predicate_id,''),'clause_id',nullif(clause_id,''),'reason_code',reason_code),
    'surface',surface,'highlight_token_indices',highlight_indices,'highlight_roles',highlight_roles,'source_candidate_codes',source_codes,
    'technical_trace_visible_default',false,'natural_language_explanation_status','deferred_to_content_localization_layer'
  ) p, priority, point_id
  from raw_points
)
select coalesce(jsonb_agg(p order by priority desc,point_id),'[]'::jsonb) from points;
$function$;
