-- 185: after a new Audit of "bar": did AI rewrite the "bare" verb card (b73bb021)? Read only.
--   tr:    its translations now (source, review status of the evidence, updated)
--   ex:    its examples (source, updated)
--   cv:    content_version rows of this card (what changed)
select 'tr' as part, t.language_code || ' ' || t.translation as k,
  'source=' || coalesce(t.source, '-')
  || ' review=' || coalesce(t.enrichment_evidence->>'status', '-') || '/' || coalesce(t.enrichment_evidence->'review'->>'status', '-')
  || ' updated=' || to_char(t.updated_at at time zone 'Europe/Oslo', 'YYYY-MM-DD HH24:MI') as v
from public.entity_translations t where t.lexeme_id::text like 'b73bb021%'
union all
select 'ex', left(e.example_text, 80),
  'source=' || coalesce(e.source, '-') || ' updated=' || to_char(e.updated_at at time zone 'Europe/Oslo', 'YYYY-MM-DD HH24:MI')
from public.entity_examples e where e.lexeme_id::text like 'b73bb021%'
union all
select 'cv', to_char(c.created_at at time zone 'Europe/Oslo', 'YYYY-MM-DD HH24:MI') || ' job ' || left(c.job_id, 8),
  'old=' || left(c.old_values::text, 250) || ' | new=' || left(c.new_values::text, 250)
from public.lexicon_change_log c
where c.change_type = 'content_version' and c.entity_id::text like 'b73bb021%'
order by 1, 2;
