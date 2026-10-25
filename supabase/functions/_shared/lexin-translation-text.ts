// D10 25.10.2026 (agreed): Lexin translation text parsing, MOVED unchanged
// from lexin-enrichment-worker/index.ts (lines 122-314 of the version
// 5B0BB276...), so the Read mode preview splits Lexin text exactly like the
// worker. Only change: the functions are exported. normalizeKey below is an
// exact copy of the worker's helper (the worker keeps its own; it uses it
// for many other things).

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ФИКС v6 (11.07.2026 — подтверждено на `nå`):
// украинские варианты Lexin могут одновременно использовать `|`, запятые
// и пробелы между самостоятельными инфинитивами. Нормализация превращает
// их в явный список через запятые, сохраняя все варианты.
export function isUkrainianInfinitiveToken(token: string): boolean {
  const clean = token
    .trim()
    .replace(/^[("'«„]+|[)"'»“.,;:!?]+$/g, '');

  return /(?:ти|тися|тись)$/iu.test(clean);
}

export function splitWhitespaceInfinitiveList(segment: string): string[] {
  const trimmed = segment.trim();
  if (!trimmed) return [];

  const tokens = trimmed.split(/\s+/).filter(Boolean);

  if (tokens.length > 1 && tokens.every(isUkrainianInfinitiveToken)) {
    return tokens;
  }

  return [trimmed];
}

export function normalizeTranslationSegment(segment: string): string[] {
  return splitOutsideParens(segment, ',')
    .flatMap((part) => splitWhitespaceInfinitiveList(part))
    .map((part) => part.trim())
    .filter(Boolean);
}

// ФИКС v11 (19.07.2026 — найдено на живых данных: "å ta på seg" получило
// ОДНУ строку translation из 12 склеенных вариантов: "вдягти, одягти,
// вдягати, вдягнути, одягнути, взути, узути, взувати, узувати, взяти на
// себе, одягати, взувати; брати на себе" — включая внутренние дубли
// ("одягати" и "взувати" дважды).
//
// Причина: cleanTranslationText уже правильно разбирала текст Lexin на
// отдельные варианты (v6, split по '|' + запятым + пробельным
// инфинитивам), но в конце схлопывала массив обратно в ОДНУ строку через
// unique.join(', '). Файл уже содержит отдельный цикл ранжирования/дедупа
// ПОСЛЕ сборки translations (см. seenPerEntry/rankPerEntry ниже по файлу)
// — он рассчитан именно на приём отдельных вариантов как отдельных строк
// entity_translations с инкрементным translation_rank внутри одного
// source_entry_id, и дедуп он делает сам. Но получал на вход уже
// склеенную мега-строку как единственный "вариант" — то есть отработать
// как задумано не мог.
//
// Фикс — здесь: возвращаем string[] вместо string, ничего не склеивая.
// Дедуп внутри Lexin-текста (совпадающие после normalizeKey варианты)
// остаётся здесь же, до передачи дальше — это защита от дублей УЖЕ
// ВНУТРИ одного sub_id (напр. "одягати" дважды в одном исходном тексте),
// а не от дублей между разными source_entry_id (та защита — отдельный
// уровень, ниже по файлу). Cap на количество вариантов сюда намеренно НЕ
// добавлен — v_cap_uk/v_cap_en в sync_lexeme_translation_columns
// применяются на агрегации между смыслами (source_entry_id), а внутри
// одного смысла distinct on (source_entry_id) в sync-функции и так
// выбирает только translation_rank=1 — значит хранить все варианты здесь
// безопасно, лишнее просто не попадёт в lexemes.translation_ua.
export function cleanTranslationVariants(text: string): string[] {
  const normalized = String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  const candidates = normalized
    .split('|')
    .flatMap((block) => normalizeTranslationSegment(block));

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const candidate of candidates) {
    const cleaned = candidate
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();

    if (!cleaned) continue;

    const key = normalizeKey(cleaned);
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(cleaned);
  }

  return unique;
}

// Обёртка для идиом-веток (Ukr-idi/B-idi через parseIdiomText): там на
// входе уже ОДНА конкретная фраза идиомы, не Lexin-поле с несколькими
// синонимами через "|" — join здесь безопасен и лишь нормализует
// пунктуацию/пробелы, не теряя и не размножая варианты.
export function cleanTranslationText(text: string): string {
  return cleanTranslationVariants(text).join(', ');
}

// ФИКС v12 (25.07.2026 — найдено на живых данных: "bygge"):
// Lexin разделяет РАЗНЫЕ смыслы одного слова внутри ОДНОГО Ukr-lem
// текстового поля через ";" — напр. "будувати; ґрунтуватися" для bygge
// (значение 1: "строить", значение 2: "основываться на"). Прежняя
// cleanTranslationVariants не считала ";" границей смысла — весь текст
// уходил в одну плоскую группу вариантов с общим sense_rank=1, из-за чего
// downstream (translation-aspect-reorder-worker) пытался переставить
// "будувати"/"побудувати"/"збудувати" вперемешку со "спертися"/
// "ґрунтуватися" как единую видову пару, и AI закономерно не мог найти
// среди них общую базову форму — либо путал местами, либо (при защите от
// галлюцинаций) отбрасывал часть слов как несовпадение множества.
//
// Разбиение depth-aware (";" не считается границей ВНУТРИ скобок — тот
// же принцип, что уже применяется для запятых в gloss-парсинге) на
// смысловые группы; внутри каждой группы — прежняя логика
// (|/,/пробельные-инфинитивы). Каждая группа получает свой sense_rank по
// порядку появления (1, 2, 3...), а не всегда 1.
export function splitOutsideParens(text: string, separator: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);

    if (char === separator && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export function cleanTranslationSenseGroups(text: string): string[][] {
  const normalized = String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  // Lexin uses `|` inside Ukr-lem to separate the preferred neutral/base
  // display variants (right side, as rendered on lexin.oslomet.no) from
  // supplementary aspect/search variants (left side). Keep one semantic
  // group, but rank the displayed right-hand variants first.
  const pipeBlocks = normalized.split('|').map((s) => s.trim()).filter(Boolean);
  const preferredBlock = pipeBlocks.length > 1 ? pipeBlocks[pipeBlocks.length - 1] : pipeBlocks[0];
  const supplementaryBlocks = pipeBlocks.length > 1 ? pipeBlocks.slice(0, -1) : [];
  const senseSegments = splitOutsideParens(preferredBlock ?? '', ';')
    .map((s) => s.trim())
    .filter(Boolean);

  return senseSegments
    .map((segment) => {
      const candidates = normalizeTranslationSegment(segment);

      // Supplementary forms belong to the first displayed sense. Appending
      // them preserves evidence while preventing them from outranking the
      // canonical Lexin display variants.
      if (segment === senseSegments[0]) {
        for (const block of supplementaryBlocks) {
          candidates.push(...normalizeTranslationSegment(block));
        }
      }

      const seen = new Set<string>();
      const unique: string[] = [];

      for (const candidate of candidates) {
        const cleaned = candidate
          .replace(/\s+/g, ' ')
          .replace(/\s+([,.;:!?])/g, '$1')
          .trim();

        if (!cleaned) continue;

        const key = normalizeKey(cleaned);
        if (seen.has(key)) continue;

        seen.add(key);
        unique.push(cleaned);
      }

      return unique;
    })
    .filter((group) => group.length > 0);
}
