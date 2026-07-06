import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const LEXIN_SOURCE = 'lexin';
const LEXIN_BASE_URL = 'https://editorportal.oslomet.no/api/v1/findwords';

// ФИКС: жёсткий лимит вариантов перевода/определения на (language_code, translation_type).
// Раньше был только dedup без верхнего предела — Lexin с несколькими группами
// (омографы/сенсы) мог дать rank 1,2,3,4,5,6... без ограничения. Теперь всё,
// что превышает лимит, помечается как excluded (rank=-1) и не идёт в upsert.
// Это же правило используется в ai-fallback (services/... AI fallback function) —
// держим значение синхронизированным между воркерами.
const MAX_TRANSLATION_VARIANTS = 2;

// Architecture rule: writes FACTS only — never writes to
// authoritative_semantic_relations directly.
// Gloss terms go to lexin_gloss_candidates (staging).
// authoritative-enrichment-pipeline-worker decides what to promote.
//
// includeEngLang=1 gives Ukrainian (Ukr-*) and English (B-*) in one call.
//
// Two modes:
//
// LEXEME MODE (no root_word):
//   query = lemma
//   uses: Ukr-lem→'primary', B-lem→'primary', Ukr-def, E-def, B-def, E-eks, B-eks
//
// EXPRESSION MODE (root_word provided):
//   query = root_word (e.g. "merke" for "legge merke til")
//   E-idi lives inside the root word article, not directly searchable by phrase
//   uses: E-idi match → Ukr-idi→'expression_primary', B-idi→'expression_primary'
//   gloss terms → lexin_gloss_candidates with confidence='medium'
//   skips Ukr-lem/B-lem of root word — those belong to root word, not expression
//
// TODO (future): in expression mode, save E-eks/Ukr-eks that are tied to the
// matched E-idi entry (not all examples from the root word article). Requires
// Lexin API to link examples to specific idioms — structure not yet confirmed.
//
// TODO (future): extract morphology from ordbankList in lexeme mode.

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Parse E-idi: "legge merke til (observere, se)"
// → { expressionText: "legge merke til", gloss: "observere, se", glossTerms: ["observere","se"] }
function parseIdiomText(text: string): {
  expressionText: string;
  gloss: string | null;
  glossTerms: string[];
} {
  const parenIdx = text.indexOf('(');
  if (parenIdx === -1) {
    return { expressionText: text.trim(), gloss: null, glossTerms: [] };
  }
  const expressionText = text.slice(0, parenIdx).trim();
  const rest = text.slice(parenIdx + 1);
  const closeIdx = rest.lastIndexOf(')');
  const gloss = closeIdx !== -1 ? rest.slice(0, closeIdx).trim() : rest.trim();
  const glossTerms = gloss.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  return { expressionText, gloss, glossTerms };
}

type LexinEntry = { id: number; sub_id: number; type: string; text: string; index: number | null };
type LexinGroup = LexinEntry[];

function entriesOfType(group: LexinGroup, ...types: string[]): LexinEntry[] {
  return group.filter((e) => types.includes(e.type));
}

