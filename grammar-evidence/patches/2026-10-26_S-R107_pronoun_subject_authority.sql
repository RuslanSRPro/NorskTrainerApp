-- ============================================================================
-- DRAFT R107 -- REVIEW ONLY. Apply to Production only after Ruslan's explicit approval.
-- Based on R106 (25 Oct): v1.37/v1.38 identical, evidence planes work. Baseline V32 results (both releases):
--   "Meg ser han" 0 clauses, "Det er meg" 0 clauses; "Jeg ser ham", "Han ser meg", "Katten sover" 1 clause.
--
-- Adds a bounded, EVIDENCE-DRIVEN subject authority AFTER V32 (V32 stays untouched, md5 28301d55...):
--   apply_pronoun_subject_authority_v1 builds a clause only when V32 produced none AND the R105 evidence plane is attached
--   (so it is inert for any release without paradigm rows, e.g. v1.37) AND all of these hold:
--     * no subordinating connector token; exactly 3 tokens; exactly ONE finite verb token and it is token 2 (V2)
--     * token 1 is a pronoun with accusative case, strength 'default', no guards  (fronted object)
--     * token 3 is a pronoun with nominative case, strength 'default', no guards  (subject after the verb)
--   Result: clause {subject = token 3, predicate = vp:2, schema A, subject_authority = pronoun_case_v1}, built in exactly the
--   shape V32 builds, so downstream steps consume it unchanged. Anything else: nothing changes and the reason is recorded in
--   language_graph.pronoun_subject_authority_v1. Widening beyond 3 tokens needs the gold corpus (Phase 1) first.
-- The RPC is patched from its CURRENT stored text (CRLF-safe): one statement inserted after the V32 call. Nothing removed.
-- ============================================================================

do $$
declare oid_ oid; def text;
begin
  select p.oid into oid_ from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='run_canonical_legacy_compatibility_v140'
     and pg_get_function_identity_arguments(p.oid)='p_tokens jsonb, p_release_code text';
  if oid_ is null then raise exception 'R107_ABORT: RPC not found'; end if;
  def := pg_get_functiondef(oid_);
  if position('apply_pronoun_subject_evidence_v1(v_analysis,p_release_code);' in def) = 0 then
    raise exception 'R107_ABORT: R105 call not present'; end if;
  if position('apply_pronoun_subject_authority_v1' in def) > 0 then
    raise exception 'R107_ABORT: R107 call already present'; end if;
  if (length(def) - length(replace(def, 'v_analysis:=public.apply_v32_base_structure_from_tokens_v140(v_analysis);', ''))) <> length('v_analysis:=public.apply_v32_base_structure_from_tokens_v140(v_analysis);') then
    raise exception 'R107_ABORT: V32 call is not present exactly once'; end if;
  if md5(pg_get_functiondef('public.apply_v32_base_structure_from_tokens_v140(jsonb)'::regprocedure)) <> '28301d551fa68a9cfe356d75ec35149f' then
    raise exception 'R107_ABORT: V32 definition changed since R097'; end if;
  if has_function_privilege('anon', oid_, 'execute') or has_function_privilege('authenticated', oid_, 'execute') then
    raise exception 'R107_ABORT: anon/authenticated can execute the RPC'; end if;
end $$;

