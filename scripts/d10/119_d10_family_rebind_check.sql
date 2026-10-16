-- 119_d10_family_rebind_check.sql (read only)
-- T1 functions installed; T2 expressions still without a family card;
-- T3 the like expressions and their card now.
SELECT 'T1 functions' AS part,
       CASE WHEN to_regprocedure('public.d10_rebind_expression_roots_v1(uuid[])') IS NOT NULL
             AND to_regprocedure('public.d10_rebind_job_expression_roots_v1(uuid)') IS NOT NULL
            THEN 'PASS' ELSE 'FAIL' END AS value
UNION ALL
SELECT 'T2 without family card', count(*)::text
FROM public.ordbokene_expression_candidates c
WHERE c.status IN ('promoted', 'duplicate') AND c.promoted_expression_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM private.lexeme360_expression_roots_v1 r WHERE r.expression_id = c.promoted_expression_id)
UNION ALL
SELECT 'T3 ' || e.lemma, coalesce(l.lemma || ' ' || l.pos, 'no family card')
FROM public.expression_catalog e
LEFT JOIN private.lexeme360_expression_roots_v1 r ON r.expression_id = e.id
LEFT JOIN public.lexemes l ON l.id = r.root_lexeme_id
WHERE e.lemma IN ('like tall', 'like for like', 'uten like', 'like seg');
