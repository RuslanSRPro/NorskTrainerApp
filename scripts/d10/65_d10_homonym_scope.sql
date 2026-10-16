-- 65_d10_homonym_scope.sql
-- Read-only, one statement. Size of the homonym question before designing it.
--   1_ambiguous_checks : Ordbøkene token checks that ended "Ambiguous Bokmål
--                        articles; no article selected": how many, how many
--                        distinct lemma+POS, and how many the bound-article
--                        fix (D10_homonym_bound_article_v1) would resolve
--                        (resolved lexeme bound to exactly one candidate).
--   2_ambiguous_sample : up to 30 such lemma+POS with candidate articles and
--                        the article bound to the lexeme (if any).
--   3_blocked_items    : items stopped at admission with
--                        AMBIGUOUS_POS_WITHOUT_ARTICLE (all jobs).
--   4_duplicate_lexemes: active learning lexemes sharing lemma+POS (homonyms
--                        already stored as separate lexemes, or duplicates).
--   5_duplicate_sample : up to 30 of them with their article sets.
--   6_multi_article    : lexemes whose forms projection lists >1 article
--                        (equivalent articles merged into one lexeme).
--   7_lexeme_unique    : unique indexes on lexemes (does lemma+POS have to be
--                        unique?).
with ambiguous as materialized (
  select sc.id, sc.item_id, sc.lexeme_id, lower(sc.query) as lemma,
    i.pos,
    array(select jsonb_array_elements_text(sc.evidence #> '{raw_preview,candidate_article_ids}')) as candidates
  from public.lexeme_source_checks sc
  join public.lexeme_processing_items i on i.id = sc.item_id
  where sc.source = 'Ordbokene'
    and sc.query_type = 'token'
    and sc.evidence ->> 'evidence_label' = 'Ambiguous Bokmål articles; no article selected'
), bound as materialized (
  select a.id,
    (select array_agg(distinct x::text) from public.lexeme_form_display_v2 f,
       unnest(f.article_ids) x
     where f.lexeme_id = a.lexeme_id and f.dictionary_code = 'bm' and f.pos = a.pos) as bound_ids
  from ambiguous a
), judged as (
  select a.*, b.bound_ids,
    (select count(*) from unnest(a.candidates) c where c = any(coalesce(b.bound_ids, '{}'))) as matches
  from ambiguous a join bound b on b.id = a.id
), dup as materialized (
  select lower(l.lemma) as lemma, l.pos, count(*) as n, array_agg(l.id order by l.id) as ids
  from public.lexemes l
  where l.is_learning_lexeme and l.dictionary_status = 'active'
  group by lower(l.lemma), l.pos
  having count(*) > 1
)
select '1_ambiguous_checks' as section, null::text as name,
  jsonb_build_object(
    'checks', count(*),
    'distinct_lemma_pos', count(distinct (j.lemma, j.pos)),
    'fixed_by_bound_article', count(*) filter (where j.matches = 1),
    'bound_but_no_single_match', count(*) filter (where j.bound_ids is not null and j.matches <> 1),
    'no_binding', count(*) filter (where j.bound_ids is null)) as detail
from judged j
union all
select '2_ambiguous_sample', s.lemma || ' (' || coalesce(s.pos, '?') || ')',
  jsonb_build_object('checks', s.n, 'candidate_articles', s.candidates,
    'bound_articles', s.bound_ids, 'fixed', s.fixed)
from (
  select j.lemma, j.pos, count(*) as n, max(j.candidates::text) as candidates,
    max(j.bound_ids::text) as bound_ids, bool_and(j.matches = 1) as fixed
  from judged j group by j.lemma, j.pos order by count(*) desc limit 30
) s
union all
select '3_blocked_items', null,
  jsonb_build_object(
    'items', count(*),
    'jobs', count(distinct i.job_id),
    'distinct_lemmas', count(distinct lower(i.normalized_lemma)))
from public.lexeme_processing_items i
where i.result_summary ->> 'admission_reason' = 'AMBIGUOUS_POS_WITHOUT_ARTICLE'
union all
select '4_duplicate_lexemes', null,
  jsonb_build_object('lemma_pos_groups', count(*), 'lexemes', coalesce(sum(d.n), 0))
from dup d
union all
select '5_duplicate_sample', d.lemma || ' (' || d.pos || ')',
  jsonb_build_object('lexemes', d.n,
    'articles_per_lexeme', (
      select jsonb_object_agg(x.id::text, coalesce(x.arts, '[]'::jsonb))
      from (
        select l_id as id,
          (select to_jsonb(array_agg(distinct a::text)) from public.lexeme_form_display_v2 f,
             unnest(f.article_ids) a where f.lexeme_id = l_id and f.dictionary_code = 'bm') as arts
        from unnest(d.ids) l_id
      ) x))
from (select * from dup order by n desc, lemma limit 30) d
union all
select '6_multi_article', null,
  jsonb_build_object('lexemes', count(distinct f.lexeme_id))
from public.lexeme_form_display_v2 f
where f.dictionary_code = 'bm' and cardinality(f.article_ids) > 1
union all
select '7_lexeme_unique', ix.indexname, jsonb_build_object('definition', ix.indexdef)
from pg_indexes ix
where ix.schemaname = 'public' and ix.tablename = 'lexemes'
  and ix.indexdef ilike '%unique%'
order by 1, 2;
