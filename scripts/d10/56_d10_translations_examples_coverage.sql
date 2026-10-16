-- 56_d10_translations_examples_coverage.sql
-- Read-only, one statement. Shows WHERE Ukrainian translations and Norwegian
-- examples are missing: in the stored data, or only in what the app reads.
--
-- Section A — sample words from the app test (root words and expressions):
--   rpc_uk / rpc_en      : what the app shows (get_canonical_lexeme_translations_v1)
--   rpc_card_example     : example for cards / training (get_canonical_lexeme_examples_v1)
--   rpc_360_examples     : examples for Lexeme360 (get_lexeme360_examples_v1)
--   raw_*                : what is stored in entity_translations / entity_examples
--                          (own rows, and rows stored on the expression_catalog entry)
-- Section B — the same for all active learning lexemes, as counts
--   (word = no expression_catalog entry; expression = has one).
with sample as (
  select l.id, l.lemma, l.pos,
    exists (select 1 from public.expression_catalog ec where ec.lexeme_id = l.id) as is_expression
  from public.lexemes l
  where lower(l.lemma) in ('være','gå','ta','hus','barn','møte','være ved','ta av','ta på seg','ta med','gå fra hverandre')
    and l.is_learning_lexeme
    and l.dictionary_status = 'active'
), sample_rows as (
  select 'A_sample'::text as section, s.lemma, s.pos,
    jsonb_build_object(
      'id', s.id,
      'is_expression', s.is_expression,
      'rpc_uk', (select t.translation from public.get_canonical_lexeme_translations_v1(array[s.id]) t where t.language_code = 'uk'),
      'rpc_en', (select t.translation from public.get_canonical_lexeme_translations_v1(array[s.id]) t where t.language_code = 'en'),
      'rpc_card_example', (select e.example_text || coalesce(' | ' || e.translation_uk, '') from public.get_canonical_lexeme_examples_v1(array[s.id]) e limit 1),
      'rpc_360_examples', (select count(*) from public.get_lexeme360_examples_v1(array[s.id], '{}'::uuid[]) e),
      'rpc_360_examples_own', (select count(*) from public.get_lexeme360_examples_v1(array[s.id], '{}'::uuid[]) e where e.expression_id is null),
      'raw_uk_own', (select count(*) from public.entity_translations t where t.lexeme_id = s.id and t.expression_id is null and t.language_code = 'uk'),
      'raw_uk_on_expression', (select count(*) from public.entity_translations t join public.expression_catalog ec on ec.id = t.expression_id where ec.lexeme_id = s.id and t.language_code = 'uk'),
      'raw_uk_types', (select string_agg(distinct t.translation_type || '/' || t.source, ', ') from public.entity_translations t where t.lexeme_id = s.id and t.language_code = 'uk'),
      'raw_examples_own', (select count(*) from public.entity_examples e where e.lexeme_id = s.id and e.expression_id is null and e.language_code = 'nb'),
      'raw_examples_own_with_uk', (select count(*) from public.entity_examples e where e.lexeme_id = s.id and e.expression_id is null and e.language_code = 'nb' and e.translation_uk ~ '[[:alpha:]]'),
      'raw_examples_lexeme_plus_expression', (select count(*) from public.entity_examples e where e.lexeme_id = s.id and e.expression_id is not null),
      'raw_examples_on_expression', (select count(*) from public.entity_examples e join public.expression_catalog ec on ec.id = e.expression_id where ec.lexeme_id = s.id),
      'raw_examples_other_language', (select string_agg(distinct e.language_code || '/' || e.source, ', ') from public.entity_examples e where e.lexeme_id = s.id and e.language_code <> 'nb'),
      'raw_example_sources', (select string_agg(distinct e.source, ', ') from public.entity_examples e where e.lexeme_id = s.id)
    ) as detail
  from sample s
), learning as (
  select l.id,
    exists (select 1 from public.expression_catalog ec where ec.lexeme_id = l.id) as is_expression
  from public.lexemes l
  where l.is_learning_lexeme and l.dictionary_status = 'active'
), coverage as (
  select g.is_expression,
    count(*) as total,
    count(*) filter (where exists (
      select 1 from public.entity_translations t
      where t.lexeme_id = g.id and t.expression_id is null and t.language_code = 'uk'
        and t.translation_type in ('primary','expression_primary') and btrim(t.translation) <> ''
    ) or exists (
      select 1 from public.entity_translations t join public.expression_catalog ec on ec.id = t.expression_id
      where ec.lexeme_id = g.id and t.lexeme_id is null and t.language_code = 'uk'
        and t.translation_type in ('primary','expression_primary') and btrim(t.translation) <> ''
    )) as with_uk_translation,
    count(*) filter (where exists (
      select 1 from public.entity_examples e
      where e.lexeme_id = g.id and e.expression_id is null and e.language_code = 'nb'
        and e.example_text ~ '[[:alpha:]]'
    )) as with_own_example_card_reads,
    count(*) filter (where exists (
      select 1 from public.entity_examples e join public.expression_catalog ec on ec.id = e.expression_id
      where ec.lexeme_id = g.id and e.language_code = 'nb' and e.example_text ~ '[[:alpha:]]'
    )) as with_example_on_expression_card_misses,
    count(*) filter (where exists (
      select 1 from public.entity_examples e
      where e.lexeme_id = g.id and e.expression_id is null and e.language_code = 'nb'
        and e.example_text ~ '[[:alpha:]]' and e.translation_uk ~ '[[:alpha:]]'
    )) as with_own_example_and_uk
  from learning g
  group by g.is_expression
)
select section, lemma, pos, detail from sample_rows
union all
select 'B_coverage', case when c.is_expression then 'expressions' else 'words' end, null,
  jsonb_build_object(
    'total', c.total,
    'with_uk_translation', c.with_uk_translation,
    'with_own_example (cards/training read these)', c.with_own_example_card_reads,
    'with_example_only_on_expression_entry (cards/training miss these)', c.with_example_on_expression_card_misses,
    'with_own_example_and_uk', c.with_own_example_and_uk)
from coverage c
order by 1, 2, 3;
