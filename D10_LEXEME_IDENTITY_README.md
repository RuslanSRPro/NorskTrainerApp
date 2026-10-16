# D10: карточка по статье, а не «первая попавшаяся»

Пункты плана 5 и 7 (опись 15.10, правило для relation-resolver согласовано).

| Где | Было | Стало |
|---|---|---|
| analyze-text, запасной поиск лексемы по лемме и части речи | `limit 1` без порядка: при bok / bok II случайная карточка | основная карточка первой |
| ordbokene-article-ref-relation-worker, исходная лексема | первая строка по лемме статьи: случайная карточка или даже чужая часть речи | карточка **этой статьи** (псевдонимы заголовков, как у семейства 360). Иначе единственная основная карточка леммы. Иначе пропуск, как «лексемы ещё нет» |
| ordbokene-article-ref-relation-worker, цель ссылки | первая строка по лемме | карточка **статьи ссылки**. Иначе единственная основная карточка. Иначе цель не разрешена (связь остаётся с текстом цели) |
| relation-resolver, цель и исходная по лемме | `maybeSingle`: при нескольких строках ошибка | статья из доказательства связи. Иначе единственная основная карточка. Иначе связь остаётся кандидатом без ошибки (согласовано) |

Новые функции SQL, только чтение:
- `d10_lexeme_for_article_v1(статья, словарь, лемма)` — одна карточка статьи или NULL;
- `d10_lexeme_for_lemma_v1(лемма)` — одна основная карточка или NULL.

## Проверено
PostgreSQL 16:
- статья 6790 → основная, 106786 → II, неизвестная → NULL;
- лемма bok → основная; huske (существительное и глагол) → NULL;
- повтор миграции ничего не меняет.

Синтаксис трёх функций проверен.

## Порядок
1. Установка:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_lexeme_identity_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_lexeme_identity_v1\install_d10_lexeme_identity.ps1"
   ```
2. SQL Editor — миграция:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261015140000_d10_lexeme_identity_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — проверка 110 (T1 main, T2 II, T3 main noun, T4 число лемм с несколькими основными карточками):
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\110_d10_lexeme_identity_check.sql" | Set-Clipboard
   ```
4. Деплой:
   ```powershell
   npx supabase functions deploy analyze-text
   ```
   ```powershell
   npx supabase functions deploy ordbokene-article-ref-relation-worker
   ```
   ```powershell
   npx supabase functions deploy relation-resolver
   ```

## Откат
Вернуть файлы из `*.d10-identity.bak` и задеплоить те же 3 функции. Новые функции SQL только читают, их можно оставить.
