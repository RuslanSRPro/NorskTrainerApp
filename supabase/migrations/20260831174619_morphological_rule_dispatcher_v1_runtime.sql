create or replace function public.morphological_rule_dispatcher_contract_v1()
returns jsonb
language sql
stable
set search_path to 'public','pg_catalog'
as $$
select jsonb_build_object(
 'version','morphological-rule-dispatcher-v1',
 'release_aware',true,
 'rule_scope','grammar_runtime_release_rules + pattern_type=morphological_inflection',
 'global_is_active_required',false,
 'evidence_policy','observed token surface must equal source_verified target form',
 'lexeme_resolution','selected morphology lexeme first; otherwise unique source_verified lexeme_form_variant surface match',
 'priority_policy','higher grammar_rules.priority first; ties by rule code',
 'conflict_policy','multiple different resolved feature payloads at equal effective priority => conflict',
 'composition_policy',jsonb_build_object('max_steps',2,'productive_generation',false,'final_target_must_be_source_verified',true),
 'canonical_integration','runtime_rule_evidence may resolve only previously unresolved/ambiguous adjective morphology when target form key maps deterministically to morphology features',
 'non_goals',jsonb_build_array('free string generation','unknown lexeme inflection','semantic adjective agreement selection','analytic comparison constructions')
);
$$;

create or replace function public.morph_form_key_features_v1(p_form_key text)
returns jsonb
language sql
immutable
set search_path to 'public','pg_catalog'
as $$
select case p_form_key
 when 'positive_common' then jsonb_build_object('Degree','Pos','Gender','Com','Number','Sing','Definite','Ind')
 when 'positive_neuter' then jsonb_build_object('Degree','Pos','Gender','Neut','Number','Sing','Definite','Ind')
 when 'positive_plural' then jsonb_build_object('Degree','Pos','Number','Plur')
 when 'positive_definite' then jsonb_build_object('Degree','Pos','Definite','Def')
 when 'comparative' then jsonb_build_object('Degree','Cmp')
 when 'superlative' then jsonb_build_object('Degree','Sup')
 when 'superlative_definite' then jsonb_build_object('Degree','Sup','Definite','Def')
 else null end;
$$;

create or replace function public.resolve_adjective_lexeme_for_surface_v1(p_surface text,p_selected_lemma text default null)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare a jsonb; cnt int;
begin
 if p_selected_lemma is not null then
   select jsonb_build_object('lexeme_id',l.id,'lemma',l.lemma,'resolution','selected_lemma') into a
   from public.lexemes l where l.pos='adjective' and lower(l.lemma)=lower(p_selected_lemma) limit 1;
   if a is not null then return a; end if;
 end if;
 select count(distinct f.lexeme_id) into cnt
 from public.lexeme_form_variants f join public.lexemes l on l.id=f.lexeme_id
 where l.pos='adjective' and f.verification_status='source_verified' and lower(f.normalized_value)=lower(p_surface);
 if cnt=1 then
   select jsonb_build_object('lexeme_id',l.id,'lemma',l.lemma,'resolution','unique_source_verified_surface') into a
   from public.lexeme_form_variants f join public.lexemes l on l.id=f.lexeme_id
   where l.pos='adjective' and f.verification_status='source_verified' and lower(f.normalized_value)=lower(p_surface)
   order by f.is_primary desc nulls last,f.is_main desc nulls last,f.variant_rank nulls last limit 1;
   return a;
 end if;
 return jsonb_build_object('lexeme_id',null,'lemma',null,'resolution',case when cnt=0 then 'not_found' else 'ambiguous_surface' end,'candidate_count',cnt);
end;
$$;

