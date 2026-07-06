-- ============================================================================
-- 20260705120000_add_expression_id_to_lexeme360_ready_expressions.sql
--
-- ИСПРАВЛЕНО: Postgres не позволяет CREATE OR REPLACE FUNCTION менять набор
-- колонок в RETURNS TABLE (SQLSTATE 42P13 -- "cannot change return type of
-- existing function... Row type defined by OUT parameters is different").
-- Нужно сначала явно удалить старую версию функции, потом создать новую.
--
-- get_lexeme360_ready_expressions раньше возвращала только lexeme_id, не
-- expression_id. Из-за этого Lexeme360.tsx мог искать переводы для
-- "родственных" выражений только по lexeme_id -- но per constraint
-- entity_translations_single_entity, у expression-переводов lexeme_id
-- ВСЕГДА null (см. миграцию 20260705110000). Единственный правильный ключ
-- для поиска их переводов -- expression_id, которого RPC не отдавала.
--
-- Добавляем ec.id as expression_id в возвращаемые колонки.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_lexeme360_ready_expressions(text);

CREATE FUNCTION public.get_lexeme360_ready_expressions(p_root_lemma text)
RETURNS TABLE (
  lexeme_id uuid,
  expression_id uuid,
  lemma text,
  pos text,
  expression_subtype text,
  verification_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  select
    ec.lexeme_id,
    ec.id as expression_id,
    lx.lemma,
    lx.pos,
    ec.expression_subtype,
    ec.verification_status
  from public.expression_catalog ec
  join public.lexemes lx
    on lx.id = ec.lexeme_id
  where ec.root_lemma = lower(trim(regexp_replace(p_root_lemma, '^å\s+', '', 'i')))
    and ec.lexeme_id is not null
    and ec.verification_status in ('multi_source', 'authoritative', 'usage_verified')
    and coalesce(lx.is_learning_lexeme, true) = true
    and coalesce(lx.dictionary_status, 'active') = 'active'
  order by ec.lemma;
$$;

GRANT EXECUTE ON FUNCTION public.get_lexeme360_ready_expressions(text) TO authenticated;