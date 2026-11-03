BEGIN;
-- A relation is an unordered pair of entity+sense endpoints. Directed checks remain evidence.
CREATE FUNCTION private.synonym_endpoint_key_v1(t text,i uuid,a bigint,s text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO pg_catalog AS $f$
 SELECT jsonb_build_array(t,i,a,lower(btrim(regexp_replace(coalesce(s,''),'\s+',' ','g'))))::text
$f$;
REVOKE ALL ON FUNCTION private.synonym_endpoint_key_v1(text,uuid,bigint,text) FROM PUBLIC,anon,authenticated;
CREATE VIEW private.synonym_sense_links_v1 AS
 WITH endpoints AS (
  SELECT x.*,p.verified_at,p.verification_evidence e,
   private.synonym_endpoint_key_v1(x.head_type,x.head_id,x.head_article,x.head_sense) a,
   private.synonym_endpoint_key_v1(x.target_type,x.target_id,x.target_article,x.target_sense) b
  FROM public.d10_synonym_pair_sides_v1() x
  JOIN public.synonym_pair_v1 p ON p.id=x.pair_id AND p.published
  JOIN public.synonym_candidate_queue c ON c.id=p.candidate_id AND c.source_active
 ), keyed AS (
  SELECT *,md5(jsonb_build_array(least(a,b),greatest(a,b),decision,
   CASE WHEN decision='verified_synonym' THEN NULL ELSE jsonb_build_array(
    CASE WHEN a<=b THEN e->'substitution_forward' ELSE e->'substitution_reverse' END,
    CASE WHEN a<=b THEN e->'substitution_reverse' ELSE e->'substitution_forward' END,
    e->'same_construction') END)::text) relation_key FROM endpoints
 )
 SELECT relation_key,(array_agg(pair_id ORDER BY verified_at DESC NULLS LAST,pair_id))[1] representative_pair_id,
  array_agg(pair_id ORDER BY pair_id) evidence_pair_ids
 FROM keyed GROUP BY relation_key;
REVOKE ALL ON private.synonym_sense_links_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.synonym_sense_links_v1 TO service_role;

DO $patch$
DECLARE def text:=pg_get_functiondef('public.get_synonym_carousel_v3(uuid)'::regprocedure);
BEGIN
 IF position('synonym_sense_links_v1' IN def)>0 THEN RETURN; END IF;
 IF position('FROM public.d10_synonym_pair_sides_v1() x' IN def)=0 THEN
  RAISE EXCEPTION 'carousel definition changed; no patch';
 END IF;
 def:=replace(def,'FROM public.d10_synonym_pair_sides_v1() x',
  'FROM public.d10_synonym_pair_sides_v1() x
  JOIN private.synonym_sense_links_v1 links ON links.representative_pair_id=x.pair_id');
 def:=replace(def,'WHERE card.cid <> p_lexeme_id',
  'WHERE card.cid <> p_lexeme_id AND l.dictionary_status IS DISTINCT FROM ''excluded''');
 EXECUTE def;
END $patch$;
COMMIT;
