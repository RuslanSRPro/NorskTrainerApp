create or replace function public.interpretation_provenance_v2(p_release_code text,p_family text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_out jsonb:='[]'::jsonb; v_codes text[]; v_code text; v_s jsonb;
begin
  v_codes:=case p_family
    when 'finite_predication' then array['grammar.foundations.sentence.subject_predicate_core']
    when 'morphological_tense' then array['verb.tense.definition.finite_form_entailment','grammar.foundations.inflection.tense','verb.tense.forms.simple_inventory','verb.tense.forms.morphological_opposition_carrier']
    when 'perfect_tense_form' then array['verb.tense.forms.perfect_system','verb.tense.forms.finite_auxiliary_opposition','verb.tense.forms.present_perfect','verb.tense.forms.preterite_perfect','verb.temporal_reference.punctual_terminative.perfect_system_before_relation']
    when 'modal_structure' then array['verb.modal_auxiliary.bare_infinitive','verb.modal_auxiliary.chain','verb.modal_auxiliary.chain.finiteness','verb.modal_auxiliary.chain.scope_order','verb.modal_constructions.modal_meaning_depends_on_sentence_type','verb.modal_constructions.modal_meaning_depends_on_tense']
    when 'copular_predication' then array['grammar.foundations.phrase.copula_predicative_link','sentence.predicative.subject.copula.core_verbal_requirement','sentence.predicative.subject.copula.constituent_type_eligibility']
    when 'nonfinite_infinitive_profile' then array['verb.infinitive.semantic_definition','grammar.foundations.sentence.infinitive_construction_definition','sentence.subordinate.explicative.nominal.infinitive.reference.infinitive_verbal_no_subject','sentence.subordinate.explicative.nominal.infinitive.subject.reference.unexpressed_but_interpreted_subject','sentence.subordinate.explicative.nominal.infinitive.subject.reference.controller_depends_on_function']
    else array[]::text[] end;
  foreach v_code in array v_codes loop
    v_s:=public.interpretation_source_v2(p_release_code,v_code);
    if v_s is not null and v_s<>'{}'::jsonb then v_out:=v_out||jsonb_build_array(v_s); end if;
  end loop;
  return v_out;
end;
$function$;

create or replace function public.resolve_interpretation_v2(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.14')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_interp jsonb:='[]'::jsonb;
  v_hyp jsonb:='[]'::jsonb;
  v_block jsonb:='[]'::jsonb;
  v_pred jsonb; v_clause jsonb; v_morph jsonb; v_lmorph jsonb; v_tok jsonb; v_dep jsonb; v_ch jsonb; v_cb jsonb;
  v_pid text; v_kind text; v_validation text; v_tense text; v_finite int; v_lh int; v_pc int;
  v_finite_lemma text; v_lh_form text; v_subject int; v_surface text; v_tense_value text;
  v_modal_members jsonb; v_modal_surfaces jsonb; v_modal_count int;
begin
  v_validation:=coalesce(p_analysis#>>'{language_graph,grammar_validation_v2,summary,overall_status}','invalid');

  if v_validation='invalid' then
    return jsonb_build_object(
      'version','interpretation-v2','status','gated_invalid','interpretations','[]'::jsonb,
      'interpretation_hypotheses','[]'::jsonb,'blocked_interpretations','[]'::jsonb,
      'summary',jsonb_build_object('resolved_count',0,'hypothesis_count',0,'blocked_count',0,'validation_gate','invalid'),
      'gate_reason','grammar_validation_v2_invalid'
    );
  end if;

  for v_pred in select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicates}','[]'::jsonb)) x loop
    v_pid:=v_pred->>'id'; v_kind:=v_pred->>'predicate_kind'; v_surface:=v_pred->>'surface';
    v_finite:=nullif(v_pred->>'finite_token_index','')::int;
    v_lh:=nullif(v_pred->>'lexical_head_token_index','')::int;
    v_pc:=nullif(v_pred->>'predicative_complement_token_index','')::int;
    v_clause:=public.interpretation_clause_by_predicate_v2(p_analysis,v_pid);

    if v_clause is not null and v_clause->>'status'='resolved' then
      v_interp:=v_interp||jsonb_build_array(jsonb_build_object(
        'id','int2:predication:'||v_pid,'status','resolved','family','finite_predication',
        'predicate_id',v_pid,'clause_id',v_clause->>'id','predicate_kind',v_kind,
        'surface',v_clause->>'surface','subject_token_index',nullif(v_clause->>'subject_token_index','')::int,
        'subject_surface',v_clause->>'subject_surface','finiteness',v_pred->>'finiteness',
        'value',jsonb_build_object('predication_type',case when v_pred->>'finiteness'='finite' then 'finite' else 'nonfinite' end,'predicate_surface',v_surface),
        'reason_code','validated_clause_predicate_materializes_predication',
        'provenance',public.interpretation_provenance_v2(p_release_code,'finite_predication')
      ));
    end if;

    if v_finite is not null then
      v_morph:=public.interpretation_morph_by_index_v2(p_analysis,v_finite);
      v_tense:=v_morph#>>'{selected_reading,features,Tense}';
      if v_tense in ('Pres','Past') then
        v_tense_value:=case v_tense when 'Pres' then 'present' when 'Past' then 'preterite' end;
        v_interp:=v_interp||jsonb_build_array(jsonb_build_object(
          'id','int2:tense:'||v_pid,'status','resolved','family','morphological_tense',
          'predicate_id',v_pid,'finite_token_index',v_finite,'surface',v_surface,
          'value',jsonb_build_object('morphological_tense',v_tense_value,'carrier','finite_predicate_token'),
          'evidence',jsonb_build_array(jsonb_build_object('source','morphology_v1','token_index',v_finite,'selected_reading_id',v_morph->>'selected_reading_id','features',v_morph#>'{selected_reading,features}')),
          'reason_code','selected_finite_morphology_supplies_tense_opposition',
          'provenance',public.interpretation_provenance_v2(p_release_code,'morphological_tense')
        ));
      end if;
    end if;

    if v_kind='auxiliary_compound' and v_finite is not null and v_lh is not null then
      v_morph:=public.interpretation_morph_by_index_v2(p_analysis,v_finite);
      v_lmorph:=public.interpretation_morph_by_index_v2(p_analysis,v_lh);
      v_finite_lemma:=v_morph->>'selected_lemma';
      v_lh_form:=v_lmorph#>>'{selected_reading,features,VerbForm}';
      v_tense:=v_morph#>>'{selected_reading,features,Tense}';
      v_dep:=public.interpretation_dependency_by_relation_v2(p_analysis,'auxiliary_governs',v_pid);
      if v_finite_lemma='ha' and v_lh_form='Part' and v_dep is not null and v_tense in ('Pres','Past') then
        v_interp:=v_interp||jsonb_build_array(jsonb_build_object(
          'id','int2:perfect:'||v_pid,'status','resolved','family','perfect_tense_form',
          'predicate_id',v_pid,'surface',v_surface,'finite_token_index',v_finite,'lexical_head_token_index',v_lh,
          'value',jsonb_build_object(
            'tense_form',case v_tense when 'Pres' then 'present_perfect' else 'preterite_perfect' end,
            'auxiliary_lemma','ha','nonfinite_form','past_participle','temporal_relation_profile','before_reference_point'
          ),
          'evidence',jsonb_build_array(
            jsonb_build_object('source','morphology_v1','token_index',v_finite,'lemma',v_finite_lemma,'features',v_morph#>'{selected_reading,features}'),
            jsonb_build_object('source','morphology_v1','token_index',v_lh,'lemma',v_lmorph->>'selected_lemma','features',v_lmorph#>'{selected_reading,features}'),
            jsonb_build_object('source','dependency_build_v2','dependency_id',v_dep->>'id','relation','auxiliary_governs')
          ),
          'reason_code','validated_ha_plus_past_participle_perfect_form',
          'provenance',public.interpretation_provenance_v2(p_release_code,'perfect_tense_form')
        ));
      end if;
    end if;

    if v_kind in ('modal_compound','modal_chain') then
      select coalesce(jsonb_agg(to_jsonb(i) order by i),'[]'::jsonb), count(*)::int
      into v_modal_members,v_modal_count
      from (select value::int i from jsonb_array_elements_text(coalesce(v_pred->'member_token_indices','[]'::jsonb))) s;
      select coalesce(jsonb_agg(public.dependency_build_token_surface_v2(p_analysis,i) order by i),'[]'::jsonb)
      into v_modal_surfaces
      from (select value::int i from jsonb_array_elements_text(coalesce(v_pred->'member_token_indices','[]'::jsonb))) s;
      v_interp:=v_interp||jsonb_build_array(jsonb_build_object(
        'id','int2:modal:'||v_pid,'status','resolved','family','modal_structure',
        'predicate_id',v_pid,'surface',v_surface,'predicate_kind',v_kind,
        'value',jsonb_build_object(
          'operator_order',v_modal_surfaces,
          'member_token_indices',v_modal_members,
          'operator_count',greatest(v_modal_count-1,1),
          'semantic_modal_reading','deferred','semantic_scope','deferred','future_reading','deferred'
        ),
        'reason_code','validated_modal_order_without_semantic_overcommitment',
        'provenance',public.interpretation_provenance_v2(p_release_code,'modal_structure')
      ));
    end if;

    if v_kind='copular' and v_clause is not null and v_pc is not null then
      v_tok:=public.interpretation_token_by_index_v2(p_analysis,v_pc);
      v_subject:=nullif(v_clause->>'subject_token_index','')::int;
      v_interp:=v_interp||jsonb_build_array(jsonb_build_object(
        'id','int2:copular:'||v_pid,'status','resolved','family','copular_predication',
        'predicate_id',v_pid,'clause_id',v_clause->>'id','surface',v_clause->>'surface',
        'value',jsonb_build_object(
          'subject_token_index',v_subject,'subject_surface',v_clause->>'subject_surface',
          'copula_token_index',v_finite,'predicative_complement_token_index',v_pc,
          'predicative_surface',v_tok->>'surface','semantic_subtype','deferred'
        ),
        'reason_code','validated_copula_links_subject_predicative',
        'provenance',public.interpretation_provenance_v2(p_release_code,'copular_predication')
      ));
    end if;

    if v_kind='nonfinite_infinitive' and v_clause is not null then
      v_interp:=v_interp||jsonb_build_array(jsonb_build_object(
        'id','int2:infinitive:'||v_pid,'status','resolved','family','nonfinite_infinitive_profile',
        'predicate_id',v_pid,'clause_id',v_clause->>'id','surface',v_clause->>'surface',
        'value',jsonb_build_object(
          'overt_subject','absent','interpreted_subject_profile','normally_present_but_unresolved',
          'independent_tense','absent','independent_modal_marking','absent',
          'controller','deferred','attachment','deferred'
        ),
        'reason_code','validated_nonfinite_infinitive_without_controller_resolution',
        'provenance',public.interpretation_provenance_v2(p_release_code,'nonfinite_infinitive_profile')
      ));
    end if;
  end loop;

  for v_ch in select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,clause_hypotheses}','[]'::jsonb)) x loop
    v_hyp:=v_hyp||jsonb_build_array(jsonb_build_object(
      'id','inth2:'||(v_ch->>'id'),'status','hypothesis','family','upstream_unresolved_clause',
      'source_clause_id',v_ch->>'id','surface',v_ch->>'surface','reason_code',v_ch->>'reason_code',
      'predicate_kind',v_ch->>'predicate_kind','blocked_events',coalesce(v_ch->'blocked_events','[]'::jsonb),
      'requires_resolution',true
    ));
  end loop;

  for v_cb in select x from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clause_build_v1,blocked_clauses}','[]'::jsonb)) x loop
    v_block:=v_block||jsonb_build_array(jsonb_build_object(
      'id','intblocked2:'||(v_cb->>'id'),'status','blocked','family','upstream_blocked_clause',
      'source_clause_id',v_cb->>'id','surface',v_cb->>'surface','reason_code',v_cb->>'reason_code',
      'blocked_events',coalesce(v_cb->'blocked_events','[]'::jsonb),'requires_resolution',true
    ));
  end loop;

  return jsonb_build_object(
    'version','interpretation-v2','status','ready','interpretations',v_interp,
    'interpretation_hypotheses',v_hyp,'blocked_interpretations',v_block,
    'summary',jsonb_build_object(
      'resolved_count',jsonb_array_length(v_interp),'hypothesis_count',jsonb_array_length(v_hyp),
      'blocked_count',jsonb_array_length(v_block),'validation_gate',v_validation,
      'family_counts',(select coalesce(jsonb_object_agg(f,c),'{}'::jsonb) from (select x->>'family' f,count(*) c from jsonb_array_elements(v_interp) x group by 1) q)
    )
  );
end;
$function$;

create or replace function public.apply_interpretation_v2(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.14')
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select jsonb_set(p_analysis,'{language_graph,interpretation_v2}',public.resolve_interpretation_v2(p_analysis,p_release_code),true);
$function$;

create or replace function public.analyze_text_structural_shadow_v14(p_text text,p_release_code text default 'runtime-structural-v1.14')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_doc jsonb; v_sentences jsonb:='[]'::jsonb; v_s jsonb; v_a jsonb;
begin
  v_doc:=public.analyze_text_structural_shadow_v13(p_text,p_release_code);
  for v_s in select x from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences}','[]'::jsonb)) x loop
    v_a:=public.apply_interpretation_v2(coalesce(v_s->'analysis','{}'::jsonb),p_release_code);
    v_sentences:=v_sentences||jsonb_build_array(jsonb_set(v_s,'{analysis}',v_a,true));
  end loop;
  return jsonb_set(v_doc,'{document_graph,sentences}',v_sentences,true);
end;
$function$;
