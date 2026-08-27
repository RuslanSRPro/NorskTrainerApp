import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WORKER_NAME = 'translation-aspect-reorder-worker';
const RUN_ID = 'aspect-reorder-v2-batched-2026-08-20';

// ФИКС (20.08.2026): было — ОДИН Gemini-вызов НА КАЖДУЮ multi-variant
// группу, последовательно (for-цикл, до ~200 групп за один запуск крона,
// каждые 2 минуты — см. cron.job). Найдено при разборе стоимости: 4132
// реальных AI-решений с 05.08 по 19.08 — на порядок больше, чем всё, что
// прошло через job-scoped ai-enrichment-worker за то же время (~1013).
// Это, вероятно, основной источник неожиданно высокого расхода (600 кр
// за период), не heal-путь job-completion-auditor (тот уже починен
// отдельно, но был на порядок меньше по объёму).
// Теперь: группы батчатся в ОДИН запрос к Gemini (до BATCH_SIZE групп за
// раз, тот же паттерн ref-сопоставления, что и в ai-enrichment-worker) —
// вместо до 200 отдельных вызовов на запуск крона, максимум
// ceil(200/BATCH_SIZE) ≈ 10 batch-вызовов.
const BATCH_SIZE = 20;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  lexemeIds?: string[];      // job-scoped режим (как у forms-enrichment-worker)
  expressionIds?: string[];
  batchSize?: number;        // global batch режим
  dryRun?: boolean;
};

type TranslationRow = {
  id: string;
  lexeme_id: string | null;
  expression_id: string | null;
  language_code: string;
  translation: string;
  translation_type: string;
  translation_rank: number;
  source_entry_id: string | null;
  sense_rank: number | null;
};

type GroupInfo = {
  key: string;
  group: TranslationRow[];
  lemma: string;
  pos: string | null;
};

