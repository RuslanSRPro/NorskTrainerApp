-- D10_hete_naob_family_reset_v1 (11.11.2026, after 460): the NAOB family bindings of the two hete verb cards were
-- made from ALL NAOB verb articles of "hete" (main: hete_2 + hete_3, hete II: hete_1 + hete_3), so "hete opp" (heat
-- up) sits on "be called" and "hete etter" on both. They are removed; the next analysis of "hete" binds them again
-- with the fixed naob-family-expressions-worker (only the NAOB articles whose forms match the card). Ordbøkene
-- sub-article bindings (exact by article, e.g. hete seg) are not touched. Saved first. Re-run = removes nothing more.
-- At the end: other homograph verb groups that also have NAOB family bindings (for a later reset, nothing changed).
CREATE TABLE IF NOT EXISTS private.d10_naob_family_reset_backup_v1 (
  id bigserial PRIMARY KEY, row_data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.d10_naob_family_reset_backup_v1 FROM PUBLIC;

INSERT INTO private.d10_naob_family_reset_backup_v1 (row_data)
SELECT to_jsonb(b) FROM private.lexeme360_expression_roots_v1 b
JOIN public.lexemes l ON l.id = b.root_lexeme_id
WHERE l.lemma = 'hete' AND l.pos = 'verb' AND b.source_kind = 'naob_parent_article';

DELETE FROM private.lexeme360_expression_roots_v1 b
USING public.lexemes l
WHERE l.id = b.root_lexeme_id AND l.lemma = 'hete' AND l.pos = 'verb' AND b.source_kind = 'naob_parent_article';

SELECT 'removed_hete' AS part, count(*)::text AS info FROM private.d10_naob_family_reset_backup_v1
WHERE row_data->>'source_kind' = 'naob_parent_article'
UNION ALL
SELECT 'other_homograph_groups_with_naob_family', string_agg(DISTINCT l.lemma || ' (' || l.pos || ')', ', ')
FROM private.lexeme360_expression_roots_v1 b
JOIN public.lexemes l ON l.id = b.root_lexeme_id
WHERE b.source_kind = 'naob_parent_article'
  AND EXISTS (SELECT 1 FROM public.lexemes s WHERE s.lemma = l.lemma AND s.pos = l.pos AND s.id <> l.id);
