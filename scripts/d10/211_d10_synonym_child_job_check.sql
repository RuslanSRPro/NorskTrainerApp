-- 211 (read only): state of the synonym child jobs after D10_synonym_child_job_v1.
-- 1 config, 2 candidates by state, 3 child jobs, 4 deferred cards, 5 last groups.
select 'config' as part, to_jsonb(c) as data from public.synonym_pipeline_config c
union all
select 'candidates', jsonb_object_agg(k, n) from (
  select dispatch_status || ' / depth ' || origin_depth as k, count(*) as n
  from public.synonym_candidate_queue where synonym_group_key is not null group by 1) q
union all
select 'child_jobs', coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'status', j.status, 'stage', s.stage,
  'items', j.total_items, 'created', j.created_at, 'targets', j.input_text) order by j.created_at desc), '[]'::jsonb)
from (select * from public.lexeme_processing_jobs where input_type = 'synonym_candidate'
      order by created_at desc limit 10) j
left join public.pipeline_supervisor_state s on s.job_id = j.id
union all
select 'deferred_cards', coalesce(jsonb_agg(jsonb_build_object('lemma', l.lemma, 'pos', l.pos,
  'facets', d.facets, 'job', d.job_id)), '[]'::jsonb)
from private.d10_deferred_enrichment_v1 d join public.lexemes l on l.id = d.lexeme_id
union all
select 'last_groups', coalesce(jsonb_agg(g order by g->>'group'), '[]'::jsonb) from (
  select jsonb_build_object('group', synonym_group_key, 'root', root_synonym_lemma,
    'members', jsonb_agg(jsonb_build_object('target', target_text, 'kind', target_kind,
      'state', dispatch_status, 'cards', jsonb_array_length(target_entity_ids)) order by target_text)) as g
  from public.synonym_candidate_queue
  where synonym_group_key is not null and created_at > now() - interval '3 days'
  group by synonym_group_key, root_synonym_lemma
  order by max(created_at) desc limit 15) q;
