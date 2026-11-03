BEGIN;
-- Retain historical labels, but no new standalone translations or label-only wakeups.
CREATE OR REPLACE FUNCTION public.d10_synonym_sense_lease_v1(p_limit integer DEFAULT 40)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO pg_catalog AS $f$
 SELECT jsonb_build_object('rows','[]'::jsonb,'reason','canonical_pipeline_only')
$f$;
DO $p$
DECLARE d text:=pg_get_functiondef('public.d10_synonym_verifier_pending_v1()'::regprocedure);
BEGIN
 d:=regexp_replace(d,E'\\r','','g');
 d:=left(d,position('+ (SELECT count(*)::integer FROM public.synonym_sense_label_v1 s' IN d)-1)||E';\n$function$';
 IF position('FROM public.synonym_sense_label_v1' IN d)>0 THEN RAISE EXCEPTION 'pending anchor changed'; END IF;
 EXECUTE d;
END $p$;

CREATE OR REPLACE FUNCTION public.d10_synonym_rule_verify_v1(p_limit integer DEFAULT 500)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO pg_catalog AS $f$
 SELECT jsonb_build_object('ok',true,'verified_by_rule',0,'reason','mutual_reference_is_evidence_only')
$f$;
CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_version_v1() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS $f$
 SELECT 'ai:synonym_pair_v9:'||model FROM public.synonym_verifier_config_v1 WHERE singleton
$f$;

