create or replace function public.resolve_local_pos_token_v1(
  p_token jsonb,
  p_morph_resolution jsonb default '{}'::jsonb,
  p_external_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare
  v_candidate jsonb;
  v_class jsonb;
  v_reading jsonb;
  v_ev jsonb;
  v_pos text;
  v_source_pos_set jsonb := '[]'::jsonb;
  v_hard_pos_set jsonb := '[]'::jsonb;
  v_excluded_pos_set jsonb := '[]'::jsonb;
  v_evidence jsonb := '[]'::jsonb;
  v_support_ids jsonb := '[]'::jsonb;
  v_selected_ids jsonb := '[]'::jsonb;
  v_competing_pos jsonb := '[]'::jsonb;
  v_candidate_count integer := 0;
  v_source_pos_count integer := 0;
  v_hard_pos_count integer := 0;
  v_morph_pos_count integer := 0;
  v_selected_pos text;
  v_status text;
  v_reason text;
  v_lexeme_status text;
  v_selected_source_count integer := 0;
  v_unsupported integer := 0;
begin
  if p_token is null or jsonb_typeof(p_token)<>'object' then
    return jsonb_build_object(
      'resolver_version','local-pos-disambiguation-v1',
      'status','unsupported',
      'reason_code','token_must_be_object',
      'selected_grammar_pos',null,
      'evidence','[]'::jsonb
    );
  end if;
  if p_external_evidence is null or jsonb_typeof(p_external_evidence)<>'array' then
    return jsonb_build_object(
      'resolver_version','local-pos-disambiguation-v1',
      'status','unsupported',
      'reason_code','external_evidence_must_be_array',
      'selected_grammar_pos',null,
      'evidence','[]'::jsonb
    );
  end if;

  v_candidate_count := jsonb_array_length(coalesce(p_token#>'{surface_resolution,candidates}','[]'::jsonb));

  -- Source POS hypotheses are evidence, not authority.
  for v_candidate in
    select c from jsonb_array_elements(coalesce(p_token#>'{surface_resolution,candidates}','[]'::jsonb)) c
  loop
    v_pos := nullif(lower(btrim(coalesce(v_candidate->>'source_pos',''))),'');
    if v_pos is not null and v_pos<>'unknown' then
      if not (v_source_pos_set @> jsonb_build_array(v_pos)) then
        v_source_pos_set := v_source_pos_set || jsonb_build_array(v_pos);
      end if;
      v_evidence := v_evidence || jsonb_build_array(jsonb_build_object(
        'type','source_candidate_pos',
        'strength','supporting',
        'pos',v_pos,
        'candidate_id',v_candidate->>'candidate_id',
        'lexeme_id',v_candidate->>'lexeme_id',
        'lemma',v_candidate->>'lemma',
        'base_priority',v_candidate->'base_priority',
        'base_confidence',v_candidate->>'base_confidence'
      ));
    end if;
  end loop;

  -- Grammar lexical classes are hard grammatical-POS evidence.
  for v_class in
    select c from jsonb_array_elements(coalesce(p_token->'lexical_classes','[]'::jsonb)) c
  loop
    v_pos := nullif(lower(btrim(coalesce(v_class->>'grammar_pos',''))),'');
    if v_pos is not null and v_pos<>'unknown' then
      if not (v_hard_pos_set @> jsonb_build_array(v_pos)) then
        v_hard_pos_set := v_hard_pos_set || jsonb_build_array(v_pos);
      end if;
      v_evidence := v_evidence || jsonb_build_array(jsonb_build_object(
        'type','lexical_class_pos',
        'strength','hard',
        'pos',v_pos,
        'class_code',v_class->>'class_code',
        'class_id',v_class->>'class_id',
        'member_id',v_class->>'member_id',
        'matched_by',v_class->>'matched_by',
        'membership_source',v_class->>'membership_source',
        'confidence',v_class->'confidence',
        'supporting_source_candidate_ids',coalesce(v_class->'derived_surface_candidate_ids','[]'::jsonb)
      ));
      for v_ev in select x from jsonb_array_elements(coalesce(v_class->'derived_surface_candidate_ids','[]'::jsonb)) x loop
        if not (v_support_ids @> jsonb_build_array(v_ev)) then
          v_support_ids := v_support_ids || jsonb_build_array(v_ev);
        end if;
      end loop;
    end if;
  end loop;

  -- A morphology-selected POS is hard evidence. If morphology is feature-ambiguous
  -- but every surviving reading has the same POS, POS itself is still resolved.
  v_pos := nullif(lower(btrim(coalesce(p_morph_resolution->>'selected_source_pos',''))),'');
  if v_pos is not null and v_pos<>'unknown' then
    if not (v_hard_pos_set @> jsonb_build_array(v_pos)) then
      v_hard_pos_set := v_hard_pos_set || jsonb_build_array(v_pos);
    end if;
    v_evidence := v_evidence || jsonb_build_array(jsonb_build_object(
      'type','morphology_selected_pos',
      'strength','hard',
      'pos',v_pos,
      'morphology_status',p_morph_resolution->>'status',
      'selected_reading_id',p_morph_resolution->>'selected_reading_id',
      'selected_candidate_id',p_morph_resolution->>'selected_candidate_id'
    ));
    if nullif(p_morph_resolution->>'selected_candidate_id','') is not null then
      v_ev := to_jsonb(p_morph_resolution->>'selected_candidate_id');
      if not (v_support_ids @> jsonb_build_array(v_ev)) then
        v_support_ids := v_support_ids || jsonb_build_array(v_ev);
      end if;
    end if;
  else
    select count(distinct lower(r->>'source_pos'))::int
    into v_morph_pos_count
    from jsonb_array_elements(coalesce(p_morph_resolution->'surviving_readings','[]'::jsonb)) r
    where nullif(lower(btrim(coalesce(r->>'source_pos',''))),'') is not null
      and lower(r->>'source_pos')<>'unknown';

    if v_morph_pos_count=1 then
      select lower(r->>'source_pos')
      into v_pos
      from jsonb_array_elements(coalesce(p_morph_resolution->'surviving_readings','[]'::jsonb)) r
      where nullif(lower(btrim(coalesce(r->>'source_pos',''))),'') is not null
        and lower(r->>'source_pos')<>'unknown'
      limit 1;
      if not (v_hard_pos_set @> jsonb_build_array(v_pos)) then
        v_hard_pos_set := v_hard_pos_set || jsonb_build_array(v_pos);
      end if;
      v_evidence := v_evidence || jsonb_build_array(jsonb_build_object(
        'type','morphology_pos_consensus',
        'strength','hard',
        'pos',v_pos,
        'morphology_status',p_morph_resolution->>'status',
        'surviving_count',coalesce((p_morph_resolution->>'surviving_count')::integer,0)
      ));
      for v_reading in
        select r from jsonb_array_elements(coalesce(p_morph_resolution->'surviving_readings','[]'::jsonb)) r
        where lower(r->>'source_pos')=v_pos
      loop
        if nullif(v_reading->>'candidate_id','') is not null then
          v_ev := to_jsonb(v_reading->>'candidate_id');
          if not (v_support_ids @> jsonb_build_array(v_ev)) then
            v_support_ids := v_support_ids || jsonb_build_array(v_ev);
          end if;
        end if;
      end loop;
    end if;
  end if;

  -- Generic external evidence contract for future rule/context producers.
  for v_ev in select e from jsonb_array_elements(p_external_evidence) e loop
    if coalesce(v_ev->>'type','') not in ('require_pos','exclude_pos') then
      v_unsupported := v_unsupported + 1;
      continue;
    end if;
    v_pos := nullif(lower(btrim(coalesce(v_ev->>'pos',''))),'');
    if v_pos is null then
      v_unsupported := v_unsupported + 1;
      continue;
    end if;
    if v_ev->>'type'='require_pos' then
      if not (v_hard_pos_set @> jsonb_build_array(v_pos)) then
        v_hard_pos_set := v_hard_pos_set || jsonb_build_array(v_pos);
      end if;
      v_evidence := v_evidence || jsonb_build_array(v_ev || jsonb_build_object('strength','hard'));
    else
      if not (v_excluded_pos_set @> jsonb_build_array(v_pos)) then
        v_excluded_pos_set := v_excluded_pos_set || jsonb_build_array(v_pos);
      end if;
      v_evidence := v_evidence || jsonb_build_array(v_ev || jsonb_build_object('strength','hard_negative'));
    end if;
  end loop;

  if v_unsupported>0 then
    return jsonb_build_object(
      'resolver_version','local-pos-disambiguation-v1',
      'status','unsupported',
      'reason_code','unsupported_external_evidence',
      'selected_grammar_pos',null,
      'candidate_count',v_candidate_count,
      'source_pos_set',v_source_pos_set,
      'hard_pos_set',v_hard_pos_set,
      'excluded_pos_set',v_excluded_pos_set,
      'evidence',v_evidence
    );
  end if;

  v_source_pos_count := jsonb_array_length(v_source_pos_set);
  v_hard_pos_count := jsonb_array_length(v_hard_pos_set);

  if v_hard_pos_count>1 then
    v_status := 'conflict';
    v_reason := 'hard_pos_evidence_conflict';
  elsif v_hard_pos_count=1 then
    v_selected_pos := v_hard_pos_set->>0;
    if v_excluded_pos_set @> jsonb_build_array(v_selected_pos) then
      v_status := 'conflict';
      v_reason := 'required_pos_is_excluded';
      v_selected_pos := null;
    else
      v_status := 'resolved_by_evidence';
      if exists(select 1 from jsonb_array_elements(v_evidence) e where e->>'type'='lexical_class_pos' and e->>'pos'=v_selected_pos)
         and exists(select 1 from jsonb_array_elements(v_evidence) e where e->>'type' in ('morphology_selected_pos','morphology_pos_consensus') and e->>'pos'=v_selected_pos)
      then v_reason := 'hard_evidence_consensus';
      elsif exists(select 1 from jsonb_array_elements(v_evidence) e where e->>'type'='lexical_class_pos' and e->>'pos'=v_selected_pos)
      then v_reason := 'lexical_class_pos';
      elsif exists(select 1 from jsonb_array_elements(v_evidence) e where e->>'type' in ('morphology_selected_pos','morphology_pos_consensus') and e->>'pos'=v_selected_pos)
      then v_reason := 'morphology_pos';
      else v_reason := 'external_pos_constraint';
      end if;
    end if;
  else
    -- No hard evidence: source candidates can establish POS only if they agree.
    select coalesce(jsonb_agg(x order by x),'[]'::jsonb)
    into v_competing_pos
    from (
      select distinct value as x
      from jsonb_array_elements(v_source_pos_set)
      where not (v_excluded_pos_set @> jsonb_build_array(value))
    ) s;

    if jsonb_array_length(v_competing_pos)=1 then
      v_selected_pos := v_competing_pos->>0;
      v_status := 'resolved_single';
      v_reason := 'source_pos_consensus';
    elsif jsonb_array_length(v_competing_pos)>1 then
      v_status := 'ambiguous';
      v_reason := 'multiple_pos_candidates';
    else
      v_status := 'no_pos_candidate';
      v_reason := case when v_source_pos_count>0 then 'all_source_pos_excluded' else 'no_usable_pos_evidence' end;
    end if;
  end if;

  if v_selected_pos is not null then
    for v_candidate in
      select c from jsonb_array_elements(coalesce(p_token#>'{surface_resolution,candidates}','[]'::jsonb)) c
      where lower(coalesce(c->>'source_pos',''))=v_selected_pos
    loop
      if nullif(v_candidate->>'candidate_id','') is not null then
        v_ev := to_jsonb(v_candidate->>'candidate_id');
        if not (v_selected_ids @> jsonb_build_array(v_ev)) then
          v_selected_ids := v_selected_ids || jsonb_build_array(v_ev);
        end if;
      end if;
    end loop;
    v_selected_source_count := jsonb_array_length(v_selected_ids);

    -- Supporting IDs from grammar/morph evidence are retained even when grammar POS
    -- intentionally differs from source dictionary POS (e.g. inn: adverb -> preposition).
    for v_ev in select x from jsonb_array_elements(v_selected_ids) x loop
      if not (v_support_ids @> jsonb_build_array(v_ev)) then
        v_support_ids := v_support_ids || jsonb_build_array(v_ev);
      end if;
    end loop;

    if v_selected_source_count=1 then
      v_lexeme_status := 'unique_matching_source_candidate';
    elsif v_selected_source_count>1 then
      v_lexeme_status := 'multiple_same_pos_source_candidates';
    elsif jsonb_array_length(v_support_ids)>0 then
      v_lexeme_status := 'grammar_pos_supported_by_different_source_pos';
    else
      v_lexeme_status := 'grammar_pos_without_source_candidate';
    end if;
  end if;

  if v_competing_pos='[]'::jsonb then
    select coalesce(jsonb_agg(value order by value),'[]'::jsonb)
    into v_competing_pos
    from jsonb_array_elements(v_source_pos_set)
    where v_selected_pos is null or value#>>'{}' is distinct from v_selected_pos;
  end if;

  return jsonb_build_object(
    'resolver_version','local-pos-disambiguation-v1',
    'status',v_status,
    'reason_code',v_reason,
    'token_index',nullif(p_token->>'token_index','')::integer,
    'surface',p_token->>'surface',
    'candidate_count',v_candidate_count,
    'source_pos_set',v_source_pos_set,
    'hard_pos_set',v_hard_pos_set,
    'excluded_pos_set',v_excluded_pos_set,
    'selected_grammar_pos',v_selected_pos,
    'selected_source_candidate_ids',v_selected_ids,
    'supporting_source_candidate_ids',v_support_ids,
    'lexeme_resolution_status',v_lexeme_status,
    'competing_pos',v_competing_pos,
    'evidence',v_evidence,
    'confidence',case when v_status in ('resolved_single','resolved_by_evidence') then 'high' else null end
  );
end;
$function$;

create or replace function public.resolve_structural_local_pos_v1(p_analysis jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_tokens jsonb := coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
  v_morph jsonb := coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb);
  v_token jsonb;
  v_morph_item jsonb;
  v_out jsonb := '[]'::jsonb;
  v_idx integer;
begin
  for v_token in
    select t from jsonb_array_elements(v_tokens) t order by (t->>'token_index')::integer
  loop
    v_idx := (v_token->>'token_index')::integer;
    select m into v_morph_item
    from jsonb_array_elements(v_morph) m
    where (m->>'token_index')::integer=v_idx
    limit 1;
    v_out := v_out || jsonb_build_array(
      public.resolve_local_pos_token_v1(v_token,coalesce(v_morph_item,'{}'::jsonb),'[]'::jsonb)
    );
  end loop;
  return v_out;
end;
$function$;

create or replace function public.apply_local_pos_disambiguation_v1(p_analysis jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_pos jsonb;
begin
  v_pos := public.resolve_structural_local_pos_v1(p_analysis);
  p_analysis := jsonb_set(p_analysis,'{language_graph,local_pos_v1}',v_pos,true);
  return p_analysis || jsonb_build_object(
    'local_pos_disambiguation',jsonb_build_object(
      'contract','local-pos-disambiguation-v1',
      'resolver','resolve_structural_local_pos_v1',
      'compatibility_surface','existing token nrg_resolution and structural semantics retained unchanged'
    )
  );
end;
$function$;

create or replace function public.local_pos_disambiguation_contract_v1()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'version','local-pos-disambiguation-v1',
  'input',jsonb_build_array('surface candidates','lexical classes','morphology_v1','optional external POS evidence'),
  'authoritative_output','language_graph.local_pos_v1',
  'compatibility_output','existing token.nrg_resolution retained unchanged',
  'core_distinction','source candidate POS and resolved grammatical POS are separate fields',
  'resolution_policy',jsonb_build_array(
    'hard lexical-class and morphology POS evidence must agree',
    'external require_pos/exclude_pos evidence is deterministic',
    'without hard evidence, unanimous source POS resolves POS',
    'multiple remaining POS hypotheses stay ambiguous',
    'hard evidence conflicts are explicit conflicts'
  ),
  'evidence_types',jsonb_build_array('lexical_class_pos','morphology_selected_pos','morphology_pos_consensus','source_candidate_pos','require_pos','exclude_pos'),
  'statuses',jsonb_build_array('resolved_single','resolved_by_evidence','ambiguous','conflict','no_pos_candidate','unsupported'),
  'non_goals',jsonb_build_array('lexeme/sense disambiguation','construction resolution','probabilistic ranking','structural POS refinement'),
  'deferred_context_producers',jsonb_build_array('modal-governed infinitive','copular predicative','NP internal structural evidence'),
  'architecture_closed_criterion','new POS rule families supply generic require_pos/exclude_pos or lexical-class evidence without changing resolver code'
);
$function$;

create or replace function public.analyze_text_structural_shadow_v5(
  p_text text,
  p_release_code text default 'runtime-structural-v1.5'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_doc jsonb;
  v_sentences jsonb := '[]'::jsonb;
  v_s jsonb;
  v_analysis jsonb;
begin
  v_doc := public.analyze_text_structural_shadow_v4(p_text,p_release_code);
  for v_s in
    select s from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences}','[]'::jsonb)) s
  loop
    v_analysis := public.apply_local_pos_disambiguation_v1(v_s->'analysis');
    v_sentences := v_sentences || jsonb_build_array(jsonb_set(v_s,'{analysis}',v_analysis,true));
  end loop;
  v_doc := jsonb_set(v_doc,'{document_graph,sentences}',v_sentences,true);
  return v_doc || jsonb_build_object(
    'engine_version','grammar-structural-shadow-v5',
    'local_pos_disambiguation',jsonb_build_object(
      'contract','local-pos-disambiguation-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.local_pos_v1'
    )
  );
end;
$function$;

comment on function public.resolve_local_pos_token_v1(jsonb,jsonb,jsonb) is 'Local POS Disambiguation V1 deterministic resolver. Separates source-dictionary POS from grammatical POS; hard evidence conflicts are explicit and unresolved cross-POS cases remain ambiguous.';
comment on function public.resolve_structural_local_pos_v1(jsonb) is 'Builds Local POS V1 results from existing lexical classes and Morphological Disambiguation V1 without changing prior structural semantics.';;
