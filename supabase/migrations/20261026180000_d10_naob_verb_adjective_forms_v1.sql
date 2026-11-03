-- D10 26.10.2026 (agreed): NAOB forms for VERB and ADJECTIVE cards too
-- (until now nouns only), for a card without Ordbøkene forms and without
-- compound head forms.
--   1. lexeme_naob_forms_v1.derived_rule: set only on a form we build from the
--      forms NAOB lists (not taken from the source), the app shows "≈" there:
--        present_infinitive_plus_r  verb presens   (bare -> barer)
--        definite_equals_plural     adj. bestemt   (stor -> store)
--        superlative_plus_e         adj. best. sup. (størst -> største)
--   2. d10_publish_naob_forms_v1: the same checks as before, per part of
--      speech; nouns are checked exactly as before.
--        noun:      noun_singular_indefinite (= lemma) ... noun_plural_definite
--        verb:      infinitive (= lemma), present, past, past_participle
--        adjective: positive_singular_indefinite_common (= lemma),
--                   positive_singular_indefinite_neuter, positive_definite,
--                   positive_plural_indefinite, comparative, superlative,
--                   superlative_definite
--      At least one form beyond the lemma; a built form needs its rule.
-- The completion check is not changed: a card with NAOB forms is already
-- "ready with a mark" (identity.naob_forms, D10_naob_complete_v1).
-- Stops before any change if the live publish function is not the
-- D10_naob_forms_v1 one. Re-running is safe.

do $guard$
declare
  v_def text := pg_get_functiondef('public.d10_publish_naob_forms_v1(uuid,jsonb,jsonb)'::regprocedure);
begin
  if position('derived_rule' in v_def) > 0 then
    return;  -- already applied
  end if;
  if position('POS_NOT_SUPPORTED' in v_def) = 0
     or position('INDEFINITE_SINGULAR_NOT_LEMMA' in v_def) = 0
     or position('NO_INFLECTED_FORM' in v_def) = 0 then
    raise exception 'd10_publish_naob_forms_v1 differs from D10_naob_forms_v1; nothing changed. Send the current definition for review.';
  end if;
end
$guard$;

ALTER TABLE public.lexeme_naob_forms_v1 ADD COLUMN IF NOT EXISTS derived_rule text;
DO $c$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lexeme_naob_forms_v1_derived_rule_check') THEN
    ALTER TABLE public.lexeme_naob_forms_v1 ADD CONSTRAINT lexeme_naob_forms_v1_derived_rule_check
      CHECK (derived_rule IS NULL OR derived_rule IN
        ('present_infinitive_plus_r', 'definite_equals_plural', 'superlative_plus_e'));
  END IF;
END
$c$;
COMMENT ON COLUMN public.lexeme_naob_forms_v1.derived_rule IS
  'D10 26.10.2026: set only on a form built from the forms NAOB lists (shown with ≈); NULL = taken from NAOB.';