CREATE FUNCTION private.synonym_card_ready_v1(t text,i uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 WITH card AS (
 SELECT l.* FROM public.lexemes l WHERE l.id=CASE WHEN t='expression' THEN
 (SELECT x.lexeme_id FROM public.expression_catalog x WHERE x.id=i) ELSE i END)
 SELECT EXISTS(SELECT 1 FROM card c WHERE c.dictionary_status IS DISTINCT FROM 'excluded'
 AND c.verification_status IN ('multi_source','usage_verified','authoritative','verified','source_verified','multi_source_verified')
 AND NOT EXISTS(SELECT 1 FROM private.d10_ai_review_rejections_v1 r WHERE r.lexeme_id=c.id)
 AND (SELECT count(DISTINCT language_code)=2 FROM public.get_canonical_lexeme_translations_v1(ARRAY[c.id])
 WHERE language_code IN ('uk','en') AND nullif(btrim(translation),'') IS NOT NULL))
$f$;
CREATE FUNCTION private.synonym_publishable_v1(p public.synonym_pair_v1) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
 SELECT coalesce(p.status='done' AND p.decision='verified_synonym'
 AND p.verification_evidence->>'publication_ready'='true'
 AND p.verification_evidence->>'source_translation_matches'='true'
 AND p.verification_evidence->>'target_translation_matches'='true'
 AND p.verification_evidence->>'additional_restriction'='false'
 AND p.verification_evidence->>'substitution_forward'='true'
 AND p.verification_evidence->>'substitution_reverse'='true'
 AND p.verification_evidence->>'same_construction'='true'
 AND private.synonym_card_ready_v1(p.source_entity_type,p.source_entity_id)
 AND private.synonym_card_ready_v1(p.target_entity_type,p.target_entity_id),false)
$f$;
REVOKE ALL ON FUNCTION private.synonym_card_ready_v1(text,uuid),private.synonym_publishable_v1(public.synonym_pair_v1) FROM PUBLIC,anon,authenticated;

DO $p$
DECLARE d text; anchor text;
BEGIN
 d:=pg_get_functiondef('public.d10_synonym_publish_link_v1(text,uuid,text,uuid)'::regprocedure);
 anchor:='p.status = ''done'' AND p.decision IN (''verified_synonym'', ''contextual_synonym'')';
 IF position(anchor IN d)=0 THEN RAISE EXCEPTION 'publish anchor changed'; END IF;
 EXECUTE replace(d,anchor,'private.synonym_publishable_v1(p)');
 d:=pg_get_functiondef('public.d10_synonym_prepare_candidate_v1(uuid,boolean)'::regprocedure);
 anchor:='        -- cheap rules';
 IF position(anchor IN d)=0 THEN RAISE EXCEPTION 'prepare anchor changed'; END IF;
 d:=replace(d,anchor,$a$
        IF v_status='queued' AND (NOT private.synonym_card_ready_v1(c.source_entity_type,c.source_entity_id)
          OR NOT private.synonym_card_ready_v1(v_card.etype,v_card.eid)) THEN
          v_status:='needs_manual_review'; v_reason:='standard_enrichment_not_ready';
        END IF;
$a$||anchor);
 EXECUTE d;
 -- Existing clients must not receive legacy AI sense labels either.
 d:=pg_get_functiondef('public.get_synonym_carousel_v3(uuid)'::regprocedure);
 d:=replace(d,'ml.uk, ml.en, i.ts, tl.uk, tl.en','NULL::text, NULL::text, i.ts, NULL::text, NULL::text');
 d:=regexp_replace(d,'LEFT JOIN public.synonym_sense_label_v1 [^\n\r]*','','g');
 EXECUTE d;
 d:=pg_get_functiondef('public.get_card_help_context_v1(uuid)'::regprocedure);
 -- Keep the analysis date and response contract, remove the unused label query entirely.
 d:=regexp_replace(d,',\s*master AS [\s\S]*?\n SELECT jsonb_build_object',E'\n SELECT jsonb_build_object');
 d:=replace(d,'coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.article_id,a.sense_path,a.definition_nb) FROM alternatives a),''[]''::jsonb)','''[]''::jsonb');
 IF position('synonym_sense_label_v1' IN d)>0 THEN RAISE EXCEPTION 'help anchor changed'; END IF;
 EXECUTE d;
END $p$;

-- Invalidate only registered incident candidates; never collect new words or run AI in a trigger.
CREATE FUNCTION private.synonym_card_content_changed_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public,private AS $f$
DECLARE ids uuid[]:='{}'; r record; oldj jsonb;newj jsonb;lid uuid;
BEGIN
 oldj:=CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 newj:=CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
 IF TG_TABLE_NAME='lexemes' AND TG_OP='UPDATE' AND
  (oldj->'lemma',oldj->'pos',oldj->'verification_status',oldj->'dictionary_status',oldj->'translation_ua',oldj->'translation_en')
  IS NOT DISTINCT FROM
  (newj->'lemma',newj->'pos',newj->'verification_status',newj->'dictionary_status',newj->'translation_ua',newj->'translation_en') THEN RETURN NULL;END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME<>'lexemes' AND (oldj-'updated_at')=(newj-'updated_at') THEN RETURN NULL;END IF;
 IF TG_TABLE_NAME='lexemes' THEN ids:=ARRAY[coalesce(newj->>'id',oldj->>'id')::uuid];
 ELSE
  ids:=array_remove(ARRAY[(oldj->>'lexeme_id')::uuid,(newj->>'lexeme_id')::uuid,
   (oldj->>'expression_id')::uuid,(newj->>'expression_id')::uuid],NULL);
 END IF;
 SELECT ids||coalesce(array_agg(x.id),'{}'::uuid[]) INTO ids FROM public.expression_catalog x WHERE x.lexeme_id=ANY(ids);
 FOR r IN SELECT DISTINCT c.id FROM public.synonym_candidate_queue c WHERE c.source_active AND
 (c.source_entity_id=ANY(ids) OR EXISTS(SELECT 1 FROM public.synonym_pair_v1 p
 WHERE p.candidate_id=c.id AND p.target_entity_id=ANY(ids)))
 LOOP
  UPDATE public.synonym_pair_v1 SET status='needs_manual_review',rule_reason='card_content_changed',
   force_recheck=true,lease_token=NULL,lease_until=NULL,updated_at=now()
  WHERE candidate_id=r.id AND status<>'superseded';
  PERFORM public.d10_synonym_enqueue_refresh_v1(r.id,NULL,'card_content_changed',true);
 END LOOP;
 RETURN NULL;
END $f$;
REVOKE ALL ON FUNCTION private.synonym_card_content_changed_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER synonym_card_translation_changed_v1 AFTER INSERT OR UPDATE OR DELETE ON public.entity_translations
 FOR EACH ROW EXECUTE FUNCTION private.synonym_card_content_changed_v1();
CREATE TRIGGER synonym_card_review_changed_v1 AFTER INSERT OR UPDATE OR DELETE ON private.d10_ai_review_rejections_v1
 FOR EACH ROW EXECUTE FUNCTION private.synonym_card_content_changed_v1();
CREATE TRIGGER synonym_card_identity_changed_v1 AFTER UPDATE OF lemma,pos,verification_status,dictionary_status,translation_ua,translation_en
 ON public.lexemes FOR EACH ROW EXECUTE FUNCTION private.synonym_card_content_changed_v1();
-- Preserve decisions/history. Old decisions lack the new readiness evidence and are not advertised.
DO $withdraw$
DECLARE r record;
BEGIN
 FOR r IN SELECT DISTINCT source_entity_type at,source_entity_id ai,target_entity_type bt,target_entity_id bi
 FROM public.synonym_pair_v1 WHERE published LOOP
 PERFORM public.d10_synonym_publish_link_v1(r.at,r.ai,r.bt,r.bi);
 END LOOP;
END $withdraw$;
COMMIT;
