-- R048P SQL smoke tests. Run only in a disposable/local PostgreSQL environment
-- after migration is installed there. No production execution is authorized.
DO $test$
DECLARE
  v_noun jsonb := jsonb_build_object('token_index',1,'surface','Katten',
    'surface_resolution',jsonb_build_object('resolution_status','single_candidate','selected_source_pos','noun','candidate_count',1),
    'morphology',jsonb_build_object('readings','[]'::jsonb),'lexical_classes','[]'::jsonb);
  v_verb jsonb := jsonb_build_object('token_index',2,'surface','sover',
    'morphology',jsonb_build_object('readings',jsonb_build_array(jsonb_build_object('source_pos','verb','features',jsonb_build_object('VerbForm','Fin')))),
    'lexical_classes','[]'::jsonb);
  v_result jsonb; v_input jsonb;
BEGIN
  v_input := jsonb_build_object('language_graph',jsonb_build_object('tokens',jsonb_build_array(v_noun,v_verb)));
  v_result := public.apply_v32_base_structure_from_tokens_v140(v_input);
  IF jsonb_array_length(v_result#>'{language_graph,clauses}') <> 1
    OR v_result#>>'{language_graph,clauses,0,subject_token_index}' <> '1'
    OR v_result#>>'{language_graph,clauses,0,finite_token_index}' <> '2'
    THEN RAISE EXCEPTION 'R048P positive failed'; END IF;
  -- Two pre-verbal nouns: do not bootstrap.
  v_input := jsonb_build_object('language_graph',jsonb_build_object('tokens',jsonb_build_array(
    v_noun,
    v_noun || jsonb_build_object('token_index',2,'surface','hunden'),
    v_verb || jsonb_build_object('token_index',3))));
  v_result := public.apply_v32_base_structure_from_tokens_v140(v_input);
  IF jsonb_array_length(v_result#>'{language_graph,clauses}') <> 0 THEN
    RAISE EXCEPTION 'R048P multiple nouns failed'; END IF;
  -- Verb first: no pre-verbal noun.
  v_input := jsonb_build_object('language_graph',jsonb_build_object('tokens',jsonb_build_array(
    v_verb || jsonb_build_object('token_index',1),
    v_noun || jsonb_build_object('token_index',2))));
  v_result := public.apply_v32_base_structure_from_tokens_v140(v_input);
  IF jsonb_array_length(v_result#>'{language_graph,clauses}') <> 0 THEN
    RAISE EXCEPTION 'R048P verb first failed'; END IF;
  -- Ambiguous noun candidate: must not bootstrap.
  v_input := jsonb_build_object('language_graph',jsonb_build_object('tokens',jsonb_build_array(
    v_noun || jsonb_build_object('surface_resolution',jsonb_build_object('resolution_status','ambiguous','selected_source_pos','noun','candidate_count',2)),v_verb)));
  v_result := public.apply_v32_base_structure_from_tokens_v140(v_input);
  IF jsonb_array_length(v_result#>'{language_graph,clauses}') <> 0 THEN
    RAISE EXCEPTION 'R048P ambiguity failed'; END IF;
  -- Pure function idempotence: same input => same output.
  v_input := jsonb_build_object('language_graph',jsonb_build_object('tokens',jsonb_build_array(v_noun,v_verb)));
  IF public.apply_v32_base_structure_from_tokens_v140(v_input) IS DISTINCT FROM
     public.apply_v32_base_structure_from_tokens_v140(v_input) THEN
    RAISE EXCEPTION 'R048P deterministic rerun failed'; END IF;
  RAISE NOTICE 'R048P smoke tests passed';
END
$test$;
