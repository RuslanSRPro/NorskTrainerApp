BEGIN;
DO $$ BEGIN
 IF to_regclass('private.example_review_history_v1') IS NOT NULL OR
 to_regprocedure('public.record_example_review_v1(uuid,uuid,text,text,text,text,timestamptz,text,jsonb)') IS NOT NULL OR
 to_regprocedure('public.get_example_audit_v1(uuid,uuid[])') IS NOT NULL THEN
 RAISE EXCEPTION 'STOP: example audit objects already exist'; END IF;
 IF to_regprocedure('public.bind_reviewed_ai_example_v1(uuid,uuid,text,text,text,text,timestamptz,text,jsonb)') IS NULL THEN
 RAISE EXCEPTION 'STOP: prior example binder missing'; END IF;
END $$;
CREATE TABLE private.example_review_history_v1(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 example_id uuid NOT NULL,lexeme_id uuid NOT NULL,lemma text NOT NULL,pos text NOT NULL,
 article_id text NOT NULL,example_nb text NOT NULL,translation_uk text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('ai','manual')),status text NOT NULL CHECK(status IN ('accepted','rejected')),
 reason text NOT NULL CHECK(length(btrim(reason))>0),context jsonb NOT NULL,decision jsonb NOT NULL,
 prior_evidence jsonb,recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.example_review_history_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.example_review_history_v1 FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX example_review_history_v1_lookup ON private.example_review_history_v1(example_id,id DESC);
