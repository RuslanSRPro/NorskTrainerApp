create table if not exists public.grammar_runtime_multiword_facts_v1 (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.grammar_runtime_releases(id) on delete cascade,
  mwe_code text not null,
  mwe_family text not null,
  match_mode text not null check (match_mode in ('surface_sequence','lemma_plus_fixed_tail')),
  normalized_tokens text[] not null,
  first_token text not null,
  token_count integer not null check (token_count >= 2),
  head_offset integer,
  head_lemma text,
  function_class text not null,
  resolution_policy text not null,
  conditions jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '[]'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(release_id,mwe_code),
  check (cardinality(normalized_tokens)=token_count),
  check ((match_mode='surface_sequence') or (head_offset is not null and head_lemma is not null))
);
create index if not exists grammar_runtime_multiword_facts_v1_surface_idx on public.grammar_runtime_multiword_facts_v1(release_id,mwe_family,first_token,token_count) where is_enabled;
create index if not exists grammar_runtime_multiword_facts_v1_head_idx on public.grammar_runtime_multiword_facts_v1(release_id,mwe_family,head_lemma) where is_enabled and head_lemma is not null;
alter table public.grammar_runtime_multiword_facts_v1 enable row level security;
drop policy if exists grammar_runtime_multiword_facts_read on public.grammar_runtime_multiword_facts_v1;
create policy grammar_runtime_multiword_facts_read on public.grammar_runtime_multiword_facts_v1 for select to anon, authenticated using (true);
revoke insert, update, delete on public.grammar_runtime_multiword_facts_v1 from anon, authenticated;
grant select on public.grammar_runtime_multiword_facts_v1 to anon, authenticated, service_role;
grant insert, update, delete on public.grammar_runtime_multiword_facts_v1 to service_role;

create or replace function public.validate_runtime_multiword_fact_inheritance_v1(p_child_code text,p_parent_code text)
returns jsonb language sql stable security invoker set search_path='public','pg_catalog' as $$
with p as (select id from public.grammar_runtime_releases where code=p_parent_code), c as (select id from public.grammar_runtime_releases where code=p_child_code),
miss as (
 select mwe_code,mwe_family,match_mode,normalized_tokens,first_token,token_count,head_offset,head_lemma,function_class,resolution_policy,conditions,payload,provenance,is_enabled
 from public.grammar_runtime_multiword_facts_v1,p where release_id=p.id
 except
 select mwe_code,mwe_family,match_mode,normalized_tokens,first_token,token_count,head_offset,head_lemma,function_class,resolution_policy,conditions,payload,provenance,is_enabled
 from public.grammar_runtime_multiword_facts_v1,c where release_id=c.id
)
select jsonb_build_object('version','runtime-multiword-fact-inheritance-validation-v1','parent',p_parent_code,'child',p_child_code,
 'parent_count',(select count(*) from public.grammar_runtime_multiword_facts_v1,p where release_id=p.id),
 'child_count',(select count(*) from public.grammar_runtime_multiword_facts_v1,c where release_id=c.id),
 'missing_count',(select count(*) from miss),'valid',not exists(select 1 from miss));
$$;

create or replace function public.runtime_multiword_inventory_v1(p_release_code text,p_mwe_family text default null)
returns jsonb language sql stable security invoker set search_path='public','pg_catalog' as $$
select coalesce(jsonb_agg(jsonb_build_object(
 'mwe_code',f.mwe_code,'mwe_family',f.mwe_family,'match_mode',f.match_mode,'normalized_tokens',to_jsonb(f.normalized_tokens),
 'first_token',f.first_token,'token_count',f.token_count,'head_offset',f.head_offset,'head_lemma',f.head_lemma,
 'function_class',f.function_class,'resolution_policy',f.resolution_policy,'conditions',f.conditions,'payload',f.payload,'provenance',f.provenance
) order by f.mwe_family,f.mwe_code),'[]'::jsonb)
from public.grammar_runtime_multiword_facts_v1 f join public.grammar_runtime_releases r on r.id=f.release_id
where r.code=p_release_code and f.is_enabled and (p_mwe_family is null or f.mwe_family=p_mwe_family);
$$;

