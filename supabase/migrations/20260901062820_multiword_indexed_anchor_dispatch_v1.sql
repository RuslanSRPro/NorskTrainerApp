drop index if exists public.grammar_runtime_multiword_facts_v1_surface_idx;
drop index if exists public.grammar_runtime_multiword_facts_v1_head_idx;
create index grammar_runtime_multiword_facts_v1_surface_idx
  on public.grammar_runtime_multiword_facts_v1(release_id,match_mode,first_token,token_count)
  where is_enabled;
create index grammar_runtime_multiword_facts_v1_head_idx
  on public.grammar_runtime_multiword_facts_v1(release_id,match_mode,head_lemma,token_count)
  where is_enabled and head_lemma is not null;

create or replace function public.runtime_multiword_candidate_facts_v1(p_analysis jsonb,p_release_code text)
returns setof public.grammar_runtime_multiword_facts_v1
language sql stable security invoker set search_path='public','pg_catalog' as $$
with r as (
  select id from public.grammar_runtime_releases where code=p_release_code
), surfaces as (
  select distinct lower(t->>'surface') as anchor
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) t
  where t->>'token_type'='word' and t->>'surface' is not null
), verb_token_indices as (
  select distinct nullif(x->>'token_index','')::int as token_index
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,local_pos_v1}','[]'::jsonb)) x
  where x->>'selected_grammar_pos'='verb'
), verb_lemmas as (
  select distinct lower(m->>'selected_lemma') as lemma
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb)) m
  where m->>'selected_lemma' is not null
    and (m#>>'{selected_reading,source_pos}'='verb' or m#>>'{selected_reading,features,VerbForm}' is not null)
  union
  select distinct lower(c->>'lemma')
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) t
  join verb_token_indices v on v.token_index=nullif(t->>'token_index','')::int
  cross join lateral jsonb_array_elements(coalesce(t#>'{surface_resolution,candidates}','[]'::jsonb)) c
  where c->>'source_pos'='verb' and c->>'lemma' is not null
)
select f.*
from r
join surfaces s on true
join public.grammar_runtime_multiword_facts_v1 f
  on f.release_id=r.id and f.match_mode='surface_sequence' and f.first_token=s.anchor and f.is_enabled
union all
select f.*
from r
join verb_lemmas v on true
join public.grammar_runtime_multiword_facts_v1 f
  on f.release_id=r.id and f.match_mode='lemma_plus_fixed_tail' and f.head_lemma=v.lemma and f.is_enabled;
$$;

create or replace function public.build_multiword_function_expression_v1(p_analysis jsonb,p_release_code text)
returns jsonb language plpgsql stable security invoker set search_path='public','pg_catalog' as $$
declare v_release_id uuid; toks jsonb:=coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb); f record; st jsonb; start_idx int; j int; ok boolean; surf text; lemma text; core jsonb; item jsonb;
 resolved jsonb:='[]'::jsonb; candidates jsonb:='[]'::jsonb; blocked jsonb:='[]'::jsonb; matched int:=0; scanned int:=0;
