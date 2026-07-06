-- ============================================================================
-- 20260704150000_naob_expression_glosses_unique_constraint.sql
--
-- Заменяет устаревший unique constraint naob_expression_glosses_unique
-- (normalized_key, naob_slug, gloss_text) на актуальный, соответствующий
-- текущей версии воркера (EXTRACTOR_VERSION=3), который делает upsert с:
--   onConflict: 'normalized_key,naob_slug,anchor_id,gloss_index'
--
-- Почему старый constraint был проблемой:
--   1. Не совпадает с onConflict в коде -> upsert падает с ошибкой
--      "no unique or exclusion constraint matching ON CONFLICT specification"
--      на первом не-dry-run прогоне.
--   2. gloss_text для no_gloss записей -- null. NULL != NULL в UNIQUE
--      constraint'ах Postgres -- старый constraint не дедуплицировал бы
--      такие строки, накапливая дубли при каждом повторном прогоне.
--
-- Новый constraint основан на anchor_id (реальный NAOB id или synthetic_
-- fallback на позицию в HTML -- оба всегда not null по построению) +
-- gloss_index, что устраняет оба пункта выше.
-- ============================================================================

ALTER TABLE public.naob_expression_glosses
  DROP CONSTRAINT IF EXISTS naob_expression_glosses_unique;

ALTER TABLE public.naob_expression_glosses
  ADD CONSTRAINT naob_expression_glosses_unique
  UNIQUE (normalized_key, naob_slug, anchor_id, gloss_index);