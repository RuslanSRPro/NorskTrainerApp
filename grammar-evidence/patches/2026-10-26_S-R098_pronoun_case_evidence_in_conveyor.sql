-- ============================================================================
-- DRAFT R098 -- REVIEW ONLY. DO NOT APPLY WITHOUT SEPARATE EXPLICIT APPROVAL.
-- Not executed. UNTESTED.
-- Source of truth for the patched function: R097 definition (md5 81ae1453781a9ee00e67863086ec4bb9),
-- reconstructed byte-exact (md5 verified) and patched by exactly ONE inserted statement.
--
-- Part 1: new additive function apply_pronoun_case_evidence_v1 (soft evidence only; decides nothing).
-- Part 2: run_canonical_legacy_compatibility_v140 gets one added call after the early-candidates step.
--
-- Safety guards (script aborts, nothing applied, if any fails):
--   * current RPC md5 must equal 81ae1453... (nobody changed it since R097)
--   * anon/authenticated must NOT have EXECUTE on the RPC (the new function is service_role-only; if clients
--     could call the RPC, the nested call would fail for them)
-- Default release of the RPC stays runtime-structural-v1.37 -> no paradigm rows -> inert for default callers.
-- Out of scope here: subject authority / exception guards (separate consumer step), V32 (unchanged, md5 28301d55...).
-- ============================================================================

do $$
declare oid_ oid; cur text;
begin
  select p.oid into oid_ from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='run_canonical_legacy_compatibility_v140'
     and pg_get_function_identity_arguments(p.oid)='p_tokens jsonb, p_release_code text';
  if oid_ is null then raise exception 'R098_ABORT: RPC not found'; end if;
  cur := md5(pg_get_functiondef(oid_));
  if cur <> '81ae1453781a9ee00e67863086ec4bb9' then
    raise exception 'R098_ABORT: RPC definition changed since R097 (md5 %)', cur;
  end if;
  if has_function_privilege('anon', oid_, 'execute') or has_function_privilege('authenticated', oid_, 'execute') then
    raise exception 'R098_ABORT: anon/authenticated can execute the RPC; nested service_role-only call would break them';
  end if;
end $$;

create or replace function public.apply_pronoun_case_evidence_v1(p_analysis jsonb, p_release_code text)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_items jsonb := '[]'::jsonb;
  v_t jsonb; v_ev jsonb;
begin
  for v_t in
    select value from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb))
    order by nullif(value->>'token_index','')::int
  loop
    v_ev := public.pronoun_case_evidence_v2(lower(coalesce(v_t->>'surface','')), p_release_code);
    if jsonb_array_length(v_ev) > 0 then
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'token_index', (v_t->>'token_index')::int, 'surface', v_t->>'surface', 'evidence', v_ev));
    end if;
  end loop;
  return jsonb_set(p_analysis, '{language_graph,pronoun_case_evidence_v1}',
    jsonb_build_object(
      'version', 'pronoun-case-evidence-v1',
      'release_code', p_release_code,
      'status', case when jsonb_array_length(v_items) = 0 then 'no_evidence' else 'evidence_attached' end,
      'soft_evidence_only', true,
      'decides_clause', false,
      'tokens', v_items), true);
end;
$function$;

revoke all on function public.apply_pronoun_case_evidence_v1(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_pronoun_case_evidence_v1(jsonb, text) to service_role;

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

  -- R098: additive soft pronoun case evidence (release-bound paradigm). Does not decide clauses,
  -- does not modify tokens/clauses/dependencies. Releases without paradigm rows (e.g. v1.37) get an inert result.
  v_analysis:=public.apply_pronoun_case_evidence_v1(v_analysis,p_release_code);

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
$function$;

-- ----------------------------------------------------------------------------
-- After an approved apply on a branch/copy (read-only comparisons, to be prepared as R099/R100):
--   * run RPC with default release on a fixed token set before/after: output must be identical except the
--     new language_graph.pronoun_case_evidence_v1 key with status 'no_evidence'
--   * run with 'runtime-structural-v1.38' on 'Meg ser han' tokens: evidence for meg (accusative of jeg) and
--     han (nominative of han); clause output must be unchanged (V32 untouched)
-- Rollback: re-create the RPC from the R097 definition (md5 81ae1453...), then
--   drop function public.apply_pronoun_case_evidence_v1(jsonb, text);
-- ----------------------------------------------------------------------------
