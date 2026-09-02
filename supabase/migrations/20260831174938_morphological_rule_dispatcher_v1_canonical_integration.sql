create or replace function public.simplify_first_double_consonant_v1(p_source text)
returns text
language plpgsql
immutable
set search_path to 'public','pg_catalog'
as $$
declare i int; c text; prev text;
begin
 if p_source is null or length(p_source)<2 then return p_source; end if;
 for i in 2..length(p_source) loop
   prev:=substr(p_source,i-1,1); c:=substr(p_source,i,1);
   if c=prev and c ~ '[bcdfghjklmnpqrstvwxz]' then
     return left(p_source,i-1)||substr(p_source,i+1);
   end if;
 end loop;
 return p_source;
end;
$$;

create or replace function public.apply_morph_string_operation_v1(p_source text,p_pattern jsonb)
returns text
language plpgsql
immutable
set search_path to 'public','pg_catalog'
as $$
declare op text:=p_pattern->>'morph_operation'; suffix text:=coalesce(p_pattern->>'suffix',''); endings jsonb:=coalesce(p_pattern->'source_endings','[]'::jsonb); e text;
begin
 if p_source is null then return null; end if;
 if op='append_tt_to_final_vowel' then
   if p_source ~ '[aeiouyæøå]$' then return p_source||'tt'; end if;
 elsif op='double_final_m_then_suffix_e' then
   if right(p_source,1)='m' then return p_source||'me'; end if;
 elsif op='delete_penultimate_e_then_suffix' then
   select value#>>'{}' into e from jsonb_array_elements(endings) where p_source like '%'||(value#>>'{}') order by length(value#>>'{}') desc limit 1;
   if e is not null and length(e)=2 and substr(e,1,1)='e' then return left(p_source,length(p_source)-2)||right(e,1)||suffix; end if;
 elsif op='append_suffix' then
   return p_source||suffix;
 elsif op='delete_final_e_then_suffix' then
   if right(p_source,1)='e' then return left(p_source,length(p_source)-1)||suffix; end if;
 elsif op='simplify_first_double_consonant' then
   return public.simplify_first_double_consonant_v1(p_source);
 end if;
 return null;
end;
$$;

create or replace function public.dispatch_morphological_rules_v1(p_surface text,p_selected_lemma text,p_release_code text)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare lx jsonb; lid uuid; r record; a record; src text; tgt text; intermediate text; final_form text; items jsonb:='[]'::jsonb; matched jsonb:='[]'::jsonb; top_priority int; distinct_features int; chosen jsonb; features jsonb;
begin
 lx:=public.resolve_adjective_lexeme_for_surface_v1(p_surface,p_selected_lemma);
 lid:=nullif(lx->>'lexeme_id','')::uuid;
 if lid is null then return jsonb_build_object('version','morphological-rule-dispatcher-v1','status','no_evidence','lexeme_resolution',lx,'matches','[]'::jsonb); end if;
 for r in
   select gr.id,gr.code,gr.priority,gr.pattern
   from public.grammar_runtime_releases rel
   join public.grammar_runtime_release_rules rr on rr.release_id=rel.id and rr.is_enabled
   join public.grammar_rules gr on gr.id=rr.rule_id
   where rel.code=p_release_code and gr.pattern_type='morphological_inflection'
     and coalesce(gr.pattern->>'composition_role','primary')='primary'
   order by gr.priority desc,gr.code
 loop
   select f.value into src from public.lexeme_form_variants f where f.lexeme_id=lid and f.form_key=r.pattern->>'source_form_key' and f.verification_status='source_verified' order by f.is_primary desc nulls last,f.is_main desc nulls last,f.variant_rank nulls last,f.value limit 1;
   select f.value into tgt from public.lexeme_form_variants f where f.lexeme_id=lid and f.form_key=r.pattern->>'target_form_key' and f.verification_status='source_verified' order by f.is_primary desc nulls last,f.is_main desc nulls last,f.variant_rank nulls last,f.value limit 1;
   if src is null or tgt is null then continue; end if;
   intermediate:=public.apply_morph_string_operation_v1(src,r.pattern);
   features:=public.morph_form_key_features_v1(r.pattern->>'target_form_key');
   items:=items||jsonb_build_array(jsonb_build_object('rule_id',r.id,'rule_code',r.code,'priority',r.priority,'source_form',src,'target_form',tgt,'intermediate',intermediate));
   if intermediate=tgt and lower(tgt)=lower(p_surface) then
     matched:=matched||jsonb_build_array(jsonb_build_object('rule_id',r.id,'rule_code',r.code,'priority',r.priority,'target_form_key',r.pattern->>'target_form_key','features',features,'execution_path','direct','source_form',src,'target_form',tgt));
   elsif intermediate is not null and intermediate<>tgt and lower(tgt)=lower(p_surface) then
     for a in
       select gr.id,gr.code,gr.priority,gr.pattern
       from public.grammar_runtime_releases rel2
       join public.grammar_runtime_release_rules rr2 on rr2.release_id=rel2.id and rr2.is_enabled
       join public.grammar_rules gr on gr.id=rr2.rule_id
       where rel2.code=p_release_code and gr.pattern_type='morphological_inflection'
         and gr.pattern->>'composition_role'='post_transform_adjustment'
       order by gr.priority desc,gr.code
     loop
       final_form:=public.apply_morph_string_operation_v1(intermediate,a.pattern);
       if final_form=tgt then
         matched:=matched||jsonb_build_array(jsonb_build_object(
           'rule_id',r.id,'rule_code',r.code,'priority',greatest(r.priority,a.priority),
           'target_form_key',r.pattern->>'target_form_key','features',features,
           'execution_path','composed_two_step','source_form',src,'intermediate_form',intermediate,'target_form',tgt,
           'composition_rule_id',a.id,'composition_rule_code',a.code
         ));
       end if;
     end loop;
   end if;
 end loop;
 if jsonb_array_length(matched)=0 then return jsonb_build_object('version','morphological-rule-dispatcher-v1','status','no_match','lexeme_resolution',lx,'evaluated',items,'matches',matched); end if;
 select max((x->>'priority')::int) into top_priority from jsonb_array_elements(matched) x;
 select count(distinct coalesce(x->'features','null'::jsonb)) into distinct_features from jsonb_array_elements(matched) x where (x->>'priority')::int=top_priority;
 if distinct_features>1 then return jsonb_build_object('version','morphological-rule-dispatcher-v1','status','conflict','priority',top_priority,'lexeme_resolution',lx,'matches',matched); end if;
 select x into chosen from jsonb_array_elements(matched) x where (x->>'priority')::int=top_priority order by x->>'rule_code' limit 1;
 return jsonb_build_object('version','morphological-rule-dispatcher-v1','status','resolved','priority',top_priority,'lexeme_resolution',lx,'selected',chosen,'matches',matched,'evaluated',items);
