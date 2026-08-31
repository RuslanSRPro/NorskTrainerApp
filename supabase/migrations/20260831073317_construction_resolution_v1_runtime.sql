create or replace function public.resolve_constructions_v1(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.9')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
  v_rec jsonb:=coalesce(p_analysis#>'{language_graph,construction_recognition_v1}','{}'::jsonb);
  v_cons jsonb:=coalesce(v_rec->'constructions','[]'::jsonb);
  v_overlaps jsonb:=coalesce(v_rec->'overlaps','[]'::jsonb);
  v_blocked jsonb:=coalesce(v_rec->'blocked_events','[]'::jsonb);
  v_decisions jsonb:='[]'::jsonb;
  v_groups jsonb:='[]'::jsonb;
  v_relations jsonb:='[]'::jsonb;
  g record;
  c jsonb;
  o jsonb;
  b jsonb;
  v_group_cons jsonb;
  v_group_blocked jsonb;
  v_group_relations jsonb;
  v_group_status text;
  v_reason text;
  v_has_hypothesis boolean;
  v_has_blocked boolean;
  v_has_competing boolean;
  v_has_modal_chain boolean;
  v_decision text;
  v_decision_reason text;
  v_prov jsonb;
  v_left jsonb;
  v_right jsonb;
  v_relation text;
begin
  if jsonb_typeof(v_cons)<>'array' then v_cons:='[]'::jsonb; end if;
  if jsonb_typeof(v_overlaps)<>'array' then v_overlaps:='[]'::jsonb; end if;
  if jsonb_typeof(v_blocked)<>'array' then v_blocked:='[]'::jsonb; end if;

  -- Classify recognized overlap relations first. Unknown families remain competing.
  for o in select x from jsonb_array_elements(v_overlaps) x loop
    select x into v_left from jsonb_array_elements(v_cons) x where x->>'id'=o->>'left_id' limit 1;
    select x into v_right from jsonb_array_elements(v_cons) x where x->>'id'=o->>'right_id' limit 1;
    if v_left is null or v_right is null then continue; end if;

    if (v_left->>'family'='modal_auxiliary_chain' and v_right->>'family'='modal_auxiliary_bare_infinitive')
       or (v_right->>'family'='modal_auxiliary_chain' and v_left->>'family'='modal_auxiliary_bare_infinitive') then
      v_relation:='compatible';
      v_reason:='modal_chain_component';
      v_prov:=jsonb_build_array(
        public.construction_resolution_source_v1(p_release_code,'verb.modal_auxiliary.chain'),
        public.construction_resolution_source_v1(p_release_code,'verb.modal_auxiliary.chain.finiteness')
      );
    elsif v_left->>'family'='modal_auxiliary_bare_infinitive' and v_right->>'family'='modal_auxiliary_bare_infinitive'
      and exists(
        select 1 from jsonb_array_elements(v_cons) mc
        where mc->>'family'='modal_auxiliary_chain'
          and ((mc->>'span_start')::int <= least((v_left->>'span_start')::int,(v_right->>'span_start')::int))
          and ((mc->>'span_end')::int >= least((v_left->>'span_end')::int,(v_right->>'span_end')::int)-1)
      ) then
      v_relation:='compatible';
      v_reason:='shared_modal_chain_composition';
      v_prov:=jsonb_build_array(public.construction_resolution_source_v1(p_release_code,'verb.modal_auxiliary.chain'));
    else
      v_relation:='competing';
      v_reason:='unknown_overlap_defaults_to_competing';
      v_prov:='[]'::jsonb;
    end if;

    v_relations:=v_relations||jsonb_build_array(jsonb_build_object(
      'left_id',o->>'left_id','right_id',o->>'right_id','relation',v_relation,'reason_code',v_reason,
      'requires_resolution',true,'provenance',v_prov
    ));
  end loop;

  -- Build connected components from the recognition overlap graph; singleton constructions become one-node groups.
  for g in
    with recursive
    nodes as (
      select x->>'id' id from jsonb_array_elements(v_cons) x
    ),
    edges as (
      select o->>'left_id' a,o->>'right_id' b from jsonb_array_elements(v_overlaps) o
      union all
      select o->>'right_id',o->>'left_id' from jsonb_array_elements(v_overlaps) o
    ),
    reach(root,id) as (
      select id,id from nodes
      union
      select r.root,e.b from reach r join edges e on e.a=r.id
    ),
    comp as (
      select id,min(root) component_key from reach group by id
    )
    select component_key,
           jsonb_agg(c order by (c->>'span_start')::int,(c->>'span_end')::int,c->>'id') constructions,
           min((c->>'span_start')::int) span_start,
           max((c->>'span_end')::int) span_end
    from comp cp join lateral (
      select x c from jsonb_array_elements(v_cons) x where x->>'id'=cp.id
    ) q on true
    group by component_key
    order by min((c->>'span_start')::int),max((c->>'span_end')::int)
  loop
    v_group_cons:=g.constructions;
    select coalesce(jsonb_agg(x),'[]'::jsonb) into v_group_blocked
    from jsonb_array_elements(v_blocked) x
    where (x->>'span_start') is not null and (x->>'span_end') is not null
      and (x->>'span_start')::int <= g.span_end
      and (x->>'span_end')::int >= g.span_start;

    select coalesce(jsonb_agg(x),'[]'::jsonb) into v_group_relations
    from jsonb_array_elements(v_relations) x
    where exists(select 1 from jsonb_array_elements(v_group_cons) gc where gc->>'id'=x->>'left_id')
      and exists(select 1 from jsonb_array_elements(v_group_cons) gc where gc->>'id'=x->>'right_id');

    v_has_hypothesis:=exists(select 1 from jsonb_array_elements(v_group_cons) x where x->>'status'='hypothesis');
    v_has_blocked:=jsonb_array_length(v_group_blocked)>0;
    v_has_competing:=exists(select 1 from jsonb_array_elements(v_group_relations) x where x->>'relation'='competing');
    v_has_modal_chain:=exists(select 1 from jsonb_array_elements(v_group_cons) x where x->>'family'='modal_auxiliary_chain');

    if v_has_blocked then
      v_group_status:='unresolved'; v_reason:='blocked_competitor_overlap';
    elsif v_has_hypothesis then
      v_group_status:='unresolved'; v_reason:='recognition_hypothesis_requires_discriminating_evidence';
    elsif v_has_competing then
      v_group_status:='unresolved'; v_reason:='competing_overlap_without_resolution_rule';
    else
      v_group_status:='resolved';
      if jsonb_array_length(v_group_cons)=1 then v_reason:='singleton_supported_construction';
      elsif v_has_modal_chain then v_reason:='compatible_modal_chain_composition';
      else v_reason:='compatible_overlap_group'; end if;
    end if;

    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'group_id','cres1:'||g.component_key,
      'status',v_group_status,
      'reason_code',v_reason,
      'span_start',g.span_start,'span_end',g.span_end,
      'construction_ids',(select jsonb_agg(x->>'id' order by x->>'id') from jsonb_array_elements(v_group_cons) x),
      'blocked_events',v_group_blocked,
      'relations',v_group_relations,
      'requires_resolution',v_group_status<>'resolved'
    ));

    for c in select x from jsonb_array_elements(v_group_cons) x loop
      if v_group_status='unresolved' then
        v_decision:='unresolved';
        v_decision_reason:=v_reason;
      elsif v_has_modal_chain and c->>'family'='modal_auxiliary_chain' then
        v_decision:='selected';
        v_decision_reason:='modal_chain_primary_composite';
      elsif v_has_modal_chain and c->>'family'='modal_auxiliary_bare_infinitive' then
        v_decision:='compatible_component';
        v_decision_reason:='component_of_selected_modal_chain';
      else
        v_decision:='selected';
        v_decision_reason:='resolved_singleton_or_compatible_candidate';
      end if;

      if c->>'family'='modal_auxiliary_chain' then
        v_prov:=jsonb_build_array(
          public.construction_resolution_source_v1(p_release_code,'verb.modal_auxiliary.chain'),
          public.construction_resolution_source_v1(p_release_code,'verb.modal_auxiliary.chain.finiteness')
        );
      elsif c->>'family'='auxiliary_nonfinite_complement' then
        v_prov:=jsonb_build_array(
          public.construction_resolution_source_v1(p_release_code,'verb.compound_form.finite_aux_nonfinite_main'),
          public.construction_resolution_source_v1(p_release_code,'verb.auxiliary.complement.nonfinite_main')
        );
      elsif c->>'family'='copular_predicative' then
        v_prov:=jsonb_build_array(
          public.construction_resolution_source_v1(p_release_code,'sentence.predicative.subject.copula.core_verbal_requirement'),
          public.construction_resolution_source_v1(p_release_code,'sentence.predicative.subject.copula.constituent_type_eligibility')
        );
      else
        v_prov:='[]'::jsonb;
      end if;

      v_decisions:=v_decisions||jsonb_build_array(jsonb_build_object(
        'construction_id',c->>'id','family',c->>'family','surface',c->>'surface',
        'recognition_status',c->>'status','decision',v_decision,'reason_code',v_decision_reason,
        'group_id','cres1:'||g.component_key,'provenance',v_prov
      ));
    end loop;
  end loop;

  -- Blocked events with no recognized construction remain visible as blocked groups.
  for b in select x from jsonb_array_elements(v_blocked) x loop
    if not exists(
      select 1 from jsonb_array_elements(v_cons) c
      where (c->>'span_start') is not null and (c->>'span_end') is not null
        and (c->>'span_start')::int <= (b->>'span_end')::int
        and (c->>'span_end')::int >= (b->>'span_start')::int
    ) then
      v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
        'group_id','cres1:blocked:'||coalesce(b->>'family','unknown')||':'||coalesce(b->>'span_start','0'),
        'status','blocked','reason_code',coalesce(b->>'reason_code','blocked_upstream'),
        'span_start',(b->>'span_start')::int,'span_end',(b->>'span_end')::int,
        'construction_ids','[]'::jsonb,'blocked_events',jsonb_build_array(b),'relations','[]'::jsonb,
        'requires_resolution',true
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'version','construction-resolution-v1','status','ready',
    'resolution_groups',v_groups,
    'construction_decisions',v_decisions,
    'resolved_relations',v_relations,
    'unresolved_blocked_events',v_blocked,
    'summary',jsonb_build_object(
      'group_count',jsonb_array_length(v_groups),
      'resolved_group_count',(select count(*) from jsonb_array_elements(v_groups) x where x->>'status'='resolved'),
      'unresolved_group_count',(select count(*) from jsonb_array_elements(v_groups) x where x->>'status'='unresolved'),
      'blocked_group_count',(select count(*) from jsonb_array_elements(v_groups) x where x->>'status'='blocked'),
      'selected_count',(select count(*) from jsonb_array_elements(v_decisions) x where x->>'decision'='selected'),
      'compatible_component_count',(select count(*) from jsonb_array_elements(v_decisions) x where x->>'decision'='compatible_component'),
      'unresolved_decision_count',(select count(*) from jsonb_array_elements(v_decisions) x where x->>'decision'='unresolved'),
      'relation_count',jsonb_array_length(v_relations)
    )
  );
