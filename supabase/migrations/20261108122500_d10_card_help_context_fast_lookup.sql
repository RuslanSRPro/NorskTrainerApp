-- Keep the help payload unchanged; find the last analysis through indexed card IDs.
CREATE INDEX IF NOT EXISTS lexeme_processing_items_help_lexeme_idx
  ON public.lexeme_processing_items (lexeme_id, job_id)
  WHERE lexeme_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS lexeme_processing_items_help_expression_idx
  ON public.lexeme_processing_items (expression_id, job_id)
  WHERE expression_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS expression_catalog_help_lexeme_idx
  ON public.expression_catalog (lexeme_id, id)
  WHERE lexeme_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_card_help_context_v1(p_lexeme_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
WITH card AS (
  SELECT id FROM public.lexemes WHERE id = p_lexeme_id
  UNION
  SELECT l.id
  FROM public.expression_catalog x
  JOIN public.lexemes l ON l.id = x.lexeme_id
  WHERE x.id = p_lexeme_id
),
job_hits AS (
  SELECT i.job_id
  FROM public.lexeme_processing_items i
  WHERE i.lexeme_id IN (SELECT id FROM card)
  UNION
  SELECT i.job_id
  FROM public.expression_catalog x
  JOIN public.lexeme_processing_items i ON i.expression_id = x.id
  WHERE x.lexeme_id IN (SELECT id FROM card)
)
SELECT jsonb_build_object(
  'analysis', (
    SELECT jsonb_build_object('started_at', j.created_at, 'finished_at', j.finished_at,
      'status', j.status, 'kind', j.input_type)
    FROM job_hits h
    JOIN public.lexeme_processing_jobs j ON j.id = h.job_id
    ORDER BY j.created_at DESC LIMIT 1
  ),
  'expression_source', (
    SELECT CASE x.expression_subtype
      WHEN 'naob_expression' THEN 'NAOB'
      WHEN 'ordbokene_sub_article' THEN 'Ordbøkene'
    END
    FROM public.expression_catalog x
    WHERE x.lexeme_id IN (SELECT id FROM card)
      AND x.expression_subtype IN ('naob_expression', 'ordbokene_sub_article')
    ORDER BY CASE WHEN x.id = p_lexeme_id THEN 0 ELSE 1 END, x.id
    LIMIT 1
  ),
  'alternatives', '[]'::jsonb
)
WHERE EXISTS (SELECT 1 FROM card);
$function$;
