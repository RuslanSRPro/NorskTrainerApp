create or replace function public.morph_features_compatible_v1(p_features jsonb, p_required jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare
  v_key text;
  v_req jsonb;
  v_have jsonb;
begin
  if coalesce(p_required,'{}'::jsonb)='{}'::jsonb then return true; end if;
  for v_key,v_req in select key,value from jsonb_each(coalesce(p_required,'{}'::jsonb)) loop
    v_have := coalesce(p_features,'{}'::jsonb)->v_key;
    -- Missing reading features are treated as underspecified, not contradictory.
    if v_have is null then continue; end if;
    if jsonb_typeof(v_req)='array' then
      if not exists(select 1 from jsonb_array_elements(v_req) x where x=v_have) then return false; end if;
    elsif v_have<>v_req then
      return false;
    end if;
  end loop;
  return true;
end;
$function$;

create or replace function public.morph_agreement_constraints_v1(p_features jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_strip_nulls(jsonb_build_object(
  'Number',p_features->>'Number',
  'Definite',p_features->>'Definite',
  'Gender',case when p_features->>'Number'='Plur' then null else coalesce(p_features->>'AgreementGender',p_features->>'Gender') end
));
$function$;

create or replace function public.morph_agreement_unifies_v1(p_left_features jsonb,p_right_features jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare
  lnum text:=p_left_features->>'Number'; rnum text:=p_right_features->>'Number';
  ldef text:=p_left_features->>'Definite'; rdef text:=p_right_features->>'Definite';
  lgen text:=coalesce(p_left_features->>'AgreementGender',p_left_features->>'Gender');
  rgen text:=coalesce(p_right_features->>'AgreementGender',p_right_features->>'Gender');
begin
  if lnum is not null and rnum is not null and lnum<>rnum then return false; end if;
  if ldef is not null and rdef is not null and ldef<>rdef then return false; end if;
  if coalesce(lnum,rnum)<>'Plur' and lgen is not null and rgen is not null and lgen<>rgen then return false; end if;
  return true;
end;
$function$;

create or replace function public.append_morph_evidence_v1(p_map jsonb,p_token_index integer,p_evidence jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare
  v_current jsonb:=coalesce(p_map->p_token_index::text,'[]'::jsonb);
begin
  if not (v_current @> jsonb_build_array(p_evidence)) then
    v_current:=v_current||jsonb_build_array(p_evidence);
  end if;
  return jsonb_set(coalesce(p_map,'{}'::jsonb),array[p_token_index::text],v_current,true);
end;
$function$;

create or replace function public.resolve_morph_readings_v1(p_readings jsonb,p_evidence jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path=''
as $function$
declare
  v_reading jsonb; v_ev jsonb; v_ok boolean; v_key text; v_reason text;
  v_survivors jsonb:='[]'::jsonb; v_rejected jsonb:='[]'::jsonb;
  v_original_count integer:=jsonb_array_length(coalesce(p_readings,'[]'::jsonb));
  v_survivor_count integer; v_unsupported integer:=0; v_selected jsonb; v_status text;
begin
  select count(*)::int into v_unsupported
  from jsonb_array_elements(coalesce(p_evidence,'[]'::jsonb)) e
  where coalesce(e->>'type','') not in ('feature_constraint','reading_key');

  if v_unsupported>0 then
    return jsonb_build_object('resolver_version','morphological-disambiguation-v1','status','unsupported','reading_count',v_original_count,'selected_reading_id',null,'selected_reading_key',null,'selected_reading',null,'surviving_readings',coalesce(p_readings,'[]'::jsonb),'rejected_readings','[]'::jsonb,'evidence',coalesce(p_evidence,'[]'::jsonb),'confidence',null);
  end if;

  for v_reading in select r from jsonb_array_elements(coalesce(p_readings,'[]'::jsonb)) r loop
    v_key:=coalesce(v_reading->>'candidate_id','')||'|'||coalesce(v_reading->>'reading_id','');
    v_ok:=true; v_reason:=null;
    for v_ev in select e from jsonb_array_elements(coalesce(p_evidence,'[]'::jsonb)) e loop
      if v_ev->>'type'='feature_constraint' then
        if not public.morph_features_compatible_v1(v_reading->'features',coalesce(v_ev->'features','{}'::jsonb)) then
          v_ok:=false; v_reason:=coalesce(v_ev->>'reason_code','feature_constraint_conflict'); exit;
        end if;
      elsif v_ev->>'type'='reading_key' then
        if v_key<>v_ev->>'reading_key' then
          v_ok:=false; v_reason:=coalesce(v_ev->>'reason_code','reading_key_constraint'); exit;
        end if;
      end if;
    end loop;
    if v_ok then
      v_survivors:=v_survivors||jsonb_build_array(v_reading||jsonb_build_object('reading_key',v_key));
    else
      v_rejected:=v_rejected||jsonb_build_array(v_reading||jsonb_build_object('reading_key',v_key,'rejected_by',v_reason));
    end if;
  end loop;

  v_survivor_count:=jsonb_array_length(v_survivors);
  if v_original_count=0 then v_status:='no_morph_reading';
  elsif v_survivor_count=0 then v_status:='conflict';
  elsif v_survivor_count=1 then
    v_selected:=v_survivors->0;
    if v_original_count=1 and jsonb_array_length(coalesce(p_evidence,'[]'::jsonb))=0 then v_status:='resolved_single'; else v_status:='resolved_by_evidence'; end if;
  else v_status:='ambiguous';
  end if;

  return jsonb_build_object(
    'resolver_version','morphological-disambiguation-v1',
    'status',v_status,
    'reading_count',v_original_count,
    'surviving_count',v_survivor_count,
    'selected_reading_id',v_selected->>'reading_id',
    'selected_reading_key',v_selected->>'reading_key',
    'selected_candidate_id',v_selected->>'candidate_id',
    'selected_lemma',v_selected->>'lemma',
    'selected_source_pos',v_selected->>'source_pos',
    'selected_reading',v_selected,
    'surviving_readings',v_survivors,
    'rejected_readings',v_rejected,
    'evidence',coalesce(p_evidence,'[]'::jsonb),
    'confidence',case when v_status in ('resolved_single','resolved_by_evidence') then 'high' else null end
  );
end;
$function$;

create or replace function public.resolve_token_morphology_v1(p_token jsonb,p_evidence jsonb default '[]'::jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select public.resolve_morph_readings_v1(coalesce(p_token#>'{morphology,readings}','[]'::jsonb),coalesce(p_evidence,'[]'::jsonb));
$function$;

create or replace function public.resolve_structural_morphology_v1(p_analysis jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_tokens jsonb:=coalesce(p_analysis#>'{language_graph,tokens}',p_analysis->'tokens','[]'::jsonb);
  v_evidence_map jsonb:='{}'::jsonb; v_resolution_map jsonb:='{}'::jsonb;
  v_token jsonb; v_clause jsonb; v_phrase jsonb; v_dep jsonb; v_lc jsonb; v_ev jsonb;
  v_idx integer; v_head integer; v_member integer; v_article_features jsonb; v_pass integer;
  v_src integer; v_tgt integer; v_src_res jsonb; v_tgt_res jsonb; v_constraints jsonb;
  v_lr jsonb; v_rr jsonb; v_pair_count integer; v_left_key text; v_right_key text;
  v_out jsonb:='[]'::jsonb; v_res jsonb;
begin
  -- Base resolution, before context.
  for v_token in select t from jsonb_array_elements(v_tokens) t order by (t->>'token_index')::integer loop
    v_idx:=(v_token->>'token_index')::integer;
    v_resolution_map:=jsonb_set(v_resolution_map,array[v_idx::text],public.resolve_token_morphology_v1(v_token,'[]'::jsonb),true);
  end loop;

  -- Structural finite-head evidence.
  for v_clause in select c from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,clauses}','[]'::jsonb)) c loop
    if v_clause->>'finite_token_index' is not null then
      v_idx:=(v_clause->>'finite_token_index')::integer;
      v_ev:=jsonb_build_object('type','feature_constraint','source','clause.finite_token_index','reason_code','finite_predicate_head','features',jsonb_build_object('VerbForm','Fin'));
      v_evidence_map:=public.append_morph_evidence_v1(v_evidence_map,v_idx,v_ev);
      select t into v_token from jsonb_array_elements(v_tokens) t where (t->>'token_index')::integer=v_idx limit 1;
      v_resolution_map:=jsonb_set(v_resolution_map,array[v_idx::text],public.resolve_token_morphology_v1(v_token,v_evidence_map->v_idx::text),true);
    end if;
  end loop;

  -- Article -> NP-head feature evidence.
  for v_phrase in select p from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,phrases}','[]'::jsonb)) p where p->>'type'='NP' loop
    v_head:=(v_phrase->>'head_token_index')::integer; v_article_features:=null;
    for v_member in select value::text::integer from jsonb_array_elements_text(coalesce(v_phrase->'member_token_indices','[]'::jsonb)) loop
      if v_member=v_head then continue; end if;
      select t into v_token from jsonb_array_elements(v_tokens) t where (t->>'token_index')::integer=v_member limit 1;
      for v_lc in select c from jsonb_array_elements(coalesce(v_token->'lexical_classes','[]'::jsonb)) c loop
        if v_lc->>'class_code'='indefinite_article' then v_article_features:=v_lc#>'{evidence,grammatical_features}'; exit; end if;
      end loop;
      exit when v_article_features is not null;
    end loop;
    if v_article_features is not null then
      v_constraints:=public.morph_agreement_constraints_v1(v_article_features);
      v_ev:=jsonb_build_object('type','feature_constraint','source','np.indefinite_article','reason_code','np_article_features','features',v_constraints);
      v_evidence_map:=public.append_morph_evidence_v1(v_evidence_map,v_head,v_ev);
      select t into v_token from jsonb_array_elements(v_tokens) t where (t->>'token_index')::integer=v_head limit 1;
      v_resolution_map:=jsonb_set(v_resolution_map,array[v_head::text],public.resolve_token_morphology_v1(v_token,v_evidence_map->v_head::text),true);
    end if;
  end loop;

  -- Agreement refinement. Repeated passes allow one side to resolve the other.
  for v_pass in 1..3 loop
    for v_dep in select d from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,dependencies}','[]'::jsonb)) d where d->>'relation'='agreement_controller' loop
      v_src:=(v_dep->>'source_token_index')::integer; v_tgt:=(v_dep->>'target_token_index')::integer;
      v_src_res:=v_resolution_map->v_src::text; v_tgt_res:=v_resolution_map->v_tgt::text;

      if v_tgt_res->'selected_reading' is not null then
        v_constraints:=public.morph_agreement_constraints_v1(v_tgt_res#>'{selected_reading,features}');
        if v_constraints<>'{}'::jsonb then
          v_ev:=jsonb_build_object('type','feature_constraint','source','agreement_controller','reason_code','agreement_controller','controller_token_index',v_tgt,'features',v_constraints);
          v_evidence_map:=public.append_morph_evidence_v1(v_evidence_map,v_src,v_ev);
          select t into v_token from jsonb_array_elements(v_tokens) t where (t->>'token_index')::integer=v_src limit 1;
          v_resolution_map:=jsonb_set(v_resolution_map,array[v_src::text],public.resolve_token_morphology_v1(v_token,v_evidence_map->v_src::text),true);
          v_src_res:=v_resolution_map->v_src::text;
        end if;
      end if;

      if v_src_res->'selected_reading' is not null then
        v_constraints:=public.morph_agreement_constraints_v1(v_src_res#>'{selected_reading,features}');
        if v_constraints<>'{}'::jsonb then
          v_ev:=jsonb_build_object('type','feature_constraint','source','agreement_dependent','reason_code','agreement_dependent','dependent_token_index',v_src,'features',v_constraints);
          v_evidence_map:=public.append_morph_evidence_v1(v_evidence_map,v_tgt,v_ev);
          select t into v_token from jsonb_array_elements(v_tokens) t where (t->>'token_index')::integer=v_tgt limit 1;
          v_resolution_map:=jsonb_set(v_resolution_map,array[v_tgt::text],public.resolve_token_morphology_v1(v_token,v_evidence_map->v_tgt::text),true);
          v_tgt_res:=v_resolution_map->v_tgt::text;
        end if;
      end if;

      if v_src_res->'selected_reading' is null and v_tgt_res->'selected_reading' is null then
        v_pair_count:=0; v_left_key:=null; v_right_key:=null;
        for v_lr in select r from jsonb_array_elements(coalesce(v_src_res->'surviving_readings','[]'::jsonb)) r loop
          for v_rr in select r from jsonb_array_elements(coalesce(v_tgt_res->'surviving_readings','[]'::jsonb)) r loop
            if public.morph_agreement_unifies_v1(v_lr->'features',v_rr->'features') then
              v_pair_count:=v_pair_count+1; v_left_key:=v_lr->>'reading_key'; v_right_key:=v_rr->>'reading_key';
            end if;
          end loop;
        end loop;
        if v_pair_count=1 then
          v_evidence_map:=public.append_morph_evidence_v1(v_evidence_map,v_src,jsonb_build_object('type','reading_key','source','agreement_pair_unification','reason_code','unique_agreement_pair','reading_key',v_left_key));
          v_evidence_map:=public.append_morph_evidence_v1(v_evidence_map,v_tgt,jsonb_build_object('type','reading_key','source','agreement_pair_unification','reason_code','unique_agreement_pair','reading_key',v_right_key));
          select t into v_token from jsonb_array_elements(v_tokens) t where (t->>'token_index')::integer=v_src limit 1;
          v_resolution_map:=jsonb_set(v_resolution_map,array[v_src::text],public.resolve_token_morphology_v1(v_token,v_evidence_map->v_src::text),true);
          select t into v_token from jsonb_array_elements(v_tokens) t where (t->>'token_index')::integer=v_tgt limit 1;
          v_resolution_map:=jsonb_set(v_resolution_map,array[v_tgt::text],public.resolve_token_morphology_v1(v_token,v_evidence_map->v_tgt::text),true);
        end if;
      end if;
    end loop;
  end loop;

  for v_token in select t from jsonb_array_elements(v_tokens) t order by (t->>'token_index')::integer loop
    v_idx:=(v_token->>'token_index')::integer; v_res:=v_resolution_map->v_idx::text;
    v_out:=v_out||jsonb_build_array(v_res||jsonb_build_object('token_index',v_idx,'surface',v_token->>'surface'));
  end loop;
  return v_out;
end;
$function$;

create or replace function public.apply_morphological_disambiguation_v1(p_analysis jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_morph jsonb;
begin
  v_morph:=public.resolve_structural_morphology_v1(p_analysis);
  p_analysis:=jsonb_set(p_analysis,'{language_graph,morphology_v1}',v_morph,true);
  return p_analysis||jsonb_build_object('morphological_disambiguation',jsonb_build_object('contract','morphological-disambiguation-v1','resolver','resolve_structural_morphology_v1','compatibility_surface','language_graph.morph_resolutions retained unchanged'));
end;
$function$;

create or replace function public.morphological_disambiguation_contract_v1()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
 'version','morphological-disambiguation-v1',
 'input','normalized morphology readings + explicit evidence',
 'authoritative_output','language_graph.morphology_v1',
 'compatibility_output','language_graph.morph_resolutions unchanged',
 'operators',jsonb_build_array('feature_constraint','reading_key','agreement_feature_unification'),
 'feature_semantics',jsonb_build_object('missing_feature','underspecified_not_conflict','explicit_conflict','reject_reading','plural_gender','not_constraining'),
 'statuses',jsonb_build_array('no_morph_reading','resolved_single','resolved_by_evidence','ambiguous','conflict','unsupported'),
 'evidence_sources',jsonb_build_array('finite_predicate_head','np_article_features','agreement_controller','agreement_dependent','unique_agreement_pair'),
 'pos_boundary','cross-POS hypotheses may survive; general POS selection belongs to Local POS Disambiguation V1',
 'non_goals',jsonb_build_array('semantic sense disambiguation','general POS ranking','construction resolution','probabilistic scoring'),
 'architecture_closed_criterion','new morphology readings and constraints use normalized features/evidence without rule-specific branches in structural core'
);
$function$;

create or replace function public.analyze_text_structural_shadow_v4(p_text text,p_release_code text default 'runtime-structural-v1.4')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_doc jsonb; v_sentences jsonb:='[]'::jsonb; v_s jsonb; v_analysis jsonb;
begin
  v_doc:=public.analyze_text_structural_shadow_v3(p_text,p_release_code);
  for v_s in select s from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences}','[]'::jsonb)) s loop
    v_analysis:=public.apply_morphological_disambiguation_v1(v_s->'analysis');
    v_sentences:=v_sentences||jsonb_build_array(jsonb_set(v_s,'{analysis}',v_analysis,true));
  end loop;
  v_doc:=jsonb_set(v_doc,'{document_graph,sentences}',v_sentences,true);
  return v_doc||jsonb_build_object('engine_version','grammar-structural-shadow-v4','morphological_disambiguation',jsonb_build_object('contract','morphological-disambiguation-v1','authoritative_output','document_graph.sentences[].analysis.language_graph.morphology_v1'));
end;
$function$;

comment on function public.resolve_morph_readings_v1(jsonb,jsonb) is 'Morphological Disambiguation V1 deterministic resolver over normalized readings and explicit evidence. Missing features are underspecified; explicit incompatible features reject a reading.';
comment on function public.resolve_structural_morphology_v1(jsonb) is 'Projects reusable finite, article and agreement evidence from an existing structural graph into Morphological Disambiguation V1 without modifying Structural Core V1.';;
