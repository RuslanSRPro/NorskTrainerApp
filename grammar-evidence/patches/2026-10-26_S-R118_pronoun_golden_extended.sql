-- ============================================================================
-- DRAFT R118 (extends R116, same function signature) -- REVIEW ONLY. Apply to Production only after Ruslan's explicit approval.
-- RPC-level golden checks for the pronoun case -> subject authority slice (R098/R105/R107).
-- Why RPC level: R115 showed the shadow analyzers (analyze_text_structural_shadow_vNN) do not call
-- run_canonical_legacy_compatibility_v140, so the project's shadow gate cannot see this feature.
--
-- Re-creates run_pronoun_case_authority_golden_v1 (R116 helper pronoun_golden_observe_v1 is reused unchanged); R116 adds two functions in schema public, STABLE (read-only), EXECUTE for service_role only, no table writes:
--   pronoun_golden_observe_v1(jsonb)                       -- picks the observable facts out of one RPC result
--   run_pronoun_case_authority_golden_v1(target, baseline) -- 6 sentences x (target release, baseline release) + 2 invariants
-- Expectations live inside the function (decision of 25 Oct). R118 adds 11 sentences (R117 observations) + a self-test:
-- expected totals: 37 checks, 37 passed. Cases flagged known_gap PIN CURRENT behaviour of a known limitation
-- (OVS with an invariant or neutral second pronoun); they are meant to fail when the gap is fixed, prompting an update.
-- Nothing existing is changed or removed. Rollback (manual): drop both functions.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.run_canonical_legacy_compatibility_v140(jsonb,text)') is null then
    raise exception 'R116_ABORT: RPC not found'; end if;
  if to_regprocedure('public.apply_pronoun_subject_authority_v1(jsonb,text)') is null then
    raise exception 'R116_ABORT: R107 not applied'; end if;
  if to_regprocedure('public.pronoun_golden_observe_v1(jsonb)') is null then
    raise exception 'R118_ABORT: R116 helper not applied'; end if;
end $$;

