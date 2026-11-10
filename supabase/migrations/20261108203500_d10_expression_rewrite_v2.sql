-- Preserve original source rows; the current reviewed expression revision wins in every reader.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_canonical_lexeme_examples_v1(p_lexeme_ids uuid[])
 RETURNS TABLE(lexeme_id uuid, id uuid, expression_id uuid, language_code text, example_text text, translation_uk text, source text, enrichment_evidence jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_lexeme_ids IS NULL OR cardinality(p_lexeme_ids)>200 OR array_position(p_lexeme_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'EXAMPLE_RPC_EXPLICIT_IDS_REQUIRED';
  END IF;
  RETURN QUERY
  SELECT scoped.id::uuid,e.id::uuid,e.expression_id::uuid,e.language_code::text,e.example_text::text,e.translation_uk::text,e.source::text,e.enrichment_evidence::jsonb
  FROM (SELECT DISTINCT u.id FROM unnest(p_lexeme_ids)AS u(id))AS requested
  JOIN public.lexemes AS scoped ON scoped.id=requested.id
  JOIN LATERAL (
    SELECT candidate.* FROM public.entity_examples AS candidate
    WHERE ((candidate.lexeme_id=scoped.id AND candidate.expression_id IS NULL)
      OR (candidate.expression_id IS NOT NULL AND candidate.lexeme_id IS NULL
        AND EXISTS (SELECT 1 FROM public.expression_catalog expression
          WHERE expression.id=candidate.expression_id AND expression.lexeme_id=scoped.id)))
      AND candidate.language_code='nb'
      AND candidate.example_text ~ '[[:alpha:]]'
      AND candidate.example_text !~* '^[[:space:]]*(https?://|<)'
    ORDER BY (CASE WHEN candidate.expression_id IS NOT NULL AND candidate.enrichment_evidence->>'expression_review_version'='d10_expression_review_v2' AND candidate.enrichment_evidence->'review'->>'status'='accepted' THEN -100 WHEN candidate.source='ai_fallback' THEN 10 ELSE 0 END)
      +(CASE WHEN candidate.translation_uk ~ '[[:alpha:]]'
        AND candidate.translation_uk !~* '^[[:space:]]*(https?://|<)' THEN 0 ELSE 2 END), candidate.id
    LIMIT 1
  )AS e ON true
  ORDER BY scoped.id,e.id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_canonical_lexeme_translations_v1(p_lexeme_ids uuid[])
 RETURNS TABLE(lexeme_id uuid, language_code text, translation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  with requested as (
    select distinct requested_id as lexeme_id
    from unnest(coalesce(p_lexeme_ids, '{}'::uuid[])) requested_id
    where requested_id is not null
  ), request_kind as (
    select
      requested.lexeme_id,
      exists (
        select 1
        from public.expression_catalog expression
        where expression.lexeme_id = requested.lexeme_id
      ) as is_expression
    from requested
  ), all_candidates as (
    select
      translation.lexeme_id,
      translation.language_code,
      coalesce(
        nullif(btrim(translation.canonical_translation), ''),
        btrim(translation.translation)
      ) as translation,
      translation.source,
      translation.source_entry_id,
      translation.entry_order,
      translation.sense_rank,
      translation.translation_rank,
      translation.id,
      (translation.expression_id IS NOT NULL AND translation.enrichment_evidence->>'expression_review_version'='d10_expression_review_v2' AND translation.enrichment_evidence->'review'->>'status'='accepted') as current_expression,
      request_kind.is_expression
    from public.entity_translations translation
    join request_kind on request_kind.lexeme_id = translation.lexeme_id
    where translation.expression_id is null
      and translation.language_code in ('uk', 'en')
      and translation.translation_type in ('primary', 'expression_primary')
      and nullif(btrim(translation.translation), '') is not null

    union all

    select
      expression.lexeme_id,
      translation.language_code,
      coalesce(
        nullif(btrim(translation.canonical_translation), ''),
        btrim(translation.translation)
      ) as translation,
      translation.source,
      translation.source_entry_id,
      translation.entry_order,
      translation.sense_rank,
      translation.translation_rank,
      translation.id,
      (translation.expression_id IS NOT NULL AND translation.enrichment_evidence->>'expression_review_version'='d10_expression_review_v2' AND translation.enrichment_evidence->'review'->>'status'='accepted') as current_expression,
      true as is_expression
    from public.expression_catalog expression
    join requested on requested.lexeme_id = expression.lexeme_id
    join public.entity_translations translation
      on translation.expression_id = expression.id
    where translation.lexeme_id is null
      and translation.language_code in ('uk', 'en')
      and translation.translation_type in ('primary', 'expression_primary')
      and nullif(btrim(translation.translation), '') is not null
  ), candidates as (
    -- D10 28.10.2026 (agreed): an AI translation is shown only while the
    -- entity has NO dictionary translation (Lexin / manual) in that language.
    -- An AI row made before Lexin found the word stays in the database, but
    -- it is no longer appended to the Lexin translations (komme: "come, to
    -- come"; bar IV: "хвоя, гілки та хмиз хвойних дерев"). The marker "≈"
    -- (get_lexeme_translation_approx_v1) already follows the same rule.
    select all_candidates.*
    from all_candidates
    where (all_candidates.current_expression OR NOT EXISTS (select 1 from all_candidates newer where newer.lexeme_id=all_candidates.lexeme_id and newer.language_code=all_candidates.language_code and newer.current_expression))
      AND (all_candidates.current_expression OR all_candidates.source is distinct from 'ai_fallback'
       or not exists (
         select 1
         from all_candidates other
         where other.lexeme_id = all_candidates.lexeme_id
           and other.language_code = all_candidates.language_code
           and other.source is distinct from 'ai_fallback'
       )
       )
  ), article_ranked as (
    select
      candidates.*,
      row_number() over (
        partition by
          candidates.lexeme_id,
          candidates.language_code,
          candidates.source,
          coalesce(
            candidates.source_entry_id::text,
            case
              when candidates.source in ('ai_fallback', 'manual_verified')
                then candidates.source
              else candidates.id::text
            end
          )
        order by
          case when nullif(btrim(candidates.translation), '') is null then 1 else 0 end,
          coalesce(candidates.sense_rank, 999),
          coalesce(candidates.translation_rank, 999),
          candidates.id
      ) as article_rank
    from candidates
  ), article_winners as (
    select *
    from article_ranked
    where article_rank = 1
  ), deduplicated as (
    select
      article_winners.*,
      row_number() over (
        partition by
          article_winners.lexeme_id,
          article_winners.language_code,
          lower(btrim(article_winners.translation))
        order by
          case lower(coalesce(article_winners.source, ''))
            when 'manual_verified' then 1
            when 'lexin' then 2
            when 'ai_fallback' then 3
            else 9
          end,
          coalesce(article_winners.entry_order, 999999),
          coalesce(article_winners.sense_rank, 999),
          coalesce(article_winners.translation_rank, 999),
          article_winners.id
      ) as duplicate_rank
    from article_winners
  ), display_ranked as (
    select
      deduplicated.*,
      row_number() over (
        partition by deduplicated.lexeme_id, deduplicated.language_code
        order by
          case lower(coalesce(deduplicated.source, ''))
            when 'manual_verified' then 1
            when 'lexin' then 2
            when 'ai_fallback' then 3
            else 9
          end,
          coalesce(deduplicated.entry_order, 999999),
          coalesce(deduplicated.sense_rank, 999),
          coalesce(deduplicated.translation_rank, 999),
          deduplicated.id
      ) as display_rank
    from deduplicated
    where deduplicated.duplicate_rank = 1
  ), limited as (
    select *
    from display_ranked
    where display_rank <= case
      when is_expression then 1
      when language_code = 'uk' then 3
      else 2
    end
  )
  select
    limited.lexeme_id,
    limited.language_code,
    string_agg(limited.translation, ', ' order by limited.display_rank) as translation
  from limited
  group by limited.lexeme_id, limited.language_code
  order by limited.lexeme_id, limited.language_code;
$function$
;
CREATE OR REPLACE FUNCTION public.get_lexeme360_examples_v1(p_lexeme_ids uuid[] DEFAULT '{}'::uuid[], p_expression_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(lexeme_id uuid, expression_id uuid, id uuid, example_text text, translation_uk text, source text, cefr_level text, enrichment_evidence jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  WITH requested_lexemes AS (
    SELECT DISTINCT id FROM unnest(coalesce(p_lexeme_ids,'{}'::uuid[])) id
  ), requested_expressions AS (
    SELECT DISTINCT id FROM unnest(coalesce(p_expression_ids,'{}'::uuid[])) id
  ), candidates AS (
    SELECT coalesce(e.lexeme_id, mapped.lexeme_id) AS resolved_lexeme_id,
      e.expression_id,e.id,e.example_text,e.translation_uk,e.source,NULL::text AS cefr_level,e.enrichment_evidence,
      row_number() OVER (PARTITION BY coalesce(e.lexeme_id,mapped.lexeme_id),e.expression_id
      ORDER BY CASE WHEN e.expression_id IS NOT NULL AND e.enrichment_evidence->>'expression_review_version'='d10_expression_review_v2' AND e.enrichment_evidence->'review'->>'status'='accepted' THEN -100 WHEN e.source='ai_fallback' THEN 10 ELSE 0 END,
        CASE WHEN e.translation_uk ~ '[[:alpha:]]' THEN 0 ELSE 2 END,e.id) AS rank
    FROM public.entity_examples e
    LEFT JOIN public.expression_catalog mapped ON mapped.id=e.expression_id
    WHERE e.language_code='nb' AND e.example_text ~ '[[:alpha:]]'
      AND e.example_text !~* '^[[:space:]]*(https?://|<)'
      AND (coalesce(e.lexeme_id,mapped.lexeme_id) IN (SELECT id FROM requested_lexemes)
        OR e.expression_id IN (SELECT id FROM requested_expressions))
  )
  SELECT c.resolved_lexeme_id,c.expression_id,c.id,c.example_text,c.translation_uk,c.source,c.cefr_level,c.enrichment_evidence
  FROM candidates c WHERE c.rank<=3
  ORDER BY coalesce(c.resolved_lexeme_id,c.expression_id), CASE WHEN c.expression_id IS NOT NULL AND c.enrichment_evidence->>'expression_review_version'='d10_expression_review_v2' AND c.enrichment_evidence->'review'->>'status'='accepted' THEN 0 ELSE 1 END,c.rank;
$function$
;
CREATE OR REPLACE FUNCTION public.d10_publish_expression_enrichment_v2(
  p_expression_id uuid, p_translations jsonb, p_example jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $$
DECLARE tr jsonb;
BEGIN
  IF jsonb_array_length(p_translations)<>2 OR
    (SELECT count(DISTINCT x->>'language_code') FROM jsonb_array_elements(p_translations) x WHERE x->>'language_code' IN ('uk','en'))<>2
    THEN RAISE EXCEPTION 'EXPRESSION_TWO_LANGUAGES_REQUIRED'; END IF;
  PERFORM 1 FROM public.expression_catalog WHERE id=p_expression_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXPRESSION_NOT_FOUND'; END IF;
  FOR tr IN SELECT value FROM jsonb_array_elements(p_translations) LOOP
    IF nullif(btrim(tr->>'translation'),'') IS NULL OR
       (tr#>>'{enrichment_evidence,expression_binding,expression_id}') IS DISTINCT FROM p_expression_id::text OR
       (tr#>>'{enrichment_evidence,expression_binding,translation}') IS DISTINCT FROM (tr->>'translation') OR
       (tr#>>'{enrichment_evidence,review,status}') IS DISTINCT FROM 'accepted' OR
       (tr#>>'{enrichment_evidence,expression_review_version}') IS DISTINCT FROM 'd10_expression_review_v2'
       THEN RAISE EXCEPTION 'EXPRESSION_TRANSLATION_REVIEW_REQUIRED'; END IF;
  END LOOP;
  IF nullif(btrim(p_example->>'example_text'),'') IS NULL OR nullif(btrim(p_example->>'translation_uk'),'') IS NULL OR
     (p_example#>>'{enrichment_evidence,expression_binding,expression_id}') IS DISTINCT FROM p_expression_id::text OR
     (p_example#>>'{enrichment_evidence,review,status}') IS DISTINCT FROM 'accepted' OR
     (p_example#>>'{enrichment_evidence,example_highlights,nb,text}') IS DISTINCT FROM (p_example->>'example_text') OR
     (p_example#>>'{enrichment_evidence,example_highlights,uk,text}') IS DISTINCT FROM (p_example->>'translation_uk')
     THEN RAISE EXCEPTION 'EXPRESSION_EXAMPLE_REVIEW_REQUIRED'; END IF;
  -- Both translations and the example commit together. Source-extracted rows remain intact.
  DELETE FROM public.entity_translations WHERE expression_id=p_expression_id AND source='ai_fallback'
    AND language_code IN ('uk','en') AND translation_type IN ('primary','expression_primary');
  DELETE FROM public.entity_examples WHERE expression_id=p_expression_id AND source='ai_fallback' AND language_code='nb';
  FOR tr IN SELECT value FROM jsonb_array_elements(p_translations) LOOP
    INSERT INTO public.entity_translations(expression_id,language_code,translation,translation_type,translation_rank,source,source_pos,confidence,enrichment_evidence,updated_at)
    VALUES(p_expression_id,tr->>'language_code',tr->>'translation','expression_primary',1,'ai_fallback','expression','medium',tr->'enrichment_evidence',now());
  END LOOP;
  INSERT INTO public.entity_examples(expression_id,language_code,example_text,translation_uk,source,source_type,enrichment_evidence,updated_at)
  VALUES(p_expression_id,'nb',p_example->>'example_text',p_example->>'translation_uk','ai_fallback','ai_example',p_example->'enrichment_evidence',now());
  RETURN jsonb_build_object('translations_written',2,'example_written',true);
END;
$$;
REVOKE ALL ON FUNCTION public.d10_publish_expression_enrichment_v2(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d10_publish_expression_enrichment_v2(uuid,jsonb,jsonb) TO service_role;
COMMIT;

