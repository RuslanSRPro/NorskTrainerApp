-- R089: a bounded coordination candidate protects the service-only subject pilot.
-- It does not resolve a coordinated NP, assign case, or activate a rule.
DO $guard$
BEGIN
  IF md5(pg_get_functiondef('grammar_pilot_private.build_pre_rule_plane_v1(jsonb,text)'::regprocedure))
     <> '817820a2f26e9a27f86459ec8763a4da' THEN
    RAISE EXCEPTION 'PILOT_SOURCE_DRIFT';
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
     OR lower(v_middle->>'surface')<>'og'
     OR jsonb_array_length(coalesce(v_first->'pronoun_case_candidates_v1','[]'::jsonb))=0
     OR jsonb_array_length(coalesce(v_third->'pronoun_case_candidates_v1','[]'::jsonb))=0 THEN
    RETURN p_analysis;
  END IF;
  p_analysis := jsonb_set(p_analysis,'{language_graph,pronoun_coordination_candidates_v1}',
    jsonb_build_array(jsonb_build_object(
      'status','candidate','start_token_index',1,'end_token_index',3,
      'conjunct_token_indices',jsonb_build_array(1,3),'coordinator_token_index',2,
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

REVOKE ALL ON FUNCTION grammar_pilot_private.apply_pronoun_coordination_candidate_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION grammar_pilot_private.apply_pronoun_coordination_candidate_v1(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION grammar_pilot_private.build_pre_rule_plane_v1(p_tokens jsonb, p_release_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare
  v_release_id uuid; v_release_status text; v_count int; v_expected int:=1;
  v_t jsonb; v_idx int; v_surface text; v_norm text; v_prev text; v_next text;
  v_tokens jsonb:='[]'::jsonb; v_analysis jsonb; v_mwe jsonb; v_s jsonb; v_scf jsonb; v_scr jsonb;
begin
  if p_release_code is distinct from 'runtime-structural-v1.37' then
    raise exception 'PILOT_RELEASE_NOT_ALLOWED';
  end if;
  if jsonb_typeof(coalesce(p_tokens,'[]'::jsonb))<>'array' then raise exception 'p_tokens must be a JSON array'; end if;
  select id,status into v_release_id,v_release_status from public.grammar_runtime_releases where code=p_release_code;
  if v_release_id is null then raise exception 'Runtime release % not found',p_release_code; end if;
  if v_release_status not in ('build','golden','shadow','canary','active') then raise exception 'Runtime release % has unsupported status %',p_release_code,v_release_status; end if;
  select count(*) into v_count from jsonb_array_elements(coalesce(p_tokens,'[]'::jsonb));

  for v_t in select value from jsonb_array_elements(coalesce(p_tokens,'[]'::jsonb)) order by nullif(value->>'legacy_index','')::int loop
    v_idx:=nullif(v_t->>'legacy_index','')::int;
    if v_idx is null or v_idx<>v_expected then raise exception 'SQL structural compatibility indices must be contiguous 1-based; expected %, got %',v_expected,v_idx; end if;
    if coalesce(v_t->>'canonical_token_id','')='' then raise exception 'canonical_token_id is required for legacy_index %',v_idx; end if;
    if coalesce(v_t->>'surface','')='' then raise exception 'surface is required for legacy_index %',v_idx; end if;
    if coalesce(v_t->>'kind','') not in ('word','number') then raise exception 'Only word/number compatibility tokens are accepted; legacy_index % kind=%',v_idx,v_t->>'kind'; end if;
    v_expected:=v_expected+1;
  end loop;

  for v_t in select value from jsonb_array_elements(coalesce(p_tokens,'[]'::jsonb)) order by nullif(value->>'legacy_index','')::int loop
    v_idx:=(v_t->>'legacy_index')::int; v_surface:=v_t->>'surface'; v_norm:=coalesce(v_t->>'normalized_surface',lower(v_surface));
    select x->>'normalized_surface' into v_prev from jsonb_array_elements(p_tokens) x where nullif(x->>'legacy_index','')::int=v_idx-1 limit 1;
    select x->>'normalized_surface' into v_next from jsonb_array_elements(p_tokens) x where nullif(x->>'legacy_index','')::int=v_idx+1 limit 1;
    v_tokens:=v_tokens||jsonb_build_array(public.build_structural_token_v2(v_idx,v_surface,v_norm,v_prev,v_next,v_release_id)||jsonb_build_object(
      'canonical_token_id',v_t->>'canonical_token_id','document_token_index',nullif(v_t->>'document_token_index','')::int,
      'sentence_token_index',nullif(v_t->>'sentence_token_index','')::int,'start_utf16',nullif(v_t->>'start_utf16','')::int,
      'end_utf16',nullif(v_t->>'end_utf16','')::int,'surface_kind',v_t->>'kind'));
  end loop;

  v_analysis:=jsonb_build_object('mode','canonical_legacy_compatibility_v140','release_code',p_release_code,'release_status',v_release_status,
    'token_index_base',1,'language_graph',jsonb_build_object('tokens',v_tokens,'phrases','[]'::jsonb,'dependencies','[]'::jsonb,'clauses','[]'::jsonb));

  -- Extract the already-proven v32 bounded sentence core from supplied tokens, without retokenization.
  v_analysis:=public.apply_v32_base_structure_from_tokens_v140(v_analysis);
  v_analysis:=grammar_pilot_private.apply_pronoun_case_structure_v1(v_analysis);
  v_analysis:=grammar_pilot_private.apply_pronoun_coordination_candidate_v1(v_analysis);
  v_analysis:=public.apply_morphological_disambiguation_v1(v_analysis);
  v_analysis:=public.apply_morphological_rule_dispatcher_to_analysis_v3(v_analysis,p_release_code);
  v_analysis:=public.apply_local_pos_disambiguation_v1(v_analysis);
  v_analysis:=public.apply_phrase_build_v1(v_analysis,p_release_code);
  v_analysis:=public.apply_structural_pos_refinement_v2(v_analysis,p_release_code);
  v_analysis:=public.apply_construction_recognition_v1(v_analysis,p_release_code);
  v_analysis:=public.apply_construction_resolution_v1(v_analysis,p_release_code);
  v_analysis:=public.apply_predicate_build_v1(v_analysis,p_release_code);
  v_analysis:=public.apply_clause_build_v1(v_analysis,p_release_code);
  v_mwe:=public.build_multiword_function_expression_v1(v_analysis,p_release_code);
  v_analysis:=jsonb_set(v_analysis,'{language_graph,multiword_function_expression_v1}',v_mwe,true);
  v_analysis:=public.apply_mwe_predicate_valency_integration_v1(v_analysis,p_release_code);

  -- Subordinate layers expect a sentence wrapper but reuse the same analysis/token identities.
  v_s:=jsonb_build_object('sentence_index',0,'analysis',v_analysis);
  v_scf:=public.build_subordinate_clause_foundation_v4(v_s,p_release_code);
  v_analysis:=jsonb_set(v_analysis,'{language_graph,subordinate_clause_foundation_v2}',v_scf,true);
  v_scr:=public.build_subordinate_construction_recognition_v2(v_analysis,p_release_code);
  v_analysis:=jsonb_set(v_analysis,'{language_graph,subordinate_construction_recognition_v1}',v_scr,true);
  v_analysis:=public.apply_clause_attachment_function_resolution_v2(v_analysis,p_release_code);
  v_analysis:=public.apply_dependency_build_v2(v_analysis,p_release_code);

  return v_analysis||jsonb_build_object('compatibility_contract',jsonb_build_object(
    'version','canonical-legacy-compatibility-v1','producer_stack','sql_structural_v1_37','token_index_base',1,
    'input_token_count',v_count,'no_raw_text_tokenization',true,'canonical_identity_required',true,
    'accepted_surface_kinds',jsonb_build_array('word','number'),
    'index_base_reason','SQL structural construction recognition iterates 1..n; canonical identity is independent of legacy base'));
end;
$function$;
