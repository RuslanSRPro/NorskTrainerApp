# D10 — омонимы: выбор статьи, уже привязанной к лексеме (шаг 1)

## Проблема

«Er» → «være» (глагол). Ordbøkene вернул две статьи-глагола: 69211 «быть» и 69212 «чуять».

Проверка Ordbøkene не выбирала ни одну и записывала «Ambiguous Bokmål articles; no article selected». После этого правило допуска не продвигало слово (`AMBIGUOUS_POS_WITHOUT_ARTICLE`), и задача заканчивалась `needs_manual_review`.

При этом лексема «være» (глагол) уже точно привязана к статье 69211: её официальные формы в `lexeme_form_display_v2` построены из этой статьи.

## Что меняется

Только проверка Ordbøkene для отдельных слов (`lexical-worker` → `verification/adapters/ordbokene.ts`):

1. `lexical-worker` для проверки слова берёт статьи, к которым уже привязана распознанная лексема: `lexeme_form_display_v2.article_ids` для этой лексемы и части речи.
2. Если Ordbøkene вернул несколько статей с этой частью речью и **ровно одна** из них совпадает с привязкой, выбирается она:
   - `registered_entry`, `article_ids = [выбранная]`;
   - `article_selection = 'bound_lexeme_article'`;
   - все кандидаты сохраняются в `candidate_article_ids`.
3. Во всех остальных случаях поведение прежнее:
   - одна статья — как было;
   - привязки нет (новое слово);
   - привязка не совпала ни с одним кандидатом;
   - совпало несколько.

Выбор идёт только по номеру статьи, не по тексту.

## Что не меняется

- Выбор между омонимами для новых слов.
- Частотная основная статья.
- Ограничение «одна статья».
- Лишние копии частей речи.
- Показ нескольких значений в приложении.

Всё это шаг 3, отдельно, после результатов 65.

Правило допуска, продвижение, выражения и остальные источники не трогаются.

## Установка

1. Распаковать архив в «Загрузки». Из корня проекта:

   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_homonym_bound_article_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_homonym_bound_article_v1\install_d10_homonym_bound_article.ps1"
   ```

2. Деплой: `npx supabase functions deploy lexical-worker`. Адаптер Ordbøkene собирается вместе с этой функцией.
3. SQL Editor: `scripts/d10/65_d10_homonym_scope.sql` (только чтение) — объём темы омонимов.

Откат: вернуть файлы из `*.d10-homonym-bound-article.bak` и задеплоить `lexical-worker`.

## Проверка

1. В приложении: режим «Аудит», текст «Er tiden.».
2. Когда задача закончится, в 63 (поменять job id на новый) не должно быть «være».
3. В 64 (поменять item id) у Ordbøkene должно быть:
   - `status = done`, `registered_entry = true`;
   - в `evidence` — `article_selection: bound_lexeme_article` и `candidate_article_ids [69211, 69212]`.
