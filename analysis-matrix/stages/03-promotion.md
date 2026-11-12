# 03 — Продвижение в карточки

## Назначение
По результатам проверок пункт становится карточкой (`lexemes`) или останавливается у входной проверки.

## Код
SQL `promote_verification_results_for_job(job, limit)` (`verification_promotion_v9_change_log`),
`dictionary_admission_decision(...)` (решение о допуске). [живой текст; проверить по коду]

## Выход
`result_summary.promotion_status`: promoted / not_promoted / promoted_gray; `admission_status` / `admission_reason`
(pos_unverified, weak_evidence_only, review / unknown_pos_requires_review, AMBIGUOUS_POS_WITHOUT_ARTICLE …);
стадия `semantic_audit` (продвинут) или `admission_gate` (остановлен).

## Нагрузка
В 454 (11.11): ~600 мс в среднем, до 7,8 с. [проверено, статистика до сброса]

## Повторный анализ
[проверить по коду] обновляет ли продвижение уже существующую карточку (уровень, evidence).

## Достоверность
[проверить по коду] почти всё — этап в этом чате не читался.
