do $do$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
  v_modal_lemmas jsonb;
  v_copula_lemmas jsonb;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.6';
  if not found or v_parent.status<>'shadow' then
    raise exception 'Parent runtime-structural-v1.6 must exist in shadow';
  end if;

  select coalesce(jsonb_agg(distinct lower(m.lemma) order by lower(m.lemma)),'[]'::jsonb)
  into v_modal_lemmas
  from public.grammar_lexical_classes c
  join public.grammar_lexical_class_members m on m.class_id=c.id and m.is_active
  where c.is_active and c.code='modal_verb';

  select coalesce(jsonb_agg(distinct lower(m.lemma) order by lower(m.lemma)),'[]'::jsonb)
  into v_copula_lemmas
  from public.grammar_lexical_classes c
  join public.grammar_lexical_class_members m on m.class_id=c.id and m.is_active
  where c.is_active and c.code='copula';

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values(
    'runtime-structural-v1.7',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v7',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,
    md5(coalesce(v_parent.checksum,'')||'|runtime-structural-v1.7|structural-pos-refinement-v1'),
    coalesce(v_parent.metadata,'{}'::jsonb)||jsonb_build_object(
      'purpose','Structural POS Refinement V1',
      'parent_release','runtime-structural-v1.6',
      'parent_runtime_unchanged',true,
      'child_only_rules',0,
      'rules_active',false,
      'structural_pos_refinement_contract','structural-pos-refinement-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.structural_pos_v1.refined_local_pos',
      'structural_pos_compiled_lexical_sets',jsonb_build_object('modal_verb',v_modal_lemmas,'copula',v_copula_lemmas),
      'source_candidate_codes',jsonb_build_array('verb.modal_auxiliary.bare_infinitive','verb.modal_auxiliary.core_profile'),
      'deferred_structural_families',jsonb_build_array('copular_predicative','np_article_context_hardening')
    )
  ) returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rr.rule_id,rr.manifest_id,rr.compile_role,rr.compiled_hash,rr.is_enabled,
         coalesce(rr.metadata,'{}'::jsonb)||jsonb_build_object('inherited_from','runtime-structural-v1.6')
  from public.grammar_runtime_release_rules rr
  where rr.release_id=v_parent.id;
end
$do$;;
