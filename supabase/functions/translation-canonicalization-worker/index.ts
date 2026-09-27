import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// translation-canonicalization-worker (v4)
//
// РЈР·РєР°СЏ Р·Р°РґР°С‡Р°: РќР• РїРµСЂРµРІРѕРґРёС‚СЊ, РќР• РіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ РЅРѕРІС‹Рµ СЃР»РѕРІР°, РќР• РёР·РјРµРЅСЏС‚СЊ
// СЃРјС‹СЃР» вЂ” РІС‹Р±СЂР°С‚СЊ РѕРґРёРЅ РєР°РЅРѕРЅРёС‡РµСЃРєРёР№ РІР°СЂРёР°РЅС‚ РёР· Р·Р°РєСЂС‹С‚РѕРіРѕ СЃРїРёСЃРєР°
// РєР°РЅРґРёРґР°С‚РѕРІ, СЃРѕР±СЂР°РЅРЅРѕРіРѕ lexin-enrichment-worker'РѕРј РґР»СЏ РѕРґРЅРѕРіРѕ СЃРјС‹СЃР»Р°
// (source_entry_id) СЃР»РѕРІР°.
//
// Р¤РРљРЎ v2 (РїРѕ Р·Р°РјРµС‡Р°РЅРёСЏРј 11.07.2026):
//
// 1. РќР• РїРµСЂРµР·Р°РїРёСЃС‹РІР°РµС‚ entity_translations.translation вЂ” СЌС‚Рѕ РѕСЂРёРіРёРЅР°Р»СЊРЅС‹Р№
//    С‚РµРєСЃС‚ Р°РІС‚РѕСЂРёС‚РµС‚РЅРѕРіРѕ РёСЃС‚РѕС‡РЅРёРєР° (Lexin), СѓРЅРёС‡С‚РѕР¶Р°С‚СЊ РµРіРѕ РЅРµР»СЊР·СЏ.
//    Р РµР·СѓР»СЊС‚Р°С‚ РєР°РЅРѕРЅРёР·Р°С†РёРё РїРёС€РµС‚СЃСЏ РІ РћРўР”Р•Р›Р¬РќР«Р• РєРѕР»РѕРЅРєРё:
//    canonical_translation (text) Рё canonicalization_metadata (jsonb).
//
// 2. Р’РјРµСЃС‚Рѕ notes вЂ” СЃС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅС‹Р№ canonicalization_metadata:
//    { original: [...], selected: "...", provider: "gemini",
//      reason: "...", method: "ai" | "deterministic_dedup" }.
//
// 3. Р Р°Р·Р±РѕСЂ РєР°РЅРґРёРґР°С‚РѕРІ С‡РµСЂРµР· split(/[;,|]/) вЂ” Lexin РёСЃРїРѕР»СЊР·СѓРµС‚ РІСЃРµ С‚СЂРё
//    СЂР°Р·РґРµР»РёС‚РµР»СЏ РІ СЂР°Р·РЅС‹С… РїРѕР»СЏС…, split(',') РїСЂРѕРїСѓСЃРєР°Р» Р±С‹ С‡Р°СЃС‚СЊ РІР°СЂРёР°РЅС‚РѕРІ.
//
// 4. Р”РµС‚РµСЂРјРёРЅРёСЂРѕРІР°РЅРЅР°СЏ РЅРѕСЂРјР°Р»РёР·Р°С†РёСЏ РџР•Р Р•Р” РѕР±СЂР°С‰РµРЅРёРµРј Рє AI (СЂРµР°Р»РёР·Р°С†РёСЏ
//    РёРґРµРё "translation-normalization-worker" вЂ” split + dedup + trim РєР°Рє
//    РѕС‚РґРµР»СЊРЅС‹Р№, С‡РёСЃС‚Рѕ РїСЂРѕРіСЂР°РјРјРЅС‹Р№ С€Р°Рі). Р•СЃР»Рё РїРѕСЃР»Рµ РґРµРґСѓРїР° РїРѕ
//    РЅРѕСЂРјР°Р»РёР·РѕРІР°РЅРЅРѕРјСѓ С‚РµРєСЃС‚Сѓ РѕСЃС‚Р°Р»СЃСЏ РћР”РРќ СѓРЅРёРєР°Р»СЊРЅС‹Р№ РєР°РЅРґРёРґР°С‚
//    (РЅР°РїСЂРёРјРµСЂ "РїСЂР°С†СЋРІР°С‚Рё, РїСЂР°С†СЋРІР°С‚Рё" в†’ "РїСЂР°С†СЋРІР°С‚Рё") вЂ” Gemini РІРѕРѕР±С‰Рµ РЅРµ
//    РІС‹Р·С‹РІР°РµС‚СЃСЏ, canonical_translation РїСЂРѕСЃС‚Р°РІР»СЏРµС‚СЃСЏ РЅР°РїСЂСЏРјСѓСЋ. AI
//    РїСЂРёРІР»РµРєР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РґР»СЏ Р”Р•Р™РЎРўР’РРўР•Р›Р¬РќРћ РЅРµРѕРґРЅРѕР·РЅР°С‡РЅС‹С… СЃР»СѓС‡Р°РµРІ (РєРѕРіРґР°
//    РїРѕСЃР»Рµ РґРµРґСѓРїР° РєР°РЅРґРёРґР°С‚РѕРІ в‰Ґ 2).
//
// 5. РњРѕРґРµР»Рё РїРµСЂРµРґР°С‘С‚СЃСЏ РЅРµ С‚РѕР»СЊРєРѕ english_gloss, РЅРѕ Рё norwegian_definition
//    (entity_definitions, language_code='nb', С‚РѕС‚ Р¶Рµ source_entry_id) вЂ”
//    РѕРЅ РѕРґРЅРѕР·РЅР°С‡РЅРµРµ РѕС‚Р»РёС‡Р°РµС‚ "РґС–СЏС‚Рё" РѕС‚ "РїСЂР°С†СЋРІР°С‚Рё", С‡РµРј РѕР±С‰РёР№ "work".
//
// 6. BATCH_SIZE СЃРЅРёР¶РµРЅ РґРѕ 10 вЂ” РїСЂРё 15 РєСЂСѓРїРЅС‹С… items РІ РѕРґРЅРѕРј JSON-РјР°СЃСЃРёРІРµ
//    Gemini РёРЅРѕРіРґР° РїСЂРѕРїСѓСЃРєР°Р»Р° ref РІ РѕС‚РІРµС‚Рµ.
//
// 7. РњРѕРґРµР»СЊ РѕР±СЏР·Р°РЅР° РІРµСЂРЅСѓС‚СЊ "reason" РІРјРµСЃС‚Рµ СЃ "selected" вЂ” РґР»СЏ Р±СѓРґСѓС‰РµРіРѕ
//    Р°РЅР°Р»РёР·Р° РєР°С‡РµСЃС‚РІР° РІС‹Р±РѕСЂР°.
// Р¤РРљРЎ v3 (11.07.2026):
//
// 8. РЎС‚СЂРѕРєРё СЃ canonicalization_metadata.status='needs_review' Р±РѕР»СЊС€Рµ РЅРµ
//    РѕС‚РїСЂР°РІР»СЏСЋС‚СЃСЏ РІ Gemini РїРѕРІС‚РѕСЂРЅРѕ РїСЂРё РєР°Р¶РґРѕРј РѕР±С‹С‡РЅРѕРј Р·Р°РїСѓСЃРєРµ. РџРѕРІС‚РѕСЂРЅР°СЏ
//    РїРѕРїС‹С‚РєР° РІРѕР·РјРѕР¶РЅР° С‚РѕР»СЊРєРѕ С‡РµСЂРµР· force_recanonicalize=true.
//
// 9. Р”Р»СЏ english_gloss РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ canonical_translation, РµСЃР»Рё Р°РЅРіР»РёР№СЃРєР°СЏ
//    СЃС‚СЂРѕРєР° СѓР¶Рµ Р±С‹Р»Р° РєР°РЅРѕРЅРёР·РёСЂРѕРІР°РЅР°; РёРЅР°С‡Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РёСЃС…РѕРґРЅС‹Р№ translation.
//
// 10. Р¤РёРЅР°Р»СЊРЅС‹Р№ ok С‚РµРїРµСЂСЊ СЂР°РІРµРЅ errors.length === 0, РїРѕСЌС‚РѕРјСѓ РѕСЂРєРµСЃС‚СЂР°С‚РѕСЂ РЅРµ
//     СЃС‡РёС‚Р°РµС‚ С‡Р°СЃС‚РёС‡РЅРѕ СѓРїР°РІС€РёР№ Р·Р°РїСѓСЃРє СѓСЃРїРµС€РЅС‹Рј.
// Р¤РРљРЎ v4 (11.07.2026):
//
// 11. РћР±РЅРѕРІР»С‘РЅ С‚РѕР»СЊРєРѕ Gemini prompt. РћСЃС‚Р°Р»СЊРЅР°СЏ СЂР°Р±РѕС‡Р°СЏ Р»РѕРіРёРєР° worker
//     СЃРѕС…СЂР°РЅРµРЅР° Р±РµР· РёР·РјРµРЅРµРЅРёР№.
//
// 12. Norwegian definition Р·Р°РєСЂРµРїР»С‘РЅ РєР°Рє РѕСЃРЅРѕРІРЅРѕР№ СЃРµРјР°РЅС‚РёС‡РµСЃРєРёР№ СЃРёРіРЅР°Р»,
//     English gloss РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РєР°Рє РІСЃРїРѕРјРѕРіР°С‚РµР»СЊРЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚.
//
// 13. Р”РѕР±Р°РІР»РµРЅР° РїРѕР»РёС‚РёРєР° РІС‹Р±РѕСЂР° РЅРµСЃРѕРІРµСЂС€РµРЅРЅРѕРіРѕ СѓРєСЂР°РёРЅСЃРєРѕРіРѕ РёРЅС„РёРЅРёС‚РёРІР°,
//     РєРѕРіРґР° СЃРѕРІРµСЂС€РµРЅРЅС‹Р№ Рё РЅРµСЃРѕРІРµСЂС€РµРЅРЅС‹Р№ РІРёРґС‹ РІС‹СЂР°Р¶Р°СЋС‚ РѕРґРёРЅ СЃРјС‹СЃР».
//
// 14. РџРѕР»Рµ reason РѕРіСЂР°РЅРёС‡РµРЅРѕ С„РёРєСЃРёСЂРѕРІР°РЅРЅС‹Рј РЅР°Р±РѕСЂРѕРј Р·РЅР°С‡РµРЅРёР№ РґР»СЏ Р°СѓРґРёС‚Р°.
// ============================================================================

