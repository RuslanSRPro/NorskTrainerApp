create or replace function public.materialize_clause_attachment_constraints_v1(p_release_code text)
returns jsonb language plpgsql set search_path to 'public','pg_catalog' as $$
declare
  v_release_id uuid; c record; ex text; comp text; v_lexeme_id uuid; v_match_count int; v_inserted int:=0; v_unmapped jsonb:='[]'::jsonb; v_code text; v_prov jsonb; v_subject record;
begin
  select id into v_release_id from public.grammar_runtime_releases where code=p_release_code;
  if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
  delete from public.grammar_runtime_constraint_facts_v1 where release_id=v_release_id and fact_family in ('predicate_complement_frame','clause_function_pattern');
  for c in
    select k.id,k.source_section,k.title,k.source_excerpt,k.extracted_payload,k.extracted_payload->>'candidate_code' candidate_code,k.extracted_payload->'details' details
    from public.grammar_knowledge_candidates k
    where k.status in ('source_verified','verified') and k.extracted_payload->>'candidate_code' in (
      'sentence.subordinate.explicative.nominal.function_position.object.split.class_a_all_three_complements',
      'sentence.subordinate.explicative.nominal.function_position.object.split.class_b_at_or_infinitive_not_question',
      'sentence.subordinate.explicative.nominal.function_position.object.split.class_c_at_or_question_not_infinitive',
      'sentence.subordinate.explicative.nominal.function_position.object.split.class_d_infinitive_or_question',
      'sentence.subordinate.explicative.nominal.function_position.object.split.class_e_at_only',
      'sentence.subordinate.explicative.nominal.function_position.object.split.class_f_infinitive_only',
      'sentence.subordinate.explicative.nominal.function_position.object.split.class_g_question_only')
  loop
    for ex in select jsonb_array_elements_text(coalesce(c.details->'examples','[]'::jsonb)) loop
      if ex ~ '\s' then v_unmapped:=v_unmapped||jsonb_build_array(jsonb_build_object('source_surface',ex,'candidate_code',c.candidate_code,'reason','multiword_predicate_requires_mwe_resolution')); continue; end if;
      select count(distinct q.lexeme_id),(min(q.lexeme_id::text))::uuid into v_match_count,v_lexeme_id
      from (
        select l.id lexeme_id from public.lexemes l where l.pos='verb' and lower(l.lemma)=lower(ex)
        union
        select l.id from public.lexeme_form_variants f join public.lexemes l on l.id=f.lexeme_id where l.pos='verb' and f.is_accepted is true and lower(f.value)=lower(ex)
      ) q;
      if v_match_count<>1 then v_unmapped:=v_unmapped||jsonb_build_array(jsonb_build_object('source_surface',ex,'candidate_code',c.candidate_code,'reason',case when v_match_count=0 then 'no_verified_lexeme_bridge' else 'ambiguous_lexeme_bridge' end,'match_count',v_match_count)); continue; end if;
      v_prov:=jsonb_build_array(jsonb_build_object('candidate_id',c.id,'candidate_code',c.candidate_code,'source_section',c.source_section,'title',c.title,'source_excerpt',c.source_excerpt,'verification_status','source_verified','source_surface',ex,'runtime_lexeme_id',v_lexeme_id));
      for comp in select jsonb_array_elements_text(coalesce(c.details->'complements','[]'::jsonb)) loop
        v_code:='caf1:'||c.candidate_code||':'||v_lexeme_id::text||':license:'||comp;
        insert into public.grammar_runtime_constraint_facts_v1(release_id,constraint_code,fact_family,subject_type,subject_key,relation,object_type,object_key,polarity,strength,conditions,payload,provenance)
        values(v_release_id,v_code,'predicate_complement_frame','lexeme',v_lexeme_id::text,'licenses_complement','construction_family',comp,'license','categorical',jsonb_build_object('predicate_class',c.details->>'class'),jsonb_build_object('source_surface',ex,'source_class',c.details->>'class','runtime_lemma',(select lemma from public.lexemes where id=v_lexeme_id)),v_prov)
        on conflict (release_id,constraint_code) do update set conditions=excluded.conditions,payload=excluded.payload,provenance=excluded.provenance,is_enabled=true;
        v_inserted:=v_inserted+1;
      end loop;
      if c.details ? 'excluded' then
        comp:=c.details->>'excluded'; v_code:='caf1:'||c.candidate_code||':'||v_lexeme_id::text||':exclude:'||comp;
        insert into public.grammar_runtime_constraint_facts_v1(release_id,constraint_code,fact_family,subject_type,subject_key,relation,object_type,object_key,polarity,strength,conditions,payload,provenance)
        values(v_release_id,v_code,'predicate_complement_frame','lexeme',v_lexeme_id::text,'licenses_complement','construction_family',comp,'exclude','categorical',jsonb_build_object('predicate_class',c.details->>'class'),jsonb_build_object('source_surface',ex,'source_class',c.details->>'class','runtime_lemma',(select lemma from public.lexemes where id=v_lexeme_id)),v_prov)
        on conflict (release_id,constraint_code) do update set conditions=excluded.conditions,payload=excluded.payload,provenance=excluded.provenance,is_enabled=true;
        v_inserted:=v_inserted+1;
      end if;
    end loop;
  end loop;
  for v_subject in
    select k.id,k.source_section,k.title,k.source_excerpt,k.extracted_payload->>'candidate_code' candidate_code,k.extracted_payload->'details' details
    from public.grammar_knowledge_candidates k where k.status in ('source_verified','verified') and k.extracted_payload->>'candidate_code' in (
      'sentence.subordinate.explicative.nominal.function_position.subject.reference.subject_function_inventory',
      'sentence.subordinate.explicative.nominal.function_position.subject.reference.prefield_preference')
  loop
    v_prov:=jsonb_build_array(jsonb_build_object('candidate_id',v_subject.id,'candidate_code',v_subject.candidate_code,'source_section',v_subject.source_section,'title',v_subject.title,'source_excerpt',v_subject.source_excerpt,'verification_status','source_verified'));
    if v_subject.candidate_code like '%subject_function_inventory' then
      v_code:='caf1:nominal_at_clause:license:subject';
      insert into public.grammar_runtime_constraint_facts_v1(release_id,constraint_code,fact_family,subject_type,subject_key,relation,object_type,object_key,polarity,strength,payload,provenance)
      values(v_release_id,v_code,'clause_function_pattern','construction_family','nominal_at_clause','may_function_as','syntactic_function','subject','license','categorical','{}'::jsonb,v_prov)
      on conflict (release_id,constraint_code) do update set provenance=excluded.provenance,is_enabled=true;
    else
      v_code:='caf1:nominal_at_clause:prefer:prefield_subject';
      insert into public.grammar_runtime_constraint_facts_v1(release_id,constraint_code,fact_family,subject_type,subject_key,relation,object_type,object_key,polarity,strength,payload,provenance)
      values(v_release_id,v_code,'clause_function_pattern','construction_family','nominal_at_clause','subject_position','position','prefield','prefer','strong',jsonb_build_object('source_strength','normally/default'),v_prov)
      on conflict (release_id,constraint_code) do update set provenance=excluded.provenance,payload=excluded.payload,is_enabled=true;
    end if;
    v_inserted:=v_inserted+1;
  end loop;
  return jsonb_build_object('version','clause-attachment-constraint-materialization-v1','release_code',p_release_code,'insert_attempt_count',v_inserted,'materialized_constraint_count',(select count(*) from public.grammar_runtime_constraint_facts_v1 where release_id=v_release_id and fact_family in ('predicate_complement_frame','clause_function_pattern') and is_enabled),'unmapped_source_examples',v_unmapped,'unmapped_count',jsonb_array_length(v_unmapped),'source_graph_runtime_reads',0);
end;
$$;
