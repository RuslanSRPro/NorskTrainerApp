-- R090: extend the same bounded candidate guard to eller.
-- Source c706857b licenses og and eller at all syntactic levels.
DO $guard$
BEGIN
  IF md5(pg_get_functiondef('grammar_pilot_private.apply_pronoun_coordination_candidate_v1(jsonb)'::regprocedure))
     <> '7f60cf782236dfe8083537bb2f221a8f' THEN
    RAISE EXCEPTION 'COORDINATION_CANDIDATE_SOURCE_DRIFT';
  END IF;
END;
$guard$;
CREATE OR REPLACE FUNCTION grammar_pilot_private.apply_pronoun_coordination_candidate_v1(p_analysis jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_tokens jsonb := coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
  v_first jsonb;
  v_middle jsonb;
  v_third jsonb;
  v_clause jsonb;
BEGIN
  IF jsonb_array_length(v_tokens)<>4 THEN RETURN p_analysis; END IF;
  SELECT t INTO v_first FROM jsonb_array_elements(v_tokens) t WHERE t->>'token_index'='1';
  SELECT t INTO v_middle FROM jsonb_array_elements(v_tokens) t WHERE t->>'token_index'='2';
  SELECT t INTO v_third FROM jsonb_array_elements(v_tokens) t WHERE t->>'token_index'='3';
  IF v_first IS NULL OR v_middle IS NULL OR v_third IS NULL
     OR lower(v_middle->>'surface') NOT IN ('og','eller')
     OR jsonb_array_length(coalesce(v_first->'pronoun_case_candidates_v1','[]'::jsonb))=0
     OR jsonb_array_length(coalesce(v_third->'pronoun_case_candidates_v1','[]'::jsonb))=0 THEN
    RETURN p_analysis;
  END IF;
  p_analysis := jsonb_set(p_analysis,'{language_graph,pronoun_coordination_candidates_v1}',
    jsonb_build_array(jsonb_build_object(
      'status','candidate','start_token_index',1,'end_token_index',3,
      'conjunct_token_indices',jsonb_build_array(1,3),'coordinator_token_index',2,'coordinator_surface',lower(v_middle->>'surface'),
      'canonical_token_ids',jsonb_build_array(v_first->>'canonical_token_id',v_middle->>'canonical_token_id',v_third->>'canonical_token_id'),
      'source_candidate_ids',jsonb_build_array(
        'c706857b-6666-450d-9597-60c215ad8615',
        '62bdf946-f145-4a01-8f95-dae670c62563',
        'a0a84d73-e761-4aad-a52e-28d50ce4d34c'),
      'resolved_subject',false)),true);
  SELECT t INTO v_clause FROM jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clauses}','[]'::jsonb)) t
    WHERE (t->>'subject_token_index')::int IN (1,3)
      AND (t->>'finite_token_index')::int=4 LIMIT 1;
  IF v_clause IS NOT NULL THEN
    -- The selected pronoun is one conjunct, not an independently proved subject.
    p_analysis := jsonb_set(p_analysis,'{language_graph,clauses}','[]'::jsonb,true);
    p_analysis := jsonb_set(p_analysis,'{language_graph,phrases}','[]'::jsonb,true);
    p_analysis := p_analysis || jsonb_build_object('pronoun_coordination_guard_v1',
      jsonb_build_object('status','blocked_premature_single_subject',
        'former_subject_token_index',(v_clause->>'subject_token_index')::int,
        'candidate_span',jsonb_build_array(1,3)));
  END IF;
  RETURN p_analysis;
END;
$function$;
