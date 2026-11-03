BEGIN;
CREATE FUNCTION public.get_card_help_context_v1(p_lexeme_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
 WITH card AS (SELECT id,lemma FROM public.lexemes WHERE id=p_lexeme_id),
 master AS (SELECT language_code,translation FROM public.get_canonical_lexeme_translations_v1(ARRAY[p_lexeme_id])),
 alternatives AS (
  SELECT DISTINCT g.article_id,g.sense_path,g.gloss_text definition_nb,l.uk,l.en
  FROM public.synonym_bm_gloss_v1 g JOIN card c ON c.id=g.lexeme_id
  JOIN public.synonym_sense_label_v1 l ON l.sense_key=public.d10_synonym_sense_key_v1(c.lemma,g.gloss_text) AND l.status='done'
  WHERE (nullif(btrim(l.uk),'') IS NOT NULL OR nullif(btrim(l.en),'') IS NOT NULL)
   AND NOT EXISTS(SELECT 1 FROM master m WHERE
    (m.language_code='uk' AND nullif(btrim(l.uk),'') IS NOT NULL AND lower(btrim(l.uk))=ANY(regexp_split_to_array(lower(m.translation),'\s*[,;]\s*')))
    OR (m.language_code='en' AND nullif(btrim(l.en),'') IS NOT NULL AND lower(btrim(l.en))=ANY(regexp_split_to_array(lower(m.translation),'\s*[,;]\s*'))))
 )
 SELECT jsonb_build_object('analysis',(SELECT jsonb_build_object('started_at',j.created_at,'finished_at',j.finished_at,
   'status',j.status,'kind',j.input_type)
  FROM public.lexeme_processing_jobs j WHERE EXISTS(SELECT 1 FROM public.lexeme_processing_items i
   WHERE i.job_id=j.id AND (i.lexeme_id=p_lexeme_id OR EXISTS(SELECT 1 FROM public.expression_catalog x
    WHERE x.id=i.expression_id AND x.lexeme_id=p_lexeme_id))) ORDER BY j.created_at DESC LIMIT 1),
  'alternatives',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.article_id,a.sense_path,a.definition_nb) FROM alternatives a),'[]'::jsonb))
 WHERE EXISTS(SELECT 1 FROM card)
$f$;
REVOKE ALL ON FUNCTION public.get_card_help_context_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_card_help_context_v1(uuid) TO authenticated,service_role;
COMMIT;
