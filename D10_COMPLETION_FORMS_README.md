# D10: формы в проверке полноты (исправления «а» и «б», согласовано 13.10)

Одна миграция `20261013210000_d10_completion_snapshot_forms_v1.sql`. Меняется только функция `get_completion_evidence_snapshot_v1` (её вызывает v2) и добавляется одна вспомогательная функция. Деплоя функций нет, приложение не меняется. Оценщик (evaluator.ts) не меняется.

## Что исправлено

**(а) Формы лексем с одинаковыми омонимичными статьями (R8)** — например, huske 24686 + 24687.
- У таких строк форм `article_id` пустой, а статьи записаны в `article_ids`.
- Старый фильтр проверял только `article_id`, поэтому все формы выпадали и проверка показывала `REQUIRED_FORMS_MISSING`. Это касалось всех ~44 таких лексем.
- Теперь строка засчитывается, если **все** её статьи входят в снимок морфологии. Ссылка на источник: `ordbokene:bm:article:24686+24687`.

**(б) Несклоняемое существительное** — например, «være» (сущ., только средний род, одна форма).
- Если в активном готовом снимке у существительного есть **только** форма `noun_unmarked` и у лексемы нет своей явной парадигмы, снимок передаёт парадигму `indeclinable`. Источник — сам снимок; четыре падежные формы не требуются.
- Оценщик это уже поддерживал, ему просто не передавали.
- Явная парадигма лексемы, если она есть, по-прежнему важнее.

Всё остальное в функции совпадает с текущей живой версией (миграция `20261004145342`). Права (только service_role) повторно заданы в конце миграции.

## Проверено локально (PostgreSQL 16 + оценщик TS)

| Случай | До | После |
|---|---|---|
| huske (одинаковые статьи) | 0 форм | 7 значений, формы готовы |
| spise (одна статья) | 5 | 5, без изменений |
| være (только noun_unmarked) | REQUIRED_FORMS_MISSING | indeclinable, формы готовы |
| bil (обычное сущ.) | 4, regular | без изменений |
| сущ. с явной парадигмой | plural_only | без изменений |
| сущ. с noun_unmarked + другой формой | не indeclinable | без изменений |
| строка с чужой статьёй в наборе | — | не засчитывается |
| неактивный снимок være | — | indeclinable не ставится |

## Чего это НЕ решает

- **i tide** (provisional) и **på tide** (blocked, не совпала собственная статья) — следующий шаг. Сначала только чтение, без изменений до согласования.
- У «være» (сущ.) должен быть перевод (Lexin или AI). Привязку AI-перевода к лексеме проверка уже принимала, раньше мешали только формы.

## Порядок

1. Распаковать и установить (каждая команда отдельно):
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_completion_forms_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_completion_forms_v1\install_d10_completion_forms.ps1"
   ```
2. Скопировать миграцию в буфер, затем в SQL Editor: Ctrl+A, Ctrl+V, Run.
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261013210000_d10_completion_snapshot_forms_v1.sql" | Set-Clipboard
   ```
3. Так же запустить проверку `82`. Ожидается: T1–T3 = PASS, T4 = INFO.
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\82_d10_completion_forms_check.sql" | Set-Clipboard
   ```
4. Чтобы статус задачи 18efc887 пересчитался, достаточно снова открыть её в приложении: get-job-status считает проверку при каждом запросе.

## Откат

Применить в SQL Editor определение функции из `supabase/migrations/20261004145342_d10_ai_review_binding_v1.sql` (только блок `CREATE OR REPLACE FUNCTION public.get_completion_evidence_snapshot_v1 … $function$;`). Вспомогательную функцию можно оставить, она ни на что больше не влияет.
