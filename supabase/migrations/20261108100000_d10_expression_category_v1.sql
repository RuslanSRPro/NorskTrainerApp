-- D10_expression_category_v1 (08.11.2026, agreed): expression categories.
--   * own field expression_catalog.category (+ source rule / ai / legacy, confidence, history). expression_subtype is
--     NOT changed: the learning admission and the 360 display rely on 'ordbokene_sub_article' / 'naob_expression'.
--   * legacy: an existing real category (not a source marker) is copied as source 'legacy' and is RECHECKED by the AI:
--     changed only when the AI answers with high confidence; otherwise the item goes to the review list.
--   * rules (free, at insert and once for the catalog), only when the first word is a verb of the base:
--       verb + seg + particle -> reflexive_particle_verb ; verb + seg (+ preposition) -> lexical_reflexive ;
--       verb + one adverbial particle -> particle_verb ; verb + one preposition (+ noe/noen) -> prepositional_verb.
--   * everything else -> queue private.d10_expr_category_queue_v1 -> expression-category-worker
--     (gemini-2.5-flash, no thinking; fallback gpt-6-luna), batches of 25; woken after a job by pipeline-supervisor
--     and every 5 minutes by pg_cron. Daily item limit in private.d10_expr_category_config_v1.
-- Rollback: optional/rollback_d10_expression_category_v1.sql (drops the new objects; category columns kept unless asked).

ALTER TABLE public.expression_catalog
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS category_source text,
  ADD COLUMN IF NOT EXISTS category_confidence text,
  ADD COLUMN IF NOT EXISTS category_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS category_history jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS private.d10_expr_category_config_v1 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT true,
  model text NOT NULL DEFAULT 'gemini-2.5-flash',
  model_thinking text DEFAULT '0',
  fallback_model text NOT NULL DEFAULT 'gpt-6-luna',
  fallback_thinking text DEFAULT 'low',
  batch_size integer NOT NULL DEFAULT 25 CHECK (batch_size BETWEEN 1 AND 50),
  batches_per_call integer NOT NULL DEFAULT 8 CHECK (batches_per_call BETWEEN 1 AND 40),
  daily_item_limit integer NOT NULL DEFAULT 3000 CHECK (daily_item_limit >= 0)
);
INSERT INTO private.d10_expr_category_config_v1 (singleton) VALUES (true) ON CONFLICT DO NOTHING;
REVOKE ALL ON private.d10_expr_category_config_v1 FROM PUBLIC;

