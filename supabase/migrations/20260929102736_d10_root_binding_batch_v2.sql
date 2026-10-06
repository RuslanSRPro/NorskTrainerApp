-- Batch Lexeme360 refresh for binding writes. Keep the scalar bind RPC for
-- existing callers; the new RPC binds one article's expressions in one SQL
-- statement. Statement triggers preserve refresh on direct table writes.

CREATE OR REPLACE FUNCTION private.refresh_lexeme360_binding_set_v1(
  p_root_ids uuid[], p_expression_ids uuid[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
  IF coalesce(cardinality(p_root_ids), 0) = 0
     AND coalesce(cardinality(p_expression_ids), 0) = 0 THEN
    RETURN;
  END IF;

  WITH changed_roots AS MATERIALIZED (
    SELECT DISTINCT root_lexeme_id AS id
    FROM unnest(p_root_ids) AS roots(root_lexeme_id)
    WHERE root_lexeme_id IS NOT NULL
  ),
  changed_expressions AS MATERIALIZED (
    SELECT DISTINCT expression_id AS id
    FROM unnest(p_expression_ids) AS expressions(expression_id)
    WHERE expression_id IS NOT NULL
  ),
  affected_lexemes AS MATERIALIZED (
    SELECT id FROM changed_roots
    UNION
    SELECT expression.lexeme_id
    FROM changed_roots root
    JOIN private.lexeme360_expression_roots_v1 binding
      ON binding.root_lexeme_id = root.id
    JOIN public.expression_catalog expression
      ON expression.id = binding.expression_id
    WHERE expression.lexeme_id IS NOT NULL
    UNION
    SELECT expression.lexeme_id
    FROM changed_expressions changed
    JOIN public.expression_catalog expression ON expression.id = changed.id
    WHERE expression.lexeme_id IS NOT NULL
  ),
  family_pairs AS MATERIALIZED (
    SELECT affected.id AS lexeme_id, family.root_lexeme_id
    FROM affected_lexemes affected
    CROSS JOIN LATERAL private.lexeme360_roots_for_lexeme_v2(affected.id) family
  ),
  relevant_roots AS MATERIALIZED (
    SELECT DISTINCT root_lexeme_id FROM family_pairs
  ),
  expression_flags AS MATERIALIZED (
    SELECT binding.root_lexeme_id, expression.id AS expression_id,
      private.normalize_lexeme360_root_v1(root.lemma) AS display_root,
      (
        expression.verification_status IN
          ('multi_source', 'authoritative', 'usage_verified')
        AND nullif(btrim(expression.lemma), '') IS NOT NULL
        AND root.id IS NOT NULL
        AND private.lexeme360_subtype_is_displayable_v1(
          expression.expression_subtype, true
        )
        AND target.id IS NOT NULL
        AND target.is_learning_lexeme IS NOT FALSE
        AND coalesce(target.dictionary_status, 'active') = 'active'
      ) AS ready,
      (
        private.lexeme360_candidate_is_displayable_v1(to_jsonb(expression))
        OR (
          expression.verification_status IN
            ('multi_source', 'authoritative', 'usage_verified')
          AND target.id IS NOT NULL
          AND target.is_learning_lexeme IS FALSE
          AND coalesce(target.dictionary_status, 'active') = 'active'
          AND private.lexeme360_subtype_is_displayable_v1(
            expression.expression_subtype, true
          )
        )
      ) AS candidate
    FROM relevant_roots relevant
    JOIN private.lexeme360_expression_roots_v1 binding
      ON binding.root_lexeme_id = relevant.root_lexeme_id
    JOIN public.expression_catalog expression
      ON expression.id = binding.expression_id
    LEFT JOIN public.lexemes root ON root.id = binding.root_lexeme_id
    LEFT JOIN public.lexemes target ON target.id = expression.lexeme_id
  ),
  calculated AS (
    SELECT affected.id,
      count(DISTINCT flags.expression_id) FILTER (WHERE flags.ready)::integer
        AS ready_count,
      count(DISTINCT flags.expression_id) FILTER (WHERE flags.candidate)::integer
        AS candidate_count,
      min(flags.display_root) FILTER (WHERE flags.ready) AS display_root
    FROM affected_lexemes affected
    LEFT JOIN family_pairs family ON family.lexeme_id = affected.id
    LEFT JOIN expression_flags flags
      ON flags.root_lexeme_id = family.root_lexeme_id
    GROUP BY affected.id
  )
  UPDATE public.lexemes lexeme
  SET lexeme360_root_lemma = calculated.display_root,
      lexeme360_ready_count = calculated.ready_count,
      lexeme360_candidate_count = calculated.candidate_count,
      lexeme360_policy_version = 'lexeme360-family/v2-root-identity',
      lexeme360_refreshed_at = clock_timestamp()
  FROM calculated
  WHERE lexeme.id = calculated.id;
END;
$function$;

CREATE OR REPLACE FUNCTION private.refresh_lexeme360_binding_insert_set_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
  PERFORM private.refresh_lexeme360_binding_set_v1(
    ARRAY(SELECT DISTINCT root_lexeme_id FROM new_binding_rows),
    ARRAY(SELECT DISTINCT expression_id FROM new_binding_rows)
  );
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION private.refresh_lexeme360_binding_update_set_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
  PERFORM private.refresh_lexeme360_binding_set_v1(
    ARRAY(SELECT root_lexeme_id FROM old_binding_rows
          UNION SELECT root_lexeme_id FROM new_binding_rows),
    ARRAY(SELECT expression_id FROM old_binding_rows
          UNION SELECT expression_id FROM new_binding_rows)
  );
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION private.refresh_lexeme360_binding_delete_set_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
  PERFORM private.refresh_lexeme360_binding_set_v1(
    ARRAY(SELECT DISTINCT root_lexeme_id FROM old_binding_rows),
    ARRAY(SELECT DISTINCT expression_id FROM old_binding_rows)
  );
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bind_lexeme360_expression_roots_batch_v1(
  p_expression_ids uuid[], p_parent_article_id bigint,
  p_dictionary_code text, p_parent_lemma text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  resolved_root_id uuid;
  resolved_pos text;
  requested_count integer;
  changed_binding_count integer;
BEGIN
  requested_count := (SELECT count(DISTINCT id) FROM unnest(p_expression_ids) AS requested(id));
  IF requested_count IS NULL OR requested_count < 1 OR requested_count > 500
     OR p_parent_article_id IS NULL OR p_parent_article_id <= 0
     OR nullif(btrim(p_parent_lemma), '') IS NULL
     OR p_dictionary_code IS NULL
     OR lower(btrim(p_dictionary_code)) NOT IN ('bm', 'nn') THEN
    RAISE EXCEPTION 'INVALID_BATCH_BINDING_IDENTITY';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_expression_ids) AS requested(id) WHERE id IS NULL) THEN
    RAISE EXCEPTION 'NULL_EXPRESSION_ID';
  END IF;

  SELECT min(alias.lexeme_id::text)::uuid, min(alias.pos)
  INTO resolved_root_id, resolved_pos
  FROM public.lexeme_headword_aliases_v2 alias
  WHERE alias.dictionary_code = lower(btrim(p_dictionary_code))
    AND alias.article_id = p_parent_article_id
    AND alias.normalized_headword =
      private.normalize_lexeme360_root_v1(p_parent_lemma)
    AND alias.is_active
  HAVING count(DISTINCT alias.lexeme_id) = 1;
  IF resolved_root_id IS NULL THEN RETURN NULL; END IF;

  IF EXISTS (
    SELECT 1 FROM (SELECT DISTINCT id FROM unnest(p_expression_ids) AS ids(id)) requested
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ordbokene_expression_candidates candidate
      WHERE candidate.promoted_expression_id = requested.id
        AND candidate.parent_article_id = p_parent_article_id
        AND lower(candidate.parent_dictionary_code) = lower(btrim(p_dictionary_code))
        AND private.normalize_lexeme360_root_v1(candidate.parent_lemma) =
            private.normalize_lexeme360_root_v1(p_parent_lemma)
        AND candidate.status IN ('promoted', 'duplicate')
    )
  ) THEN RAISE EXCEPTION 'EXPRESSION_PARENT_ARTICLE_MISMATCH'; END IF;

  INSERT INTO private.lexeme360_expression_roots_v1 AS binding (
    expression_id, root_lexeme_id, source_kind, dictionary_code,
    source_article_id, source_pos, evidence, updated_at
  )
  SELECT requested.id, resolved_root_id, 'ordbokene_parent_article',
    lower(btrim(p_dictionary_code)), p_parent_article_id, resolved_pos,
    jsonb_build_object('resolver', 'lexeme_headword_aliases_v2',
      'policy', 'exact_article_headword_identity'), clock_timestamp()
  FROM (SELECT DISTINCT id FROM unnest(p_expression_ids) AS ids(id)) requested
  WHERE true
  ON CONFLICT (expression_id, root_lexeme_id) DO UPDATE SET
    source_kind = excluded.source_kind,
    dictionary_code = excluded.dictionary_code,
    source_article_id = excluded.source_article_id,
    source_pos = excluded.source_pos,
    evidence = excluded.evidence,
    updated_at = excluded.updated_at
  WHERE (binding.source_kind, binding.dictionary_code,
         binding.source_article_id, binding.source_pos, binding.evidence)
    IS DISTINCT FROM
        (excluded.source_kind, excluded.dictionary_code,
         excluded.source_article_id, excluded.source_pos, excluded.evidence);

  GET DIAGNOSTICS changed_binding_count = ROW_COUNT;
  -- An unchanged retry has no transition rows, so its triggers cannot repair
  -- a stale projection left by an interrupted earlier attempt.
  IF changed_binding_count = 0 THEN
    PERFORM private.refresh_lexeme360_binding_set_v1(
      ARRAY[resolved_root_id], p_expression_ids
    );
  END IF;

  RETURN resolved_root_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.bind_lexeme360_expression_roots_batch_v1(
  uuid[], bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_lexeme360_expression_roots_batch_v1(
  uuid[], bigint, text, text) TO service_role;

DROP TRIGGER IF EXISTS refresh_lexeme360_binding_v2
  ON private.lexeme360_expression_roots_v1;
DROP TRIGGER IF EXISTS refresh_lexeme360_binding_insert_set_v1
  ON private.lexeme360_expression_roots_v1;
DROP TRIGGER IF EXISTS refresh_lexeme360_binding_update_set_v1
  ON private.lexeme360_expression_roots_v1;
DROP TRIGGER IF EXISTS refresh_lexeme360_binding_delete_set_v1
  ON private.lexeme360_expression_roots_v1;
CREATE TRIGGER refresh_lexeme360_binding_insert_set_v1
  AFTER INSERT ON private.lexeme360_expression_roots_v1
  REFERENCING NEW TABLE AS new_binding_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.refresh_lexeme360_binding_insert_set_v1();
CREATE TRIGGER refresh_lexeme360_binding_update_set_v1
  AFTER UPDATE ON private.lexeme360_expression_roots_v1
  REFERENCING OLD TABLE AS old_binding_rows NEW TABLE AS new_binding_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.refresh_lexeme360_binding_update_set_v1();
CREATE TRIGGER refresh_lexeme360_binding_delete_set_v1
  AFTER DELETE ON private.lexeme360_expression_roots_v1
  REFERENCING OLD TABLE AS old_binding_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.refresh_lexeme360_binding_delete_set_v1();
