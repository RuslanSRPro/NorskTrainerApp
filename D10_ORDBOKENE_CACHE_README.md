# D10: кэш-уровень на случай сбоя Ordbøkene

Согласовано 15.10.2026. Ставится **поверх** D10_ordbokene_resilience_v1.

## Порядок запасных путей, когда поиск Ordbøkene упал (5xx, тайм-аут)

1. **Известная статья лексемы** (привязка, снимок форм). Уже установлено.
2. **Новое: номера статей из нашего последнего успешного поиска** этого слова и части речи (`source_lookup_cache`). Сами статьи скачиваются заново, сейчас.
3. Иначе: ошибка и повтор позже (1, 5, 30 минут).

## Правила кэш-уровня

| Условие | Почему |
|---|---|
| Только точный поиск леммы (scope `e`), только Bokmål, та же часть речи | Как у обычной проверки |
| Только **одна** статья в кэше. Две и больше: отказ | Слово было неоднозначным; кэш его не разрешает |
| Результаты запасных путей в кэш не идут, сбои кэш не затирают | Иначе кэш испортился бы во время сбоя: раньше ошибка 502 перезаписывала хороший результат |
| Срок годности кэша не учитывается | Используется только во время сбоя, статьи свежие |
| В доказательстве `lookup_fallback: cached_search_article_ids` и дата поиска | Видно, откуда взяты номера статей |
| Кэш-уровень никогда не отвечает «статьи нет» | Перевод «без статьи» из-за сбоя невозможен |

**Ограничение.** Если после даты кэша в Ordbøkene появился новый омоним, мы его не увидим до следующего обычного поиска (следующий аудит). Слова, которых никогда не было в кэше, ждут повторов.

## Файлы

| Файл | Изменение |
|---|---|
| `lexical-worker/index.ts` | без привязанной статьи читает последний поиск из кэша (`d10_last_ordbokene_search_v1`) |
| `lexical-worker/types.ts`, `adapters.ts` | передают номера из кэша в проверку |
| `lexical-worker/process-source-check.ts` | сбой и результат запасного пути не пишутся в кэш |
| `verification/adapters/ordbokene.ts` | кэш-уровень после известной статьи |
| `forms-enrichment-v2-worker/index.ts` | то же для форм (только одна статья в кэше) |
| миграция `20261015120000` | функция `d10_last_ordbokene_search_v1` (только чтение) |

## Проверено

- **13 тестов Node** (4 новых + 9 из пакета устойчивости):
  - одна статья в кэше → проверено, с пометкой и датой;
  - две статьи в кэше → ошибка, а не выбор;
  - известная статья важнее кэша;
  - нет ни статьи, ни кэша → ошибка.
- **Функция на PostgreSQL 16:**
  - запись запасного пути игнорируется;
  - пустой результат, scope `i` и другая часть речи игнорируются;
  - повтор миграции ничего не меняет.

## Порядок

1. Установка, каждая команда отдельно:
   ```powershell
   Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\D10_ordbokene_cache_v1.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
   ```
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\D10_ordbokene_cache_v1\install_d10_ordbokene_cache.ps1"
   ```
2. SQL Editor — миграция:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\supabase\migrations\20261015120000_d10_ordbokene_cache_level_v1.sql" | Set-Clipboard
   ```
3. SQL Editor — проверка 107: T1 PASS, T2 — сколько слов может обслужить кэш:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\subbo\NorskTrainerApp\scripts\d10\107_d10_ordbokene_cache_check.sql" | Set-Clipboard
   ```
4. Деплой:
   ```powershell
   npx supabase functions deploy lexical-worker
   ```
   ```powershell
   npx supabase functions deploy forms-enrichment-v2-worker
   ```

## Откат

Вернуть файлы из `*.d10-cache-level.bak` и задеплоить те же 2 функции. Функцию `d10_last_ordbokene_search_v1` можно оставить: она только читает.
