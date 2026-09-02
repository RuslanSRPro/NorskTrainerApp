create or replace function public.clause_attachment_token_lexeme_v1(p_analysis jsonb,p_token_index int)
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
with tok as (
 select value t from jsonb_array_elements(coalesce(p_analysis#>'{language_graph,tokens}','[]'::jsonb)) where nullif(value->>'token_index','')::int=p_token_index limit 1
), c as (
 select x from tok cross join lateral jsonb_array_elements(coalesce(t#>'{surface_resolution,candidates}','[]'::jsonb)) x where x->>'source_pos'='verb'
), d as (select count(*) n,min(x->>'lexeme_id') lexeme_id,min(x->>'lemma') lemma from c)
select jsonb_build_object('status',case when n=1 then 'resolved' when n=0 then 'missing' else 'ambiguous' end,'candidate_count',n,'lexeme_id',case when n=1 then lexeme_id else null end,'lemma',case when n=1 then lemma else null end) from d;
$$;
