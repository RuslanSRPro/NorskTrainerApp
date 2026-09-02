create or replace function public.runtime_constraint_facts_v1(p_release_code text,p_fact_family text,p_subject_type text,p_subject_key text,p_relation text default null,p_object_type text default null,p_object_key text default null)
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
select coalesce(jsonb_agg(jsonb_build_object('constraint_code',f.constraint_code,'fact_family',f.fact_family,'subject_type',f.subject_type,'subject_key',f.subject_key,'relation',f.relation,'object_type',f.object_type,'object_key',f.object_key,'polarity',f.polarity,'strength',f.strength,'conditions',f.conditions,'payload',f.payload,'provenance',f.provenance) order by f.constraint_code),'[]'::jsonb)
from public.grammar_runtime_constraint_facts_v1 f join public.grammar_runtime_releases r on r.id=f.release_id
where r.code=p_release_code and f.is_enabled and f.fact_family=p_fact_family and f.subject_type=p_subject_type and f.subject_key=p_subject_key
 and (p_relation is null or f.relation=p_relation) and (p_object_type is null or f.object_type=p_object_type) and (p_object_key is null or f.object_key=p_object_key);
$$;

create or replace function public.clause_attachment_token_lexeme_v1(p_analysis jsonb,p_token_index int)
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
with tok as (
 select value t from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) where nullif(value->>'token_index','')::int=p_token_index limit 1
), c as (
 select x from tok cross join lateral jsonb_array_elements(coalesce(t->'{surface_resolution,candidates}','[]'::jsonb)) x where x->>'source_pos'='verb'
), d as (select count(*) n,min(x->>'lexeme_id') lexeme_id,min(x->>'lemma') lemma from c)
select jsonb_build_object('status',case when n=1 then 'resolved' when n=0 then 'missing' else 'ambiguous' end,'candidate_count',n,'lexeme_id',case when n=1 then lexeme_id else null end,'lemma',case when n=1 then lemma else null end) from d;
$$;