create or replace function public.dispatch_morphological_rules_v1(p_surface text,p_selected_lemma text,p_release_code text)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare lx jsonb; lid uuid; r record; ev jsonb; items jsonb:='[]'::jsonb; matched jsonb:='[]'::jsonb; top_priority int; distinct_features int; chosen jsonb;
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
   order by gr.priority desc,gr.code
 loop
   ev:=public.execute_morphological_inflection_rule_v1(r.id,lid);
   items:=items||jsonb_build_array(jsonb_build_object('rule_id',r.id,'rule_code',r.code,'priority',r.priority,'evidence',ev));
   if ev->>'status'='matched' and lower(coalesce(ev->>'target_form',''))=lower(p_surface) then
     matched:=matched||jsonb_build_array(jsonb_build_object('rule_id',r.id,'rule_code',r.code,'priority',r.priority,'target_form_key',r.pattern->>'target_form_key','features',public.morph_form_key_features_v1(r.pattern->>'target_form_key'),'evidence',ev));
   end if;
 end loop;
 if jsonb_array_length(matched)=0 then return jsonb_build_object('version','morphological-rule-dispatcher-v1','status','no_match','lexeme_resolution',lx,'evaluated',items,'matches',matched); end if;
 select max((x->>'priority')::int) into top_priority from jsonb_array_elements(matched) x;
 select count(distinct coalesce(x->'features','null'::jsonb)) into distinct_features from jsonb_array_elements(matched) x where (x->>'priority')::int=top_priority;
 if distinct_features>1 then
   return jsonb_build_object('version','morphological-rule-dispatcher-v1','status','conflict','priority',top_priority,'lexeme_resolution',lx,'matches',matched);
 end if;
 select x into chosen from jsonb_array_elements(matched) x where (x->>'priority')::int=top_priority order by x->>'rule_code' limit 1;
 return jsonb_build_object('version','morphological-rule-dispatcher-v1','status','resolved','priority',top_priority,'lexeme_resolution',lx,'selected',chosen,'matches',matched,'evaluated',items);
end;
$$;

create or replace function public.apply_morphological_rule_dispatcher_v1(p_doc jsonb,p_release_code text)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare s jsonb; t jsonb; out_s jsonb:='[]'::jsonb; out_t jsonb; d jsonb; oldm jsonb; newm jsonb; surf text; lemma text;
begin
 for s in select value from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences}','[]'::jsonb)) loop
   out_t:='[]'::jsonb;
   for t in select value from jsonb_array_elements(coalesce(s#>'{analysis,language_graph,sentence_model_v2,tokens}','[]'::jsonb)) order by nullif(value->>'token_index','')::int loop
     surf:=t->>'surface'; oldm:=coalesce(t->'morphology','{}'::jsonb); lemma:=oldm->>'selected_lemma';
     if t#>>'{pos,selected_grammar_pos}'='adjective' then
       d:=public.dispatch_morphological_rules_v1(surf,lemma,p_release_code);
       t:=jsonb_set(t,'{runtime_rule_evidence,morphological_dispatcher_v1}',d,true);
       if oldm->>'status' in ('ambiguous','no_morph_reading') and d->>'status'='resolved' and d#>'{selected,features}' is not null and d#>'{selected,features}'<>'null'::jsonb then
         newm:=oldm||jsonb_build_object(
           'status','resolved_by_runtime_rule_evidence',
           'features',d#>'{selected,features}',
           'confidence','high',
           'selected_lemma',d#>>'{lexeme_resolution,lemma}',
           'selected_reading_id','runtime_rule:'||(d#>>'{selected,target_form_key}'),
           'selected_source_pos','adjective',
           'runtime_rule_code',d#>>'{selected,rule_code}'
         );
         t:=jsonb_set(t,'{morphology}',newm,true);
       end if;
     end if;
     out_t:=out_t||jsonb_build_array(t);
   end loop;
   s:=jsonb_set(s,'{analysis,language_graph,sentence_model_v2,tokens}',out_t,true);
   s:=jsonb_set(s,'{analysis,language_graph,morphological_rule_dispatcher_v1}',jsonb_build_object('version','morphological-rule-dispatcher-v1','release_code',p_release_code,'status','applied'),true);
   out_s:=out_s||jsonb_build_array(s);
 end loop;
 return jsonb_set(p_doc,'{document_graph,sentences}',out_s,true);
end;
$$;

create or replace function public.analyze_text_structural_shadow_v27(p_text text,p_release_code text default 'runtime-structural-v1.27')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare d jsonb;
begin
 d:=public.analyze_text_structural_shadow_v23(p_text,p_release_code);
 d:=public.apply_subordinate_clause_foundation_v1(d);
 d:=public.apply_morphological_rule_dispatcher_v1(d,p_release_code);
 return d;
end;
$$;