create or replace function public.multiword_token_surface_v1(p_analysis jsonb,p_token_index integer)
returns text language sql stable security invoker set search_path='public','pg_catalog' as $$
select lower(x->>'surface') from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) x
where nullif(x->>'token_index','')::int=p_token_index limit 1;
$$;

create or replace function public.multiword_token_lemma_v1(p_analysis jsonb,p_token_index integer)
returns text language plpgsql stable security invoker set search_path='public','pg_catalog' as $$
declare v text; n int;
begin
 select count(distinct x#>>'{surface_resolution,candidates,0,lemma}'), min(x#>>'{surface_resolution,candidates,0,lemma}')
 into n,v
 from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) x
 where nullif(x->>'token_index','')::int=p_token_index and x#>>'{surface_resolution,candidates,0,lemma}' is not null;
 if n=1 then return lower(v); end if;
 select lower(x->>'selected_lemma') into v from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb)) x
 where nullif(x->>'token_index','')::int=p_token_index and x->>'selected_lemma' is not null limit 1;
 return v;
end;
$$;

create or replace function public.multiword_clause_core_evidence_v1(p_analysis jsonb,p_after_token_index integer)
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog' as $$
declare lp jsonb:=coalesce(p_analysis#>'{language_graph,local_pos_v1}','[]'::jsonb); morph jsonb:=coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb); toks jsonb:=coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb);
 subj jsonb; fin jsonb; boundary int; sidx int; fidx int;
begin
 select coalesce(min(nullif(x->>'token_index','')::int)-1,(select max(nullif(z->>'token_index','')::int) from jsonb_array_elements(toks) z)) into boundary
 from jsonb_array_elements(toks) x where nullif(x->>'token_index','')::int>p_after_token_index and x->>'token_type'='punctuation';
 select x into subj from jsonb_array_elements(lp) x where nullif(x->>'token_index','')::int>p_after_token_index and nullif(x->>'token_index','')::int<=coalesce(boundary,2147483647)
   and x->>'selected_grammar_pos'='pronoun' order by nullif(x->>'token_index','')::int limit 1;
 sidx:=nullif(subj->>'token_index','')::int;
 if sidx is null then return jsonb_build_object('status','subject_unresolved','after_token_index',p_after_token_index,'boundary_token_index',boundary,'learner_error',false); end if;
 select x into fin from jsonb_array_elements(morph) x where nullif(x->>'token_index','')::int>sidx and nullif(x->>'token_index','')::int<=coalesce(boundary,2147483647)
   and x#>>'{selected_reading,features,VerbForm}'='Fin' order by nullif(x->>'token_index','')::int limit 1;
 fidx:=nullif(fin->>'token_index','')::int;
 if fidx is null then return jsonb_build_object('status','finite_unresolved','subject_token_index',sidx,'subject_surface',subj->>'surface','boundary_token_index',boundary,'learner_error',false); end if;
 return jsonb_build_object('status','resolved','subject_token_index',sidx,'subject_surface',subj->>'surface','finite_token_index',fidx,'finite_surface',fin->>'surface','boundary_token_index',boundary,'evidence_strength','structural','learner_error',false);
end;
$$;

create or replace function public.build_multiword_function_expression_v1(p_analysis jsonb,p_release_code text)
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog' as $$
declare v_release_id uuid; toks jsonb:=coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb); f record; st jsonb; start_idx int; j int; ok boolean; surf text; lemma text; core jsonb; item jsonb;
 resolved jsonb:='[]'::jsonb; candidates jsonb:='[]'::jsonb; blocked jsonb:='[]'::jsonb; matched int:=0; scanned int:=0;