CREATE FUNCTION public.record_example_review_v1(
 p_example_id uuid,p_lexeme_id uuid,p_lemma text,p_pos text,p_example_nb text,p_translation_uk text,
 p_expected_updated_at timestamptz,p_article_id text,p_decision jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE l public.lexemes%rowtype;e public.entity_examples%rowtype;
 c jsonb:=p_decision->'context';b jsonb:=p_decision->'manual_binding';
 k text:=p_decision->>'kind';s text:=p_decision->>'status';v_history bigint;v_snapshot uuid;
BEGIN
 IF NOT coalesce(p_example_id IS NOT NULL AND p_lexeme_id IS NOT NULL AND p_expected_updated_at IS NOT NULL
 AND p_article_id ~ '^[0-9]+$' AND p_example_nb ~ '[[:alpha:]]' AND p_translation_uk ~ '[[:alpha:]]'
 AND k IN ('ai','manual') AND s IN ('accepted','rejected')
 AND length(btrim(p_decision->>'reason')) BETWEEN 1 AND 4000
 AND c->>'dictionary'='bm' AND c->>'article_id'=p_article_id AND c->>'lemma'=p_lemma AND c->>'pos'=p_pos
 AND jsonb_typeof(c->'definitions')='array' AND c->'definitions'<>'[]'::jsonb
 AND p_decision->>'example_nb'=p_example_nb AND p_decision->>'translation_uk'=p_translation_uk,false) THEN
 RAISE EXCEPTION 'EXAMPLE_REVIEW_INPUT_INVALID';END IF;
 IF k='manual' AND NOT coalesce(
 length(btrim(p_decision->>'reviewer')) BETWEEN 1 AND 200
 AND jsonb_typeof(p_decision->'references')='array' AND jsonb_array_length(p_decision->'references') BETWEEN 1 AND 10
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_decision->'references') r WHERE jsonb_typeof(r)<>'string' OR r#>>'{}' !~ '^https://')
 AND b->>'version'='d10_example_audit_v1' AND b->>'kind'='manual_example'
 AND b->>'lexeme_id'=p_lexeme_id::text AND b->'expression_id'='null'::jsonb
 AND b->>'lemma'=p_lemma AND b->>'pos'=p_pos AND b->>'dictionary'='bm' AND b->>'article_id'=p_article_id
 AND b->>'language_code'='nb' AND b->>'translation_language_code'='uk'
 AND b->>'value'=btrim(p_example_nb) AND b->>'translation_value'=btrim(p_translation_uk),false)
 THEN RAISE EXCEPTION 'EXAMPLE_MANUAL_PROOF_INVALID';END IF;
 IF k='ai' AND s='rejected' AND NOT coalesce(
 p_decision->'review'->>'status'='rejected' AND p_decision->'review'->>'reason'=p_decision->>'reason'
 AND p_decision->'review'->>'stage' IN ('model_review','source_constraint'),false)
 THEN RAISE EXCEPTION 'EXAMPLE_AI_REJECTION_INVALID';END IF;
 SELECT * INTO l FROM public.lexemes WHERE id=p_lexeme_id FOR SHARE;
 IF NOT FOUND OR l.lemma IS DISTINCT FROM p_lemma OR l.pos IS DISTINCT FROM p_pos THEN RAISE EXCEPTION 'EXAMPLE_REVIEW_LEXEME_CHANGED';END IF;
 SELECT ms.id INTO v_snapshot FROM private.authoritative_morphology_snapshots_v2 ms
 WHERE ms.lexeme_id=l.id AND ms.is_active AND ms.is_complete AND ms.state='ready'
 AND ms.requested_pos=l.pos AND ms.normalized_query=lower(btrim(l.lemma))
 AND 'bm'=any(ms.dictionaries) AND p_article_id::bigint=any(ms.source_article_ids)
 AND ms.finalized_at IS NOT NULL AND ms.superseded_at IS NULL
 AND ms.expected_article_count>0 AND ms.fetched_article_count=ms.expected_article_count FOR SHARE;
 IF v_snapshot IS NULL THEN RAISE EXCEPTION 'EXAMPLE_REVIEW_SOURCE_CHANGED';END IF;
 SELECT * INTO e FROM public.entity_examples WHERE id=p_example_id FOR UPDATE;
 IF NOT FOUND OR e.lexeme_id IS DISTINCT FROM p_lexeme_id OR e.expression_id IS NOT NULL
 OR e.source IS DISTINCT FROM 'ai_fallback' OR e.language_code IS DISTINCT FROM 'nb'
 OR e.example_text IS DISTINCT FROM p_example_nb OR e.translation_uk IS DISTINCT FROM p_translation_uk
 OR e.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'EXAMPLE_REVIEW_ROW_CHANGED';END IF;
 IF k='ai' AND s='accepted' THEN
 IF p_decision->'evidence'->'review'->>'reason' IS DISTINCT FROM p_decision->>'reason'
 OR p_decision->'evidence'->'review'->'approved_proposal'->'context' IS DISTINCT FROM c THEN RAISE EXCEPTION 'EXAMPLE_REVIEW_AI_PROOF_CHANGED';END IF;
 PERFORM public.bind_reviewed_ai_example_v1(p_example_id,p_lexeme_id,p_lemma,p_pos,p_example_nb,p_translation_uk,p_expected_updated_at,p_article_id,p_decision->'evidence');
 END IF;
 IF k='manual' AND p_decision->'prior_ai_rejection' IS NOT NULL AND p_decision->'prior_ai_rejection'<>'null'::jsonb THEN
 IF NOT coalesce(p_decision->'prior_ai_rejection'->>'origin'='user_supplied_report'
 AND p_decision->'prior_ai_rejection'->>'report_sha256' ~ '^[A-Fa-f0-9]{64}$'
 AND p_decision->'prior_ai_rejection'->'review'->>'status'='rejected'
 AND p_decision->'prior_ai_rejection'->'review'->>'stage' IN ('model_review','source_constraint')
 AND length(btrim(p_decision->'prior_ai_rejection'->'review'->>'reason')) BETWEEN 1 AND 4000,false)
 THEN RAISE EXCEPTION 'EXAMPLE_PRIOR_REJECTION_INVALID';END IF;
 INSERT INTO private.example_review_history_v1(example_id,lexeme_id,lemma,pos,article_id,example_nb,translation_uk,kind,status,reason,context,decision,prior_evidence)
 VALUES(p_example_id,p_lexeme_id,p_lemma,p_pos,p_article_id,p_example_nb,p_translation_uk,'ai','rejected',
 p_decision->'prior_ai_rejection'->'review'->>'reason',c,
 jsonb_build_object('kind','ai','status','rejected','context',c,'example_nb',p_example_nb,'translation_uk',p_translation_uk,
 'review',p_decision->'prior_ai_rejection'->'review','import_provenance',(p_decision->'prior_ai_rejection')-'review'),e.enrichment_evidence);
 END IF;
 INSERT INTO private.example_review_history_v1(example_id,lexeme_id,lemma,pos,article_id,example_nb,translation_uk,kind,status,reason,context,decision,prior_evidence)
 VALUES(p_example_id,p_lexeme_id,p_lemma,p_pos,p_article_id,p_example_nb,p_translation_uk,k,s,p_decision->>'reason',c,p_decision,e.enrichment_evidence) RETURNING id INTO v_history;
 RETURN jsonb_build_object('example_id',p_example_id,'history_id',v_history,'kind',k,'status',s,'metadata_updated',k='ai' AND s='accepted');
