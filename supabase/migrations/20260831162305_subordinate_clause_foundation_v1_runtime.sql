create or replace function public.subordinate_clause_foundation_contract_v1()
returns jsonb
language sql
stable
set search_path to 'public','pg_catalog'
as $$
select jsonb_build_object(
 'version','subordinate-clause-foundation-v1',
 'authoritative_output','document_graph.sentences[].analysis.language_graph.subordinate_clause_foundation_v1',
 'input_layers',jsonb_build_array('sentence_model_v2.tokens','phrase_build_v1.resolved_phrases','clause_build_v1.clauses','verified NRG candidate metadata'),
 'connector_policy',jsonb_build_object(
   'existing','reuse token lexical class subjunction_connector',
   'release_scoped_overlay','source-verified subordinate candidates with exact extracted_payload.details.subjunction',
   'global_lexical_class_mutation',false,
   'broad_introducer_lists','not promoted to resolved connector in v1'
 ),
 'resolved_core',jsonb_build_array('connector_field','explicit_subject','finite_verb','sentence_adverbial_midfield','schema_B_default','relative_order_B_observation'),
 'attachment_policy','subordinate attachment/function remains unresolved; no valency inference',
 'schema_policy','B is the compiled/default subordinate schema; order conflicts are observed but not promoted to learner errors because A-form overrides are not resolved in v1',
 'non_goals',jsonb_build_array('matrix attachment','syntactic function','om/wh disambiguation','omitted at','schema A subordinate override resolution','reported speech semantics','deixis','tense shift','recursive embedding'),
 'immutability','additive child layer only; parent v1.21 outputs are unchanged'
);
$$;

create or replace function public.subordinate_connector_inventory_v1()
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare items jsonb:='[]'::jsonb; r record; prov jsonb;
begin
  -- Existing manually/lexically curated class members are authoritative inputs.
  for r in
    select distinct m.normalized_lemma as connector
    from public.grammar_lexical_class_members m
    join public.grammar_lexical_classes c on c.id=m.class_id
    where c.code='subjunction_connector' and c.is_active and m.is_active and m.normalized_lemma is not null
    order by m.normalized_lemma
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'source_type','lexical_class_member','member_id',m.id,'class_id',c.id,'source',m.source,
      'pos',m.pos,'confidence',m.confidence,'evidence',m.evidence
    ) order by m.id),'[]'::jsonb)
    into prov
    from public.grammar_lexical_class_members m
    join public.grammar_lexical_classes c on c.id=m.class_id
    where c.code='subjunction_connector' and c.is_active and m.is_active and m.normalized_lemma=r.connector;
    items:=items||jsonb_build_array(jsonb_build_object(
      'connector',r.connector,'status','resolved','effective_lexical_class','subjunction_connector',
      'classification_source','existing_lexical_class','provenance',prov
    ));
  end loop;

  -- Release-scoped source overlay: only exact, source-verified details.subjunction facts.
  for r in
    select c.extracted_payload#>>'{details,subjunction}' as connector
    from public.grammar_knowledge_candidates c
    where c.status in ('verified','source_verified')
      and c.extracted_payload#>>'{semantic_block}' like 'subordinate_clause.%'
      and nullif(c.extracted_payload#>>'{details,subjunction}','') is not null
      and not exists(
        select 1 from public.grammar_lexical_class_members m
        join public.grammar_lexical_classes lc on lc.id=m.class_id
        where lc.code='subjunction_connector' and lc.is_active and m.is_active
          and m.normalized_lemma=c.extracted_payload#>>'{details,subjunction}'
      )
    group by c.extracted_payload#>>'{details,subjunction}'
    order by c.extracted_payload#>>'{details,subjunction}'
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'source_type','verified_nrg_exact_subjunction','candidate_id',c.id,
      'candidate_code',e.candidate_code,'source_section',c.source_section,'verification_status',c.status,
      'title',c.title,'semantic_block',c.extracted_payload#>>'{semantic_block}'
    ) order by c.source_section,e.candidate_code),'[]'::jsonb)
    into prov
    from public.grammar_knowledge_candidates c
    left join public.grammar_knowledge_candidate_execution_v e on e.candidate_id=c.id
    where c.status in ('verified','source_verified')
      and c.extracted_payload#>>'{semantic_block}' like 'subordinate_clause.%'
      and c.extracted_payload#>>'{details,subjunction}'=r.connector;
    items:=items||jsonb_build_array(jsonb_build_object(
      'connector',r.connector,'status','resolved','effective_lexical_class','subjunction_connector',
      'classification_source','verified_nrg_exact_subjunction_overlay','provenance',prov
    ));
  end loop;

  return jsonb_build_object(
    'version','subordinate-connector-inventory-v1','status','ready','items',items,
    'summary',jsonb_build_object(
      'resolved_connector_count',jsonb_array_length(items),
      'global_lexical_class_mutation',false,
      'broad_introducer_lists_promoted',false
    )
  );
