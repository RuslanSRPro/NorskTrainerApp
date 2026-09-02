create or replace function public.assess_candidate_activation_readiness_v2(p_candidate_id uuid,p_release_code text default 'runtime-structural-v1.27')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare c record; e record; rule_count int:=0; ready_count int:=0; canonical_count int:=0; manifest_count int:=0; r record; a jsonb; canonical boolean; state text; release_no int;
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
 select count(*) into manifest_count from public.grammar_runtime_manifest_sources ms join public.grammar_runtime_manifests m on m.id=ms.manifest_id where ms.candidate_id=p_candidate_id and m.validation_status='validated';
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

create or replace function public.rule_activation_readiness_summary_v2(p_release_code text default 'runtime-structural-v1.27')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare r record; a jsonb; total int:=0; ready int:=0; manifests int:=0; needs int:=0; nrt int:=0; blocked int:=0; op_only int:=0; invalid int:=0;
begin
 for r in select id from public.grammar_knowledge_candidates order by id loop
   a:=public.assess_candidate_activation_readiness_v2(r.id,p_release_code); total:=total+1;
   case a->>'readiness_state'
    when 'activation_ready' then ready:=ready+1;
    when 'covered_by_validated_manifest' then manifests:=manifests+1;
    when 'needs_manifest' then needs:=needs+1;
    when 'not_runtime_target' then nrt:=nrt+1;
    when 'blocked_by_runtime_capability' then blocked:=blocked+1;
    when 'operator_ready_not_canonical_integrated' then op_only:=op_only+1;
    else invalid:=invalid+1;
   end case;
 end loop;
 return jsonb_build_object('version','rule-activation-readiness-v2','release_code',p_release_code,'status','audited','summary',jsonb_build_object(
  'total_candidates',total,'activation_ready',ready,'covered_by_validated_manifest',manifests,'needs_manifest',needs,
  'not_runtime_target',nrt,'blocked_by_runtime_capability',blocked,'operator_ready_not_canonical_integrated',op_only,'source_invalid',invalid,
  'bulk_activation_ready',false));
end;
$$;

create or replace function public.run_morphological_rule_dispatcher_golden_v1(p_release_code text default 'runtime-structural-v1.27')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare tests jsonb:='[]'::jsonb; d jsonb; p jsonb; c int; passc int;
begin
 tests:=tests||jsonb_build_array(jsonb_build_object('code','contract.release_aware','passed',(public.morphological_rule_dispatcher_contract_v1()->>'release_aware')::boolean));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','release.exact_inheritance','passed',(public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.26')->>'valid')::boolean));
 select count(*) into c from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases rel on rel.id=rr.release_id where rel.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code='runtime-structural-v1.26' and pr.rule_id=rr.rule_id);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','release.zero_child_rules','passed',c=0,'actual',c));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','composition.gammle_to_gamle','passed',public.simplify_first_double_consonant_v1('gammle')='gamle'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','composition.vakkrere_to_vakrere','passed',public.simplify_first_double_consonant_v1('vakkrere')='vakrere'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','transform.regular_comparative','passed',public.apply_morph_string_operation_v1('stor',jsonb_build_object('morph_operation','append_suffix','suffix','ere'))='storere'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','transform.final_e_deletion','passed',public.apply_morph_string_operation_v1('stille',jsonb_build_object('morph_operation','delete_final_e_then_suffix','suffix','ere'))='stillere'));
 d:=public.analyze_text_structural_shadow_v27('De er morsomme.',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','canonical.morsomme_resolved','passed',exists(select 1 from jsonb_array_elements(d#>'{document_graph,sentences,0,analysis,language_graph,morphology_v1}') x where x->>'surface'='morsomme' and x->>'status'='resolved_by_runtime_rule_evidence')));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','canonical.morsomme_sentence_model','passed',exists(select 1 from jsonb_array_elements(d#>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2,tokens}') x where x->>'surface'='morsomme' and x#>>'{morphology,status}'='resolved_by_runtime_rule_evidence')));
 d:=public.analyze_text_structural_shadow_v27('En enkle bil.',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','safety.conflict_not_overridden','passed',exists(select 1 from jsonb_array_elements(d#>'{document_graph,sentences,0,analysis,language_graph,morphology_v1}') x where x->>'surface'='enkle' and x->>'status'='conflict')));
 d:=public.analyze_text_structural_shadow_v27('Et blått hus.',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','safety.resolved_not_rewritten','passed',exists(select 1 from jsonb_array_elements(d#>'{document_graph,sentences,0,analysis,language_graph,morphology_v1}') x where x->>'surface'='blått' and x->>'status'='resolved_by_evidence')));
 p:=public.analyze_text_structural_shadow_v26('Han reiser. Han har gått.','runtime-structural-v1.26'); d:=public.analyze_text_structural_shadow_v27('Han reiser. Han har gått.',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','non_adjective.semantic_parity','passed',(p#>'{document_graph,sentences}')=(d#>'{document_graph,sentences}')));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','deterministic','passed',public.analyze_text_structural_shadow_v27('De er morsomme.',p_release_code)=public.analyze_text_structural_shadow_v27('De er morsomme.',p_release_code)));
 select count(*) into c from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.active_nrg_zero','passed',c=0,'actual',c));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_tokenizer_simple','passed',md5(pg_get_functiondef('public.tokenize_text_simple(text)'::regprocedure))='40819fa48cc6e48372cbf42275f2bb0c'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_core','passed',md5(pg_get_functiondef('public.analyze_text_structural_shadow_core_v1(text,text)'::regprocedure))='b15193a826907ea6082a1aae52f15fec'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_tokenizer_v2','passed',md5(pg_get_functiondef('public.tokenize_text_v2(text)'::regprocedure))='f76f85eee4469e74079a101da442ec52'));
 select count(*) into passc from jsonb_array_elements(tests) x where coalesce((x->>'passed')::boolean,false);
 return jsonb_build_object('version','morphological-rule-dispatcher-golden-v1','release_code',p_release_code,'tests',tests,'summary',jsonb_build_object('total',jsonb_array_length(tests),'passed',passc,'failed',jsonb_array_length(tests)-passc));
end;
$$;
