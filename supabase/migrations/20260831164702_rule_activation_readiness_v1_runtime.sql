create or replace function public.rule_activation_readiness_contract_v1()
returns jsonb
language sql stable
set search_path to 'public','pg_catalog'
as $$
select jsonb_build_object(
 'version','rule-activation-readiness-v1',
 'scope','all grammar_knowledge_candidates',
 'states',jsonb_build_array(
   'activation_ready','covered_by_validated_manifest','needs_manifest','not_runtime_target','blocked_by_runtime_capability','source_invalid'
 ),
 'activation_ready_definition','source verified + runtime_eligible + materialized compiled rule(s) + every rule executable via runtime-rule-execution-assessment-v4',
 'manifest_coverage_definition','runtime_eligible + validated manifest source coverage but no direct materialized rule source',
 'safety','runtime_eligible alone never implies activation_ready; this layer never activates grammar_rules',
 'test_families',jsonb_build_array('forms','tenses','degrees_of_comparison')
);
$$;

create or replace function public.assess_candidate_activation_readiness_v1(p_candidate_id uuid)
returns jsonb
language plpgsql stable
set search_path to 'public','pg_catalog'
as $$
declare c record; e record; rules jsonb:='[]'::jsonb; manifests jsonb:='[]'::jsonb; r record; a jsonb; rule_count int:=0; ready_rules int:=0; blocked_rules int:=0; validated_manifest_count int:=0; state text; blockers jsonb:='[]'::jsonb;
begin
 select * into c from public.grammar_knowledge_candidates where id=p_candidate_id;
 if c.id is null then return jsonb_build_object('version','rule-activation-readiness-v1','candidate_id',p_candidate_id,'state','candidate_not_found'); end if;
 select * into e from public.grammar_knowledge_candidate_execution_v where candidate_id=p_candidate_id;

 for r in
   select gr.id,gr.code,gr.pattern_type,gr.rule_type
   from public.grammar_rule_sources gs join public.grammar_rules gr on gr.id=gs.grammar_rule_id
   where gs.candidate_id=p_candidate_id order by gr.code
 loop
   rule_count:=rule_count+1; a:=public.assess_runtime_rule_execution_v4(r.id);
   if coalesce((a->>'ready_without_runtime_code_change')::boolean,false) then ready_rules:=ready_rules+1; else blocked_rules:=blocked_rules+1; blockers:=blockers||jsonb_build_array(jsonb_build_object('type','runtime_rule','rule_code',r.code,'execution_status',a->>'execution_status','upstream_blockers',a->'upstream_blockers')); end if;
   rules:=rules||jsonb_build_array(jsonb_build_object('rule_id',r.id,'rule_code',r.code,'pattern_type',r.pattern_type,'rule_type',r.rule_type,'assessment',a));
 end loop;

 select coalesce(jsonb_agg(jsonb_build_object('manifest_id',m.id,'manifest_code',m.code,'authoring_status',m.authoring_status,'runtime_family',m.runtime_family,'execution_phase',m.execution_phase) order by m.code),'[]'::jsonb),
        count(*) filter(where m.authoring_status='validated')::int
 into manifests,validated_manifest_count
 from public.grammar_runtime_manifests m
 where m.primary_candidate_id=p_candidate_id
    or exists(select 1 from public.grammar_runtime_manifest_sources ms where ms.manifest_id=m.id and ms.candidate_id=p_candidate_id);

 if c.status not in ('verified','source_verified') then state:='source_invalid'; blockers:=blockers||jsonb_build_array('source_not_verified');
 elsif not coalesce(e.runtime_eligible,false) then state:='not_runtime_target';
 elsif rule_count>0 and ready_rules=rule_count then state:='activation_ready';
 elsif rule_count>0 then state:='blocked_by_runtime_capability';
 elsif validated_manifest_count>0 then state:='covered_by_validated_manifest'; blockers:=blockers||jsonb_build_array('no_direct_materialized_rule_source');
 else state:='needs_manifest'; blockers:=blockers||jsonb_build_array('validated_runtime_manifest_missing'); end if;

 return jsonb_build_object(
  'version','rule-activation-readiness-v1','candidate_id',c.id,'candidate_code',e.candidate_code,'title',c.title,'source_section',c.source_section,
  'source_status',c.status,'runtime_eligible',coalesce(e.runtime_eligible,false),'execution_role',e.execution_contract#>>'{execution,role}',
  'state',state,'rule_count',rule_count,'ready_rule_count',ready_rules,'blocked_rule_count',blocked_rules,
  'validated_manifest_count',validated_manifest_count,'manifests',manifests,'rules',rules,'blockers',blockers,
  'safe_to_activate',state='activation_ready'
 );
end;
$$;

create or replace function public.rule_activation_readiness_summary_v1(p_release_code text default 'runtime-structural-v1.23')
returns jsonb
language plpgsql stable
set search_path to 'public','pg_catalog'
as $$
declare r record; a jsonb; counts jsonb:='{}'::jsonb; role_counts jsonb; total int:=0; ready int:=0; manifest_cov int:=0; needs int:=0; nonruntime int:=0; blocked int:=0; invalid int:=0;
begin
 for r in select id from public.grammar_knowledge_candidates order by id loop
   a:=public.assess_candidate_activation_readiness_v1(r.id); total:=total+1;
   case a->>'state'
    when 'activation_ready' then ready:=ready+1;
    when 'covered_by_validated_manifest' then manifest_cov:=manifest_cov+1;
    when 'needs_manifest' then needs:=needs+1;
    when 'not_runtime_target' then nonruntime:=nonruntime+1;
    when 'blocked_by_runtime_capability' then blocked:=blocked+1;
    else invalid:=invalid+1;
   end case;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('role',role,'count',n,'activation_ready',ar,'needs_manifest',nm,'covered_by_validated_manifest',mc) order by n desc,role),'[]'::jsonb)
 into role_counts
 from (
   select coalesce(e.execution_contract#>>'{execution,role}','<none>') role,count(*) n,
     count(*) filter(where (public.assess_candidate_activation_readiness_v1(c.id)->>'state')='activation_ready') ar,
     count(*) filter(where (public.assess_candidate_activation_readiness_v1(c.id)->>'state')='needs_manifest') nm,
     count(*) filter(where (public.assess_candidate_activation_readiness_v1(c.id)->>'state')='covered_by_validated_manifest') mc
   from public.grammar_knowledge_candidates c left join public.grammar_knowledge_candidate_execution_v e on e.candidate_id=c.id
   group by 1
 ) q;
 return jsonb_build_object(
   'version','rule-activation-readiness-v1','release_code',p_release_code,'status','audited',
   'summary',jsonb_build_object('total_candidates',total,'activation_ready',ready,'covered_by_validated_manifest',manifest_cov,'needs_manifest',needs,'not_runtime_target',nonruntime,'blocked_by_runtime_capability',blocked,'source_invalid',invalid,'bulk_activation_ready',false),
   'role_breakdown',role_counts,
   'current_compiled_execution',public.audit_execution_family_closure_v4('runtime-structural-v1.22')->'summary',
   'contract',public.rule_activation_readiness_contract_v1()
 );
end;
$$;

create or replace function public.analyze_text_structural_shadow_v23(p_text text,p_release_code text default 'runtime-structural-v1.23')
returns jsonb
language plpgsql stable
set search_path to 'public','pg_catalog'
as $$
declare d jsonb;
begin
 d:=public.analyze_text_structural_shadow_v22(p_text,p_release_code);
 return d;
end;
$$;
