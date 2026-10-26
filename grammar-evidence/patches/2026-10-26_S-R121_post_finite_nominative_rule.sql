-- ============================================================================
-- DRAFT R121 v2 (v1 rolled back safely at 60/63; nothing changed) -- REVIEW ONLY. Apply to Production only after Ruslan's explicit approval.
-- Rule 2 for the pronoun subject authority, from R120 (16 longer sentences: 3 right, 0 wrong, 13 silent in both releases).
-- Norwegian V2: when the subject is not first, it comes right after the finite verb.
--   Rule 2 fires only when V32 built no clause, there is no connector, the R105 plane is attached, and
--   * the sentence has EXACTLY ONE pronoun with nominative case at full strength (no guards), and
--   * the token right before it has a finite verb reading.
--   Then that pronoun is the subject and the preceding token is the finite verb.
--   Covers: object first ("Meg ser han ikke", "Meg har han sett"), adverbial first ("I dag ser jeg ham"),
--   invariant first ("Det vet jeg ikke"), verb-first and wh-questions ("Ser du meg", "Hvem ser du").
--   Still silent: two nominatives, weakened nominative (coordination, enn/som, predicative), no finite verb right
--   before the nominative, any sentence where V32 already built a clause.
-- Rule 1 (R107 + R119, 3-token patterns a/b/c) is unchanged and tried first; its failure reasons are kept when rule 2
-- does not fire either. One behaviour change on rule 1: the VP is now ADDED to existing phrases instead of replacing
-- the phrases array (nothing upstream is discarded any more).
-- The function is re-created whole (same signature); ACL re-asserted. The RPC and V32 are untouched.
-- v2 changes after R122-R124:
--   * rule 2 records its SOURCE: provenance = NRG candidates (runtime) 9.2 schema A slot order F-v-n (cbf5deb2),
--     9.4.2.2 direct object in prefield, 9.4.2.3 free adverbial in prefield, 9.3.1 yes/no and wh questions,
--     plus 9.1 cbc2cae7 as explanation reference. The script aborts if these candidates are missing/unverified.
--   * three golden cases become known_gap, pinned to current behaviour (they must fail when the gap is fixed):
--     "Ham vil jeg ikke se", "Dem kan vi hjelpe": clause + subject are right, but no subject_of because construction
--       recognition defers "vil jeg"/"kan vi" as modal_ellipsis_motion (it looks at the token right after the modal,
--       which in inversion is the subject) -> no predicate; upstream, not in this patch.
--     "I går så vi dem": "så" has no morphology reading at all (preterite forms are absent from lexeme_form_variants).
-- SAFETY: the whole script runs in ONE transaction and ends with the golden suite (37 old + 26 new checks = 63).
-- If any check fails, the script raises and everything is rolled back: Production keeps R119 exactly as it is now.
-- Rollback after success (manual): re-run the R107 function body, then the DRAFT_R119 function patch and golden.
-- ============================================================================

begin;

