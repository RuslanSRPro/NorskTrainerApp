-- D10_ai_review_provider_openai_v1 (11.11.2026, agreed): the retry of a WORD is generated and reviewed by
-- OpenAI (gpt-6-luna), as expressions are. The database proof checks of AI translations / examples required
-- review provider = 'gemini', so an accepted retry was refused (hete II: AI_REVIEWED_CONTENT_MISMATCH).
-- Every function in public / private whose body contains  ->>'provider' = 'gemini'  is patched in place to
--  ->>'provider' IN ('gemini', 'openai').  Nothing else in the functions changes (article, POS, text, version
-- checks stay). Re-run = no-op. Final SELECT lists the patched functions.
CREATE TABLE IF NOT EXISTS private.d10_ai_review_provider_patch_log_v1 (
  fn text PRIMARY KEY, occurrences integer NOT NULL, patched_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.d10_ai_review_provider_patch_log_v1 FROM PUBLIC;

DO $patch$
DECLARE
  f record; v_def text; v_new text; v_n integer;
  v_old constant text := $o$->>'provider' = 'gemini'$o$;
BEGIN
  FOR f IN
    SELECT p.oid, p.oid::regprocedure::text AS fn
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private') AND p.prokind = 'f'
      AND position($o$->>'provider' = 'gemini'$o$ in p.prosrc) > 0
  LOOP
    v_def := pg_get_functiondef(f.oid);
    v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    IF v_n = 0 THEN CONTINUE; END IF;
    v_new := replace(v_def, v_old, $n$->>'provider' IN ('gemini', 'openai')$n$);
    EXECUTE v_new;
    INSERT INTO private.d10_ai_review_provider_patch_log_v1 (fn, occurrences) VALUES (f.fn, v_n)
    ON CONFLICT (fn) DO UPDATE SET occurrences = EXCLUDED.occurrences, patched_at = now();
  END LOOP;
END
$patch$;

SELECT fn, occurrences, patched_at FROM private.d10_ai_review_provider_patch_log_v1 ORDER BY fn;
