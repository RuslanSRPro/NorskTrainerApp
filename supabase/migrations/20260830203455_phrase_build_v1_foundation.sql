create or replace function public.phrase_build_contract_v1()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'version','phrase-build-v1',
  'input_layers',jsonb_build_array('language_graph.tokens','language_graph.local_pos_v1','language_graph.morphology_v1','enabled phrase_pattern rules'),
  'phrase_families',jsonb_build_array('AP','NP','VP'),
  'supported_build_strategies',jsonb_build_array('head_only','head_plus_left_dependents','finite_head_plus_following_nonfinite'),
  'authoritative_output','language_graph.phrase_build_v1.resolved_phrases',
  'hypothesis_output','language_graph.phrase_build_v1.phrase_hypotheses',
  'core_policy',jsonb_build_array(
    'authoritative phrase heads require resolved Local POS',
    'finite VP heads additionally require selected finite morphology',
    'ambiguous POS never becomes an authoritative phrase head',
    'compatible ambiguous POS may create explicit phrase hypotheses',
    'NP left dependents are contiguous and already resolved',
    'VP nonfinite extension is authoritative only when POS and morphology are both resolved',
    'unresolved nonfinite extension remains a hypothesis'
  ),
  'compatibility_output','language_graph.phrases retained unchanged',
  'non_goals',jsonb_build_array('structural POS refinement','clause rebuilding','dependency rebuilding','semantic role assignment','probabilistic phrase ranking'),
  'next_layer','structural-pos-refinement-v1'
);
$function$;

create or replace function public.phrase_build_item_by_index_v1(p_items jsonb,p_idx integer)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select x
from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) x
where nullif(x->>'token_index','')::integer=p_idx
limit 1;
$function$;

