-- D10_synonym_legacy_cleanup_v1 (29.10.2026, asked in chat: "старые связи и записи
-- по синонимам в старых таблицах можем удалить вообще")
-- Removes what the new synonym chain (stage A-C) does not use:
--   1. the 540 old unverified synonym relations (source naob-synonym-resolver,
--      status candidate) - hidden since stage C; a full copy is kept in
--      private.d10_old_synonym_relations_backup_v1 (can be put back);
--   2. unused stage-1 objects: tables synonym_target_queue,
--      synonym_verification_queue, synonym_gloss_queue; the trigger
--      enqueue_naob_synonym_gloss_v1 on naob_expression_glosses (it only filled
--      synonym_gloss_queue); functions enqueue_naob_synonym_gloss_v1,
--      d10_synonym_backfill_v1; the foreign key of
--      synonym_candidate_queue.target_queue_id (the column stays, empty).
-- NOT touched: naob_expression_glosses (the source of the new chain),
-- synonym_candidate_queue, synonym_pair_v1, the verified relations, all other
-- relation types (family 360: has_expression, related_candidate, ...).
-- STOP (nothing changed) when: publication is off; anything still references
-- the old relations or the queues; target / verification queues are not empty;
-- another function uses the tables being dropped.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $pre$
DECLARE
  v_n bigint;
  v_fn text;
  r record;
BEGIN
  IF NOT coalesce(public.d10_synonym_publication_on_v1(), false) THEN
    RAISE EXCEPTION 'STOP: synonym publication is off (stage C); the old relations are still shown; nothing changed';
  END IF;
  -- anything that points at the old relations (any foreign key to the table)
  FOR r IN SELECT c.conrelid::regclass AS tbl, a.attname AS col
           FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
           WHERE c.contype = 'f' AND c.confrelid = 'public.authoritative_semantic_relations'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s t WHERE t.%I IN (SELECT id FROM public.authoritative_semantic_relations
      WHERE source = %L AND relation_type = %L)', r.tbl, r.col, 'naob-synonym-resolver', 'synonym') INTO v_n;
    IF v_n > 0 THEN
      RAISE EXCEPTION 'STOP: % rows of %.% still reference the old relations; nothing changed', v_n, r.tbl, r.col;
    END IF;
  END LOOP;
  IF to_regclass('public.synonym_target_queue') IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM public.synonym_target_queue;
    IF v_n > 0 THEN RAISE EXCEPTION 'STOP: synonym_target_queue has % rows; nothing changed', v_n; END IF;
    SELECT count(*) INTO v_n FROM public.synonym_candidate_queue WHERE target_queue_id IS NOT NULL;
    IF v_n > 0 THEN RAISE EXCEPTION 'STOP: % candidates reference synonym_target_queue; nothing changed', v_n; END IF;
  END IF;
  IF to_regclass('public.synonym_verification_queue') IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM public.synonym_verification_queue;
    IF v_n > 0 THEN RAISE EXCEPTION 'STOP: synonym_verification_queue has % rows; nothing changed', v_n; END IF;
  END IF;
  -- other foreign keys into the queues being dropped
  FOR r IN SELECT c.conrelid::regclass AS tbl, c.confrelid::regclass AS ref FROM pg_constraint c
           WHERE c.contype = 'f' AND c.confrelid IN (SELECT x FROM (VALUES (to_regclass('public.synonym_target_queue')),
             (to_regclass('public.synonym_verification_queue')), (to_regclass('public.synonym_gloss_queue'))) v(x) WHERE x IS NOT NULL)
             AND c.conrelid NOT IN (SELECT x FROM (VALUES (to_regclass('public.synonym_candidate_queue')),
             (to_regclass('public.synonym_verification_queue'))) v(x) WHERE x IS NOT NULL)
  LOOP
    RAISE EXCEPTION 'STOP: % has a foreign key to %; nothing changed', r.tbl, r.ref;
  END LOOP;
  -- other functions that use the tables being dropped
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private')
    AND (p.prosrc LIKE '%synonym_target_queue%' OR p.prosrc LIKE '%synonym_verification_queue%' OR p.prosrc LIKE '%synonym_gloss_queue%')
    AND p.proname NOT IN ('enqueue_naob_synonym_gloss_v1', 'd10_synonym_backfill_v1');
  IF v_fn IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: these functions use the old queues: %; nothing changed', v_fn;
  END IF;
END
$pre$;

-- 1. old relations: copy, then delete (the sync trigger updates the cards)
CREATE TABLE IF NOT EXISTS private.d10_old_synonym_relations_backup_v1 AS
  SELECT r.*, now() AS backed_up_at FROM public.authoritative_semantic_relations r WHERE false;
INSERT INTO private.d10_old_synonym_relations_backup_v1
  SELECT r.*, now() FROM public.authoritative_semantic_relations r
  WHERE r.source = 'naob-synonym-resolver' AND r.relation_type = 'synonym';
REVOKE ALL ON TABLE private.d10_old_synonym_relations_backup_v1 FROM PUBLIC, anon, authenticated;
DELETE FROM public.authoritative_semantic_relations
WHERE source = 'naob-synonym-resolver' AND relation_type = 'synonym';

-- 2. unused stage-1 objects
DROP TRIGGER IF EXISTS enqueue_naob_synonym_gloss_v1 ON public.naob_expression_glosses;
DROP FUNCTION IF EXISTS public.enqueue_naob_synonym_gloss_v1();
DROP FUNCTION IF EXISTS public.d10_synonym_backfill_v1(integer, boolean);
ALTER TABLE public.synonym_candidate_queue DROP CONSTRAINT IF EXISTS synonym_candidate_queue_target_queue_id_fkey;
DROP TABLE IF EXISTS public.synonym_verification_queue;
DROP TABLE IF EXISTS public.synonym_target_queue;
DROP TABLE IF EXISTS public.synonym_gloss_queue;

COMMIT;