create or replace function public.run_pronoun_case_authority_golden_v1(
  p_release_code text default 'runtime-structural-v1.38',
  p_baseline_release_code text default 'runtime-structural-v1.37')
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $function$
declare
  -- Only the keys listed in "target"/"baseline" are asserted; other observed facts are ignored.
  v_cases constant jsonb := $json$[
    {"sentence":"Meg ser han",
     "target":  {"clauses":1,"subject":3,"authority_status":"applied","authority_reason":null,"subject_of_sources":[3]},
     "baseline":{"clauses":0,"subject":null,"authority_status":"not_applied","authority_reason":"no_subject_evidence","subject_of_sources":[]}},
    {"sentence":"Jeg ser ham",
     "target":  {"clauses":1,"subject":1,"authority_status":"not_applied","authority_reason":"clauses_present","subject_of_sources":[1]},
     "baseline":{"clauses":1,"subject":1,"authority_status":"not_applied","authority_reason":"no_subject_evidence","subject_of_sources":[1]}},
    {"sentence":"Han ser meg",
     "target":  {"clauses":1,"subject":1,"authority_status":"not_applied","authority_reason":"clauses_present","subject_of_sources":[1]},
     "baseline":{"clauses":1,"subject":1,"authority_status":"not_applied","authority_reason":"no_subject_evidence","subject_of_sources":[1]}},
    {"sentence":"Katten sover",
     "target":  {"clauses":1,"authority_status":"not_applied","authority_reason":"no_subject_evidence"},
     "baseline":{"clauses":1,"authority_status":"not_applied","authority_reason":"no_subject_evidence"}},
    {"sentence":"Meg og han ser",
     "target":  {"clauses":1,"subject":3,"authority_status":"not_applied","authority_reason":"clauses_present"},
     "baseline":{"clauses":1,"subject":3,"authority_status":"not_applied","authority_reason":"no_subject_evidence"}},
    {"sentence":"Det er meg",
     "target":  {"clauses":0,"authority_status":"not_applied","authority_reason":"evidence_pattern_not_ovs","subject_of_sources":[]},
     "baseline":{"clauses":0,"authority_status":"not_applied","authority_reason":"no_subject_evidence","subject_of_sources":[]}},
    {"sentence": "Meg ser hun", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Ham ser jeg", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Henne ser jeg", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Dem ser vi", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Oss ser de", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Den ser jeg", "target": {"clauses": 0, "authority_status": "not_applied", "authority_reason": "evidence_pattern_not_ovs", "subject_of_sources": []}, "baseline": {"clauses": 0, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}, "known_gap": true},
    {"sentence": "Det ser jeg", "target": {"clauses": 0, "authority_status": "not_applied", "authority_reason": "evidence_pattern_not_ovs", "subject_of_sources": []}, "baseline": {"clauses": 0, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}, "known_gap": true},
    {"sentence": "Meg ser dere", "target": {"clauses": 0, "authority_status": "not_applied", "authority_reason": "evidence_pattern_not_ovs", "subject_of_sources": []}, "baseline": {"clauses": 0, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}, "known_gap": true},
    {"sentence": "Dere ser meg", "target": {"clauses": 1, "subject": 1, "authority_status": "not_applied", "authority_reason": "clauses_present", "subject_of_sources": [1]}, "baseline": {"clauses": 1, "subject": 1, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": [1]}},
    {"sentence": "Jeg ser han", "target": {"clauses": 1, "subject": 1, "authority_status": "not_applied", "authority_reason": "clauses_present", "subject_of_sources": [1]}, "baseline": {"clauses": 1, "subject": 1, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": [1]}},
    {"sentence": "Han ser henne", "target": {"clauses": 1, "subject": 1, "authority_status": "not_applied", "authority_reason": "clauses_present", "subject_of_sources": [1]}, "baseline": {"clauses": 1, "subject": 1, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": [1]}}
  ]$json$::jsonb;
  c jsonb; side text; v_rel text; v_exp jsonb; v_act jsonb; v_obs jsonb; v_toks jsonb;
  v_results jsonb := '[]'::jsonb; v_total int := 0; v_passed int := 0; v_ok boolean; v_md5 text;
begin
  if not exists (select 1 from public.grammar_runtime_releases where code = p_release_code) then
    raise exception 'R116: target release % not found', p_release_code; end if;
  if not exists (select 1 from public.grammar_runtime_releases where code = p_baseline_release_code) then
    raise exception 'R116: baseline release % not found', p_baseline_release_code; end if;

  for c in select x from jsonb_array_elements(v_cases) x loop
    select jsonb_agg(jsonb_build_object('legacy_index', w.ord, 'canonical_token_id', 'r116-'||w.ord,
             'surface', w.word, 'normalized_surface', lower(w.word), 'kind', 'word') order by w.ord)
      into v_toks
    from unnest(string_to_array(c->>'sentence', ' ')) with ordinality w(word, ord);

    foreach side in array array['target','baseline'] loop
      v_rel := case side when 'target' then p_release_code else p_baseline_release_code end;
      v_exp := c->side;
      v_obs := public.pronoun_golden_observe_v1(public.run_canonical_legacy_compatibility_v140(v_toks, v_rel));
      select jsonb_object_agg(k, v_obs->k) into v_act from jsonb_object_keys(v_exp) k;
      v_ok := (v_act = v_exp);
      v_total := v_total + 1; if v_ok then v_passed := v_passed + 1; end if;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'check', case when c ? 'known_gap' then 'known_gap ' else '' end||side||': '||(c->>'sentence'), 'release', v_rel, 'passed', v_ok,
        'expected', v_exp, 'actual', v_act));
    end loop;
  end loop;

  -- self-test: the comparison must be able to FAIL (a deliberately wrong expectation must not match)
  v_obs := public.pronoun_golden_observe_v1(public.run_canonical_legacy_compatibility_v140(
             (select jsonb_agg(jsonb_build_object('legacy_index', w.ord, 'canonical_token_id', 'r118-st-'||w.ord,
                'surface', w.word, 'normalized_surface', lower(w.word), 'kind', 'word') order by w.ord)
                from unnest(string_to_array('Meg ser han',' ')) with ordinality w(word, ord)), p_release_code));
  select jsonb_object_agg(k, v_obs->k) into v_act from jsonb_object_keys('{"clauses":9}'::jsonb) k;
  v_ok := (v_act <> '{"clauses":9}'::jsonb);
  v_total := v_total + 1; if v_ok then v_passed := v_passed + 1; end if;
  v_results := v_results || jsonb_build_array(jsonb_build_object('check','self-test: wrong expectation is detected','passed',v_ok));

  -- invariant 1: V32 base structure untouched (md5 recorded in R097)
  v_md5 := md5(pg_get_functiondef('public.apply_v32_base_structure_from_tokens_v140(jsonb)'::regprocedure));
  v_ok := (v_md5 = '28301d551fa68a9cfe356d75ec35149f');
  v_total := v_total + 1; if v_ok then v_passed := v_passed + 1; end if;
  v_results := v_results || jsonb_build_array(jsonb_build_object('check','invariant: V32 definition md5','passed',v_ok,
    'expected','28301d551fa68a9cfe356d75ec35149f','actual',v_md5));

  -- invariant 2: RPC and the new functions are closed to clients
  v_ok := not (has_function_privilege('anon','public.run_canonical_legacy_compatibility_v140(jsonb,text)'::regprocedure,'execute')
            or has_function_privilege('authenticated','public.run_canonical_legacy_compatibility_v140(jsonb,text)'::regprocedure,'execute')
            or has_function_privilege('anon','public.apply_pronoun_subject_authority_v1(jsonb,text)'::regprocedure,'execute')
            or has_function_privilege('authenticated','public.apply_pronoun_subject_authority_v1(jsonb,text)'::regprocedure,'execute'));
  v_total := v_total + 1; if v_ok then v_passed := v_passed + 1; end if;
  v_results := v_results || jsonb_build_array(jsonb_build_object('check','invariant: RPC and authority closed to anon/authenticated','passed',v_ok));

  return jsonb_build_object('version','pronoun-case-authority-golden-v1','release_code',p_release_code,
    'baseline_release_code',p_baseline_release_code,'total',v_total,'passed',v_passed,'failed',v_total-v_passed,
    'ok',(v_total = v_passed), 'checks', v_results);
end;
$function$;

revoke all on function public.run_pronoun_case_authority_golden_v1(text, text) from public, anon, authenticated;
grant execute on function public.run_pronoun_case_authority_golden_v1(text, text) to service_role;

-- Result (single column r118). Expected: total 37, passed 37, failed 0, ok true.
select jsonb_pretty(public.run_pronoun_case_authority_golden_v1()) as r118;
