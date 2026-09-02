create or replace function public.run_morphology_composition_batch_golden_v3(p_release_code text default 'runtime-structural-v1.29')
returns jsonb language plpgsql volatile security invoker set search_path='public','pg_catalog' as $$
declare base jsonb; tests jsonb; rd jsonb; child_n int; failed_n int; passed_n int;
begin
 base:=public.run_morphology_composition_batch_golden_v2(p_release_code);
 rd:=base->'readiness';
 select count(*) into child_n from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases rel on rel.id=rr.release_id where rel.code=p_release_code and rr.metadata->>'batch'='morphology-composition-batch-v2';
 select jsonb_agg(
   case x->>'code'
    when 'release.child_rules_3' then jsonb_build_object('code','release.child_rules_3','actual',child_n,'passed',child_n=3)
    when 'readiness.activation_ready_23' then jsonb_build_object('code','readiness.activation_ready_23','actual',rd#>>'{summary,activation_ready}','passed',(rd#>>'{summary,activation_ready}')::int=23)
    when 'readiness.needs_manifest_1699' then jsonb_build_object('code','readiness.needs_manifest_1699','actual',rd#>>'{summary,needs_manifest}','passed',(rd#>>'{summary,needs_manifest}')::int=1699)
    else x end order by ord
 ) into tests
 from jsonb_array_elements(base->'tests') with ordinality t(x,ord);
 select count(*) filter(where coalesce((x->>'passed')::boolean,false)),count(*) filter(where not coalesce((x->>'passed')::boolean,false)) into passed_n,failed_n from jsonb_array_elements(tests) x;
 return (base-'tests'-'summary'-'version')||jsonb_build_object('version','morphology-composition-batch-golden-v3','tests',tests,'summary',jsonb_build_object('total',jsonb_array_length(tests),'passed',passed_n,'failed',failed_n));
end;$$;