begin
 select id into v_release_id from public.grammar_runtime_releases where code=p_release_code;
 if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
 for f in select * from public.runtime_multiword_candidate_facts_v1(p_analysis,p_release_code) order by mwe_family,mwe_code loop
   scanned:=scanned+1;
   if f.match_mode='surface_sequence' then
     for st in select x from jsonb_array_elements(toks) x where lower(x->>'surface')=f.first_token order by nullif(x->>'token_index','')::int loop
       start_idx:=nullif(st->>'token_index','')::int; ok:=true;
       for j in 1..f.token_count loop if public.multiword_token_surface_v1(p_analysis,start_idx+j-1) is distinct from f.normalized_tokens[j] then ok:=false; exit; end if; end loop;
       if not ok then continue; end if;
       matched:=matched+1;
       select string_agg(x->>'surface',' ' order by nullif(x->>'token_index','')::int) into surf from jsonb_array_elements(toks) x where nullif(x->>'token_index','')::int between start_idx and start_idx+f.token_count-1;
       core:=case when f.mwe_family='subordinate_introducer' then public.multiword_clause_core_evidence_v1(p_analysis,start_idx+f.token_count-1) else '{}'::jsonb end;
       item:=jsonb_build_object('id','mwe1:'||f.mwe_code||':'||start_idx,'mwe_code',f.mwe_code,'mwe_family',f.mwe_family,'surface',surf,'normalized_tokens',to_jsonb(f.normalized_tokens),'start_token_index',start_idx,'end_token_index',start_idx+f.token_count-1,'match_mode',f.match_mode,'sequence_identity','resolved','function_class',f.function_class,'resolution_policy',f.resolution_policy,'clause_core_evidence',core,'provenance',f.provenance,'payload',f.payload,'learner_error',false);
       if f.resolution_policy='resolve_with_finite_clause_core' and core->>'status'='resolved' then resolved:=resolved||jsonb_build_array(item||jsonb_build_object('status','resolved','functional_identity','resolved','reason_code','source_verified_multiword_introducer_with_finite_clause_core','confidence','high'));
       elsif f.resolution_policy='resolve_with_finite_clause_core' then blocked:=blocked||jsonb_build_array(item||jsonb_build_object('status','blocked','functional_identity','unresolved','reason_code','multiword_surface_matched_but_subordinate_clause_core_unresolved','required_capability','subordinate_clause_core_resolution'));
       else candidates:=candidates||jsonb_build_array(item||jsonb_build_object('status','candidate','functional_identity','unresolved','reason_code',case when f.resolution_policy='candidate_requires_valency_semantics' then 'source_requires_valency_and_semantic_disambiguation' else 'source_requires_structure_semantics_or_prosody_disambiguation' end,'required_capabilities',coalesce(f.conditions->'requires','[]'::jsonb)));
       end if;
     end loop;
   else
     for st in select x from jsonb_array_elements(toks) x order by nullif(x->>'token_index','')::int loop
       start_idx:=nullif(st->>'token_index','')::int;
       if not public.multiword_head_lemma_matches_v1(p_analysis,start_idx,f.head_lemma) then continue; end if;
       ok:=true;
       for j in 2..f.token_count loop if public.multiword_token_surface_v1(p_analysis,start_idx+j-1) is distinct from f.normalized_tokens[j] then ok:=false; exit; end if; end loop;
       if not ok then continue; end if;
       matched:=matched+1; lemma:=f.head_lemma;
       select string_agg(x->>'surface',' ' order by nullif(x->>'token_index','')::int) into surf from jsonb_array_elements(toks) x where nullif(x->>'token_index','')::int between start_idx and start_idx+f.token_count-1;
       item:=jsonb_build_object('id','mwe1:'||f.mwe_code||':'||start_idx,'mwe_code',f.mwe_code,'mwe_family',f.mwe_family,'surface',surf,'normalized_tokens',to_jsonb(f.normalized_tokens),'start_token_index',start_idx,'end_token_index',start_idx+f.token_count-1,'match_mode',f.match_mode,'sequence_identity','resolved','head_lemma',lemma,'head_match_evidence','structural_pos_plus_source_verb_candidate','function_class',f.function_class,'resolution_policy',f.resolution_policy,'provenance',f.provenance,'payload',f.payload,'learner_error',false);
       candidates:=candidates||jsonb_build_array(item||jsonb_build_object('status','candidate','functional_identity','unresolved','reason_code',case when f.resolution_policy='candidate_requires_predicate_sense' then 'predicate_multiword_identity_resolved_but_source_requires_predicate_sense' else 'predicate_multiword_identity_resolved_valency_function_pending' end,'required_capability',case when f.resolution_policy='candidate_requires_predicate_sense' then 'predicate_sense_resolution' else 'predicate_frame_resolution' end));
     end loop;
   end if;
 end loop;
 return jsonb_build_object('version','multiword-function-expression-v1','status','ready','release_code',p_release_code,'scope','contiguous_mwe_v1','dispatch_mode','indexed_anchor_pruning_v1','resolved_expressions',resolved,'candidate_expressions',candidates,'blocked_or_deferred',blocked,'summary',jsonb_build_object('candidate_fact_count',scanned,'matched_occurrence_count',matched,'resolved_expression_count',jsonb_array_length(resolved),'candidate_expression_count',jsonb_array_length(candidates),'blocked_or_deferred_count',jsonb_array_length(blocked),'source_graph_runtime_reads',0,'learner_error_claims',0));
end;
$$;
