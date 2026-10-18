-- R048P | derived from production pg_get_functiondef 2026-10-18
-- REVIEW ONLY. Do not execute in production while EXECUTION_ADMISSION=HOLD.
-- Exact two-token noun+finite-verb bootstrap, with legacy pronoun behavior preserved.
CREATE OR REPLACE FUNCTION public.apply_v32_base_structure_from_tokens_v140(p_analysis jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_tokens jsonb:=coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
  v_phrases jsonb:='[]'::jsonb;
  v_dependencies jsonb:='[]'::jsonb;
  v_clauses jsonb:='[]'::jsonb;
  v_connector_idx int; v_connector_surface text;
  v_adv_idx int; v_adv_surface text;
  v_finite_idx int; v_finite_surface text;
  v_subject_idx int; v_subject_surface text;
  v_schema text; v_vp_id text;
  v_finite_count int := 0;
  v_noun_count int := 0;
  v_subject_pronoun_count int := 0;
begin
  -- Exact compatibility extraction of the bounded sentence-core logic already
  -- used by analyze_text_structural_shadow_core_v32, but over supplied tokens.
  select (t->>'token_index')::int,t->>'surface'
    into v_connector_idx,v_connector_surface
  from jsonb_array_elements(v_tokens) t
  where public.structural_token_has_class_v1(t,'subjunction_connector')
  order by (t->>'token_index')::int limit 1;

  select (t->>'token_index')::int,t->>'surface'
    into v_adv_idx,v_adv_surface
  from jsonb_array_elements(v_tokens) t
  where public.structural_token_has_class_v1(t,'sentence_adverbial')
  order by (t->>'token_index')::int limit 1;

  select (t->>'token_index')::int,t->>'surface'
    into v_finite_idx,v_finite_surface
  from jsonb_array_elements(v_tokens) t
  cross join lateral jsonb_array_elements(coalesce(t#>'{morphology,readings}','[]'::jsonb)) mr
  where mr->>'source_pos'='verb' and mr#>>'{features,VerbForm}'='Fin'
  order by (t->>'token_index')::int,mr->>'reading_id' limit 1;

  if v_finite_idx is not null then
    select (t->>'token_index')::int,t->>'surface'
      into v_subject_idx,v_subject_surface
    from jsonb_array_elements(v_tokens) t
    where (t->>'token_index')::int < v_finite_idx
      and (v_connector_idx is null or (t->>'token_index')::int > v_connector_idx)
      and public.structural_token_has_class_v1(t,'subject_pronoun')
    order by (t->>'token_index')::int desc limit 1;
  end if;

  -- R048P: conservative noun bootstrap only when the legacy pronoun path
  -- did not produce a subject. No local_pos_v1 is available at this stage.
  if v_subject_idx is null and v_finite_idx is not null and v_connector_idx is null then
    select count(distinct (t->>'token_index')::int)
      into v_finite_count
    from jsonb_array_elements(v_tokens) t
    cross join lateral jsonb_array_elements(coalesce(t#>'{morphology,readings}','[]'::jsonb)) mr
    where mr->>'source_pos'='verb' and mr#>>'{features,VerbForm}'='Fin';

    select count(*) into v_subject_pronoun_count
    from jsonb_array_elements(v_tokens) t
    where (t->>'token_index')::int < v_finite_idx
      and public.structural_token_has_class_v1(t,'subject_pronoun');

    select count(*) into v_noun_count
    from jsonb_array_elements(v_tokens) t
    where (t->>'token_index')::int < v_finite_idx
      and t#>>'{surface_resolution,resolution_status}'='single_candidate'
      and t#>>'{surface_resolution,selected_source_pos}'='noun'
      and t#>>'{surface_resolution,candidate_count}'='1';

    if v_finite_count=1 and v_subject_pronoun_count=0 and v_noun_count=1
       and v_finite_idx=2
       and jsonb_array_length(v_tokens)=2
    then
      select (t->>'token_index')::int,t->>'surface'
        into v_subject_idx,v_subject_surface
      from jsonb_array_elements(v_tokens) t
      where (t->>'token_index')::int=1
        and t#>>'{surface_resolution,resolution_status}'='single_candidate'
        and t#>>'{surface_resolution,selected_source_pos}'='noun'
        and t#>>'{surface_resolution,candidate_count}'='1'
      limit 1;
    end if;
  end if;

  if v_subject_idx is not null and v_finite_idx is not null then
    v_vp_id:='vp:'||v_finite_idx;
    v_phrases:=jsonb_build_array(jsonb_build_object(
      'id',v_vp_id,'type','VP','head_token_index',v_finite_idx,
      'head_surface',v_finite_surface,'role','predicate',
      'member_token_indices',jsonb_build_array(v_finite_idx),
      'compatibility_origin','v32_sentence_core'
    ));
    v_schema:=case when v_connector_idx is not null then 'B' else 'A' end;
    v_clauses:=jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id','clause:0','type','finite','schema',v_schema,
      'subject_token_index',v_subject_idx,'subject_surface',v_subject_surface,
      'predicate_phrase_id',v_vp_id,'finite_token_index',v_finite_idx,
      'finite_surface',v_finite_surface,'connector_token_index',v_connector_idx,
      'connector_surface',v_connector_surface,'adverbial_token_index',v_adv_idx,
      'adverbial_surface',v_adv_surface,
      'adverbial_role',case when v_adv_idx is not null then 'midfield_adverbial' else null end,
      'compatibility_origin','v32_sentence_core'
    )));
  end if;

  p_analysis:=jsonb_set(p_analysis,'{language_graph,phrases}',v_phrases,true);
  p_analysis:=jsonb_set(p_analysis,'{language_graph,dependencies}',v_dependencies,true);
  p_analysis:=jsonb_set(p_analysis,'{language_graph,clauses}',v_clauses,true);
  return p_analysis || jsonb_build_object('v32_base_structure_compatibility',jsonb_build_object(
    'version','v32-base-structure-compatibility-v1',
    'source_semantics','analyze_text_structural_shadow_core_v32',
    'raw_text_tokenization',false,
    'clause_count',jsonb_array_length(v_clauses)
  ));
end;
$function$;