create or replace function public.apply_pronoun_subject_authority_v1(p_analysis jsonb, p_release_code text)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_tokens jsonb := coalesce(p_analysis#>'{language_graph,tokens}', '[]'::jsonb);
  v_plane  jsonb := p_analysis#>'{language_graph,pronoun_subject_evidence_v1}';
  v_n int; v_finite_count int; v_finite_idx int; v_finite_surface text;
  v_t1 jsonb; v_t3 jsonb; v_reason text := null;
  v_subject_surface text; v_vp_id text;
begin
  select count(*) into v_n from jsonb_array_elements(v_tokens);

  if coalesce(v_plane->>'status','') <> 'evidence_attached' then
    v_reason := 'no_subject_evidence';
  elsif jsonb_array_length(coalesce(p_analysis#>'{language_graph,clauses}','[]'::jsonb)) > 0 then
    v_reason := 'clauses_present';
  elsif exists (select 1 from jsonb_array_elements(v_tokens) t where public.structural_token_has_class_v1(t,'subjunction_connector')) then
    v_reason := 'connector_present';
  elsif v_n <> 3 then
    v_reason := 'shape_not_bounded';
  end if;

  if v_reason is null then
    select count(distinct (t->>'token_index')::int), min((t->>'token_index')::int)
      into v_finite_count, v_finite_idx
    from jsonb_array_elements(v_tokens) t
    cross join lateral jsonb_array_elements(coalesce(t#>'{morphology,readings}','[]'::jsonb)) mr
    where mr->>'source_pos' = 'verb' and mr#>>'{features,VerbForm}' = 'Fin';
    if v_finite_count <> 1 then v_reason := 'finite_count_not_one';
    elsif v_finite_idx <> 2 then v_reason := 'finite_not_second'; end if;
  end if;

  if v_reason is null then
    select x into v_t1 from jsonb_array_elements(v_plane->'tokens') x where (x->>'token_index')::int = 1;
    select x into v_t3 from jsonb_array_elements(v_plane->'tokens') x where (x->>'token_index')::int = 3;
    if v_t1 is null or v_t3 is null
       or v_t1->>'subject_evidence' <> 'opposes_subject' or v_t1->>'strength' <> 'default'
       or v_t3->>'subject_evidence' <> 'supports_subject' or v_t3->>'strength' <> 'default' then
      v_reason := 'evidence_pattern_not_ovs';
    end if;
  end if;

  if v_reason is not null then
    return jsonb_set(p_analysis, '{language_graph,pronoun_subject_authority_v1}', jsonb_build_object(
      'version', 'pronoun-subject-authority-v1', 'release_code', p_release_code,
      'status', 'not_applied', 'reason', v_reason), true);
  end if;

  select t->>'surface' into v_finite_surface from jsonb_array_elements(v_tokens) t where (t->>'token_index')::int = 2;
  select t->>'surface' into v_subject_surface from jsonb_array_elements(v_tokens) t where (t->>'token_index')::int = 3;
  v_vp_id := 'vp:2';

  p_analysis := jsonb_set(p_analysis, '{language_graph,phrases}', jsonb_build_array(jsonb_build_object(
    'id', v_vp_id, 'type', 'VP', 'head_token_index', 2, 'head_surface', v_finite_surface, 'role', 'predicate',
    'member_token_indices', jsonb_build_array(2), 'compatibility_origin', 'pronoun_subject_authority_v1')), true);
  p_analysis := jsonb_set(p_analysis, '{language_graph,clauses}', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'id', 'clause:0', 'type', 'finite', 'schema', 'A',
    'subject_token_index', 3, 'subject_surface', v_subject_surface,
    'predicate_phrase_id', v_vp_id, 'finite_token_index', 2, 'finite_surface', v_finite_surface,
    'compatibility_origin', 'pronoun_subject_authority_v1', 'subject_authority', 'pronoun_case_v1'))), true);

  return jsonb_set(p_analysis, '{language_graph,pronoun_subject_authority_v1}', jsonb_build_object(
    'version', 'pronoun-subject-authority-v1', 'release_code', p_release_code,
    'status', 'applied', 'pattern', 'accusative_pronoun_finite_nominative_pronoun',
    'subject_token_index', 3, 'finite_token_index', 2), true);
end;
$function$;

revoke all on function public.apply_pronoun_subject_authority_v1(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_pronoun_subject_authority_v1(jsonb, text) to service_role;

do $$
declare oid_ oid; def text; anchor text; eol text; newdef text;
begin
  select p.oid into oid_ from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='run_canonical_legacy_compatibility_v140'
     and pg_get_function_identity_arguments(p.oid)='p_tokens jsonb, p_release_code text';
  def := pg_get_functiondef(oid_);
  anchor := 'v_analysis:=public.apply_v32_base_structure_from_tokens_v140(v_analysis);';
  eol := case when position(E'\r\n' in def) > 0 then E'\r\n' else E'\n' end;
  newdef := replace(def, anchor,
    anchor || eol || eol || '  -- R107: evidence-driven pronoun subject authority (bounded OVS; inert without R105 evidence).' || eol ||
    '  v_analysis:=public.apply_pronoun_subject_authority_v1(v_analysis,p_release_code);');
  execute newdef;
end $$;

do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='run_canonical_legacy_compatibility_v140';
  if position('apply_pronoun_subject_authority_v1(v_analysis,p_release_code);' in def) = 0
     or position('apply_pronoun_subject_evidence_v1(v_analysis,p_release_code);' in def) = 0
     or position('apply_pronoun_case_evidence_v1(v_analysis,p_release_code);' in def) = 0
     or position('build_rule_execution_plane_v1(' in def) = 0 then
    raise exception 'R107_VERIFY_FAILED: RPC text does not contain all expected calls'; end if;
  if position('apply_pronoun_subject_authority_v1' in def) > position('apply_clause_build_v1' in def) then
    raise exception 'R107_VERIFY_FAILED: authority call must precede clause build'; end if;
  if has_function_privilege('anon', 'public.run_canonical_legacy_compatibility_v140(jsonb,text)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.run_canonical_legacy_compatibility_v140(jsonb,text)'::regprocedure, 'execute') then
    raise exception 'R107_VERIFY_FAILED: RPC became executable for clients'; end if;
end $$;

-- Expected after apply (re-run R106; the v1.37 vs v1.38 comparison is now EXPECTED to differ only for "Meg ser han"):
--   v1.37: unchanged for all 6 sentences.   v1.38: "Meg ser han" clauses 0 -> 1 (subject = token 3), all other sentences
--   identical to v1.37 ("Meg og han ser" has 4 tokens -> not_applied: shape_not_bounded; "Det er meg" -> evidence_pattern_not_ovs).
-- Rollback (manual): remove the two R107 lines from the RPC text (same replace technique) and
--   drop function public.apply_pronoun_subject_authority_v1(jsonb, text);
