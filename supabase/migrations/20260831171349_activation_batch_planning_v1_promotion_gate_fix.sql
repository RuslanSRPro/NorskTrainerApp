create or replace function public.promote_activation_batch_planning_release_to_shadow_v1(p_release_code text default 'runtime-structural-v1.24')
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  g jsonb;
  f jsonb;
  rd jsonb;
  rs jsonb;
  ce jsonb;
  inh jsonb;
  h1 text;
  h2 text;
  h3 text;
  r record;
begin
  g := public.run_activation_batch_planning_golden_v1(p_release_code);
  if (g->>'failed')::int <> 0 then
    raise exception 'activation batch planning golden failed: %', g;
  end if;

  f := public.run_forms_tenses_degrees_golden_v1(p_release_code);
  if (f->>'failed')::int <> 0 then
    raise exception 'forms/tenses/degrees regression failed: %', f;
  end if;

  rd := public.rule_activation_readiness_summary_v1(p_release_code);
  rs := rd->'summary';
  ce := rd->'current_compiled_execution';
  if rs is null then raise exception 'readiness summary unavailable'; end if;
  if (rs->>'total_candidates')::int <> 4564
     or (rs->>'needs_manifest')::int <> 1708
     or (rs->>'activation_ready')::int <> 14
     or (rs->>'covered_by_validated_manifest')::int <> 10
     or (rs->>'not_runtime_target')::int <> 2832
     or (rs->>'blocked_by_runtime_capability')::int <> 0
     or (rs->>'source_invalid')::int <> 0
     or coalesce((rs->>'bulk_activation_ready')::boolean,true) then
    raise exception 'readiness contract drift: %', rs;
  end if;

  if ce is null
     or (ce->>'rule_count')::int <> 15
     or (ce->>'ready_without_runtime_code_change')::int <> 15
     or (ce->>'registered_but_blocked')::int <> 0
     or (ce->>'unsupported_or_unmapped')::int <> 0
     or not coalesce((ce->>'current_compiled_set_structurally_closed')::boolean,false) then
    raise exception 'compiled execution closure drift: %', ce;
  end if;

  inh := public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.23');
  if not coalesce((inh->>'valid')::boolean,false)
     or (inh->>'extra_child_rules')::int <> 0
     or (inh->>'missing_parent_rules')::int <> 0 then
    raise exception 'direct-parent inheritance failed: %', inh;
  end if;

  if (select count(*) from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active) <> 0 then
    raise exception 'active NRG rules must remain zero';
  end if;

  select md5(pg_get_functiondef(p.oid)) into h1
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='tokenize_text_simple'
    and pg_get_function_identity_arguments(p.oid)='text';
  select md5(pg_get_functiondef(p.oid)) into h2
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='analyze_text_structural_shadow_core_v1'
    and pg_get_function_identity_arguments(p.oid)='text, text';
  select md5(pg_get_functiondef(p.oid)) into h3
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='tokenize_text_v2'
    and pg_get_function_identity_arguments(p.oid)='text';
  if h1 <> '40819fa48cc6e48372cbf42275f2bb0c'
     or h2 <> 'b15193a826907ea6082a1aae52f15fec'
     or h3 <> 'f76f85eee4469e74079a101da442ec52' then
    raise exception 'immutable hash gate failed: %, %, %', h1,h2,h3;
  end if;

  update public.grammar_runtime_releases
  set status='shadow', golden_passed_at=now(), metadata=metadata||jsonb_build_object(
    'promotion_gate','activation-batch-planning-v1-shadow-gate-v1',
    'activation_batch_planning_golden',(g->>'passed')||'/'||(g->>'total'),
    'forms_tenses_degrees_golden',(f->>'passed')||'/'||(f->>'total'),
    'readiness_summary',rs,
    'current_compiled_execution',ce,
    'bulk_activation_ready',false,
    'immutable_hashes','pass',
    'next_layer','Activation Batch Materialization Pilot V1'
  )
  where code=p_release_code;

  select code,status,rule_count,manifest_count,checksum into r
  from public.grammar_runtime_releases where code=p_release_code;

  return jsonb_build_object(
    'status','promoted',
    'release_code',r.code,
    'release_status',r.status,
    'rule_count',r.rule_count,
    'manifest_count',r.manifest_count,
    'checksum',r.checksum,
    'planning_golden',(g->>'passed')||'/'||(g->>'total'),
    'forms_tenses_degrees',(f->>'passed')||'/'||(f->>'total'),
    'readiness',rs,
    'compiled_execution',ce,
    'inheritance',inh,
    'immutable_hashes','pass',
    'bulk_activation_ready',false,
    'next_layer','Activation Batch Materialization Pilot V1'
  );
end
$$;