CREATE TABLE IF NOT EXISTS private.d10_expr_category_queue_v1 (
  expression_id uuid PRIMARY KEY REFERENCES public.expression_catalog(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('missing', 'recheck_legacy')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'leased', 'done', 'review', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  ai_answer text,
  ai_confidence text,
  ai_model text,
  outcome text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  last_error text
);
CREATE INDEX IF NOT EXISTS d10_expr_category_queue_v1_status_idx ON private.d10_expr_category_queue_v1 (status, requested_at);
REVOKE ALL ON private.d10_expr_category_queue_v1 FROM PUBLIC;

-- the categories the AI may choose (the existing set of the base)
CREATE OR REPLACE FUNCTION private.d10_expr_category_allowed_v1(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT p = ANY (ARRAY['idiom', 'fixed_expression', 'collocation', 'particle_verb', 'prepositional_verb',
    'lexical_reflexive', 'reflexive_particle_verb', 'time_expression', 'conversation_phrase', 'discourse_marker'])
$$;

-- rules v2 (preview 372 corrected): NULL = not decided by a rule
CREATE OR REPLACE FUNCTION private.d10_expr_category_rule_v1(p_lemma text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  t text[];
  n integer;
  adv text[] := ARRAY['inn','ut','opp','ned','fram','frem','bort','igjen','unna','vekk','tilbake','rundt','innom','forbi','an','løs','fast'];
  amb text[] := ARRAY['over','under','gjennom'];
  prep text[] := ARRAY['på','med','om','til','etter','av','for','i','fra','mot','ved','hos'];
BEGIN
  IF nullif(btrim(p_lemma), '') IS NULL THEN RETURN NULL; END IF;
  t := regexp_split_to_array(btrim(regexp_replace(regexp_replace(regexp_replace(lower(btrim(p_lemma)),
         '\[([^]|]*)\|[^]]*\]', '\1', 'g'), '^å ', ''), '\s+', ' ', 'g')), ' ');
  n := cardinality(t);
  IF n < 2 OR NOT EXISTS (SELECT 1 FROM public.lexemes l WHERE l.lemma = t[1] AND l.pos = 'verb') THEN RETURN NULL; END IF;
  IF t[2] = 'seg' AND n = 3 AND (t[3] = ANY (adv) OR t[3] = ANY (amb)) THEN RETURN 'reflexive_particle_verb'; END IF;
  IF t[2] = 'seg' AND (n = 2 OR (n = 3 AND t[3] = ANY (prep))) THEN RETURN 'lexical_reflexive'; END IF;
  IF n = 2 AND t[2] = ANY (adv) THEN RETURN 'particle_verb'; END IF;
  IF n = 2 AND t[2] = ANY (prep) THEN RETURN 'prepositional_verb'; END IF;
  IF n = 3 AND t[2] = ANY (prep) AND t[3] IN ('noe', 'noen') THEN RETURN 'prepositional_verb'; END IF;
  RETURN NULL;
END $$;

-- at insert: a rule, else the queue
CREATE OR REPLACE FUNCTION private.d10_expr_category_before_insert_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
BEGIN
  IF NEW.category IS NULL THEN
    NEW.category := private.d10_expr_category_rule_v1(NEW.lemma);
    IF NEW.category IS NOT NULL THEN
      NEW.category_source := 'rule'; NEW.category_confidence := 'high'; NEW.category_updated_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION private.d10_expr_category_after_insert_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
BEGIN
  IF NEW.category IS NULL AND nullif(btrim(NEW.lemma), '') IS NOT NULL THEN
    INSERT INTO private.d10_expr_category_queue_v1 (expression_id, reason) VALUES (NEW.id, 'missing')
    ON CONFLICT (expression_id) DO NOTHING;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS d10_expr_category_before_insert_v1 ON public.expression_catalog;
CREATE TRIGGER d10_expr_category_before_insert_v1 BEFORE INSERT ON public.expression_catalog
  FOR EACH ROW EXECUTE FUNCTION private.d10_expr_category_before_insert_v1();
DROP TRIGGER IF EXISTS d10_expr_category_after_insert_v1 ON public.expression_catalog;
CREATE TRIGGER d10_expr_category_after_insert_v1 AFTER INSERT ON public.expression_catalog
  FOR EACH ROW EXECUTE FUNCTION private.d10_expr_category_after_insert_v1();

CREATE OR REPLACE FUNCTION public.d10_expr_category_pending_v1()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
  SELECT CASE WHEN (SELECT enabled FROM private.d10_expr_category_config_v1) THEN
    (SELECT count(*)::integer FROM private.d10_expr_category_queue_v1
     WHERE status = 'pending' OR (status = 'leased' AND lease_until < now())) ELSE 0 END
$$;

-- a batch for the worker (the job's expressions first); also the config and the remaining daily limit
CREATE OR REPLACE FUNCTION public.d10_expr_category_lease_v1(p_limit integer, p_job_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  v_cfg private.d10_expr_category_config_v1;
  v_left integer;
  v_items jsonb;
BEGIN
  SELECT * INTO v_cfg FROM private.d10_expr_category_config_v1;
  v_left := greatest(v_cfg.daily_item_limit - (SELECT count(*) FROM private.d10_expr_category_queue_v1
             WHERE finished_at > now() - interval '24 hours' AND status IN ('done', 'review')), 0);
  IF NOT v_cfg.enabled OR v_left = 0 THEN
    RETURN jsonb_build_object('ok', true, 'items', '[]'::jsonb, 'enabled', v_cfg.enabled, 'daily_left', v_left);
  END IF;
  WITH pick AS (
    SELECT q.expression_id FROM private.d10_expr_category_queue_v1 q
    WHERE (q.status = 'pending' OR (q.status = 'leased' AND q.lease_until < now())) AND q.attempts < 3
    ORDER BY (p_job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.lexeme_processing_items i
               WHERE i.job_id = p_job_id AND i.expression_id = q.expression_id)) DESC,
             (q.reason = 'missing') DESC, q.requested_at
    LIMIT least(greatest(coalesce(p_limit, 25), 1), 50, v_left)
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE private.d10_expr_category_queue_v1 q SET status = 'leased', lease_until = now() + interval '5 minutes',
      attempts = q.attempts + 1
    FROM pick WHERE q.expression_id = pick.expression_id
    RETURNING q.expression_id, q.reason
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'lemma', e.lemma, 'reason', upd.reason,
      'gloss', left(coalesce(nullif(e.raw_sources->>'definition_preview', ''), nullif(e.raw_sources->'glosses'->0->>'gloss', ''),
                             nullif(e.verification_evidence->>'definition_preview', '')), 300),
      'translations', (SELECT left(string_agg(t.translation, '; ' ORDER BY t.language_code, t.translation), 200)
                       FROM (SELECT DISTINCT t.language_code, t.translation FROM public.entity_translations t
                             WHERE t.expression_id = e.id AND t.language_code IN ('uk', 'en') LIMIT 4) t))), '[]'::jsonb)
  INTO v_items FROM upd JOIN public.expression_catalog e ON e.id = upd.expression_id;
  RETURN jsonb_build_object('ok', true, 'items', v_items, 'enabled', true, 'daily_left', v_left,
    'model', v_cfg.model, 'model_thinking', v_cfg.model_thinking, 'fallback_model', v_cfg.fallback_model,
    'fallback_thinking', v_cfg.fallback_thinking, 'batch_size', v_cfg.batch_size, 'batches_per_call', v_cfg.batches_per_call);
END $$;

-- answers of the AI. missing: set (unless unsure -> review). recheck_legacy: same -> confirmed; different with high
-- confidence -> changed (old value into category_history); otherwise -> review (category kept).
CREATE OR REPLACE FUNCTION public.d10_expr_category_record_v1(p_results jsonb, p_model text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE
  r record;
  q private.d10_expr_category_queue_v1;
  e record;
  v_outcome text;
  v_n jsonb := '{}'::jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) AS x(id uuid, category text, confidence text, error text)
  LOOP
    SELECT * INTO q FROM private.d10_expr_category_queue_v1 WHERE expression_id = r.id FOR UPDATE;
    CONTINUE WHEN NOT FOUND;
    SELECT id, category, category_source INTO e FROM public.expression_catalog WHERE id = r.id FOR UPDATE;
    IF r.error IS NOT NULL OR r.category IS NULL THEN
      UPDATE private.d10_expr_category_queue_v1 SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
        lease_until = NULL, last_error = left(coalesce(r.error, 'no_answer'), 300) WHERE expression_id = r.id;
      v_outcome := 'retry';
    ELSIF r.category = 'unsure' OR NOT private.d10_expr_category_allowed_v1(r.category) THEN
      v_outcome := 'review_unsure';
    ELSIF q.reason = 'missing' THEN
      IF e.category IS NULL THEN
        UPDATE public.expression_catalog SET category = r.category, category_source = 'ai', category_confidence = r.confidence,
          category_updated_at = now() WHERE id = r.id;
        v_outcome := 'set';
      ELSE
        v_outcome := 'already_set';
      END IF;
    ELSIF r.category = e.category THEN
      UPDATE public.expression_catalog SET category_confidence = r.confidence, category_updated_at = now() WHERE id = r.id;
      v_outcome := 'confirmed';
    ELSIF r.confidence = 'high' THEN
      UPDATE public.expression_catalog SET
        category_history = category_history || jsonb_build_array(jsonb_build_object('category', e.category,
          'source', e.category_source, 'replaced_at', now(), 'replaced_by', p_model)),
        category = r.category, category_source = 'ai', category_confidence = r.confidence, category_updated_at = now()
      WHERE id = r.id;
      v_outcome := 'changed';
    ELSE
      v_outcome := 'review_disagree';
    END IF;
    IF v_outcome <> 'retry' THEN
      UPDATE private.d10_expr_category_queue_v1 SET
        status = CASE WHEN v_outcome LIKE 'review%' THEN 'review' ELSE 'done' END,
        ai_answer = r.category, ai_confidence = r.confidence, ai_model = p_model, outcome = v_outcome,
        lease_until = NULL, finished_at = now(), last_error = NULL
      WHERE expression_id = r.id;
    END IF;
    v_n := jsonb_set(v_n, ARRAY[v_outcome], to_jsonb(coalesce((v_n->>v_outcome)::integer, 0) + 1));
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'outcomes', v_n);
END $$;

-- pg_cron: every 5 minutes, wake the worker when the queue is not empty (pg_net helper of the project)
CREATE OR REPLACE FUNCTION public.d10_expr_category_tick_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
DECLARE v_pending integer := public.d10_expr_category_pending_v1();
BEGIN
  IF v_pending = 0 THEN RETURN jsonb_build_object('ok', true, 'pending', 0); END IF;
  RETURN jsonb_build_object('ok', true, 'pending', v_pending,
    'called', public.d10_synonym_bm_call_edge_v1('expression-category-worker', jsonb_build_object('reason', 'cron')));
END $$;

REVOKE ALL ON FUNCTION private.d10_expr_category_rule_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_expr_category_pending_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_expr_category_lease_v1(integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_expr_category_record_v1(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_expr_category_tick_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_expr_category_pending_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_expr_category_lease_v1(integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_expr_category_record_v1(jsonb, text) TO service_role;

-- once for the catalog: legacy copy, rules, queue
DO $once$
BEGIN
  UPDATE public.expression_catalog SET category = expression_subtype::text, category_source = 'legacy',
    category_updated_at = now()
  WHERE category IS NULL AND expression_subtype IS NOT NULL
    AND expression_subtype::text NOT IN ('ordbokene_sub_article', 'naob_expression', 'has_expression');
  UPDATE public.expression_catalog SET category = private.d10_expr_category_rule_v1(lemma), category_source = 'rule',
    category_confidence = 'high', category_updated_at = now()
  WHERE category IS NULL AND private.d10_expr_category_rule_v1(lemma) IS NOT NULL;
  INSERT INTO private.d10_expr_category_queue_v1 (expression_id, reason)
  SELECT id, 'missing' FROM public.expression_catalog WHERE category IS NULL AND nullif(btrim(lemma), '') IS NOT NULL
  ON CONFLICT (expression_id) DO NOTHING;
  INSERT INTO private.d10_expr_category_queue_v1 (expression_id, reason)
  SELECT id, 'recheck_legacy' FROM public.expression_catalog WHERE category_source = 'legacy'
  ON CONFLICT (expression_id) DO NOTHING;
  IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
    PERFORM cron.schedule('d10-expression-category-tick', '*/5 * * * *', 'select public.d10_expr_category_tick_v1();');
  END IF;
END $once$;

SELECT 'd10_expression_category_v1 installed' AS result,
  (SELECT jsonb_object_agg(coalesce(category_source, 'none'), n) FROM (SELECT category_source, count(*) n
     FROM public.expression_catalog GROUP BY 1) s) AS by_source,
  (SELECT jsonb_object_agg(reason, n) FROM (SELECT reason, count(*) n FROM private.d10_expr_category_queue_v1 GROUP BY 1) s) AS queue,
  (SELECT count(*) FROM cron.job WHERE jobname = 'd10-expression-category-tick') AS cron_jobs;
