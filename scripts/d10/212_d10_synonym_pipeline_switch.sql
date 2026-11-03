-- 212 (WRITES one config row): the switch for synonym child jobs.
-- The migration already turned it ON (50 targets per child job, 50 child jobs per 24 h).
-- Run the first statement only to turn it OFF; candidates are still collected.
update public.synonym_pipeline_config set pipeline_enabled = false, updated_at = now() where singleton
returning pipeline_enabled;
-- on again:
-- update public.synonym_pipeline_config set pipeline_enabled = true, updated_at = now() where singleton returning pipeline_enabled;