const AI_PROVIDER = 'gemini';
const BATCH_SIZE = 10;

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

function normalizeForCompare(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Regex-Р»РёС‚РµСЂР°Р»С‹ СЃ С‚СЂРѕР№РЅС‹Рј backtick СЃРѕР±СЂР°РЅС‹ С‡РµСЂРµР· new RegExp(...), Р° РЅРµ
// С‡РµСЂРµР· /```.../ СЃРёРЅС‚Р°РєСЃРёСЃ вЂ” С‚Р°Рє РїСЂРѕС‰Рµ РґР»СЏ tooling, РїР°СЂСЃСЏС‰РµРіРѕ РёСЃС…РѕРґРЅРёРєРё
// С‚РµРєСЃС‚РѕРІС‹Рј СЃРїРѕСЃРѕР±РѕРј (backtick РІРЅСѓС‚СЂРё "/.../" СЃР±РёРІР°РµС‚ РЅР°РёРІРЅС‹Рµ РїР°СЂСЃРµСЂС‹).
const CODE_FENCE_START_RE = new RegExp('^```json\\s*', 'i');
const CODE_FENCE_START_PLAIN_RE = new RegExp('^```\\s*', 'i');
const CODE_FENCE_END_RE = new RegExp('```$', 'i');

function parseJsonFromText(text: string): any {
  const cleaned = text
    .replace(CODE_FENCE_START_RE, '')
    .replace(CODE_FENCE_START_PLAIN_RE, '')
    .replace(CODE_FENCE_END_RE, '')
    .trim();

  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  const objStart = cleaned.indexOf('{');
  const objEnd = cleaned.lastIndexOf('}');

  if (arrStart !== -1 && arrEnd !== -1 && (objStart === -1 || arrStart < objStart)) {
    return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
  }
  if (objStart === -1 || objEnd === -1) {
    throw new Error(`AI returned non-JSON: ${text.slice(0, 500)}`);
  }
  return JSON.parse(cleaned.slice(objStart, objEnd + 1));
}

function extractGeminiText(data: any): string {
  return (
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? ''
  );
}

// ----------------------------------------------------------------------------
// Р¤РРљРЎ v3 (11.07.2026 вЂ” РЅР°Р№РґРµРЅРѕ РЅР° "Р·РґР°С‚Рё Р·РґР°РІР°С‚Рё СЃРєР»Р°СЃС‚Рё", "РїРѕР·РЅР°С‡РёС‚Рё
// РїРѕРјС–С‚РёС‚Рё", "РїРѕРіР»Р°РґРёС‚Рё РїСЂРѕРІРѕРґРёС‚Рё РїСЂРѕРІРµСЃС‚Рё РІРµСЃС‚Рё" Рё С‚.Рї.): Lexin РёРЅРѕРіРґР°
// РґР°С‘С‚ РќР•РЎРљРћР›Р¬РљРћ СЃР°РјРѕСЃС‚РѕСЏС‚РµР»СЊРЅС‹С… С–РЅС„С–РЅС–С‚РёРІС–РІ С‡РµСЂРµР· РџР РћР‘Р•Р› РІРЅСѓС‚СЂРё РѕРґРЅРѕРіРѕ
// comma/semicolon-СЂР°Р·РґРµР»С‘РЅРЅРѕРіРѕ СЃРµРіРјРµРЅС‚Р°, Р±РµР· СЏРІРЅРѕРіРѕ СЂР°Р·РґРµР»РёС‚РµР»СЏ РјРµР¶РґСѓ
// РЅРёРјРё (РЅР°РїСЂ. СЃС‹СЂРѕРµ РїРѕР»Рµ "Р·РґР°С‚Рё Р·РґР°РІР°С‚Рё СЃРєР»Р°СЃС‚Рё, СЃРєР»Р°РґР°С‚Рё" РґР°С‘С‚ РїРѕСЃР»Рµ
// split(',') СЃРµРіРјРµРЅС‚ "Р·РґР°С‚Рё Р·РґР°РІР°С‚Рё СЃРєР»Р°СЃС‚Рё", РєРѕС‚РѕСЂС‹Р№ СЃР°Рј РїРѕ СЃРµР±Рµ вЂ” С‚СЂРё
// РѕС‚РґРµР»СЊРЅС‹Рµ С„РѕСЂРјРё РѕРґРЅРѕРіРѕ РґС–С”СЃР»РѕРІР°, Р° РЅРµ РѕРґРЅР° С„СЂР°Р·Р°). Р­С‚Рѕ РЅРµ Р·Р°РґР°С‡Р° AI вЂ”
// СЌС‚Рѕ РЅРµРґРѕСЂР°Р·РѕР±СЂР°РЅРЅР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР° СЃР°РјРѕРіРѕ Lexin-РїРѕР»СЏ.
//
// Р Р°Р·Р±РёРІР°РµРј С‚Р°РєРѕР№ СЃРµРіРјРµРЅС‚ РїРѕ РїСЂРѕР±РµР»Сѓ, РЅРѕ РўРћР›Р¬РљРћ РµСЃР»Рё Р’РЎР• РїРѕР»СѓС‡РёРІС€РёРµСЃСЏ
// С‚РѕРєРµРЅС‹ РѕРєР°РЅС‡РёРІР°СЋС‚СЃСЏ РЅР° "С‚Рё"/"С‚РёСЃСЊ"/"С‚РёСЃСЏ" вЂ” СЌС‚Рѕ РЅР°РґС‘Р¶РЅС‹Р№ СЃРёРіРЅР°Р» СЃРїРёСЃРєР°
// С–РЅС„С–РЅС–С‚РёРІС–РІ, Р° РЅРµ РѕРґРЅРѕР№ РјРЅРѕРіРѕСЃР»РѕРІРЅРѕР№ С„СЂР°Р·С‹. РўР°Рє "РґР°РІР°С‚Рё РїР°СЃ" (РіРґРµ
// "РїР°СЃ" вЂ” РЅРµ С–РЅС„С–РЅС–С‚РёРІ) РєРѕСЂСЂРµРєС‚РЅРѕ РѕСЃС‚Р°С‘С‚СЃСЏ РѕРґРЅРѕР№ С„СЂР°Р·РѕР№, Р° "Р·РґР°С‚Рё
// Р·РґР°РІР°С‚Рё СЃРєР»Р°СЃС‚Рё" СЂР°Р·Р±РёРІР°РµС‚СЃСЏ РЅР° С‚СЂРё РѕС‚РґРµР»СЊРЅС‹С… РєР°РЅРґРёРґР°С‚Р°.
// ----------------------------------------------------------------------------
function splitInfinitiveList(token: string): string[] {
  const parts = token.trim().split(/\s+/).filter(Boolean);
  const looksLikeInfinitive = (t: string) => /(С‚РёСЃСЊ|С‚РёСЃСЏ|С‚Рё)$/i.test(t);
  if (parts.length >= 2 && parts.every(looksLikeInfinitive)) {
    return parts;
  }
  return [token];
}

// ----------------------------------------------------------------------------
// Р¤РРљРЎ Рї.3: split РїРѕ РІСЃРµРј СЂР°Р·РґРµР»РёС‚РµР»СЏРј, РєРѕС‚РѕСЂС‹Рµ СЂРµР°Р»СЊРЅРѕ РІСЃС‚СЂРµС‡Р°СЋС‚СЃСЏ Сѓ
// Lexin (";", ",", "|"), РЅРµ С‚РѕР»СЊРєРѕ РїРѕ Р·Р°РїСЏС‚РѕР№. РџР»СЋСЃ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ РїСЂРѕС…РѕРґ
// splitInfinitiveList РЅР° РєР°Р¶РґРѕРј РїРѕР»СѓС‡РёРІС€РµРјСЃСЏ СЃРµРіРјРµРЅС‚Рµ (СЃРј. РІС‹С€Рµ).
// Р¤РРљРЎ Рї.4: РґРµРґСѓРї РїРѕ РЅРѕСЂРјР°Р»РёР·РѕРІР°РЅРЅРѕРјСѓ С‚РµРєСЃС‚Сѓ вЂ” С‡РёСЃС‚Рѕ РїСЂРѕРіСЂР°РјРјРЅС‹Р№ С€Р°Рі,
// Р±РµР· AI. Р’РѕР·РІСЂР°С‰Р°РµС‚ СѓРЅРёРєР°Р»СЊРЅС‹Рµ РєР°РЅРґРёРґР°С‚С‹ РІ РёСЃС…РѕРґРЅРѕРј РїРѕСЂСЏРґРєРµ РїРѕСЏРІР»РµРЅРёСЏ.
// ----------------------------------------------------------------------------
function splitCandidateSeparatorsOutsideParens(rawTranslation: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of rawTranslation) {
    if (char === '(') depth++;
    if (char === ')' && depth > 0) depth--;

    if ((char === ',' || char === ';' || char === '|') && depth === 0) {
      const candidate = current.trim();
      if (candidate) result.push(candidate);
      current = '';
      continue;
    }

    current += char;
  }

  const candidate = current.trim();
  if (candidate) result.push(candidate);
  return result;
}

