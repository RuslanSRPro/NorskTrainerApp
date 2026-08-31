create or replace function public.structural_pos_refinement_contract_v1()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'version','structural-pos-refinement-v1',
  'input_layers',jsonb_build_array('language_graph.local_pos_v1','language_graph.morphology_v1','language_graph.phrase_build_v1.phrase_hypotheses','compiled lexical/source evidence in release metadata'),
  'authoritative_output','language_graph.structural_pos_v1.refined_local_pos',
  'trace_output','language_graph.structural_pos_v1.token_resolutions',
  'evidence_policy',jsonb_build_array(
    'hard structural evidence is translated only to generic require_pos/exclude_pos accepted by Local POS V1',
    'soft phrase support is observable but does not force a POS',
    'modal auxiliary plus bare-infinitive VP hypothesis can require verb POS',
    'NP article context is supporting evidence only in V1',
    'copular predicative ambiguity is explicitly deferred because predicatives may be nominal or adjectival'
  ),
  'statuses',jsonb_build_array('resolved_by_structure','unchanged_resolved','ambiguous_with_structural_support','ambiguous_no_structural_resolution','conflict','no_pos_candidate','unsupported'),
  'feedback_policy','refinement is additive; Local POS V1 and Phrase Build V1 outputs are not mutated',
  'non_goals',jsonb_build_array('lexeme/sense disambiguation','copular predicative resolution','phrase hypothesis promotion','construction resolution','probabilistic ranking'),
  'architecture_closed_criterion','new structural POS producers emit generic hard or soft evidence without changing Local POS resolver code'
);
$function$;

