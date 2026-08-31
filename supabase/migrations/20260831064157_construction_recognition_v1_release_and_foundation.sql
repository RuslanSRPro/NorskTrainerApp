do $migration$
declare
  v_parent public.grammar_runtime_releases%rowtype;
  v_child_id uuid;
  v_sets jsonb;
  v_sources jsonb;
begin
  select * into v_parent from public.grammar_runtime_releases where code='runtime-structural-v1.7';
  if v_parent.id is null or v_parent.status<>'shadow' then
    raise exception 'Parent runtime-structural-v1.7 must exist in shadow';
  end if;
  if exists(select 1 from public.grammar_runtime_releases where code='runtime-structural-v1.8') then
    raise exception 'runtime-structural-v1.8 already exists';
  end if;

  select coalesce(jsonb_object_agg(code,lemmas),'{}'::jsonb) into v_sets
  from (
    select c.code,
      coalesce((select jsonb_agg(lower(m.lemma) order by lower(m.lemma)) from public.grammar_lexical_class_members m where m.class_id=c.id and m.is_active),'[]'::jsonb) lemmas
    from public.grammar_lexical_classes c
    where c.is_active and c.code in ('modal_verb','auxiliary_ha','auxiliary_bli','copula')
  ) s;

  select coalesce(jsonb_object_agg(candidate_code,snapshot),'{}'::jsonb) into v_sources
  from (
    select distinct on (extracted_payload->>'candidate_code')
      extracted_payload->>'candidate_code' candidate_code,
      jsonb_build_object(
        'candidate_id',id,'candidate_code',extracted_payload->>'candidate_code','source_section',source_section,
        'verification_status',status,'title',title
      ) snapshot
    from public.grammar_knowledge_candidates
    where status in ('verified','source_verified') and extracted_payload->>'candidate_code' in (
      'verb.infinitive.bare_after_auxiliary',
      'verb.infinitive.construction_head',
      'verb.infinitive.marker.aa',
      'verb.auxiliary.complement.nonfinite_main',
      'verb.modal_auxiliary.bare_infinitive',
      'verb.modal_auxiliary.chain',
      'verb.modal_auxiliary.chain.finiteness',
      'verb.other.modal.infinitive_relative.disambiguation',
      'sentence.predicative.subject.copula.constituent_type_eligibility'
    )
    order by extracted_payload->>'candidate_code', verified_at desc nulls last, id
  ) q;

  insert into public.grammar_runtime_releases(
    code,ir_version,compiler_version,engine_version,lexical_snapshot,external_parser_version,status,
    manifest_count,rule_count,checksum,metadata
  ) values (
    'runtime-structural-v1.8',v_parent.ir_version,v_parent.compiler_version,'grammar-structural-shadow-v8',
    v_parent.lexical_snapshot,v_parent.external_parser_version,'build',v_parent.manifest_count,v_parent.rule_count,null,
    v_parent.metadata || jsonb_build_object(
      'purpose','Construction Recognition V1',
      'parent_release','runtime-structural-v1.7',
      'next_layer','Construction Resolution V1',
      'child_only_rules',0,
      'parent_runtime_unchanged',true,
      'construction_recognition_contract','construction-recognition-v1',
      'authoritative_output','document_graph.sentences[].analysis.language_graph.construction_recognition_v1.constructions',
      'recognition_policy','materialize candidates; do not choose among overlapping readings',
      'construction_families',jsonb_build_array('modal_auxiliary_bare_infinitive','modal_auxiliary_chain','marked_infinitive','auxiliary_nonfinite_complement','copular_predicative'),
      'construction_recognition_compiled_lexical_sets',v_sets,
      'construction_recognition_compiled_sources',v_sources,
      'deferred_construction_families',jsonb_build_array('passive','modal_ellipsis_motion','infinitive_relative_resolution','nonadjacent_modal_chain_with_unknown_gap'),
      'rules_active',false
    )
  ) returning id into v_child_id;

  insert into public.grammar_runtime_release_rules(release_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata)
  select v_child_id,rule_id,manifest_id,compile_role,compiled_hash,is_enabled,metadata
  from public.grammar_runtime_release_rules where release_id=v_parent.id;

  update public.grammar_runtime_releases
  set checksum=md5('runtime-structural-v1.8|'||coalesce(v_parent.checksum,'')||'|construction-recognition-v1|'||v_sets::text||'|'||v_sources::text)
  where id=v_child_id;
end;
$migration$;

