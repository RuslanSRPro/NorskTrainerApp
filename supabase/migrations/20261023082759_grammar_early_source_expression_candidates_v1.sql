-- R074: candidate-only lexical expression projection before V32.
-- This does not assert an adverb role, validate temporal attachment, or grant a rule.
DO $guard$
BEGIN
  IF md5(pg_get_functiondef('public.run_canonical_legacy_compatibility_v140(jsonb,text)'::regprocedure))
     <> '968759622f01f1489b79b67f60cce775' THEN
    RAISE EXCEPTION 'CANONICAL_RPC_SOURCE_DRIFT';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.build_early_source_expression_candidates_v1(p_tokens jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $function$
WITH toks AS (
  SELECT (t.value->>'token_index')::int AS token_index,
         t.value->>'canonical_token_id' AS canonical_token_id,
         lower(coalesce(t.value->>'normalized',t.value->>'surface')) AS normalized_surface
  FROM jsonb_array_elements(coalesce(p_tokens,'[]'::jsonb)) AS t(value)
  WHERE t.value->>'canonical_token_id' IS NOT NULL
), adjacent AS (
  SELECT a.token_index AS start_token_index,
         b.token_index AS end_token_index,
         a.canonical_token_id AS start_canonical_token_id,
         b.canonical_token_id AS end_canonical_token_id,
         a.normalized_surface || ' ' || b.normalized_surface AS normalized_expression
  FROM toks a
  JOIN toks b ON b.token_index=a.token_index+1
), matches AS (
  SELECT a.*,l.id AS source_lexeme_id,l.lemma AS source_lemma,
         l.verification_status AS source_verification_status
  FROM adjacent a
  JOIN public.lexemes l ON l.lemma=a.normalized_expression
    AND l.pos='expression'
    AND l.dictionary_status='active'
    AND l.verification_status='multi_source'
    AND l.source_verified ILIKE '%Ordbokene%'
)
SELECT jsonb_build_object(
  'version','early-source-expression-candidates-v1',
  'status','candidate_only',
  'candidates',coalesce(jsonb_agg(jsonb_build_object(
    'status','candidate',
    'reason_code','source_verified_expression_surface_match',
    'source_lexeme_id',source_lexeme_id,
    'source_lemma',source_lemma,
    'source_verification_status',source_verification_status,
    'normalized_expression',normalized_expression,
    'start_token_index',start_token_index,
    'end_token_index',end_token_index,
    'canonical_token_ids',jsonb_build_array(start_canonical_token_id,end_canonical_token_id)
  ) ORDER BY start_token_index,source_lexeme_id),'[]'::jsonb),
  'resolved_function_count',0
)
FROM matches;
$function$;

REVOKE ALL ON FUNCTION public.build_early_source_expression_candidates_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_early_source_expression_candidates_v1(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.run_canonical_legacy_compatibility_v140(p_tokens jsonb, p_release_code text DEFAULT 'runtime-structural-v1.37'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_release_id uuid; v_release_status text; v_count int; v_expected int:=1;
  v_t jsonb; v_idx int; v_surface text; v_norm text; v_prev text; v_next text;
  v_tokens jsonb:='[]'::jsonb; v_analysis jsonb; v_mwe jsonb; v_s jsonb; v_scf jsonb; v_scr jsonb;
begin
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

  -- Preserve source-backed multiword lexical occurrences as candidates before V32.
  -- Syntax and function remain unresolved at this stage.
  v_analysis:=jsonb_set(v_analysis,'{language_graph,early_source_expression_candidates_v1}',
    public.build_early_source_expression_candidates_v1(v_tokens),true);

  -- Extract the already-proven v32 bounded sentence core from supplied tokens, without retokenization.
  v_analysis:=public.apply_v32_base_structure_from_tokens_v140(v_analysis);
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

  -- R048Q: expose rule execution separately; do not modify canonical dependencies.
  v_analysis:=jsonb_set(
    v_analysis,
    '{language_graph,rule_execution_plane_v1}',
    public.build_rule_execution_plane_v1(
      jsonb_build_object('analysis',v_analysis),
      p_release_code
    ),
    true
  );

  return v_analysis||jsonb_build_object('compatibility_contract',jsonb_build_object(
    'version','canonical-legacy-compatibility-v1','producer_stack','sql_structural_v1_37','token_index_base',1,
    'input_token_count',v_count,'no_raw_text_tokenization',true,'canonical_identity_required',true,
    'accepted_surface_kinds',jsonb_build_array('word','number'),
    'index_base_reason','SQL structural construction recognition iterates 1..n; canonical identity is independent of legacy base'));
end;
$function$
