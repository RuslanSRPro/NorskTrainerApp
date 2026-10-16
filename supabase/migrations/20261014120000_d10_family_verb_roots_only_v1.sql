-- D10 14.10.2026 (owner decision): the Lexeme 360 family is the family of a
-- VERB whose meaning shifts in its expressions (ta -> ta opp, ta seg av).
-- Noun roots were never part of that rule: analyze-text allows only verb /
-- expression roots (LEXEME360_ROOT_ALLOWED_POS) and Lexeme360.tsx documents
-- that expressions under nouns ("barn av sin tid", "i gammel tid") are fixed
-- phrases with a stable meaning, not a meaning-shift family. The first family
-- injection (20261007223000) took verb roots only. Before 10.10 the live
-- function was widened to verb + noun roots (recorded by 20261010213000) and
-- it never checked the Lexeme 360 subtype allowlist.
--
-- Change of public.d10_inject_verified_job_family_page_v1 (live definition is
-- patched in place, everything else stays byte-identical):
--   1. roots: l.pos IN ('verb', 'noun')  ->  l.pos = 'verb'   (2 places)
--   2. candidates also pass private.lexeme360_subtype_is_displayable_v1
--      (the same allowlist the root binding and the 360 display use;
--      empty subtype allowed, as there)                        (2 places)
--   3. version label -> d10_verified_verb_family_v3
-- Family items already injected in earlier jobs are NOT deleted or changed.

DO $patch$
DECLARE
  v_def text;
  v_pos_old constant text := $a$l.pos IN ('verb', 'noun')$a$;
  v_pos_new constant text := $a$l.pos = 'verb'$a$;
  v_lemma_old constant text := $a$nullif(btrim(e.lemma), '') IS NOT NULL$a$;
  v_lemma_new constant text := $a$nullif(btrim(e.lemma), '') IS NOT NULL
        AND private.lexeme360_subtype_is_displayable_v1(e.expression_subtype, true)$a$;
  v_ver_old constant text := $a$'d10_verified_noun_family_after_promotion_v2'$a$;
  v_ver_new constant text := $a$'d10_verified_verb_family_v3'$a$;
BEGIN
  v_def := pg_get_functiondef('public.d10_inject_verified_job_family_page_v1(uuid,integer)'::regprocedure);

  IF position('d10_verified_verb_family_v3' IN v_def) > 0 THEN
    RAISE NOTICE 'D10 family injection: verb-only rule already applied, nothing to do';
    RETURN;
  END IF;

  IF position('bound_lexeme_article_set' IN v_def) = 0
     OR (length(v_def) - length(replace(v_def, v_pos_old, ''))) / length(v_pos_old) <> 2
     OR (length(v_def) - length(replace(v_def, v_lemma_old, ''))) / length(v_lemma_old) <> 2
     OR (length(v_def) - length(replace(v_def, v_ver_old, ''))) / length(v_ver_old) <> 1
     OR position('lexeme360_subtype_is_displayable_v1' IN v_def) > 0 THEN
    RAISE EXCEPTION 'D10_FAMILY_VERB_PREFLIGHT: live d10_inject_verified_job_family_page_v1 differs from the expected base (20261013200100); nothing changed';
  END IF;

  v_def := replace(v_def, v_pos_old, v_pos_new);
  v_def := replace(v_def, v_lemma_old, v_lemma_new);
  v_def := replace(v_def, v_ver_old, v_ver_new);
  EXECUTE v_def;
  RAISE NOTICE 'D10 family injection: verb roots only + subtype allowlist';
END
$patch$;
