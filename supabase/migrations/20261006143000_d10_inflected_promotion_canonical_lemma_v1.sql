BEGIN;

DO $guard$
BEGIN
  IF md5(pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure)) <> 'bdef3428a432a4638af8a0fc84cf86a0' THEN
    RAISE EXCEPTION 'STOP: promote_verification_results_for_job changed since D10 inflected export';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.d10_verified_ordbokene_promotion_lemma(
  p_verification_evidence jsonb,
  p_normalized_lemma text,
  p_effective_pos text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $function$
DECLARE
  v_source jsonb := p_verification_evidence->'Ordbokene';
  v_raw jsonb := v_source->'evidence'->'raw_preview';
  v_candidate text := lower(btrim(v_raw->>'canonical_lemma'));
  v_surface text := lower(btrim(p_normalized_lemma));
BEGIN
  IF coalesce(v_surface, '') = '' THEN
    RETURN NULL;
  END IF;

  IF v_source->>'status' = 'done'
    AND v_source->>'found' = 'true'
    AND v_source->>'registered_entry' = 'true'
    AND v_raw->>'dictionary_code' = 'bm'
    AND v_raw->>'lookup_scope' = 'i'
    AND v_raw->>'pos' = p_effective_pos
    AND jsonb_typeof(v_raw->'article_ids') = 'array'
    AND jsonb_array_length(v_raw->'article_ids') = 1
    AND coalesce(v_candidate, '') <> ''
    AND v_candidate <> v_surface
    AND lower(btrim(v_source->'evidence'->>'canonical_query')) = v_surface
    AND lower(btrim(v_raw->>'matched_form')) = v_surface
    AND coalesce(v_raw->>'matched_form_key', '') <> ''
  THEN
    RETURN v_candidate;
  END IF;

  RETURN v_surface;
END;
$function$;

DO $patch$
DECLARE
  v_definition text;
BEGIN
  v_definition := pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure);

  IF position($anchor$
  unique_lemmas as (
    select distinct on (lower(normalized_lemma), effective_pos)
      normalized_lemma,
      surface_form,
      effective_pos as pos,
$anchor$ IN v_definition) = 0
     OR position($anchor$
    join all_matching_lexemes aml
      on lower(aml.lemma) = lower(ato.normalized_lemma)
      and aml.pos = coalesce(nullif(ato.effective_pos, ''), 'unknown')
$anchor$ IN v_definition) = 0
     OR position($anchor$
      lexeme_id = lm.lexeme_id,
      status = 'done',
      current_stage = 'semantic_audit',
$anchor$ IN v_definition) = 0 THEN
    RAISE EXCEPTION 'STOP: promotion anchors changed';
  END IF;

  v_definition := replace(v_definition, $old$
  unique_lemmas as (
    select distinct on (lower(normalized_lemma), effective_pos)
      normalized_lemma,
      surface_form,
      effective_pos as pos,
$old$, $new$
  promotion_token_occurrences as (
    select
      ato.*,
      public.d10_verified_ordbokene_promotion_lemma(
        ato.verification_evidence,
        ato.normalized_lemma,
        ato.effective_pos
      ) as promotion_lemma
    from admitted_token_occurrences ato
  ),

  unique_lemmas as (
    select distinct on (lower(promotion_lemma), effective_pos)
      promotion_lemma as normalized_lemma,
      surface_form,
      effective_pos as pos,
$new$);

  v_definition := replace(v_definition, $old$
    from admitted_token_occurrences
    order by
      lower(normalized_lemma),
      effective_pos,
      best_rank desc,
      item_id
$old$, $new$
    from promotion_token_occurrences
    order by
      lower(promotion_lemma),
      effective_pos,
      best_rank desc,
      item_id
$new$);

  v_definition := replace(v_definition, $old$
    from admitted_token_occurrences ato
    join all_matching_lexemes aml
      on lower(aml.lemma) = lower(ato.normalized_lemma)
      and aml.pos = coalesce(nullif(ato.effective_pos, ''), 'unknown')
$old$, $new$
    from promotion_token_occurrences ato
    join all_matching_lexemes aml
      on lower(aml.lemma) = lower(ato.promotion_lemma)
      and aml.pos = coalesce(nullif(ato.effective_pos, ''), 'unknown')
$new$);

  v_definition := replace(v_definition, $old$
      lexeme_id = lm.lexeme_id,
      status = 'done',
      current_stage = 'semantic_audit',
$old$, $new$
      lexeme_id = lm.lexeme_id,
      normalized_lemma = (
        select pto.promotion_lemma
        from promotion_token_occurrences pto
        where pto.item_id = lm.item_id
      ),
      status = 'done',
      current_stage = 'semantic_audit',
$new$);

  v_definition := replace(v_definition, $old$
          'verification_tier', lm.new_verification_tier,
$old$, $new$
          'verification_tier', lm.new_verification_tier,
          'identity_source', case
            when exists (
              select 1
              from promotion_token_occurrences pto
              where pto.item_id = lm.item_id
                and lower(pto.promotion_lemma) is distinct from lower(pto.normalized_lemma)
            ) then 'ordbokene_inflected_form'
            else 'input_lemma'
          end,
          'surface_form_preserved', i.surface_form,
$new$);

  IF position('promotion_token_occurrences' IN v_definition) = 0
     OR position('identity_source' IN v_definition) = 0
     OR position('normalized_lemma = (' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'STOP: inflected promotion patch did not apply cleanly';
  END IF;

  EXECUTE v_definition;
END;
$patch$;

COMMIT;