create or replace function public.predicate_complement_frame_assessment_v1(p_release_code text,p_lexeme_id uuid,p_complement_type text)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare facts jsonb; lic int; exc int; sense int;
begin
 facts:=public.runtime_constraint_facts_v1(p_release_code,'predicate_complement_frame','lexeme',p_lexeme_id::text,'licenses_complement','construction_family',p_complement_type);
 select count(*) filter(where x->>'polarity'='license'),count(*) filter(where x->>'polarity'='exclude'),count(*) filter(where coalesce(x#>'{conditions,source_requires}','[]'::jsonb) @> '["predicate_sense"]'::jsonb)
 into lic,exc,sense from jsonb_array_elements(facts) x;
 return jsonb_build_object('version','predicate-complement-frame-assessment-v1','lexeme_id',p_lexeme_id,'complement_type',p_complement_type,'license_count',lic,'exclude_count',exc,'predicate_sense_required_count',sense,'facts',facts,
   'status',case when exc>0 then 'excluded' when lic=0 then 'no_frame' when sense>0 then 'licensed_but_predicate_sense_required' else 'licensed' end);
end;
$$;

create or replace function public.build_subordinate_clause_foundation_v3(p_sentence jsonb,p_release_code text)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare s jsonb:=p_sentence; a jsonb:=coalesce(p_sentence->'analysis','{}'::jsonb); toks jsonb; tmp jsonb;
begin
 toks:=public.sentence_model_token_projection_v2(p_sentence);
 tmp:=jsonb_build_object('version','runtime-token-projection-v1','status','interim_for_clause_foundation','tokens',toks);
 a:=jsonb_set(a,'{language_graph,sentence_model_v2}',tmp,true);
 s:=jsonb_set(s,'{analysis}',a,true);
 return (public.build_subordinate_clause_foundation_v2(s,p_release_code)||jsonb_build_object('version','subordinate-clause-foundation-v3','token_input','runtime-token-projection-v1'));
end;
$$;

create or replace function public.build_clause_attachment_function_resolution_v1(p_analysis jsonb,p_release_code text)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare
 scr jsonb:=coalesce(p_analysis#>'{language_graph,subordinate_construction_recognition_v1}','{}'::jsonb); preds jsonb:=coalesce(p_analysis#>'{language_graph,predicate_build_v1,predicates}','[]'::jsonb); cls jsonb:=coalesce(p_analysis#>'{language_graph,clause_build_v1,clauses}','[]'::jsonb);
 con jsonb; hyp jsonb; mp jsonb; mc jsonb; lex jsonb; frame jsonb; cand jsonb; factsubj jsonb; pref jsonb;
 cands jsonb:='[]'::jsonb; resolved jsonb:='[]'::jsonb; pruned jsonb:='[]'::jsonb; blocked jsonb:='[]'::jsonb;
 cstart int; cend int; chead int; pidx int; pstart int; fam text; cid text; explicit_subject boolean; v_release_id uuid;
begin
 select id into v_release_id from public.grammar_runtime_releases where code=p_release_code;
 if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;

 for con in select value from jsonb_array_elements(coalesce(scr->'constructions','[]'::jsonb)) loop
   cid:=con->>'id'; fam:=con->>'construction_family'; cstart:=nullif(con#>>'{introducer,start_token_index}','')::int; cend:=coalesce(nullif(con#>>'{introducer,end_token_index}','')::int,cstart); chead:=nullif(con->>'finite_token_index','')::int;

   if fam='nominal_at_clause' then
     pruned:=pruned||jsonb_build_array(jsonb_build_object('construction_id',cid,'relation','advcl','status','pruned','constraint','construction_family.nominal_at_clause','reason_code','nominal_at_clause_is_not_adverbial_without_reanalysis','strength','hard'));
     pruned:=pruned||jsonb_build_array(jsonb_build_object('construction_id',cid,'relation','acl','status','pruned','constraint','noun_anchor_absent','reason_code','no_nominal_head_anchor_for_acl','strength','hard'));

     select value into mp from jsonb_array_elements(preds)
       where value->>'status'='resolved' and nullif(value->>'finite_token_index','')::int is not null and nullif(value->>'finite_token_index','')::int<cstart
       order by nullif(value->>'finite_token_index','')::int desc limit 1;
     if mp is not null then
       pidx:=nullif(mp->>'finite_token_index','')::int;
       select value into mc from jsonb_array_elements(cls) where value->>'status'='resolved' and nullif(value->>'finite_token_index','')::int=pidx limit 1;
       explicit_subject:=coalesce(mc->>'subject_status','')='explicit' and nullif(mc->>'subject_token_index','')::int is not null and nullif(mc->>'subject_token_index','')::int<cstart;
       lex:=public.clause_attachment_token_lexeme_v1(p_analysis,pidx);
       if lex->>'status'='resolved' then frame:=public.predicate_complement_frame_assessment_v1(p_release_code,(lex->>'lexeme_id')::uuid,'at_clause'); else frame:=jsonb_build_object('status','lexeme_'||(lex->>'status'),'facts','[]'::jsonb); end if;
       cand:=jsonb_build_object('id','caf1:ccomp:'||(mp->>'id')||':'||cid,'construction_id',cid,'relation','ccomp','syntactic_function','verb_complement','matrix_predicate_id',mp->>'id','matrix_predicate_surface',mp->>'surface','matrix_predicate_token_index',pidx,'embedded_head_token_index',chead,'predicate_lexeme',lex,'frame_assessment',frame,
         'constraints',jsonb_build_array(jsonb_build_object('type','construction_family','value','nominal_at_clause','strength','hard','passed',true),jsonb_build_object('type','matrix_predicate_precedes_clause','strength','hard','passed',true),jsonb_build_object('type','independent_matrix_subject','strength','hard','passed',explicit_subject),jsonb_build_object('type','predicate_complement_frame','strength','categorical','status',frame->>'status')));
       if frame->>'status'='licensed' and explicit_subject then
         cand:=cand||jsonb_build_object('status','resolved','reason_code','unique_source_licensed_nominal_clause_complement_after_pruning','confidence','high','learner_error',false);
         resolved:=resolved||jsonb_build_array(cand);
       elsif frame->>'status'='excluded' then
         cand:=cand||jsonb_build_object('status','pruned','reason_code','source_frame_excludes_at_clause','learner_error',false); pruned:=pruned||jsonb_build_array(cand);
       elsif frame->>'status'='licensed_but_predicate_sense_required' then
         cand:=cand||jsonb_build_object('status','blocked','reason_code','predicate_sense_required_by_source','required_capability','predicate_sense_resolution','learner_error',false); blocked:=blocked||jsonb_build_array(cand); cands:=cands||jsonb_build_array(cand);
       elsif lex->>'status'<>'resolved' then
         cand:=cand||jsonb_build_object('status','blocked','reason_code','matrix_predicate_lexeme_unresolved','required_capability','lexical_resolution','learner_error',false); blocked:=blocked||jsonb_build_array(cand); cands:=cands||jsonb_build_array(cand);
       elsif frame->>'status'='no_frame' then
         cand:=cand||jsonb_build_object('status','blocked','reason_code','no_source_verified_predicate_complement_frame','required_capability','predicate_lexicon_valency_coverage','learner_error',false); blocked:=blocked||jsonb_build_array(cand); cands:=cands||jsonb_build_array(cand);
       elsif not explicit_subject then
         cand:=cand||jsonb_build_object('status','ambiguous','reason_code','matrix_subject_not_independently_resolved','required_capability','matrix_clause_role_resolution','learner_error',false); blocked:=blocked||jsonb_build_array(cand); cands:=cands||jsonb_build_array(cand);
       else cands:=cands||jsonb_build_array(cand); end if;
     else
       blocked:=blocked||jsonb_build_array(jsonb_build_object('construction_id',cid,'relation','ccomp','status','blocked','reason_code','no_preceding_matrix_predicate_resolved','required_capability','matrix_predicate_resolution','learner_error',false));
     end if;

     if cstart=1 then
       factsubj:=public.runtime_constraint_facts_v1(p_release_code,'clause_function_pattern','construction_family','nominal_at_clause','may_function_as','syntactic_function','subject');
       pref:=public.runtime_constraint_facts_v1(p_release_code,'clause_function_pattern','construction_family','nominal_at_clause','subject_position','position','prefield');
       select value into mp from jsonb_array_elements(preds)
       where value->>'status'='resolved' and coalesce(nullif(value->>'span_start','')::int,(select min((z)::int) from jsonb_array_elements_text(coalesce(value->'member_token_indices','[]'::jsonb)) z))>coalesce(nullif(con->>'finite_token_index','')::int,cend)
       order by coalesce(nullif(value->>'span_start','')::int,9999) limit 1;
       cand:=jsonb_build_object('id','caf1:csubj:'||cid,'construction_id',cid,'relation','csubj','syntactic_function','subject','status','candidate','matrix_predicate_id',mp->>'id','matrix_predicate_surface',mp->>'surface','embedded_head_token_index',chead,'source_function_facts',factsubj,'source_position_facts',pref,'reason_code','prefield_nominal_clause_is_strong_subject_candidate_but_fronted_complement_competition_remains','required_capability','matrix_argument_competition_resolution','learner_error',false);
       cands:=cands||jsonb_build_array(cand); blocked:=blocked||jsonb_build_array(cand);
     end if;
   elsif fam like '%adverbial_clause' then
     select value into mp from jsonb_array_elements(preds) where value->>'status'='resolved' and nullif(value->>'finite_token_index','')::int is not null and nullif(value->>'finite_token_index','')::int<cstart order by nullif(value->>'finite_token_index','')::int desc limit 1;
     if mp is not null then
       cand:=jsonb_build_object('id','caf1:advcl:'||(mp->>'id')||':'||cid,'construction_id',cid,'relation','advcl','syntactic_function','adverbial','status','candidate','matrix_predicate_id',mp->>'id','matrix_predicate_surface',mp->>'surface','embedded_head_token_index',chead,'reason_code','adverbial_construction_family_supports_advcl_but_semantic_relation_unresolved','required_capability','adverbial_semantic_relation_resolution','learner_error',false);
       cands:=cands||jsonb_build_array(cand); blocked:=blocked||jsonb_build_array(cand);
     end if;
   end if;
 end loop;

 for hyp in select value from jsonb_array_elements(coalesce(scr->'construction_hypotheses','[]'::jsonb)) loop
   blocked:=blocked||jsonb_build_array(jsonb_build_object('construction_id',hyp->>'id','status','blocked','reason_code','construction_hypothesis_not_attachable','required_capability',case when hyp#>>'{introducer,mwe_status}'='unresolved' then 'multiword_function_expression_resolution' else 'subordinate_clause_core_resolution' end,'learner_error',false));
 end loop;

 return jsonb_build_object('version','clause-attachment-function-resolution-v1','status','ready','release_code',p_release_code,'constraint_contract',public.constraint_pruning_contract_v1(),'candidate_attachments',cands,'resolved_attachments',resolved,'pruned_candidates',pruned,'blocked_or_ambiguous',blocked,
   'summary',jsonb_build_object('construction_count',jsonb_array_length(coalesce(scr->'constructions','[]'::jsonb)),'generated_candidate_count',jsonb_array_length(cands)+jsonb_array_length(resolved),'resolved_attachment_count',jsonb_array_length(resolved),'pruned_candidate_count',jsonb_array_length(pruned),'blocked_or_ambiguous_count',jsonb_array_length(blocked),'learner_error_claims',0));
end;
$$;

create or replace function public.apply_clause_attachment_function_resolution_v1(p_analysis jsonb,p_release_code text)
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
select jsonb_set(p_analysis,'{language_graph,clause_attachment_function_v1}',public.build_clause_attachment_function_resolution_v1(p_analysis,p_release_code),true);
$$;

create or replace function public.analyze_text_structural_shadow_v35(p_text text,p_release_code text default 'runtime-structural-v1.35')
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare d jsonb; out_s jsonb:='[]'::jsonb; s jsonb; a jsonb; m jsonb; scf jsonb; scr jsonb;
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
   s:=jsonb_set(s,'{analysis}',a,true);
   scf:=public.build_subordinate_clause_foundation_v3(s,p_release_code);
   a:=jsonb_set(a,'{language_graph,subordinate_clause_foundation_v2}',scf,true);
   scr:=public.build_subordinate_construction_recognition_v1(a,p_release_code);
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
 return d||jsonb_build_object('engine_version','grammar-structural-shadow-v35','canonical_sequence',jsonb_build_array('morphology','local_pos','phrase','structural_pos','predicate_constructions','predicate','clause_core','subordinate_clause_foundation','subordinate_construction_recognition','clause_attachment_function','dependency','validation','interpretation','sentence_model','pedagogy'));
end;
$$;

create or replace function public.runtime_hot_path_contract_v2()
returns jsonb language sql immutable set search_path to '' as $$
select public.runtime_hot_path_contract_v1()||jsonb_build_object('version','runtime-hot-path-isolation-contract-v2','runtime_allowed_additions',jsonb_build_array('grammar_runtime_constraint_facts_v1'),'constraint_pruning_policy','Runtime may read only materialized release-scoped constraint facts; source-to-constraint projection remains build-only.');
$$;
