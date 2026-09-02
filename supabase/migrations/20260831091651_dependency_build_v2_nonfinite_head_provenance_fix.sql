create or replace function public.dependency_build_grammatical_head_provenance_v2(p_release_code text,p_predicate_kind text)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select case when p_predicate_kind='nonfinite_infinitive'
  then case when public.dependency_build_source_v2(p_release_code,'verb.infinitive.construction_head')='{}'::jsonb then '[]'::jsonb else jsonb_build_array(public.dependency_build_source_v2(p_release_code,'verb.infinitive.construction_head')) end
  else public.dependency_build_provenance_v2(p_release_code,'grammatical_head_of_predicate')
end;
$function$;

create or replace function public.resolve_dependency_build_v2(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.12')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_deps jsonb:='[]'::jsonb; v_hyp jsonb:='[]'::jsonb; v_blocked jsonb:='[]'::jsonb;
  v_clause jsonb; v_pred jsonb; v_ph jsonb; v_bc jsonb; v_clause_id text; v_pred_id text; v_kind text;
  v_subj int; v_finite int; v_gram int; v_lex int; v_comp int; v_members jsonb; v_idx int; v_prev int; v_dep jsonb; v_marker int;
begin
  for v_clause in select c from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,clauses}','[]'::jsonb)) c loop
    v_clause_id:=v_clause->>'id'; v_pred_id:=v_clause->>'predicate_id'; v_pred:=public.dependency_build_predicate_by_id_v2(p_analysis,v_pred_id);
    if v_pred is null then continue; end if;
    v_kind:=v_pred->>'predicate_kind'; v_members:=coalesce(v_pred->'member_token_indices','[]'::jsonb);
    v_finite:=nullif(v_pred->>'finite_token_index','')::int; v_gram:=nullif(v_pred->>'grammatical_head_token_index','')::int;
    v_lex:=nullif(v_pred->>'lexical_head_token_index','')::int; v_comp:=nullif(v_pred->>'predicative_complement_token_index','')::int;
    v_subj:=nullif(v_clause->>'subject_token_index','')::int;
    v_deps:=v_deps||jsonb_build_array(jsonb_build_object('id','dep2:predicate_of_clause:'||v_pred_id||':'||v_clause_id,'status','resolved','relation','predicate_of_clause','source_entity','predicate','source_id',v_pred_id,'source_surface',v_pred->>'surface','target_entity','clause','target_id',v_clause_id,'target_surface',v_clause->>'surface','clause_id',v_clause_id,'predicate_id',v_pred_id,'reason_code','resolved_predicate_materializes_clause_core','provenance',public.dependency_build_provenance_v2(p_release_code,'predicate_of_clause')));
    if v_clause->>'clause_type'='finite' and v_subj is not null then
      v_deps:=v_deps||jsonb_build_array(jsonb_build_object('id','dep2:subject_of:'||v_clause_id||':t'||v_subj||':'||v_pred_id,'status','resolved','relation','subject_of','source_entity','token','source_token_index',v_subj,'source_surface',public.dependency_build_token_surface_v2(p_analysis,v_subj),'target_entity','predicate','target_id',v_pred_id,'target_surface',v_pred->>'surface','clause_id',v_clause_id,'predicate_id',v_pred_id,'reason_code','explicit_clause_subject_of_resolved_predicate','provenance',public.dependency_build_provenance_v2(p_release_code,'subject_of')));
    end if;
    if v_gram is not null then
      v_deps:=v_deps||jsonb_build_array(jsonb_build_object('id','dep2:grammatical_head:'||v_pred_id||':t'||v_gram,'status','resolved','relation','grammatical_head_of_predicate','source_entity','token','source_token_index',v_gram,'source_surface',public.dependency_build_token_surface_v2(p_analysis,v_gram),'target_entity','predicate','target_id',v_pred_id,'target_surface',v_pred->>'surface','predicate_id',v_pred_id,'reason_code','predicate_build_grammatical_head','provenance',public.dependency_build_grammatical_head_provenance_v2(p_release_code,v_kind)));
    end if;
    if v_finite is not null then
      v_deps:=v_deps||jsonb_build_array(jsonb_build_object('id','dep2:finite_member:'||v_pred_id||':t'||v_finite,'status','resolved','relation','finite_member_of_predicate','source_entity','token','source_token_index',v_finite,'source_surface',public.dependency_build_token_surface_v2(p_analysis,v_finite),'target_entity','predicate','target_id',v_pred_id,'target_surface',v_pred->>'surface','predicate_id',v_pred_id,'reason_code','predicate_build_finite_member','provenance',public.dependency_build_provenance_v2(p_release_code,'finite_member_of_predicate')));
    end if;
    if v_lex is not null and (v_gram is null or v_lex<>v_gram) then
      v_deps:=v_deps||jsonb_build_array(jsonb_build_object('id','dep2:lexical_head:'||v_pred_id||':t'||v_lex,'status','resolved','relation','lexical_head_of_predicate','source_entity','token','source_token_index',v_lex,'source_surface',public.dependency_build_token_surface_v2(p_analysis,v_lex),'target_entity','predicate','target_id',v_pred_id,'target_surface',v_pred->>'surface','predicate_id',v_pred_id,'reason_code','predicate_build_lexical_head','provenance',public.dependency_build_provenance_v2(p_release_code,'lexical_head_of_predicate')));
    end if;
    if v_kind='modal_compound' and v_finite is not null and v_lex is not null then
      v_deps:=v_deps||jsonb_build_array(jsonb_build_object('id','dep2:modal_governs:'||v_pred_id||':t'||v_finite||':t'||v_lex,'status','resolved','relation','modal_governs','source_entity','token','source_token_index',v_finite,'source_surface',public.dependency_build_token_surface_v2(p_analysis,v_finite),'target_entity','token','target_token_index',v_lex,'target_surface',public.dependency_build_token_surface_v2(p_analysis,v_lex),'predicate_id',v_pred_id,'reason_code','resolved_modal_compound_governor_chain','provenance',public.dependency_build_provenance_v2(p_release_code,'modal_governs')));
    elsif v_kind='modal_chain' then
      v_prev:=null;
      for v_idx in select value::int from jsonb_array_elements_text(v_members) order by value::int loop
        if v_prev is not null then
          v_deps:=v_deps||jsonb_build_array(jsonb_build_object('id','dep2:modal_governs:'||v_pred_id||':t'||v_prev||':t'||v_idx,'status','resolved','relation','modal_governs','source_entity','token','source_token_index',v_prev,'source_surface',public.dependency_build_token_surface_v2(p_analysis,v_prev),'target_entity','token','target_token_index',v_idx,'target_surface',public.dependency_build_token_surface_v2(p_analysis,v_idx),'predicate_id',v_pred_id,'reason_code','resolved_modal_chain_order','provenance',public.dependency_build_provenance_v2(p_release_code,'modal_governs')));
        end if;
        v_prev:=v_idx;
      end loop;
    elsif v_kind='auxiliary_compound' and v_finite is not null and v_lex is not null then
      v_deps:=v_deps||jsonb_build_array(jsonb_build_object('id','dep2:aux_governs:'||v_pred_id||':t'||v_finite||':t'||v_lex,'status','resolved','relation','auxiliary_governs','source_entity','token','source_token_index',v_finite,'source_surface',public.dependency_build_token_surface_v2(p_analysis,v_finite),'target_entity','token','target_token_index',v_lex,'target_surface',public.dependency_build_token_surface_v2(p_analysis,v_lex),'predicate_id',v_pred_id,'reason_code','resolved_auxiliary_nonfinite_complement','provenance',public.dependency_build_provenance_v2(p_release_code,'auxiliary_governs')));
    elsif v_kind='copular' and v_gram is not null and v_comp is not null then
      v_deps:=v_deps||jsonb_build_array(jsonb_build_object('id','dep2:copula_links:'||v_pred_id||':t'||v_gram||':t'||v_comp,'status','resolved','relation','copula_links_predicative','source_entity','token','source_token_index',v_gram,'source_surface',public.dependency_build_token_surface_v2(p_analysis,v_gram),'target_entity','token','target_token_index',v_comp,'target_surface',public.dependency_build_token_surface_v2(p_analysis,v_comp),'predicate_id',v_pred_id,'reason_code','resolved_copular_predicative_link','provenance',public.dependency_build_provenance_v2(p_release_code,'copula_links_predicative')));
    elsif v_kind='nonfinite_infinitive' then
      select min(value::int) into v_marker from jsonb_array_elements_text(v_members);
      if v_marker is not null and public.dependency_build_token_surface_v2(p_analysis,v_marker)='å' and v_gram is not null then
        v_deps:=v_deps||jsonb_build_array(jsonb_build_object('id','dep2:inf_marker:'||v_pred_id||':t'||v_marker||':t'||v_gram,'status','resolved','relation','infinitive_marker_of_predicate','source_entity','token','source_token_index',v_marker,'source_surface','å','target_entity','predicate','target_id',v_pred_id,'target_surface',v_pred->>'surface','predicate_id',v_pred_id,'reason_code','marked_infinitive_marker','provenance',public.dependency_build_provenance_v2(p_release_code,'infinitive_marker_of_predicate')));
      end if;
    end if;
  end loop;
  for v_ph in select h from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,clause_hypotheses}','[]'::jsonb)) h loop
    v_hyp:=v_hyp||jsonb_build_array(jsonb_build_object('id','deph2:'||(v_ph->>'id'),'status','hypothesis','relation','clause_dependency_set','source_entity','clause_hypothesis','source_id',v_ph->>'id','source_surface',v_ph->>'surface','reason_code',coalesce(v_ph->>'reason_code','upstream_clause_hypothesis'),'requires_resolution',true,'predicate_kind',v_ph->>'predicate_kind','subject_token_index',v_ph->'subject_token_index','finite_token_index',v_ph->'finite_token_index','blocked_events',coalesce(v_ph->'blocked_events','[]'::jsonb)));
  end loop;
  for v_bc in select b from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,blocked_clauses}','[]'::jsonb)) b loop
    v_blocked:=v_blocked||jsonb_build_array(jsonb_build_object('id','depblocked2:'||(v_bc->>'id'),'status','blocked','relation','clause_dependency_set','source_entity','blocked_clause','source_id',v_bc->>'id','source_surface',v_bc->>'surface','reason_code',coalesce(v_bc->>'reason_code','upstream_blocked_clause'),'requires_resolution',true,'subject_token_index',v_bc->'subject_token_index','finite_token_index',v_bc->'finite_token_index','blocked_events',coalesce(v_bc->'blocked_events','[]'::jsonb)));
  end loop;
  return jsonb_build_object('version','dependency-build-v2','status','ready','dependencies',v_deps,'dependency_hypotheses',v_hyp,'blocked_dependencies',v_blocked,'summary',jsonb_build_object('dependency_count',jsonb_array_length(v_deps),'hypothesis_count',jsonb_array_length(v_hyp),'blocked_count',jsonb_array_length(v_blocked),'subject_of_count',(select count(*) from jsonb_array_elements(v_deps) x where x->>'relation'='subject_of'),'predicate_of_clause_count',(select count(*) from jsonb_array_elements(v_deps) x where x->>'relation'='predicate_of_clause')));
end;
$function$;
