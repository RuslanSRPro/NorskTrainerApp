create or replace function public.subordinate_construction_recognition_contract_v1()
returns jsonb
language sql immutable
set search_path to ''
as $$
select jsonb_build_object(
 'version','subordinate-construction-recognition-v1',
 'purpose','Bridge resolved subordinate clause cores to explicit construction identity and marker structure before attachment/function/semantic resolution.',
 'inputs',jsonb_build_array('language_graph.tokens','language_graph.subordinate_clause_foundation_v2','runtime source facts'),
 'outputs',jsonb_build_array('constructions','construction_hypotheses','marker_relations','unresolved_requirements'),
 'resolved_scope',jsonb_build_array('foundation-anchored subordinate construction','simple marker relation','nominal at-clause identity','fordi-introduced adverbial-clause identity'),
 'hypothesis_scope',jsonb_build_array('for at compound-subjunction candidate','slik at compound-subjunction candidate'),
 'explicitly_deferred',jsonb_build_array('matrix attachment','clause syntactic function','valency','causal-vs-temporal semantics','compound-subjunction disambiguation requiring semantics/valency/prosody','relative/control/raising analysis'),
 'ud_alignment',jsonb_build_object('internal_marker_relation','mark','future_external_clause_relations',jsonb_build_array('ccomp','advcl','csubj','acl:relcl','xcomp')),
 'safety','Never infer semantic subtype or clause attachment from surface connector alone. Hypothesis is not a resolved fact.',
 'teacher_policy','Pedagogical explanations may consume only resolved facts; hypotheses are analysis notices, not learner corrections.'
);
$$;

