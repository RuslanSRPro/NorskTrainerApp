# 06 — Семейство из NAOB

## Назначение
Для глагола-корня — выражения из статей NAOB (глоссы), новые выражения в каталог, привязка к корню.

## Код
job-orchestrator `runFamilyDictionaryStep` (need_naob) → Edge `naob-family-expressions-worker` →
`naob-synonym-extractor` (глоссы в `naob_expression_glosses`) → SQL `d10_naob_family_bind_v1(root, slugs)`;
запись журнала `d10_family_naob_record_v1` (detail = {status, bind}).

## Логика воркера [проверено, `naob-family-expressions-worker/index.ts`]
1. Поиск NAOB → статьи-глаголы с этим заголовком (до 4); если нет — прямые `lemma`, `lemma_1..4`.
2. (с 11.11, D14) если у слова есть карточки-омонимы той же части речи — только статьи, где есть формы ЭТОЙ
   карточки, которых нет у соседей, и нет форм соседей; иначе ничего (`homograph_no_naob_match`).
3. Страница в `naob_article_cache` (если нет), извлечение глоссов (журнал `naob_extraction_log_v1`, 24 ч), ссылки
   «se …» — до N статей за вызов (`partial`).
4. Привязка: глоссы статей, `expression_lemma LIKE lemma || ' %'`, существующие выражения ищутся по
   `root_lemma = lemma` (не по карточке) и по ключам; `ON CONFLICT DO UPDATE` — привязки только добавляются.

## Таблицы
`naob_article_cache` (html), `naob_expression_glosses` (naob_slug, expression_lemma, gloss_type direct / reference,
gloss_text, context_label; на строки ссылается `synonym_candidate_queue.gloss_id` ON DELETE RESTRICT),
`naob_extraction_log_v1`, `private.d10_family_naob_runs_v1` (журнал по корню), `private.lexeme360_expression_roots_v1`
(source_kind `naob_parent_article`, evidence.naob.slugs).

## Повторный анализ — НЕ перезаписывает [проверено]
- журнал `d10_family_naob_runs_v1` со статусом `done` / `failed` → шаг для корня больше не запускается никогда;
- страницы и глоссы NAOB не обновляются (кроме 24-часового окна);
- неверные привязки не снимаются.

## Известные проблемы
- **Устаревшая нумерация статей NAOB** (11.11): сейчас hete_1 = сущ. «жара», hete_2 = «греть» (hetet; hete opp),
  hete_3 = «называться» (het/hett; hete etter); у нас глоссы «hete etter» под hete_1 и «hete opp» под hete_3 →
  «hete opp» шло к «называться». Проверено на скачанных страницах тем же парсером.
- hete II не получает шаг NAOB вообще — не проходит отбор корней (вероятно, две статьи в проверке Ordbøkene у
  второй карточки). Запрос 464.
- brekke (глагол), stemme (глагол) — привязки NAOB собраны до D14.
- Подробности отбора по формам не пишутся в журнал (оркестратор сохраняет только status и bind).

## Нагрузка
gå: 62 мин и таймаут до C-1110-04.

## Правила
D14.

## История
C-1110-04, C-1110-05, C-1111-12.
