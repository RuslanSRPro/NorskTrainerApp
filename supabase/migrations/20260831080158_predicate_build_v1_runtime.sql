create or replace function public.build_predicates_v1(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.10')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_groups jsonb:=coalesce(p_analysis#>'{language_graph,construction_resolution_v1,resolution_groups}','[]'::jsonb);
  v_decisions jsonb:=coalesce(p_analysis#>'{language_graph,construction_resolution_v1,construction_decisions}','[]'::jsonb);
  v_predicates jsonb:='[]'::jsonb; v_hyp jsonb:='[]'::jsonb; v_blocked jsonb:='[]'::jsonb;
  g jsonb; d jsonb; c jsonb; cl jsonb; v_members jsonb; v_surface text; v_family text; v_status text;
  v_finite integer; v_lexical integer; v_gram integer; v_comp integer; v_kind text; v_pred_id text; v_group_id text;
  v_covered_finite integer[]:=array[]::integer[]; v_tok jsonb; v_prov jsonb; v_clause_finite integer;
begin
  if not exists(select 1 from public.grammar_runtime_releases r where r.code=p_release_code) then raise exception 'Release % not found',p_release_code; end if;

  for g in select x from jsonb_array_elements(v_groups) x order by nullif(x->>'span_start','')::integer nulls last, x->>'group_id' loop
    v_group_id:=g->>'group_id'; v_status:=g->>'status';
    v_members:=public.predicate_build_group_member_indices_v1(p_analysis,g);
    v_finite:=public.predicate_build_finite_index_v1(p_analysis,coalesce(nullif(g->>'span_start','')::integer,1),coalesce(nullif(g->>'span_end','')::integer,2147483647));
    if v_finite is not null then v_covered_finite:=array_append(v_covered_finite,v_finite); end if;
    v_surface:=public.predicate_build_surface_v1(p_analysis,v_members);

    if v_status='blocked' then
      v_blocked:=v_blocked||jsonb_build_array(jsonb_build_object(
        'id','predb1:'||v_group_id,'status','blocked','group_id',v_group_id,'surface',coalesce(v_surface,''),
        'span_start',g->'span_start','span_end',g->'span_end','member_token_indices',v_members,
        'finite_token_index',v_finite,'reason_code',g->>'reason_code','blocked_events',coalesce(g->'blocked_events','[]'::jsonb)
      ));
      continue;
    end if;

    select x into d from jsonb_array_elements(v_decisions) x
    where x->>'group_id'=v_group_id and x->>'decision'='selected'
    order by x->>'construction_id' limit 1;
    if d is null then
      select x into d from jsonb_array_elements(v_decisions) x where x->>'group_id'=v_group_id order by x->>'construction_id' limit 1;
    end if;
    v_family:=d->>'family'; c:=public.predicate_build_construction_by_id_v1(p_analysis,d->>'construction_id');

    if v_status='unresolved' then
      v_hyp:=v_hyp||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'id','predh1:'||v_group_id,'status','hypothesis','group_id',v_group_id,'surface',coalesce(v_surface,d->>'surface'),
        'predicate_kind',case when v_family='copular_predicative' then 'copular' else coalesce(v_family,'unresolved_construction') end,
        'finiteness',case when v_finite is null then 'nonfinite' else 'finite' end,'finite_token_index',v_finite,
        'grammatical_head_token_index',v_finite,'member_token_indices',v_members,'span_start',g->'span_start','span_end',g->'span_end',
        'reason_code',g->>'reason_code','construction_ids',g->'construction_ids','blocked_events',g->'blocked_events',
        'source_decision',d
      )));
      continue;
    end if;

    if v_family='modal_auxiliary_chain' then
      v_kind:='modal_chain'; v_gram:=v_finite; v_lexical:=public.predicate_build_last_verb_index_v1(p_analysis,v_members);
      v_prov:=jsonb_build_array(public.predicate_build_source_v1(p_release_code,'verb.phrase.predicate'),public.predicate_build_source_v1(p_release_code,'verb.modal_auxiliary.chain'),public.predicate_build_source_v1(p_release_code,'verb.modal_auxiliary.chain.finiteness'));
    elsif v_family='modal_auxiliary_bare_infinitive' then
      v_kind:='modal_compound'; v_gram:=v_finite; v_lexical:=nullif(c->>'complement_token_index','')::integer;
      v_prov:=jsonb_build_array(public.predicate_build_source_v1(p_release_code,'verb.phrase.predicate'),public.predicate_build_source_v1(p_release_code,'verb.form.finite.auxiliary_compound'));
    elsif v_family='auxiliary_nonfinite_complement' then
      v_kind:='auxiliary_compound'; v_gram:=v_finite; v_lexical:=nullif(c->>'complement_token_index','')::integer;
      v_prov:=jsonb_build_array(public.predicate_build_source_v1(p_release_code,'verb.compound_form.semantic_unit_predicate'),public.predicate_build_source_v1(p_release_code,'verb.compound_form.finite_aux_nonfinite_main'));
    elsif v_family='copular_predicative' then
      v_kind:='copular'; v_gram:=v_finite; v_lexical:=null; v_comp:=nullif(c->>'predicative_token_index','')::integer;
      v_prov:=jsonb_build_array(public.predicate_build_source_v1(p_release_code,'grammar.foundations.phrase.copula_predicative_link'),public.predicate_build_source_v1(p_release_code,'grammar.foundations.sentence.finite_predicate'));
    elsif v_family='marked_infinitive' then
      v_kind:='nonfinite_infinitive'; v_gram:=nullif(c->>'head_token_index','')::integer; v_lexical:=v_gram; v_finite:=null;
      v_prov:=jsonb_build_array(public.predicate_build_source_v1(p_release_code,'verb.infinitive.construction_head'),public.predicate_build_source_v1(p_release_code,'verb.phrase.predicate'));
    else
      v_kind:='simple_verbal'; v_gram:=v_finite; v_lexical:=v_finite; v_prov:=jsonb_build_array(public.predicate_build_source_v1(p_release_code,'verb.phrase.predicate'));
    end if;

    v_pred_id:='pred1:'||v_group_id;
    v_predicates:=v_predicates||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id',v_pred_id,'status','resolved','predicate_kind',v_kind,'finiteness',case when v_finite is null then 'nonfinite' else 'finite' end,
      'surface',coalesce(v_surface,d->>'surface'),'span_start',g->'span_start','span_end',g->'span_end','member_token_indices',v_members,
      'finite_token_index',v_finite,'grammatical_head_token_index',v_gram,'lexical_head_token_index',v_lexical,
      'predicative_complement_token_index',v_comp,'source_resolution_group_id',v_group_id,'source_construction_id',d->>'construction_id',
      'source_family',v_family,'provenance',v_prov
    )));
    v_comp:=null;
  end loop;

  for cl in select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clauses}','[]'::jsonb)) x order by nullif(x->>'finite_token_index','')::integer loop
    v_clause_finite:=nullif(cl->>'finite_token_index','')::integer;
    if v_clause_finite is null or v_clause_finite=any(v_covered_finite) then continue; end if;
    v_tok:=public.predicate_build_token_by_index_v1(p_analysis,v_clause_finite);
    v_predicates:=v_predicates||jsonb_build_array(jsonb_build_object(
      'id','pred1:simple:'||v_clause_finite,'status','resolved','predicate_kind','simple_verbal','finiteness','finite',
      'surface',v_tok->>'surface','span_start',v_clause_finite,'span_end',v_clause_finite,'member_token_indices',jsonb_build_array(v_clause_finite),
      'finite_token_index',v_clause_finite,'grammatical_head_token_index',v_clause_finite,'lexical_head_token_index',v_clause_finite,
      'source_clause_id',cl->>'id','reason_code','finite_clause_anchor_without_resolved_construction',
      'provenance',jsonb_build_array(public.predicate_build_source_v1(p_release_code,'verb.phrase.predicate'),public.predicate_build_source_v1(p_release_code,'verb.form.finite.predicate_head'))
    ));
  end loop;

  return jsonb_build_object('version','predicate-build-v1','status','ready','predicates',v_predicates,'predicate_hypotheses',v_hyp,'blocked_predicates',v_blocked,
    'summary',jsonb_build_object('predicate_count',jsonb_array_length(v_predicates),'hypothesis_count',jsonb_array_length(v_hyp),'blocked_count',jsonb_array_length(v_blocked),
      'finite_count',(select count(*) from jsonb_array_elements(v_predicates) p where p->>'finiteness'='finite'),'nonfinite_count',(select count(*) from jsonb_array_elements(v_predicates) p where p->>'finiteness'='nonfinite')));