end;
$$;

create or replace function public.apply_morphological_rule_dispatcher_to_analysis_v1(p_analysis jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare m jsonb; outm jsonb:='[]'::jsonb; d jsonb; st text; features jsonb; selected jsonb;
begin
 for m in select value from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb)) order by nullif(value->>'token_index','')::int loop
   d:=public.dispatch_morphological_rules_v1(m->>'surface',m->>'selected_lemma',p_release_code);
   m:=jsonb_set(m,'{runtime_rule_evidence,morphological_dispatcher_v1}',d,true);
   st:=m->>'status';
   if st in ('ambiguous','no_morph_reading') and d->>'status'='resolved' and d#>'{selected,features}' is not null and d#>'{selected,features}'<>'null'::jsonb then
     features:=d#>'{selected,features}';
     selected:=jsonb_build_object(
       'lemma',d#>>'{lexeme_resolution,lemma}','features',features,
       'reading_id','runtime_rule:'||(d#>>'{selected,target_form_key}'),'source_pos','adjective',
       'reading_key','runtime_rule:'||(d#>>'{selected,rule_code}'),'candidate_id',null,
       'source_form_type',d#>>'{selected,target_form_key}'
     );
     m:=m||jsonb_build_object(
       'status','resolved_by_runtime_rule_evidence','confidence','high','selected_lemma',d#>>'{lexeme_resolution,lemma}',
       'selected_reading',selected,'selected_reading_id',selected->>'reading_id','selected_source_pos','adjective',
       'selected_reading_key',selected->>'reading_key','selected_candidate_id',null,
       'surviving_readings',jsonb_build_array(selected),'surviving_count',1
     );
   end if;
   outm:=outm||jsonb_build_array(m);
 end loop;
 p_analysis:=jsonb_set(p_analysis,'{language_graph,morphology_v1}',outm,true);
 return jsonb_set(p_analysis,'{language_graph,morphological_rule_dispatcher_v1}',jsonb_build_object('version','morphological-rule-dispatcher-v1','release_code',p_release_code,'status','applied_at_canonical_morphology_stage'),true);
end;
$$;

create or replace function public.analyze_text_structural_shadow_v27(p_text text,p_release_code text default 'runtime-structural-v1.27')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare d jsonb; out_s jsonb; s jsonb; a jsonb; m jsonb;
begin
 d:=public.analyze_text_structural_shadow_v4(p_text,p_release_code);
 out_s:='[]'::jsonb;
 for s in select x from jsonb_array_elements(coalesce(d#>'{document_graph,sentences}','[]'::jsonb)) x loop
   a:=public.apply_morphological_rule_dispatcher_to_analysis_v1(coalesce(s->'analysis','{}'::jsonb),p_release_code);
   a:=public.apply_local_pos_disambiguation_v1(a);
   a:=public.apply_phrase_build_v1(a,p_release_code);
   a:=public.apply_structural_pos_refinement_v1(a,p_release_code);
   a:=public.apply_construction_recognition_v1(a,p_release_code);
   a:=public.apply_construction_resolution_v1(a,p_release_code);
   a:=public.apply_predicate_build_v1(a,p_release_code);
   a:=public.apply_clause_build_v1(a,p_release_code);
   a:=public.apply_dependency_build_v2(a,p_release_code);
   a:=public.apply_grammar_validation_v2(a,p_release_code);
   a:=public.apply_interpretation_v2(a,p_release_code);
   s:=jsonb_set(s,'{analysis}',a,true);
   m:=public.build_sentence_model_v2(s,p_release_code);
   a:=jsonb_set(a,'{language_graph,sentence_model_v2}',m,true);
   s:=jsonb_set(s,'{analysis}',a,true);
   out_s:=out_s||jsonb_build_array(s);
 end loop;
 d:=jsonb_set(d,'{document_graph,sentences}',out_s,true);
 d:=public.apply_pedagogical_projection_v1(d,p_release_code);
 d:=public.apply_rule_execution_pilot_v1(d,p_release_code);
 d:=public.apply_rule_execution_plane_v1(d,p_release_code);
 d:=public.apply_representative_rule_suite_v1(d,'representative-rule-suite-v1');
 d:=public.apply_compiler_execution_closure_v2(d,p_release_code);
 d:=public.apply_upstream_capability_closure_v1(d);
 d:=public.apply_subordinate_clause_foundation_v1(d);
 return d||jsonb_build_object('engine_version','grammar-structural-shadow-v27');
end;
$$;
