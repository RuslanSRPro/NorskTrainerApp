create or replace function public.build_clause_layer_v1(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.11')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_pred jsonb; v_hyp jsonb; v_block jsonb; v_anchor jsonb;
  v_clauses jsonb:='[]'::jsonb; v_hypotheses jsonb:='[]'::jsonb; v_blocked jsonb:='[]'::jsonb;
  v_finite integer; v_subj integer; v_start integer; v_end integer; v_surface text; v_item jsonb;
  v_schema text; v_subject_surface text; v_clause_count int; v_fin_count int; v_nonfin_count int;
begin
  -- Authoritative predicates.
  for v_pred in select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicates}','[]'::jsonb)) x
  loop
    if v_pred->>'finiteness'='finite' then
      v_finite:=nullif(v_pred->>'finite_token_index','')::integer;
      v_anchor:=public.clause_build_legacy_anchor_v1(p_analysis,v_finite);
      if v_anchor is null then
        v_item:=jsonb_build_object(
          'id','clh1:missing_subject:'||(v_pred->>'id'),
          'status','hypothesis','clause_type','finite','clause_form','finite_predicate_core',
          'predicate_id',v_pred->>'id','predicate_kind',v_pred->>'predicate_kind',
          'finite_token_index',v_finite,'reason_code','finite_predicate_without_explicit_subject_anchor',
          'predicate_snapshot',v_pred,'requires_resolution',true
        );
        v_hypotheses:=v_hypotheses||jsonb_build_array(v_item);
      else
        v_subj:=nullif(v_anchor->>'subject_token_index','')::integer;
        v_start:=least(v_subj,coalesce(nullif(v_pred->>'span_start','')::integer,v_finite));
        v_end:=greatest(v_subj,coalesce(nullif(v_pred->>'span_end','')::integer,v_finite));
        v_surface:=public.clause_build_surface_range_v1(p_analysis,v_start,v_end);
        v_schema:=v_anchor->>'schema'; v_subject_surface:=v_anchor->>'subject_surface';
        v_item:=jsonb_build_object(
          'id','clb1:finite:'||(v_pred->>'id'),
          'status','resolved','clause_type','finite','clause_form','finite_predicate_core',
          'surface',v_surface,'span_start',v_start,'span_end',v_end,
          'predicate_id',v_pred->>'id','predicate_kind',v_pred->>'predicate_kind',
          'finite_token_index',v_finite,'subject_token_index',v_subj,'subject_surface',v_subject_surface,
          'subject_status','explicit','schema_hint',v_schema,
          'attachment_state','matrix_or_sentence_core',
          'predicate_member_token_indices',coalesce(v_pred->'member_token_indices','[]'::jsonb),
          'provenance',public.clause_build_provenance_v1(p_release_code,'finite'),
          'source_legacy_clause_id',v_anchor->>'id',
          'requires_resolution',false
        );
        v_clauses:=v_clauses||jsonb_build_array(v_item);
      end if;
    elsif v_pred->>'finiteness'='nonfinite' and v_pred->>'predicate_kind'='nonfinite_infinitive' then
      v_start:=nullif(v_pred->>'span_start','')::integer; v_end:=nullif(v_pred->>'span_end','')::integer;
      v_item:=jsonb_build_object(
        'id','clb1:nonfinite:'||(v_pred->>'id'),
        'status','resolved','clause_type','nonfinite','clause_form','nonfinite_infinitive',
        'surface',v_pred->>'surface','span_start',v_start,'span_end',v_end,
        'predicate_id',v_pred->>'id','predicate_kind',v_pred->>'predicate_kind',
        'subject_status','unexpressed','subject_token_index',null,
        'attachment_state','unresolved_nonfinite_attachment',
        'predicate_member_token_indices',coalesce(v_pred->'member_token_indices','[]'::jsonb),
        'provenance',public.clause_build_provenance_v1(p_release_code,'nonfinite'),
        'requires_resolution',true
      );
      v_clauses:=v_clauses||jsonb_build_array(v_item);
    end if;
  end loop;

  -- Unresolved predicate hypotheses become clause hypotheses; finite subject anchor may still be carried as evidence.
  for v_hyp in select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicate_hypotheses}','[]'::jsonb)) x
  loop
    v_finite:=nullif(v_hyp->>'finite_token_index','')::integer;
    if v_hyp->>'finiteness'='finite' and v_finite is not null then
      v_anchor:=public.clause_build_legacy_anchor_v1(p_analysis,v_finite);
      v_subj:=case when v_anchor is null then null else nullif(v_anchor->>'subject_token_index','')::integer end;
      v_start:=case when v_subj is null then nullif(v_hyp->>'span_start','')::integer else least(v_subj,nullif(v_hyp->>'span_start','')::integer) end;
      v_end:=case when v_subj is null then nullif(v_hyp->>'span_end','')::integer else greatest(v_subj,nullif(v_hyp->>'span_end','')::integer) end;
      v_surface:=public.clause_build_surface_range_v1(p_analysis,v_start,v_end);
      v_item:=jsonb_build_object(
        'id','clh1:'||(v_hyp->>'id'),'status','hypothesis','clause_type','finite','clause_form','finite_predicate_core',
        'surface',v_surface,'span_start',v_start,'span_end',v_end,'predicate_hypothesis_id',v_hyp->>'id',
        'predicate_kind',v_hyp->>'predicate_kind','finite_token_index',v_finite,
        'subject_token_index',v_subj,'subject_surface',case when v_anchor is null then null else v_anchor->>'subject_surface' end,
        'subject_status',case when v_subj is null then 'unresolved' else 'explicit_anchor' end,
        'schema_hint',case when v_anchor is null then null else v_anchor->>'schema' end,
        'reason_code',v_hyp->>'reason_code','blocked_events',coalesce(v_hyp->'blocked_events','[]'::jsonb),
        'predicate_snapshot',v_hyp,'provenance',public.clause_build_provenance_v1(p_release_code,'finite'),
        'requires_resolution',true
      );
    else
      v_item:=jsonb_build_object(
        'id','clh1:'||(v_hyp->>'id'),'status','hypothesis','clause_type','nonfinite','clause_form','predicate_hypothesis',
        'surface',v_hyp->>'surface','span_start',v_hyp->'span_start','span_end',v_hyp->'span_end',
        'predicate_hypothesis_id',v_hyp->>'id','predicate_kind',v_hyp->>'predicate_kind',
        'subject_status','unresolved','reason_code',v_hyp->>'reason_code','predicate_snapshot',v_hyp,'requires_resolution',true
      );
    end if;
    v_hypotheses:=v_hypotheses||jsonb_build_array(v_item);
  end loop;

  -- Blocked predicate → blocked clause, carrying explicit subject anchor if available.
  for v_block in select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,blocked_predicates}','[]'::jsonb)) x
  loop
    v_finite:=nullif(v_block->>'finite_token_index','')::integer;
    v_anchor:=case when v_finite is null then null else public.clause_build_legacy_anchor_v1(p_analysis,v_finite) end;
    v_subj:=case when v_anchor is null then null else nullif(v_anchor->>'subject_token_index','')::integer end;
    v_start:=case when v_subj is null then nullif(v_block->>'span_start','')::integer else least(v_subj,nullif(v_block->>'span_start','')::integer) end;
    v_end:=case when v_subj is null then nullif(v_block->>'span_end','')::integer else greatest(v_subj,nullif(v_block->>'span_end','')::integer) end;
    v_surface:=public.clause_build_surface_range_v1(p_analysis,v_start,v_end);
    v_item:=jsonb_build_object(
      'id','clblocked1:'||(v_block->>'id'),'status','blocked','clause_type',case when v_finite is null then 'unknown' else 'finite' end,
      'clause_form','blocked_predicate_core','surface',v_surface,'span_start',v_start,'span_end',v_end,
      'blocked_predicate_id',v_block->>'id','finite_token_index',v_finite,'subject_token_index',v_subj,
      'subject_surface',case when v_anchor is null then null else v_anchor->>'subject_surface' end,
      'reason_code',v_block->>'reason_code','blocked_events',coalesce(v_block->'blocked_events','[]'::jsonb),
      'predicate_snapshot',v_block,'requires_resolution',true
    );
    v_blocked:=v_blocked||jsonb_build_array(v_item);
  end loop;

  select count(*)::int,count(*) filter(where x->>'clause_type'='finite')::int,count(*) filter(where x->>'clause_type'='nonfinite')::int
  into v_clause_count,v_fin_count,v_nonfin_count from jsonb_array_elements(v_clauses) x;

  return jsonb_build_object(
    'version','clause-build-v1','status','ready',
    'clauses',v_clauses,'clause_hypotheses',v_hypotheses,'blocked_clauses',v_blocked,
    'summary',jsonb_build_object(
      'clause_count',v_clause_count,'finite_count',v_fin_count,'nonfinite_count',v_nonfin_count,
      'hypothesis_count',jsonb_array_length(v_hypotheses),'blocked_count',jsonb_array_length(v_blocked)
    )
  );
