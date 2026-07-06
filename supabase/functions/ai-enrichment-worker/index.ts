import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AI_SOURCE = 'ai_fallback';
const AI_PROVIDER = 'gemini';

// Источники, которые НЕ считаются авторитетным подтверждением перевода.
const NON_AUTHORITATIVE_SOURCES = ['ai_fallback', 'ai_candidate', 'ai analyzer'];

// Лексемы/выражения, которые в принципе не стоит трогать AI-добивкой: они
// ещё не прошли реальную проверку источниками (best_rank < 3 по нашей схеме).
const ELIGIBLE_VERIFICATION_STATUSES = ['authoritative', 'usage_verified', 'multi_source', 'candidate'];

// Жёсткий лимит вариантов перевода. Продублировано в lexin-enrichment-worker.
const MAX_TRANSLATION_VARIANTS = 2;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of value) {
    const text = String(item ?? '').trim();
    const key = normalizeKey(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }

  return out.slice(0, MAX_TRANSLATION_VARIANTS);
}

function extractGeminiText(data: any): string {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text ?? '')
      .join('') ?? ''
  );
}

function parseJsonFromText(text: string): any {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1) {
    throw new Error(`AI returned non-JSON: ${text.slice(0, 500)}`);
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function isAuthoritative(translationRow: any): boolean {
  const source = String(translationRow?.source ?? '').toLowerCase();
  return !NON_AUTHORITATIVE_SOURCES.includes(source);
}

function pickBestTranslation(translations: any[] | null, languageCode: 'uk' | 'en'): string | null {
  const rows = (translations ?? [])
    .filter((t: any) => t.language_code === languageCode && t.translation?.trim())
    .sort((a: any, b: any) => {
      const priority = (s: string) => {
        const src = String(s ?? '').toLowerCase();
        if (src === 'manual_verified') return 1;
        if (src === 'lexin') return 2;
        if (src === 'ai_fallback') return 3;
        return 9;
      };

      const ap = priority(a.source);
      const bp = priority(b.source);
      if (ap !== bp) return ap - bp;

      return Number(a.translation_rank ?? 999) - Number(b.translation_rank ?? 999);
    });

  return rows[0]?.translation?.trim() ?? null;
}

async function callGemini(input: {
  lemma: string;
  display_form: string | null;
  pos: string | null;
  missing: string[];
  existing_english_translation: string | null;
}) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const ukrainianInstruction = input.existing_english_translation
    ? `
For Ukrainian translation:
- Translate from this existing English meaning, not directly from Norwegian:
  "${input.existing_english_translation}"
- Prefer natural learner-dictionary Ukrainian, not literal wording.
- Return AT MOST ${MAX_TRANSLATION_VARIANTS} meanings, ordered from most to least common.
`
    : `
For Ukrainian translation:
- No English meaning is available.
- Translate directly from Norwegian lemma/display form.
- Prefer natural learner-dictionary Ukrainian, not literal wording.
- Return AT MOST ${MAX_TRANSLATION_VARIANTS} meanings, ordered from most to least common.
`;

  const prompt = `
You are enriching a Norwegian learning dictionary. Accuracy matters more than
coverage: it is better to return one confident meaning than two where the
second is a guess or a rare/literary sense.

Fill ONLY missing fields.
Do not replace existing authoritative data.
Do not invent source claims.
Return ONLY valid JSON.

Norwegian lemma: ${input.lemma}
Display form: ${input.display_form ?? input.lemma}
POS: ${input.pos ?? 'unknown'}
Missing fields: ${input.missing.join(', ')}
Existing English translation, if available: ${input.existing_english_translation ?? 'null'}

${ukrainianInstruction}

Return JSON:
{
  "translation_ua": ["..."],
  "translation_en": ["..."],
  "example_nb": "...",
  "example_translation_ua": "...",
  "notes_ua": "..."
}

Rules:
- Ukrainian translations: natural learner-dictionary meanings, MAX ${MAX_TRANSLATION_VARIANTS}, most common sense first.
- English translations: natural learner-dictionary meanings, MAX ${MAX_TRANSLATION_VARIANTS}, most common sense first.
- If one meaning fully covers normal usage, return only one translation.
- Norwegian example: simple, correct Bokmål.
- Notes in Ukrainian: one short practical sentence.
- If a field is not missing, still include it as null or [].
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  return parseJsonFromText(extractGeminiText(data));
}

// ============================================================================
// Единая модель кандидата — и для lexemes, и для expression_catalog.
//
// Раньше lexeme- и expression-ветки были ~300 строк почти идентичного кода,
// продублированного дважды. Это и создавало рассинхрон: в expression-ветке
// проверка "есть ли уже перевод" смотрела ТОЛЬКО на expression_id, забывая,
// что множество старых записей были написаны ДО того, как выражения
// получили expression_id вообще (или напрямую с lexeme_id, как записи через
// addExpressionCandidateToSupabase) — то есть лежат как
// entity_translations.lexeme_id = X, expression_id = null.
// Из-за этого worker считал "перевода нет" и пытался добавить AI-версию
// заново, хотя авторитетный перевод уже был — просто под другим ключом.
//
// Единая функция ниже всегда проверяет ОБА ключа (expression_id И lexeme_id,
// если lexeme_id известен), независимо от kind, поэтому такой рассинхрон
// больше не может возникнуть отдельно в одной из веток.
// ============================================================================

type EntityKind = 'lexeme' | 'expression';

type EntityCandidate = {
  kind: EntityKind;
  id: string; // lexemes.id (для kind='lexeme') или expression_catalog.id (для kind='expression')
  lexemeId: string | null; // для 'lexeme' — совпадает с id; для 'expression' — expression_catalog.lexeme_id (может быть null, если ещё не промоушено)
  lemma: string;
  displayForm: string | null;
  pos: string | null;
  notes: string | null; // есть только у lexemes; для expression всегда null
  verificationStatus: string | null;
};

type ProcessResult =
  | { ok: true; entry: Record<string, unknown> }
  | { ok: false; entry: Record<string, unknown> };

// Строит .or() фильтр по обоим возможным ключам записи, если lexemeId известен.
// Если lexemeId нет (expression ещё не промоушено в lexeme) — фильтр только
// по "своему" id.
function getOwnKeyColumn(candidate: EntityCandidate): 'lexeme_id' | 'expression_id' {
  return candidate.kind === 'expression' ? 'expression_id' : 'lexeme_id';
}

// ФИКС: используется ТОЛЬКО для READ (проверка "есть ли уже перевод где-то
// под любым из ключей") — legacy-записи могли быть написаны через lexeme_id
// до появления expression_id связей.
function buildEntityOrFilter(candidate: EntityCandidate): string {
  const ownKeyColumn = getOwnKeyColumn(candidate);
  const parts = [`${ownKeyColumn}.eq.${candidate.id}`];

  if (candidate.kind === 'expression' && candidate.lexemeId) {
    parts.push(`lexeme_id.eq.${candidate.lexemeId}`);
  }

  return parts.join(',');
}

// ФИКС (по замечанию): DELETE/UPSERT НЕ должны использовать .or() —
// в отличие от READ, где "смотреть под обоими ключами" безопасно и корректно,
// удаление/запись по OR может стереть записи, принадлежащие ДРУГОЙ сущности.
// Пример риска: "ta opp" имеет старый Lexin-перевод под lexeme_id=Y
// (expression_id=null) и новый AI-перевод под expression_id=X (lexeme_id=null).
// Если бы delete фильтровался по .or(...), повторный прогон по expression_id=X
// удалил бы ОБЕ записи — включая ту, что физически принадлежит lexeme_id=Y и
// могла в будущем стать manual_verified под ЭТИМ ключом независимо. DELETE/
// UPSERT здесь работают строго со "своим" ключом текущей сущности — то, что
// лежит под другим ключом, эта функция никогда не трогает.
function applyOwnKeyEq<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  candidate: EntityCandidate,
): T {
  return query.eq(getOwnKeyColumn(candidate), candidate.id);
}

// Выносит запись одного языка (uk/en) в отдельную функцию — используется
// дважды в processCandidate (для translation_ua и translation_en), раньше
// было продублировано инлайн.
async function writeTranslations(
  supabase: ReturnType<typeof createClient>,
  candidate: EntityCandidate,
  params: {
    languageCode: 'uk' | 'en';
    list: string[];
    translationType: 'primary' | 'expression_primary';
    writeLexemeId: string | null;
    writeExpressionId: string | null;
    existingEnglishTranslation: string | null;
  },
): Promise<{ written: number; errors: string[] }> {
  const errors: string[] = [];
  let written = 0;

  await applyOwnKeyEq(
    supabase
      .from('entity_translations')
      .delete()
      .eq('language_code', params.languageCode)
      .eq('source', AI_SOURCE)
      .in('translation_type', ['primary', 'expression_primary']),
    candidate,
  );

  let rank = 0;
  for (const translation of params.list) {
    rank++;

    const isUk = params.languageCode === 'uk';
    const { error } = await supabase.from('entity_translations').upsert(
      {
        lexeme_id: params.writeLexemeId,
        expression_id: params.writeExpressionId,
        language_code: params.languageCode,
        translation,
        translation_type: params.translationType,
        translation_rank: rank,
        source: AI_SOURCE,
        confidence: isUk ? (params.existingEnglishTranslation ? 'medium' : 'low') : 'medium',
        notes: isUk
          ? params.existingEnglishTranslation
            ? 'AI fallback: translated Ukrainian from existing English meaning'
            : 'AI fallback: translated Ukrainian directly from Norwegian'
          : 'AI fallback: no authoritative English primary translation found',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'lexeme_id,expression_id,language_code,translation_type,source,translation',
      },
    );

    if (!error) written++;
    else errors.push(`${params.languageCode} upsert failed: ${error.message}`);
  }

  return { written, errors };
}

async function writeExample(
  supabase: ReturnType<typeof createClient>,
  candidate: EntityCandidate,
  params: {
    exampleNb: string;
    exampleTranslationUa: string | null;
    writeLexemeId: string | null;
    writeExpressionId: string | null;
  },
): Promise<{ written: boolean; error?: string }> {
  await applyOwnKeyEq(
    supabase.from('entity_examples').delete().eq('source', AI_SOURCE),
    candidate,
  );

  const { error } = await supabase.from('entity_examples').upsert(
    {
      lexeme_id: params.writeLexemeId,
      expression_id: params.writeExpressionId,
      language_code: 'nb',
      example_text: params.exampleNb.trim(),
      translation_uk: params.exampleTranslationUa?.trim() ?? null,
      source: AI_SOURCE,
      source_type: 'ai_example',
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'lexeme_id,expression_id,language_code,source,example_text',
    },
  );

  return error ? { written: false, error: `example upsert failed: ${error.message}` } : { written: true };
}

async function processCandidate(
  supabase: ReturnType<typeof createClient>,
  candidate: EntityCandidate,
  dryRun: boolean,
): Promise<ProcessResult> {
  const readFilter = buildEntityOrFilter(candidate);

  // READ: ищем под ОБОИМИ ключами — см. buildEntityOrFilter.
  const { data: allTranslations } = await supabase
    .from('entity_translations')
    .select('language_code, translation, translation_type, source, translation_rank')
    .or(readFilter)
    .in('translation_type', ['primary', 'expression_primary']);

  const authoritativeTranslations = (allTranslations ?? []).filter(isAuthoritative);

  const hasAuthoritativeUk = authoritativeTranslations.some((t: any) => t.language_code === 'uk');
  const hasAuthoritativeEn = authoritativeTranslations.some((t: any) => t.language_code === 'en');

  const existingEnglishTranslation = pickBestTranslation(allTranslations, 'en');

  const { data: authoritativeExamples } = await supabase
    .from('entity_examples')
    .select('id, source')
    .or(readFilter)
    .neq('source', AI_SOURCE)
    .limit(1);

  const hasAuthoritativeExample = Boolean(authoritativeExamples?.length);

  const missing: string[] = [];

  if (!hasAuthoritativeUk) missing.push('translation_ua');
  if (!hasAuthoritativeEn) missing.push('translation_en');
  if (!hasAuthoritativeExample) missing.push('example');
  if (candidate.kind === 'lexeme' && !candidate.notes) missing.push('notes');

  const baseEntry: Record<string, unknown> = {
    kind: candidate.kind,
    id: candidate.id,
    lexeme_id: candidate.lexemeId,
    lemma: candidate.lemma,
    verification_status: candidate.verificationStatus,
  };

  if (missing.length === 0) {
    return { ok: true, entry: { ...baseEntry, skipped: true, reason: 'nothing_missing' } };
  }

  if (dryRun) {
    return {
      ok: true,
      entry: {
        ...baseEntry,
        missing,
        would_call_ai: true,
        ai_provider: AI_PROVIDER,
        ukrainian_strategy: existingEnglishTranslation ? 'en_to_uk' : 'nb_to_uk',
        existing_english_translation: existingEnglishTranslation,
      },
    };
  }

  const ai = await callGemini({
    lemma: candidate.lemma,
    display_form: candidate.displayForm ?? candidate.lemma,
    pos: candidate.pos,
    missing,
    existing_english_translation: existingEnglishTranslation,
  });

  const translationType = candidate.kind === 'expression' ? 'expression_primary' : 'primary';

  // WRITE: lexeme_id/expression_id — только "свои", per constraint
  // entity_translations_single_entity.
  const writeLexemeId = candidate.kind === 'lexeme' ? candidate.id : null;
  const writeExpressionId = candidate.kind === 'expression' ? candidate.id : null;

  let translationsWritten = 0;
  const writeErrors: string[] = [];

  if (missing.includes('translation_ua')) {
    const { written, errors } = await writeTranslations(supabase, candidate, {
      languageCode: 'uk',
      list: cleanList(ai.translation_ua),
      translationType,
      writeLexemeId,
      writeExpressionId,
      existingEnglishTranslation,
    });
    translationsWritten += written;
    writeErrors.push(...errors);
  }

  if (missing.includes('translation_en')) {
    const { written, errors } = await writeTranslations(supabase, candidate, {
      languageCode: 'en',
      list: cleanList(ai.translation_en),
      translationType,
      writeLexemeId,
      writeExpressionId,
      existingEnglishTranslation,
    });
    translationsWritten += written;
    writeErrors.push(...errors);
  }

  let exampleWritten = false;

  if (missing.includes('example') && ai.example_nb?.trim()) {
    const result = await writeExample(supabase, candidate, {
      exampleNb: String(ai.example_nb),
      exampleTranslationUa: ai.example_translation_ua ?? null,
      writeLexemeId,
      writeExpressionId,
    });
    exampleWritten = result.written;
    if (result.error) writeErrors.push(result.error);
  }

  // notes — есть только у lexemes. lexemes.translation_ua/en синхронизируется
  // отдельно триггером entity_translations_sync_lexeme_columns.
  const updatedFields: string[] = [];

  if (candidate.kind === 'lexeme' && missing.includes('notes') && ai.notes_ua?.trim()) {
    const { error: notesError } = await supabase
      .from('lexemes')
      .update({ notes: String(ai.notes_ua).trim(), updated_at: new Date().toISOString() })
      .eq('id', candidate.id);

    if (!notesError) updatedFields.push('notes');
    else writeErrors.push(`notes update failed: ${notesError.message}`);
  }

  if (translationsWritten > 0) {
    if (missing.includes('translation_ua')) updatedFields.push('translation_ua');
    if (missing.includes('translation_en')) updatedFields.push('translation_en');
  }
  if (exampleWritten) updatedFields.push('example');

  const fieldsKey = candidate.kind === 'expression' ? 'updated_expression_fields' : 'updated_lexemes_fields';

  return {
    ok: writeErrors.length === 0,
    entry: {
      ...baseEntry,
      missing,
      ai_provider: AI_PROVIDER,
      ukrainian_strategy: existingEnglishTranslation ? 'en_to_uk' : 'nb_to_uk',
      existing_english_translation: existingEnglishTranslation,
      translations_written: translationsWritten,
      example_written: exampleWritten,
      [fieldsKey]: updatedFields,
      write_errors: writeErrors.length ? writeErrors : undefined,
    },
  };
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return jsonResponse({ ok: true });
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

    const body = await req.json().catch(() => ({}));

    const limit = Math.min(Number(body.limit ?? 25), 100);
    const dryRun = body.dry_run !== false;
    const onlyLexemeId = body.lexeme_id ?? null;
    const onlyExpressionId = body.expression_id ?? null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Missing Supabase env vars' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ФИКС: если явно передан expression_id БЕЗ lexeme_id (точечный вызов
    // callAiFallbackForExpression) — lexeme-запрос пропускается целиком.
    // Раньше он выполнялся без фильтра в этом случае и мог "съесть" общий
    // лимит на случайную лексему, не дав дойти до нужного выражения.
    const shouldRunLexemeLoop = !(onlyExpressionId && !onlyLexemeId);
    const shouldRunExpressionLoop = !(onlyLexemeId && !onlyExpressionId);

    const candidates: EntityCandidate[] = [];

    if (shouldRunLexemeLoop) {
      let query = supabase
        .from('lexemes')
        .select('id, lemma, pos, display_form, notes, verification_status')
        .in('verification_status', ELIGIBLE_VERIFICATION_STATUSES)
        .not('lemma', 'ilike', '%�%')
        .order('updated_at', { ascending: true })
        .limit(limit * 3);

      if (onlyLexemeId) query = query.eq('id', onlyLexemeId);

      const { data, error } = await query;
      if (error) throw error;

      for (const row of data ?? []) {
        candidates.push({
          kind: 'lexeme',
          id: row.id,
          lexemeId: row.id,
          lemma: row.lemma,
          displayForm: row.display_form ?? null,
          pos: row.pos ?? null,
          notes: row.notes ?? null,
          verificationStatus: row.verification_status ?? null,
        });
      }
    }

    if (shouldRunExpressionLoop) {
      let expressionQuery = supabase
        .from('expression_catalog')
        .select('id, lemma, expression_subtype, lexeme_id, verification_status')
        .in('verification_status', ELIGIBLE_VERIFICATION_STATUSES)
        .not('lemma', 'ilike', '%�%')
        .order('updated_at', { ascending: true })
        .limit(limit * 3);

      if (onlyExpressionId) expressionQuery = expressionQuery.eq('id', onlyExpressionId);

      const { data, error } = await expressionQuery;
      if (error) throw error;

      for (const row of data ?? []) {
        candidates.push({
          kind: 'expression',
          id: row.id,
          lexemeId: row.lexeme_id ?? null,
          lemma: row.lemma,
          displayForm: row.lemma,
          pos: 'expression',
          notes: null,
          verificationStatus: row.verification_status ?? null,
        });
      }
    }

    const processed: Record<string, unknown>[] = [];
    const errors: Record<string, unknown>[] = [];

    for (const candidate of candidates) {
      if (processed.length >= limit) break;

      try {
        const result = await processCandidate(supabase, candidate, dryRun);

        // ФИКС: раньше skipped-кандидаты (у которых нет пробелов) вообще не
        // попадали в processed[] — из-за этого processed_count: 0 нельзя
        // было отличить от "запрос вообще не нашёл кандидата с таким id"
        // (например, verification_status не входит в ELIGIBLE_VERIFICATION_STATUSES,
        // или id опечатан). Теперь skipped-кандидаты тоже попадают в
        // processed[] с явным skipped: true — не увеличивая при этом счётчик
        // processed_lexemes/processed_expressions (см. фильтры ниже, которые
        // дополнительно проверяют !p.skipped).
        processed.push(result.entry);

        if (!result.ok) {
          errors.push({
            kind: candidate.kind,
            id: candidate.id,
            lemma: candidate.lemma,
            error: 'write_errors present, see processed entry',
          });
        }
      } catch (rowError) {
        errors.push({
          kind: candidate.kind,
          id: candidate.id,
          lemma: candidate.lemma,
          error: safeStringify(rowError),
        });
      }
    }

    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      ai_provider: AI_PROVIDER,
      max_translation_variants: MAX_TRANSLATION_VARIANTS,
      eligible_verification_statuses: ELIGIBLE_VERIFICATION_STATUSES,
      candidates_found: candidates.length,
      processed_count: processed.filter((p) => !p.skipped).length,
      skipped_count: processed.filter((p) => p.skipped).length,
      processed_lexemes: processed.filter((p) => p.kind === 'lexeme' && !p.skipped).length,
      processed_expressions: processed.filter((p) => p.kind === 'expression' && !p.skipped).length,
      error_count: errors.length,
      processed,
      errors,
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        stage: 'unhandled_exception',
        error: safeStringify(err),
        stack: err instanceof Error ? err.stack : null,
      },
      500,
    );
  }
});