function splitAndDedupeCandidates(rawTranslation: string): { original: string[]; deduped: string[] } {
  const commaSplit = splitCandidateSeparatorsOutsideParens(rawTranslation);

  const original: string[] = [];
  for (const segment of commaSplit) {
    original.push(...splitInfinitiveList(segment));
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const c of original) {
    const key = normalizeForCompare(c);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }
  return { original, deduped };
}

// ----------------------------------------------------------------------------
// РљР°РЅРґРёРґР°С‚С‹ РЅР° РєР°РЅРѕРЅРёР·Р°С†РёСЋ.
// ----------------------------------------------------------------------------
type CanonCandidate = {
  translationId: string;
  lexemeId: string | null;
  lexemeLemma: string;
  lexemePos: string | null;
  sourceEntryId: number | null;
  languageCode: 'uk' | 'en';
  originalCandidates: string[]; // РґРѕ РґРµРґСѓРїР° вЂ” СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ metadata.original
  candidates: string[]; // РїРѕСЃР»Рµ РґРµРґСѓРїР° вЂ” С‚Рѕ, РёР· С‡РµРіРѕ СЂРµР°Р»СЊРЅРѕ РІС‹Р±РёСЂР°РµС‚ AI
  englishGloss: string | null;
  norwegianDefinition: string | null;
};