create or replace function public.phrase_build_selected_nonfinite_v1(p_morph jsonb)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $function$
select coalesce(p_morph#>>'{selected_reading,source_pos}','')='verb'
   and coalesce(p_morph#>>'{selected_reading,features,VerbForm}','') in ('Inf','Part');
$function$;

create or replace function public.phrase_build_has_nonfinite_verb_hypothesis_v1(p_morph jsonb)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $function$
select exists(
  select 1
  from jsonb_array_elements(coalesce(p_morph->'surviving_readings','[]'::jsonb)) r
  where r->>'source_pos'='verb'
    and r#>>'{features,VerbForm}' in ('Inf','Part')
);
$function$;

create or replace function public.build_phrase_layer_v1(p_analysis jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_release_id uuid;
  v_tokens jsonb:=coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
  v_local jsonb:=coalesce(p_analysis#>'{language_graph,local_pos_v1}','[]'::jsonb);
  v_morph jsonb:=coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb);
  v_resolved jsonb:='[]'::jsonb;
  v_hyp jsonb:='[]'::jsonb;
  v_trace jsonb:='[]'::jsonb;
  v_rule record;
  v_t jsonb; v_lp jsonb; v_m jsonb; v_prev_t jsonb; v_prev_lp jsonb; v_prev2_t jsonb; v_prev2_lp jsonb;
  v_next_t jsonb; v_next_lp jsonb; v_next_m jsonb;
  v_idx integer; v_start integer; v_end integer; v_candidate_idx integer; v_transparent_idx integer;
  v_members jsonb; v_support text; v_selected_pos text; v_surface text;
  v_rule_count integer:=0;
begin
  select id into v_release_id from public.grammar_runtime_releases where code=p_release_code;
  if v_release_id is null then raise exception 'Runtime release % not found',p_release_code; end if;

  for v_rule in
    select r.id,r.code,r.pattern,r.result
    from public.grammar_runtime_release_rules rr
    join public.grammar_rules r on r.id=rr.rule_id
    where rr.release_id=v_release_id and rr.is_enabled and r.pattern_type='phrase_pattern'
      and r.pattern->>'build_strategy' in ('head_only','head_plus_left_dependents','finite_head_plus_following_nonfinite')
    order by r.code
  loop
    v_rule_count:=v_rule_count+1;

    if v_rule.pattern->>'build_strategy'='head_only' and v_rule.pattern->>'phrase_type'='AP' then
      for v_t in select t from jsonb_array_elements(v_tokens) t order by (t->>'token_index')::integer loop
        v_idx:=(v_t->>'token_index')::integer;
        v_lp:=public.phrase_build_item_by_index_v1(v_local,v_idx);
        v_selected_pos:=v_lp->>'selected_grammar_pos';
        v_surface:=v_t->>'surface';
        if v_selected_pos='adjective' then
          v_resolved:=v_resolved||jsonb_build_array(jsonb_build_object(
            'id','pb1:AP:'||v_idx,'status','resolved','type','AP','head_token_index',v_idx,'head_surface',v_surface,
            'span_start',v_idx,'span_end',v_idx,'member_token_indices',jsonb_build_array(v_idx),
            'rule_id',v_rule.id,'rule_code',v_rule.code,'build_strategy','head_only',
            'evidence',jsonb_build_array(jsonb_build_object('type','local_pos','status',v_lp->>'status','reason_code',v_lp->>'reason_code','selected_grammar_pos','adjective'))
          ));
        elsif coalesce(v_lp->>'status','')='ambiguous' and coalesce(v_lp->'competing_pos','[]'::jsonb) ? 'adjective' then
          v_hyp:=v_hyp||jsonb_build_array(jsonb_build_object(
            'id','pbh1:AP:'||v_idx,'status','hypothesis','type','AP','head_token_index',v_idx,'head_surface',v_surface,
            'span_start',v_idx,'span_end',v_idx,'member_token_indices',jsonb_build_array(v_idx),
            'required_pos','adjective','support_strength','pattern_only','rule_id',v_rule.id,'rule_code',v_rule.code,
            'reason_code','ambiguous_head_pos_candidate'
          ));
        end if;
      end loop;

    elsif v_rule.pattern->>'build_strategy'='head_plus_left_dependents' and v_rule.pattern->>'phrase_type'='NP' then
      for v_t in select t from jsonb_array_elements(v_tokens) t order by (t->>'token_index')::integer loop
        v_idx:=(v_t->>'token_index')::integer;
        v_lp:=public.phrase_build_item_by_index_v1(v_local,v_idx);
        v_selected_pos:=v_lp->>'selected_grammar_pos';
        if v_selected_pos='noun' or (coalesce(v_lp->>'status','')='ambiguous' and coalesce(v_lp->'competing_pos','[]'::jsonb) ? 'noun') then
          v_start:=v_idx; v_members:=jsonb_build_array(v_idx); v_support:='pattern_only';
          v_prev_t:=public.phrase_build_item_by_index_v1(v_tokens,v_idx-1);
          v_prev_lp:=public.phrase_build_item_by_index_v1(v_local,v_idx-1);
          v_prev2_t:=public.phrase_build_item_by_index_v1(v_tokens,v_idx-2);
          v_prev2_lp:=public.phrase_build_item_by_index_v1(v_local,v_idx-2);

          if v_prev_t is not null and v_prev_lp->>'selected_grammar_pos'='adjective' then
            v_start:=v_idx-1; v_members:=jsonb_build_array(v_idx-1,v_idx); v_support:='resolved_left_adjective';
            if v_prev2_t is not null and v_prev2_lp->>'selected_grammar_pos'='determiner'
               and public.structural_token_has_class_v1(v_prev2_t,'indefinite_article') then
              v_start:=v_idx-2; v_members:=jsonb_build_array(v_idx-2,v_idx-1,v_idx); v_support:='resolved_article_adjective_context';
            end if;
          elsif v_prev_t is not null and v_prev_lp->>'selected_grammar_pos'='determiner'
                and public.structural_token_has_class_v1(v_prev_t,'indefinite_article') then
            v_start:=v_idx-1; v_members:=jsonb_build_array(v_idx-1,v_idx); v_support:='resolved_article_context';
          end if;

          if v_selected_pos='noun' then
            v_resolved:=v_resolved||jsonb_build_array(jsonb_build_object(
              'id','pb1:NP:'||v_idx,'status','resolved','type','NP','head_token_index',v_idx,'head_surface',v_t->>'surface',
              'span_start',v_start,'span_end',v_idx,'member_token_indices',v_members,
              'rule_id',v_rule.id,'rule_code',v_rule.code,'build_strategy','head_plus_left_dependents',
              'evidence',jsonb_build_array(jsonb_build_object('type','local_pos','status',v_lp->>'status','reason_code',v_lp->>'reason_code','selected_grammar_pos','noun'),jsonb_build_object('type','left_context','support',v_support))
            ));
          else
            v_hyp:=v_hyp||jsonb_build_array(jsonb_build_object(
              'id','pbh1:NP:'||v_idx,'status','hypothesis','type','NP','head_token_index',v_idx,'head_surface',v_t->>'surface',
              'span_start',v_start,'span_end',v_idx,'member_token_indices',v_members,
              'required_pos','noun','support_strength',case when v_support='pattern_only' then 'pattern_only' else 'structural_context' end,
              'left_context',v_support,'rule_id',v_rule.id,'rule_code',v_rule.code,'reason_code','ambiguous_head_pos_candidate'
            ));
          end if;
        end if;
      end loop;

    elsif v_rule.pattern->>'build_strategy'='finite_head_plus_following_nonfinite' and v_rule.pattern->>'phrase_type'='VP' then
      for v_t in select t from jsonb_array_elements(v_tokens) t order by (t->>'token_index')::integer loop
        v_idx:=(v_t->>'token_index')::integer;
        v_lp:=public.phrase_build_item_by_index_v1(v_local,v_idx);
        v_m:=public.phrase_build_item_by_index_v1(v_morph,v_idx);
        if v_lp->>'selected_grammar_pos'='verb'
           and v_m#>>'{selected_reading,source_pos}'='verb'
           and v_m#>>'{selected_reading,features,VerbForm}'='Fin' then
          v_end:=v_idx; v_members:=jsonb_build_array(v_idx); v_transparent_idx:=null; v_candidate_idx:=v_idx+1;
          v_next_t:=public.phrase_build_item_by_index_v1(v_tokens,v_candidate_idx);
          if v_next_t is not null and public.structural_token_has_class_v1(v_next_t,'sentence_adverbial') then
            v_transparent_idx:=v_candidate_idx; v_candidate_idx:=v_idx+2;
          end if;
          v_next_t:=public.phrase_build_item_by_index_v1(v_tokens,v_candidate_idx);
          v_next_lp:=public.phrase_build_item_by_index_v1(v_local,v_candidate_idx);
          v_next_m:=public.phrase_build_item_by_index_v1(v_morph,v_candidate_idx);

          if v_next_t is not null and v_next_lp->>'selected_grammar_pos'='verb' and public.phrase_build_selected_nonfinite_v1(v_next_m) then
            v_end:=v_candidate_idx; v_members:=jsonb_build_array(v_idx,v_candidate_idx);
          elsif v_next_t is not null and public.phrase_build_has_nonfinite_verb_hypothesis_v1(v_next_m)
                and (v_next_lp->>'selected_grammar_pos'='verb' or coalesce(v_next_lp->'competing_pos','[]'::jsonb) ? 'verb') then
            v_hyp:=v_hyp||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
              'id','pbh1:VP-extension:'||v_idx||':'||v_candidate_idx,'status','hypothesis','type','VP',
              'base_head_token_index',v_idx,'base_head_surface',v_t->>'surface','proposed_member_token_index',v_candidate_idx,
              'proposed_member_surface',v_next_t->>'surface','span_start',v_idx,'span_end',v_candidate_idx,
              'member_token_indices',jsonb_build_array(v_idx,v_candidate_idx),'transparent_token_index',v_transparent_idx,
              'required_pos','verb','required_morphology','VerbForm=Inf|Part','support_strength','morphology_candidate',
              'rule_id',v_rule.id,'rule_code',v_rule.code,'reason_code','possible_nonfinite_vp_extension'
            )));
          end if;

          v_resolved:=v_resolved||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
            'id','pb1:VP:'||v_idx,'status','resolved','type','VP','head_token_index',v_idx,'head_surface',v_t->>'surface',
            'span_start',v_idx,'span_end',v_end,'member_token_indices',v_members,'transparent_token_index',v_transparent_idx,
            'rule_id',v_rule.id,'rule_code',v_rule.code,'build_strategy','finite_head_plus_following_nonfinite',
            'evidence',jsonb_build_array(jsonb_build_object('type','local_pos','selected_grammar_pos','verb'),jsonb_build_object('type','morphology','VerbForm','Fin'))
          )));
        end if;
      end loop;
    end if;
  end loop;

  v_trace:=jsonb_build_array(jsonb_build_object('event','phrase_build_complete','enabled_phrase_rules',v_rule_count,'resolved_count',jsonb_array_length(v_resolved),'hypothesis_count',jsonb_array_length(v_hyp)));
  return jsonb_build_object(
    'version','phrase-build-v1','status',case when v_rule_count=0 then 'no_enabled_phrase_rules' else 'ready' end,
    'resolved_phrases',v_resolved,'phrase_hypotheses',v_hyp,'trace',v_trace,
    'summary',jsonb_build_object('enabled_phrase_rules',v_rule_count,'resolved_count',jsonb_array_length(v_resolved),'hypothesis_count',jsonb_array_length(v_hyp))
  );
