BEGIN;
CREATE FUNCTION public.d10_synonym_unresolved_v2(p_limit integer DEFAULT 300,p_offset integer DEFAULT 0)
RETURNS TABLE(target_text text,target_kind text,reason text,root_lemmas text[],naob_glosses text[],
 candidate_ids uuid[],child_job_id uuid,updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 SELECT lower(btrim(c.target_text)),c.target_kind,
 CASE WHEN bool_or(c.dispatch_status='not_dispatchable') THEN 'not_dispatchable' ELSE 'no_target_card' END,
 array_remove(array_agg(DISTINCT c.root_synonym_lemma),NULL),
 array_remove(array_agg(DISTINCT c.naob_gloss),NULL),array_agg(c.id ORDER BY c.id),
 (array_agg(c.child_job_id ORDER BY c.updated_at DESC) FILTER(WHERE c.child_job_id IS NOT NULL))[1],max(c.updated_at)
 FROM public.synonym_candidate_queue c
 WHERE c.source_active AND c.origin_depth=0
 AND (c.dispatch_status='not_dispatchable' OR
  (c.dispatch_status IN ('enrichment_done','skipped_ready') AND c.target_entity_ids='[]'::jsonb))
 AND coalesce(c.verification_evidence->'stage_a'->>'reason','')<>'naob_explanation'
 GROUP BY 1,2 ORDER BY 8 DESC,1,2
 LIMIT least(greatest(coalesce(p_limit,300),1),1000) OFFSET greatest(coalesce(p_offset,0),0)
$f$;
CREATE OR REPLACE FUNCTION public.d10_synonym_unresolved_v1(p_limit integer DEFAULT 300)
RETURNS TABLE(target_text text,target_kind text,reason text,root_lemmas text[],naob_glosses text[],
 candidate_ids uuid[],child_job_id uuid,updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
 SELECT * FROM public.d10_synonym_unresolved_v2(p_limit,0)
$f$;
REVOKE ALL ON FUNCTION public.d10_synonym_unresolved_v2(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.d10_synonym_unresolved_v2(integer,integer) TO authenticated,service_role;
COMMIT;
