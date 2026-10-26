-- ============================================================================
-- R134 STAGE A APPLY -- REVIEW ONLY. Apply to Production only after Ruslan's explicit approval.
-- Restores what broke after the 2026-09-16 move to lexeme_form_display_v2 (R125-R133):
--   1) normalize_morph_readings_v1: new form-key names mapped to the ones it already handles
--      (preterite->past, noun_*->singular_/plural_*, positive_singular_*->positive_common/neuter/definite);
--   2) new helper noun_gender_evidence_v1(candidate): adds the noun gender from the dictionary article in
--      lexemes.display_form ("et hus" neuter, "ei bok" feminine, "en bil" masculine) to the candidate evidence,
--      only for nouns and only when no gender evidence is present; build_structural_token_v2 passes evidence through it;
--   3) pronoun golden: "I går så vi dem" is no longer a known gap (så now has a preterite reading) ->
--      expects 1 clause, subject = token 4, subject_of from token 4.
-- Both function patches are applied from their CURRENT stored text (whitespace-insensitive), nothing else is touched.
-- GATE (inside the same transaction): the 34-case shadow corpus through analyze_text_structural_shadow_v37 on v1.37
-- must give 34/34 parity with the stored v1.37 projections of 2026-09-01 (batch 90e7c9c2), AND the pronoun golden
-- must pass 63/63. Otherwise the script raises and EVERYTHING is rolled back.
-- Effect is global (all releases incl. v1.37 and the shadow analyzers): that is intended -- it restores the
-- Sept-1 behaviour that broke silently. Rollback after success (manual): restore the two function texts from
-- this script's guards (they are the R126 texts), drop function noun_gender_evidence_v1(jsonb).
-- ============================================================================

begin;

