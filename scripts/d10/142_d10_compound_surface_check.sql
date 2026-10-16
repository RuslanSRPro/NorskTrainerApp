-- 142: compound forms in a text (D10_compound_surface_v1). Read only.
-- T1: vinterjakka resolves to the card vinterjakke via compound head forms.
-- B: every compound form the resolver now knows, one row per card (sample).
SELECT 'T1 vinterjakka' AS part,
       CASE WHEN EXISTS (SELECT 1 FROM public.resolve_surface_form_v2('vinterjakka') r WHERE r.lemma = 'vinterjakke')
            THEN 'PASS' ELSE 'FAIL' END AS value
UNION ALL
SELECT 'B ' || h.lemma, string_agg(DISTINCT v, ', ')
FROM public.lexeme_compound_head_forms_v1 h
CROSS JOIN LATERAL unnest(h.primary_values || h.alternative_values) AS v
GROUP BY h.lemma
ORDER BY 1
LIMIT 20;
