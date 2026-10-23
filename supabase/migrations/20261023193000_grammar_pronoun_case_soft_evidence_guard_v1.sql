-- R087: the case-selection source (4.1.2) states a default with exceptions.
-- Preserve case and subject candidates; do not materialize a resolved clause
-- or a subject_of edge from case alone.
DO $guard$
BEGIN
  IF md5(pg_get_functiondef('grammar_pilot_private.apply_pronoun_case_structure_v1(jsonb)'::regprocedure))
     <> 'bf0ee975f5283f72cc6670d0aaf92c81' THEN
    RAISE EXCEPTION 'PRONOUN_CASE_PILOT_SOURCE_DRIFT';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION grammar_pilot_private.apply_pronoun_case_structure_v1(p_analysis jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_tokens jsonb := coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
  v_enriched jsonb := '[]'::jsonb;
  v_token jsonb;
  v_prefix jsonb;
  v_suffix jsonb;
  v_finite_count int;
BEGIN
  FOR v_token IN SELECT value FROM jsonb_array_elements(v_tokens) ORDER BY (value->>'token_index')::int LOOP
    v_enriched := v_enriched || jsonb_build_array(v_token || jsonb_build_object(
      'pronoun_case_candidates_v1',grammar_pilot_private.pronoun_case_candidates_v1(v_token->>'surface')));
  END LOOP;
  p_analysis := jsonb_set(p_analysis,'{language_graph,tokens}',v_enriched,true);
  IF jsonb_array_length(coalesce(p_analysis#>'{language_graph,clauses}','[]'::jsonb))<>0
     OR jsonb_array_length(v_enriched)<>3 THEN
    RETURN p_analysis;
  END IF;
  SELECT count(DISTINCT (t->>'token_index')::int) INTO v_finite_count
  FROM jsonb_array_elements(v_enriched) t
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(t#>'{morphology,readings}','[]'::jsonb)) mr
  WHERE (t->>'token_index')::int=2
    AND mr->>'source_pos'='verb' AND mr#>>'{features,VerbForm}'='Fin';
  IF v_finite_count<>1 THEN RETURN p_analysis; END IF;
  SELECT t INTO v_prefix FROM jsonb_array_elements(v_enriched) t WHERE t->>'token_index'='1';
  SELECT t INTO v_suffix FROM jsonb_array_elements(v_enriched) t WHERE t->>'token_index'='3';
  IF v_prefix IS NULL OR v_suffix IS NULL THEN RETURN p_analysis; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_prefix->'pronoun_case_candidates_v1') r WHERE r->>'Case'='Acc')
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_prefix->'pronoun_case_candidates_v1') r WHERE r->>'Case'='Nom')
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_suffix->'pronoun_case_candidates_v1') r WHERE r->>'Case'='Nom') THEN
    p_analysis := jsonb_set(p_analysis,'{language_graph,pronoun_case_subject_evidence_v1}',
      jsonb_build_object('status','candidate','proposed_subject_token_index',3,
        'proposed_complement_token_index',1,'source_candidate_id','f7c256e7-efe7-4687-aadc-26ee831a35bc',
        'paradigm_candidate_id','d99c8781-1212-45ed-a490-df7cfa105ede',
        'rule_strength','default_with_exceptions','exception_context_checked',false,
        'exhaustive',false,'resolved_clause_created',false),true);
  END IF;
  RETURN p_analysis;
END;
$function$;

REVOKE ALL ON FUNCTION grammar_pilot_private.apply_pronoun_case_structure_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION grammar_pilot_private.apply_pronoun_case_structure_v1(jsonb) TO service_role;

INSERT INTO public.grammar_scoped_operator_templates_v1
  (template_code,execution_role,candidate_codes,model_type,builder_contract,
   capability_status,required_capabilities,approval_status,notes)
VALUES
  ('case_selection.personal_pronoun_default.v1','case_selection',
   ARRAY['pronoun.personal.case.subject_vs_complement'],'grammar_rule',
   'pronoun-case-soft-subject-evidence-v1','blocked',
   jsonb_build_array('exception_context','coordination','syntactic_role_arbitration'),
   'blocked','The source says hovedregelen and has reference-only exceptions; candidate evidence cannot directly resolve a clause.')
ON CONFLICT (template_code) DO NOTHING;