begin
 select id into v_release_id from public.grammar_runtime_releases where code=p_release_code;
 if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
 for f in select * from public.grammar_runtime_multiword_facts_v1 where release_id=v_release_id and is_enabled order by mwe_family,mwe_code loop
   scanned:=scanned+1;
   if f.match_mode='surface_sequence' then
     for st in select x from jsonb_array_elements(toks) x where lower(x->>'surface')=f.first_token order by nullif(x->>'token_index','')::int loop
       start_idx:=nullif(st->>'token_index','')::int; ok:=true;
       for j in 1..f.token_count loop
         if public.multiword_token_surface_v1(p_analysis,start_idx+j-1) is distinct from f.normalized_tokens[j] then ok:=false; exit; end if;
       end loop;
       if not ok then continue; end if;
       matched:=matched+1;
       select string_agg(x->>'surface',' ' order by nullif(x->>'token_index','')::int) into surf from jsonb_array_elements(toks) x where nullif(x->>'token_index','')::int between start_idx and start_idx+f.token_count-1;
       core:=case when f.mwe_family='subordinate_introducer' then public.multiword_clause_core_evidence_v1(p_analysis,start_idx+f.token_count-1) else '{}'::jsonb end;
       item:=jsonb_build_object('id','mwe1:'||f.mwe_code||':'||start_idx,'mwe_code',f.mwe_code,'mwe_family',f.mwe_family,'surface',surf,'normalized_tokens',to_jsonb(f.normalized_tokens),'start_token_index',start_idx,'end_token_index',start_idx+f.token_count-1,'match_mode',f.match_mode,'sequence_identity','resolved','function_class',f.function_class,'resolution_policy',f.resolution_policy,'clause_core_evidence',core,'provenance',f.provenance,'payload',f.payload,'learner_error',false);
       if f.resolution_policy='resolve_with_finite_clause_core' and core->>'status'='resolved' then
         resolved:=resolved||jsonb_build_array(item||jsonb_build_object('status','resolved','functional_identity','resolved','reason_code','source_verified_multiword_introducer_with_finite_clause_core','confidence','high'));
       elsif f.resolution_policy='resolve_with_finite_clause_core' then
         blocked:=blocked||jsonb_build_array(item||jsonb_build_object('status','blocked','functional_identity','unresolved','reason_code','multiword_surface_matched_but_subordinate_clause_core_unresolved','required_capability','subordinate_clause_core_resolution'));
       else
         candidates:=candidates||jsonb_build_array(item||jsonb_build_object('status','candidate','functional_identity','unresolved','reason_code',case when f.resolution_policy='candidate_requires_valency_semantics' then 'source_requires_valency_and_semantic_disambiguation' else 'source_requires_structure_semantics_or_prosody_disambiguation' end,'required_capabilities',coalesce(f.conditions->'requires','[]'::jsonb)));
       end if;
     end loop;
   else
     for st in select x from jsonb_array_elements(toks) x order by nullif(x->>'token_index','')::int loop
       start_idx:=nullif(st->>'token_index','')::int; lemma:=public.multiword_token_lemma_v1(p_analysis,start_idx);
       if lemma is distinct from f.head_lemma then continue; end if;
       ok:=true;
       for j in 2..f.token_count loop
         if public.multiword_token_surface_v1(p_analysis,start_idx+j-1) is distinct from f.normalized_tokens[j] then ok:=false; exit; end if;
       end loop;
       if not ok then continue; end if;
       matched:=matched+1;
       select string_agg(x->>'surface',' ' order by nullif(x->>'token_index','')::int) into surf from jsonb_array_elements(toks) x where nullif(x->>'token_index','')::int between start_idx and start_idx+f.token_count-1;
       item:=jsonb_build_object('id','mwe1:'||f.mwe_code||':'||start_idx,'mwe_code',f.mwe_code,'mwe_family',f.mwe_family,'surface',surf,'normalized_tokens',to_jsonb(f.normalized_tokens),'start_token_index',start_idx,'end_token_index',start_idx+f.token_count-1,'match_mode',f.match_mode,'sequence_identity','resolved','head_lemma',lemma,'function_class',f.function_class,'resolution_policy',f.resolution_policy,'provenance',f.provenance,'payload',f.payload,'learner_error',false);
       candidates:=candidates||jsonb_build_array(item||jsonb_build_object('status','candidate','functional_identity','unresolved','reason_code',case when f.resolution_policy='candidate_requires_predicate_sense' then 'predicate_multiword_identity_resolved_but_source_requires_predicate_sense' else 'predicate_multiword_identity_resolved_valency_function_pending' end,'required_capability',case when f.resolution_policy='candidate_requires_predicate_sense' then 'predicate_sense_resolution' else 'predicate_frame_resolution' end));
     end loop;
   end if;
 end loop;
 return jsonb_build_object('version','multiword-function-expression-v1','status','ready','release_code',p_release_code,'scope','contiguous_mwe_v1','resolved_expressions',resolved,'candidate_expressions',candidates,'blocked_or_deferred',blocked,
   'summary',jsonb_build_object('inventory_fact_count',scanned,'matched_occurrence_count',matched,'resolved_expression_count',jsonb_array_length(resolved),'candidate_expression_count',jsonb_array_length(candidates),'blocked_or_deferred_count',jsonb_array_length(blocked),'source_graph_runtime_reads',0,'learner_error_claims',0));
