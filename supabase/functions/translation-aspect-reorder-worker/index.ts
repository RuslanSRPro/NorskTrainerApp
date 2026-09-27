import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WORKER_NAME = 'translation-aspect-reorder-worker';
const RUN_ID = 'aspect-reorder-v2-batched-2026-08-20';

// Р¤РРљРЎ (20.08.2026): Р±С‹Р»Рѕ вЂ” РћР”РРќ Gemini-РІС‹Р·РѕРІ РќРђ РљРђР–Р”РЈР® multi-variant
// РіСЂСѓРїРїСѓ, РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕ (for-С†РёРєР», РґРѕ ~200 РіСЂСѓРїРї Р·Р° РѕРґРёРЅ Р·Р°РїСѓСЃРє РєСЂРѕРЅР°,
// РєР°Р¶РґС‹Рµ 2 РјРёРЅСѓС‚С‹ вЂ” СЃРј. cron.job). РќР°Р№РґРµРЅРѕ РїСЂРё СЂР°Р·Р±РѕСЂРµ СЃС‚РѕРёРјРѕСЃС‚Рё: 4132
// СЂРµР°Р»СЊРЅС‹С… AI-СЂРµС€РµРЅРёР№ СЃ 05.08 РїРѕ 19.08 вЂ” РЅР° РїРѕСЂСЏРґРѕРє Р±РѕР»СЊС€Рµ, С‡РµРј РІСЃС‘, С‡С‚Рѕ
// РїСЂРѕС€Р»Рѕ С‡РµСЂРµР· job-scoped ai-enrichment-worker Р·Р° С‚Рѕ Р¶Рµ РІСЂРµРјСЏ (~1013).
// Р­С‚Рѕ, РІРµСЂРѕСЏС‚РЅРѕ, РѕСЃРЅРѕРІРЅРѕР№ РёСЃС‚РѕС‡РЅРёРє РЅРµРѕР¶РёРґР°РЅРЅРѕ РІС‹СЃРѕРєРѕРіРѕ СЂР°СЃС…РѕРґР° (600 РєСЂ
// Р·Р° РїРµСЂРёРѕРґ), РЅРµ heal-РїСѓС‚СЊ job-completion-auditor (С‚РѕС‚ СѓР¶Рµ РїРѕС‡РёРЅРµРЅ
// РѕС‚РґРµР»СЊРЅРѕ, РЅРѕ Р±С‹Р» РЅР° РїРѕСЂСЏРґРѕРє РјРµРЅСЊС€Рµ РїРѕ РѕР±СЉС‘РјСѓ).
// РўРµРїРµСЂСЊ: РіСЂСѓРїРїС‹ Р±Р°С‚С‡Р°С‚СЃСЏ РІ РћР”РРќ Р·Р°РїСЂРѕСЃ Рє Gemini (РґРѕ BATCH_SIZE РіСЂСѓРїРї Р·Р°
// СЂР°Р·, С‚РѕС‚ Р¶Рµ РїР°С‚С‚РµСЂРЅ ref-СЃРѕРїРѕСЃС‚Р°РІР»РµРЅРёСЏ, С‡С‚Рѕ Рё РІ ai-enrichment-worker) вЂ”
// РІРјРµСЃС‚Рѕ РґРѕ 200 РѕС‚РґРµР»СЊРЅС‹С… РІС‹Р·РѕРІРѕРІ РЅР° Р·Р°РїСѓСЃРє РєСЂРѕРЅР°, РјР°РєСЃРёРјСѓРј
// ceil(200/BATCH_SIZE) в‰€ 10 batch-РІС‹Р·РѕРІРѕРІ.
const BATCH_SIZE = 20;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  lexemeIds?: string[];      // job-scoped СЂРµР¶РёРј (РєР°Рє Сѓ authoritative V2 forms worker)
  expressionIds?: string[];
  batchSize?: number;        // global batch СЂРµР¶РёРј
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
  // Р¤РРљРЎ (25.07.2026): РёСЃРїРѕР»СЊР·СѓРµРј СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ РІ РїСЂРѕРµРєС‚Рµ GEMINI_API_KEY
  // РІРјРµСЃС‚Рѕ РѕС‚РґРµР»СЊРЅРѕРіРѕ ANTHROPIC_API_KEY, РєРѕС‚РѕСЂРѕРіРѕ РІ СЃРµРєСЂРµС‚Р°С… РїСЂРѕРµРєС‚Р° РЅРµС‚.
  // РРјСЏ РјРѕРґРµР»Рё вЂ” РёР· РѕС‚РґРµР»СЊРЅРѕРіРѕ СЃРµРєСЂРµС‚Р° GEMINI_MODEL (СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РіРґРµ-С‚Рѕ
  // РµС‰С‘ РІ РїР°Р№РїР»Р°Р№РЅРµ), СЃ С„РѕР»Р±СЌРєРѕРј РЅР° РёР·РІРµСЃС‚РЅСѓСЋ Р°РєС‚СѓР°Р»СЊРЅСѓСЋ РјРѕРґРµР»СЊ, РµСЃР»Рё
  // СЃРµРєСЂРµС‚ РїРѕС‡РµРјСѓ-С‚Рѕ РїСѓСЃС‚.
  const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';

  if (!supabaseUrl || !serviceRoleKey || !geminiKey) {
    return jsonResponse({ ok: false, error: 'Missing env vars' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const body = await safeJson<RequestBody>(req);
  const dryRun = body.dryRun ?? false;

  // в”Ђв”Ђ РЎРѕР±СЂР°С‚СЊ РіСЂСѓРїРїС‹: (entity, language_code, translation_type, source_entry_id)
  //    СЃ count > 1 вЂ” С‚РѕР»СЊРєРѕ С‚Р°РєРёРµ РЅСѓР¶РґР°СЋС‚СЃСЏ РІ СѓРїРѕСЂСЏРґРѕС‡РёРІР°РЅРёРё в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  let query = supabase
    .from('entity_translations')
    .select('id, lexeme_id, expression_id, language_code, translation, translation_type, translation_rank, source_entry_id, sense_rank')
    .in('language_code', ['uk', 'en'])
    .in('translation_type', ['primary', 'expression_primary'])
    .not('translation_rank', 'is', null)
    .is('aspect_reorder_run', null); // РµС‰С‘ РЅРµ РѕР±СЂР°Р±РѕС‚Р°РЅРѕ СЌС‚РёРј РІРѕСЂРєРµСЂРѕРј

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

  // Р“СЂСѓРїРїРёСЂРѕРІРєР° РїРѕ (entity_key, language_code, translation_type, source_entry_id, sense_rank)
  // Р¤РРљРЎ (25.07.2026, РЅР°Р№РґРµРЅРѕ РЅР° "bygge"): sense_rank РґРѕР±Р°РІР»РµРЅ РІ РєР»СЋС‡ вЂ”
  // Р±РµР· РЅРµРіРѕ СЂР°Р·РЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ СЃР»РѕРІР° РІ СЂР°РјРєР°С… РѕРґРЅРѕР№ СЃС‚Р°С‚СЊРё ("Р±СѓРґСѓРІР°С‚Рё" vs
  // "СЃРїРµСЂС‚РёСЃСЏ/Т‘СЂСѓРЅС‚СѓРІР°С‚РёСЃСЏ" РґР»СЏ bygge) СЃРјРµС€РёРІР°Р»РёСЃСЊ РІ РѕРґРЅСѓ РіСЂСѓРїРїСѓ, Рё AI
  // Р»РёР±Рѕ РїСѓС‚Р°Р» РёС… РїРѕСЂСЏРґРѕРє, Р»РёР±Рѕ РѕС‚Р±СЂР°СЃС‹РІР°Р» С‡Р°СЃС‚СЊ СЃР»РѕРІ, СЃСЂР°Р±Р°С‚С‹РІР°СЏ РЅР°
  // Р·Р°С‰РёС‚Сѓ РѕС‚ РіР°Р»Р»СЋС†РёРЅР°С†РёР№ (РЅР°Р±РѕСЂ СЃР»РѕРІ РґРѕ/РїРѕСЃР»Рµ РЅРµ СЃРѕРІРїР°РґР°Р»).
  const groups = new Map<string, TranslationRow[]>();
  for (const row of rows as TranslationRow[]) {
    const entityKey = row.lexeme_id ?? row.expression_id ?? 'null';
    const key = [entityKey, row.language_code, row.translation_type, row.source_entry_id ?? 'null', row.sense_rank ?? 1].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // РўРѕР»СЊРєРѕ РіСЂСѓРїРїС‹ СЃ >1 РІР°СЂРёР°РЅС‚РѕРј СЂРµР°Р»СЊРЅРѕ РЅСѓР¶РґР°СЋС‚СЃСЏ РІ AI-СЂРµС€РµРЅРёРё
  const multiVariantGroups = [...groups.entries()].filter(([, g]) => g.length > 1);
  const singleVariantIds = [...groups.entries()]
    .filter(([, g]) => g.length === 1)
    .flatMap(([, g]) => g.map((r) => r.id));

  // РћРґРёРЅРѕС‡РЅС‹Рµ РІР°СЂРёР°РЅС‚С‹ вЂ” РїСЂРѕСЃС‚Рѕ РїРѕРјРµС‡Р°РµРј РєР°Рє РѕР±СЂР°Р±РѕС‚Р°РЅРЅС‹Рµ, Р±РµР· AI-РІС‹Р·РѕРІР°
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

  // Р¤РРљРЎ (20.08.2026): РїРѕРґРіСЂСѓР¶Р°РµРј Р»РµРјРјСѓ/pos РґР»СЏ Р’РЎР•РҐ РіСЂСѓРїРї Р·Р°СЂР°РЅРµРµ, РѕРґРЅРёРј
  // Р±Р°С‚С‡РµРј РЅР° lexeme_ids + РѕРґРЅРёРј РЅР° expression_ids вЂ” РІРјРµСЃС‚Рѕ getLemma()
  // РїРѕ РѕРґРЅРѕРјСѓ Р·Р°РїСЂРѕСЃСѓ РЅР° РіСЂСѓРїРїСѓ РІРЅСѓС‚СЂРё С†РёРєР»Р°.
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

  // Р¤РРљРЎ (20.08.2026): РіСЂСѓРїРїС‹ РѕС‚РїСЂР°РІР»СЏСЋС‚СЃСЏ РІ Gemini РџРђР§РљРђРњР РїРѕ BATCH_SIZE,
  // РІРјРµСЃС‚Рѕ РѕРґРЅРѕРіРѕ РІС‹Р·РѕРІР° РЅР° РіСЂСѓРїРїСѓ. РћРґРёРЅ batch-РІС‹Р·РѕРІ РІРѕР·РІСЂР°С‰Р°РµС‚ СЂРµС€РµРЅРёСЏ
  // РґР»СЏ РІСЃРµС… РіСЂСѓРїРї С‡Р°РЅРєР° СЂР°Р·РѕРј, СЃРѕРїРѕСЃС‚Р°РІР»РµРЅРЅС‹Рµ РїРѕ "ref".
  for (let i = 0; i < groupInfos.length; i += BATCH_SIZE) {
    const chunk = groupInfos.slice(i, i + BATCH_SIZE);

    let decisions: Map<number, BatchDecision>;

    try {
      decisions = await callAiReorderBatch(geminiKey, geminiModel, chunk);
    } catch (e) {
      // Р’РµСЃСЊ Р±Р°С‚С‡ РЅРµ СѓРґР°Р»СЃСЏ вЂ” РєР°Р¶РґР°СЏ РіСЂСѓРїРїР° СЌС‚РѕРіРѕ С‡Р°РЅРєР° РїРѕРјРµС‡Р°РµС‚СЃСЏ failed,
      // РѕСЃС‚Р°Р»СЊРЅС‹Рµ С‡Р°РЅРєРё РїСЂРѕРґРѕР»Р¶Р°СЋС‚ РѕР±СЂР°Р±Р°С‚С‹РІР°С‚СЊСЃСЏ.
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
      if (decision.is_synonym_cluster) {
        leftAsIs++;
        results.push({ key, lemma: info.lemma, action: 'left_as_is', reason: decision.reasoning });

        if (!dryRun) {
          await supabase
            .from('entity_translations')
            .update({ aspect_reorder_run: RUN_ID, aspect_reorder_note: 'synonym_cluster: ' + decision.reasoning })
            .in('id', group.map((r) => r.id));

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

// Р¤РРљРЎ (20.08.2026): РїРµСЂРµРїРёСЃР°РЅРѕ РїРѕРґ РћР”РРќ batch-РІС‹Р·РѕРІ РЅР° РЅРµСЃРєРѕР»СЊРєРѕ РіСЂСѓРїРї
// РІРјРµСЃС‚Рѕ РѕРґРЅРѕР№ РіСЂСѓРїРїС‹ Р·Р° СЂР°Р· вЂ” С‚РѕС‚ Р¶Рµ РїР°С‚С‚РµСЂРЅ ref-СЃРѕРїРѕСЃС‚Р°РІР»РµРЅРёСЏ, С‡С‚Рѕ Рё РІ
// ai-enrichment-worker/callGeminiBatch. РљР°Р¶РґР°СЏ РіСЂСѓРїРїР° РїРѕР»СѓС‡Р°РµС‚ СЃРІРѕР№ "ref"
// РІ РїСЂРѕРјРїС‚Рµ; РјРѕРґРµР»СЊ РѕР±СЏР·Р°РЅР° РІРµСЂРЅСѓС‚СЊ РµРіРѕ Р¶Рµ РІ РѕС‚РІРµС‚Рµ.
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

  const prompt = `РќРёР¶С‡Рµ вЂ” РјР°СЃРёРІ РіСЂСѓРї РІР°СЂС–Р°РЅС‚С–РІ РїРµСЂРµРєР»Р°РґСѓ СЂС–Р·РЅРёС… РЅРѕСЂРІРµР·СЊРєРёС… СЃР»С–РІ/РІРёСЂР°Р·С–РІ. Р”Р»СЏ РљРћР–РќРћР‡ РіСЂСѓРїРё РїРѕС‚СЂС–Р±РЅРѕ РїСЂРёР№РЅСЏС‚Рё РѕРєСЂРµРјРµ СЂС–С€РµРЅРЅСЏ, РЅРµР·Р°Р»РµР¶РЅРѕ РІС–Рґ С–РЅС€РёС… РіСЂСѓРї.

РљРѕР¶РµРЅ РµР»РµРјРµРЅС‚ РјР°СЃРёРІСѓ РјС–СЃС‚РёС‚СЊ:
- "ref": С‡РёСЃР»РѕРІРёР№ С–РґРµРЅС‚РёС„С–РєР°С‚РѕСЂ РіСЂСѓРїРё (РїРѕРІРµСЂРЅРё С‚РѕР№ СЃР°РјРёР№ ref Сѓ РІС–РґРїРѕРІС–РґС–)
- "lemma": РЅРѕСЂРІРµР·СЊРєР° Р»РµРјР°
- "pos": С‡Р°СЃС‚РёРЅР° РјРѕРІРё (РјРѕР¶Рµ Р±СѓС‚Рё null)
- "language_code": РјРѕРІР° РїРµСЂРµРєР»Р°РґСѓ ("uk" вЂ” СѓРєСЂР°С—РЅСЃСЊРєР°, "en" вЂ” Р°РЅРіР»С–Р№СЃСЊРєР°)
- "variants": РІР°СЂС–Р°РЅС‚Рё РїРµСЂРµРєР»Р°РґСѓ С†СЊРѕРіРѕ СЃР»РѕРІР° Р·С– СЃР»РѕРІРЅРёРєР°, Сѓ РґРѕРІС–Р»СЊРЅРѕРјСѓ РїРѕСЂСЏРґРєСѓ

Р”Р»СЏ РљРћР–РќРћР‡ РіСЂСѓРїРё: СЏРєС‰Рѕ РІР°СЂС–Р°РЅС‚Рё С” С„РѕСЂРјР°РјРё РћР”РќРћР“Рћ РґС–С”СЃР»РѕРІР°/РїРѕРЅСЏС‚С‚СЏ, С‰Рѕ РІС–РґСЂС–Р·РЅСЏСЋС‚СЊСЃСЏ
РІРёРґРѕРј (РЅР°РїСЂРёРєР»Р°Рґ: Р±Р°Р·РѕРІР° РЅРµРґРѕРєРѕРЅР°РЅР° С„РѕСЂРјР° "РїСЂР°С†СЋРІР°С‚Рё" С– РїРѕС…С–РґРЅР° РґРѕРєРѕРЅР°РЅР° С„РѕСЂРјР°
"РїРѕРїСЂР°С†СЋРІР°С‚Рё"), СЂРѕР·СЃС‚Р°РІ С—С… С‚Р°Рє, С‰РѕР± Р‘РђР—РћР’Рђ (РЅР°Р№Р±С–Р»СЊС€ РЅРµР№С‚СЂР°Р»СЊРЅР°, СЃР»РѕРІРЅРёРєРѕРІР°, Р·Р°Р·РІРёС‡Р°Р№
РЅРµРґРѕРєРѕРЅР°РЅР°) С„РѕСЂРјР° Р№С€Р»Р° РїРµСЂС€РѕСЋ.

РЇРєС‰Рѕ РІР°СЂС–Р°РЅС‚Рё РіСЂСѓРїРё вЂ” С†Рµ Р Р†Р—РќР† СЃРёРЅРѕРЅС–РјРё Р°Р±Рѕ СЂС–Р·РЅС– Р·РЅР°С‡РµРЅРЅСЏ СЃР»РѕРІР° (РЅРµ РІРёРґРѕРІР° РїР°СЂР°
РѕРґРЅРѕРіРѕ РєРѕСЂРµРЅСЏ), РќР• РїРµСЂРµСЃС‚Р°РІР»СЏР№ С—С… вЂ” РїРѕР·РЅР°С‡ is_synonym_cluster=true РґР»СЏ Р¦Р†Р„Р‡ РіСЂСѓРїРё С–
Р·Р°Р»РёС€ ordered_variants Сѓ РІРёС…С–РґРЅРѕРјСѓ РїРѕСЂСЏРґРєСѓ.

РЇРєС‰Рѕ РћР”РРќ Р· РІР°СЂС–Р°РЅС‚С–РІ РіСЂСѓРїРё СЏРІРЅРѕ РќР• РЅР°Р»РµР¶РёС‚СЊ РґРѕ РІРёРґРѕРІРѕС— РїР°СЂРё С–РЅС€РёС… (РїРѕС‚СЂР°РїРёРІ Сѓ С†РµР№
СЃРїРёСЃРѕРє РїРѕРјРёР»РєРѕРІРѕ, РЅР°РїСЂРёРєР»Р°Рґ С–РЅС€Рµ Р·РЅР°С‡РµРЅРЅСЏ СЃР»РѕРІР°), РјРѕР¶РµС€ Р№РѕРіРѕ РІРёРєР»СЋС‡РёС‚Рё Р·
ordered_variants Р¦Р†Р„Р‡ РіСЂСѓРїРё вЂ” РіРѕР»РѕРІРЅРµ, СЂРѕР·РіР»СЏРЅСЊ РІСЃС– С–РЅС€С– РІРёРїР°РґРєРё С‰Рѕ Р—РђР›РРЁРР›РРЎР¬ СЏРє
РІРёРґРѕРІСѓ РїР°СЂСѓ С– СЂРѕР·СЃС‚Р°РІ С—С… РїСЂР°РІРёР»СЊРЅРѕ.

Р’РђР–Р›РР’Рћ (РґР»СЏ РєРѕР¶РЅРѕС— РіСЂСѓРїРё РѕРєСЂРµРјРѕ): ordered_variants РјРѕР¶Рµ РјС–СЃС‚РёС‚Рё РњР•РќРЁР• СЃР»С–РІ, РЅС–Р¶ Сѓ
РІС…С–РґРЅРѕРјСѓ СЃРїРёСЃРєСѓ variants С†С–С”С— РіСЂСѓРїРё (СЏРєС‰Рѕ С‚Рё РІРёРєР»СЋС‡РёРІ СЏРІРЅРѕ РЅРµРІС–РґРїРѕРІС–РґРЅС–), Р°Р»Рµ
РќР†РљРћР›Р РЅРµ РїРѕРІРёРЅРµРЅ РјС–СЃС‚РёС‚Рё СЃР»С–РІ, СЏРєРёС… РЅРµ Р±СѓР»Рѕ Сѓ variants С†С–С”С— Р¶ РіСЂСѓРїРё вЂ” РќР• РІРёРіР°РґСѓР№ РЅРѕРІС–
СЃР»РѕРІР° С– РќР• РїС–РґСЃС‚Р°РІР»СЏР№ С‚РёРїРѕРІС–С€РёР№ РїРµСЂРµРєР»Р°Рґ Р·Р°РјС–СЃС‚СЊ РЅР°РґР°РЅРёС… РІР°СЂС–Р°РЅС‚С–РІ, С– РќР• РїРµСЂРµРЅРѕСЃРё
СЃР»РѕРІР° Р· РћР”РќР†Р„Р‡ РіСЂСѓРїРё РІ Р†РќРЁРЈ.

Р“СЂСѓРїРё (РјР°СЃРёРІ JSON):
${inputJson}

Р’С–РґРїРѕРІС–РґР°Р№ Р›РРЁР• Сѓ С„РѕСЂРјР°С‚С– JSON-РјР°СЃРёРІСѓ, РїРѕ РѕРґРЅРѕРјСѓ РѕР±'С”РєС‚Сѓ РЅР° РєРѕР¶РЅСѓ РІС…С–РґРЅСѓ РіСЂСѓРїСѓ, Р±РµР·
Р¶РѕРґРЅРѕРіРѕ С–РЅС€РѕРіРѕ С‚РµРєСЃС‚Сѓ:
[
  {"ref": <С‚РѕР№ СЃР°РјРёР№ ref>, "ordered_variants": ["...", "..."], "is_synonym_cluster": false, "reasoning": "РєРѕСЂРѕС‚РєРµ РїРѕСЏСЃРЅРµРЅРЅСЏ"}
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  // Р‘Р°С‚С‡ РёР· РЅРµСЃРєРѕР»СЊРєРёС… РіСЂСѓРїРї вЂ” С‚Р°Р№РјР°СѓС‚ СѓРІРµР»РёС‡РµРЅ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ РѕРґРёРЅРѕС‡РЅРѕРіРѕ
  // РІС‹Р·РѕРІР° (Р±С‹Р»Рѕ 20СЃ РЅР° 1 РіСЂСѓРїРїСѓ), РЅРѕ РЅРµ Р±РµР·РіСЂР°РЅРёС‡РЅРѕ: WORKER_TIMEOUT РІ
  // job-enrichment-batch-worker РґР»СЏ СЌС‚РѕР№ С†РµРїРѕС‡РєРё СѓР¶Рµ 35СЃ (СЃРј. РµС‘ РІС‹Р·РѕРІ
  // enqueueTranslationReorderEnrichment), РґРµСЂР¶РёРј Р·Р°РїР°СЃ РїРѕРґ С‚РµРј РїРѕС‚РѕР»РєРѕРј.
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
          // Р¤РРљРЎ (26.07.2026, РЅР°Р№РґРµРЅРѕ РЅР° "ta"): Р±РµР· СЏРІРЅРѕРіРѕ maxOutputTokens
          // РѕС‚РІРµС‚ РґР»СЏ РјРЅРѕРіРѕР·РЅР°С‡РЅС‹С… СЃР»РѕРІ РѕР±СЂС‹РІР°Р»СЃСЏ вЂ” РЅРµС…РІР°С‚РєР° Р»РёРјРёС‚Р° РІС‹РІРѕРґР°.
          // Р‘Р°С‚С‡ РёР· РЅРµСЃРєРѕР»СЊРєРёС… РіСЂСѓРїРї РїСЂРѕРїРѕСЂС†РёРѕРЅР°Р»СЊРЅРѕ РґР»РёРЅРЅРµРµ РѕРґРЅРѕР№ РіСЂСѓРїРїС‹ вЂ”
          // Р»РёРјРёС‚ РїРѕРґРЅСЏС‚ СЃ 4096 РґРѕ 8192.
          maxOutputTokens: 8192,
        },
      }),
      signal: controller.signal,
    });
  } catch (fetchError) {
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('Gemini API request timeout вЂ” aborted after 30000ms');
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
    if (!info) continue; // РЅРµРёР·РІРµСЃС‚РЅС‹Р№ ref вЂ” РёРіРЅРѕСЂРёСЂСѓРµРј, РЅРµ СЂРѕРЅСЏРµРј РІРµСЃСЊ Р±Р°С‚С‡

    // Р¤РРљРЎ (25.07.2026, v2 вЂ” С‚Р° Р¶Рµ Р»РѕРіРёРєР° anti-hallucination, С‡С‚Рѕ Рё РІ
    // РѕРґРёРЅРѕС‡РЅРѕР№ РІРµСЂСЃРёРё, РїСЂРёРјРµРЅРµРЅР° per-РіСЂСѓРїРїР°): Р·Р°РїСЂРµС‰РµРЅРѕ Р”РћР‘РђР’Р›РЇРўР¬ СЃР»РѕРІР°,
    // РєРѕС‚РѕСЂС‹С… РЅРµ Р±С‹Р»Рѕ РІРѕ РІС…РѕРґРµ Р­РўРћР™ РіСЂСѓРїРїС‹ (output вЉ„ input). РЎР»РѕРІР°, РєРѕС‚РѕСЂС‹Рµ
    // AI Р·Р°РєРѕРЅРЅРѕ РёСЃРєР»СЋС‡РёР», РґРѕРїРёСЃС‹РІР°СЋС‚СЃСЏ РІ РєРѕРЅРµС† РІ РёСЃС…РѕРґРЅРѕРј РїРѕСЂСЏРґРєРµ.
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

    const outputWords: string[] = entry.ordered_variants.map((v: string) => String(v));
    const outputSet = new Set(outputWords.map(normalizeReorderText));
    const inventedWords = outputWords.filter((v) => !isPresentInInput(v));

    if (inventedWords.length > 0) {
      // Р­С‚Р° РєРѕРЅРєСЂРµС‚РЅР°СЏ РіСЂСѓРїРїР° РѕС‚Р±СЂР°СЃС‹РІР°РµС‚СЃСЏ РєР°Рє failed вЂ” РЅРµ СЂРѕРЅСЏРµС‚ РІРµСЃСЊ Р±Р°С‚С‡.
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
        ? ` [РџСЂРёРјС–С‚РєР°: AI РІРёРєР»СЋС‡РёРІ Р·С– Р·С–СЃС‚Р°РІР»РµРЅРЅСЏ РІРёРґРѕРІРѕС— РїР°СЂРё: ${droppedWords.join(', ')} вЂ” Р·Р°Р»РёС€РµРЅРѕ РІ РєС–РЅС†С– СЃРїРёСЃРєСѓ Р±РµР· Р·РјС–РЅРё.]`
        : ''),
    });
  }

  return byRef;
}

// РђРЅР°Р»РѕРі extractFirstJsonObject РёР· РѕРґРёРЅРѕС‡РЅРѕР№ РІРµСЂСЃРёРё, РЅРѕ РґР»СЏ РњРђРЎРЎРР’Рђ
// РІРµСЂС…РЅРµРіРѕ СѓСЂРѕРІРЅСЏ (Gemini РёРЅРѕРіРґР° РґРѕР±Р°РІР»СЏРµС‚ С‚РµРєСЃС‚ РїРѕСЃР»Рµ JSON вЂ” С‚РѕС‚ Р¶Рµ
// РєР»Р°СЃСЃ РїСЂРѕР±Р»РµРјС‹, С‡С‚Рѕ Рё РІ РѕРґРёРЅРѕС‡РЅРѕР№ РІРµСЂСЃРёРё, СЃРј. РµС‘ РєРѕРјРјРµРЅС‚Р°СЂРёРё).
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

  return null; // РЅРµ Р·Р°РєСЂС‹Р»Р°СЃСЊ РЅРё РѕРґРЅР° СЃРєРѕР±РєР° РґРѕ РєРѕРЅС†Р° С‚РµРєСЃС‚Р° вЂ” РѕР±СЂРµР·Р°РЅРѕ
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
