// supabase/functions/expression-category-eval/index.ts
// D10_expression_category_eval_v1 (08.11.2026): test of models for expression categories. Changes no category.
// Body: { model: string, thinking?: string | null, batch_size?: number, run_id: string }
//   model gemini-*  -> Gemini generateContent (thinking = thinking budget in tokens, e.g. "0"; null = model default)
//   model gpt-*     -> OpenAI chat completions (thinking = reasoning_effort: "low" | "medium" ...)
// The same prompt and sample for every model; one call per batch; results into private.d10_expr_category_eval_v1.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  hasInternalSecretApiKey,
  hasInternalServiceAuthorization,
} from '../_shared/authoritative-morphology-v2/internal-authorization.ts';

const CATEGORIES = [
  'idiom', 'fixed_expression', 'collocation', 'particle_verb', 'prepositional_verb', 'lexical_reflexive',
  'reflexive_particle_verb', 'time_expression', 'conversation_phrase', 'discourse_marker', 'unsure',
] as const;
const CONFIDENCE = ['high', 'medium', 'low'] as const;

type SampleItem = { id: string; lemma: string; reference: string | null; gloss: string | null; translations: string | null };
type Answer = { ref: number; category: string; confidence: string };
type Usage = { tokens_in: number | null; tokens_out: number | null; tokens_thought: number | null };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export function buildPrompt(items: SampleItem[]): string {
  const lines = items.map((it, i) => {
    const parts = [`${i + 1}. "${it.lemma}"`];
    if (it.gloss) parts.push(`dictionary definition: ${it.gloss}`);
    if (it.translations) parts.push(`translations: ${it.translations}`);
    return parts.join(' | ');
  });
  return `You classify Norwegian Bokmål multiword expressions for a vocabulary app for learners.
For each numbered expression choose exactly ONE category:
- idiom: figurative meaning that cannot be derived from the words (gå i vasken, bite i det sure eplet)
- fixed_expression: a fixed multiword unit, meaning mostly literal but the wording is set (få lov til å, være i stand til, legge vekt på)
- collocation: a common free combination with literal, compositional meaning (tjene penger, drikke kaffe)
- particle_verb: verb + stressed adverbial particle forming one unit (gi opp, gripe inn, komme an)
- prepositional_verb: verb (optionally with adjective/noun) that requires a fixed preposition with an object (tro på, snakke med, være glad i)
- lexical_reflexive: verb with an obligatory reflexive "seg" (glede seg, bestemme seg for)
- reflexive_particle_verb: verb + seg + particle (ta seg sammen, slå seg ned)
- time_expression: expression of time or frequency (en gang i blant, denne uken)
- conversation_phrase: a spoken formula used as a whole utterance (god bedring, ingen årsak)
- discourse_marker: a connector or text-structuring phrase (dessuten, på den ene siden, til og med)
- unsure: if none fits well or the item is not a real expression
"noe", "noen", "seg" and [a|b] alternatives are placeholders in dictionary notation.
Confidence: high / medium / low.
Answer as JSON {"items":[{"ref":<number>,"category":"...","confidence":"..."}]} with one entry per number, nothing else.

${lines.join('\n')}`;
}

function geminiSchema() {
  return {
    type: 'OBJECT',
    properties: {
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ref: { type: 'INTEGER' },
            category: { type: 'STRING', enum: [...CATEGORIES] },
            confidence: { type: 'STRING', enum: [...CONFIDENCE] },
          },
          required: ['ref', 'category', 'confidence'],
        },
      },
    },
    required: ['items'],
  };
}

function openaiSchema() {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ref: { type: 'integer' },
            category: { type: 'string', enum: [...CATEGORIES] },
            confidence: { type: 'string', enum: [...CONFIDENCE] },
          },
          required: ['ref', 'category', 'confidence'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  };
}

async function callGemini(prompt: string, model: string, thinking: string | null): Promise<{ answers: Answer[]; usage: Usage }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const generationConfig: Record<string, unknown> = {
    temperature: 0, responseMimeType: 'application/json', responseSchema: geminiSchema(),
  };
  if (thinking !== null && thinking !== '' && !Number.isNaN(Number(thinking))) {
    generationConfig.thinkingConfig = { thinkingBudget: Number(thinking) };
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  const u = data?.usageMetadata ?? {};
  return {
    answers: (JSON.parse(text)?.items ?? []) as Answer[],
    usage: { tokens_in: u.promptTokenCount ?? null, tokens_out: u.candidatesTokenCount ?? null, tokens_thought: u.thoughtsTokenCount ?? null },
  };
}

