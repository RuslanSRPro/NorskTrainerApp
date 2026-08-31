create or replace function public.resolve_construction_recognition_v1(p_analysis jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_tokens jsonb:=coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
  v_morph jsonb:=coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb);
  v_constructions jsonb:='[]'::jsonb;
  v_blocked jsonb:='[]'::jsonb;
  v_overlaps jsonb:='[]'::jsonb;
  t jsonb; t2 jsonb; t3 jsonb; m jsonb; m2 jsonb; m3 jsonb;
  i integer; n integer:=jsonb_array_length(v_tokens);
  pos1 text; pos2 text; pos3 text; lemma2 text; status text; c jsonb;
  modal1 boolean; modal2 boolean; cop1 boolean; auxha1 boolean; auxbli1 boolean;
  forms2 jsonb; forms3 jsonb; pred_types jsonb;
begin
  if not exists(select 1 from public.grammar_runtime_releases where code=p_release_code and status in ('build','golden','shadow')) then
    raise exception 'Construction Recognition release % not available',p_release_code;
  end if;

  for i in 1..n loop
    t:=public.construction_recognition_item_by_index_v1(v_tokens,i);
    m:=public.construction_recognition_item_by_index_v1(v_morph,i);
    pos1:=public.construction_recognition_refined_pos_v1(p_analysis,i);
    modal1:=public.construction_recognition_token_matches_set_v1(t,p_release_code,'modal_verb');
    cop1:=public.construction_recognition_token_matches_set_v1(t,p_release_code,'copula');
    auxha1:=public.construction_recognition_token_matches_set_v1(t,p_release_code,'auxiliary_ha');
    auxbli1:=public.construction_recognition_token_matches_set_v1(t,p_release_code,'auxiliary_bli');

    if i<n then
      t2:=public.construction_recognition_item_by_index_v1(v_tokens,i+1);
      m2:=public.construction_recognition_item_by_index_v1(v_morph,i+1);
      pos2:=public.construction_recognition_refined_pos_v1(p_analysis,i+1);
      forms2:=public.construction_recognition_morph_forms_v1(m2);

      -- Modal auxiliary + adjacent bare infinitive.
      if modal1 and pos1='verb' and pos2='verb' and public.construction_recognition_morph_has_form_v1(m2,'Inf') then
        c:=jsonb_build_object(
          'id',format('cr1:modal_bare_inf:%s:%s',i,i+1),
          'family','modal_auxiliary_bare_infinitive','status','recognized','span_start',i,'span_end',i+1,
          'member_token_indices',jsonb_build_array(i,i+1),'head_token_index',i,'complement_token_index',i+1,
          'surface',concat_ws(' ',t->>'surface',t2->>'surface'),'requires_resolution',false,
          'evidence',jsonb_build_array(
            jsonb_build_object('type','compiled_lexical_set','set','modal_verb','token_index',i),
            jsonb_build_object('type','refined_pos','token_index',i+1,'pos','verb'),
            jsonb_build_object('type','morphology','token_index',i+1,'VerbForm','Inf')
          ),
          'provenance',jsonb_build_array(
            public.construction_recognition_source_v1(p_release_code,'verb.modal_auxiliary.bare_infinitive'),
            public.construction_recognition_source_v1(p_release_code,'verb.infinitive.bare_after_auxiliary')
          )
        );
        v_constructions:=public.construction_recognition_append_unique_v1(v_constructions,c);
      end if;

      -- Marked infinitive: å + infinitive. Recognition is independent of governor resolution.
      if lower(coalesce(t->>'surface',''))='å' and pos2='verb' and public.construction_recognition_morph_has_form_v1(m2,'Inf') then
        c:=jsonb_build_object(
          'id',format('cr1:marked_inf:%s:%s',i,i+1),
          'family','marked_infinitive','status','recognized','span_start',i,'span_end',i+1,
          'member_token_indices',jsonb_build_array(i,i+1),'marker_token_index',i,'head_token_index',i+1,
          'surface',concat_ws(' ',t->>'surface',t2->>'surface'),'requires_resolution',false,
          'evidence',jsonb_build_array(
            jsonb_build_object('type','surface_marker','token_index',i,'surface','å'),
            jsonb_build_object('type','refined_pos','token_index',i+1,'pos','verb'),
            jsonb_build_object('type','morphology','token_index',i+1,'VerbForm','Inf')
          ),
          'provenance',jsonb_build_array(
            public.construction_recognition_source_v1(p_release_code,'verb.infinitive.marker.aa'),
            public.construction_recognition_source_v1(p_release_code,'verb.infinitive.construction_head')
          )
        );
        v_constructions:=public.construction_recognition_append_unique_v1(v_constructions,c);
      end if;

      -- Auxiliary ha + nonfinite complement.
      if auxha1 and pos1='verb' and pos2='verb'
         and (public.construction_recognition_morph_has_form_v1(m2,'Inf') or public.construction_recognition_morph_has_form_v1(m2,'Part')) then
        c:=jsonb_build_object(
          'id',format('cr1:aux_nonfinite:%s:%s',i,i+1),
          'family','auxiliary_nonfinite_complement','subfamily','ha_nonfinite','status','recognized',
          'span_start',i,'span_end',i+1,'member_token_indices',jsonb_build_array(i,i+1),
          'head_token_index',i,'complement_token_index',i+1,'surface',concat_ws(' ',t->>'surface',t2->>'surface'),
          'requires_resolution',true,
          'evidence',jsonb_build_array(
            jsonb_build_object('type','compiled_lexical_set','set','auxiliary_ha','token_index',i),
            jsonb_build_object('type','refined_pos','token_index',i+1,'pos','verb'),
            jsonb_build_object('type','morphology_forms','token_index',i+1,'forms',forms2)
          ),
          'provenance',jsonb_build_array(public.construction_recognition_source_v1(p_release_code,'verb.auxiliary.complement.nonfinite_main'))
        );
        v_constructions:=public.construction_recognition_append_unique_v1(v_constructions,c);
      end if;

      -- Copula + predicative. Construction identity can be recognized while complement type stays ambiguous.
      if cop1 and pos1='verb' then
        pred_types:='[]'::jsonb;
        if pos2 in ('noun','adjective','adverb','preposition','pronoun','determiner') then
          pred_types:=pred_types||jsonb_build_array(pos2);
        else
          if public.construction_recognition_token_has_source_pos_v1(t2,'noun') then pred_types:=pred_types||jsonb_build_array('noun'); end if;
          if public.construction_recognition_token_has_source_pos_v1(t2,'adjective') then pred_types:=pred_types||jsonb_build_array('adjective'); end if;
        end if;
        if jsonb_array_length(pred_types)>0 then
          status:=case when jsonb_array_length(pred_types)=1 then 'recognized' else 'hypothesis' end;
          c:=jsonb_build_object(
            'id',format('cr1:copular_predicative:%s:%s',i,i+1),
            'family','copular_predicative','status',status,'span_start',i,'span_end',i+1,
            'member_token_indices',jsonb_build_array(i,i+1),'copula_token_index',i,'predicative_token_index',i+1,
            'surface',concat_ws(' ',t->>'surface',t2->>'surface'),
            'predicative_type_candidates',pred_types,
            'requires_resolution',(jsonb_array_length(pred_types)>1 or auxbli1),
            'evidence',jsonb_build_array(
              jsonb_build_object('type','compiled_lexical_set','set','copula','token_index',i),
              jsonb_build_object('type','predicative_type_candidates','token_index',i+1,'values',pred_types)
            ),
            'provenance',jsonb_build_array(public.construction_recognition_source_v1(p_release_code,'sentence.predicative.subject.copula.constituent_type_eligibility'))
          );
          v_constructions:=public.construction_recognition_append_unique_v1(v_constructions,c);
        end if;
      end if;

      -- Explicit upstream blocker for bli + surface that cannot yet be identified as participle/verb.
      if auxbli1 and pos1='verb' and pos2<>'verb' and lower(coalesce(t2->>'surface',''))<>'' then
        v_blocked:=v_blocked||jsonb_build_array(jsonb_build_object(
          'family','passive','status','upstream_blocked','span_start',i,'span_end',i+1,
          'reason_code','nonfinite_verb_or_participle_not_available_from_upstream_morphology',
          'member_token_indices',jsonb_build_array(i,i+1),'surface',concat_ws(' ',t->>'surface',t2->>'surface')
        ));
      end if;

      -- modal + direction without overt verb: preserve as blocked/deferred, not a recognized construction in V1.
      if modal1 and pos1='verb' and pos2 is not null and pos2<>'verb' then
        v_blocked:=v_blocked||jsonb_build_array(jsonb_build_object(
          'family','modal_ellipsis_motion','status','deferred','span_start',i,'span_end',i+1,
          'reason_code','ellipsis_recovery_not_in_construction_recognition_v1',
          'member_token_indices',jsonb_build_array(i,i+1),'surface',concat_ws(' ',t->>'surface',t2->>'surface')
        ));
      end if;
    end if;

    -- Modal chain: adjacent modal lemmas; V1 recognizes each adjacent link and a 3-member chain.
    if i<n then
      t2:=public.construction_recognition_item_by_index_v1(v_tokens,i+1);
      modal2:=public.construction_recognition_token_matches_set_v1(t2,p_release_code,'modal_verb');
      if modal1 and modal2 and public.construction_recognition_refined_pos_v1(p_analysis,i)='verb'
         and public.construction_recognition_refined_pos_v1(p_analysis,i+1)='verb' then
        c:=jsonb_build_object(
          'id',format('cr1:modal_chain:%s:%s',i,i+1),'family','modal_auxiliary_chain','status','recognized',
          'span_start',i,'span_end',i+1,'member_token_indices',jsonb_build_array(i,i+1),'surface',concat_ws(' ',t->>'surface',t2->>'surface'),
          'requires_resolution',true,
          'evidence',jsonb_build_array(
            jsonb_build_object('type','compiled_lexical_set','set','modal_verb','token_indices',jsonb_build_array(i,i+1)),
            jsonb_build_object('type','morphology_forms','token_index',i+1,'forms',public.construction_recognition_morph_forms_v1(public.construction_recognition_item_by_index_v1(v_morph,i+1)))
          ),
          'provenance',jsonb_build_array(
            public.construction_recognition_source_v1(p_release_code,'verb.modal_auxiliary.chain'),
            public.construction_recognition_source_v1(p_release_code,'verb.modal_auxiliary.chain.finiteness')
          )
        );
        v_constructions:=public.construction_recognition_append_unique_v1(v_constructions,c);
      end if;
    end if;
  end loop;

  -- Explicit overlap relations.
  for c in select x from jsonb_array_elements(v_constructions) x loop
    for t in select y from jsonb_array_elements(v_constructions) y
      where y->>'id'<>c->>'id'
        and (y->>'span_start')::integer <= (c->>'span_end')::integer
        and (c->>'span_start')::integer <= (y->>'span_end')::integer
    loop
      if (c->>'id') < (t->>'id') then
        v_overlaps:=v_overlaps||jsonb_build_array(jsonb_build_object(
          'left_id',c->>'id','right_id',t->>'id','relation','overlaps','requires_resolution',true
        ));
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'version','construction-recognition-v1','status','ready','constructions',v_constructions,
    'overlaps',v_overlaps,'blocked_events',v_blocked,
    'summary',jsonb_build_object(
      'construction_count',jsonb_array_length(v_constructions),
      'recognized_count',(select count(*) from jsonb_array_elements(v_constructions) x where x->>'status'='recognized'),
      'hypothesis_count',(select count(*) from jsonb_array_elements(v_constructions) x where x->>'status'='hypothesis'),
      'overlap_count',jsonb_array_length(v_overlaps),'blocked_count',jsonb_array_length(v_blocked)
    )
  );