end;
$function$;

create or replace function public.apply_construction_resolution_v1(p_analysis jsonb,p_release_code text default 'runtime-structural-v1.9')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_resolution jsonb;
begin
  v_resolution:=public.resolve_constructions_v1(p_analysis,p_release_code);
  return jsonb_set(p_analysis,'{language_graph,construction_resolution_v1}',v_resolution,true);
end;
$function$;

create or replace function public.analyze_text_structural_shadow_v9(p_text text,p_release_code text default 'runtime-structural-v1.9')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_doc jsonb; v_sentences jsonb:='[]'::jsonb; v_s jsonb; v_analysis jsonb;
begin
  v_doc:=public.analyze_text_structural_shadow_v8(p_text,p_release_code);
  for v_s in select s from jsonb_array_elements(coalesce(v_doc#>'{document_graph,sentences}','[]'::jsonb)) s loop
    v_analysis:=public.apply_construction_resolution_v1(v_s->'analysis',p_release_code);
    v_sentences:=v_sentences||jsonb_build_array(jsonb_set(v_s,'{analysis}',v_analysis,true));
  end loop;
  v_doc:=jsonb_set(v_doc,'{document_graph,sentences}',v_sentences,true);
  return v_doc||jsonb_build_object(
    'engine_version','grammar-structural-shadow-v9',
    'construction_resolution',jsonb_build_object(
      'contract','construction-resolution-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.construction_resolution_v1.resolution_groups'
    )
  );
end;
$function$;;