end;
$$;

create or replace function public.build_subordinate_clause_foundation_v4(p_sentence jsonb,p_release_code text)
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog' as $$
declare base jsonb; a jsonb:=coalesce(p_sentence->'analysis','{}'::jsonb); mwe jsonb:=coalesce(a#>'{language_graph,multiword_function_expression_v1}','{}'::jsonb); toks jsonb:=coalesce(a#>'{language_graph,tokens}','[]'::jsonb); e jsonb; core jsonb; clauses jsonb; fields jsonb; schemas jsonb; members jsonb; surface_core text; rid_conn uuid; rcode_conn text; rid_schema uuid; rcode_schema text; sidx int; fidx int; st int; en int; fam text;
begin
 base:=public.build_subordinate_clause_foundation_v3(p_sentence,p_release_code);
 clauses:=coalesce(base->'clauses','[]'::jsonb); fields:=coalesce(base->'connector_fields','[]'::jsonb); schemas:=coalesce(base->'schema_models','[]'::jsonb);
 select id,code into rid_conn,rcode_conn from public.grammar_rules where code='nrg_rt_v1.structural.schema.b.connector_field' limit 1;
 select id,code into rid_schema,rcode_schema from public.grammar_rules where code='nrg_rt_v1.structural.schema.b.subordinate_default' limit 1;
 for e in select x from jsonb_array_elements(coalesce(mwe->'resolved_expressions','[]'::jsonb)) x where x->>'mwe_family'='subordinate_introducer' loop
   core:=e->'clause_core_evidence'; sidx:=nullif(core->>'subject_token_index','')::int; fidx:=nullif(core->>'finite_token_index','')::int; st:=nullif(e->>'start_token_index','')::int; en:=nullif(e->>'end_token_index','')::int;
   if sidx is null or fidx is null or st is null or en is null then continue; end if;
   if exists(select 1 from jsonb_array_elements(clauses) c where c->>'mwe_expression_id'=e->>'id') then continue; end if;
   fam:=e->>'function_class';
   select string_agg(x->>'surface',' ' order by nullif(x->>'token_index','')::int) into surface_core from jsonb_array_elements(toks) x where nullif(x->>'token_index','')::int between st and fidx and x->>'token_type'<>'punctuation';
   select coalesce(jsonb_agg(nullif(x->>'token_index','')::int order by nullif(x->>'token_index','')::int),'[]'::jsonb) into members from jsonb_array_elements(toks) x where nullif(x->>'token_index','')::int between st and fidx and x->>'token_type'<>'punctuation';
   fields:=fields||jsonb_build_array(jsonb_build_object('id','scf4:connector:'||st||':'||en,'status','resolved','role','connector_field','field','f','token_index',st,'end_token_index',en,'surface',e->>'surface','effective_lexical_class','multiword_subjunction_connector','classification_source','runtime_multiword_fact_v1','mwe_expression_id',e->>'id','provenance',e->'provenance','rule_id',rid_conn,'rule_code',rcode_conn,'reason_code','resolved_source_verified_multiword_connector_field'));
   schemas:=schemas||jsonb_build_array(jsonb_build_object('id','scf4:schemaB:'||st||':'||sidx||':'||fidx,'status','resolved','schema','B','slot_order',jsonb_build_array('f','a1','n','a2','v','V','N','A'),'connector_token_index',st,'connector_end_token_index',en,'subject_token_index',sidx,'finite_token_index',fidx,'rule_id',rid_schema,'rule_code',rcode_schema,'reason_code','multiword_subjunction_subordinate_schema_b'));
   clauses:=clauses||jsonb_build_array(jsonb_build_object('id','scf4:finite:'||st||':'||sidx||':'||fidx,'status','resolved','clause_type','finite','clause_form','explicit_multiword_subjunction_finite_core','surface',surface_core,'span_start',st,'span_end',fidx,'connector_token_index',st,'connector_end_token_index',en,'connector_surface',e->>'surface','connector_field','f','mwe_expression_id',e->>'id','mwe_code',e->>'mwe_code','mwe_function_class',fam,'subject_token_index',sidx,'subject_surface',core->>'subject_surface','subject_status','explicit','finite_token_index',fidx,'finite_surface',core->>'finite_surface','schema','B','schema_status','resolved_by_multiword_clause_core_evidence','member_token_indices',members,'attachment_state','subordinate_attachment_unresolved','syntactic_function','unresolved','requires_attachment_resolution',true,'provenance',jsonb_build_array(jsonb_build_object('mwe_expression_id',e->>'id','mwe_code',e->>'mwe_code','source',e->'provenance'),jsonb_build_object('rule_id',rid_schema,'rule_code',rcode_schema))));
 end loop;
 return jsonb_set(jsonb_set(jsonb_set(base,'{clauses}',clauses,true),'{connector_fields}',fields,true),'{schema_models}',schemas,true)
   || jsonb_build_object('version','subordinate-clause-foundation-v4','multiword_extension',jsonb_build_object('resolved_multiword_clause_count',(select count(*) from jsonb_array_elements(clauses) c where c->>'mwe_expression_id' is not null),'source_graph_runtime_reads',0));
end;
$$;

create or replace function public.build_subordinate_construction_recognition_v2(p_analysis jsonb,p_release_code text)
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog' as $$
declare base jsonb:=public.build_subordinate_construction_recognition_v1(p_analysis,p_release_code); mwe jsonb:=coalesce(p_analysis#>'{language_graph,multiword_function_expression_v1}','{}'::jsonb); scf jsonb:=coalesce(p_analysis#>'{language_graph,subordinate_clause_foundation_v2}','{}'::jsonb); outc jsonb:='[]'::jsonb; outh jsonb:='[]'::jsonb; c jsonb; h jsonb; e jsonb; clause jsonb; fam text;
begin
 for c in select x from jsonb_array_elements(coalesce(base->'constructions','[]'::jsonb)) x loop
   select x into clause from jsonb_array_elements(coalesce(scf->'clauses','[]'::jsonb)) x where x->>'id'=c->>'clause_id' limit 1;
   if clause->>'mwe_expression_id' is not null then
     select x into e from jsonb_array_elements(coalesce(mwe->'resolved_expressions','[]'::jsonb)) x where x->>'id'=clause->>'mwe_expression_id' limit 1;
     fam:=case e->>'function_class' when 'negative_conditional_subjunction' then 'med_mindre_conditional_adverbial_clause' when 'conditional_subjunction' then replace(e->>'mwe_code','mwe.subordinate.','')||'_conditional_adverbial_clause' else 'multiword_adverbial_clause' end;
     c:=c||jsonb_build_object('construction_family',fam,'mwe_expression_id',e->>'id','introducer',jsonb_build_object('surface',e->>'surface','marker_type','multiword_subjunction','start_token_index',e->>'start_token_index','end_token_index',e->>'end_token_index','mwe_status','resolved'),'reason_code','source_verified_multiword_introducer_with_resolved_clause_core','source_mwe',e);
   end if;
   outc:=outc||jsonb_build_array(c); clause:=null; e:=null;
 end loop;
 for h in select x from jsonb_array_elements(coalesce(base->'construction_hypotheses','[]'::jsonb)) x loop
   select x into e from jsonb_array_elements(coalesce(mwe->'candidate_expressions','[]'::jsonb)) x where nullif(x->>'start_token_index','')::int=nullif(h#>>'{introducer,start_token_index}','')::int and nullif(x->>'end_token_index','')::int=nullif(h#>>'{introducer,end_token_index}','')::int limit 1;
   if e is not null then h:=h||jsonb_build_object('mwe_expression_id',e->>'id','multiword_resolution',e); end if;
   outh:=outh||jsonb_build_array(h); e:=null;
 end loop;
 base:=jsonb_set(base,'{constructions}',outc,true); base:=jsonb_set(base,'{construction_hypotheses}',outh,true);
 return base||jsonb_build_object('version','subordinate-construction-recognition-v2','multiword_resolution_input','multiword-function-expression-v1');
end;
$$;

create or replace function public.analyze_text_structural_shadow_v36(p_text text,p_release_code text default 'runtime-structural-v1.36')
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog' as $$
declare d jsonb; out_s jsonb:='[]'::jsonb; s jsonb; a jsonb; m jsonb; mwe jsonb; scf jsonb; scr jsonb;
begin
 d:=public.analyze_text_structural_shadow_v32_morph(p_text,p_release_code);
 for s in select x from jsonb_array_elements(coalesce(d#>'{document_graph,sentences}','[]'::jsonb)) x loop
   a:=public.apply_morphological_rule_dispatcher_to_analysis_v3(coalesce(s->'analysis','{}'::jsonb),p_release_code);
   a:=public.apply_local_pos_disambiguation_v1(a);
   a:=public.apply_phrase_build_v1(a,p_release_code);
   a:=public.apply_structural_pos_refinement_v2(a,p_release_code);
   a:=public.apply_construction_recognition_v1(a,p_release_code);
   a:=public.apply_construction_resolution_v1(a,p_release_code);
   a:=public.apply_predicate_build_v1(a,p_release_code);
   a:=public.apply_clause_build_v1(a,p_release_code);
   mwe:=public.build_multiword_function_expression_v1(a,p_release_code);
   a:=jsonb_set(a,'{language_graph,multiword_function_expression_v1}',mwe,true);
   s:=jsonb_set(s,'{analysis}',a,true);
   scf:=public.build_subordinate_clause_foundation_v4(s,p_release_code);
   a:=jsonb_set(a,'{language_graph,subordinate_clause_foundation_v2}',scf,true);
   scr:=public.build_subordinate_construction_recognition_v2(a,p_release_code);
   a:=jsonb_set(a,'{language_graph,subordinate_construction_recognition_v1}',scr,true);
   a:=public.apply_clause_attachment_function_resolution_v1(a,p_release_code);
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
 d:=public.apply_rule_execution_plane_v1(d,p_release_code);
 d:=public.apply_upstream_capability_closure_v1(d);
 return d||jsonb_build_object('engine_version','grammar-structural-shadow-v36','canonical_sequence',jsonb_build_array('morphology','local_pos','phrase','structural_pos','predicate_constructions','predicate','clause_core','multiword_function_expression','subordinate_clause_foundation','subordinate_construction_recognition','clause_attachment_function','dependency','validation','interpretation','sentence_model','pedagogy'));
end;
$$;
