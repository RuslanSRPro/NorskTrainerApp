-- 98_d10_stage_d_live_test.sql
-- Read only. Live test after the package: analyze the single word "bok"
-- (Audit mode, button Check). When the job has finished (✅), run this. Short columns.
-- v2 (14.10): the card row shows the translations the app shows.
-- Expected:
--   item bok (noun) ''      promoted, main card (book)
--   item bok (noun) 'II'    homograph_card, promoted to the second card (beech)
--   decision 106786 r9_card
--   card II: article 106786, its own forms boker/bokene, translation (AI)
WITH job AS (
  SELECT j.id FROM public.lexeme_processing_jobs j
  WHERE lower(btrim(j.input_text)) IN ('bok', 'bok.')
  ORDER BY j.created_at DESC LIMIT 1
)
SELECT 'item' AS kind,
       coalesce(i.normalized_lemma, i.raw_input) || ' (' || coalesce(i.pos, '?') || ') ' || coalesce(nullif(l.homograph_key, ''), 'main') AS name,
       concat_ws(' | ', i.current_stage, i.result_summary->>'promotion_status',
         i.result_summary->>'match_strategy', i.result_summary->>'admission_reason') AS detail
FROM public.lexeme_processing_items i
JOIN job ON job.id = i.job_id
LEFT JOIN public.lexemes l ON l.id = i.lexeme_id
UNION ALL
SELECT 'decision', d.article_id::text || ' ' || d.decision,
       concat_ws(' | ', 'hgno ' || d.hgno, d.evidence->>'reason')
FROM private.d10_homograph_article_decisions_v1 d
JOIN public.lexemes m ON m.id = d.main_lexeme_id
WHERE m.lemma = 'bok'
UNION ALL
SELECT 'card', l.lemma || ' ' || coalesce(nullif(l.homograph_key, ''), 'main'),
       concat_ws(' | ',
         'articles ' || public.d10_lexeme_article_ids_v1(l.id)::text,
         'forms ' || (SELECT string_agg(DISTINCT v, ',') FROM public.lexeme_form_display_v2 f
                      CROSS JOIN LATERAL unnest(f.primary_values) v WHERE f.lexeme_id = l.id),
         -- translations exactly as the app shows them (definitions not included)
         'app ' || (SELECT string_agg(c.language_code || ': ' || c.translation, ' ; ' ORDER BY c.language_code)
                    FROM public.get_canonical_lexeme_translations_v1(ARRAY[l.id]) c))
FROM public.lexemes l WHERE l.lemma = 'bok' AND l.pos = 'noun'
ORDER BY 1 DESC, 2;
