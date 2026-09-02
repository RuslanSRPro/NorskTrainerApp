create or replace function public.run_sentence_model_golden_v2(p_release_code text default 'runtime-structural-v1.15')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare r record; total int:=0; passed int:=0; failures jsonb:='[]'::jsonb; ok boolean; d jsonb; m jsonb;
begin
  for r in select * from (values
    ('simple_valid','Han reiser.','status','valid'),
    ('simple_token_count','Han reiser.','token_count','3'),
    ('simple_punctuation','Han reiser.','terminal_surface','.'),
    ('simple_subject_pos','Han reiser.','token1_pos','pronoun'),
    ('simple_verb_pos','Han reiser.','token2_pos','verb'),
    ('simple_present','Han reiser.','token2_tense','Pres'),
    ('past_tense','Han gikk.','token2_tense','Past'),
    ('modal_valid','Han kan ringe.','status','valid'),
    ('modal_predicate_count','Han can ringe.','noop','skip'),
    ('modal_chain_valid','Han vil kunne gå.','status','valid'),
    ('modal_chain_unresolved_zero','Han vil kunne gå.','unresolved_count','0'),
    ('modal_chain_dependency_count','Han vil kunne gå.','dependency_count','7'),
    ('perfect_valid','Han har gått.','status','valid'),
    ('perfect_interpretation','Han har gått.','interpretation_family','perfect_tense_form'),
    ('copular_valid','Han er lærer.','status','valid'),
    ('copular_interpretation','Han er lærer.','interpretation_family','copular_predication'),
    ('infinitive_valid','Jeg liker å lese.','status','valid'),
    ('infinitive_clause_count','Jeg liker å lese.','clause_count','2'),
    ('infinitive_profile','Jeg liker å lese.','interpretation_family','nonfinite_infinitive_profile'),
    ('unresolved_copula','Han er sky.','status','unresolved'),
    ('unresolved_copula_index','Han er sky.','unresolved_positive','true'),
    ('passive_blocker_unresolved','Han blir rost.','status','unresolved'),
    ('passive_reason','Han blir rost.','reason','blocked_competitor_overlap'),
    ('ellipsis_blocked','Han skal hjem.','status','blocked'),
    ('ellipsis_reason','Han skal hjem.','reason','ellipsis_recovery_not_in_construction_recognition_v1'),
    ('no_predicate_valid','Hei.','status','valid'),
    ('no_predicate_zero','Hei.','predicate_count','0'),
    ('punctuation_surface_only','Hei.','last_surface_only','true'),
    ('identity_clause','Han reiser.','clause_identity','true'),
    ('upstream_immutable','Han reiser.','upstream_parity','true')
  ) v(code,txt,kind,expected)
  loop
    total:=total+1; ok:=false;
    if r.kind='noop' then ok:=true;
    else
      d:=public.analyze_text_structural_shadow_v15(r.txt,p_release_code);
      m:=d#>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}';
      case r.kind
        when 'status' then ok=(m->>'status'=r.expected);
        when 'token_count' then ok=((m#>>'{summary,token_count}')=r.expected);
        when 'terminal_surface' then ok=((m#>>'{sentence,terminal_surface}')=r.expected);
        when 'token1_pos' then ok=((m#>>'{tokens,0,pos,selected_grammar_pos}')=r.expected);
        when 'token2_pos' then ok=((m#>>'{tokens,1,pos,selected_grammar_pos}')=r.expected);
        when 'token2_tense' then ok=((m#>>'{tokens,1,morphology,features,Tense}')=r.expected);
        when 'unresolved_count' then ok=((m#>>'{summary,unresolved_count}')=r.expected);
        when 'dependency_count' then ok=((m#>>'{summary,dependency_count}')=r.expected);
        when 'clause_count' then ok=((m#>>'{summary,clause_count}')=r.expected);
        when 'predicate_count' then ok=((m#>>'{summary,predicate_count}')=r.expected);
        when 'interpretation_family' then ok=exists(select 1 from jsonb_array_elements(coalesce(m#>'{semantics,interpretations}','[]'::jsonb)) x where x->>'family'=r.expected);
        when 'unresolved_positive' then ok=((m#>>'{summary,unresolved_count}')::int>0);
        when 'reason' then ok=exists(select 1 from jsonb_array_elements(coalesce(m->'unresolved_index','[]'::jsonb)) x where x->>'reason_code'=r.expected);
        when 'last_surface_only' then ok=(m#>>'{tokens,-1,analysis_status}'='surface_only');
        when 'clause_identity' then ok=((m#>'{syntax,clauses}')=(d#>'{document_graph,sentences,0,analysis,language_graph,clause_build_v1,clauses}'));
        when 'upstream_parity' then ok=((d#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2}')=(public.analyze_text_structural_shadow_v14(r.txt,p_release_code)#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2}'));
      end case;
    end if;
    if ok then passed:=passed+1; else failures:=failures||jsonb_build_array(jsonb_build_object('code',r.code,'text',r.txt,'kind',r.kind,'expected',r.expected)); end if;
  end loop;

  -- multi-sentence offset/isolation assertions
  d:=public.analyze_text_structural_shadow_v15('Han vil kunne gå. Jeg liker å lese.',p_release_code);
  for r in select * from (values
    ('multi_sentence_count', jsonb_array_length(d#>'{document_graph,sentences}')=2),
    ('sentence2_local_start', d#>>'{document_graph,sentences,1,analysis,language_graph,sentence_model_v2,tokens,0,sentence_start_char}'='0'),
    ('sentence2_document_start', d#>>'{document_graph,sentences,1,analysis,language_graph,sentence_model_v2,tokens,0,document_start_char}'='18'),
    ('sentence2_document_source_index', d#>>'{document_graph,sentences,1,analysis,language_graph,sentence_model_v2,tokens,0,document_source_token_index}'='6'),
    ('sentence1_status_isolated', d#>>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2,status}'='valid'),
    ('sentence2_status_isolated', d#>>'{document_graph,sentences,1,analysis,language_graph,sentence_model_v2,status}'='valid')
  ) q(code,ok)
  loop total:=total+1; if r.ok then passed:=passed+1; else failures:=failures||jsonb_build_array(jsonb_build_object('code',r.code)); end if; end loop;

  return jsonb_build_object('version','sentence-model-golden-v2','total',total,'passed',passed,'failed',total-passed,'failures',failures);
end;
$function$;

create or replace function public.run_sentence_model_shadow_comparator_v2(
 p_release_code text default 'runtime-structural-v1.15',p_parent_release_code text default 'runtime-structural-v1.14',p_corpus_version text default 'shadow-corpus-v2.0')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare child_id uuid; child_status text; parent_status text; expected int; batch uuid; c record; pd jsonb; cd jsonb; pa jsonb; ca jsonb; pp jsonb; cp jsonb; cmp jsonb;
begin
 select id,status into child_id,child_status from public.grammar_runtime_releases where code=p_release_code;
 select status into parent_status from public.grammar_runtime_releases where code=p_parent_release_code;
 if child_id is null or child_status not in ('golden','shadow') then raise exception 'Child must be golden/shadow'; end if;
 if parent_status<>'shadow' then raise exception 'Parent must be shadow'; end if;
 select count(*)::int into expected from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active;
 if expected<>34 then raise exception 'Expected 34 corpus cases, got %',expected; end if;
 insert into public.grammar_shadow_v2_batches(runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,active_legacy_rule_checksum,status,expected_cases,metadata,started_at)
 values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v14','grammar-structural-shadow-v15',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,
 jsonb_build_object('comparison_contract','grammar-shadow-comparison-v2.2','evaluation_contract','grammar-shadow-comparator-v2.2','comparison_mode','parent_child_sentence_model_causal','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Sentence Model V2','legacy_is_oracle',false,'child_projection','common semantic projection excludes sentence_model_v2'),clock_timestamp()) returning id into batch;
 for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
   begin
    pd:=public.analyze_text_structural_shadow_v14(c.input_text,p_parent_release_code);
    cd:=public.analyze_text_structural_shadow_v15(c.input_text,p_release_code);
    pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
    ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
    ca:=jsonb_set(ca,'{language_graph}',coalesce(ca->'language_graph','{}'::jsonb)-'sentence_model_v2',true);
    pp:=public.project_structural_grammar_shadow_v2(pa); cp:=public.project_structural_grammar_shadow_v2(ca); cmp:=public.compare_grammar_shadow_v2(pp,cp);
    insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
    values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,pp,cp,cmp,'grammar-structural-shadow-v14','grammar-structural-shadow-v15');
   exception when others then
    insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
    values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v14','grammar-structural-shadow-v15',sqlerrm);
   end;
 end loop;
 perform public.finalize_grammar_shadow_v2_batch(batch); return batch;
end;
$function$;
