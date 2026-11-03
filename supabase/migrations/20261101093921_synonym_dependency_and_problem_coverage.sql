BEGIN;
CREATE FUNCTION private.d10_problem_cards_all_v4()
RETURNS TABLE(lexeme_id uuid,lemma text,pos text,display_form text,homograph_key text,
 missing_translation boolean,missing_example boolean,review_reason text,legacy boolean,
 deferred_by_policy boolean,deferred_facets text[],synonym_status text,synonym_checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
WITH learning AS MATERIALIZED (SELECT l.* FROM public.lexemes l
 WHERE l.is_learning_lexeme OR EXISTS(SELECT 1 FROM public.expression_catalog x WHERE x.lexeme_id=l.id)),
 translated AS MATERIALIZED (
 SELECT t.lexeme_id,bool_or(t.language_code='uk') uk,bool_or(t.language_code='en') en
 FROM public.get_canonical_lexeme_translations_v1((SELECT coalesce(array_agg(id),'{}'::uuid[]) FROM learning)) t
 WHERE nullif(btrim(t.translation),'') IS NOT NULL GROUP BY t.lexeme_id),
 cards AS MATERIALIZED (
 SELECT l.*,NOT(coalesce(tr.uk,false) AND coalesce(tr.en,false)) missing_translation,
 NOT EXISTS(SELECT 1 FROM public.entity_examples e WHERE e.language_code='nb'
 AND e.example_text ~ '[[:alpha:]]' AND e.example_text !~* '^[[:space:]]*(https?://|<)'
 AND ((e.lexeme_id=l.id AND e.expression_id IS NULL) OR EXISTS(
 SELECT 1 FROM public.expression_catalog x WHERE x.id=e.expression_id AND x.lexeme_id=l.id))) missing_example
 FROM learning l LEFT JOIN translated tr ON tr.lexeme_id=l.id),
 base AS MATERIALIZED (
 SELECT c.id lexeme_id,c.lemma,c.pos,c.display_form,coalesce(c.homograph_key,'') homograph_key,
 c.missing_translation,c.missing_example,r.reason review_reason,coalesce(c.pos,'unknown')='unknown' legacy,
 d.lexeme_id IS NOT NULL deferred_by_policy,d.facets deferred_facets
 FROM cards c LEFT JOIN private.d10_ai_review_rejections_v1 r ON r.lexeme_id=c.id
 LEFT JOIN private.d10_deferred_enrichment_v1 d ON d.lexeme_id=c.id
 WHERE c.missing_translation OR c.missing_example OR d.lexeme_id IS NOT NULL),
 states AS MATERIALIZED (
  SELECT DISTINCT ON (card_id) card_id,state
  FROM (SELECT CASE WHEN s.entity_type='lexeme' THEN s.entity_id ELSE x.lexeme_id END card_id,
     public.d10_synonym_entity_status_v1(s.entity_type,s.entity_id) state
   FROM private.synonym_collection_state_v1 s
   LEFT JOIN public.expression_catalog x ON s.entity_type='expression' AND x.id=s.entity_id) q
  WHERE card_id IS NOT NULL ORDER BY card_id,CASE state->>'status' WHEN 'error' THEN 0 WHEN 'waiting' THEN 1 WHEN 'deferred' THEN 2 ELSE 3 END
 ), ids AS (
  SELECT b.lexeme_id id FROM base b UNION SELECT card_id FROM states WHERE state->>'status' IN ('error','waiting','deferred')
 )
 SELECT l.id,l.lemma,l.pos,l.display_form,coalesce(l.homograph_key,''),
  coalesce(b.missing_translation,false),coalesce(b.missing_example,false),b.review_reason,coalesce(b.legacy,false),
  coalesce(b.deferred_by_policy,false),b.deferred_facets,s.state->>'status',(s.state->>'checked_at')::timestamptz
 FROM ids JOIN public.lexemes l ON l.id=ids.id LEFT JOIN base b ON b.lexeme_id=l.id LEFT JOIN states s ON s.card_id=l.id
 ORDER BY coalesce(b.missing_translation,false) DESC,(s.state->>'status'='error') DESC NULLS LAST,l.lemma,l.id

$f$;
REVOKE ALL ON FUNCTION private.d10_problem_cards_all_v4() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.d10_problem_cards_v4(p_limit integer DEFAULT 300,p_offset integer DEFAULT 0)
RETURNS TABLE(lexeme_id uuid,lemma text,pos text,display_form text,homograph_key text,
 missing_translation boolean,missing_example boolean,review_reason text,legacy boolean,
 deferred_by_policy boolean,deferred_facets text[],synonym_status text,synonym_checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 SELECT * FROM private.d10_problem_cards_all_v4()
 ORDER BY missing_translation DESC,(synonym_status='error') DESC NULLS LAST,lemma,lexeme_id
 LIMIT least(greatest(coalesce(p_limit,300),1),1000) OFFSET greatest(coalesce(p_offset,0),0)
$f$;
CREATE OR REPLACE FUNCTION public.d10_problem_cards_count_v3() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 SELECT count(*)::integer FROM private.d10_problem_cards_all_v4()
$f$;
REVOKE ALL ON FUNCTION public.d10_problem_cards_v4(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.d10_problem_cards_v4(integer,integer) TO anon,authenticated,service_role;
-- Re-use successfully audited cards for existing candidates, including deferred generation.
-- Never create a child job or discover another generation here.
CREATE OR REPLACE FUNCTION public.d10_synonym_prepare_for_job_v1(p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
DECLARE r record; n integer:=0; v jsonb;
BEGIN
 WITH changed AS (
  SELECT DISTINCT 'lexeme'::text kind,l.id,lower(btrim(l.lemma)) norm,l.id card_id,l.verification_status,l.dictionary_status
  FROM public.lexeme_processing_items i JOIN public.lexemes l ON l.id=i.lexeme_id
  WHERE i.job_id=p_job_id AND i.status='done' AND l.pos NOT IN ('unknown','expression')
   AND coalesce(i.result_summary->>'promotion_status','')<>'not_promoted'
  UNION
  SELECT DISTINCT 'expression',x.id,lower(btrim(x.lemma)),x.lexeme_id,x.verification_status,'active'
  FROM public.lexeme_processing_items i JOIN public.expression_catalog x ON x.id=i.expression_id
  WHERE i.job_id=p_job_id AND i.status='done'
   AND coalesce(i.result_summary->>'promotion_status','')<>'not_promoted'
 ), ready AS (
  SELECT a.* FROM changed a WHERE a.dictionary_status='active'
   AND a.verification_status IN ('multi_source','usage_verified','authoritative','verified','source_verified','multi_source_verified')
   AND EXISTS(SELECT 1 FROM public.get_canonical_lexeme_translations_v1(ARRAY[a.card_id]) t
    WHERE t.language_code='uk' AND nullif(btrim(t.translation),'') IS NOT NULL)
   AND EXISTS(SELECT 1 FROM public.get_canonical_lexeme_translations_v1(ARRAY[a.card_id]) t
    WHERE t.language_code='en' AND nullif(btrim(t.translation),'') IS NOT NULL)
 )
 UPDATE public.synonym_candidate_queue c SET dispatch_status='skipped_ready',
  target_entity_ids=public.d10_synonym_target_entities_v1(lower(btrim(c.target_text)),c.target_kind),
  stage1_status='waiting_enrichment',enrichment_done_at=now(),updated_at=now(),
  verification_evidence=(coalesce(c.verification_evidence,'{}'::jsonb)-'enrichment_blocked'-'enrichment_block_reason')
    ||jsonb_build_object('ready_after_analysis',p_job_id)
 WHERE c.source_active AND c.dispatch_status IN ('deferred_depth','not_dispatchable','pending','awaiting_parent')
 AND EXISTS(SELECT 1 FROM ready a WHERE a.kind=c.target_kind AND a.norm=lower(btrim(c.target_text)));

 FOR r IN
  WITH cards AS (
   SELECT lexeme_id id FROM public.lexeme_processing_items WHERE job_id=p_job_id AND lexeme_id IS NOT NULL
   UNION SELECT expression_id FROM public.lexeme_processing_items WHERE job_id=p_job_id AND expression_id IS NOT NULL
  ), names AS (
   SELECT 'lexeme'::text kind,lower(btrim(l.lemma)) norm FROM cards a JOIN public.lexemes l ON l.id=a.id
   UNION SELECT 'expression',lower(btrim(x.lemma)) FROM cards a JOIN public.expression_catalog x ON x.id=a.id
  )
  SELECT c.id FROM public.synonym_candidate_queue c
  WHERE c.source_active AND c.dispatch_status IN ('enrichment_done','skipped_ready')
   AND (c.source_job_id=p_job_id OR c.child_job_id=p_job_id OR c.source_entity_id IN (SELECT id FROM cards)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(c.target_entity_ids) e WHERE (e->>'id')::uuid IN (SELECT id FROM cards))
    OR EXISTS(SELECT 1 FROM names a WHERE a.kind=c.target_kind AND a.norm=lower(btrim(c.target_text))))
 LOOP
  PERFORM public.d10_synonym_enqueue_refresh_v1(r.id,p_job_id,'analysis_completed');n:=n+1;
 END LOOP;
 v:=public.d10_synonym_drain_refresh_v1(50);
 RETURN jsonb_build_object('ok',true,'candidates',n,'refresh',v);
END $f$;
COMMIT;
