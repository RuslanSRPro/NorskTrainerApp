create or replace function public.assess_candidate_activation_readiness_v2(p_candidate_id uuid,p_release_code text default 'runtime-structural-v1.27')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare c record; rule_count int:=0; ready_count int:=0; canonical_count int:=0; manifest_count int:=0; r record; a jsonb; canonical boolean; state text; release_no int;
begin
 select k.*,v.execution_contract into c from public.grammar_knowledge_candidates k left join public.grammar_knowledge_candidate_execution_v v on v.candidate_id=k.id where k.id=p_candidate_id;
 if c.id is null then return jsonb_build_object('version','rule-activation-readiness-v2','status','candidate_not_found','candidate_id',p_candidate_id); end if;
 release_no:=nullif(regexp_replace(p_release_code,'^.*v1\.','',''),'')::int;
 for r in
   select gr.* from public.grammar_rule_sources gs join public.grammar_rules gr on gr.id=gs.grammar_rule_id
   join public.grammar_runtime_release_rules rr on rr.rule_id=gr.id
   join public.grammar_runtime_releases rel on rel.id=rr.release_id
   where gs.candidate_id=p_candidate_id and rel.code=p_release_code and rr.is_enabled
   order by gr.code
 loop
   rule_count:=rule_count+1; a:=public.assess_runtime_rule_execution_v5(r.id);
   if coalesce((a->>'ready_without_runtime_code_change')::boolean,false) then ready_count:=ready_count+1; end if;
   canonical:=case when r.pattern_type='morphological_inflection' then release_no>=27 else true end;
   if canonical and coalesce((a->>'ready_without_runtime_code_change')::boolean,false) then canonical_count:=canonical_count+1; end if;
 end loop;
 select count(*) into manifest_count from public.grammar_runtime_manifest_sources ms join public.grammar_runtime_manifests m on m.id=ms.manifest_id where ms.candidate_id=p_candidate_id and m.authoring_status='validated';
 if c.status not in ('verified','source_verified') then state:='source_invalid';
 elsif not coalesce(c.runtime_eligible,false) then state:='not_runtime_target';
 elsif rule_count>0 and ready_count=rule_count and canonical_count=rule_count then state:='activation_ready';
 elsif rule_count>0 and ready_count=rule_count and canonical_count<rule_count then state:='operator_ready_not_canonical_integrated';
 elsif rule_count>0 then state:='blocked_by_runtime_capability';
 elsif manifest_count>0 then state:='covered_by_validated_manifest';
 else state:='needs_manifest'; end if;
 return jsonb_build_object(
  'version','rule-activation-readiness-v2','candidate_id',c.id,'candidate_code',c.source_rule_key,
  'release_code',p_release_code,'readiness_state',state,'runtime_eligible',c.runtime_eligible,
  'materialized_rule_count',rule_count,'operator_ready_rule_count',ready_count,'canonical_integrated_rule_count',canonical_count,
  'validated_manifest_count',manifest_count,'activation_ready',state='activation_ready',
  'safety','global grammar_rules.is_active is not required; release membership + operator readiness + canonical integration are required'
 );
end;
$$;