end;
$function$;

create or replace function public.apply_construction_recognition_v1(p_analysis jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_layer jsonb; v_graph jsonb:=coalesce(p_analysis->'language_graph','{}'::jsonb);
begin
  v_layer:=public.resolve_construction_recognition_v1(p_analysis,p_release_code);
  v_graph:=jsonb_set(v_graph,'{construction_recognition_v1}',v_layer,true);
  return jsonb_set(p_analysis,'{language_graph}',v_graph,true);
end;
$function$;

create or replace function public.analyze_text_structural_shadow_v8(
  p_text text,p_release_code text default 'runtime-structural-v1.8'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_doc jsonb; v_sentences jsonb:='[]'::jsonb; v_s jsonb; v_analysis jsonb;
begin
  v_doc:=public.analyze_text_structural_shadow_v7(p_text,p_release_code);
  for v_s in select s from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences}','[]'::jsonb)) s loop
    v_analysis:=public.apply_construction_recognition_v1(v_s->'analysis',p_release_code);
    v_sentences:=v_sentences||jsonb_build_array(jsonb_set(v_s,'{analysis}',v_analysis,true));
  end loop;
  v_doc:=jsonb_set(v_doc,'{document_graph,sentences}',v_sentences,true);
  return v_doc||jsonb_build_object(
    'engine_version','grammar-structural-shadow-v8',
    'construction_recognition',jsonb_build_object(
      'contract','construction-recognition-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.construction_recognition_v1.constructions'
    )
  );
end;
$function$;;
