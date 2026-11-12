# 07 — Омонимы (R8 / R9), деление по NAOB

## Назначение
Если у слова несколько статей одной части речи — решить: одна карточка (R8), своя карточка с номером (R9) или
пропуск с пометкой.

## Код [проверено]
`_shared/d10-homograph-cards.ts` (`runHomographStep`, `parseHomographArticle`, `decideHomographs`, `sameMeaningAsMain`);
SQL `d10_homograph_candidates_for_job_v1` (живой отбор: `promotion_status='promoted' OR i.status='done'` — серые
карточки проходят), `d10_record_homograph_decision_v1`, `d10_inject_homograph_item_v1`,
`d10_existing_homograph_cards_for_job_v1`. Деление сущ. без статьи Ordbøkene по NAOB: `d10_naob_split_candidates_for_job_v1`,
`d10_record_naob_homograph_v1`, `d10_naob_card_binding_v1`.

## Логика
- Главная карточка без статьи → статья с наименьшим номером (`main_article`).
- Формы те же → `r8_same_forms` (запись, без карточки). Формы разные → `r9_card` (карточка, homograph_key = римский
  номер, добавляется в задачу отдельным пунктом). Разные формы, то же значение / неизменяемая статья без своих
  форм → `skipped` + review.
- Статьи грузятся с ord.uib.no (таймаут 8 с); не загрузилась → решение откладывается до следующего анализа.

## Таблицы
`private.d10_homograph_article_decisions_v1`, `private.d10_naob_homograph_cards_v1`,
`private.authoritative_morphology_article_bindings_v2`.

## Повторный анализ
Решения постоянные, при новом анализе не пересматриваются (статья с решением больше не кандидат). [проверено]

## Известные проблемы
- Сбой загрузки статьи / записи решения виден только в журнале функции, не в отчёте задачи (si 11.11: первый раз
  решений нет, при повторе — main_article 51262 + skipped 51263).
- Несколько статей без выбора у слова без шага омонимов → `SELECTED_BM_ARTICLE_REQUIRED` (spore, bryte, piske).

## Правила
D6, D7.
