create or replace function public.build_clause_field_model_v1(p_sentence jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare c jsonb; tok jsonb; lc jsonb; models jsonb:='[]'::jsonb; blocked jsonb:='[]'::jsonb; advs jsonb; schema text; subj int; fin int; connector_before boolean; has_subjunction boolean:=false; rid_a uuid; rcode_a text; rid_adv uuid; rcode_adv text; rid_rel uuid; rcode_rel text;
begin
 select id,code into rid_a,rcode_a from public.grammar_rules where code='nrg_rt_v1.structural.schema.a.declarative_main' limit 1;
 select id,code into rid_adv,rcode_adv from public.grammar_rules where code='nrg_rt_v1.structural.sentence_adverbial.midfield' limit 1;
 select id,code into rid_rel,rcode_rel from public.grammar_rules where code='nrg_rt_v1.word_order.schema_a_b.finite_adverbial.schema_a' limit 1;

 select exists(
   select 1
   from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,sentence_model_v2,tokens}','[]'::jsonb)) jt(value)
   where exists(select 1 from jsonb_array_elements(coalesce(jt.value->'lexical_classes','[]'::jsonb)) z(value) where z.value->>'class_code'='subjunction_connector')
 ) into has_subjunction;

 for c in select value from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,clause_build_v1,clauses}','[]'::jsonb)) where value->>'status'='resolved' and value->>'clause_type'='finite'
 loop
   subj:=nullif(c->>'subject_token_index','')::int; fin:=nullif(c->>'finite_token_index','')::int; advs:='[]'::jsonb; connector_before:=false;
   for tok in select value from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,sentence_model_v2,tokens}','[]'::jsonb)) order by nullif(value->>'token_index','')::int loop
     if nullif(tok->>'token_index','')::int <= fin then
       if exists(select 1 from jsonb_array_elements(coalesce(tok->'lexical_classes','[]'::jsonb)) z(value) where z.value->>'class_code'='subjunction_connector') then connector_before:=true; end if;
     end if;
   end loop;
   if subj is not null and fin is not null and subj<fin and c->>'subject_status'='explicit' and c->>'schema_hint'='A' and not connector_before then schema:='A'; else schema:=null; end if;
   if schema='A' then
     for tok in select value from jsonb_array_elements(coalesce(p_sentence#>'{analysis,language_graph,sentence_model_v2,tokens}','[]'::jsonb)) order by nullif(value->>'token_index','')::int loop
       if nullif(tok->>'token_index','')::int > fin and exists(select 1 from jsonb_array_elements(coalesce(tok->'lexical_classes','[]'::jsonb)) z(value) where z.value->>'class_code'='sentence_adverbial') then
         advs:=advs||jsonb_build_array(jsonb_build_object('token_index',(tok->>'token_index')::int,'surface',tok->>'surface','field','midfield_adverbial','role','sentence_adverbial','rule_id',rid_adv,'rule_code',rcode_adv,'reason_code','verified_sentence_adverbial_after_finite_in_schema_a'));
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

 if has_subjunction then
   blocked:=blocked||jsonb_build_array(jsonb_build_object('status','deferred','reason_code','subordinate_clause_not_materialized','required_next_layer','Subordinate Clause Foundation V1','schema','B'));
 end if;

 return jsonb_build_object('version','clause-field-model-v1','status','ready','clause_models',models,'blocked_or_deferred',blocked,
  'summary',jsonb_build_object('schema_a_count',jsonb_array_length(models),'schema_b_count',0,'midfield_adverbial_count',(select coalesce(sum(jsonb_array_length(x.value->'midfield_adverbials')),0) from jsonb_array_elements(models) x(value)),'deferred_count',jsonb_array_length(blocked),'schema_b_status','deferred','subjunction_present',has_subjunction));
end;
$function$;