async function fetchLexin(query: string): Promise<{ ok: boolean; data: unknown; url: string }> {
  const encoded = encodeURIComponent(query);
  const url = `${LEXIN_BASE_URL}?searchWord=${encoded}&lang=bokm%C3%A5l-ukrainsk&page=1&selectLang=bokm%C3%A5l-ukrainsk&includeEngLang=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
      Origin: 'https://lexin.oslomet.no',
      Referer: 'https://lexin.oslomet.no/',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Lexin HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const text = await response.text();
  if (!text || text.length < 5 || text === '[]' || text === '{}') {
    return { ok: false, data: null, url };
  }
  return { ok: true, data: JSON.parse(text), url };
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return jsonResponse({ ok: true });
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

    const body = await req.json().catch(() => ({}));

    const lexemeId: string | null = body.lexeme_id ?? null;
    const expressionId: string | null = body.expression_id ?? null;
    const lemma: string | null = body.lemma ? normalizeKey(String(body.lemma)) : null;
    // root_word: the source article lemma (not necessarily linguistic root).
    // e.g. "legge merke til" → root_word = "merke" (the Ordbokene article).
    // If not provided explicitly and expression_id is given, auto-resolved
    // from expression_catalog.root_lemma — no manual lookup needed.
    let rootWord: string | null = body.root_word
      ? normalizeKey(String(body.root_word))
      : null;
    const dryRun = body.dry_run !== false;

    if (!lemma) return jsonResponse({ ok: false, error: 'lemma is required' }, 400);
    if (!lexemeId && !expressionId) {
      return jsonResponse({ ok: false, error: 'lexeme_id or expression_id is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Missing env vars' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Auto-resolve root_word from expression_catalog.root_lemma when
    // expression_id is provided but root_word is not manually specified.
    // This enables autonomous orchestration without manual root_word lookup.
    //
    // ОТКАТ: попытка писать expression_catalog.lexeme_id прямо в
    // entity_translations.lexeme_id нарушает constraint
    // entity_translations_single_entity (строка не может иметь ОДНОВРЕМЕННО
    // lexeme_id и expression_id). Правильный способ синхронизировать
    // lexemes.translation_ua/en для expression'ов — через триггер
    // sync_lexeme_translation_columns, который сам резолвит lexeme_id через
    // expression_catalog по expression_id (см. миграцию
    // 20260705110000_fix_sync_via_expression_lookup.sql). Здесь оставляем
    // lexeme_id: null при записи (как и было изначально) — это корректно,
    // достаём из expression_catalog только root_lemma для авто-резолва
    // root_word.
    if (expressionId && !rootWord) {
      const { data: catalogRow } = await supabase
        .from('expression_catalog')
        .select('root_lemma')
        .eq('id', expressionId)
        .maybeSingle();

      if (catalogRow?.root_lemma) {
        rootWord = normalizeKey(catalogRow.root_lemma);
      }
    }

    const queryWord = rootWord ?? lemma;
    const expressionMode = Boolean(rootWord && expressionId);

    const lexin = await fetchLexin(queryWord);
    if (!lexin.ok || !lexin.data) {
      return jsonResponse({
        ok: true, skipped: true,
        reason: 'Lexin returned no results',
        lemma, root_word: rootWord, url: lexin.url,
      });
    }

    const data = lexin.data as any;
    const result = data?.result ?? data?.results ?? data?.data ?? data?.words ?? data;
    const groups: LexinGroup[] = Array.isArray(result) ? result : [];
    const normalizedLemma = normalizeKey(lemma);

    const translations: any[] = [];
    const sourceEvidence: any[] = [];
    const definitions: any[] = [];
    const examples: any[] = [];
    const glossCandidates: any[] = [];
    let idiomMatches = 0;  // how many E-idi entries matched our lemma

    for (const group of groups) {
      if (!Array.isArray(group)) continue;

      if (expressionMode) {
        // ── EXPRESSION MODE ───────────────────────────────────────────
        const ukrIdiEntries = entriesOfType(group, 'Ukr-idi');
        const bIdiEntries = entriesOfType(group, 'B-idi');
        const eIdiList = entriesOfType(group, 'E-idi');

        for (let idiIdx = 0; idiIdx < eIdiList.length; idiIdx++) {
          const e = eIdiList[idiIdx];
          if (!e.text?.trim()) continue;

          const parsed = parseIdiomText(e.text);
          if (normalizeKey(parsed.expressionText) !== normalizedLemma) continue;

          idiomMatches++;

          // Index matching: Lexin is inconsistent — E-idi: index=null,
          // B-idi: index=null, but Ukr-idi: index=0.
          // Strategy: exact match first, then positional fallback.
          const ukrIdi =
            ukrIdiEntries.find((u) => u.index === e.index) ??
            ukrIdiEntries.find((u) => u.index === idiIdx) ??
            ukrIdiEntries[idiIdx] ??
            null;
          const bIdi =
            bIdiEntries.find((b) => b.index === e.index) ??
            bIdiEntries[idiIdx] ??
            null;

          // Source evidence — one row per unique (expression_id, source, source_status, expression_text)
          // Blocker 1 fix: expression_text is now part of the unique key in the DB,
          // so two different E-idi for the same expression won't overwrite each other.
          sourceEvidence.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            source: LEXIN_SOURCE,
            source_status: 'e_idi',
            surface_form: e.text.trim(),
            expression_text: parsed.expressionText,   // part of unique key
            hint_text: parsed.gloss,
            gloss_terms: parsed.glossTerms,
            ukr_translation: ukrIdi?.text?.trim() ?? null,
            evidence: {
              lexin_entry_id: e.id,
              lexin_sub_id: e.sub_id,
              type: e.type,
              raw_text: e.text,
              parsed,
              ukr_idi: ukrIdi ?? null,
              b_idi: bIdi ?? null,
            },
            urls: [lexin.url],
          });

          // ФИКС: translation_rank теперь ставится как placeholder 0, а не
          // жёстко 1. Раньше при нескольких совпавших E-idi (несколько
          // сенсов одного выражения в статье) каждое давало свою запись
          // с rank=1 — то есть могло быть N записей "ранга 1" одновременно,
          // лимит фактически не работал. Теперь все idiom-переводы проходят
          // через тот же общий rerank+dedup+cap цикл ниже, что и primary.
          if (ukrIdi?.text?.trim()) {
            const parsedUkrIdi = parseIdiomText(ukrIdi.text);
            translations.push({
              // lexeme_id: null — обязательно для expression-строк, см.
              // constraint entity_translations_single_entity. Синхронизация
              // lexemes.translation_ua/en делается триггером через
              // expression_catalog-lookup, не через это поле.
              lexeme_id: null,
              expression_id: expressionId,
              language_code: 'uk',
              translation: parsedUkrIdi.expressionText,
              translation_type: 'expression_primary',
              translation_rank: 0, // placeholder — reassigned below
              source: LEXIN_SOURCE,
              confidence: 'high',
              surface_form: ukrIdi.text.trim(),
            });
          }

          if (bIdi?.text?.trim()) {
            const parsedBIdi = parseIdiomText(bIdi.text);
            translations.push({
              lexeme_id: null,
              expression_id: expressionId,
              language_code: 'en',
              translation: parsedBIdi.expressionText,
              translation_type: 'expression_primary',
              translation_rank: 0, // placeholder — reassigned below
              source: LEXIN_SOURCE,
              confidence: 'high',
              surface_form: bIdi.text.trim(),
            });
          }

          // Gloss terms → staging only.
          // Blocker 3 fix: confidence = 'medium', not 'low'.
          // These terms come from official Lexin E-idi, not heuristics.
          for (const term of parsed.glossTerms) {
            glossCandidates.push({
              source_lexeme_id: lexemeId,
              source_expression_id: expressionId,
              gloss_term: normalizeKey(term),
              surface_gloss: parsed.gloss,
              surface_idi: e.text.trim(),
              uk_translation: null,
              translation_status: 'pending',
              target_lexeme_id: null,
              target_status: 'pending',
              promotion_status: 'pending',
              source: LEXIN_SOURCE,
              confidence: 'medium',  // ← was 'low'
              evidence: {
                evidence_type: 'lexin_gloss_term',
                source_idi: e.text,
                gloss: parsed.gloss,
                all_gloss_terms: parsed.glossTerms,
              },
            });
          }
        }

      } else {
        // ── LEXEME MODE ───────────────────────────────────────────────
        const eLemEntries = entriesOfType(group, 'E-lem');
        const hasExactMatch = eLemEntries.some((e) => {
          const t = normalizeKey(e.text ?? '');
          return t === normalizedLemma || t.replace(/^å\s+/, '') === normalizedLemma.replace(/^å\s+/, '');
        });

        // Ukrainian primary (Ukr-lem) — collected per group, ranked globally below
        for (const e of entriesOfType(group, 'Ukr-lem')) {
          if (!e.text?.trim()) continue;
          translations.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            language_code: 'uk',
            translation: e.text.trim(),
            translation_type: 'primary',
            translation_rank: 0, // placeholder — reassigned after all groups
            source: LEXIN_SOURCE,
            confidence: hasExactMatch ? 'high' : 'medium',
            surface_form: eLemEntries[0]?.text ?? lemma,
          });
        }

        // English primary (B-lem)
        for (const e of entriesOfType(group, 'B-lem')) {
          if (!e.text?.trim()) continue;
          translations.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            language_code: 'en',
            translation: e.text.trim(),
            translation_type: 'primary',
            translation_rank: 0, // placeholder — reassigned after all groups
            source: LEXIN_SOURCE,
            confidence: hasExactMatch ? 'high' : 'medium',
            surface_form: eLemEntries[0]?.text ?? lemma,
          });
        }

        // Ukrainian definition (Ukr-def) → translation_type: 'definition'
        // ФИКС: раньше здесь НЕ было translation_rank вообще — такие записи
        // полностью пропускали rerank-цикл (условие `!== 0` их не трогало,
        // т.к. rank был undefined) и шли в upsert БЕЗ дедупликации и БЕЗ
        // лимита. Именно отсюда мог появляться "основной + 5 дополнительных"
        // при нескольких сенсах слова в статье Lexin. Теперь rank=0 —
        // попадает в общий цикл ниже наравне с primary/expression_primary.
        for (const e of entriesOfType(group, 'Ukr-def')) {
          if (!e.text?.trim()) continue;
          translations.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            language_code: 'uk',
            translation: e.text.trim(),
            translation_type: 'definition',
            translation_rank: 0, // placeholder — reassigned after all groups (ФИКС)
            source: LEXIN_SOURCE,
            confidence: 'medium',
            surface_form: null,
          });
        }

        // Norwegian definition (E-def)
        for (const e of entriesOfType(group, 'E-def')) {
          if (!e.text?.trim()) continue;
          definitions.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            language_code: 'nb',
            definition: e.text.trim(),
            source: LEXIN_SOURCE,
            source_type: 'e_def',
          });
        }

        // English definition (B-def)
        for (const e of entriesOfType(group, 'B-def')) {
          if (!e.text?.trim()) continue;
          definitions.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            language_code: 'en',
            definition: e.text.trim(),
            source: LEXIN_SOURCE,
            source_type: 'b_def',
          });
        }

        // Norwegian examples (E-eks) with Ukrainian translation
        const ukrEksEntries = entriesOfType(group, 'Ukr-eks');
        for (const e of entriesOfType(group, 'E-eks')) {
          if (!e.text?.trim()) continue;
          const ukrMatch = ukrEksEntries.find((u) => u.index === e.index);
          examples.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            language_code: 'nb',
            example_text: e.text.trim(),
            translation_uk: ukrMatch?.text?.trim() ?? null,
            source: LEXIN_SOURCE,
            source_type: 'e_eks',
          });
        }

        // English examples (B-eks) — iterate directly, NOT matched by index
        // (all have index: null, positional matching is unreliable)
        for (const e of entriesOfType(group, 'B-eks')) {
          if (!e.text?.trim()) continue;
          examples.push({
            lexeme_id: lexemeId,
            expression_id: expressionId,
            language_code: 'en',
            example_text: e.text.trim(),
            translation_uk: null,
            source: LEXIN_SOURCE,
            source_type: 'b_eks',
          });
        }
      }
    }

    // Global ranking for 'primary' / 'expression_primary' / 'definition'
    // translations — after collecting all groups. Lexin returns multiple
    // groups (homographs/senses); same translation may appear in several.
    // Deduplicate per (language, type) and assign rank=1 to the first unique
    // occurrence, rank=2 to the second.
    //
    // ФИКС: добавлен верхний предел MAX_TRANSLATION_VARIANTS. Раньше здесь
    // была только дедупликация без cap — третий, четвёртый, пятый уникальный
    // вариант перевода получали rank=3,4,5... и всё равно уходили в upsert.
    // Теперь всё, что превышает лимит, помечается rank=-1 (excluded) и
    // отфильтровывается ниже, как и обычные дубликаты.
    const seenTranslations = new Map<string, Set<string>>();
    const rankCounters = new Map<string, number>();

    for (const t of translations) {
      if (t.translation_rank !== 0) continue; // уже проставлен явно (не должно оставаться после фикса выше)

      const groupKey = `${t.language_code}:${t.translation_type}`;
      if (!seenTranslations.has(groupKey)) {
        seenTranslations.set(groupKey, new Set());
        rankCounters.set(groupKey, 0);
      }

      const key = (t.translation ?? '').toLowerCase().trim();
      const seen = seenTranslations.get(groupKey)!;

      if (seen.has(key)) {
        t.translation_rank = -1; // duplicate — filtered before upsert
        continue;
      }

      seen.add(key);
      const rank = (rankCounters.get(groupKey) ?? 0) + 1;
      rankCounters.set(groupKey, rank);

      // ФИКС: применяем лимит здесь
      t.translation_rank = rank > MAX_TRANSLATION_VARIANTS ? -1 : rank;
    }

    // Remove duplicates AND entries beyond MAX_TRANSLATION_VARIANTS before inserting
    const dedupedTranslations = translations.filter((t) => t.translation_rank !== -1);

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dry_run: true,
        lemma,
        root_word: rootWord,
        expression_mode: expressionMode,
        lexeme_id: lexemeId,
        expression_id: expressionId,
        groups_parsed: groups.length,
        max_translation_variants: MAX_TRANSLATION_VARIANTS,
        // Distincts between "article not found" and "article found but expression not matched"
        // idiom_matches = 0 + expression_mode = true → root_word wrong or expression not in article
        idiom_matches: expressionMode ? idiomMatches : null,
        matched_expression: expressionMode ? idiomMatches > 0 : null,
        would_upsert: {
          entity_translations: dedupedTranslations.length,
          expression_source_evidence: sourceEvidence.length,
          entity_definitions: definitions.length,
          entity_examples: examples.length,
          lexin_gloss_candidates: glossCandidates.length,
        },
        translations: dedupedTranslations,
        source_evidence: sourceEvidence,
        definitions,
        examples,
        gloss_candidates: glossCandidates,
      });
    }

    // ── Write to DB ───────────────────────────────────────────────────
    const results: Record<string, { upserted: number; errors: string[] }> = {};

    async function upsertBatch(table: string, rows: any[], onConflict: string) {
      if (!rows.length) { results[table] = { upserted: 0, errors: [] }; return; }
      const errors: string[] = [];
      let upserted = 0;
      for (const row of rows) {
        const { error } = await supabase
          .from(table)
          .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict });
        if (error) errors.push(safeStringify(error));
        else upserted++;
      }
      results[table] = { upserted, errors };
    }

    await upsertBatch(
      'entity_translations',
      dedupedTranslations,
      'lexeme_id,expression_id,language_code,translation_type,source,translation',
    );

    // Blocker 1: expression_text is now part of the unique key (see migration
    // 20260622160000_fix_expression_source_evidence_unique.sql)
    await upsertBatch(
      'expression_source_evidence',
      sourceEvidence,
      'lexeme_id,expression_id,source,source_status,expression_text',
    );

    await upsertBatch(
      'entity_definitions',
      definitions.filter((d) => d.definition?.trim()),
      'lexeme_id,expression_id,language_code,source',
    );

    await upsertBatch(
      'entity_examples',
      examples.filter((e) => e.example_text?.trim()),
      'lexeme_id,expression_id,language_code,source,example_text',
    );

    await upsertBatch(
      'lexin_gloss_candidates',
      glossCandidates,
      'source_lexeme_id,source_expression_id,gloss_term,source',
    );

    const totalErrors = Object.values(results).flatMap((r) => r.errors);

    return jsonResponse({
      ok: totalErrors.length === 0,
      dry_run: false,
      lemma,
      root_word: rootWord,
      expression_mode: expressionMode,
      lexeme_id: lexemeId,
      expression_id: expressionId,
      groups_parsed: groups.length,
      max_translation_variants: MAX_TRANSLATION_VARIANTS,
      idiom_matches: expressionMode ? idiomMatches : null,
      matched_expression: expressionMode ? idiomMatches > 0 : null,
      results,
      errors: totalErrors.length > 0 ? totalErrors : undefined,
    });

  } catch (err) {
    return jsonResponse(
      { ok: false, stage: 'unhandled_exception', error: safeStringify(err), stack: err instanceof Error ? err.stack : null },
      500,
    );
  }
});