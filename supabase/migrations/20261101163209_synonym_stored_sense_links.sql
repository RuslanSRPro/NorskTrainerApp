BEGIN;
CREATE TABLE private.synonym_sense_link_state_v1 (
 relation_key text PRIMARY KEY,family_key text NOT NULL,
 a_type text NOT NULL,a_id uuid NOT NULL,b_type text NOT NULL,b_id uuid NOT NULL,
 representative_pair_id uuid NOT NULL REFERENCES public.synonym_pair_v1(id) ON DELETE CASCADE,
 evidence_pair_ids uuid[] NOT NULL,payload jsonb NOT NULL,refreshed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.synonym_sense_link_state_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.synonym_sense_link_state_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.synonym_sense_link_state_v1 TO service_role;
CREATE INDEX synonym_sense_link_family_idx ON private.synonym_sense_link_state_v1(family_key);
CREATE INDEX synonym_sense_link_a_idx ON private.synonym_sense_link_state_v1(a_type,a_id);
CREATE INDEX synonym_sense_link_b_idx ON private.synonym_sense_link_state_v1(b_type,b_id);

CREATE FUNCTION private.synonym_family_key_v1(at text,ai uuid,bt text,bi uuid)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO pg_catalog AS $f$
 SELECT md5(jsonb_build_array(least(at||':'||ai,bt||':'||bi),greatest(at||':'||ai,bt||':'||bi))::text)
$f$;
CREATE FUNCTION private.synonym_endpoint_visible_v1(t text,i uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
 SELECT EXISTS(SELECT 1 FROM public.lexemes l WHERE l.id=CASE WHEN t='lexeme' THEN i ELSE
  (SELECT x.lexeme_id FROM public.expression_catalog x WHERE x.id=i) END
  AND l.dictionary_status IS DISTINCT FROM 'excluded')
$f$;

-- A view, not an opaque set-returning function: the family predicate is pushed into pair reads.
CREATE VIEW private.synonym_checked_pair_sides_v1 AS
 SELECT p.id pair_id,coalesce(c.gloss_id,c.bm_gloss_id) gloss_key,
  p.source_entity_type head_type,p.source_entity_id head_id,
  public.d10_synonym_entity_lemma_v1(p.source_entity_type,p.source_entity_id) head_lemma,
  nullif(btrim(c.naob_gloss),'') head_sense,
  p.target_entity_type target_type,p.target_entity_id target_id,
  public.d10_synonym_entity_lemma_v1(p.target_entity_type,p.target_entity_id) target_lemma,
  public.d10_synonym_target_sense_v1(p.verification_evidence,p.snapshot) target_sense,
  p.decision,p.verifier_version,p.verification_evidence->>'reason' reason,
  CASE WHEN coalesce(c.source_sense_anchor,'') LIKE 'sib:%' THEN
    CASE WHEN c.verification_evidence->>'source_article_id' ~ '^\d+$' THEN (c.verification_evidence->>'source_article_id')::bigint END
   ELSE (SELECT g.article_id FROM public.synonym_bm_gloss_v1 g WHERE g.id=c.bm_gloss_id) END head_article,
  CASE WHEN p.snapshot->'target'->>'article_id' ~ '^\d+$' THEN (p.snapshot->'target'->>'article_id')::bigint END target_article,
  c.bm_gloss_id
 FROM public.synonym_pair_v1 p JOIN public.synonym_candidate_queue c ON c.id=p.candidate_id
 WHERE p.status='done' AND p.decision IN ('verified_synonym','contextual_synonym') AND p.published AND c.source_active;
REVOKE ALL ON private.synonym_checked_pair_sides_v1 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.d10_refresh_synonym_sense_family_v1(at text,ai uuid,bt text,bi uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
DECLARE family text;written integer;
BEGIN
 IF ai IS NULL OR bi IS NULL THEN RETURN 0;END IF;
 family:=private.synonym_family_key_v1(at,ai,bt,bi);
 PERFORM pg_advisory_xact_lock(hashtextextended(family,20261102));
 DELETE FROM private.synonym_sense_link_state_v1 WHERE family_key=family;
 INSERT INTO private.synonym_sense_link_state_v1(relation_key,family_key,a_type,a_id,b_type,b_id,
   representative_pair_id,evidence_pair_ids,payload)
 WITH endpoints AS (
  SELECT x.*,p.verified_at,p.verification_evidence e,
   hp.sense_path head_path,hp.def_ord head_ord,tp.sense_path target_path,tp.def_ord target_ord,
   private.synonym_endpoint_key_v1(x.head_type,x.head_id,x.head_article,x.head_sense) a,
   private.synonym_endpoint_key_v1(x.target_type,x.target_id,x.target_article,x.target_sense) b
  FROM private.synonym_checked_pair_sides_v1 x
  JOIN public.synonym_pair_v1 p ON p.id=x.pair_id AND p.published
  JOIN public.synonym_candidate_queue c ON c.id=p.candidate_id AND c.source_active
  LEFT JOIN LATERAL public.d10_synonym_sense_path_v1(x.head_article,x.head_sense) hp ON true
  LEFT JOIN LATERAL public.d10_synonym_sense_path_v1(x.target_article,x.target_sense) tp ON true
  WHERE ((x.head_type=at AND x.head_id=ai AND x.target_type=bt AND x.target_id=bi)
   OR (x.head_type=bt AND x.head_id=bi AND x.target_type=at AND x.target_id=ai))
   AND private.synonym_endpoint_visible_v1(x.head_type,x.head_id)
   AND private.synonym_endpoint_visible_v1(x.target_type,x.target_id)
 ), keyed AS (
  SELECT *,md5(jsonb_build_array(least(a,b),greatest(a,b),decision,
   CASE WHEN decision='verified_synonym' THEN NULL ELSE jsonb_build_array(
    CASE WHEN a<=b THEN e->'substitution_forward' ELSE e->'substitution_reverse' END,
    CASE WHEN a<=b THEN e->'substitution_reverse' ELSE e->'substitution_forward' END,
    e->'same_construction') END)::text) link_key FROM endpoints
 )
 SELECT link_key,family,at,ai,bt,bi,
  (array_agg(pair_id ORDER BY verified_at DESC NULLS LAST,pair_id))[1],
  array_agg(pair_id ORDER BY pair_id),
  (array_agg(to_jsonb(k) ORDER BY verified_at DESC NULLS LAST,pair_id))[1]
 FROM keyed k GROUP BY link_key;
 GET DIAGNOSTICS written=ROW_COUNT;RETURN written;
END $f$;

CREATE FUNCTION private.synonym_sense_link_pair_changed_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
BEGIN
 IF TG_OP<>'INSERT' THEN
  PERFORM public.d10_refresh_synonym_sense_family_v1(OLD.source_entity_type,OLD.source_entity_id,OLD.target_entity_type,OLD.target_entity_id);
 END IF;
 IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND (NEW.source_entity_type,NEW.source_entity_id,NEW.target_entity_type,NEW.target_entity_id)
   IS DISTINCT FROM (OLD.source_entity_type,OLD.source_entity_id,OLD.target_entity_type,OLD.target_entity_id)) THEN
  PERFORM public.d10_refresh_synonym_sense_family_v1(NEW.source_entity_type,NEW.source_entity_id,NEW.target_entity_type,NEW.target_entity_id);
 END IF;
 RETURN NULL;
END $f$;
CREATE TRIGGER zz_synonym_stored_sense_links_v1 AFTER INSERT OR DELETE OR UPDATE OF
 status,decision,published,snapshot,verification_evidence,verified_at,source_entity_type,source_entity_id,target_entity_type,target_entity_id
 ON public.synonym_pair_v1 FOR EACH ROW EXECUTE FUNCTION private.synonym_sense_link_pair_changed_v1();

CREATE FUNCTION private.synonym_sense_link_entity_changed_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
DECLARE r record;ids uuid[];entity uuid;
BEGIN
 entity:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
 IF TG_TABLE_NAME='lexemes' THEN
  IF TG_OP='UPDATE' AND (OLD.lemma,OLD.pos,OLD.dictionary_status) IS NOT DISTINCT FROM (NEW.lemma,NEW.pos,NEW.dictionary_status) THEN RETURN NULL;END IF;
  SELECT ARRAY[entity]||coalesce(array_agg(x.id),'{}'::uuid[]) INTO ids FROM public.expression_catalog x WHERE x.lexeme_id=entity;
 ELSE
  IF TG_OP='UPDATE' AND (OLD.lemma,OLD.lexeme_id) IS NOT DISTINCT FROM (NEW.lemma,NEW.lexeme_id) THEN RETURN NULL;END IF;
  ids:=ARRAY[entity];
 END IF;
 FOR r IN SELECT DISTINCT p.source_entity_type at,p.source_entity_id ai,p.target_entity_type bt,p.target_entity_id bi
  FROM public.synonym_pair_v1 p WHERE p.source_entity_id=ANY(ids) OR p.target_entity_id=ANY(ids)
 LOOP PERFORM public.d10_refresh_synonym_sense_family_v1(r.at,r.ai,r.bt,r.bi);END LOOP;
 RETURN NULL;
END $f$;
CREATE TRIGGER zz_synonym_stored_lexeme_links_v1 AFTER DELETE OR UPDATE OF lemma,pos,dictionary_status
 ON public.lexemes FOR EACH ROW EXECUTE FUNCTION private.synonym_sense_link_entity_changed_v1();
CREATE TRIGGER zz_synonym_stored_expression_links_v1 AFTER DELETE OR UPDATE OF lemma,lexeme_id
 ON public.expression_catalog FOR EACH ROW EXECUTE FUNCTION private.synonym_sense_link_entity_changed_v1();

DO $fill$
DECLARE r record;
BEGIN
 FOR r IN SELECT DISTINCT ON (private.synonym_family_key_v1(p.source_entity_type,p.source_entity_id,p.target_entity_type,p.target_entity_id))
  p.source_entity_type at,p.source_entity_id ai,p.target_entity_type bt,p.target_entity_id bi
  FROM public.synonym_pair_v1 p WHERE p.published
  ORDER BY private.synonym_family_key_v1(p.source_entity_type,p.source_entity_id,p.target_entity_type,p.target_entity_id),p.id
 LOOP PERFORM public.d10_refresh_synonym_sense_family_v1(r.at,r.ai,r.bt,r.bi);END LOOP;
END $fill$;

CREATE OR REPLACE VIEW private.synonym_sense_links_v1 AS
 SELECT relation_key,representative_pair_id,evidence_pair_ids FROM private.synonym_sense_link_state_v1;
CREATE VIEW private.synonym_stored_pair_sides_v1 AS
 SELECT x.* FROM private.synonym_sense_link_state_v1 s CROSS JOIN LATERAL jsonb_to_record(s.payload) AS x(
  pair_id uuid,gloss_key uuid,head_type text,head_id uuid,head_lemma text,head_sense text,
  target_type text,target_id uuid,target_lemma text,target_sense text,decision text,verifier_version text,reason text,
  head_article bigint,target_article bigint,bm_gloss_id uuid,head_path text,head_ord integer,target_path text,target_ord integer);
REVOKE ALL ON private.synonym_stored_pair_sides_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.synonym_stored_pair_sides_v1 TO service_role;
REVOKE ALL ON FUNCTION private.synonym_family_key_v1(text,uuid,text,uuid),private.synonym_endpoint_visible_v1(text,uuid),
 private.synonym_sense_link_pair_changed_v1(),private.synonym_sense_link_entity_changed_v1(),
 public.d10_refresh_synonym_sense_family_v1(text,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d10_refresh_synonym_sense_family_v1(text,uuid,text,uuid) TO service_role;

DO $patch$
DECLARE def text:=pg_get_functiondef('public.get_synonym_carousel_v3(uuid)'::regprocedure);
BEGIN
 IF position('FROM public.d10_synonym_pair_sides_v1() x' IN def)=0 OR position('END tl,' IN def)=0 THEN
  RAISE EXCEPTION 'carousel read definition changed';END IF;
 def:=replace(def,'FROM public.d10_synonym_pair_sides_v1() x','FROM private.synonym_stored_pair_sides_v1 x');
 def:=replace(def,'JOIN private.synonym_sense_links_v1 links ON links.representative_pair_id=x.pair_id','');
 def:=replace(def,'END tl,','END tl,
    CASE WHEN forward THEN head_path ELSE target_path END ms_path,
    CASE WHEN forward THEN head_ord ELSE target_ord END ms_ord,');
 def:=replace(def,'LEFT JOIN LATERAL public.d10_synonym_sense_path_v1(i.ma,i.ms) sp ON true',
  'LEFT JOIN LATERAL (SELECT i.ms_path sense_path,i.ms_ord def_ord) sp ON true');
 def:=replace(def,'SELECT DISTINCT ON (i.pair_id, card.cid, i.ms)','SELECT');
 EXECUTE def;
END $patch$;
COMMIT;