end;
$function$;

create or replace function public.apply_phrase_build_v1(p_analysis jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_layer jsonb;
  v_graph jsonb:=coalesce(p_analysis->'language_graph','{}'::jsonb);
begin
  v_layer:=public.build_phrase_layer_v1(p_analysis,p_release_code);
  v_graph:=jsonb_set(v_graph,'{phrase_build_v1}',v_layer,true);
  return jsonb_set(p_analysis,'{language_graph}',v_graph,true);
end;
$function$;

create or replace function public.analyze_text_structural_shadow_v6(
  p_text text,
  p_release_code text default 'runtime-structural-v1.6'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_doc jsonb; v_sentences jsonb:='[]'::jsonb; v_s jsonb; v_analysis jsonb;
begin
  v_doc:=public.analyze_text_structural_shadow_v5(p_text,p_release_code);
  for v_s in select s from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences}','[]'::jsonb)) s loop
    v_analysis:=public.apply_phrase_build_v1(v_s->'analysis',p_release_code);
    v_sentences:=v_sentences||jsonb_build_array(jsonb_set(v_s,'{analysis}',v_analysis,true));
  end loop;
  v_doc:=jsonb_set(v_doc,'{document_graph,sentences}',v_sentences,true);
  return v_doc||jsonb_build_object(
    'engine_version','grammar-structural-shadow-v6',
    'phrase_build',jsonb_build_object('contract','phrase-build-v1','authoritative_output','document_graph.sentences[].analysis.language_graph.phrase_build_v1.resolved_phrases','hypothesis_output','document_graph.sentences[].analysis.language_graph.phrase_build_v1.phrase_hypotheses')
  );
end;
$function$;;