end;
$function$;

create or replace function public.apply_predicate_build_v1(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.10')
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog' as $function$
declare v_layer jsonb;
begin v_layer:=public.build_predicates_v1(p_analysis,p_release_code); return jsonb_set(p_analysis,'{language_graph,predicate_build_v1}',v_layer,true); end;
$function$;

create or replace function public.analyze_text_structural_shadow_v10(p_text text,p_release_code text default 'runtime-structural-v1.10')
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog' as $function$
declare v_doc jsonb; v_sentences jsonb:='[]'::jsonb; v_s jsonb; v_analysis jsonb;
begin
  v_doc:=public.analyze_text_structural_shadow_v9(p_text,p_release_code);
  for v_s in select s from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences}','[]'::jsonb)) s loop
    v_analysis:=public.apply_predicate_build_v1(v_s->'analysis',p_release_code);
    v_sentences:=v_sentences||jsonb_build_array(jsonb_set(v_s,'{analysis}',v_analysis,true));
  end loop;
  v_doc:=jsonb_set(v_doc,'{document_graph,sentences}',v_sentences,true);
  return v_doc||jsonb_build_object('engine_version','grammar-structural-shadow-v10','predicate_build',jsonb_build_object('contract','predicate-build-v1','authoritative_output','document_graph.sentences[].analysis.language_graph.predicate_build_v1.predicates','hypothesis_output','document_graph.sentences[].analysis.language_graph.predicate_build_v1.predicate_hypotheses'));
end;
$function$;