type BatchDecision = {
  ref: number;
  ordered_variants: string[];
  is_synonym_cluster: boolean;
  reasoning: string;
};

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  // ФИКС (25.07.2026): используем уже существующий в проекте GEMINI_API_KEY
  // вместо отдельного ANTHROPIC_API_KEY, которого в секретах проекта нет.
  // Имя модели — из отдельного секрета GEMINI_MODEL (уже используется где-то
  // ещё в пайплайне), с фолбэком на известную актуальную модель, если
  // секрет почему-то пуст.
  const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';

  if (!supabaseUrl || !serviceRoleKey || !geminiKey) {
    return jsonResponse({ ok: false, error: 'Missing env vars' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const body = await safeJson<RequestBody>(req);
  const dryRun = body.dryRun ?? false;

  // ── Собрать группы: (entity, language_code, translation_type, source_entry_id)
  //    с count > 1 — только такие нуждаются в упорядочивании ────────────────
  let query = supabase
    .from('entity_translations')
    .select('id, lexeme_id, expression_id, language_code, translation, translation_type, translation_rank, source_entry_id, sense_rank')
    .in('language_code', ['uk', 'en'])
    .in('translation_type', ['primary', 'expression_primary'])
    .not('translation_rank', 'is', null)
    .is('aspect_reorder_run', null); // ещё не обработано этим воркером

  if (body.lexemeIds?.length) {
    query = query.in('lexeme_id', body.lexemeIds);
  } else if (body.expressionIds?.length) {
    query = query.in('expression_id', body.expressionIds);
  } else {
    query = query.limit(body.batchSize ?? 200);
  }

  const { data: rows, error } = await query;
  if (error) return jsonResponse({ ok: false, error: error.message }, 500);
  if (!rows || rows.length === 0) {
    return jsonResponse({ ok: true, processed_groups: 0, message: 'No candidate rows' });
  }

  // Группировка по (entity_key, language_code, translation_type, source_entry_id, sense_rank)
  // ФИКС (25.07.2026, найдено на "bygge"): sense_rank добавлен в ключ —
  // без него разные значения слова в рамках одной статьи ("будувати" vs
  // "спертися/ґрунтуватися" для bygge) смешивались в одну группу, и AI
  // либо путал их порядок, либо отбрасывал часть слов, срабатывая на
  // защиту от галлюцинаций (набор слов до/после не совпадал).
  const groups = new Map<string, TranslationRow[]>();
  for (const row of rows as TranslationRow[]) {
    const entityKey = row.lexeme_id ?? row.expression_id ?? 'null';
    const key = [entityKey, row.language_code, row.translation_type, row.source_entry_id ?? 'null', row.sense_rank ?? 1].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Только группы с >1 вариантом реально нуждаются в AI-решении
  const multiVariantGroups = [...groups.entries()].filter(([, g]) => g.length > 1);
  const singleVariantIds = [...groups.entries()]
    .filter(([, g]) => g.length === 1)
    .flatMap(([, g]) => g.map((r) => r.id));

  // Одиночные варианты — просто помечаем как обработанные, без AI-вызова
  if (!dryRun && singleVariantIds.length > 0) {
    await supabase
      .from('entity_translations')
      .update({ aspect_reorder_run: RUN_ID })
      .in('id', singleVariantIds);
  }

  let processed = 0;
  let reordered = 0;
  let leftAsIs = 0;
  let failed = 0;
  const results: any[] = [];

  // ФИКС (20.08.2026): подгружаем лемму/pos для ВСЕХ групп заранее, одним
  // батчем на lexeme_ids + одним на expression_ids — вместо getLemma()
  // по одному запросу на группу внутри цикла.
  const groupInfos: GroupInfo[] = [];

  if (multiVariantGroups.length > 0) {
    const lexemeIdsNeeded = [
      ...new Set(
        multiVariantGroups
          .map(([, g]) => g[0].lexeme_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const expressionIdsNeeded = [
      ...new Set(
        multiVariantGroups
          .map(([, g]) => g[0].expression_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const lemmaByLexemeId = new Map<string, { lemma: string; pos: string | null }>();
    const lemmaByExpressionId = new Map<string, { lemma: string; pos: string | null }>();

    if (lexemeIdsNeeded.length > 0) {
      const { data: lexemeRows } = await supabase
        .from('lexemes')
        .select('id, lemma, pos')
        .in('id', lexemeIdsNeeded);
      for (const l of lexemeRows ?? []) {
        lemmaByLexemeId.set(l.id, { lemma: l.lemma ?? '?', pos: l.pos ?? null });
      }
    }

    if (expressionIdsNeeded.length > 0) {
      const { data: expressionRows } = await supabase
        .from('expression_catalog')
        .select('id, lemma, pos')
        .in('id', expressionIdsNeeded);
      for (const e of expressionRows ?? []) {
        lemmaByExpressionId.set(e.id, { lemma: e.lemma ?? '?', pos: e.pos ?? null });
      }
    }

    for (const [key, group] of multiVariantGroups) {
      const lexemeId = group[0].lexeme_id;
      const expressionId = group[0].expression_id;
      const meta =
        (lexemeId ? lemmaByLexemeId.get(lexemeId) : null) ??
        (expressionId ? lemmaByExpressionId.get(expressionId) : null) ??
        { lemma: '?', pos: null };

      groupInfos.push({ key, group, lemma: meta.lemma, pos: meta.pos });
    }
  }

  // ФИКС (20.08.2026): группы отправляются в Gemini ПАЧКАМИ по BATCH_SIZE,
  // вместо одного вызова на группу. Один batch-вызов возвращает решения
  // для всех групп чанка разом, сопоставленные по "ref".
  for (let i = 0; i < groupInfos.length; i += BATCH_SIZE) {
    const chunk = groupInfos.slice(i, i + BATCH_SIZE);

    let decisions: Map<number, BatchDecision>;

    try {
      decisions = await callAiReorderBatch(geminiKey, geminiModel, chunk);
    } catch (e) {
      // Весь батч не удался — каждая группа этого чанка помечается failed,
      // остальные чанки продолжают обрабатываться.
      for (const info of chunk) {
        processed++;
        failed++;
        results.push({ key: info.key, lemma: info.lemma, action: 'failed', error: safeErrorStringify(e) });
      }
      continue;
    }

    for (let idx = 0; idx < chunk.length; idx++) {
      const info = chunk[idx];
      const decision = decisions.get(idx);
      processed++;

      if (!decision) {
        failed++;
        results.push({ key: info.key, lemma: info.lemma, action: 'failed', error: 'missing_in_batch_response' });
        continue;
      }

      const { key, group } = info;
      const entityKey = group[0].lexeme_id ?? group[0].expression_id;

      if (decision.is_synonym_cluster) {
        leftAsIs++;
        results.push({ key, lemma: info.lemma, action: 'left_as_is', reason: decision.reasoning });

        if (!dryRun) {
          await supabase
            .from('entity_translations')
            .update({ aspect_reorder_run: RUN_ID, aspect_reorder_note: 'synonym_cluster: ' + decision.reasoning })
            .in('id', group.map((r) => r.id));

          // ФИКС (27.07.2026): translation_reorder больше не гарантированно
          // выполняется ДО translation_canonicalization в основном pipeline
          // (вынесена в фоновый cron — см. pipeline-supervisor). Синк здесь
          // держит lexemes.translation_ua/en в актуальном состоянии в
          // пределах ЭТОГО же cron-цикла, не дожидаясь следующего полного
          // прохода pipeline для той же лексемы.
          if (entityKey && group[0].lexeme_id) {
            await supabase.rpc('sync_lexeme_translation_columns', { p_lexeme_id: group[0].lexeme_id });
          }
        }
        continue;
      }

      const rankMap = new Map(decision.ordered_variants.map((v, i) => [normalizeText(v), i + 1]));
      let anyChanged = false;

      for (const row of group) {
        const newRank = rankMap.get(normalizeText(row.translation)) ?? row.translation_rank;
        if (newRank !== row.translation_rank) anyChanged = true;

        if (!dryRun) {
          await supabase
            .from('entity_translations')
            .update({
              translation_rank: newRank,
              aspect_reorder_run: RUN_ID,
              aspect_reorder_note: decision.reasoning,
            })
            .eq('id', row.id);
        }
      }

      if (anyChanged) reordered++;
      results.push({
        key, lemma: info.lemma,
        action: dryRun ? 'dry_run_reorder' : 'reordered',
        before: group.sort((a, b) => a.translation_rank - b.translation_rank).map((r) => r.translation),
        after: decision.ordered_variants,
        reasoning: decision.reasoning,
      });

      if (!dryRun && group[0].lexeme_id) {
        await supabase.rpc('sync_lexeme_translation_columns', { p_lexeme_id: group[0].lexeme_id });
      }
    }
  }

  return jsonResponse({
    ok: true, worker: WORKER_NAME, runId: RUN_ID, dryRun,
    processed_groups: processed, reordered, left_as_is: leftAsIs, failed,
    single_variant_marked: singleVariantIds.length,
    batch_calls_made: Math.ceil(groupInfos.length / BATCH_SIZE),
    results,
  });
});

// ФИКС (20.08.2026): переписано под ОДИН batch-вызов на несколько групп
// вместо одной группы за раз — тот же паттерн ref-сопоставления, что и в
// ai-enrichment-worker/callGeminiBatch. Каждая группа получает свой "ref"
// в промпте; модель обязана вернуть его же в ответе.
async function callAiReorderBatch(
  apiKey: string,
  model: string,
  infos: GroupInfo[],
): Promise<Map<number, BatchDecision>> {
  const items = infos.map((info, idx) => ({
    ref: idx,
    lemma: info.lemma,
    pos: info.pos,
    language_code: info.group[0].language_code,
    variants: info.group
      .slice()
      .sort((a, b) => a.translation_rank - b.translation_rank)
      .map((r) => r.translation),
  }));

  const inputJson = JSON.stringify(items, null, 2);

  const prompt = `Нижче — масив груп варіантів перекладу різних норвезьких слів/виразів. Для КОЖНОЇ групи потрібно прийняти окреме рішення, незалежно від інших груп.

Кожен елемент масиву містить:
- "ref": числовий ідентифікатор групи (поверни той самий ref у відповіді)
- "lemma": норвезька лема
- "pos": частина мови (може бути null)
- "language_code": мова перекладу ("uk" — українська, "en" — англійська)
- "variants": варіанти перекладу цього слова зі словника, у довільному порядку

Для КОЖНОЇ групи: якщо варіанти є формами ОДНОГО дієслова/поняття, що відрізняються
видом (наприклад: базова недоконана форма "працювати" і похідна доконана форма
"попрацювати"), розстав їх так, щоб БАЗОВА (найбільш нейтральна, словникова, зазвичай
недоконана) форма йшла першою.

Якщо варіанти групи — це РІЗНІ синоніми або різні значення слова (не видова пара
одного кореня), НЕ переставляй їх — познач is_synonym_cluster=true для ЦІЄЇ групи і
залиш ordered_variants у вихідному порядку.

Якщо ОДИН з варіантів групи явно НЕ належить до видової пари інших (потрапив у цей
список помилково, наприклад інше значення слова), можеш його виключити з
ordered_variants ЦІЄЇ групи — головне, розглянь всі інші випадки що ЗАЛИШИЛИСЬ як
видову пару і розстав їх правильно.

ВАЖЛИВО (для кожної групи окремо): ordered_variants може містити МЕНШЕ слів, ніж у
вхідному списку variants цієї групи (якщо ти виключив явно невідповідні), але
НІКОЛИ не повинен містити слів, яких не було у variants цієї ж групи — НЕ вигадуй нові
слова і НЕ підставляй типовіший переклад замість наданих варіантів, і НЕ переноси
слова з ОДНІЄЇ групи в ІНШУ.

Групи (масив JSON):
${inputJson}

Відповідай ЛИШЕ у форматі JSON-масиву, по одному об'єкту на кожну вхідну групу, без
жодного іншого тексту:
[
  {"ref": <той самий ref>, "ordered_variants": ["...", "..."], "is_synonym_cluster": false, "reasoning": "коротке пояснення"}
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  // Батч из нескольких групп — таймаут увеличен относительно одиночного
  // вызова (было 20с на 1 группу), но не безгранично: WORKER_TIMEOUT в
  // job-enrichment-batch-worker для этой цепочки уже 35с (см. её вызов
  // enqueueTranslationReorderEnrichment), держим запас под тем потолком.
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          // ФИКС (26.07.2026, найдено на "ta"): без явного maxOutputTokens
          // ответ для многозначных слов обрывался — нехватка лимита вывода.
          // Батч из нескольких групп пропорционально длиннее одной группы —
          // лимит поднят с 4096 до 8192.
          maxOutputTokens: 8192,
        },
      }),
      signal: controller.signal,
    });
  } catch (fetchError) {
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('Gemini API request timeout — aborted after 30000ms');
    }
    throw fetchError;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Gemini API ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  if (!cleaned) {
    throw new Error(`Gemini API returned empty text. Full response: ${JSON.stringify(data).slice(0, 500)}`);
  }

  const extractedJson = extractFirstJsonArray(cleaned);

  if (!extractedJson) {
    throw new Error(
      `Gemini API response temporarily incomplete (no closed JSON array found): ${cleaned.slice(0, 300)}`,
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(extractedJson);
  } catch (parseError) {
    throw new Error(
      `Gemini API returned malformed/temporarily unparseable JSON: ${safeErrorStringify(parseError)}. Raw (truncated): ${cleaned.slice(0, 300)}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI batch response is not a JSON array');
  }

  const byRef = new Map<number, BatchDecision>();

  for (const entry of parsed) {
    if (!entry || typeof entry.ref !== 'number') continue;
    if (!Array.isArray(entry.ordered_variants)) continue;

    const info = infos[entry.ref];
    if (!info) continue; // неизвестный ref — игнорируем, не роняем весь батч

    // ФИКС (25.07.2026, v2 — та же логика anti-hallucination, что и в
    // одиночной версии, применена per-группа): запрещено ДОБАВЛЯТЬ слова,
    // которых не было во входе ЭТОЙ группы (output ⊄ input). Слова, которые
    // AI законно исключил, дописываются в конец в исходном порядке.
    function stripParenthetical(v: string): string {
      return v.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function isPresentInInput(outputWord: string): boolean {
      const normalizedOutput = normalizeReorderText(outputWord);
      return info.group.some((row) => {
        const inputVariant = row.translation;
        const normalizedInput = normalizeReorderText(inputVariant);
        if (normalizedInput === normalizedOutput) return true;
        const strippedInput = normalizeReorderText(stripParenthetical(inputVariant));
        return strippedInput === normalizedOutput || strippedInput.includes(normalizedOutput) || normalizedOutput.includes(strippedInput);
      });
    }

    const outputWords = entry.ordered_variants.map((v: string) => String(v));
    const outputSet = new Set(outputWords.map(normalizeReorderText));
    const inventedWords = outputWords.filter((v) => !isPresentInInput(v));

    if (inventedWords.length > 0) {
      // Эта конкретная группа отбрасывается как failed — не роняет весь батч.
      continue;
    }

    const inputVariants = info.group.map((r) => r.translation);
    const droppedWords = inputVariants.filter((v) => !outputSet.has(normalizeReorderText(v)));
    const finalOrderedVariants = [...outputWords, ...droppedWords];

    byRef.set(entry.ref, {
      ref: entry.ref,
      ordered_variants: finalOrderedVariants,
      is_synonym_cluster: Boolean(entry.is_synonym_cluster),
      reasoning: String(entry.reasoning ?? '') + (droppedWords.length > 0
        ? ` [Примітка: AI виключив зі зіставлення видової пари: ${droppedWords.join(', ')} — залишено в кінці списку без зміни.]`
        : ''),
    });
  }

  return byRef;
}

// Аналог extractFirstJsonObject из одиночной версии, но для МАССИВА
// верхнего уровня (Gemini иногда добавляет текст после JSON — тот же
// класс проблемы, что и в одиночной версии, см. её комментарии).
function extractFirstJsonArray(text: string): string | null {
  const start = text.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '[') {
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null; // не закрылась ни одна скобка до конца текста — обрезано
}

function normalizeReorderText(v: string): string {
  return v.toLowerCase().trim();
}

function normalizeText(v: string): string {
  return v.toLowerCase().trim();
}

function safeErrorStringify(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

async function safeJson<T>(req: Request): Promise<T> {
  try { return await req.json(); } catch { return {} as T; }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}