create or replace function public.build_subordinate_construction_recognition_v1(p_analysis jsonb,p_release_code text)
returns jsonb
language plpgsql stable
set search_path to 'public','pg_catalog'
as $$
declare
  v_tokens jsonb:=coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
  v_found jsonb:=coalesce(p_analysis#>'{language_graph,subordinate_clause_foundation_v2,clauses}','[]'::jsonb);
  v_constructions jsonb:='[]'::jsonb;
  v_hypotheses jsonb:='[]'::jsonb;
  v_markers jsonb:='[]'::jsonb;
  v_unresolved jsonb:='[]'::jsonb;
  c jsonb; t jsonb;
  v_conn_idx int; v_fin_idx int; v_subj_idx int;
  v_conn text; v_prev text; v_prev_idx int;
  v_family text; v_status text; v_intro text; v_marker_type text;
  v_mwe_status text; v_source_fact jsonb; v_disambig jsonb;
  v_id text; v_clause_id text;
  v_resolved int:=0; v_hyp int:=0; v_marker_count int:=0;
begin
  for c in select x from jsonb_array_elements(v_found) x loop
    v_conn_idx:=nullif(c->>'connector_token_index','')::int;
    v_fin_idx:=nullif(c->>'finite_token_index','')::int;
    v_subj_idx:=nullif(c->>'subject_token_index','')::int;
    v_conn:=lower(coalesce(c->>'connector_surface',''));
    v_clause_id:=c->>'id';
    v_prev:=null; v_prev_idx:=null;
    if v_conn_idx is not null then
      select lower(x->>'surface'),(x->>'token_index')::int into v_prev,v_prev_idx
      from jsonb_array_elements(v_tokens) x
      where (x->>'token_index')::int=v_conn_idx-1 limit 1;
    end if;
    v_id:='scr1:'||coalesce(v_clause_id,coalesce(v_conn_idx::text,'x'));
    v_family:='explicit_subjunction_clause'; v_status:='resolved'; v_intro=v_conn; v_marker_type:='simple_subjunction'; v_mwe_status:='not_applicable';
    v_source_fact:=null; v_disambig:=null;

    if v_conn='at' and v_prev='for' then
      v_family:='for_at_compound_subjunction_candidate'; v_status:='hypothesis'; v_intro:='for at'; v_marker_type:='multiword_function_word_candidate'; v_mwe_status:='unresolved_requires_valency_and_semantics';
      v_disambig:=public.runtime_source_fact_v1('subordinate.for_at.disambiguation.v1');
    elsif v_conn='at' and v_prev='slik' then
      v_family:='slik_at_compound_subjunction_candidate'; v_status:='hypothesis'; v_intro:='slik at'; v_marker_type:='multiword_function_word_candidate'; v_mwe_status:='unresolved_requires_structure_semantics_prosody';
      v_disambig:=public.runtime_source_fact_v1('subordinate.slik_at.disambiguation.v1');
    elsif v_conn='at' then
      v_family:='nominal_at_clause'; v_status:='resolved'; v_intro:='at'; v_marker_type:='simple_subjunction'; v_mwe_status:='not_applicable';
      v_source_fact:=public.runtime_source_fact_v1('subordinate.at.nominal_marker.v1');
    elsif v_conn='fordi' then
      v_family:='fordi_introduced_adverbial_clause'; v_status:='resolved'; v_intro:='fordi'; v_marker_type:='lexicalized_subjunction'; v_mwe_status:='not_applicable';
      v_source_fact:=public.runtime_source_fact_v1('subordinate.adverbial.introducer_inventory.v1');
    else
      v_source_fact:=public.runtime_source_fact_v1('subordinate.adverbial.introducer_inventory.v1');
    end if;

    if v_status='resolved' then
      v_resolved:=v_resolved+1;
      v_constructions:=v_constructions||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'id',v_id,'status','resolved','recognition_level','structural','construction_family',v_family,
        'clause_id',v_clause_id,'schema',c->>'schema','surface',c->>'surface',
        'introducer',jsonb_build_object('surface',v_intro,'marker_type',v_marker_type,'start_token_index',case when v_intro like '% %' then v_prev_idx else v_conn_idx end,'end_token_index',v_conn_idx,'mwe_status',v_mwe_status),
        'finite_token_index',v_fin_idx,'subject_token_index',v_subj_idx,
        'attachment_status','unresolved','syntactic_function','unresolved','semantic_relation_status','unresolved',
        'possible_external_clause_relations',jsonb_build_array('ccomp','advcl','csubj','acl:relcl'),
        'source_fact',v_source_fact,
        'reason_code',case when v_family='nominal_at_clause' then 'source_verified_at_marks_nominal_subordinate_clause' when v_family='fordi_introduced_adverbial_clause' then 'source_verified_adverbial_introducer_identity' else 'foundation_anchored_explicit_subjunction_clause' end
      )));
    else
      v_hyp:=v_hyp+1;
      v_hypotheses:=v_hypotheses||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'id',v_id,'status','hypothesis','construction_family',v_family,'clause_id',v_clause_id,'schema',c->>'schema','surface',c->>'surface',
        'introducer',jsonb_build_object('surface',v_intro,'marker_type',v_marker_type,'start_token_index',v_prev_idx,'end_token_index',v_conn_idx,'mwe_status',v_mwe_status),
        'finite_token_index',v_fin_idx,'subject_token_index',v_subj_idx,
        'attachment_status','unresolved','syntactic_function','unresolved','semantic_relation_status','unresolved',
        'disambiguation_evidence',v_disambig,
        'reason_code','surface_sequence_is_source_attested_but_analysis_requires_additional_canonical_facts'
      )));
      v_unresolved:=v_unresolved||jsonb_build_array(jsonb_build_object(
        'construction_id',v_id,'kind','construction_identity','status','unresolved','surface',v_intro,
        'required_capabilities',case when v_family='for_at_compound_subjunction_candidate' then jsonb_build_array('syntactic_valency','semantic_relation_resolution') else jsonb_build_array('syntactic_structure','semantic_paraphrase','prosody_or_equivalent_disambiguation') end,
        'learner_error',false
      ));
    end if;

    if v_conn_idx is not null and v_fin_idx is not null then
      v_marker_count:=v_marker_count+1;
      v_markers:=v_markers||jsonb_build_array(jsonb_build_object(
        'id','scr1:mark:'||v_conn_idx||':'||v_fin_idx,
        'status','resolved','relation','mark','marker_token_index',v_conn_idx,'clause_head_token_index',v_fin_idx,
        'marker_surface',v_conn,'construction_id',v_id,
        'reason_code','explicit_subordinate_marker_attaches_to_subordinate_predicate_head'
      ));
    end if;

    v_unresolved:=v_unresolved||jsonb_build_array(
      jsonb_build_object('construction_id',v_id,'kind','matrix_attachment','status','unresolved','required_capability','clause_attachment_resolution','learner_error',false),
      jsonb_build_object('construction_id',v_id,'kind','syntactic_function','status','unresolved','required_capability','clause_function_resolution','learner_error',false)
    );
  end loop;

  return jsonb_build_object(
    'version','subordinate-construction-recognition-v1','status','ready','release_code',p_release_code,
    'constructions',v_constructions,'construction_hypotheses',v_hypotheses,'marker_relations',v_markers,'unresolved_requirements',v_unresolved,
    'summary',jsonb_build_object('foundation_clause_count',jsonb_array_length(v_found),'resolved_construction_count',v_resolved,'hypothesis_count',v_hyp,'marker_relation_count',v_marker_count,'attachment_resolved_count',0,'function_resolved_count',0,'learner_error_claims',0)
  );
end;
$$;

create or replace function public.apply_subordinate_construction_recognition_v1(p_doc jsonb,p_release_code text)
returns jsonb
language plpgsql stable
set search_path to 'public','pg_catalog'
as $$
declare v_sents jsonb:='[]'::jsonb; s jsonb; a jsonb; g jsonb; layer jsonb;
begin
  for s in select x from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences}','[]'::jsonb)) x loop
    a:=coalesce(s->'analysis','{}'::jsonb);
    g:=coalesce(a->'language_graph','{}'::jsonb);
    layer:=public.build_subordinate_construction_recognition_v1(a,p_release_code);
    g:=jsonb_set(g,'{subordinate_construction_recognition_v1}',layer,true);
    a:=jsonb_set(a,'{language_graph}',g,true);
    s:=jsonb_set(s,'{analysis}',a,true);
    v_sents:=v_sents||jsonb_build_array(s);
  end loop;
  return jsonb_set(p_doc,'{document_graph,sentences}',v_sents,true);
end;
$$;

create or replace function public.analyze_text_structural_shadow_v34(p_text text,p_release_code text default 'runtime-structural-v1.34')
returns jsonb
language plpgsql stable
set search_path to 'public','pg_catalog'
as $$
declare d jsonb;
begin
  d:=public.analyze_text_structural_shadow_v32(p_text,p_release_code);
  d:=public.apply_subordinate_construction_recognition_v1(d,p_release_code);
  return d||jsonb_build_object('engine_version','grammar-structural-shadow-v34');
end;
$$;