CREATE OR REPLACE FUNCTION public.d10_publish_naob_forms_v1(
  p_lexeme_id uuid,
  p_forms jsonb,
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
DECLARE
  v_lexeme record;
  v_keys text[];
  v_lemma_key text;
  v_slugs text[];
  v_rows integer;
BEGIN
  SELECT l.id, l.lemma, l.pos INTO v_lexeme FROM public.lexemes l WHERE l.id = p_lexeme_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'LEXEME_NOT_FOUND';
  END IF;
  -- D10 26.10.2026: noun (as before), verb, adjective
  IF v_lexeme.pos = 'noun' THEN
    v_keys := ARRAY['noun_singular_indefinite', 'noun_singular_definite',
                    'noun_plural_indefinite', 'noun_plural_definite'];
    v_lemma_key := 'noun_singular_indefinite';
  ELSIF v_lexeme.pos = 'verb' THEN
    v_keys := ARRAY['infinitive', 'present', 'past', 'past_participle'];
    v_lemma_key := 'infinitive';
  ELSIF v_lexeme.pos = 'adjective' THEN
    v_keys := ARRAY['positive_singular_indefinite_common', 'positive_singular_indefinite_neuter',
                    'positive_definite', 'positive_plural_indefinite', 'comparative',
                    'superlative', 'superlative_definite'];
    v_lemma_key := 'positive_singular_indefinite_common';
  ELSE
    RAISE EXCEPTION USING errcode = '22023', message = 'POS_NOT_SUPPORTED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lexeme_form_display_v2 f WHERE f.lexeme_id = p_lexeme_id) THEN
    RAISE EXCEPTION USING errcode = '55000', message = 'OWN_FORMS_EXIST';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lexeme_compound_head_forms_v1 h WHERE h.lexeme_id = p_lexeme_id) THEN
    RAISE EXCEPTION USING errcode = '55000', message = 'COMPOUND_FORMS_EXIST';
  END IF;
  IF jsonb_typeof(p_forms) IS DISTINCT FROM 'array' OR jsonb_array_length(p_forms) = 0 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'FORMS_REQUIRED';
  END IF;

  v_slugs := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_evidence -> 'naob_slugs', '[]'::jsonb)));
  IF coalesce(cardinality(v_slugs), 0) = 0
     OR EXISTS (SELECT 1 FROM unnest(v_slugs) s WHERE s !~ '^[A-Za-z0-9%._-]+$') THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'NAOB_SLUGS_REQUIRED';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.d10_naob_forms_in2 (
    form_key text, primary_values text[], alternative_values text[], accepted_articles text[], derived_rule text
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.d10_naob_forms_in2;
  INSERT INTO pg_temp.d10_naob_forms_in2
  SELECT e ->> 'form_key',
    ARRAY(SELECT lower(btrim(v)) FROM jsonb_array_elements_text(coalesce(e -> 'primary_values', '[]'::jsonb)) WITH ORDINALITY x(v, o) ORDER BY o),
    ARRAY(SELECT lower(btrim(v)) FROM jsonb_array_elements_text(coalesce(e -> 'alternative_values', '[]'::jsonb)) WITH ORDINALITY x(v, o) ORDER BY o),
    ARRAY(SELECT DISTINCT lower(btrim(v)) FROM jsonb_array_elements_text(coalesce(e -> 'accepted_articles', '[]'::jsonb)) v),
    nullif(btrim(coalesce(e ->> 'derived_rule', '')), '')
  FROM jsonb_array_elements(p_forms) e;

  IF EXISTS (SELECT 1 FROM pg_temp.d10_naob_forms_in2 i WHERE i.form_key IS NULL OR NOT (i.form_key = ANY (v_keys)))
     OR (SELECT count(*) <> count(DISTINCT i.form_key) FROM pg_temp.d10_naob_forms_in2 i) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'FORM_KEY_INVALID';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.d10_naob_forms_in2 i WHERE cardinality(i.primary_values) = 0)
     OR EXISTS (
       SELECT 1 FROM pg_temp.d10_naob_forms_in2 i, unnest(i.primary_values || i.alternative_values) v
       WHERE v !~ '^[a-zæøåàáâäèéêëìíîïòóôöùúûüçñ]+(-[a-zæøåàáâäèéêëìíîïòóôöùúûüçñ]+)*$')
     OR EXISTS (
       SELECT 1 FROM pg_temp.d10_naob_forms_in2 i, unnest(i.accepted_articles) a
       WHERE a NOT IN ('en', 'ei', 'et')) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'FORM_VALUE_INVALID';
  END IF;
  -- a built form only with its rule, and only for its own form
  IF EXISTS (
    SELECT 1 FROM pg_temp.d10_naob_forms_in2 i
    WHERE i.derived_rule IS NOT NULL AND NOT (
      (i.derived_rule = 'present_infinitive_plus_r' AND i.form_key = 'present') OR
      (i.derived_rule = 'definite_equals_plural' AND i.form_key = 'positive_definite') OR
      (i.derived_rule = 'superlative_plus_e' AND i.form_key = 'superlative_definite'))) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'DERIVED_RULE_INVALID';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp.d10_naob_forms_in2 i
    WHERE i.form_key = v_lemma_key
      AND NOT (lower(btrim(v_lexeme.lemma)) = ANY (i.primary_values))) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'INDEFINITE_SINGULAR_NOT_LEMMA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_temp.d10_naob_forms_in2 i
                 WHERE i.form_key <> v_lemma_key AND i.derived_rule IS NULL) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'NO_INFLECTED_FORM';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('d10_naob_forms:' || p_lexeme_id::text, 0));
  DELETE FROM public.lexeme_naob_forms_v1 n WHERE n.lexeme_id = p_lexeme_id;

  INSERT INTO public.lexeme_naob_forms_v1 (
    lexeme_id, form_key, pos, lemma, primary_values, alternative_values,
    accepted_articles, regularity_marker, display_order, genus, naob_slugs,
    evidence, updated_at, derived_rule
  )
  SELECT p_lexeme_id, i.form_key, v_lexeme.pos, v_lexeme.lemma,
    i.primary_values,
    ARRAY(SELECT a FROM unnest(i.alternative_values) WITH ORDINALITY u(a, o)
          WHERE NOT (a = ANY (i.primary_values)) ORDER BY o),
    ARRAY(SELECT a FROM unnest(ARRAY['en', 'ei', 'et']) WITH ORDINALITY u(a, o)
          WHERE a = ANY (i.accepted_articles) ORDER BY o),
    'unknown', array_position(v_keys, i.form_key),
    nullif(left(btrim(coalesce(p_evidence ->> 'genus', '')), 80), ''),
    v_slugs, coalesce(p_evidence, '{}'::jsonb), now(), i.derived_rule
  FROM pg_temp.d10_naob_forms_in2 i;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  DELETE FROM private.d10_naob_forms_review_v1 r WHERE r.lexeme_id = p_lexeme_id;
  RETURN v_rows;
END;
$body$;

REVOKE ALL ON FUNCTION public.d10_publish_naob_forms_v1(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_publish_naob_forms_v1(uuid, jsonb, jsonb) TO service_role;
