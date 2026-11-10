-- D10_naob_family_v7 (07.11.2026), test gripe: after the learning admission (v6) the 7 NAOB cards were
-- in learning, but gripe still showed 8 ready / 6 grey until gripe itself was recounted by hand (365 -> 14 / 0).
-- Cause: when an expression card changes is_learning_lexeme or dictionary_status, the ROOT of its 360
-- family is not put into the recount queue (only expression and binding changes are). The same delay
-- was seen before with Ordbøkene expressions (grey until the next analysis).
-- Fix: a trigger on public.lexemes: such a change of an expression card puts the roots of its family
-- into private.lexeme360_refresh_queue_v1; the scheduled drain (every 10 s) recounts them.
-- Only these two columns, only when they really change, only cards with pos = 'expression'.

CREATE OR REPLACE FUNCTION private.d10_lexeme360_enqueue_card_roots_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
BEGIN
  PERFORM private.lexeme360_enqueue_v1(
    ARRAY(SELECT DISTINCT b.root_lexeme_id
          FROM public.expression_catalog e
          JOIN private.lexeme360_expression_roots_v1 b ON b.expression_id = e.id
          WHERE e.lexeme_id = NEW.id),
    'expression_card_learning_or_status_v7');
  RETURN NULL;
END $f$;
REVOKE ALL ON FUNCTION private.d10_lexeme360_enqueue_card_roots_v1() FROM PUBLIC;

DROP TRIGGER IF EXISTS d10_lexeme360_card_roots_v1 ON public.lexemes;
CREATE TRIGGER d10_lexeme360_card_roots_v1
AFTER UPDATE OF is_learning_lexeme, dictionary_status ON public.lexemes
FOR EACH ROW
WHEN (NEW.pos = 'expression'
      AND (OLD.is_learning_lexeme IS DISTINCT FROM NEW.is_learning_lexeme
           OR OLD.dictionary_status IS DISTINCT FROM NEW.dictionary_status))
EXECUTE FUNCTION private.d10_lexeme360_enqueue_card_roots_v1();

-- once: families of expression cards that are in learning now but whose root may still be stale
DO $$
BEGIN
  PERFORM private.lexeme360_enqueue_v1(
    ARRAY(SELECT DISTINCT b.root_lexeme_id
          FROM public.lexemes t
          JOIN public.expression_catalog e ON e.lexeme_id = t.id
          JOIN private.lexeme360_expression_roots_v1 b ON b.expression_id = e.id
          WHERE t.pos = 'expression' AND t.updated_at > now() - interval '7 days'),
    'expression_card_backfill_v7');
  PERFORM public.lexeme360_refresh_drain_v1(500);
END $$;

SELECT 'd10_naob_family_v7 installed' AS result,
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'd10_lexeme360_card_roots_v1') AS trigger_count,
  (SELECT count(*) FROM private.lexeme360_refresh_queue_v1) AS queue_left;