create or replace function public.structural_pos_append_evidence_v1(p_map jsonb,p_token_index integer,p_evidence jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare v_current jsonb:=coalesce(p_map->p_token_index::text,'[]'::jsonb);
begin
  if not (v_current @> jsonb_build_array(p_evidence)) then
    v_current:=v_current||jsonb_build_array(p_evidence);
  end if;
  return jsonb_set(coalesce(p_map,'{}'::jsonb),array[p_token_index::text],v_current,true);
end;
$function$;

create or replace function public.structural_pos_token_matches_compiled_class_v1(
  p_token jsonb,p_release_code text,p_class_code text
)
returns boolean
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
with rel as (
  select metadata from public.grammar_runtime_releases where code=p_release_code
), allowed as (
  select lower(value) lemma
  from rel, jsonb_array_elements_text(coalesce(metadata#>array['structural_pos_compiled_lexical_sets',p_class_code],'[]'::jsonb))
), token_lemmas as (
  select distinct lower(c->>'lemma') lemma
  from jsonb_array_elements(coalesce(p_token#>'{surface_resolution,candidates}','[]'::jsonb)) c
  where nullif(c->>'lemma','') is not null
)
select exists(select 1 from token_lemmas t join allowed a using(lemma));
$function$;

create or replace function public.structural_pos_morph_has_verb_infinitive_v1(p_morph jsonb)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $function$
select exists(
  select 1 from jsonb_array_elements(coalesce(p_morph->'surviving_readings','[]'::jsonb)) r
  where r->>'source_pos'='verb' and r#>>'{features,VerbForm}'='Inf'
);
$function$;

create or replace function public.collect_structural_pos_evidence_v1(p_analysis jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_tokens jsonb:=coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
  v_morph jsonb:=coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb);
  v_hyp jsonb:=coalesce(p_analysis#>'{language_graph,phrase_build_v1,phrase_hypotheses}','[]'::jsonb);
  v_hard jsonb:='{}'::jsonb; v_soft jsonb:='{}'::jsonb; v_events jsonb:='[]'::jsonb;
  h jsonb; base_t jsonb; target_t jsonb; target_m jsonb;
  base_idx integer; target_idx integer;
  v_modal_source jsonb; v_profile_source jsonb; v_np_source jsonb;
begin
  select jsonb_build_object('candidate_id',id,'candidate_code',extracted_payload->>'candidate_code','source_section',source_section,'verification_status',status)
  into v_modal_source
  from public.grammar_knowledge_candidates
  where extracted_payload->>'candidate_code'='verb.modal_auxiliary.bare_infinitive' and status in ('verified','source_verified')
  order by verified_at desc nulls last limit 1;

  select jsonb_build_object('candidate_id',id,'candidate_code',extracted_payload->>'candidate_code','source_section',source_section,'verification_status',status)
  into v_profile_source
  from public.grammar_knowledge_candidates
  where extracted_payload->>'candidate_code'='verb.modal_auxiliary.core_profile' and status in ('verified','source_verified')
  order by verified_at desc nulls last limit 1;

  select jsonb_build_object('rule_id',r.id,'rule_code',r.code,'constraint_strength',r.result->>'constraint_strength')
  into v_np_source
  from public.grammar_runtime_releases rel
  join public.grammar_runtime_release_rules rr on rr.release_id=rel.id and rr.is_enabled
  join public.grammar_rules r on r.id=rr.rule_id
  where rel.code=p_release_code and r.code='nrg_rt_v1.structural.noun_phrase.noun_head'
  limit 1;

  for h in select x from jsonb_array_elements(v_hyp) x loop
    if h->>'type'='NP' and h->>'required_pos'='noun' and h->>'support_strength'='structural_context' then
      target_idx:=nullif(h->>'head_token_index','')::integer;
      if target_idx is not null then
        v_soft:=public.structural_pos_append_evidence_v1(v_soft,target_idx,jsonb_strip_nulls(jsonb_build_object(
          'type','structural_phrase_support','strength','supporting','pos','noun','reason_code','np_structural_context_support',
          'phrase_hypothesis_id',h->>'id','left_context',h->>'left_context','source_rule',v_np_source
        )));
        v_events:=v_events||jsonb_build_array(jsonb_build_object('event','soft_pos_support','token_index',target_idx,'pos','noun','source_hypothesis_id',h->>'id','reason_code','np_structural_context_support'));
      end if;
    end if;

    if h->>'reason_code'='possible_nonfinite_vp_extension' then
      base_idx:=nullif(h->>'base_head_token_index','')::integer;
      target_idx:=nullif(h->>'proposed_member_token_index','')::integer;
      base_t:=public.phrase_build_item_by_index_v1(v_tokens,base_idx);
      target_t:=public.phrase_build_item_by_index_v1(v_tokens,target_idx);
      target_m:=public.phrase_build_item_by_index_v1(v_morph,target_idx);

      if base_t is not null and target_t is not null
         and public.structural_pos_token_matches_compiled_class_v1(base_t,p_release_code,'modal_verb')
         and public.structural_pos_morph_has_verb_infinitive_v1(target_m)
      then
        v_hard:=public.structural_pos_append_evidence_v1(v_hard,target_idx,jsonb_strip_nulls(jsonb_build_object(
          'type','require_pos','pos','verb','reason_code','modal_governed_bare_infinitive',
          'source','structural-pos-refinement-v1','governor_token_index',base_idx,'governor_surface',base_t->>'surface',
          'phrase_hypothesis_id',h->>'id','source_candidates',jsonb_build_array(v_modal_source,v_profile_source)
        )));
        v_events:=v_events||jsonb_build_array(jsonb_build_object('event','hard_pos_requirement','token_index',target_idx,'pos','verb','governor_token_index',base_idx,'source_hypothesis_id',h->>'id','reason_code','modal_governed_bare_infinitive'));
      elsif base_t is not null and public.structural_pos_token_matches_compiled_class_v1(base_t,p_release_code,'copula') then
        v_events:=v_events||jsonb_build_array(jsonb_build_object(
          'event','deferred_structural_ambiguity','token_index',target_idx,'governor_token_index',base_idx,
          'reason_code','copular_predicative_may_be_nominal_or_adjectival','source_hypothesis_id',h->>'id'
        ));
      end if;
    end if;
  end loop;

  return jsonb_build_object('hard_evidence_by_token',v_hard,'soft_evidence_by_token',v_soft,'events',v_events);
end;
$function$;

create or replace function public.resolve_structural_pos_refinement_v1(p_analysis jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_tokens jsonb:=coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
  v_local jsonb:=coalesce(p_analysis#>'{language_graph,local_pos_v1}','[]'::jsonb);
  v_morph jsonb:=coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb);
  v_evidence_layer jsonb; v_hard_map jsonb; v_soft_map jsonb;
  v_token jsonb; v_base jsonb; v_m jsonb; v_hard jsonb; v_soft jsonb; v_refined jsonb;
  v_idx integer; v_status text; v_out jsonb:='[]'::jsonb; v_refined_array jsonb:='[]'::jsonb;
  v_resolved_by_structure integer:=0; v_supported_ambiguous integer:=0; v_conflicts integer:=0;
begin
  v_evidence_layer:=public.collect_structural_pos_evidence_v1(p_analysis,p_release_code);
  v_hard_map:=coalesce(v_evidence_layer->'hard_evidence_by_token','{}'::jsonb);
  v_soft_map:=coalesce(v_evidence_layer->'soft_evidence_by_token','{}'::jsonb);

  for v_token in select t from jsonb_array_elements(v_tokens) t order by (t->>'token_index')::integer loop
    v_idx:=(v_token->>'token_index')::integer;
    v_base:=public.phrase_build_item_by_index_v1(v_local,v_idx);
    v_m:=public.phrase_build_item_by_index_v1(v_morph,v_idx);
    v_hard:=coalesce(v_hard_map->v_idx::text,'[]'::jsonb);
    v_soft:=coalesce(v_soft_map->v_idx::text,'[]'::jsonb);
    v_refined:=public.resolve_local_pos_token_v1(v_token,coalesce(v_m,'{}'::jsonb),v_hard);

    if v_refined->>'status'='conflict' then
      v_status:='conflict'; v_conflicts:=v_conflicts+1;
    elsif v_base->>'selected_grammar_pos' is null and v_refined->>'selected_grammar_pos' is not null then
      v_status:='resolved_by_structure'; v_resolved_by_structure:=v_resolved_by_structure+1;
    elsif v_refined->>'selected_grammar_pos' is not null then
      v_status:='unchanged_resolved';
    elsif jsonb_array_length(v_soft)>0 then
      v_status:='ambiguous_with_structural_support'; v_supported_ambiguous:=v_supported_ambiguous+1;
    elsif v_refined->>'status'='ambiguous' then
      v_status:='ambiguous_no_structural_resolution';
    elsif v_refined->>'status'='no_pos_candidate' then
      v_status:='no_pos_candidate';
    else
      v_status:=coalesce(v_refined->>'status','unsupported');
    end if;

    v_refined_array:=v_refined_array||jsonb_build_array(v_refined);
    v_out:=v_out||jsonb_build_array(jsonb_build_object(
      'token_index',v_idx,'surface',v_token->>'surface','refinement_status',v_status,
      'base_local_pos',coalesce(v_base,'{}'::jsonb),'structural_hard_evidence',v_hard,
      'structural_soft_evidence',v_soft,'refined_local_pos',v_refined
    ));
  end loop;

  return jsonb_build_object(
    'version','structural-pos-refinement-v1','status','ready','refined_local_pos',v_refined_array,
    'token_resolutions',v_out,'evidence_events',coalesce(v_evidence_layer->'events','[]'::jsonb),
    'summary',jsonb_build_object('token_count',jsonb_array_length(v_tokens),'resolved_by_structure',v_resolved_by_structure,'ambiguous_with_structural_support',v_supported_ambiguous,'conflicts',v_conflicts)
  );
end;
$function$;

create or replace function public.apply_structural_pos_refinement_v1(p_analysis jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_layer jsonb; v_graph jsonb:=coalesce(p_analysis->'language_graph','{}'::jsonb);
begin
  v_layer:=public.resolve_structural_pos_refinement_v1(p_analysis,p_release_code);
  v_graph:=jsonb_set(v_graph,'{structural_pos_v1}',v_layer,true);
  return jsonb_set(p_analysis,'{language_graph}',v_graph,true);
end;
$function$;

create or replace function public.analyze_text_structural_shadow_v7(
  p_text text,p_release_code text default 'runtime-structural-v1.7'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_doc jsonb; v_sentences jsonb:='[]'::jsonb; v_s jsonb; v_analysis jsonb;
begin
  v_doc:=public.analyze_text_structural_shadow_v6(p_text,p_release_code);
  for v_s in select s from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences}','[]'::jsonb)) s loop
    v_analysis:=public.apply_structural_pos_refinement_v1(v_s->'analysis',p_release_code);
    v_sentences:=v_sentences||jsonb_build_array(jsonb_set(v_s,'{analysis}',v_analysis,true));
  end loop;
  v_doc:=jsonb_set(v_doc,'{document_graph,sentences}',v_sentences,true);
  return v_doc||jsonb_build_object(
    'engine_version','grammar-structural-shadow-v7',
    'structural_pos_refinement',jsonb_build_object('contract','structural-pos-refinement-v1','authoritative_output','document_graph.sentences[].analysis.language_graph.structural_pos_v1.refined_local_pos')
  );
end;
$function$;;
