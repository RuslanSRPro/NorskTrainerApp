CREATE OR REPLACE FUNCTION public.get_active_pipeline_jobs(p_limit integer DEFAULT 200)
 RETURNS TABLE(id uuid, status text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  WITH cutoff AS (
    SELECT (value #>> '{}')::timestamptz AS installed_at
    FROM private.d10_runtime_settings_v1 WHERE key='enrichment_residue_cutoff'
  )
  SELECT j.id,j.status,j.created_at
  FROM public.lexeme_processing_jobs j
  LEFT JOIN public.pipeline_supervisor_state s ON s.job_id=j.id
  LEFT JOIN cutoff ON true
  WHERE j.status IN ('pending','processing','ready','done','retry_scheduled','partial')
    AND (s.stage IS NULL OR s.stage NOT IN ('done','needs_manual_review'))
    AND (j.status<>'partial' OR j.created_at>=coalesce(cutoff.installed_at,'infinity'::timestamptz))
  ORDER BY j.created_at LIMIT greatest(1,least(coalesce(p_limit,200),200));
$function$

