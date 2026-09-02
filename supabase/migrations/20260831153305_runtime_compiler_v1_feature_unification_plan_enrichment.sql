update public.grammar_runtime_compiler_plans_v1 p
set output_plan=jsonb_set(
  p.output_plan,
  '{outputs,0,pattern_enrichment}',
  jsonb_build_object('features',jsonb_build_array('Gender','Number','Definite'),'left_ref','adj.features','right_ref','controller.features'),
  true
)
from public.grammar_runtime_manifests m
where p.manifest_id=m.id
  and m.code='ir.adjective.agreement.controller_feature_copy'
  and p.compiler_contract='grammar-runtime-compiler-v1'
  and p.status='validated';
