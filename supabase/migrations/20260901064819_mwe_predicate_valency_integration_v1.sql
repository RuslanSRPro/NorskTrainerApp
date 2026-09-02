create or replace function public.mwe_predicate_complement_frame_assessment_v1(
  p_release_code text,
  p_mwe_code text,
  p_complement_type text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  facts jsonb;
  lic int;
  exc int;
  sense int;
begin
  facts := public.runtime_constraint_facts_v1(
    p_release_code,
    'predicate_complement_frame',
    'mwe_predicate',
    p_mwe_code,
    'licenses_complement',
    'construction_family',
    p_complement_type
  );

  select
    count(*) filter (where x->>'polarity'='license'),
    count(*) filter (where x->>'polarity'='exclude'),
    count(*) filter (
      where coalesce(x#>'{conditions,source_requires}','[]'::jsonb) @> '["predicate_sense"]'::jsonb
    )
  into lic, exc, sense
  from jsonb_array_elements(facts) x;

  return jsonb_build_object(
    'version','mwe-predicate-complement-frame-assessment-v1',
    'subject_type','mwe_predicate',
    'mwe_code',p_mwe_code,
    'complement_type',p_complement_type,
    'license_count',lic,
    'exclude_count',exc,
    'predicate_sense_required_count',sense,
    'facts',facts,
    'status',case
      when exc>0 then 'excluded'
      when lic=0 then 'no_frame'
      when sense>0 then 'licensed_but_predicate_sense_required'
      else 'licensed'
    end
  );
end;
$$;

create or replace function public.mwe_predicate_valency_profile_v1(
  p_release_code text,
  p_mwe_code text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  facts jsonb;
  licenses jsonb;
  excludes jsonb;
  sense_required boolean;
begin
  facts := public.runtime_constraint_facts_v1(
    p_release_code,
    'predicate_complement_frame',
    'mwe_predicate',
    p_mwe_code,
    'licenses_complement',
    'construction_family',
    null
  );

  select
    coalesce(jsonb_agg(to_jsonb(x->>'object_key') order by x->>'object_key') filter (where x->>'polarity'='license'),'[]'::jsonb),
    coalesce(jsonb_agg(to_jsonb(x->>'object_key') order by x->>'object_key') filter (where x->>'polarity'='exclude'),'[]'::jsonb),
    coalesce(bool_or(coalesce(x#>'{conditions,source_requires}','[]'::jsonb) @> '["predicate_sense"]'::jsonb),false)
  into licenses, excludes, sense_required
  from jsonb_array_elements(facts) x;

  return jsonb_build_object(
    'version','mwe-predicate-valency-profile-v1',
    'mwe_code',p_mwe_code,
    'subject_type','mwe_predicate',
    'licenses',licenses,
    'excludes',excludes,
    'license_count',jsonb_array_length(licenses),
    'exclude_count',jsonb_array_length(excludes),
    'predicate_sense_required',sense_required,
    'facts',facts
  );
end;
$$;

create or replace function public.build_mwe_predicate_valency_integration_v1(
  p_analysis jsonb,
  p_release_code text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  base jsonb := coalesce(p_analysis#>'{language_graph,predicate_build_v1}','{}'::jsonb);
  mwe jsonb := coalesce(p_analysis#>'{language_graph,multiword_function_expression_v1}','{}'::jsonb);
  base_preds jsonb := coalesce(base->'predicates','[]'::jsonb);
  canonical_preds jsonb := '[]'::jsonb;
  resolved_mwe jsonb := '[]'::jsonb;
  mwe_hyp jsonb := '[]'::jsonb;
  mwe_blocked jsonb := '[]'::jsonb;
  e jsonb;
  bp jsonb;
  repl jsonb;
  members jsonb;
  profile jsonb;
  start_idx int;
  end_idx int;
  policy text;
  base_id text;
  replaced_ids text[] := array[]::text[];
begin
  if not exists(select 1 from public.grammar_runtime_releases where code=p_release_code) then
    raise exception 'Release % not found', p_release_code;
  end if;

  for e in
    select x
    from jsonb_array_elements(coalesce(mwe->'candidate_expressions','[]'::jsonb)) x
    where x->>'mwe_family'='predicate_expression'
    order by nullif(x->>'start_token_index','')::int, x->>'mwe_code'
  loop
    start_idx := nullif(e->>'start_token_index','')::int;
    end_idx := nullif(e->>'end_token_index','')::int;
    policy := e->>'resolution_policy';
    bp := null;

    select x into bp
    from jsonb_array_elements(base_preds) x
    where x->>'status'='resolved'
      and (
        nullif(x->>'finite_token_index','')::int=start_idx
        or nullif(x->>'lexical_head_token_index','')::int=start_idx
        or nullif(x->>'grammatical_head_token_index','')::int=start_idx
      )
    order by
      case when nullif(x->>'lexical_head_token_index','')::int=start_idx then 0 else 1 end,
      x->>'id'
    limit 1;

    profile := public.mwe_predicate_valency_profile_v1(p_release_code,e->>'mwe_code');

    if bp is null then
      mwe_blocked := mwe_blocked || jsonb_build_array(
        e || jsonb_build_object(
          'status','blocked',
          'reason_code','mwe_predicate_base_predicate_not_resolved',
          'required_capability','predicate_resolution',
          'valency_profile',profile,
          'learner_error',false
        )
      );
      continue;
    end if;

    base_id := bp->>'id';

    if policy='candidate_requires_predicate_sense' then
      mwe_hyp := mwe_hyp || jsonb_build_array(
        jsonb_build_object(
          'id','predmweh1:'||(e->>'mwe_code')||':'||start_idx,
          'status','hypothesis',
          'predicate_kind','multiword_verbal',
          'surface',e->>'surface',
          'span_start',least(coalesce(nullif(bp->>'span_start','')::int,start_idx),start_idx),
          'span_end',greatest(coalesce(nullif(bp->>'span_end','')::int,end_idx),end_idx),
          'finite_token_index',bp->'finite_token_index',
          'grammatical_head_token_index',bp->'grammatical_head_token_index',
          'lexical_head_token_index',bp->'lexical_head_token_index',
          'source_predicate_id',base_id,
          'mwe_expression_id',e->>'id',
          'mwe_code',e->>'mwe_code',
          'functional_identity','unresolved',
          'sequence_identity','resolved',
          'valency_profile',profile,
          'reason_code','predicate_sense_required_by_source',
          'required_capability','predicate_sense_resolution',
          'provenance',coalesce(e->'provenance','[]'::jsonb),
          'learner_error',false
        )
      );
      continue;
    end if;

    if policy<>'candidate_requires_predicate_frame' or coalesce((profile->>'license_count')::int,0)=0 then
      mwe_blocked := mwe_blocked || jsonb_build_array(
        jsonb_build_object(
          'id','predmweb1:'||(e->>'mwe_code')||':'||start_idx,
          'status','blocked',
          'predicate_kind','multiword_verbal',
          'surface',e->>'surface',
          'source_predicate_id',base_id,
          'mwe_expression_id',e->>'id',
          'mwe_code',e->>'mwe_code',
          'valency_profile',profile,
          'reason_code','source_verified_mwe_valency_frame_not_available',
          'required_capability','mwe_predicate_valency_coverage',
          'learner_error',false
        )
      );
      continue;
    end if;

    if base_id = any(replaced_ids) then
      mwe_blocked := mwe_blocked || jsonb_build_array(
        jsonb_build_object(
          'id','predmweb1:overlap:'||(e->>'mwe_code')||':'||start_idx,
          'status','blocked',
          'source_predicate_id',base_id,
          'mwe_expression_id',e->>'id',
          'mwe_code',e->>'mwe_code',
          'reason_code','multiple_mwe_predicate_candidates_same_base_predicate',
          'required_capability','mwe_predicate_conflict_resolution',
          'learner_error',false
        )
      );
      continue;
    end if;

    select coalesce(jsonb_agg(v order by v),'[]'::jsonb)
    into members
    from (
      select distinct (z)::int as v
      from jsonb_array_elements_text(coalesce(bp->'member_token_indices','[]'::jsonb)) z
      union
      select generate_series(start_idx,end_idx)
    ) q;

    repl := bp || jsonb_build_object(
      'id','predmwe1:'||(e->>'mwe_code')||':'||start_idx,
      'status','resolved',
      'predicate_kind','multiword_verbal',
      'surface',e->>'surface',
      'span_start',least(coalesce(nullif(bp->>'span_start','')::int,start_idx),start_idx),
      'span_end',greatest(coalesce(nullif(bp->>'span_end','')::int,end_idx),end_idx),
      'member_token_indices',members,
      'source_predicate_id',base_id,
      'mwe_expression_id',e->>'id',
      'mwe_code',e->>'mwe_code',
      'mwe_head_lemma',e->>'head_lemma',
      'sequence_identity','resolved',
      'functional_identity','resolved',
      'valency_profile',profile,
      'reason_code','source_verified_mwe_predicate_frame_resolved',
      'provenance',coalesce(bp->'provenance','[]'::jsonb) || coalesce(e->'provenance','[]'::jsonb),
      'learner_error',false
    );

    resolved_mwe := resolved_mwe || jsonb_build_array(repl);
    replaced_ids := array_append(replaced_ids,base_id);
  end loop;

  for bp in select x from jsonb_array_elements(base_preds) x order by coalesce(nullif(x->>'span_start','')::int,2147483647), x->>'id'
  loop
    select x into repl
    from jsonb_array_elements(resolved_mwe) x
    where x->>'source_predicate_id'=bp->>'id'
    order by x->>'id'
    limit 1;

    if repl is null then
      canonical_preds := canonical_preds || jsonb_build_array(bp);
    else
      canonical_preds := canonical_preds || jsonb_build_array(repl);
    end if;
    repl := null;
  end loop;

  return jsonb_build_object(
    'version','predicate-build-v1+mwe-valency-integration-v1',
    'status','ready',
    'base_version',base->>'version',
    'predicates',canonical_preds,
    'predicate_hypotheses',coalesce(base->'predicate_hypotheses','[]'::jsonb) || mwe_hyp,
    'blocked_predicates',coalesce(base->'blocked_predicates','[]'::jsonb) || mwe_blocked,
    'mwe_integration',jsonb_build_object(
      'version','mwe-predicate-valency-integration-v1',
      'resolved_mwe_predicates',resolved_mwe,
      'mwe_predicate_hypotheses',mwe_hyp,
      'blocked_mwe_predicates',mwe_blocked,
      'summary',jsonb_build_object(
        'resolved_mwe_predicate_count',jsonb_array_length(resolved_mwe),
        'sense_hypothesis_count',jsonb_array_length(mwe_hyp),
        'blocked_count',jsonb_array_length(mwe_blocked),
        'base_predicate_count',jsonb_array_length(base_preds),
        'canonical_predicate_count',jsonb_array_length(canonical_preds),
        'source_graph_runtime_reads',0,
        'learner_error_claims',0
      )
    ),
    'summary',jsonb_build_object(
      'predicate_count',jsonb_array_length(canonical_preds),
      'hypothesis_count',jsonb_array_length(coalesce(base->'predicate_hypotheses','[]'::jsonb) || mwe_hyp),
      'blocked_count',jsonb_array_length(coalesce(base->'blocked_predicates','[]'::jsonb) || mwe_blocked),
      'finite_count',(select count(*) from jsonb_array_elements(canonical_preds) p where p->>'finiteness'='finite'),
      'nonfinite_count',(select count(*) from jsonb_array_elements(canonical_preds) p where p->>'finiteness'='nonfinite')
    )
  );
end;
$$;

create or replace function public.apply_mwe_predicate_valency_integration_v1(
  p_analysis jsonb,
  p_release_code text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  a jsonb := p_analysis;
  base_pred jsonb := coalesce(p_analysis#>'{language_graph,predicate_build_v1}','{}'::jsonb);
  base_clause jsonb := coalesce(p_analysis#>'{language_graph,clause_build_v1}','{}'::jsonb);
  integrated jsonb;
begin
  integrated := public.build_mwe_predicate_valency_integration_v1(a,p_release_code);
  a := jsonb_set(a,'{language_graph,predicate_build_v1_base}',base_pred,true);
  a := jsonb_set(a,'{language_graph,clause_build_v1_base}',base_clause,true);
  a := jsonb_set(a,'{language_graph,mwe_predicate_valency_v1}',coalesce(integrated->'mwe_integration','{}'::jsonb),true);
  a := jsonb_set(a,'{language_graph,predicate_build_v1}',integrated,true);
  a := public.apply_clause_build_v1(a,p_release_code);
  return a;
end;
$$;

create or replace function public.build_clause_attachment_function_resolution_v2(
  p_analysis jsonb,
  p_release_code text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  base jsonb := public.build_clause_attachment_function_resolution_v1(p_analysis,p_release_code);
  scr jsonb := coalesce(p_analysis#>'{language_graph,subordinate_construction_recognition_v1}','{}'::jsonb);
  preds jsonb := coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicates}','[]'::jsonb);
  cls jsonb := coalesce(p_analysis#>'{language_graph,clause_build_v1,clauses}','[]'::jsonb);
  con jsonb;
  mp jsonb;
  mc jsonb;
  lex jsonb;
  frame jsonb;
  cand jsonb;
  cstart int;
  chead int;
  pidx int;
  explicit_subject boolean;
  reassessed_ids text[] := array[]::text[];
  add_candidates jsonb := '[]'::jsonb;
  add_resolved jsonb := '[]'::jsonb;
  add_pruned jsonb := '[]'::jsonb;
  add_blocked jsonb := '[]'::jsonb;
  cands jsonb;
  resolved jsonb;
  pruned jsonb;
  blocked jsonb;
begin
  for con in
    select value
    from jsonb_array_elements(coalesce(scr->'constructions','[]'::jsonb))
    where value->>'construction_family'='nominal_at_clause'
  loop
    cstart := nullif(con#>>'{introducer,start_token_index}','')::int;
    chead := nullif(con->>'finite_token_index','')::int;
    mp := null;

    select value into mp
    from jsonb_array_elements(preds)
    where value->>'status'='resolved'
      and nullif(value->>'finite_token_index','')::int is not null
      and nullif(value->>'finite_token_index','')::int<cstart
    order by nullif(value->>'finite_token_index','')::int desc
    limit 1;

    if mp is null or mp->>'mwe_code' is null then
      continue;
    end if;

    pidx := nullif(mp->>'finite_token_index','')::int;
    select value into mc
    from jsonb_array_elements(cls)
    where value->>'status'='resolved'
      and nullif(value->>'finite_token_index','')::int=pidx
    limit 1;

    explicit_subject := coalesce(mc->>'subject_status','')='explicit'
      and nullif(mc->>'subject_token_index','')::int is not null
      and nullif(mc->>'subject_token_index','')::int<cstart;

    lex := public.clause_attachment_token_lexeme_v1(p_analysis,pidx);
    frame := public.mwe_predicate_complement_frame_assessment_v1(
      p_release_code,
      mp->>'mwe_code',
      'at_clause'
    );

    cand := jsonb_build_object(
      'id','caf1:ccomp:'||(mp->>'id')||':'||(con->>'id'),
      'construction_id',con->>'id',
      'relation','ccomp',
      'syntactic_function','verb_complement',
      'matrix_predicate_id',mp->>'id',
      'matrix_predicate_surface',mp->>'surface',
      'matrix_predicate_token_index',pidx,
      'embedded_head_token_index',chead,
      'predicate_lexeme',lex,
      'mwe_code',mp->>'mwe_code',
      'mwe_expression_id',mp->>'mwe_expression_id',
      'frame_scope','mwe_predicate',
      'frame_assessment',frame,
      'constraints',jsonb_build_array(
        jsonb_build_object('type','construction_family','value','nominal_at_clause','strength','hard','passed',true),
        jsonb_build_object('type','matrix_predicate_precedes_clause','strength','hard','passed',true),
        jsonb_build_object('type','independent_matrix_subject','strength','hard','passed',explicit_subject),
        jsonb_build_object('type','mwe_predicate_identity','value',mp->>'mwe_code','strength','categorical','passed',true),
        jsonb_build_object('type','predicate_complement_frame','scope','mwe_predicate','strength','categorical','status',frame->>'status')
      ),
      'learner_error',false
    );

    reassessed_ids := array_append(reassessed_ids,cand->>'id');

    if frame->>'status'='licensed' and explicit_subject then
      cand := cand || jsonb_build_object(
        'status','resolved',
        'reason_code','unique_source_licensed_mwe_nominal_clause_complement_after_pruning',
        'confidence','high'
      );
      add_resolved := add_resolved || jsonb_build_array(cand);
    elsif frame->>'status'='excluded' then
      cand := cand || jsonb_build_object(
        'status','pruned',
        'reason_code','source_mwe_frame_excludes_at_clause'
      );
      add_pruned := add_pruned || jsonb_build_array(cand);
    elsif frame->>'status'='licensed_but_predicate_sense_required' then
      cand := cand || jsonb_build_object(
        'status','blocked',
        'reason_code','mwe_predicate_sense_required_by_source',
        'required_capability','predicate_sense_resolution'
      );
      add_candidates := add_candidates || jsonb_build_array(cand);
      add_blocked := add_blocked || jsonb_build_array(cand);
    elsif not explicit_subject then
      cand := cand || jsonb_build_object(
        'status','ambiguous',
        'reason_code','matrix_subject_not_independently_resolved',
        'required_capability','matrix_clause_role_resolution'
      );
      add_candidates := add_candidates || jsonb_build_array(cand);
      add_blocked := add_blocked || jsonb_build_array(cand);
    else
      cand := cand || jsonb_build_object(
        'status','blocked',
        'reason_code','no_source_verified_mwe_predicate_complement_frame',
        'required_capability','mwe_predicate_valency_coverage'
      );
      add_candidates := add_candidates || jsonb_build_array(cand);
      add_blocked := add_blocked || jsonb_build_array(cand);
    end if;
  end loop;

  select coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb)
  into cands
  from jsonb_array_elements(coalesce(base->'candidate_attachments','[]'::jsonb))
  where not ((value->>'id')=any(reassessed_ids));

  select coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb)
  into resolved
  from jsonb_array_elements(coalesce(base->'resolved_attachments','[]'::jsonb))
  where not ((value->>'id')=any(reassessed_ids));

  select coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb)
  into pruned
  from jsonb_array_elements(coalesce(base->'pruned_candidates','[]'::jsonb))
  where not ((value->>'id')=any(reassessed_ids));

  select coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb)
  into blocked
  from jsonb_array_elements(coalesce(base->'blocked_or_ambiguous','[]'::jsonb))
  where not ((value->>'id')=any(reassessed_ids));

  cands := cands || add_candidates;
  resolved := resolved || add_resolved;
  pruned := pruned || add_pruned;
  blocked := blocked || add_blocked;

  return jsonb_build_object(
    'version','clause-attachment-function-resolution-v2',
    'status','ready',
    'release_code',p_release_code,
    'constraint_contract',coalesce(base->'constraint_contract',public.constraint_pruning_contract_v1()),
    'candidate_attachments',cands,
    'resolved_attachments',resolved,
    'pruned_candidates',pruned,
    'blocked_or_ambiguous',blocked,
    'mwe_valency_integration',jsonb_build_object(
      'version','mwe-predicate-valency-attachment-v1',
      'reassessed_candidate_count',cardinality(reassessed_ids),
      'resolved_count',jsonb_array_length(add_resolved),
      'pruned_count',jsonb_array_length(add_pruned),
      'blocked_count',jsonb_array_length(add_blocked),
      'source_graph_runtime_reads',0,
      'learner_error_claims',0
    ),
    'summary',jsonb_build_object(
      'construction_count',jsonb_array_length(coalesce(scr->'constructions','[]'::jsonb)),
      'generated_candidate_count',jsonb_array_length(cands)+jsonb_array_length(resolved),
      'resolved_attachment_count',jsonb_array_length(resolved),
      'pruned_candidate_count',jsonb_array_length(pruned),
      'blocked_or_ambiguous_count',jsonb_array_length(blocked),
      'learner_error_claims',0
    )
  );
end;
$$;

create or replace function public.apply_clause_attachment_function_resolution_v2(
  p_analysis jsonb,
  p_release_code text
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
select jsonb_set(
  p_analysis,
  '{language_graph,clause_attachment_function_v1}',
  public.build_clause_attachment_function_resolution_v2(p_analysis,p_release_code),
  true
);
$$;

create or replace function public.analyze_text_structural_shadow_v37(
  p_text text,
  p_release_code text default 'runtime-structural-v1.37'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  d jsonb;
  out_s jsonb := '[]'::jsonb;
  s jsonb;
  a jsonb;
  m jsonb;
  mwe jsonb;
  scf jsonb;
  scr jsonb;
begin
  d := public.analyze_text_structural_shadow_v32_morph(p_text,p_release_code);

  for s in
    select x from jsonb_array_elements(coalesce(d#>'{document_graph,sentences}','[]'::jsonb)) x
  loop
    a := public.apply_morphological_rule_dispatcher_to_analysis_v3(coalesce(s->'analysis','{}'::jsonb),p_release_code);
    a := public.apply_local_pos_disambiguation_v1(a);
    a := public.apply_phrase_build_v1(a,p_release_code);
    a := public.apply_structural_pos_refinement_v2(a,p_release_code);
    a := public.apply_construction_recognition_v1(a,p_release_code);
    a := public.apply_construction_resolution_v1(a,p_release_code);
    a := public.apply_predicate_build_v1(a,p_release_code);
    a := public.apply_clause_build_v1(a,p_release_code);

    mwe := public.build_multiword_function_expression_v1(a,p_release_code);
    a := jsonb_set(a,'{language_graph,multiword_function_expression_v1}',mwe,true);

    a := public.apply_mwe_predicate_valency_integration_v1(a,p_release_code);

    s := jsonb_set(s,'{analysis}',a,true);
    scf := public.build_subordinate_clause_foundation_v4(s,p_release_code);
    a := jsonb_set(a,'{language_graph,subordinate_clause_foundation_v2}',scf,true);

    scr := public.build_subordinate_construction_recognition_v2(a,p_release_code);
    a := jsonb_set(a,'{language_graph,subordinate_construction_recognition_v1}',scr,true);

    a := public.apply_clause_attachment_function_resolution_v2(a,p_release_code);
    a := public.apply_dependency_build_v2(a,p_release_code);
    a := public.apply_grammar_validation_v2(a,p_release_code);
    a := public.apply_interpretation_v2(a,p_release_code);

    s := jsonb_set(s,'{analysis}',a,true);
    m := public.build_sentence_model_v2(s,p_release_code);
    a := jsonb_set(a,'{language_graph,sentence_model_v2}',m,true);
    s := jsonb_set(s,'{analysis}',a,true);
    out_s := out_s || jsonb_build_array(s);
  end loop;

  d := jsonb_set(d,'{document_graph,sentences}',out_s,true);
  d := public.apply_pedagogical_projection_v1(d,p_release_code);
  d := public.apply_rule_execution_plane_v1(d,p_release_code);
  d := public.apply_upstream_capability_closure_v1(d);

  return d || jsonb_build_object(
    'engine_version','grammar-structural-shadow-v37',
    'canonical_sequence',jsonb_build_array(
      'morphology','local_pos','phrase','structural_pos','predicate_constructions',
      'predicate_base','clause_core_base','multiword_function_expression',
      'mwe_predicate_valency','clause_core_rebuild',
      'subordinate_clause_foundation','subordinate_construction_recognition',
      'clause_attachment_function','dependency','validation','interpretation',
      'sentence_model','pedagogy'
    )
  );
end;
$$;