do $$
declare def text := pg_get_functiondef('public.apply_pronoun_subject_authority_v1(jsonb,text)'::regprocedure);
begin
  if position('caseless_pronoun_finite_nominative_pronoun' in def) = 0 then
    raise exception 'R121_ABORT: R119 is not in place'; end if;
  if position('post_finite_nominative_pronoun' in def) > 0 then
    raise exception 'R121_ABORT: R121 already applied'; end if;
  if to_regprocedure('public.pronoun_golden_observe_v1(jsonb)') is null then
    raise exception 'R121_ABORT: R116 helper not applied'; end if;
  -- rule 2 provenance: runtime candidates must exist, be source_verified and KEEP_GRAMMAR_RUNTIME; the reference one source_verified
  if (select count(*) from public.grammar_knowledge_candidates c
       where c.id in ('cbf5deb2-3c0a-4461-850d-87fd8f0d772f','63046d96-6f82-455d-818b-cae1b82b4112','a2e1104d-4c15-4f20-816c-28cd2d899450',
                      '01c73998-7ea6-4872-ba52-7abbc8d46591','1e731c5d-0f35-4350-b417-76b9f7efc552')
         and c.status = 'source_verified' and c.execution_contract#>>'{audit,disposition}' = 'KEEP_GRAMMAR_RUNTIME') <> 5
     or not exists (select 1 from public.grammar_knowledge_candidates c
       where c.id = 'cbc2cae7-fc9f-4cf4-8ad9-0ecb6386d702' and c.status = 'source_verified') then
    raise exception 'R121_ABORT: rule 2 source candidates are not all present / verified / runtime';
  end if;
end $$;

create or replace function public.apply_pronoun_subject_authority_v1(p_analysis jsonb, p_release_code text)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $function$
-- R107 (bounded 3-token OVS) + R119 (patterns b, c) + R121 (rule 2: post-finite nominative pronoun, V2 inversion).
declare
  v_tokens jsonb := coalesce(p_analysis#>'{language_graph,tokens}', '[]'::jsonb);
  v_plane  jsonb := p_analysis#>'{language_graph,pronoun_subject_evidence_v1}';
  v_n int; v_finite_count int; v_finite_idx int; v_finite_surface text;
  v_t1 jsonb; v_t3 jsonb; v_reason text := null; v_pattern text;
  v_subject_idx int; v_subject_surface text; v_vp_id text;
  v_nom_count int; v_nom_idx int;
begin
  select count(*) into v_n from jsonb_array_elements(v_tokens);

  -- gates shared by both rules
  if coalesce(v_plane->>'status','') <> 'evidence_attached' then
    v_reason := 'no_subject_evidence';
  elsif jsonb_array_length(coalesce(p_analysis#>'{language_graph,clauses}','[]'::jsonb)) > 0 then
    v_reason := 'clauses_present';
  elsif exists (select 1 from jsonb_array_elements(v_tokens) t where public.structural_token_has_class_v1(t,'subjunction_connector')) then
    v_reason := 'connector_present';
  end if;
  if v_reason in ('no_subject_evidence','clauses_present','connector_present') then
    return jsonb_set(p_analysis, '{language_graph,pronoun_subject_authority_v1}', jsonb_build_object(
      'version', 'pronoun-subject-authority-v1', 'release_code', p_release_code,
      'status', 'not_applied', 'reason', v_reason), true);
  end if;

  -- rule 1 (R107/R119): exactly 3 tokens, one finite verb at token 2, evidence patterns a/b/c
  if v_n <> 3 then
    v_reason := 'shape_not_bounded';
  else
    select count(distinct (t->>'token_index')::int), min((t->>'token_index')::int)
      into v_finite_count, v_finite_idx
    from jsonb_array_elements(v_tokens) t
    cross join lateral jsonb_array_elements(coalesce(t#>'{morphology,readings}','[]'::jsonb)) mr
    where mr->>'source_pos' = 'verb' and mr#>>'{features,VerbForm}' = 'Fin';
    if v_finite_count <> 1 then v_reason := 'finite_count_not_one';
    elsif v_finite_idx <> 2 then v_reason := 'finite_not_second';
    else
      select x into v_t1 from jsonb_array_elements(v_plane->'tokens') x where (x->>'token_index')::int = 1;
      select x into v_t3 from jsonb_array_elements(v_plane->'tokens') x where (x->>'token_index')::int = 3;
      v_pattern := case
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
      if v_pattern is null then v_reason := 'evidence_pattern_not_ovs';
      else v_subject_idx := 3; v_finite_idx := 2; end if;
    end if;
  end if;

  -- rule 2 (R121): exactly one default nominative pronoun in the sentence, and the token right before it has a
  -- finite verb reading -> that pronoun is the subject (V2 inversion: object/adverbial/wh first, or verb-first question).
  if v_subject_idx is null then
    select count(*), min((x->>'token_index')::int) into v_nom_count, v_nom_idx
    from jsonb_array_elements(coalesce(v_plane->'tokens','[]'::jsonb)) x
    where x->>'subject_evidence' = 'supports_subject' and x->>'strength' = 'default';
    if v_nom_count = 1 and v_nom_idx > 1 and exists (
         select 1 from jsonb_array_elements(v_tokens) t
         cross join lateral jsonb_array_elements(coalesce(t#>'{morphology,readings}','[]'::jsonb)) mr
         where (t->>'token_index')::int = v_nom_idx - 1
           and mr->>'source_pos' = 'verb' and mr#>>'{features,VerbForm}' = 'Fin') then
      v_subject_idx := v_nom_idx; v_finite_idx := v_nom_idx - 1;
      v_pattern := 'post_finite_nominative_pronoun';
    end if;
  end if;

  if v_subject_idx is null then
    return jsonb_set(p_analysis, '{language_graph,pronoun_subject_authority_v1}', jsonb_build_object(
      'version', 'pronoun-subject-authority-v1', 'release_code', p_release_code,
      'status', 'not_applied', 'reason', v_reason), true);
  end if;

  select t->>'surface' into v_finite_surface from jsonb_array_elements(v_tokens) t where (t->>'token_index')::int = v_finite_idx;
  select t->>'surface' into v_subject_surface from jsonb_array_elements(v_tokens) t where (t->>'token_index')::int = v_subject_idx;
  v_vp_id := 'vp:' || v_finite_idx;

  -- add the VP without discarding phrases already built upstream (a phrase with the same id is replaced)
  p_analysis := jsonb_set(p_analysis, '{language_graph,phrases}',
    coalesce((select jsonb_agg(ph) from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,phrases}','[]'::jsonb)) ph
              where ph->>'id' is distinct from v_vp_id), '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'id', v_vp_id, 'type', 'VP', 'head_token_index', v_finite_idx, 'head_surface', v_finite_surface, 'role', 'predicate',
      'member_token_indices', jsonb_build_array(v_finite_idx), 'compatibility_origin', 'pronoun_subject_authority_v1')), true);
  p_analysis := jsonb_set(p_analysis, '{language_graph,clauses}', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'id', 'clause:0', 'type', 'finite', 'schema', 'A',
    'subject_token_index', v_subject_idx, 'subject_surface', v_subject_surface,
    'predicate_phrase_id', v_vp_id, 'finite_token_index', v_finite_idx, 'finite_surface', v_finite_surface,
    'compatibility_origin', 'pronoun_subject_authority_v1', 'subject_authority', 'pronoun_case_v1'))), true);

  return jsonb_set(p_analysis, '{language_graph,pronoun_subject_authority_v1}', jsonb_build_object(
    'version', 'pronoun-subject-authority-v1', 'release_code', p_release_code,
    'status', 'applied', 'pattern', v_pattern,
    'subject_token_index', v_subject_idx, 'finite_token_index', v_finite_idx)
    || case when v_pattern = 'post_finite_nominative_pronoun' then jsonb_build_object('provenance', jsonb_build_array(
         jsonb_build_object('candidate_id','cbf5deb2-3c0a-4461-850d-87fd8f0d772f','candidate_code','sentence.word_order.schema.a.slot_order','source_section','9.2','role','schema_a_resolver: F-v-n, subject slot n follows the finite verb v'),
         jsonb_build_object('candidate_id','63046d96-6f82-455d-818b-cae1b82b4112','candidate_code','sentence.word_order.prefield.object.direct_object_allowed','source_section','9.4.2.2','role','direct object may fill the prefield'),
         jsonb_build_object('candidate_id','a2e1104d-4c15-4f20-816c-28cd2d899450','candidate_code','sentence.word_order.prefield.adverbial.free_adverbial_allowed','source_section','9.4.2.3','role','free adverbial may fill the prefield'),
         jsonb_build_object('candidate_id','01c73998-7ea6-4872-ba52-7abbc8d46591','candidate_code','sentence.word_order.main_clause.yes_no_question.empty_prefield_finite_first','source_section','9.3.1','role','yes/no question: finite verb first'),
         jsonb_build_object('candidate_id','1e731c5d-0f35-4350-b417-76b9f7efc552','candidate_code','sentence.word_order.main_clause.wh_question.filled_prefield','source_section','9.3.1','role','wh-question: wh constituent in the prefield'),
         jsonb_build_object('candidate_id','cbc2cae7-fc9f-4cf4-8ad9-0ecb6386d702','candidate_code','sentence.word_order.v2.non_subject_first_subject_after_finite_reference','source_section','9.1','role','reference for explanation only')))
       else '{}'::jsonb end, true);
end;
$function$;

revoke all on function public.apply_pronoun_subject_authority_v1(jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_pronoun_subject_authority_v1(jsonb, text) to service_role;

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
    {"sentence": "I går så vi dem", "target": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "shape_not_bounded", "subject_of_sources": []}, "baseline": {"clauses": 0, "subject": null, "authority_status": "not_applied", "authority_reason": "no_subject_evidence", "subject_of_sources": []}, "known_gap": true},
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
             (select jsonb_agg(jsonb_build_object('legacy_index', w.ord, 'canonical_token_id', 'r121-st-'||w.ord,
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


-- golden gate inside the transaction: any failed check rolls everything back
do $$
declare r jsonb := public.run_pronoun_case_authority_golden_v1();
begin
  if not coalesce((r->>'ok')::boolean, false) then
    raise exception 'R121_ROLLED_BACK: golden % of % passed. Failed: %', r->>'passed', r->>'total',
      left((select jsonb_agg(jsonb_build_object('check', c->>'check', 'actual', c->'actual'))::text
            from jsonb_array_elements(r->'checks') c where not (c->>'passed')::boolean), 3000);
  end if;
end $$;

commit;

-- Result (single column r121). Expected: total 63, passed 63, failed 0, ok true.
select jsonb_pretty(public.run_pronoun_case_authority_golden_v1()) as r121;
