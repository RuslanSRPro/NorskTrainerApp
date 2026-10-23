-- R086: bounded, source-backed pronoun case producer in the service-only pilot.
-- This does not activate a rule, write a graph, or expose a result to the app.
DO $guard$
BEGIN
  IF md5(pg_get_functiondef('grammar_pilot_private.build_pre_rule_plane_v1(jsonb,text)'::regprocedure))
     <> '7be6a79614163ca12589ec9e68f54f30' THEN
    RAISE EXCEPTION 'PILOT_SOURCE_DRIFT';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION grammar_pilot_private.pronoun_case_candidates_v1(p_surface text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
WITH paradigm(lemma,nom,acc) AS (VALUES
  ('jeg','jeg','meg'),('du','du','deg'),('han','han','ham'),
  ('hun','hun','henne'),('den','den','den'),('det','det','det'),
  ('vi','vi','oss'),('dere','dere','dere'),('de','de','dem')
), readings AS (
  SELECT lemma,'Nom' AS grammatical_case FROM paradigm WHERE nom=lower(p_surface)
  UNION ALL
  SELECT lemma,'Acc' AS grammatical_case FROM paradigm WHERE acc=lower(p_surface)
)
SELECT coalesce(jsonb_agg(jsonb_build_object(
  'lemma',lemma,'Case',grammatical_case,'status','candidate','exhaustive',false,
  'source_candidate_id','d99c8781-1212-45ed-a490-df7cfa105ede'
) ORDER BY lemma,grammatical_case),'[]'::jsonb) FROM readings;
$function$;

-- Build-plane registration remains blocked until the SQL pilot is exercised.
INSERT INTO public.grammar_scoped_operator_templates_v1
  (template_code,execution_role,candidate_codes,model_type,builder_contract,
   capability_status,required_capabilities,approval_status,notes)
VALUES
  ('morphological_paradigm.personal_pronoun_case.v1','morphological_paradigm',
   ARRAY['pronoun.personal.forms.bokmal.paradigm'],'grammar_rule',
   'pronoun-paradigm-candidate-producer-v1','blocked',
   jsonb_build_array('source_backed_paradigm','early_case_candidate_producer','bounded_ovs_pilot'),
   'blocked','Compiled case pairs are source-backed; activation and global release membership require separate proof.')
ON CONFLICT (template_code) DO NOTHING;

INSERT INTO public.grammar_runtime_manifests
  (code,primary_candidate_id,topic_id,ir_version,runtime_family,execution_phase,
   execution_mode,capabilities,constraint_strength,diagnostic_policy,
   language_scope,dependencies,bindings,condition,actions,generation,
   explanation,compiler,ir_spec,authoring_status,validation_notes)
SELECT
  'ir.pronoun.personal.forms.bokmal.paradigm',c.id,c.topic_id,'1.0',
  'morphology','morphological_disambiguation','deterministic',
  ARRAY['recognize','generate','explain']::text[],
  'default_with_lexical_exceptions','none',
  '{"written_standards":["nb"]}'::jsonb,
  '{"required_evidence":["source_verified_candidate"]}'::jsonb,
  '{"input":"canonical_tokens","output":"pronoun_case_candidates_v1","candidate_only":true}'::jsonb,
  '{"op":"surface_paradigm_lookup"}'::jsonb,
  '[]'::jsonb,
  '{"enabled":true,"strategy":"source_pair_lookup","exhaustive":false}'::jsonb,
  '{"source_section":"4.1.1","candidate_only":true}'::jsonb,
  '{"strategy":"scoped_operator","operator":"morphological_paradigm","materialize_rule":false}'::jsonb,
  jsonb_build_object('code','ir.pronoun.personal.forms.bokmal.paradigm',
    'ir_version','1.0','operator','morphological_paradigm',
    'source_candidate_id',c.id,'candidate_only',true,'exhaustive',false,
    'pairs',jsonb_build_array(
      jsonb_build_array('jeg','meg'),jsonb_build_array('du','deg'),
      jsonb_build_array('han','ham'),jsonb_build_array('hun','henne'),
      jsonb_build_array('den','den'),jsonb_build_array('det','det'),
      jsonb_build_array('vi','oss'),jsonb_build_array('dere','dere'),
      jsonb_build_array('de','dem'))),
  'draft','R086 service-only SQL pilot; no validated manifest or activation grant.'
FROM public.grammar_knowledge_candidates c
WHERE c.id='d99c8781-1212-45ed-a490-df7cfa105ede'::uuid
  AND c.status='source_verified'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.grammar_runtime_manifest_sources(manifest_id,candidate_id,source_role,notes)
SELECT m.id,m.primary_candidate_id,'primary','R086 source-backed pronoun case paradigm.'
FROM public.grammar_runtime_manifests m
WHERE m.code='ir.pronoun.personal.forms.bokmal.paradigm'
ON CONFLICT DO NOTHING;

REVOKE ALL ON FUNCTION grammar_pilot_private.pronoun_case_candidates_v1(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION grammar_pilot_private.pronoun_case_candidates_v1(text) TO service_role;

CREATE OR REPLACE FUNCTION grammar_pilot_private.apply_pronoun_case_structure_v1(p_analysis jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
DECLARE
  v_tokens jsonb := coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
  v_enriched jsonb := '[]'::jsonb;
  v_token jsonb;
  v_finite int;
  v_prefix jsonb;
  v_suffix jsonb;
  v_subject int;
  v_predicate_surface text;
  v_finite_count int;
BEGIN
  FOR v_token IN SELECT value FROM jsonb_array_elements(v_tokens) ORDER BY (value->>'token_index')::int LOOP
    v_enriched := v_enriched || jsonb_build_array(v_token || jsonb_build_object(
      'pronoun_case_candidates_v1',grammar_pilot_private.pronoun_case_candidates_v1(v_token->>'surface')));
  END LOOP;
  p_analysis := jsonb_set(p_analysis,'{language_graph,tokens}',v_enriched,true);
  IF jsonb_array_length(coalesce(p_analysis#>'{language_graph,clauses}','[]'::jsonb))<>0
     OR jsonb_array_length(v_enriched)<>3 THEN
    RETURN p_analysis;
  END IF;
  SELECT count(DISTINCT (t->>'token_index')::int) INTO v_finite_count
  FROM jsonb_array_elements(v_enriched) t
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(t#>'{morphology,readings}','[]'::jsonb)) mr
  WHERE mr->>'source_pos'='verb' AND mr#>>'{features,VerbForm}'='Fin';
  IF v_finite_count<>1 THEN RETURN p_analysis; END IF;
  SELECT (t->>'token_index')::int,t->>'surface' INTO v_finite,v_predicate_surface
  FROM jsonb_array_elements(v_enriched) t
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(t#>'{morphology,readings}','[]'::jsonb)) mr
  WHERE mr->>'source_pos'='verb' AND mr#>>'{features,VerbForm}'='Fin'
  ORDER BY (t->>'token_index')::int LIMIT 1;
  IF v_finite IS DISTINCT FROM 2 THEN RETURN p_analysis; END IF;
  SELECT t INTO v_prefix FROM jsonb_array_elements(v_enriched) t WHERE t->>'token_index'='1';
  SELECT t INTO v_suffix FROM jsonb_array_elements(v_enriched) t WHERE t->>'token_index'='3';
  IF v_prefix IS NULL OR v_suffix IS NULL THEN RETURN p_analysis; END IF;
  -- Only the bounded Acc-only / Nom-only surface contrast is admitted.
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_prefix->'pronoun_case_candidates_v1') r WHERE r->>'Case'='Acc')
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_prefix->'pronoun_case_candidates_v1') r WHERE r->>'Case'='Nom')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_suffix->'pronoun_case_candidates_v1') r WHERE r->>'Case'='Nom')
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_suffix->'pronoun_case_candidates_v1') r WHERE r->>'Case'='Acc') THEN
    RETURN p_analysis;
  END IF;
  v_subject := 3;
  p_analysis := jsonb_set(p_analysis,'{language_graph,phrases}',jsonb_build_array(jsonb_build_object(
    'id','vp:2','type','VP','head_token_index',2,'head_surface',v_predicate_surface,
    'role','predicate','member_token_indices',jsonb_build_array(2),
    'compatibility_origin','pronoun_case_pilot_v1')),true);
  p_analysis := jsonb_set(p_analysis,'{language_graph,clauses}',jsonb_build_array(jsonb_build_object(
    'id','clause:0','type','finite','schema','A','subject_token_index',v_subject,
    'subject_surface',v_suffix->>'surface','predicate_phrase_id','vp:2',
    'finite_token_index',2,'finite_surface',v_predicate_surface,
    'compatibility_origin','pronoun_case_pilot_v1','case_evidence_status','candidate_only')),
    true);
  RETURN p_analysis || jsonb_build_object('pronoun_case_pilot_v1',jsonb_build_object(
    'status','bounded_candidate','source_candidate_id','d99c8781-1212-45ed-a490-df7cfa105ede',
    'subject_token_index',v_subject,'exhaustive',false));
END;
$function$;

REVOKE ALL ON FUNCTION grammar_pilot_private.apply_pronoun_case_structure_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION grammar_pilot_private.apply_pronoun_case_structure_v1(jsonb) TO service_role;

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
