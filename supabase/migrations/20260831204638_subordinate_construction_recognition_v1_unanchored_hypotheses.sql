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
  c jsonb; t jsonb; nt jsonb;
  v_conn_idx int; v_fin_idx int; v_subj_idx int; v_idx int; v_next_idx int;
  v_conn text; v_prev text; v_prev_idx int; v_surface text; v_next text;
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
    v_family:='explicit_subjunction_clause'; v_status:='resolved'; v_intro:=v_conn; v_marker_type:='simple_subjunction'; v_mwe_status:='not_applicable';
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
        'id',v_id,'status','hypothesis','anchor_status','foundation_anchored','construction_family',v_family,'clause_id',v_clause_id,'schema',c->>'schema','surface',c->>'surface',
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
        'id','scr1:mark:'||v_conn_idx||':'||v_fin_idx,'status','resolved','relation','mark','marker_token_index',v_conn_idx,'clause_head_token_index',v_fin_idx,
        'marker_surface',v_conn,'construction_id',v_id,'reason_code','explicit_subordinate_marker_attaches_to_subordinate_predicate_head'
      ));
    end if;

    v_unresolved:=v_unresolved||jsonb_build_array(
      jsonb_build_object('construction_id',v_id,'kind','matrix_attachment','status','unresolved','required_capability','clause_attachment_resolution','learner_error',false),
      jsonb_build_object('construction_id',v_id,'kind','syntactic_function','status','unresolved','required_capability','clause_function_resolution','learner_error',false)
    );
  end loop;

  -- Source-attested introducer hypotheses that may be needed before a clause core can be built.
  for t in select x from jsonb_array_elements(v_tokens) x order by (x->>'token_index')::int loop
    v_idx:=(t->>'token_index')::int; v_surface:=lower(coalesce(t->>'surface','')); nt:=null; v_next:=null; v_next_idx:=null;
    select x into nt from jsonb_array_elements(v_tokens) x where (x->>'token_index')::int=v_idx+1 limit 1;
    if nt is not null then v_next:=lower(coalesce(nt->>'surface','')); v_next_idx:=(nt->>'token_index')::int; end if;

    if (v_surface='for' or v_surface='slik') and v_next='at' and not exists(
      select 1 from jsonb_array_elements(v_hypotheses||v_constructions) z where nullif(z#>>'{introducer,start_token_index}','')::int=v_idx and nullif(z#>>'{introducer,end_token_index}','')::int=v_next_idx
    ) then
      v_family:=case when v_surface='for' then 'for_at_compound_subjunction_candidate' else 'slik_at_compound_subjunction_candidate' end;
      v_intro:=v_surface||' at';
      v_disambig:=public.runtime_source_fact_v1(case when v_surface='for' then 'subordinate.for_at.disambiguation.v1' else 'subordinate.slik_at.disambiguation.v1' end);
      v_id:='scr1:hyp:mwe:'||v_idx||':'||v_next_idx; v_hyp:=v_hyp+1;
      v_hypotheses:=v_hypotheses||jsonb_build_array(jsonb_build_object(
        'id',v_id,'status','hypothesis','anchor_status','unanchored','construction_family',v_family,
        'introducer',jsonb_build_object('surface',v_intro,'marker_type','multiword_function_word_candidate','start_token_index',v_idx,'end_token_index',v_next_idx,'mwe_status','unresolved'),
        'attachment_status','unresolved','syntactic_function','unresolved','semantic_relation_status','unresolved','disambiguation_evidence',v_disambig,
        'reason_code','source_attested_multiword_introducer_requires_disambiguation_before_clause_construction'
      ));
      v_unresolved:=v_unresolved||jsonb_build_array(jsonb_build_object('construction_id',v_id,'kind','construction_identity','status','unresolved','surface',v_intro,'required_capabilities',case when v_surface='for' then jsonb_build_array('syntactic_valency','semantic_relation_resolution') else jsonb_build_array('syntactic_structure','semantic_paraphrase','prosody_or_equivalent_disambiguation') end,'learner_error',false));
    end if;

    if v_surface in ('at','fordi') and not exists(
      select 1 from jsonb_array_elements(v_found) z where nullif(z->>'connector_token_index','')::int=v_idx
    ) and not (v_surface='at' and v_idx>1 and lower(coalesce((select x->>'surface' from jsonb_array_elements(v_tokens) x where (x->>'token_index')::int=v_idx-1 limit 1),'')) in ('for','slik')) then
      v_id:='scr1:hyp:introducer:'||v_idx; v_hyp:=v_hyp+1;
      v_hypotheses:=v_hypotheses||jsonb_build_array(jsonb_build_object(
        'id',v_id,'status','hypothesis','anchor_status','unanchored','construction_family',case when v_surface='at' then 'nominal_at_clause_candidate' else 'fordi_introduced_adverbial_clause_candidate' end,
        'introducer',jsonb_build_object('surface',v_surface,'marker_type',case when v_surface='at' then 'simple_subjunction' else 'lexicalized_subjunction' end,'start_token_index',v_idx,'end_token_index',v_idx),
        'source_fact',public.runtime_source_fact_v1(case when v_surface='at' then 'subordinate.at.nominal_marker.v1' else 'subordinate.adverbial.introducer_inventory.v1' end),
        'reason_code','source_attested_introducer_seen_but_subordinate_clause_core_not_yet_resolved'
      ));
      v_unresolved:=v_unresolved||jsonb_build_array(jsonb_build_object('construction_id',v_id,'kind','clause_core','status','unresolved','required_capability','subordinate_clause_core_resolution','learner_error',false));
    end if;
  end loop;

  return jsonb_build_object(
    'version','subordinate-construction-recognition-v1','status','ready','release_code',p_release_code,
    'constructions',v_constructions,'construction_hypotheses',v_hypotheses,'marker_relations',v_markers,'unresolved_requirements',v_unresolved,
    'summary',jsonb_build_object('foundation_clause_count',jsonb_array_length(v_found),'resolved_construction_count',v_resolved,'hypothesis_count',v_hyp,'marker_relation_count',v_marker_count,'attachment_resolved_count',0,'function_resolved_count',0,'learner_error_claims',0)
  );
end;
$$;
