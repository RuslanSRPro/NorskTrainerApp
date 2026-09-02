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
  mwe_hyps jsonb := coalesce(p_analysis#>'{language_graph,mwe_predicate_valency_v1,mwe_predicate_hypotheses}','[]'::jsonb);
  con jsonb;
  mp jsonb;
  mh jsonb;
  mc jsonb;
  lex jsonb;
  frame jsonb;
  cand jsonb;
  cstart int;
  chead int;
  pidx int;
  explicit_subject boolean;
  effective_mwe_code text;
  effective_mwe_expression_id text;
  effective_predicate_id text;
  effective_predicate_surface text;
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
    mh := null;
    effective_mwe_code := null;
    effective_mwe_expression_id := null;

    select value into mp
    from jsonb_array_elements(preds)
    where value->>'status'='resolved'
      and nullif(value->>'finite_token_index','')::int is not null
      and nullif(value->>'finite_token_index','')::int<cstart
    order by nullif(value->>'finite_token_index','')::int desc
    limit 1;

    if mp is null then
      continue;
    end if;

    if mp->>'mwe_code' is not null then
      effective_mwe_code := mp->>'mwe_code';
      effective_mwe_expression_id := mp->>'mwe_expression_id';
      effective_predicate_id := mp->>'id';
      effective_predicate_surface := mp->>'surface';
    else
      select value into mh
      from jsonb_array_elements(mwe_hyps)
      where value->>'source_predicate_id'=mp->>'id'
        and nullif(value->>'span_end','')::int<cstart
      order by nullif(value->>'span_end','')::int desc, value->>'id'
      limit 1;

      if mh is not null then
        effective_mwe_code := mh->>'mwe_code';
        effective_mwe_expression_id := mh->>'mwe_expression_id';
      end if;
      effective_predicate_id := mp->>'id';
      effective_predicate_surface := case when mh is null then mp->>'surface' else mh->>'surface' end;
    end if;

    if effective_mwe_code is null then
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
      effective_mwe_code,
      'at_clause'
    );

    cand := jsonb_build_object(
      'id','caf1:ccomp:'||effective_predicate_id||':'||(con->>'id'),
      'construction_id',con->>'id',
      'relation','ccomp',
      'syntactic_function','verb_complement',
      'matrix_predicate_id',effective_predicate_id,
      'matrix_predicate_surface',effective_predicate_surface,
      'matrix_predicate_token_index',pidx,
      'embedded_head_token_index',chead,
      'predicate_lexeme',lex,
      'mwe_code',effective_mwe_code,
      'mwe_expression_id',effective_mwe_expression_id,
      'mwe_predicate_resolution',case when mh is null then 'resolved' else 'sense_hypothesis' end,
      'frame_scope','mwe_predicate',
      'frame_assessment',frame,
      'constraints',jsonb_build_array(
        jsonb_build_object('type','construction_family','value','nominal_at_clause','strength','hard','passed',true),
        jsonb_build_object('type','matrix_predicate_precedes_clause','strength','hard','passed',true),
        jsonb_build_object('type','independent_matrix_subject','strength','hard','passed',explicit_subject),
        jsonb_build_object('type','mwe_predicate_identity','value',effective_mwe_code,'strength','categorical','status',case when mh is null then 'resolved' else 'sense_hypothesis' end),
        jsonb_build_object('type','predicate_complement_frame','scope','mwe_predicate','strength','categorical','status',frame->>'status')
      ),
      'learner_error',false
    );

    reassessed_ids := array_append(reassessed_ids,'caf1:ccomp:'||(mp->>'id')||':'||(con->>'id'));
    if cand->>'id' <> reassessed_ids[array_length(reassessed_ids,1)] then
      reassessed_ids := array_append(reassessed_ids,cand->>'id');
    end if;

    if frame->>'status'='licensed' and explicit_subject and mh is null then
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
    elsif frame->>'status'='licensed_but_predicate_sense_required' or mh is not null then
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
