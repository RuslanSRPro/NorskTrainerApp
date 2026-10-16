# D10: отказ второй модели — повтор и пометка «для проверки»

Согласовано 15.10.2026 («а + б»). Повод: задача «Er tiden. Jeg liker vinterjakke» ушла в ⚠️. Вторая модель отклонила AI-перевод существительного «like» (`AI_POS_SENSE_REVIEW_REJECTED`).

## Что меняется

| Шаг | Где | Что |
|---|---|---|
| а) Повтор | `ai-enrichment-worker` | Слова, перевод которых отклонила вторая модель, получают **одну** повторную генерацию, одним пакетом на группу. Сбои связи сюда не относятся, их повторяет задача, как раньше |
| б1) Пометка | там же + таблица `private.d10_ai_review_rejections_v1` | Отклонено и после повтора → слово помечается «для проверки». Перевод не пишется. Принятый позже перевод снимает пометку |
| б2) Задача не стоп | `job-enrichment-batch-worker` | Такой отказ записывается как «нет данных» (`ai_review_rejected`), а не как ошибка. Супервизор больше не останавливает задачу «1 enrichment items failed» |
| б3) Полнота | `completion-contract/v1/runtime.ts` + снимок | Слово с пометкой, у которого **единственный** недостаток — нет перевода, задачу не блокирует. Само слово остаётся «не готово»; список таких слов в `review_marked_entities`. Любой другой недостаток (формы, проверка) по-прежнему блокирует |

## Проверено

- **AI-воркер**, 3 теста с подставными ответами:
  - отклонено, потом принято → записан второй вариант, пометка снята;
  - отклонено дважды → ничего не записано, пометка поставлена;
  - принято сразу → без повтора.
- **Полнота**, 3 новых теста:
  - помеченное слово без перевода → задача готова, слово нет;
  - без пометки → блок;
  - с пометкой, но без форм → блок.
- **Старые тесты полноты** проходят все (aggregate, enforcement, evaluator, runtime, shadow, job status). Schema test здесь не запускается: нет пакета ajv, без правок так же.
- **Миграция** проверена на определении снимка из пакета 13.10. Якорь найден один раз, повтор ничего не меняет.

## Порядок

1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_ai_review_retry_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_ai_review_retry_v1\install_d10_ai_review_retry.ps1"
   ```
2. SQL Editor — миграция (NOTICE «review mark installed»):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261015150000_d10_ai_review_mark_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — проверка 111 (T1, T2 PASS; T3 — помеченные слова):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\111_d10_ai_review_mark_check.sql" | Set-Clipboard
   ```
4. Деплой — AI, цепочки и все функции, которые считают полноту (одинаковое правило):
   ```powershell
   npx supabase functions deploy ai-enrichment-worker
   ```
   ```powershell
   npx supabase functions deploy job-enrichment-batch-worker
   ```
   ```powershell
   npx supabase functions deploy job-completion-auditor
   ```
   ```powershell
   npx supabase functions deploy get-job-status
   ```
   ```powershell
   npx supabase functions deploy job-completion-report
   ```
   ```powershell
   npx supabase functions deploy completion-contract-shadow
   ```
5. Тест: снова «Jeg liker vinterjakke» в режиме Audit. Ожидается:
   - либо «like» получит перевод со второй попытки;
   - либо попадёт в T3 запроса 111, а задача будет ✅.

## Что не входит
Показ пометки «для проверки» на карточке в приложении. Сейчас слово просто без перевода. Значок сделаю вместе с E (значок омонимов), если согласуете.

## Откат
Вернуть файлы из `*.d10-review-retry.bak`, задеплоить те же 6 функций. Таблица и функции пометки могут остаться: без воркера в них ничего не пишется. Снимок: строка `ai_review_rejected` безвредна для старого кода.