create or replace function public.noun_gender_evidence_v1(p_candidate jsonb)
    returns jsonb language sql stable set search_path to 'public','pg_catalog' as $function$
      select coalesce(p_candidate->'evidence','[]'::jsonb)
        || coalesce((
             select jsonb_build_array(jsonb_build_object('source','lexemes_display_form',
                      'grammatical_features', jsonb_build_object('official_gender',
                        case when l.display_form ~* '^et\s' then 'neuter'
                             when l.display_form ~* '^ei\s' then 'feminine'
                             when l.display_form ~* '^en(/ei)?\s' then 'masculine' end),
                      'display_form', l.display_form))
             from public.lexemes l
             where p_candidate->>'source_pos' = 'noun'
               and l.id = nullif(p_candidate->>'lexeme_id','')::uuid
               and l.display_form ~* '^(et|ei|en)(/ei)?\s'
               and not exists (select 1 from jsonb_array_elements(coalesce(p_candidate->'evidence','[]'::jsonb)) e
                               where e#>>'{grammatical_features,official_gender}' is not null)
           ), '[]'::jsonb)
    $function$;

do $$
declare
  nrm oid := 'public.normalize_morph_readings_v1(text,jsonb,jsonb)'::regprocedure;
  bld oid := 'public.build_structural_token_v2(integer,text,text,text,text,uuid)'::regprocedure;
  ndef text; bdef text; n1 int; n2 int;
  alias_case text := $c$CASE f
        WHEN 'preterite' THEN 'past'
        WHEN 'noun_singular_indefinite' THEN 'singular_indefinite'
        WHEN 'noun_singular_definite' THEN 'singular_definite'
        WHEN 'noun_plural_indefinite' THEN 'plural_indefinite'
        WHEN 'noun_plural_definite' THEN 'plural_definite'
        WHEN 'positive_singular_indefinite_common' THEN 'positive_common'
        WHEN 'positive_singular_indefinite_neuter' THEN 'positive_neuter'
        WHEN 'positive_singular_definite' THEN 'positive_definite'
        ELSE f END$c$;
begin
  ndef := replace(pg_get_functiondef(nrm), E'\r', '');
  bdef := replace(pg_get_functiondef(bld), E'\r', '');
  select count(*) into n1 from regexp_matches(ndef, 'SELECT\s+DISTINCT\s+f\s+FROM', 'g');
  select count(*) into n2 from regexp_matches(bdef, 'coalesce\(\s*v_candidate->''evidence'',\s*''\[\]''::jsonb\s*\)', 'g');
  if n1 <> 1 or n2 <> 1 or position('''preterite''' in ndef) > 0 or position('noun_gender_evidence_v1' in bdef) > 0 then
    raise exception 'R134_ABORT: unexpected function text (normalizer matches=%, builder matches=%)', n1, n2; end if;
  execute regexp_replace(ndef, 'SELECT\s+DISTINCT\s+f\s+FROM', 'SELECT DISTINCT ' || alias_case || ' AS f FROM');
  execute regexp_replace(bdef, 'coalesce\(\s*v_candidate->''evidence'',\s*''\[\]''::jsonb\s*\)', 'public.noun_gender_evidence_v1(v_candidate)');
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
    {"sentence": "Han ser henne", "target": {"clauses": 1, "subject": 1, "authority_status": "not_applied", "authority_reason": "clauses_present", "subject_of_sources": [1]}, "baseline": {"clauses": 1, "subject": 1, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": [1]}},
    {"sentence": "Meg ser han ikke", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Ham kjenner jeg godt", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Henne liker vi ikke", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Meg har han sett", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Ham vil jeg ikke se", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": []}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}, "known_gap": true},
    {"sentence": "Dem kan vi hjelpe", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": []}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}, "known_gap": true},
    {"sentence": "I dag ser jeg ham", "target": {"clauses": 1, "subject": 4, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [4]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Nå hjelper hun meg", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "I går så vi dem", "target": {"clauses": 1, "subject": 4, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [4]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Det vet jeg ikke", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Den har jeg lest", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Ser du meg", "target": {"clauses": 1, "subject": 2, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [2]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}},
    {"sentence": "Hvem ser du", "target": {"clauses": 1, "subject": 3, "authority_status": "applied", "authority_reason": null, "subject_of_sources": [3]}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}}
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
             (select jsonb_agg(jsonb_build_object('legacy_index', w.ord, 'canonical_token_id', 'r134-st-'||w.ord,
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

do $$
declare c record; pp jsonb; cmp jsonb; parity int := 0; total int := 0; diff jsonb := '[]'; gr jsonb;
begin
  for c in select cmpr.case_code, cmpr.input_text, cmpr.shadow_projection sept1
           from public.grammar_shadow_v2_comparisons cmpr
           where cmpr.batch_id = '90e7c9c2-62ee-4ff1-8686-b89d4c3df72b' and cmpr.execution_status = 'completed'
           order by cmpr.case_code loop
    pp := public.project_structural_grammar_shadow_v2(coalesce(public.analyze_text_structural_shadow_v37(c.input_text,'runtime-structural-v1.37')#>'{document_graph,sentences,0,analysis}','{}'));
    cmp := public.compare_grammar_shadow_v2(c.sept1, pp);
    total := total + 1;
    if cmp->>'classification' = 'parity' then parity := parity + 1;
    else diff := diff || jsonb_build_array(jsonb_build_object('case', c.case_code, 'classification', cmp->>'classification', 'labels', cmp->'labels')); end if;
  end loop;
  gr := public.run_pronoun_case_authority_golden_v1();
  if total <> 34 or parity <> 34 or not coalesce((gr->>'ok')::boolean, false) then
    raise exception 'R134_ROLLED_BACK: corpus parity %/% , golden %/% . Corpus diff: % . Golden failed: %',
      parity, total, gr->>'passed', gr->>'total', diff,
      (select jsonb_agg(jsonb_build_object('check', x->>'check', 'actual', x->'actual')) from jsonb_array_elements(gr->'checks') x where not (x->>'passed')::boolean);
  end if;
end $$;

commit;

-- Result (single column r134). Expected: golden 63/63 ok; readings with gender for hus/bil.
select jsonb_pretty(jsonb_build_object(
  'golden', (select jsonb_build_object('passed', g->'passed', 'total', g->'total', 'ok', g->'ok') from (select public.run_pronoun_case_authority_golden_v1() g) x),
  'hus', public.build_structural_token_v2(1,'hus','hus',null,null,(select id from public.grammar_runtime_releases where code='runtime-structural-v1.38'))#>'{morphology,readings}',
  'bil', public.build_structural_token_v2(1,'bil','bil',null,null,(select id from public.grammar_runtime_releases where code='runtime-structural-v1.38'))#>'{morphology,readings}',
  'ble', public.build_structural_token_v2(1,'ble','ble',null,null,(select id from public.grammar_runtime_releases where code='runtime-structural-v1.38'))#>'{morphology,readings}'
)) as r134;
