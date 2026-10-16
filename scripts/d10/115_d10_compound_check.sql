-- 115_d10_compound_check.sql
-- Read only. After migration 20261015160000:
--   T1 objects installed (PASS);
--   A  splits written by the new rules (last 15);
--   B  words with forms by the head (rows per word);
--   C  words waiting for review (ambiguous split);
--   D  vinterjakke: split, forms, coloring parts.
SELECT 'T1 objects' AS part,
       CASE WHEN to_regclass('public.lexeme_compound_head_forms_v1') IS NOT NULL
             AND to_regclass('private.d10_compound_review_v1') IS NOT NULL
             AND to_regprocedure('public.d10_write_compound_analysis_v1(uuid,text[],text[],text,numeric,jsonb)') IS NOT NULL
             AND to_regprocedure('public.d10_publish_compound_head_forms_v1(uuid,uuid[],jsonb)') IS NOT NULL
             AND to_regprocedure('public.d10_record_compound_review_v1(uuid,text,jsonb)') IS NOT NULL
             AND to_regprocedure('public.d10_compound_candidates_for_lexemes_v1(uuid[])') IS NOT NULL
             AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lexeme_compound_head_forms_v1')
            THEN 'PASS' ELSE 'FAIL' END AS name,
       '' AS detail
UNION ALL
SELECT * FROM (
  SELECT 'A split', l.lemma || ' (' || l.pos || ')',
         replace(a.notes, 'd10_compound_v1:', '') || ' | '
         || coalesce(array_to_string(public.d10_verified_compound_parts(l.id, l.lemma), '+'), '-')
         || ' ' || to_char(a.created_at, 'MM-DD HH24:MI')
  FROM public.lexeme_compound_analyses a JOIN public.lexemes l ON l.id = a.compound_lexeme_id
  WHERE a.notes LIKE 'd10_compound_v1:%'
  ORDER BY a.created_at DESC LIMIT 15
) a
UNION ALL
SELECT * FROM (
  SELECT 'B head forms', h.lemma, count(*) || ' rows from ' || min(h.head_lemma)
         || ' | ' || string_agg(array_to_string(h.primary_values, '/'), ', ' ORDER BY h.display_order)
  FROM public.lexeme_compound_head_forms_v1 h
  GROUP BY h.lexeme_id, h.lemma
  ORDER BY max(h.updated_at) DESC LIMIT 15
) b
UNION ALL
SELECT * FROM (
  SELECT 'C review', l.lemma, r.reason || ' ' || left(r.candidates::text, 150)
  FROM private.d10_compound_review_v1 r JOIN public.lexemes l ON l.id = r.lexeme_id
  ORDER BY r.recorded_at DESC LIMIT 15
) c
UNION ALL
SELECT 'D vinterjakke',
       coalesce(array_to_string(public.d10_verified_compound_parts(l.id, l.lemma), '+'), 'no split'),
       (SELECT count(*) FROM public.lexeme_compound_head_forms_v1 h WHERE h.lexeme_id = l.id) || ' head rows, '
       || (SELECT count(*) FROM public.lexeme_form_display_v2 f WHERE f.lexeme_id = l.id) || ' own rows'
FROM public.lexemes l WHERE lower(l.lemma) = 'vinterjakke';
