create or replace function public.runtime_multiword_candidate_facts_v1(p_analysis jsonb,p_release_code text)
returns setof public.grammar_runtime_multiword_facts_v1
language sql stable security invoker set search_path='public','pg_catalog' as $$
with r as (
  select id from public.grammar_runtime_releases where code=p_release_code
), surfaces as (
  select distinct lower(t->>'surface') as anchor
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) t
  where t->>'token_type'='word' and t->>'surface' is not null
), verb_lemmas as (
  select distinct lower(m->>'selected_lemma') as lemma
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb)) m
  where m->>'selected_lemma' is not null
    and (m#>>'{selected_reading,source_pos}'='verb' or m#>>'{selected_reading,features,VerbForm}' is not null)
  union
  select distinct lower(sr->>'lemma')
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb)) m
  cross join lateral jsonb_array_elements(coalesce(m->'surviving_readings','[]'::jsonb)) sr
  where sr->>'source_pos'='verb' and sr->>'lemma' is not null
  union
  select distinct lower(c->>'lemma')
  from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) t
  cross join lateral jsonb_array_elements(coalesce(t#>'{surface_resolution,candidates}','[]'::jsonb)) c
  where c->>'source_pos'='verb' and c->>'lemma' is not null
)
select f.*
from r join surfaces s on true
join public.grammar_runtime_multiword_facts_v1 f
  on f.release_id=r.id and f.match_mode='surface_sequence' and f.first_token=s.anchor and f.is_enabled
union all
select f.*
from r join verb_lemmas v on true
join public.grammar_runtime_multiword_facts_v1 f
  on f.release_id=r.id and f.match_mode='lemma_plus_fixed_tail' and f.head_lemma=v.lemma and f.is_enabled;
$$;

create or replace function public.multiword_head_lemma_matches_v1(p_analysis jsonb,p_token_index integer,p_expected_lemma text)
returns boolean language plpgsql stable security invoker set search_path='public','pg_catalog' as $$
declare v_selected text; v_match boolean:=false;
begin
 select lower(x->>'selected_lemma') into v_selected
 from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb)) x
 where nullif(x->>'token_index','')::int=p_token_index and x->>'selected_lemma' is not null limit 1;
 if v_selected=lower(p_expected_lemma) then return true; end if;
 select exists(
   select 1
   from jsonb_array_elements(coalesce(m->'surviving_readings','[]'::jsonb)) sr
   where lower(sr->>'lemma')=lower(p_expected_lemma) and sr->>'source_pos'='verb'
 ) into v_match
 from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,morphology_v1}','[]'::jsonb)) m
 where nullif(m->>'token_index','')::int=p_token_index limit 1;
 if coalesce(v_match,false) then return true; end if;
 select exists(
   select 1 from jsonb_array_elements(coalesce(t#>'{surface_resolution,candidates}','[]'::jsonb)) c
   where lower(c->>'lemma')=lower(p_expected_lemma) and c->>'source_pos'='verb'
 ) into v_match
 from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) t
 where nullif(t->>'token_index','')::int=p_token_index limit 1;
 return coalesce(v_match,false);
end;
$$;
