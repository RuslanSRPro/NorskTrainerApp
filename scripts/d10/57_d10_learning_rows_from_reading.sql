-- 57_d10_learning_rows_from_reading.sql
-- Read-only, one statement. Per user: the words in their learning
-- (learning_progress), and how many of them were most likely put there only by
-- reading a text (before this patch every word of an analysed text that was in
-- the database was added to learning, which made the word map green).
--   never_trained          : no review in `reviews` for that word
--   seen_in_reading        : last_seen_in_reading is set
--   reading_only_candidates: never trained AND seen in reading AND no due date
--                            (the "add to learning" button always sets a due
--                            date; the reading path did not)
--   with_card_example      : the word has an example the cards/training read
--   with_uk_translation    : the word has a Ukrainian translation the app reads
-- Nothing is changed. Removing reading-only rows is a separate step, only
-- after you decide.
with lp as (
  select p.user_id, p.lexeme_id, p.next_due_at, p.last_seen_in_reading,
    exists (select 1 from public.reviews r where r.user_id = p.user_id and r.lexeme_id = p.lexeme_id) as trained
  from public.learning_progress p
)
select
  lp.user_id,
  count(*) as words_in_learning,
  count(*) filter (where not lp.trained) as never_trained,
  count(*) filter (where lp.last_seen_in_reading is not null) as seen_in_reading,
  count(*) filter (where not lp.trained and lp.last_seen_in_reading is not null and lp.next_due_at is null) as reading_only_candidates,
  count(*) filter (where exists (
    select 1 from public.entity_examples e
    where e.language_code = 'nb' and e.example_text ~ '[[:alpha:]]'
      and (e.lexeme_id = lp.lexeme_id and e.expression_id is null
        or e.expression_id in (select ec.id from public.expression_catalog ec where ec.lexeme_id = lp.lexeme_id))
  )) as with_card_example,
  count(*) filter (where exists (
    select 1 from public.entity_translations t
    where t.language_code = 'uk' and t.translation_type in ('primary','expression_primary')
      and btrim(t.translation) <> ''
      and (t.lexeme_id = lp.lexeme_id and t.expression_id is null
        or t.expression_id in (select ec.id from public.expression_catalog ec where ec.lexeme_id = lp.lexeme_id))
  )) as with_uk_translation
from lp
group by lp.user_id
order by words_in_learning desc;
