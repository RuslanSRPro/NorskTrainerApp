Stage 0 — Pipeline v1 Stabilization

Goal:
Restore Analyze Text to a fully working state.

Deliverables:
✔ Parser works
✔ Expression Resolution works
✔ Lexeme Resolution works
✔ Lexeme360 enriches data
✔ Verification succeeds
✔ Promotion succeeds
✔ UI reflects enrichment
✔ No regressions

Only after Stage 0 is completed may Stage 1 (Parser extraction) begin.
# Language Processing Pipeline v2

## Цель

Единый движок обработки норвежского текста для:

- анализа нового текста;
- актуализации существующей базы;
- Reading Analyzer;
- Voice Analyzer;
- будущего Dictionary Maintenance.

Analyze-text остаётся основным входом в систему.

## Главный принцип

Сначала система ищет выражения, потом отдельные слова.

Порядок:

1. Parser Pass 1
2. Expression Resolver
3. Lexeme Resolver
4. Lexeme360 Enrichment
5. Parser Pass 2
6. Source Checks
7. Verification
8. Promotion
9. Semantic Relations
10. Done

## Ответственность этапов

Parser отвечает за то, что написано в тексте.

Expression Resolver отвечает за то, существует ли выражение в базе или источниках.

Lexeme Resolver отвечает за связь с lexemes.

Lexeme360 отвечает за расширение сети вокруг найденной леммы.

Verification отвечает за качество evidence.

Promotion отвечает за создание или обновление lexeme.

## Двухпроходная логика

Pass 1 находит известные выражения и слова.

После этого Lexeme360 может расширить expression_catalog.

Pass 2 снова анализирует тот же текст, чтобы найти выражения, которые появились после обогащения.

## Отказоустойчивость

Каждый job должен хранить:

- current_stage;
- stage_started_at;
- stage_finished_at;
- processed_count;
- total_count;
- last_error;
- ingestion_version;
- parser_version;
- verification_version.

Обработка считается завершённой только если job.status = ready и все обязательные стадии завершены.