end;
$$;

create or replace function public.subordinate_connector_match_v1(p_token jsonb)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare norm text; item jsonb; cls jsonb;
begin
 norm:=lower(coalesce(nullif(p_token->>'normalized',''),p_token->>'surface',''));
 if norm='' then return jsonb_build_object('matched',false); end if;

 select value into cls
 from jsonb_array_elements(coalesce(p_token->'lexical_classes','[]'::jsonb))
 where value->>'class_code'='subjunction_connector'
 order by coalesce((value->>'confidence')::numeric,0) desc
 limit 1;
 if cls is not null then
   return jsonb_build_object(
     'matched',true,'connector',norm,'effective_lexical_class','subjunction_connector',
     'classification_source','existing_token_lexical_class','token_class',cls
   );
 end if;

 select value into item
 from jsonb_array_elements(public.subordinate_connector_inventory_v1()->'items')
 where value->>'connector'=norm and value->>'status'='resolved'
 limit 1;
 if item is not null then
   return jsonb_build_object(
     'matched',true,'connector',norm,'effective_lexical_class','subjunction_connector',
     'classification_source',item->>'classification_source','provenance',item->'provenance'
   );
 end if;
 return jsonb_build_object('matched',false,'connector',norm);
end;
$$;

create or replace function public.build_subordinate_clause_foundation_v1(p_sentence jsonb)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare
 tokens jsonb:=coalesce(p_sentence#>'{analysis,language_graph,sentence_model_v2,tokens}','[]'::jsonb);
 phrases jsonb:=coalesce(p_sentence#>'{analysis,language_graph,phrase_build_v1,resolved_phrases}','[]'::jsonb);
 baseclauses jsonb:=coalesce(p_sentence#>'{analysis,language_graph,clause_build_v1,clauses}','[]'::jsonb);
 clauses jsonb:='[]'::jsonb; fields jsonb:='[]'::jsonb; schemas jsonb:='[]'::jsonb; deferred jsonb:='[]'::jsonb;
 tok jsonb; t2 jsonb; m jsonb; lc jsonb; conn jsonb; existing jsonb; vp jsonb;
 cidx int; sidx int; fidx int; boundary int; next_conn int; pidx int; adv_idx int; span_end int;
 ssurf text; fsurf text; csurf text; surface_core text; advs jsonb; members jsonb; ro jsonb; schema_status text;
 rid_conn uuid; rcode_conn text; rid_schema uuid; rcode_schema text; rid_adv uuid; rcode_adv text; rid_rel uuid; rcode_rel text;
 source_clause_id text; source_vp_id text; connector_count int:=0; resolved_count int:=0; deferred_count int:=0; b_count int:=0; adv_count int:=0; order_sat int:=0; order_conflict int:=0;
begin
 select id,code into rid_conn,rcode_conn from public.grammar_rules where code='nrg_rt_v1.structural.schema.b.connector_field' limit 1;
 select id,code into rid_schema,rcode_schema from public.grammar_rules where code='nrg_rt_v1.structural.schema.b.subordinate_default' limit 1;
 select id,code into rid_adv,rcode_adv from public.grammar_rules where code='nrg_rt_v1.structural.sentence_adverbial.midfield' limit 1;
 select id,code into rid_rel,rcode_rel from public.grammar_rules where code='nrg_rt_v1.word_order.schema_a_b.finite_adverbial.schema_b' limit 1;

 for tok in select value from jsonb_array_elements(tokens) order by nullif(value->>'token_index','')::int loop
   conn:=public.subordinate_connector_match_v1(tok);
   if not coalesce((conn->>'matched')::boolean,false) then continue; end if;
   connector_count:=connector_count+1;
   cidx:=nullif(tok->>'token_index','')::int;
   if cidx is null then continue; end if;

   -- Boundary is next explicit connector or punctuation, whichever comes first.
   boundary:=coalesce((select max((x->>'token_index')::int) from jsonb_array_elements(tokens) x where x->>'token_type'<>'punctuation'),cidx);
   select min((x->>'token_index')::int) into next_conn
   from jsonb_array_elements(tokens) x
   where (x->>'token_index')::int>cidx
     and coalesce((public.subordinate_connector_match_v1(x)->>'matched')::boolean,false);
   if next_conn is not null then boundary:=least(boundary,next_conn-1); end if;
   select min((x->>'token_index')::int)-1 into pidx
   from jsonb_array_elements(tokens) x
   where (x->>'token_index')::int>cidx and x->>'token_type'='punctuation';
   if pidx is not null then boundary:=least(boundary,pidx); end if;

   -- V1 explicit-subject policy: resolved subject pronoun lexical class.
   select (x->>'token_index')::int, x->>'surface' into sidx,ssurf
   from jsonb_array_elements(tokens) x
   where (x->>'token_index')::int>cidx and (x->>'token_index')::int<=boundary
     and x#>>'{pos,selected_grammar_pos}'='pronoun'
     and exists(select 1 from jsonb_array_elements(coalesce(x->'lexical_classes','[]'::jsonb)) z where z->>'class_code'='subject_pronoun')
   order by (x->>'token_index')::int limit 1;

   if sidx is null then
     deferred_count:=deferred_count+1;
     deferred:=deferred||jsonb_build_array(jsonb_build_object(
       'status','deferred','connector_token_index',cidx,'connector_surface',tok->>'surface',
       'reason_code','explicit_subject_not_resolved_in_v1','required_next_layer','Expanded Subject Foundation'
     ));
     continue;
   end if;

   -- First finite verb after the explicit subject within the bounded connector region.
   select (x->>'token_index')::int,x->>'surface' into fidx,fsurf
   from jsonb_array_elements(tokens) x
   where (x->>'token_index')::int>sidx and (x->>'token_index')::int<=boundary
     and x#>>'{pos,selected_grammar_pos}'='verb'
     and x#>>'{morphology,features,VerbForm}'='Fin'
   order by (x->>'token_index')::int limit 1;

   if fidx is null then
     deferred_count:=deferred_count+1;
     deferred:=deferred||jsonb_build_array(jsonb_build_object(
       'status','deferred','connector_token_index',cidx,'connector_surface',tok->>'surface',
       'subject_token_index',sidx,'subject_surface',ssurf,
       'reason_code','finite_predicate_not_resolved_in_connector_region'
     ));
     sidx:=null; ssurf:=null;
     continue;
   end if;

   -- Sentence adverbials in the diagnostic local window: before finite, or immediately postfinite.
   advs:='[]'::jsonb; adv_idx:=null;
   for t2 in
     select value from jsonb_array_elements(tokens)
     where (value->>'token_index')::int>sidx
       and (value->>'token_index')::int<=least(boundary,fidx+1)
     order by (value->>'token_index')::int
   loop
     if exists(select 1 from jsonb_array_elements(coalesce(t2->'lexical_classes','[]'::jsonb)) z where z->>'class_code'='sentence_adverbial') then
       adv_idx:=(t2->>'token_index')::int;
       adv_count:=adv_count+1;
       advs:=advs||jsonb_build_array(jsonb_build_object(
         'token_index',adv_idx,'surface',t2->>'surface','field','midfield_adverbial','role','sentence_adverbial',
         'rule_id',rid_adv,'rule_code',rcode_adv,'reason_code','verified_sentence_adverbial_in_subordinate_core'
       ));
     end if;
   end loop;

   if jsonb_array_length(advs)=0 then
     ro:=jsonb_build_object('branch','B','status','not_applicable_no_midfield_adverbial','rule_id',rid_rel,'rule_code',rcode_rel);
     schema_status:='default_resolved_order_indistinguishable';
   elsif exists(select 1 from jsonb_array_elements(advs) a where (a->>'token_index')::int<fidx) then
     ro:=jsonb_build_object('branch','B','status','satisfied','adverbial_before_finite',true,'rule_id',rid_rel,'rule_code',rcode_rel);
     schema_status:='resolved_by_b_order_evidence'; order_sat:=order_sat+1;
   else
     ro:=jsonb_build_object(
       'branch','B','status','observed_finite_before_adverbial','adverbial_before_finite',false,
       'rule_id',rid_rel,'rule_code',rcode_rel,
       'validation_state','unresolved_possible_schema_a_override','learner_error',false,
       'reason_code','schema_b_default_order_conflict_requires_override_resolution'
     );
     schema_status:='default_with_unresolved_order_conflict'; order_conflict:=order_conflict+1;
   end if;

   span_end:=greatest(fidx,coalesce((select max((a->>'token_index')::int) from jsonb_array_elements(advs) a),fidx));
   select string_agg(x->>'surface',' ' order by (x->>'token_index')::int) into surface_core
   from jsonb_array_elements(tokens) x
   where (x->>'token_index')::int between cidx and span_end and x->>'token_type'<>'punctuation';

   select value into existing from jsonb_array_elements(baseclauses)
   where nullif(value->>'subject_token_index','')::int=sidx and nullif(value->>'finite_token_index','')::int=fidx and value->>'status'='resolved'
   limit 1;
   source_clause_id:=existing->>'id';
   select value into vp from jsonb_array_elements(phrases)
   where value->>'type'='VP' and nullif(value->>'head_token_index','')::int=fidx and value->>'status'='resolved' limit 1;
   source_vp_id:=vp->>'id';

   members:=jsonb_build_array(cidx,sidx);
   for t2 in select value from jsonb_array_elements(advs) order by (value->>'token_index')::int loop
     members:=members||jsonb_build_array((t2->>'token_index')::int);
   end loop;
   if not members @> jsonb_build_array(fidx) then members:=members||jsonb_build_array(fidx); end if;

   csurf:=tok->>'surface';
   fields:=fields||jsonb_build_array(jsonb_build_object(
     'id','scf1:connector:'||cidx,'status','resolved','role','connector_field','field','f',
     'token_index',cidx,'surface',csurf,'effective_lexical_class','subjunction_connector',
     'classification_source',conn->>'classification_source','classification_provenance',coalesce(conn->'provenance',conn->'token_class'),
     'rule_id',rid_conn,'rule_code',rcode_conn,'reason_code','resolved_explicit_subjunction_connector_field'
   ));

   schemas:=schemas||jsonb_build_array(jsonb_build_object(
     'id','scf1:schemaB:'||cidx||':'||sidx||':'||fidx,'status',schema_status,'schema','B',
     'slot_order',jsonb_build_array('f','a1','n','a2','v','V','N','A'),
     'connector_token_index',cidx,'subject_token_index',sidx,'finite_token_index',fidx,
     'midfield_adverbials',advs,'relative_order',ro,
     'rule_id',rid_schema,'rule_code',rcode_schema,'reason_code','explicit_subjunction_subordinate_default_schema_b'
   ));

   clauses:=clauses||jsonb_build_array(jsonb_build_object(
     'id','scf1:finite:'||cidx||':'||sidx||':'||fidx,'status','resolved','clause_type','finite','clause_form','explicit_subjunction_finite_core',
     'surface',surface_core,'span_start',cidx,'span_end',span_end,
     'connector_token_index',cidx,'connector_surface',csurf,'connector_field','f',
     'subject_token_index',sidx,'subject_surface',ssurf,'subject_status','explicit',
     'finite_token_index',fidx,'finite_surface',fsurf,
     'schema','B','schema_status',schema_status,'midfield_adverbials',advs,'relative_order',ro,
     'member_token_indices',members,'source_clause_id',source_clause_id,'source_vp_id',source_vp_id,
     'attachment_state','subordinate_attachment_unresolved','syntactic_function','unresolved',
     'requires_attachment_resolution',true,
     'provenance',jsonb_build_array(
       jsonb_build_object('rule_id',rid_conn,'rule_code',rcode_conn),
       jsonb_build_object('rule_id',rid_schema,'rule_code',rcode_schema),
       jsonb_build_object('connector_classification',conn)
     )
   ));
   resolved_count:=resolved_count+1; b_count:=b_count+1;
   sidx:=null; fidx:=null; ssurf:=null; fsurf:=null; existing:=null; vp:=null;
 end loop;

 return jsonb_build_object(
   'version','subordinate-clause-foundation-v1','status','ready',
   'connector_inventory',public.subordinate_connector_inventory_v1(),
   'connector_fields',fields,'clauses',clauses,'schema_models',schemas,'blocked_or_deferred',deferred,
   'summary',jsonb_build_object(
     'connector_count',connector_count,'resolved_clause_count',resolved_count,'deferred_count',deferred_count,
     'schema_b_count',b_count,'midfield_adverbial_count',adv_count,
     'relative_order_b_satisfied_count',order_sat,'relative_order_b_conflict_unresolved_count',order_conflict,
     'attachment_resolved_count',0,'learner_error_claims',0
   )
 );
end;
$$;

create or replace function public.apply_subordinate_clause_foundation_v1(p_doc jsonb)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare s jsonb; outa jsonb:='[]'::jsonb; layer jsonb;
begin
 for s in select value from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences}','[]'::jsonb)) loop
   layer:=public.build_subordinate_clause_foundation_v1(s);
   s:=jsonb_set(s,'{analysis,language_graph,subordinate_clause_foundation_v1}',layer,true);
   outa:=outa||jsonb_build_array(s);
 end loop;
 return jsonb_set(p_doc,'{document_graph,sentences}',outa,true);
end;
$$;

create or replace function public.analyze_text_structural_shadow_v22(p_text text,p_release_code text default 'runtime-structural-v1.22')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare d jsonb;
begin
 d:=public.analyze_text_structural_shadow_v21(p_text,p_release_code);
 d:=public.apply_subordinate_clause_foundation_v1(d);
 return d;
end;
$$;

create or replace function public.assess_runtime_rule_execution_v4(p_rule_id uuid)
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare r record; base jsonb; st text; ready boolean; op text; branch text; closure text;
begin
 select gr.* into r from public.grammar_rules gr where gr.id=p_rule_id;
 if r.id is null then return jsonb_build_object('status','rule_not_found','rule_id',p_rule_id); end if;
 base:=public.assess_runtime_rule_execution_v3(p_rule_id);
 st:=base->>'execution_status'; ready:=coalesce((base->>'ready_without_runtime_code_change')::boolean,false);
 op:=coalesce(r.pattern->>'graph_operation',r.pattern->>'clause_operation'); branch:=r.pattern->>'branch_id'; closure:=base->>'upstream_closure';
 if r.pattern_type='clause_pattern' and op='assign_schema' and r.pattern->>'schema'='B' then
   st:='executable_via_subordinate_clause_foundation_v1'; ready:=true; closure:='subordinate-clause-foundation-v1';
 elsif r.pattern_type='graph_pattern' and op='assign_field' and r.pattern->>'field'='f' then
   st:='executable_via_subordinate_clause_foundation_v1'; ready:=true; closure:='subordinate-clause-foundation-v1';
 elsif r.pattern_type='relative_order' and branch='B' then
   st:='executable_via_subordinate_clause_foundation_v1'; ready:=true; closure:='subordinate-clause-foundation-v1';
 end if;
 return base||jsonb_build_object(
   'version','runtime-rule-execution-assessment-v4','execution_status',st,'upstream_blockers','[]'::jsonb,
   'ready_without_runtime_code_change',ready,'upstream_closure',closure
 );
end;
$$;

create or replace function public.audit_execution_family_closure_v4(p_release_code text default 'runtime-structural-v1.22')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare rid uuid; a jsonb; items jsonb:='[]'::jsonb; total int:=0; readyc int:=0; blocked int:=0; unsupported int:=0;
begin
 for rid in select rr.rule_id from public.grammar_runtime_releases rel join public.grammar_runtime_release_rules rr on rr.release_id=rel.id where rel.code=p_release_code and rr.is_enabled order by rr.rule_id loop
   a:=public.assess_runtime_rule_execution_v4(rid); total:=total+1;
   if coalesce((a->>'ready_without_runtime_code_change')::boolean,false) then readyc:=readyc+1;
   elsif a->>'execution_status'='registered_but_upstream_blocked' then blocked:=blocked+1; else unsupported:=unsupported+1; end if;
   items:=items||jsonb_build_array(a);
 end loop;
 return jsonb_build_object('version','execution-family-closure-audit-v4','status','audited','release_code',p_release_code,'items',items,
  'summary',jsonb_build_object('rule_count',total,'ready_without_runtime_code_change',readyc,'registered_but_blocked',blocked,'unsupported_or_unmapped',unsupported,
    'current_compiled_set_structurally_closed',total>0 and readyc=total and blocked=0 and unsupported=0,
    'bulk_activation_ready',false,'remaining_blocker',case when blocked=0 then null else 'unknown' end));
end;
$$;

create or replace function public.audit_representative_rule_suite_execution_v4(p_suite_code text default 'representative-rule-suite-v1')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare s record; a jsonb; ass jsonb; items jsonb:='[]'::jsonb; compiled int:=0; fullready int:=0; partial int:=0; blocked int:=0; sourceonly int:=0; newcap int:=0; refonly int:=0; rulecount int; readyrules int;
begin
 for s in select * from public.grammar_representative_rule_suite_v1 where suite_code=p_suite_code order by ordinal loop
   ass:='[]'::jsonb; rulecount:=0; readyrules:=0;
   for a in select public.assess_runtime_rule_execution_v4(gr.id) x from public.grammar_rule_sources gs join public.grammar_rules gr on gr.id=gs.grammar_rule_id where gs.candidate_id=s.candidate_id order by gr.code loop
      rulecount:=rulecount+1; if coalesce((a->>'ready_without_runtime_code_change')::boolean,false) then readyrules:=readyrules+1; end if; ass:=ass||jsonb_build_array(a);
   end loop;
   if rulecount>0 then
     compiled:=compiled+1;
     if readyrules=rulecount then fullready:=fullready+1; elsif readyrules>0 then partial:=partial+1; else blocked:=blocked+1; end if;
   elsif s.expected_current_state in ('source_consumed_but_not_compiled','source_consumed_partial_semantics','runtime_capability_exists_not_rule_driven','source_to_morphology_mapping_required') then sourceonly:=sourceonly+1;
   elsif s.expected_current_state='new_generic_capability_required' then newcap:=newcap+1;
   elsif s.expected_current_state='reference_or_interpretive' then refonly:=refonly+1; end if;
   items:=items||jsonb_build_array(jsonb_build_object('ordinal',s.ordinal,'chapter',s.chapter,'candidate_code',s.candidate_code,'capability_family',s.capability_family,'compiled_rule_count',rulecount,'ready_rule_count',readyrules,'execution_assessments',ass,
     'candidate_state',case when rulecount>0 and readyrules=rulecount then 'compiled_ready' when rulecount>0 and readyrules>0 then 'compiled_partially_ready_upstream_blocked' when rulecount>0 then 'compiled_upstream_blocked' else s.expected_current_state end));
 end loop;
 return jsonb_build_object('version','representative-rule-suite-execution-audit-v4','status','audited','suite_code',p_suite_code,'items',items,
  'summary',jsonb_build_object('sample_size',(select count(*) from public.grammar_representative_rule_suite_v1 where suite_code=p_suite_code),'compiled_candidates',compiled,'compiled_candidates_fully_ready',fullready,'compiled_candidates_partially_ready',partial,'compiled_candidates_fully_blocked',blocked,'runtime_or_source_without_compiled_rule',sourceonly,'new_generic_capability_required',newcap,'reference_or_interpretive',refonly,'current_compiled_sample_structurally_closed',compiled>0 and fullready=compiled and partial=0 and blocked=0,'bulk_activation_ready',false));
end;
$$;

create or replace function public.subordinate_clause_foundation_summary_v1(p_release_code text default 'runtime-structural-v1.22')
returns jsonb
language sql
stable
set search_path to 'public','pg_catalog'
as $$
select jsonb_build_object(
 'version','subordinate-clause-foundation-summary-v1','release_code',p_release_code,
 'contract',public.subordinate_clause_foundation_contract_v1(),
 'connector_inventory',public.subordinate_connector_inventory_v1(),
 'execution',public.audit_execution_family_closure_v4(p_release_code),
 'representative_suite',public.audit_representative_rule_suite_execution_v4('representative-rule-suite-v1'),
 'inheritance',public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.21'),
 'current_compiled_set_structurally_closed',(public.audit_execution_family_closure_v4(p_release_code)#>>'{summary,current_compiled_set_structurally_closed}')::boolean,
 'bulk_activation_ready',false,
 'next_layer','Rule Activation Readiness V1'
);
$$;
