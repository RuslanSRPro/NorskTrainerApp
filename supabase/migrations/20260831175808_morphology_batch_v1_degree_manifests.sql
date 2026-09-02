with specs(candidate_code,manifest_code,target_form_key,morph_operation,suffix,source_endings) as (
 values
 ('adjective.degree.suffix.regular_endings','ir.adjective.degree.suffix.regular_endings.comparative','comparative','append_suffix','ere','[]'::jsonb),
 ('adjective.degree.suffix.regular_endings','ir.adjective.degree.suffix.regular_endings.superlative','superlative','append_suffix','est','[]'::jsonb),
 ('adjective.degree.suffix.el_en_er_vowel_deletion','ir.adjective.degree.suffix.el_en_er_vowel_deletion.comparative','comparative','delete_penultimate_e_then_suffix','ere','["el","en","er"]'::jsonb),
 ('adjective.degree.suffix.el_en_er_vowel_deletion','ir.adjective.degree.suffix.el_en_er_vowel_deletion.superlative','superlative','delete_penultimate_e_then_suffix','est','["el","en","er"]'::jsonb),
 ('adjective.degree.suffix.unstressed_e_deletion','ir.adjective.degree.suffix.unstressed_e_deletion.comparative','comparative','delete_final_e_then_suffix','ere','[]'::jsonb),
 ('adjective.degree.suffix.unstressed_e_deletion','ir.adjective.degree.suffix.unstressed_e_deletion.superlative','superlative','delete_final_e_then_suffix','est','[]'::jsonb)
), src as (
 select s.*,e.candidate_id,k.topic_id
 from specs s join public.grammar_knowledge_candidate_execution_v e on e.candidate_code=s.candidate_code
 join public.grammar_knowledge_candidates k on k.id=e.candidate_id
)
insert into public.grammar_runtime_manifests(
 code,primary_candidate_id,topic_id,ir_version,runtime_family,execution_phase,execution_mode,capabilities,constraint_strength,diagnostic_policy,language_scope,dependencies,bindings,condition,actions,generation,explanation,compiler,ir_spec,authoring_status,validation_notes,validated_at,validated_by
)
select manifest_code,candidate_id,topic_id,'1.0','morphology','morphological_disambiguation','deterministic',array['recognize','validate','explain']::text[],
 'default_with_lexical_exceptions','none',jsonb_build_object('written_standards',jsonb_build_array('nb')),
 jsonb_build_object('required_evidence',jsonb_build_array('source_verified_lexeme_form_pair')),'{}'::jsonb,
 jsonb_build_object('op','exists','left',jsonb_build_object('ref','lexeme.id')),'[]'::jsonb,
 jsonb_build_object('enabled',false,'strategy','attested_pair_only'),
 jsonb_build_object('teacher_role','adjective_degree_inflector','productive_generation',false),
 jsonb_build_object('strategy','single_rule','target_rule_types',jsonb_build_array('morphological_inflection')),
 jsonb_strip_nulls(jsonb_build_object(
  'code',manifest_code,'ir_version','1.0','runtime',jsonb_build_object('phase','morphological_disambiguation','family','morphology'),
  'compiler',jsonb_build_object('strategy','single_rule','target_rule_types',jsonb_build_array('morphological_inflection')),
  'source_form_key','positive_common','target_form_key',target_form_key,'morph_operation',morph_operation,'suffix',suffix,
  'source_endings',case when jsonb_array_length(source_endings)>0 then source_endings else null end,'actions','[]'::jsonb
 )),
 'validated','Morphology Batch Materialization V1; dispatcher-compatible attested form pair rule instance.',now(),'morphology-batch-v1'
from src
on conflict (code) do nothing;

insert into public.grammar_runtime_manifest_sources(manifest_id,candidate_id,source_role,notes)
select m.id,m.primary_candidate_id,'primary','Degree inflection source provenance for Morphology Batch Materialization V1.'
from public.grammar_runtime_manifests m
where m.code like 'ir.adjective.degree.suffix.%' and m.validated_by='morphology-batch-v1'
on conflict do nothing;
