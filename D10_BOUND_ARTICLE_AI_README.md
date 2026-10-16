# D10: AI-перевод по статье, к которой привязана карточка (styr)

Ставится **после** D10_notes_off_canon_v1. Миграции нет.

## Что было

Задача «vende, styr, brenne, tar» остановилась: цепочка AI-перевода упала на styr (`SELECTED_BM_ARTICLE_REQUIRED … NO_ARTICLE_NOT_FOR_HOMOGRAPH_GROUP`).

- Проверка Ordbøkene у главной карточки styr нашла две статьи: 57976 и 57977.
- Шаг омонимов отработал правильно. Он выбрал главной 57977 (`main_article`, наименьший номер) и привязал к ней карточку. Для 57976 создал вторую карточку (`r9_card`).
- AI же брал статью только из проверки. Там их две, поэтому был отказ. Путь «без статьи» тоже правильно отказал: у слова есть омонимы.

## Что меняется (`ai-enrichment-worker`)

Если проверка видела несколько статей, AI берёт статью, к которой привязана карточка (`get_authoritative_morphology_article_bindings_v2`). Условия:
- привязка ровно одна для этой части речи;
- это одна из статей, которые нашла проверка;
- Ordbøkene ответил: не сбой.

Иначе — как раньше. В доказательстве ставится пометка `article_selection: bound_card_article`.

Слова с одной статьёй, вторые карточки и путь «без статьи» не меняются.

## Проверено

- **4 новых теста:**
  - привязка к одной из двух статей → выбрана она;
  - привязка к чужой статье → нет;
  - две привязки или ни одной → нет;
  - сбой Ordbøkene → нет.
- **23 прежних теста** проходят.
- **Синтаксис и повторные имена** проверены компилятором.

## Порядок

1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_bound_article_ai_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_bound_article_ai_v1\install_d10_bound_article_ai.ps1"
   ```
2. Тест (ожидается `pass 4`):
   ```powershell
   node --experimental-strip-types --test supabase/functions/tests/d10-ai-no-article/bound_article_test.mts
   ```
3. Деплой:
   ```powershell
   npx supabase functions deploy ai-enrichment-worker
   ```
4. Повтор: «styr» в режиме Audit → Check. Ожидается, что AI-перевод styr I пройдёт.

## Откат

Вернуть файл из `*.d10-bound-article.bak` и задеплоить `ai-enrichment-worker`.
