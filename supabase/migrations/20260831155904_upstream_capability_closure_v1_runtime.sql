create or replace function public.agreement_controller_bridge_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
 'version','agreement-controller-bridge-v1',
 'role','canonicalize already-existing structural agreement_controller evidence; no new controller inference',
 'source','language_graph.dependencies relation=agreement_controller + resolved AP/NP spans',
 'output','language_graph.agreement_controller_bridge_v1.relations',
 'authoritative_policy','only legacy structural agreement_controller edges whose adjective token is the head of a resolved AP and whose noun token is the head of a resolved NP containing that AP',
 'negative_policy','predicative AP without existing agreement_controller is not converted into attributive agreement',
 'features','selected Morphology V1 readings only',
 'non_goals',jsonb_build_array('predicative agreement','coordination agreement','long-distance agreement','new morphology selection')
);
$function$;

create or replace function public.build_agreement_controller_bridge_v1(p_sentence jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare
 d jsonb; ap jsonb; np jsonb; sm jsonb; srcm jsonb; tgtm jsonb; rels jsonb:='[]'::jsonb;
 src int; tgt int; apid text; npid text; srcf jsonb; tgtf jsonb; compatible boolean; rid uuid; rcode text;
begin
 select gr.id,gr.code into rid,rcode from public.grammar_rules gr where gr.code='nrg_rt_v1.structural.agreement_controller.attributive_np' limit 1;
 sm:=coalesce(p_sentence#>'{analysis,language_graph,sentence_model_v2}','{}'::jsonb);
 for d in select value from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,dependencies}','[]'::jsonb))
          where value->>'relation'='agreement_controller'
 loop
   src:=nullif(d->>'source_token_index','')::int; tgt:=nullif(d->>'target_token_index','')::int;
   apid:=null; npid:=null;
   select value->>'id' into apid
   from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,phrase_build_v1,resolved_phrases}','[]'::jsonb))
   where value->>'type'='AP' and nullif(value->>'head_token_index','')::int=src limit 1;
   select value->>'id' into npid
   from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,phrase_build_v1,resolved_phrases}','[]'::jsonb))
   where value->>'type'='NP' and nullif(value->>'head_token_index','')::int=tgt
     and exists(select 1 from jsonb_array_elements_text(coalesce(value->'member_token_indices','[]'::jsonb)) x where x::int=src)
   limit 1;
   if apid is null or npid is null then continue; end if;
   select value into srcm from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,morphology_v1}','[]'::jsonb)) where nullif(value->>'token_index','')::int=src limit 1;
   select value into tgtm from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,morphology_v1}','[]'::jsonb)) where nullif(value->>'token_index','')::int=tgt limit 1;
   srcf:=coalesce(srcm#>'{selected_reading,features}','{}'::jsonb); tgtf:=coalesce(tgtm#>'{selected_reading,features}','{}'::jsonb);
   compatible:=public.morph_agreement_unifies_v1(srcf,tgtf);
   rels:=rels||jsonb_build_array(jsonb_build_object(
     'id','acb1:t'||src||':t'||tgt,
     'status','resolved','relation','agreement_controller',
     'source_entity','AP','source_id',apid,'source_token_index',src,'source_surface',d->>'source_surface',
     'target_entity','NP_head','target_id',npid,'target_token_index',tgt,'target_surface',d->>'target_surface',
     'source_features',srcf,'controller_features',tgtf,'features_unify',compatible,
     'source_evidence','legacy_structural_agreement_controller','source_dependency',d,
     'rule_id',rid,'rule_code',rcode,'reason_code','existing_structural_agreement_controller_canonicalized'
   ));
 end loop;
 return jsonb_build_object('version','agreement-controller-bridge-v1','status','ready','relations',rels,
   'summary',jsonb_build_object('relation_count',jsonb_array_length(rels),'feature_unification_ready_count',(select count(*) from jsonb_array_elements(rels) x where x->>'features_unify' in ('true','false'))));
end;
$function$;

create or replace function public.clause_field_model_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
select jsonb_build_object(
 'version','clause-field-model-v1',
 'scope','bounded simple declarative Schema A only',
 'schema_a_requirements',jsonb_build_array('resolved finite Clause Build V1 clause','explicit subject','subject_token_index < finite_token_index','schema_hint=A','no connector-field token before clause core'),
 'midfield_adverbial','verified sentence_adverbial lexical-class token after finite verb in the same sentence; V1 does not extend canonical Clause Build extent',
 'schema_b_status','deferred',
 'deferred_reasons',jsonb_build_array('subordinate clause not materialized by Clause Build V1','subjunction connector coverage incomplete','connector attachment to subordinate clause absent'),
 'non_goals',jsonb_build_array('fronted declaratives','yes/no questions','subordinate Schema B','full A/B slot filling','adverbial attachment beyond sentence_adverbial lexical class')
);
$function$;

create or replace function public.build_clause_field_model_v1(p_sentence jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare c jsonb; t jsonb; lc jsonb; models jsonb:='[]'::jsonb; blocked jsonb:='[]'::jsonb; advs jsonb; schema text; subj int; fin int; connector_before boolean; rid_a uuid; rcode_a text; rid_adv uuid; rcode_adv text; rid_rel uuid; rcode_rel text;
begin
 select id,code into rid_a,rcode_a from public.grammar_rules where code='nrg_rt_v1.structural.schema.a.declarative_main' limit 1;
 select id,code into rid_adv,rcode_adv from public.grammar_rules where code='nrg_rt_v1.structural.sentence_adverbial.midfield' limit 1;
 select id,code into rid_rel,rcode_rel from public.grammar_rules where code='nrg_rt_v1.word_order.schema_a_b.finite_adverbial.schema_a' limit 1;
 for c in select value from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,clause_build_v1,clauses}','[]'::jsonb)) where value->>'status'='resolved' and value->>'clause_type'='finite'
 loop
   subj:=nullif(c->>'subject_token_index','')::int; fin:=nullif(c->>'finite_token_index','')::int; advs:='[]'::jsonb; connector_before:=false;
   for t in select value from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,sentence_model_v2,tokens}','[]'::jsonb)) order by nullif(value->>'token_index','')::int loop
     if nullif(t->>'token_index','')::int <= fin then
       if exists(select 1 from jsonb_array_elements(coalesce(t->'lexical_classes','[]'::jsonb)) z where z->>'class_code'='subjunction_connector') then connector_before:=true; end if;
     end if;
   end loop;
   if subj is not null and fin is not null and subj<fin and c->>'subject_status'='explicit' and c->>'schema_hint'='A' and not connector_before then schema:='A'; else schema:=null; end if;
   if schema='A' then
     for t in select value from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,sentence_model_v2,tokens}','[]'::jsonb)) order by nullif(value->>'token_index','')::int loop
       if nullif(t->>'token_index','')::int > fin and exists(select 1 from jsonb_array_elements(coalesce(t->'lexical_classes','[]'::jsonb)) z where z->>'class_code'='sentence_adverbial') then
         advs:=advs||jsonb_build_array(jsonb_build_object('token_index',(t->>'token_index')::int,'surface',t->>'surface','field','midfield_adverbial','role','sentence_adverbial','rule_id',rid_adv,'rule_code',rcode_adv,'reason_code','verified_sentence_adverbial_after_finite_in_schema_a'));
       end if;
     end loop;
     models:=models||jsonb_build_array(jsonb_build_object(
       'clause_id',c->>'id','status','resolved','schema','A','slot_order',jsonb_build_array('F','v','a1','n','a2','V','N','A'),
       'finite_token_index',fin,'subject_token_index',subj,'midfield_adverbials',advs,
       'schema_rule_id',rid_a,'schema_rule_code',rcode_a,'schema_reason_code','bounded_simple_declarative_schema_a',
       'relative_order',case when jsonb_array_length(advs)>0 then jsonb_build_object('branch','A','status','satisfied','finite_before_adverbial',true,'rule_id',rid_rel,'rule_code',rcode_rel) else jsonb_build_object('branch','A','status','not_applicable_no_midfield_adverbial') end
     ));
   else
     blocked:=blocked||jsonb_build_array(jsonb_build_object('clause_id',c->>'id','status','deferred','reason_code','clause_not_in_bounded_schema_a_scope','subject_token_index',subj,'finite_token_index',fin,'schema_hint',c->>'schema_hint'));
   end if;
 end loop;
 if jsonb_array_length(coalesce(p_sentence#>'{analysis,language_graph,clause_build_v1,clauses}','[]'::jsonb))=0 and exists(
   select 1 from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,sentence_model_v2,tokens}','[]'::jsonb)) t
   where exists(select 1 from jsonb_array_elements(coalesce(t->'lexical_classes','[]'::jsonb)) z where z->>'class_code'='subjunction_connector')) then
   blocked:=blocked||jsonb_build_array(jsonb_build_object('status','deferred','reason_code','subordinate_clause_not_materialized','required_next_layer','Subordinate Clause Foundation V1'));
 end if;
 return jsonb_build_object('version','clause-field-model-v1','status','ready','clause_models',models,'blocked_or_deferred',blocked,
  'summary',jsonb_build_object('schema_a_count',jsonb_array_length(models),'schema_b_count',0,'midfield_adverbial_count',(select coalesce(sum(jsonb_array_length(x->'midfield_adverbials')),0) from jsonb_array_elements(models) x),'deferred_count',jsonb_array_length(blocked),'schema_b_status','deferred'));
end;
$function$;

create or replace function public.apply_upstream_capability_closure_v1(p_doc jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare s jsonb; outa jsonb:='[]'::jsonb; ac jsonb; cf jsonb;
begin
 for s in select value from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences}','[]'::jsonb)) loop
   ac:=public.build_agreement_controller_bridge_v1(s); cf:=public.build_clause_field_model_v1(s);
   s:=jsonb_set(s,'{analysis,language_graph,agreement_controller_bridge_v1}',ac,true);
   s:=jsonb_set(s,'{analysis,language_graph,clause_field_model_v1}',cf,true);
   outa:=outa||jsonb_build_array(s);
 end loop;
 return jsonb_set(p_doc,'{document_graph,sentences}',outa,true);
end;
$function$;

create or replace function public.analyze_text_structural_shadow_v21(p_text text,p_release_code text default 'runtime-structural-v1.21')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare d jsonb;
begin
 d:=public.analyze_text_structural_shadow_v20(p_text,p_release_code);
 d:=public.apply_upstream_capability_closure_v1(d);
 return d;
end;
$function$;