async function findCanonCandidates(
  supabase: any,
  lexemeIds: string[],
  forceRecanonicalize: boolean,
): Promise<{ deterministic: CanonCandidate[]; needsAi: CanonCandidate[] }> {
  // Р—Р°РіСЂСѓР¶Р°РµРј Р’РЎР• Lexin-РїРµСЂРµРІРѕРґС‹ РґР»СЏ РІС‹Р±СЂР°РЅРЅС‹С… Р»РµРєСЃРµРј, С‡С‚РѕР±С‹ Р°РЅРіР»РёР№СЃРєРёР№
  // gloss Р±С‹Р» РґРѕСЃС‚СѓРїРµРЅ РґР°Р¶Рµ С‚РѕРіРґР°, РєРѕРіРґР° EN-СЃС‚СЂРѕРєР° СѓР¶Рµ РєР°РЅРѕРЅРёР·РёСЂРѕРІР°РЅР°.
  const { data: allRows, error } = await supabase
    .from('entity_translations')
    .select(
      'id, lexeme_id, source_entry_id, language_code, translation, translation_type, source, canonical_translation, canonicalization_metadata',
    )
    .in('lexeme_id', lexemeIds)
    .eq('source', 'lexin')
    .in('language_code', ['uk', 'en'])
    .in('translation_type', ['primary', 'expression_primary'])
    .eq('translation_rank', 1);

  const rows = (allRows ?? []).filter((r: any) => {
    if (forceRecanonicalize) return true;

    const reviewStatus =
      r.canonicalization_metadata?.status ??
      null;

    return (
      r.canonical_translation == null &&
      reviewStatus !== 'needs_review'
    );
  });

  if (error) throw new Error(error.message);

  const lexemeMeta = new Map<string, { lemma: string; pos: string | null }>();
  const { data: lexemes, error: lexError } = await supabase
    .from('lexemes')
    .select('id, lemma, pos')
    .in('id', lexemeIds);
  if (lexError) throw new Error(lexError.message);
  for (const l of lexemes ?? []) lexemeMeta.set(l.id, { lemma: l.lemma, pos: l.pos ?? null });

  // Р¤РРљРЎ Рї.5: norwegian_definition вЂ” РёР· entity_definitions (nb), С‚РѕС‚ Р¶Рµ
  // (lexeme_id, source_entry_id). Р‘РѕР»РµРµ С‚РѕС‡РЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚ РґР»СЏ РІС‹Р±РѕСЂР°, С‡РµРј
  // С‚РѕР»СЊРєРѕ english_gloss.
  const { data: nbDefs, error: nbError } = await supabase
    .from('entity_definitions')
    .select('lexeme_id, source_entry_id, definition')
    .in('lexeme_id', lexemeIds)
    .eq('language_code', 'nb')
    .eq('source', 'lexin');
  if (nbError) throw new Error(nbError.message);

  const entryKey = (lexemeId: string | null, entryId: number | null) =>
    `${lexemeId ?? 'null'}:${entryId ?? 'null'}`;

  const nbDefMap = new Map<string, string>();
  for (const d of nbDefs ?? []) {
    const key = entryKey(d.lexeme_id, d.source_entry_id);
    if (!nbDefMap.has(key)) nbDefMap.set(key, d.definition);
  }

  const glossMap = new Map<string, string>();
  for (const r of allRows ?? []) {
    if (r.language_code !== 'en') continue;

    const englishGloss =
      String(r.canonical_translation ?? '').trim() ||
      String(r.translation ?? '').trim();

    if (!englishGloss) continue;

    glossMap.set(
      entryKey(r.lexeme_id, r.source_entry_id),
      englishGloss,
    );
  }

  const deterministic: CanonCandidate[] = [];
  const needsAi: CanonCandidate[] = [];

  for (const r of rows ?? []) {
    const { original, deduped } = splitAndDedupeCandidates(r.translation);
    if (deduped.length === 0) continue;

    const meta = lexemeMeta.get(r.lexeme_id);
    const candidate: CanonCandidate = {
      translationId: r.id,
      lexemeId: r.lexeme_id,
      lexemeLemma: meta?.lemma ?? '',
      lexemePos: meta?.pos ?? null,
      sourceEntryId: r.source_entry_id,
      languageCode: r.language_code,
      originalCandidates: original,
      candidates: deduped,
      englishGloss:
        r.language_code === 'uk' ? glossMap.get(entryKey(r.lexeme_id, r.source_entry_id)) ?? null : null,
      norwegianDefinition: nbDefMap.get(entryKey(r.lexeme_id, r.source_entry_id)) ?? null,
    };

    // Р¤РРљРЎ Рї.4: РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРєР°Р»СЊРЅС‹Р№ РєР°РЅРґРёРґР°С‚ РїРѕСЃР»Рµ РґРµРґСѓРїР° вЂ” РЅРµ РЅСѓР¶РµРЅ
    // AI, canonical_translation РїСЂРѕСЃС‚Р°РІР»СЏРµС‚СЃСЏ РґРµС‚РµСЂРјРёРЅРёСЂРѕРІР°РЅРЅРѕ.
    if (deduped.length === 1) {
      deterministic.push(candidate);
    } else {
      needsAi.push(candidate);
    }
  }

  return { deterministic, needsAi };
}

