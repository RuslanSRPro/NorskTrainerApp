create or replace function public.resolve_grammar_validation_v2(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.13')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_events jsonb:='[]'::jsonb;
  v_diags jsonb:='[]'::jsonb;
  v_clause jsonb; v_pred jsonb; v_h jsonb; v_b jsonb;
  v_pid text; v_cid text; v_kind text; v_ct text;
  v_finite int; v_subject int; v_gh int; v_lh int; v_pc int; v_expected int; v_actual int;
  v_status text; v_reason text;
  v_invalid int:=0; v_warning int:=0; v_valid int:=0; v_unresolved int:=0; v_blocked int:=0;
begin
  for v_clause in select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,clauses}','[]'::jsonb)) x loop
    v_cid:=v_clause->>'id'; v_pid:=v_clause->>'predicate_id'; v_ct:=v_clause->>'clause_type';
    select p into v_pred from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicates}','[]'::jsonb)) p where p->>'id'=v_pid limit 1;

    if v_pred is null then
      v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:clause_predicate:'||v_cid,'family','clause_predicate_integrity','status','invalid','severity','error','clause_id',v_cid,'predicate_id',v_pid,'reason_code','resolved_clause_references_missing_predicate','provenance',public.grammar_validation_provenance_v2(p_release_code,'clause_predicate_integrity')));
      v_diags:=v_diags||jsonb_build_array(jsonb_build_object('code','gv2_missing_predicate','severity','error','clause_id',v_cid,'message_key','resolved_clause_references_missing_predicate'));
      v_invalid:=v_invalid+1;
      continue;
    end if;

    v_actual:=public.grammar_validation_edge_count_v2(p_analysis,'predicate_of_clause',v_pid,v_cid);
    if v_actual=1 then
      v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:clause_predicate:'||v_cid,'family','clause_predicate_integrity','status','valid','severity','info','clause_id',v_cid,'predicate_id',v_pid,'observed_edges',v_actual,'reason_code','exactly_one_predicate_of_clause','provenance',public.grammar_validation_provenance_v2(p_release_code,'clause_predicate_integrity'))); v_valid:=v_valid+1;
    else
      v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:clause_predicate:'||v_cid,'family','clause_predicate_integrity','status','invalid','severity','error','clause_id',v_cid,'predicate_id',v_pid,'observed_edges',v_actual,'reason_code','predicate_of_clause_cardinality_mismatch','provenance',public.grammar_validation_provenance_v2(p_release_code,'clause_predicate_integrity')));
      v_diags:=v_diags||jsonb_build_array(jsonb_build_object('code','gv2_predicate_of_clause_cardinality','severity','error','clause_id',v_cid,'predicate_id',v_pid,'observed_edges',v_actual)); v_invalid:=v_invalid+1;
    end if;

    v_kind:=v_pred->>'predicate_kind';
    if v_ct='finite' then
      v_finite:=nullif(v_pred->>'finite_token_index','')::int; v_subject:=nullif(v_clause->>'subject_token_index','')::int; v_gh:=nullif(v_pred->>'grammatical_head_token_index','')::int;
      v_actual:=public.grammar_validation_edge_count_v2(p_analysis,'subject_of',v_pid,v_cid);
      if v_subject is not null and public.grammar_validation_has_token_v2(p_analysis,v_subject) and v_actual=1 then
        v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:finite_subject:'||v_cid,'family','finite_subject_integrity','status','valid','severity','info','clause_id',v_cid,'predicate_id',v_pid,'subject_token_index',v_subject,'reason_code','finite_clause_has_explicit_subject_edge','provenance',public.grammar_validation_provenance_v2(p_release_code,'finite_subject_integrity'))); v_valid:=v_valid+1;
      else
        v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:finite_subject:'||v_cid,'family','finite_subject_integrity','status','invalid','severity','error','clause_id',v_cid,'predicate_id',v_pid,'subject_token_index',v_subject,'observed_subject_edges',v_actual,'reason_code','finite_clause_subject_integrity_failed','provenance',public.grammar_validation_provenance_v2(p_release_code,'finite_subject_integrity')));
        v_diags:=v_diags||jsonb_build_array(jsonb_build_object('code','gv2_finite_subject_integrity','severity','error','clause_id',v_cid,'predicate_id',v_pid)); v_invalid:=v_invalid+1;
      end if;

      v_actual:=public.grammar_validation_edge_count_v2(p_analysis,'finite_member_of_predicate',v_pid,null);
      if v_finite is not null and v_gh=v_finite and public.grammar_validation_has_token_v2(p_analysis,v_finite) and v_actual=1 then
        v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:finite_head:'||v_pid,'family','finite_head_integrity','status','valid','severity','info','predicate_id',v_pid,'finite_token_index',v_finite,'reason_code','finite_head_and_member_consistent','provenance',public.grammar_validation_provenance_v2(p_release_code,'finite_head_integrity'))); v_valid:=v_valid+1;
      else
        v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:finite_head:'||v_pid,'family','finite_head_integrity','status','invalid','severity','error','predicate_id',v_pid,'finite_token_index',v_finite,'grammatical_head_token_index',v_gh,'observed_finite_member_edges',v_actual,'reason_code','finite_head_integrity_failed','provenance',public.grammar_validation_provenance_v2(p_release_code,'finite_head_integrity')));
        v_diags:=v_diags||jsonb_build_array(jsonb_build_object('code','gv2_finite_head_integrity','severity','error','predicate_id',v_pid)); v_invalid:=v_invalid+1;
      end if;
    end if;

    if v_kind in ('modal_compound','modal_chain') then
      v_expected:=case when v_kind='modal_chain' then greatest(jsonb_array_length(coalesce(v_pred->'member_token_indices','[]'::jsonb))-1,1) else 1 end;
      v_actual:=public.grammar_validation_edge_count_v2(p_analysis,'modal_governs',v_pid,null);
      if v_actual=v_expected then v_status:='valid'; v_reason:='modal_governance_matches_predicate_shape'; v_valid:=v_valid+1; else v_status:='invalid'; v_reason:='modal_governance_count_mismatch'; v_invalid:=v_invalid+1; v_diags:=v_diags||jsonb_build_array(jsonb_build_object('code','gv2_modal_governance','severity','error','predicate_id',v_pid,'expected_edges',v_expected,'observed_edges',v_actual)); end if;
      v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:modal:'||v_pid,'family','modal_governance','status',v_status,'severity',case when v_status='valid' then 'info' else 'error' end,'predicate_id',v_pid,'expected_edges',v_expected,'observed_edges',v_actual,'reason_code',v_reason,'provenance',public.grammar_validation_provenance_v2(p_release_code,'modal_governance')));
    elsif v_kind='auxiliary_compound' then
      v_actual:=public.grammar_validation_edge_count_v2(p_analysis,'auxiliary_governs',v_pid,null);
      if v_actual=1 then v_status:='valid'; v_reason:='auxiliary_governance_present'; v_valid:=v_valid+1; else v_status:='invalid'; v_reason:='auxiliary_governance_missing_or_duplicated'; v_invalid:=v_invalid+1; v_diags:=v_diags||jsonb_build_array(jsonb_build_object('code','gv2_auxiliary_governance','severity','error','predicate_id',v_pid,'observed_edges',v_actual)); end if;
      v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:aux:'||v_pid,'family','auxiliary_governance','status',v_status,'severity',case when v_status='valid' then 'info' else 'error' end,'predicate_id',v_pid,'observed_edges',v_actual,'reason_code',v_reason,'provenance',public.grammar_validation_provenance_v2(p_release_code,'auxiliary_governance')));
    elsif v_kind='copular' then
      v_pc:=nullif(v_pred->>'predicative_complement_token_index','')::int; v_actual:=public.grammar_validation_edge_count_v2(p_analysis,'copula_links_predicative',v_pid,null);
      if v_pc is not null and public.grammar_validation_has_token_v2(p_analysis,v_pc) and v_actual=1 then v_status:='valid'; v_reason:='copular_predicative_link_present'; v_valid:=v_valid+1; else v_status:='invalid'; v_reason:='copular_predicative_link_integrity_failed'; v_invalid:=v_invalid+1; v_diags:=v_diags||jsonb_build_array(jsonb_build_object('code','gv2_copular_link','severity','error','predicate_id',v_pid,'observed_edges',v_actual)); end if;
      v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:copular:'||v_pid,'family','copular_link','status',v_status,'severity',case when v_status='valid' then 'info' else 'error' end,'predicate_id',v_pid,'predicative_complement_token_index',v_pc,'observed_edges',v_actual,'reason_code',v_reason,'provenance',public.grammar_validation_provenance_v2(p_release_code,'copular_link')));
    elsif v_kind='nonfinite_infinitive' then
      v_gh:=nullif(v_pred->>'grammatical_head_token_index','')::int;
      v_actual:=public.grammar_validation_edge_count_v2(p_analysis,'infinitive_marker_of_predicate',v_pid,null);
      v_expected:=public.grammar_validation_edge_count_v2(p_analysis,'subject_of',v_pid,null)+public.grammar_validation_edge_count_v2(p_analysis,'finite_member_of_predicate',v_pid,null);
      if v_ct='nonfinite' and v_clause->>'subject_status'='unexpressed' and v_gh is not null and v_actual=1 and v_expected=0 then v_status:='valid'; v_reason:='nonfinite_infinitive_shape_consistent'; v_valid:=v_valid+1; else v_status:='invalid'; v_reason:='nonfinite_infinitive_shape_integrity_failed'; v_invalid:=v_invalid+1; v_diags:=v_diags||jsonb_build_array(jsonb_build_object('code','gv2_nonfinite_infinitive_shape','severity','error','predicate_id',v_pid,'clause_id',v_cid)); end if;
      v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:infinitive:'||v_pid,'family','nonfinite_infinitive_shape','status',v_status,'severity',case when v_status='valid' then 'info' else 'error' end,'predicate_id',v_pid,'clause_id',v_cid,'observed_marker_edges',v_actual,'forbidden_subject_or_finite_edges',v_expected,'reason_code',v_reason,'provenance',public.grammar_validation_provenance_v2(p_release_code,'nonfinite_infinitive_shape')));
    end if;
  end loop;

  -- dependency reference integrity
  for v_h in select d from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,dependency_build_v2,dependencies}','[]'::jsonb)) d loop
    if (v_h ? 'source_token_index' and not public.grammar_validation_has_token_v2(p_analysis,nullif(v_h->>'source_token_index','')::int))
       or (v_h ? 'target_token_index' and not public.grammar_validation_has_token_v2(p_analysis,nullif(v_h->>'target_token_index','')::int)) then
      v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:depref:'||(v_h->>'id'),'family','dependency_reference_integrity','status','invalid','severity','error','dependency_id',v_h->>'id','reason_code','dependency_references_missing_token'));
      v_diags:=v_diags||jsonb_build_array(jsonb_build_object('code','gv2_dangling_dependency_token','severity','error','dependency_id',v_h->>'id')); v_invalid:=v_invalid+1;
    end if;
  end loop;

  for v_h in select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,clause_hypotheses}','[]'::jsonb)) x loop
    v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:unresolved:'||(v_h->>'id'),'family','unresolved_propagation','status','unresolved','severity','info','clause_id',v_h->>'id','surface',v_h->>'surface','reason_code',v_h->>'reason_code','blocked_events',coalesce(v_h->'blocked_events','[]'::jsonb))); v_unresolved:=v_unresolved+1;
  end loop;
  for v_b in select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,blocked_clauses}','[]'::jsonb)) x loop
    v_events:=v_events||jsonb_build_array(jsonb_build_object('id','gv2:blocked:'||(v_b->>'id'),'family','blocked_propagation','status','blocked','severity','info','clause_id',v_b->>'id','surface',v_b->>'surface','reason_code',v_b->>'reason_code','blocked_events',coalesce(v_b->'blocked_events','[]'::jsonb))); v_blocked:=v_blocked+1;
  end loop;

  return jsonb_build_object(
    'version','grammar-validation-v2','status','ready','validation_events',v_events,'diagnostics',v_diags,
    'summary',jsonb_build_object('event_count',jsonb_array_length(v_events),'valid_count',v_valid,'warning_count',v_warning,'invalid_count',v_invalid,'unresolved_count',v_unresolved,'blocked_count',v_blocked,'diagnostic_count',jsonb_array_length(v_diags),'overall_status',case when v_invalid>0 then 'invalid' when v_blocked>0 then 'blocked' when v_unresolved>0 then 'unresolved' when v_warning>0 then 'warning' else 'valid' end),
    'word_order_v2_status','deferred_until_clause_fields'
  );
end;
$function$;

create or replace function public.apply_grammar_validation_v2(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.13')
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select jsonb_set(p_analysis,'{language_graph,grammar_validation_v2}',public.resolve_grammar_validation_v2(p_analysis,p_release_code),true);
$function$;

create or replace function public.analyze_text_structural_shadow_v13(p_text text,p_release_code text default 'runtime-structural-v1.13')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_doc jsonb; v_sentences jsonb:='[]'::jsonb; v_s jsonb; v_a jsonb;
begin
  v_doc:=public.analyze_text_structural_shadow_v12(p_text,p_release_code);
  for v_s in select x from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences}','[]'::jsonb)) x loop
    v_a:=public.apply_grammar_validation_v2(coalesce(v_s->'analysis','{}'::jsonb),p_release_code);
    v_sentences:=v_sentences||jsonb_build_array(jsonb_set(v_s,'{analysis}',v_a,true));
  end loop;
  return jsonb_set(v_doc,'{document_graph,sentences}',v_sentences,true);
end;
$function$;
