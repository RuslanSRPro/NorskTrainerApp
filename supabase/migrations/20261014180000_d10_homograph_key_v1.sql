-- D10 stage D1-1 (plan D10_stage_d_plan_v3, agreed 14.10.2026): homograph key.
--
-- Two cards may share lemma and POS when their Ordbøkene articles have
-- different paradigms (rule R9: bok I "book" / bok II "beech", være II "be" /
-- være III "sniff"). They are told apart by lexemes.homograph_key: empty for
-- the main card and for every existing card, the dictionary's Roman homograph
-- number ('II', 'III', ...) for a second card.
--
-- This migration is ADDITIVE and changes no behaviour yet:
--   1. column lexemes.homograph_key text NOT NULL DEFAULT '' (all existing rows
--      get ''), allowed values '' or a Roman number I..X;
--   2. new unique index (lemma, pos, homograph_key);
--   3. the old unique index lexemes_lemma_pos_unique (lemma, pos) STAYS, so a
--      second card still cannot be created. It is dropped only in stage D2,
--      together with the code that creates second cards and picks the card by
--      article;
--   4. sync_expression_to_lexemes: ON CONFLICT (lemma, pos) ->
--      ON CONFLICT (lemma, pos, homograph_key). While both indexes exist and
--      every row has key '', both targets find exactly the same row, so the
--      behaviour is identical. Without this change dropping the old index in
--      D2 would break the function.
-- The app (services/api.ts) gets the same conflict-target change in this
-- package.

ALTER TABLE public.lexemes
  ADD COLUMN IF NOT EXISTS homograph_key text NOT NULL DEFAULT '';

DO $c$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.lexemes'::regclass
                   AND conname = 'lexemes_homograph_key_check') THEN
    ALTER TABLE public.lexemes
      ADD CONSTRAINT lexemes_homograph_key_check
      CHECK (homograph_key ~ '^(|I|II|III|IV|V|VI|VII|VIII|IX|X)$');
  END IF;
END
$c$;

COMMENT ON COLUMN public.lexemes.homograph_key IS
  'D10 R9: empty for the main card; Ordbøkene Roman homograph number (II, III...) for a second card of the same lemma and POS with a different paradigm.';

CREATE UNIQUE INDEX IF NOT EXISTS lexemes_lemma_pos_homograph_unique
  ON public.lexemes (lemma, pos, homograph_key);

DO $patch$
DECLARE
  v_def text;
  a_old constant text := 'ON CONFLICT (lemma, pos) DO UPDATE SET';
  a_new constant text := 'ON CONFLICT (lemma, pos, homograph_key) DO UPDATE SET';
BEGIN
  v_def := pg_get_functiondef('public.sync_expression_to_lexemes(uuid)'::regprocedure);
  IF position(a_new IN v_def) > 0 THEN
    RAISE NOTICE 'D10 D1-1: sync_expression_to_lexemes already patched';
    RETURN;
  END IF;
  IF (length(v_def) - length(replace(v_def, a_old, ''))) / length(a_old) <> 1 THEN
    RAISE EXCEPTION 'D10_D1_1_PREFLIGHT: sync_expression_to_lexemes differs from the expected base; nothing changed';
  END IF;
  EXECUTE replace(v_def, a_old, a_new);
  RAISE NOTICE 'D10 D1-1: homograph_key added, sync_expression_to_lexemes uses (lemma, pos, homograph_key)';
END
$patch$;
