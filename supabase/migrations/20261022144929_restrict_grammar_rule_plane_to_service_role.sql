-- Keep the rule execution plane available to the server-side shadow pipeline,
-- while preventing direct Data API calls by app roles before graph integration.
-- This does not activate a grammar rule or alter any release membership.

REVOKE EXECUTE ON FUNCTION public.apply_rule_execution_plane_v1(jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.build_rule_execution_plane_v1(jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_candidate_constraint_rule_v2(jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_dependency_pattern_rule_v2(jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_phrase_rule_operator_v1(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_rule_execution_plane_v1(jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.build_rule_execution_plane_v1(jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_candidate_constraint_rule_v2(jsonb, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_dependency_pattern_rule_v2(jsonb, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_phrase_rule_operator_v1(uuid)
  TO service_role;

DO $$
DECLARE
  function_signature text;
BEGIN
  FOREACH function_signature IN ARRAY ARRAY[
    'public.apply_rule_execution_plane_v1(jsonb,text)',
    'public.build_rule_execution_plane_v1(jsonb,text)',
    'public.execute_candidate_constraint_rule_v2(jsonb,uuid)',
    'public.execute_dependency_pattern_rule_v2(jsonb,uuid)',
    'public.validate_phrase_rule_operator_v1(uuid)'
  ] LOOP
    IF has_function_privilege('anon', function_signature, 'EXECUTE')
       OR has_function_privilege('authenticated', function_signature, 'EXECUTE')
       OR NOT has_function_privilege('service_role', function_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Grammar rule-plane execute privilege mismatch: %', function_signature;
    END IF;
  END LOOP;
END;
$$;