// ----------------------------------------------------------------------------
// Batch call вЂ” SELECTION, РЅРµ GENERATION.
// ----------------------------------------------------------------------------
type BatchInputItem = {
  ref: number;
  lemma: string;
  pos: string | null;
  language_code: string;
  candidates: string[];
  english_gloss: string | null;
  norwegian_definition: string | null;
};

type BatchOutputItem = {
  ref: number;
  selected?: string | null;
  reason?: string | null;
};

async function callGeminiCanonicalizeBatch(items: BatchInputItem[]): Promise<Map<number, BatchOutputItem>> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const inputJson = JSON.stringify(items, null, 2);

  const prompt = `
You are selecting the canonical learner-dictionary translation from a CLOSED
list of authoritative candidates.

You are NOT translating.
You are NOT generating new wording.
You are NOT correcting spelling.
You are selecting EXACTLY ONE existing candidate, or null.

======================================================================
GOAL
======================================================================

Select the single candidate that would most naturally appear as the primary
headword translation in a learner's dictionary.

Do not choose merely the most literal English equivalent. Choose the candidate
that best represents the specific Norwegian dictionary sense.

======================================================================
INPUT
======================================================================

Each item contains:

- "lemma": Norwegian lemma
- "pos": part of speech
- "language_code": language of the candidate list
- "candidates": closed list of allowed words or phrases
- "english_gloss": supporting English gloss, when available
- "norwegian_definition": BokmГҐl definition of this exact dictionary sense,
  when available

All candidates come from an authoritative lexical source.

======================================================================
DECISION PRIORITY
======================================================================

Use this order of priority:

1. Match the specific Norwegian definition.
2. Match the correct grammatical and semantic function.
3. Prefer the conventional learner-dictionary headword.
4. Prefer the most common, neutral, productive candidate.
5. Use the English gloss only as supporting context.

The Norwegian definition is the PRIMARY semantic signal.

If the Norwegian definition and English gloss suggest different
interpretations, follow the Norwegian definition.

======================================================================
LANGUAGE-SPECIFIC POLICY
======================================================================

For Ukrainian verb candidates:

- When perfective and imperfective infinitives express the same lexical
  meaning, normally prefer the imperfective infinitive as the learner-facing
  dictionary form.
- Use the perfective infinitive only when the Norwegian definition clearly
  describes a completed, bounded, one-time action.
- Do not choose a semantically broader but less accurate verb merely because
  it is a more literal match for the English gloss.

Examples of aspect preference when the lexical meaning is the same:

РґРѕСЃСЏРіС‚Рё / РґРѕСЃСЏРіР°С‚Рё
в†’ prefer "РґРѕСЃСЏРіР°С‚Рё"

РґРѕР±СЂР°С‚РёСЃСЏ / РґРѕР±РёСЂР°С‚РёСЃСЏ
в†’ prefer "РґРѕР±РёСЂР°С‚РёСЃСЏ"

РґС–СЃС‚Р°С‚Рё / РґС–СЃС‚Р°РІР°С‚Рё
в†’ prefer "РґС–СЃС‚Р°РІР°С‚Рё"

Р·РЅР°Р№С‚Рё / Р·РЅР°С…РѕРґРёС‚Рё
в†’ prefer "Р·РЅР°С…РѕРґРёС‚Рё"

СЃС‚Р°С‚Рё / СЃС‚Р°РІР°С‚Рё
в†’ prefer "СЃС‚Р°РІР°С‚Рё"

Examples of semantic disambiguation:

Norwegian definition:
"fГҐ fatt i" or "rekke"

Prefer:
"РґС–СЃС‚Р°РІР°С‚Рё"

Avoid:
"РґРѕСЃСЏРіР°С‚Рё"

when both are candidates.

Norwegian definition:
"komme fram til"

Prefer:
"РґРѕР±РёСЂР°С‚РёСЃСЏ"

Avoid:
"РґРѕСЃСЏРіР°С‚Рё"

when both are candidates and the sense is arrival at a place or point.

Norwegian definition:
"virke som"

Prefer:
"Р·РґР°РІР°С‚РёСЃСЏ"

Avoid:
"РІРёРіР»СЏРґР°С‚Рё"

unless the definition explicitly concerns visible appearance.

Norwegian definition:
"bli kjent med"

Prefer:
"Р·РЅР°Р№РѕРјРёС‚РёСЃСЏ"

Avoid:
"РїС–Р·РЅР°РІР°С‚Рё"

when both are candidates.

For English candidates:

- Prefer the broad, neutral dictionary headword that matches the Norwegian
  definition.
- Avoid a narrower phrase when a standard single-word headword expresses the
  same sense more naturally.
- Do not merge multiple English candidates.

======================================================================
GENERAL SELECTION RULES
======================================================================

- Choose EXACTLY ONE candidate.
- Never merge candidates.
- Never rewrite a candidate.
- Never alter punctuation.
- Never invent a synonym.
- Never return a value outside the supplied "candidates" array.
- Do not automatically choose the shortest candidate.
- Do not automatically choose the first candidate.
- Avoid literary, archaic, overly formal, or rare candidates when a common
  neutral learner-dictionary equivalent exists.
- If no candidate clearly matches the specific Norwegian sense, return null.

======================================================================
VALIDATION
======================================================================

"selected" MUST be copied EXACTLY, character for character, from the
corresponding item's "candidates" array, or be null.

Return the same numeric "ref" value unchanged.

For "reason", use EXACTLY ONE of these values:

- "semantic_match"
- "imperfective_preferred"
- "common_headword"
- "broader_headword"
- "dictionary_convention"
- "no_clear_match"

Use "no_clear_match" whenever "selected" is null.

======================================================================
INPUT ITEMS
======================================================================

${inputJson}

======================================================================
OUTPUT
======================================================================

Return ONLY a valid JSON array, with exactly one object per input item:

[
  {
    "ref": <same numeric ref as input>,
    "selected": "<exact candidate or null>",
    "reason": "<one allowed reason value>"
  }
]
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini batch HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  const parsed = parseJsonFromText(extractGeminiText(data));
  if (!Array.isArray(parsed)) {
    throw new Error(`Gemini batch response is not a JSON array: ${JSON.stringify(parsed).slice(0, 300)}`);
  }

  const byRef = new Map<number, BatchOutputItem>();
  for (const entry of parsed) {
    if (entry && typeof entry.ref === 'number') byRef.set(entry.ref, entry as BatchOutputItem);
  }
  return byRef;
}

async function writeCanonicalResult(
  supabase: any,
  translationId: string,
  selected: string | null,
  metadata: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('entity_translations')
    .update({
      canonical_translation: selected,
      canonicalization_metadata: metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', translationId);

  return error ? { ok: false, error: error.message } : { ok: true };
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return jsonResponse({ ok: true });
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

    const body = await req.json().catch(() => ({}));
    const lexemeIds: string[] = Array.isArray(body.lexeme_ids) ? body.lexeme_ids.map(String) : [];
    const dryRun = body.dry_run !== false;
    const forceRecanonicalize = Boolean(body.force_recanonicalize ?? false);

    if (lexemeIds.length === 0) {
      return jsonResponse({ ok: false, error: 'lexeme_ids (array) is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Missing Supabase env vars' }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { deterministic, needsAi } = await findCanonCandidates(supabase, lexemeIds, forceRecanonicalize);

    if (deterministic.length === 0 && needsAi.length === 0) {
      return jsonResponse({
        ok: true,
        dry_run: dryRun,
        deterministic_count: 0,
        needs_ai_count: 0,
        processed: [],
        errors: [],
        note: 'Nothing to canonicalize for these lexemes.',
      });
    }

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dry_run: true,
        force_recanonicalize: forceRecanonicalize,
        deterministic_count: deterministic.length,
        needs_ai_count: needsAi.length,
        deterministic: deterministic.map((c) => ({
          translation_id: c.translationId,
          lemma: c.lexemeLemma,
          language_code: c.languageCode,
          original: c.originalCandidates,
          would_select: c.candidates[0],
          method: 'deterministic_dedup',
        })),
        needs_ai: needsAi.map((c) => ({
          translation_id: c.translationId,
          lemma: c.lexemeLemma,
          pos: c.lexemePos,
          source_entry_id: c.sourceEntryId,
          language_code: c.languageCode,
          original: c.originalCandidates,
          candidates: c.candidates,
          english_gloss: c.englishGloss,
          norwegian_definition: c.norwegianDefinition,
        })),
      });
    }

    const processed: Record<string, unknown>[] = [];
    const errors: Record<string, unknown>[] = [];

    // в”Ђв”Ђ Р”РµС‚РµСЂРјРёРЅРёСЂРѕРІР°РЅРЅС‹Рµ (Р±РµР· AI) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    for (const c of deterministic) {
      const metadata = {
        original: c.originalCandidates,
        selected: c.candidates[0],
        provider: null,
        reason: 'only one distinct candidate after dedup',
        method: 'deterministic_dedup',
      };
      const result = await writeCanonicalResult(supabase, c.translationId, c.candidates[0], metadata);
      if (result.ok) {
        processed.push({
          translation_id: c.translationId,
          lemma: c.lexemeLemma,
          status: 'canonicalized',
          method: 'deterministic_dedup',
          selected: c.candidates[0],
        });
      } else {
        errors.push({ translation_id: c.translationId, lemma: c.lexemeLemma, error: result.error });
      }
    }

    // в”Ђв”Ђ РўСЂРµР±СѓСЋС‚ AI в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    for (let i = 0; i < needsAi.length; i += BATCH_SIZE) {
      const chunk = needsAi.slice(i, i + BATCH_SIZE);
      const batchInput: BatchInputItem[] = chunk.map((c, idx) => ({
        ref: idx,
        lemma: c.lexemeLemma,
        pos: c.lexemePos,
        language_code: c.languageCode,
        candidates: c.candidates,
        english_gloss: c.englishGloss,
        norwegian_definition: c.norwegianDefinition,
      }));

      let byRef: Map<number, BatchOutputItem>;
      try {
        byRef = await callGeminiCanonicalizeBatch(batchInput);
      } catch (batchError) {
        for (const c of chunk) {
          errors.push({
            translation_id: c.translationId,
            lemma: c.lexemeLemma,
            error: `batch_call_failed: ${safeStringify(batchError)}`,
          });
        }
        continue;
      }

      for (let idx = 0; idx < chunk.length; idx++) {
        const c = chunk[idx];
        const ai = byRef.get(idx);

        if (!ai || ai.selected == null) {
          const reviewReason = !ai ? 'missing_in_batch_response' : ai.reason ?? 'model_returned_null';
          const metadata = {
            original: c.originalCandidates,
            selected: null,
            provider: AI_PROVIDER,
            reason: reviewReason,
            method: 'needs_review',
            status: 'needs_review',
          };
          const result = await writeCanonicalResult(supabase, c.translationId, null, metadata);
          if (!result.ok) {
            errors.push({ translation_id: c.translationId, lemma: c.lexemeLemma, error: result.error });
          }
          processed.push({
            translation_id: c.translationId,
            lemma: c.lexemeLemma,
            candidates: c.candidates,
            status: 'needs_review',
            reason: reviewReason,
          });
          continue;
        }

        // РљСЂРёС‚РёС‡РµСЃРєР°СЏ СЃРµСЂРІРµСЂРЅР°СЏ РїСЂРѕРІРµСЂРєР° вЂ” РѕС‚РІРµС‚ РјРѕРґРµР»Рё РґРѕР»Р¶РµРЅ Р”РћРЎР›РћР’РќРћ
        // (РїРѕСЃР»Рµ РЅРѕСЂРјР°Р»РёР·Р°С†РёРё СЂРµРіРёСЃС‚СЂР°/РїСЂРѕР±РµР»РѕРІ) СЃРѕРІРїР°РґР°С‚СЊ СЃ РѕРґРЅРёРј РёР·
        // РёСЃС…РѕРґРЅС‹С… candidates. Р•СЃР»Рё РЅРµС‚ вЂ” needs_review, РЅРёС‡РµРіРѕ РЅРµ
        // РїСЂРёРјРµРЅСЏРµС‚СЃСЏ.
        const normalizedSelected = normalizeForCompare(ai.selected);
        const matchedCandidate = c.candidates.find(
          (cand) => normalizeForCompare(cand) === normalizedSelected,
        );

        if (!matchedCandidate) {
          const metadata = {
            original: c.originalCandidates,
            selected: null,
            provider: AI_PROVIDER,
            reason: 'model_returned_value_outside_candidate_list',
            method: 'needs_review',
            status: 'needs_review',
            model_returned: ai.selected,
          };
          const result = await writeCanonicalResult(supabase, c.translationId, null, metadata);
          if (!result.ok) {
            errors.push({ translation_id: c.translationId, lemma: c.lexemeLemma, error: result.error });
          }
          processed.push({
            translation_id: c.translationId,
            lemma: c.lexemeLemma,
            candidates: c.candidates,
            status: 'needs_review',
            reason: 'model_returned_value_outside_candidate_list',
            model_returned: ai.selected,
          });
          continue;
        }

        const metadata = {
          original: c.originalCandidates,
          selected: matchedCandidate,
          provider: AI_PROVIDER,
          reason: ai.reason ?? null,
          method: 'ai',
        };

        const result = await writeCanonicalResult(supabase, c.translationId, matchedCandidate, metadata);
        if (!result.ok) {
          errors.push({ translation_id: c.translationId, lemma: c.lexemeLemma, error: result.error });
          continue;
        }

        processed.push({
          translation_id: c.translationId,
          lemma: c.lexemeLemma,
          source_entry_id: c.sourceEntryId,
          language_code: c.languageCode,
          candidates: c.candidates,
          status: 'canonicalized',
          method: 'ai',
          selected: matchedCandidate,
          reason: ai.reason ?? null,
        });
      }
    }

    return jsonResponse({
      ok: errors.length === 0,
      dry_run: false,
      ai_provider: AI_PROVIDER,
      force_recanonicalize: forceRecanonicalize,
      deterministic_count: deterministic.length,
      needs_ai_count: needsAi.length,
      canonicalized_count: processed.filter((p) => p.status === 'canonicalized').length,
      needs_review_count: processed.filter((p) => p.status === 'needs_review').length,
      error_count: errors.length,
      processed,
      errors,
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, stage: 'unhandled_exception', error: safeStringify(err), stack: err instanceof Error ? err.stack : null },
      500,
    );
  }
});