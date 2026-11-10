// supabase/functions/expression-category-worker/index.ts
// D10_expression_category_v1 (08.11.2026, agreed): categories of expressions the rules did not decide.
// Leases batches from private.d10_expr_category_queue_v1 (the job's expressions first), asks the configured model
// (gemini-2.5-flash, no thinking; fallback gpt-6-luna), records the answers (d10_expr_category_record_v1).
// The prompt and the model calls are the ones of the test (expression-category-eval), plus one rule for collocations.
// Body: { reason?: string, job_id?: string, background?: boolean (default true: answer at once, work in background) }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  hasInternalSecretApiKey,
  hasInternalServiceAuthorization,
} from '../_shared/authoritative-morphology-v2/internal-authorization.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const TIME_BUDGET_MS = 110_000;

const CATEGORIES = [
  'idiom', 'fixed_expression', 'collocation', 'particle_verb', 'prepositional_verb', 'lexical_reflexive',
  'reflexive_particle_verb', 'time_expression', 'conversation_phrase', 'discourse_marker', 'unsure',
] as const;
const CONFIDENCE = ['high', 'medium', 'low'] as const;

type Item = { id: string; lemma: string; reason: string; gloss: string | null; translations: string | null };
type Answer = { ref: number; category: string; confidence: string };
type Usage = { tokens_in: number | null; tokens_out: number | null; tokens_thought: number | null };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export function buildPrompt(items: Item[]): string {
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
- collocation: a common free combination with literal, compositional meaning (tjene penger, drikke kaffe); an expression that already contains its specific object noun (lytte til radio, delta på konferanse) is a collocation, not prepositional_verb
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

type Lease = {
  ok?: boolean; items?: Item[]; enabled?: boolean; daily_left?: number; model?: string; model_thinking?: string | null;
  fallback_model?: string; fallback_thinking?: string | null; batch_size?: number; batches_per_call?: number;
};

async function ask(model: string, thinking: string | null, items: Item[]) {
  return model.startsWith('gpt-') ? await callOpenAI(buildPrompt(items), model, thinking)
    : await callGemini(buildPrompt(items), model, thinking);
}

async function run(jobId: string | null): Promise<Record<string, unknown>> {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } });
  const started = Date.now();
  const summary = { batches: 0, items: 0, fallback_used: 0, errors: [] as string[], outcomes: {} as Record<string, number> };
  let maxBatches = 1;
  for (let b = 0; b < maxBatches; b++) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const { data, error } = await supabase.rpc('d10_expr_category_lease_v1', { p_limit: 25, p_job_id: jobId });
    if (error) { summary.errors.push(`lease: ${error.message}`); break; }
    const lease = (data ?? {}) as Lease;
    const items = Array.isArray(lease.items) ? lease.items : [];
    maxBatches = Math.max(1, Number(lease.batches_per_call ?? 8));
    if (!items.length) break;
    let model = lease.model ?? 'gemini-2.5-flash';
    let answers: Answer[] = [];
    try {
      answers = (await ask(model, lease.model_thinking ?? null, items)).answers;
    } catch (primaryError) {
      summary.errors.push(`${model}: ${(primaryError instanceof Error ? primaryError.message : String(primaryError)).slice(0, 200)}`);
      model = lease.fallback_model ?? 'gpt-6-luna';
      try {
        answers = (await ask(model, lease.fallback_thinking ?? null, items)).answers;
        summary.fallback_used++;
      } catch (fallbackError) {
        summary.errors.push(`${model}: ${(fallbackError instanceof Error ? fallbackError.message : String(fallbackError)).slice(0, 200)}`);
      }
    }
    const byRef = new Map(answers.map((a) => [Number(a.ref), a]));
    const results = items.map((it, i) => {
      const a = byRef.get(i + 1);
      return a ? { id: it.id, category: a.category, confidence: a.confidence } : { id: it.id, error: 'no_answer' };
    });
    const { data: rec, error: recError } = await supabase.rpc('d10_expr_category_record_v1', { p_results: results, p_model: model });
    if (recError) { summary.errors.push(`record: ${recError.message}`); break; }
    for (const [k, v] of Object.entries((rec?.outcomes ?? {}) as Record<string, number>)) {
      summary.outcomes[k] = (summary.outcomes[k] ?? 0) + Number(v);
    }
    summary.batches++;
    summary.items += items.length;
  }
  console.log('[expression-category-worker]', JSON.stringify({ job_id: jobId, ...summary, ms: Date.now() - started }));
  return { ...summary, ms: Date.now() - started };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!hasInternalSecretApiKey(request.headers.get('apikey'), Deno.env.get('SUPABASE_SECRET_KEYS')) &&
      !hasInternalServiceAuthorization(request.headers.get('authorization'), serviceRoleKey)) {
    return json({ ok: false, error: 'INTERNAL_SERVICE_AUTH_REQUIRED' }, 403);
  }
  const body = await request.json().catch(() => ({}));
  const jobId = typeof body?.job_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.job_id) ? body.job_id : null;
  if (body?.background === false || typeof EdgeRuntime === 'undefined') {
    return json({ ok: true, ...(await run(jobId)) });
  }
  EdgeRuntime.waitUntil(run(jobId).catch((e) => console.error('[expression-category-worker] failed', e)));
  return json({ ok: true, started: true, background: true });
});