END;$fn$;
REVOKE ALL ON FUNCTION public.record_example_review_v1(uuid,uuid,text,text,text,text,timestamptz,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_example_review_v1(uuid,uuid,text,text,text,text,timestamptz,text,jsonb) TO service_role;
CREATE FUNCTION public.get_example_audit_v1(p_job_id uuid,p_lexeme_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb;n integer;
BEGIN
 IF p_job_id IS NULL OR p_lexeme_ids IS NULL OR cardinality(p_lexeme_ids)>200 OR array_position(p_lexeme_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'REPORT_EXAMPLE_IDS_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_lexeme_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.lexeme_processing_items i WHERE i.job_id=p_job_id AND i.lexeme_id=x)) THEN RAISE EXCEPTION 'REPORT_EXAMPLE_SCOPE_CHANGED';END IF;
 SELECT count(*) INTO n FROM public.entity_examples e WHERE e.lexeme_id=any(p_lexeme_ids) AND e.expression_id IS NULL AND e.language_code='nb';
 IF n>5000 THEN RAISE EXCEPTION 'REPORT_EXAMPLE_SCOPE_TOO_LARGE';END IF;
 SELECT jsonb_build_object('version','d10_example_audit_v1','captured_at',now(),'lexemes',coalesce(jsonb_agg(entry ORDER BY entry->>'id'),'[]'::jsonb)) INTO result FROM (
 SELECT jsonb_build_object('id',l.id,'lemma',l.lemma,'pos',l.pos,'article_ids',coalesce((SELECT jsonb_agg(DISTINCT a::text) FROM private.authoritative_morphology_snapshots_v2 ms CROSS JOIN LATERAL unnest(ms.source_article_ids) a WHERE ms.lexeme_id=l.id AND ms.is_active AND ms.is_complete AND ms.state='ready' AND ms.requested_pos=l.pos AND ms.normalized_query=lower(btrim(l.lemma)) AND 'bm'=any(ms.dictionaries) AND ms.finalized_at IS NOT NULL AND ms.superseded_at IS NULL AND ms.expected_article_count>0 AND ms.fetched_article_count=ms.expected_article_count),'[]'::jsonb),
 'examples',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('selected_for_display',e.id=chosen.id,'history',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id DESC) FROM private.example_review_history_v1 h WHERE h.example_id=e.id AND h.lexeme_id=l.id AND h.lemma=l.lemma AND h.pos=l.pos AND h.example_nb=e.example_text AND h.translation_uk=e.translation_uk),'[]'::jsonb)) ORDER BY e.id)
 FROM public.entity_examples e WHERE e.lexeme_id=l.id AND e.expression_id IS NULL AND e.language_code='nb'),'[]'::jsonb)) AS entry
 FROM public.lexemes l LEFT JOIN public.get_canonical_lexeme_examples_v1(p_lexeme_ids) chosen ON chosen.lexeme_id=l.id WHERE l.id=any(p_lexeme_ids)
 ) q;
 RETURN result;
END;$fn$;
REVOKE ALL ON FUNCTION public.get_example_audit_v1(uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_example_audit_v1(uuid,uuid[]) TO service_role;
COMMIT;