async function callOpenAI(prompt: string, model: string, effort: string | null): Promise<{ answers: Answer[]; usage: Usage }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: openaiSchema() } },
      ...(effort ? { reasoning_effort: effort } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const data = await res.json();
  const u = data?.usage ?? {};
  return {
    answers: (JSON.parse(String(data?.choices?.[0]?.message?.content ?? '{}'))?.items ?? []) as Answer[],
    usage: {
      tokens_in: u.prompt_tokens ?? null,
      tokens_out: u.completion_tokens ?? null,
      tokens_thought: u.completion_tokens_details?.reasoning_tokens ?? null,
    },
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!hasInternalSecretApiKey(request.headers.get('apikey'), Deno.env.get('SUPABASE_SECRET_KEYS')) &&
      !hasInternalServiceAuthorization(request.headers.get('authorization'), serviceRoleKey)) {
    return json({ ok: false, error: 'INTERNAL_SERVICE_AUTH_REQUIRED' }, 403);
  }
  const body = await request.json().catch(() => ({}));
  const model = typeof body?.model === 'string' ? body.model.trim() : '';
  const thinking = body?.thinking == null ? null : String(body.thinking);
  const runId = typeof body?.run_id === 'string' && body.run_id ? body.run_id : new Date().toISOString();
  const batchSize = Math.min(Math.max(Number(body?.batch_size ?? 25), 1), 50);
  if (!/^(gemini-|gpt-)/.test(model)) return json({ ok: false, error: 'model must start with gemini- or gpt-' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey, { auth: { persistSession: false } });
  const { data: sample, error: sampleError } = await supabase.rpc('d10_expr_category_eval_sample_v1');
  if (sampleError) return json({ ok: false, error: sampleError.message }, 500);
  const items = (sample ?? []) as SampleItem[];

  const summary = { model, thinking, run_id: runId, items: items.length, batches: 0, answered: 0, errors: [] as string[],
    tokens_in: 0, tokens_out: 0, tokens_thought: 0, ms: 0 };
  for (let start = 0, batchNo = 1; start < items.length; start += batchSize, batchNo++) {
    const batch = items.slice(start, start + batchSize);
    const t0 = Date.now();
    let answers: Answer[] = [];
    let usage: Usage = { tokens_in: null, tokens_out: null, tokens_thought: null };
    let error: string | null = null;
    try {
      const result = model.startsWith('gpt-')
        ? await callOpenAI(buildPrompt(batch), model, thinking)
        : await callGemini(buildPrompt(batch), model, thinking);
      answers = result.answers;
      usage = result.usage;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      summary.errors.push(`batch ${batchNo}: ${error.slice(0, 200)}`);
    }
    const ms = Date.now() - t0;
    const byRef = new Map(answers.map((a) => [Number(a.ref), a]));
    const rows = batch.map((it, i) => {
      const a = byRef.get(i + 1);
      return {
        run_id: runId, model, thinking, batch_no: batchNo, expression_id: it.id, lemma: it.lemma, reference: it.reference,
        answer: a?.category ?? null, confidence: a?.confidence ?? null,
        // batch usage on the first row of the batch only (sums stay correct)
        tokens_in: i === 0 ? usage.tokens_in : null, tokens_out: i === 0 ? usage.tokens_out : null,
        tokens_thought: i === 0 ? usage.tokens_thought : null, batch_ms: i === 0 ? ms : null, batch_size: batch.length,
        error: a ? null : (error ?? 'no_answer_for_ref'),
      };
    });
    const { error: recordError } = await supabase.rpc('d10_expr_category_eval_record_v1', { p_rows: rows });
    if (recordError) summary.errors.push(`record ${batchNo}: ${recordError.message}`);
    summary.batches++;
    summary.answered += rows.filter((r) => r.answer).length;
    summary.tokens_in += usage.tokens_in ?? 0;
    summary.tokens_out += usage.tokens_out ?? 0;
    summary.tokens_thought += usage.tokens_thought ?? 0;
    summary.ms += ms;
  }
  return json({ ok: summary.errors.length === 0, ...summary });
});