create or replace function public.construction_recognition_contract_v1()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
  'version','construction-recognition-v1',
  'input_layers',jsonb_build_array('Tokenizer V2 sentence-local tokens','morphology_v1','local_pos_v1','phrase_build_v1','structural_pos_v1','release-compiled lexical/source snapshots'),
  'authoritative_output','language_graph.construction_recognition_v1.constructions',
  'candidate_statuses',jsonb_build_array('recognized','hypothesis'),
  'families',jsonb_build_array('modal_auxiliary_bare_infinitive','modal_auxiliary_chain','marked_infinitive','auxiliary_nonfinite_complement','copular_predicative'),
  'recognition_policy',jsonb_build_array(
    'recognition materializes structurally supported construction candidates',
    'recognized means construction identity has sufficient evidence, not that semantic interpretation is resolved',
    'hypothesis preserves a structurally plausible construction when POS/lexical-role ambiguity remains',
    'overlapping constructions are retained and exposed explicitly',
    'recognition never mutates morphology, Local POS, Phrase Build, or Structural POS outputs'
  ),
  'resolution_boundary',jsonb_build_array(
    'no winner is selected among overlapping candidates',
    'no modal scope or tense/aspect interpretation is assigned',
    'copular ambiguous complement type remains unresolved',
    'bli copula-vs-auxiliary role remains a hypothesis when evidence is insufficient'
  ),
  'blocked_policy','unsupported/upstream-dependent patterns appear as blocked_events rather than false constructions',
  'non_goals',jsonb_build_array('construction resolution','passive resolution','ellipsis recovery','semantic role assignment','scope resolution','predicate build','clause build'),
  'architecture_closed_criterion','new known construction families can be added as evidence producers using compiled lexical/source snapshots and common construction objects without changing upstream layers'
);
$function$;

create or replace function public.construction_recognition_source_v1(p_release_code text,p_candidate_code text)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
select coalesce(metadata#>array['construction_recognition_compiled_sources',p_candidate_code],'{}'::jsonb)
from public.grammar_runtime_releases where code=p_release_code;
$function$;

create or replace function public.construction_recognition_token_matches_set_v1(p_token jsonb,p_release_code text,p_set_code text)
returns boolean
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
with rel as (
  select metadata from public.grammar_runtime_releases where code=p_release_code
), allowed as (
  select lower(value) lemma from rel,
  jsonb_array_elements_text(coalesce(metadata#>array['construction_recognition_compiled_lexical_sets',p_set_code],'[]'::jsonb))
), token_lemmas as (
  select distinct lower(c->>'lemma') lemma
  from jsonb_array_elements(coalesce(p_token#>'{surface_resolution,candidates}','[]'::jsonb)) c
  where nullif(c->>'lemma','') is not null
)
select exists(select 1 from token_lemmas t join allowed a using(lemma));
$function$;

create or replace function public.construction_recognition_token_has_source_pos_v1(p_token jsonb,p_pos text)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $function$
select exists(
  select 1 from jsonb_array_elements(coalesce(p_token#>'{surface_resolution,candidates}','[]'::jsonb)) c
  where lower(coalesce(c->>'source_pos',''))=lower(p_pos)
);
$function$;

create or replace function public.construction_recognition_morph_has_form_v1(p_morph jsonb,p_form text)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $function$
select exists(
  select 1 from jsonb_array_elements(coalesce(p_morph->'surviving_readings','[]'::jsonb)) r
  where r#>>'{features,VerbForm}'=p_form
) or p_morph#>>'{selected_features,VerbForm}'=p_form;
$function$;

create or replace function public.construction_recognition_morph_forms_v1(p_morph jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select coalesce(jsonb_agg(to_jsonb(form) order by form),'[]'::jsonb)
from (
  select distinct r#>>'{features,VerbForm}' form
  from jsonb_array_elements(coalesce(p_morph->'surviving_readings','[]'::jsonb)) r
  where r#>>'{features,VerbForm}' is not null
  union
  select p_morph#>>'{selected_features,VerbForm}' where p_morph#>>'{selected_features,VerbForm}' is not null
) x;
$function$;

create or replace function public.construction_recognition_refined_pos_v1(p_analysis jsonb,p_token_index integer)
returns text
language sql
immutable
security invoker
set search_path=''
as $function$
select x#>>'{refined_local_pos,selected_grammar_pos}'
from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,structural_pos_v1,token_resolutions}','[]'::jsonb)) x
where nullif(x->>'token_index','')::integer=p_token_index
limit 1;
$function$;

create or replace function public.construction_recognition_item_by_index_v1(p_array jsonb,p_token_index integer)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
select x from jsonb_array_elements(coalesce(p_array,'[]'::jsonb)) x
where nullif(x->>'token_index','')::integer=p_token_index limit 1;
$function$;

create or replace function public.construction_recognition_append_unique_v1(p_array jsonb,p_item jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path=''
as $function$
begin
  if p_item is null or jsonb_typeof(p_item)<>'object' then return coalesce(p_array,'[]'::jsonb); end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_array,'[]'::jsonb)) x where x->>'id'=p_item->>'id') then
    return coalesce(p_array,'[]'::jsonb);
  end if;
  return coalesce(p_array,'[]'::jsonb)||jsonb_build_array(p_item);
end;
$function$;;
