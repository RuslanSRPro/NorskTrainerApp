BEGIN;
DO $patch$
DECLARE def text:=pg_get_functiondef('public.d10_synonym_publish_link_v1(text,uuid,text,uuid)'::regprocedure);
 anchor text:=$a$p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym')$a$;
BEGIN
 IF position('private.synonym_endpoint_visible_v1' IN def)=0 THEN
  IF position(anchor IN def)=0 THEN RAISE EXCEPTION 'publication condition changed';END IF;
  def:=replace(def,anchor,anchor||$a$
    AND EXISTS(SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id=p.candidate_id AND c.source_active)
    AND private.synonym_endpoint_visible_v1(p_a_type,p_a_id)
    AND private.synonym_endpoint_visible_v1(p_b_type,p_b_id)$a$);
  EXECUTE def;
 END IF;
 def:=pg_get_functiondef('private.synonym_sense_link_entity_changed_v1()'::regprocedure);
 IF position('d10_synonym_publish_link_v1' IN def)=0 THEN
  anchor:='LOOP PERFORM public.d10_refresh_synonym_sense_family_v1(r.at,r.ai,r.bt,r.bi);END LOOP;';
  IF position(anchor IN def)=0 THEN RAISE EXCEPTION 'entity refresh anchor changed';END IF;
  EXECUTE replace(def,anchor,'LOOP
   PERFORM public.d10_synonym_publish_link_v1(r.at,r.ai,r.bt,r.bi);
   PERFORM public.d10_refresh_synonym_sense_family_v1(r.at,r.ai,r.bt,r.bi);
  END LOOP;');
 END IF;
END $patch$;

CREATE OR REPLACE FUNCTION private.synonym_sense_link_pair_changed_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
BEGIN
 IF TG_OP='UPDATE' AND
  (OLD.status,OLD.decision,OLD.published,OLD.snapshot,OLD.verification_evidence,OLD.verifier_version,OLD.verified_at,
   OLD.source_entity_type,OLD.source_entity_id,OLD.target_entity_type,OLD.target_entity_id)
  IS NOT DISTINCT FROM
  (NEW.status,NEW.decision,NEW.published,NEW.snapshot,NEW.verification_evidence,NEW.verifier_version,NEW.verified_at,
   NEW.source_entity_type,NEW.source_entity_id,NEW.target_entity_type,NEW.target_entity_id) THEN RETURN NULL; END IF;
 IF TG_OP='DELETE' THEN
  PERFORM public.d10_synonym_publish_link_v1(OLD.source_entity_type,OLD.source_entity_id,OLD.target_entity_type,OLD.target_entity_id);
 END IF;
 IF TG_OP<>'INSERT' THEN
  PERFORM public.d10_refresh_synonym_sense_family_v1(OLD.source_entity_type,OLD.source_entity_id,OLD.target_entity_type,OLD.target_entity_id);
 END IF;
 IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND (NEW.source_entity_type,NEW.source_entity_id,NEW.target_entity_type,NEW.target_entity_id)
   IS DISTINCT FROM (OLD.source_entity_type,OLD.source_entity_id,OLD.target_entity_type,OLD.target_entity_id)) THEN
  PERFORM public.d10_refresh_synonym_sense_family_v1(NEW.source_entity_type,NEW.source_entity_id,NEW.target_entity_type,NEW.target_entity_id);
 END IF;
 RETURN NULL;
END $f$;
DROP TRIGGER zz_synonym_stored_sense_links_v1 ON public.synonym_pair_v1;
CREATE TRIGGER zz_synonym_stored_sense_links_v1 AFTER INSERT OR DELETE OR UPDATE OF
 status,decision,published,snapshot,verification_evidence,verifier_version,verified_at,source_entity_type,source_entity_id,target_entity_type,target_entity_id
 ON public.synonym_pair_v1 FOR EACH ROW EXECUTE FUNCTION private.synonym_sense_link_pair_changed_v1();
DO $repair$
DECLARE r record;
BEGIN
 FOR r IN SELECT DISTINCT p.source_entity_type at,p.source_entity_id ai,p.target_entity_type bt,p.target_entity_id bi
 FROM public.synonym_pair_v1 p WHERE p.published AND
 (NOT private.synonym_endpoint_visible_v1(p.source_entity_type,p.source_entity_id)
  OR NOT private.synonym_endpoint_visible_v1(p.target_entity_type,p.target_entity_id)
  OR NOT EXISTS(SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id=p.candidate_id AND c.source_active))
 LOOP
  PERFORM public.d10_synonym_publish_link_v1(r.at,r.ai,r.bt,r.bi);
  PERFORM public.d10_refresh_synonym_sense_family_v1(r.at,r.ai,r.bt,r.bi);
 END LOOP;
END $repair$;
COMMIT;
