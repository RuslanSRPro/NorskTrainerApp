# D10: канонизация пачками по 20 слов вместо 3

Ставится **после** D10_notes_off_canon_v1.

## Что было (по коду)

`pipeline-supervisor` даёт цепочкам страницы по `BATCH_LIMIT = 3` слова. Только цепочки из `AI_FALLBACK_CHAINS` получают по 20:
- `expression_ai_fallback`;
- `authoritative_ai_fallback`;
- `translation_reorder` — эта берёт всю задачу сразу.

`translation_canonicalization` в этот список не входила. Её воркер собирает в один запрос к Gemini до 10 слов, но получал только 3. Получалось: один запрос AI на каждые 3 слова.

## Что меняется

- `translation_canonicalization` добавлена в `AI_FALLBACK_CHAINS`: страница до 20 слов, то есть два запроса Gemini по 10 вместо примерно семи по 3.
- Время ожидания этого вызова в batch-worker поднято до 40 секунд (было 20).

## Что не меняется и почему

| Цепочка | Сколько слов за раз | AI |
|---|---|---|
| `lexeme_translation` (Lexin) | 3 | нет, это запросы к Lexin |
| `authoritative` (NAOB, Ordbøkene) | 3 | нет |
| `ordbokene`, `naob`, `forms` | 3 | нет |
| `authoritative_ai_fallback`, `expression_ai_fallback` | 20, Gemini пачками | да, уже пачки |
| `translation_reorder` | вся задача, Gemini пачками по 20 | да, уже пачки |

Цепочки без AI не стоят денег за запрос. Их размер страницы держит время одного вызова в пределах таймаута супервизора (45 с). «3 параллельные сессии» — это `MAX_JOBS_PER_TICK = 3`, три задачи за тик. Это не меняется.

## Порядок

1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_canon_batch_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_canon_batch_v1\install_d10_canon_batch.ps1"
   ```
2. Деплой:
   ```powershell
   npx supabase functions deploy pipeline-supervisor
   ```
   ```powershell
   npx supabase functions deploy job-enrichment-batch-worker
   ```

## Откат

Вернуть оба файла из `*.d10-canon-batch.bak` и задеплоить.
