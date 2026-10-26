-- ============================================================================
-- DRAFT R119 v2 (whitespace-insensitive match; v1 aborted safely, nothing changed) -- REVIEW ONLY. Apply to Production only after Ruslan's explicit approval.
-- Closes the known gap found in R117/R118: "Den ser jeg", "Det ser jeg", "Meg ser dere" gave 0 clauses.
--
-- Change 1: apply_pronoun_subject_authority_v1 (R107) accepts two more evidence patterns in the SAME bounded frame
--   (no clause from V32, no connector, exactly 3 tokens, exactly one finite verb and it is token 2, both tokens 1 and 3
--   present in the R105 evidence plane, i.e. both are pronouns):
--     a) existing: token1 accusative (opposes, default)  + token3 nominative (supports, default)
--     b) NEW:      token1 invariant  (case_neutral)       + token3 nominative (supports, default)  -> "Den ser jeg"
--     c) NEW:      token1 accusative (opposes, default)  + token3 invariant  (case_neutral)       -> "Meg ser dere"
--   Reasoning: in a 3-token V2 frame with one finite verb there are two candidate positions; a default nominative after
--   the verb must be the subject (b), and a default accusative before it cannot be, leaving token 3 (c).
--   Still NOT applied: both nominative ("Hun ser han"), weakened evidence (coordination, enn/som, predicative after
--   copula: "Det er meg"), non-pronoun token 1 ("Katten ser jeg"), anything longer than 3 tokens.
--   The function is patched in place from its CURRENT stored text (CRLF-safe): the pattern check is replaced and the
--   recorded "pattern" names which of a/b/c fired. Signature, ACL and the RPC are untouched.
-- Change 2: golden expectations updated (the three known_gap cases now expect a clause with subject = token 3).
-- Rollback (manual): re-run the DRAFT_R107 function body (create or replace) and the DRAFT_R118 golden.
-- ============================================================================

do $$
declare def text;
begin
  def := replace(pg_get_functiondef('public.apply_pronoun_subject_authority_v1(jsonb,text)'::regprocedure), E'\r', '');
  if position($q$v_reason := 'evidence_pattern_not_ovs';$q$ in def) = 0
     or position($q$'pattern', 'accusative_pronoun_finite_nominative_pronoun',$q$ in def) = 0
     or position('v_subject_surface text; v_vp_id text;' in def) = 0
     or position('v_pattern' in def) > 0 then
    raise exception 'R119_ABORT: authority function is not the R107 text expected';
  end if;
  if to_regprocedure('public.pronoun_golden_observe_v1(jsonb)') is null then
    raise exception 'R119_ABORT: R116 helper not applied'; end if;
end $$;

do $$
declare oid_ oid := 'public.apply_pronoun_subject_authority_v1(jsonb,text)'::regprocedure; def text; n int; p int;
  -- whitespace-insensitive match of the R107 pattern check (R119 v1 failed on an exact multi-line match)
  old_re text := $r$if\s+v_t1\s+is\s+null\s+or\s+v_t3\s+is\s+null\s+or\s+v_t1->>'subject_evidence'\s+<>\s+'opposes_subject'\s+or\s+v_t1->>'strength'\s+<>\s+'default'\s+or\s+v_t3->>'subject_evidence'\s+<>\s+'supports_subject'\s+or\s+v_t3->>'strength'\s+<>\s+'default'\s+then\s+v_reason\s+:=\s+'evidence_pattern_not_ovs';\s+end\s+if;$r$;
  new_check text := $n$v_pattern := case
      when v_t1 is null or v_t3 is null then null
      when v_t1->>'subject_evidence' = 'opposes_subject' and v_t1->>'strength' = 'default'
       and v_t3->>'subject_evidence' = 'supports_subject' and v_t3->>'strength' = 'default'
        then 'accusative_pronoun_finite_nominative_pronoun'
      when v_t1->>'subject_evidence' = 'case_neutral'
       and v_t3->>'subject_evidence' = 'supports_subject' and v_t3->>'strength' = 'default'
        then 'caseless_pronoun_finite_nominative_pronoun'
      when v_t1->>'subject_evidence' = 'opposes_subject' and v_t1->>'strength' = 'default'
       and v_t3->>'subject_evidence' = 'case_neutral'
        then 'accusative_pronoun_finite_caseless_pronoun'
    end;
    if v_pattern is null then
      v_reason := 'evidence_pattern_not_ovs';
    end if;$n$;
begin
  def := replace(pg_get_functiondef(oid_), E'\r', '');
  select count(*) into n from regexp_matches(def, old_re, 'g');
  if n <> 1 then
    p := position('evidence_pattern_not_ovs' in def);
    raise exception 'R119_ABORT: pattern check matched % times. Context (tab=<TAB>, newline=<NL>): %', n,
      replace(replace(substr(def, greatest(p-420,1), 470), E'\t', '<TAB>'), E'\n', '<NL>');
  end if;
  def := regexp_replace(def, old_re, new_check);
  def := replace(def, $q$'pattern', 'accusative_pronoun_finite_nominative_pronoun',$q$, $q$'pattern', v_pattern,$q$);
  def := replace(def, 'v_subject_surface text; v_vp_id text;', 'v_subject_surface text; v_vp_id text; v_pattern text;');
  execute def;
end $$;

do $$
declare def text := pg_get_functiondef('public.apply_pronoun_subject_authority_v1(jsonb,text)'::regprocedure);
begin
  if position('caseless_pronoun_finite_nominative_pronoun' in def) = 0
     or position('accusative_pronoun_finite_caseless_pronoun' in def) = 0
     or position($q$'pattern', v_pattern$q$ in def) = 0 then
    raise exception 'R119_VERIFY_FAILED: authority patch not in place'; end if;
  if has_function_privilege('anon','public.apply_pronoun_subject_authority_v1(jsonb,text)'::regprocedure,'execute')
     or has_function_privilege('authenticated','public.apply_pronoun_subject_authority_v1(jsonb,text)'::regprocedure,'execute') then
    raise exception 'R119_VERIFY_FAILED: authority executable by clients'; end if;
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
    {"sentence": "Den ser jeg", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Det ser jeg", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Meg ser dere", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
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
             (select jsonb_agg(jsonb_build_object('legacy_index', w.ord, 'canonical_token_id', 'r119-st-'||w.ord,
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

-- Result (single column r119). Expected: total 37, passed 37, failed 0, ok true
-- (the three former known_gap sentences now expect: 1 clause, subject = token 3, authority applied).
select jsonb_pretty(public.run_pronoun_case_authority_golden_v1()) as r119;