end;
$function$;

create or replace function public.apply_clause_build_v1(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.11')
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog'
as $function$
declare v_layer jsonb;
begin
  v_layer:=public.build_clause_layer_v1(p_analysis,p_release_code);
  return jsonb_set(p_analysis,'{language_graph,clause_build_v1}',v_layer,true);
end;
$function$;

create or replace function public.analyze_text_structural_shadow_v11(p_text text,p_release_code text default 'runtime-structural-v1.11')
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog'
as $function$
declare v_doc jsonb; v_sentences jsonb:='[]'::jsonb; v_s jsonb; v_analysis jsonb;
begin
  v_doc:=public.analyze_text_structural_shadow_v10(p_text,p_release_code);
  for v_s in select s from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences}','[]'::jsonb)) s loop
    v_analysis:=public.apply_clause_build_v1(v_s->'analysis',p_release_code);
    v_sentences:=v_sentences||jsonb_build_array(jsonb_set(v_s,'{analysis}',v_analysis,true));
  end loop;
  v_doc:=jsonb_set(v_doc,'{document_graph,sentences}',v_sentences,true);
  return v_doc||jsonb_build_object('engine_version','grammar-structural-shadow-v11','clause_build',jsonb_build_object('contract','clause-build-v1','authoritative_output','document_graph.sentences[].analysis.language_graph.clause_build_v1.clauses'));
end;
$function$;
