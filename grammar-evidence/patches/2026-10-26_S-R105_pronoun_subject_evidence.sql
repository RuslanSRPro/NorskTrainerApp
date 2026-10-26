-- ============================================================================
-- DRAFT R105 -- REVIEW ONLY. Apply to Production only after Ruslan's explicit approval; run R099 first.
-- Adds a SOFT subject-evidence plane on top of R098's pronoun case evidence. Additive only:
--   * new function apply_pronoun_subject_evidence_v1 (decides nothing, changes no token/clause/dependency)
--   * one added call in run_canonical_legacy_compatibility_v140 right after the R098 call
--   * the RPC is patched from its CURRENT stored text (CRLF-safe): the script inserts one line after the R098 call,
--     so any other difference in the stored text is preserved. Nothing existing is removed.
-- Case is DEFAULT evidence (4.1.2 "Hovedregelen"). Guards for the exceptions listed in 4.1.2 that are detectable from
-- tokens: coordination (og/eller), enn/som, for/uten/unntatt, subject predicative (after a copula).
-- NOT detectable from tokens and therefore NOT modelled (declared in the output): detached forms (punctuation is not
-- a token), hun-as-object. Guarded evidence is 'weakened', never dropped; invariant forms (den/det/dere) carry no case.
-- ============================================================================

do $$
declare oid_ oid; def text;
begin
  select p.oid into oid_ from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='run_canonical_legacy_compatibility_v140'
     and pg_get_function_identity_arguments(p.oid)='p_tokens jsonb, p_release_code text';
  if oid_ is null then raise exception 'R105_ABORT: RPC not found'; end if;
  def := pg_get_functiondef(oid_);
  if position('apply_pronoun_case_evidence_v1(v_analysis,p_release_code);' in def) = 0 then
    raise exception 'R105_ABORT: R098 call not present in RPC'; end if;
  if position('apply_pronoun_subject_evidence_v1' in def) > 0 then
    raise exception 'R105_ABORT: R105 call already present'; end if;
  if has_function_privilege('anon', oid_, 'execute') or has_function_privilege('authenticated', oid_, 'execute') then
    raise exception 'R105_ABORT: anon/authenticated can execute the RPC; nested service_role-only call would break them'; end if;
end $$;

create or replace function public.apply_pronoun_subject_evidence_v1(p_analysis jsonb, p_release_code text)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_tokens jsonb := coalesce(p_analysis#>'{language_graph,tokens}', '[]'::jsonb);
  v_ev     jsonb := coalesce(p_analysis#>'{language_graph,pronoun_case_evidence_v1,tokens}', '[]'::jsonb);
  v_items  jsonb := '[]'::jsonb;
  it jsonb; v_idx int; v_case text; v_lemma text; v_prev text; v_next text; v_guards jsonb; v_role text; v_strength text;
begin
  for it in select value from jsonb_array_elements(v_ev) order by (value->>'token_index')::int loop
    v_idx := (it->>'token_index')::int;
    select e->>'case', e->>'lemma' into v_case, v_lemma
      from jsonb_array_elements(it->'evidence') e
      where e->>'case' in ('nominative','accusative') order by e->>'case' limit 1;

    select lower(t->>'surface') into v_prev from jsonb_array_elements(v_tokens) t where (t->>'token_index')::int = v_idx - 1 limit 1;
    select lower(t->>'surface') into v_next from jsonb_array_elements(v_tokens) t where (t->>'token_index')::int = v_idx + 1 limit 1;

    v_guards := '[]'::jsonb;
    if v_case is not null then
      if v_prev in ('og','eller') or v_next in ('og','eller') then v_guards := v_guards || '"coordination"'::jsonb; end if;
      if v_prev in ('enn','som') then v_guards := v_guards || '"enn_som"'::jsonb; end if;
      if v_prev in ('for','uten','unntatt') then v_guards := v_guards || '"preposition_for_uten_unntatt"'::jsonb; end if;
      if v_prev in ('er','var','ble','blir','vaert','vært','blitt','være') then v_guards := v_guards || '"subject_predicative"'::jsonb; end if;
    end if;

    v_role := case v_case when 'nominative' then 'supports_subject'
                          when 'accusative' then 'opposes_subject'
                          else 'case_neutral' end;
    v_strength := case when v_case is null then 'none'
                       when jsonb_array_length(v_guards) > 0 then 'weakened' else 'default' end;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'token_index', v_idx, 'surface', it->>'surface', 'lemma', v_lemma, 'case', v_case,
      'subject_evidence', v_role, 'strength', v_strength, 'guards', v_guards));
  end loop;

  return jsonb_set(p_analysis, '{language_graph,pronoun_subject_evidence_v1}', jsonb_build_object(
    'version', 'pronoun-subject-evidence-v1',
    'release_code', p_release_code,
    'status', case when jsonb_array_length(v_items) = 0 then 'no_evidence' else 'evidence_attached' end,
    'soft_evidence_only', true,
    'decides_clause', false,
    'not_modelled', jsonb_build_array('detached_forms_not_detectable_from_tokens', 'hun_as_object'),
    'tokens', v_items), true);
end;
$function$;

revoke all on function public.apply_pronoun_subject_evidence_v1(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_pronoun_subject_evidence_v1(jsonb, text) to service_role;

-- Patch the RPC from its current stored text: one inserted statement after the R098 call (CRLF-safe).
do $$
declare oid_ oid; def text; anchor text; eol text; newdef text;
begin
  select p.oid into oid_ from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='run_canonical_legacy_compatibility_v140'
     and pg_get_function_identity_arguments(p.oid)='p_tokens jsonb, p_release_code text';
  def := pg_get_functiondef(oid_);
  anchor := 'v_analysis:=public.apply_pronoun_case_evidence_v1(v_analysis,p_release_code);';
  eol := case when position(E'\r\n' in def) > 0 then E'\r\n' else E'\n' end;
  if (length(def) - length(replace(def, anchor, ''))) <> length(anchor) then
    raise exception 'R105_ABORT: R098 call is not present exactly once'; end if;
  newdef := replace(def, anchor,
    anchor || eol || eol || '  -- R105: additive soft subject evidence from pronoun case evidence (decides nothing).' || eol ||
    '  v_analysis:=public.apply_pronoun_subject_evidence_v1(v_analysis,p_release_code);');
  execute newdef;
end $$;

do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='run_canonical_legacy_compatibility_v140';
  if position('apply_pronoun_subject_evidence_v1(v_analysis,p_release_code);' in def) = 0
     or position('apply_pronoun_case_evidence_v1(v_analysis,p_release_code);' in def) = 0
     or position('apply_v32_base_structure_from_tokens_v140(v_analysis);' in def) = 0
     or position('build_rule_execution_plane_v1(' in def) = 0 then
    raise exception 'R105_VERIFY_FAILED: RPC text does not contain all expected calls'; end if;
  if has_function_privilege('anon', 'public.run_canonical_legacy_compatibility_v140(jsonb,text)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.run_canonical_legacy_compatibility_v140(jsonb,text)'::regprocedure, 'execute') then
    raise exception 'R105_VERIFY_FAILED: RPC became executable for clients'; end if;
end $$;

-- Rollback (manual): remove the two R105 lines from the RPC text (same replace technique) and
--   drop function public.apply_pronoun_subject_evidence_v1(jsonb, text);
-- Read-only follow-up: R099-style run on 'Meg ser han' / 'Jeg ser ham' / 'Han ser meg' / 'Katten sover' for v1.38,
-- reading language_graph.pronoun_subject_evidence_v1; clauses/dependencies/phrases must equal v1.37.
