// supabase/functions/synonym-verifier/index.ts
// D10 02.11.2026 v10 (agreed, D10_synonym_stable_v1): stable decisions.
//   - temperature 0; the model answers the relation only, the category is set by code (verifier-core.ts);
//   - a relation already answered by v10 for the same content (lease 'prior') is reused without the AI,
//     so a rerun gives the same result;
//   - translation fit is evaluated once per card + sense (fit-core.ts, private.synonym_sense_fit_v1);
//     the database requests it when a verified decision is recorded; this function evaluates the waiting fits.
//   - the old sense-label path (sense-labels.ts) is removed.
// D10 30.10.2026 (agreed): the database wakes this function with the vault key 'service_role_key',
// which is a new-format secret key (sb_secret_…), not the legacy JWT in SUPABASE_SERVICE_ROLE_KEY
// -> 403. Such a key is accepted when it really is a secret key of this project: a call that only the
// service role may make (d10_synonym_verifier_pending_v1) must succeed with it.
// D10 29.10.2026 v3 (agreed): the model comes from synonym_verifier_config_v1.model;
// the code checks the model's steps (applyGuards); every answer is logged
// (synonym_verifier_log_v1).
// D10 29.10.2026 (agreed, variant A): before the pairs, the expression
// resolver runs (expression-resolver.ts; Ordbøkene, no AI).
// D10 28.10.2026 (agreed, stage B, DRY-RUN): decides the synonym pairs that
// stage A prepared (synonym_pair_v1, status 'queued').
//   1. rule without AI: mutual reference (d10_synonym_rule_verify_v1);
//   2. the rest: Gemini (GEMINI_MODEL, default gemini-2.5-flash-lite),
//      pairs_per_call pairs per call, at most daily_ai_pair_limit pairs per
//      24 h (synonym_verifier_config_v1; set 10 / 200).
// Decisions go to synonym_pair_v1 only; published stays false (stage C).
// Woken by pipeline-supervisor after a finished job (answers at once, works
// in the background); {"wait": true} runs in the foreground (manual check).
// Only the service role may call it (the AI costs money).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// D10 29.10.2026 v3 (agreed): model from synonym_verifier_config_v1, guards, decision log
import { PROMPT_VERSION, applyGuards, buildPrompt, geminiText, parseDecisions, responseSchema, targetDefinitions,
  verifierVersion, type LeasedPair, type PairDecision } from './verifier-core.ts';
// D10 02.11.2026 v10 (agreed): translation fit per card + sense
import { FIT_PROMPT_VERSION, buildFitPrompt, fitSchema, parseFitAnswer, type FitRow } from './fit-core.ts';
// D10 02.11.2026 (agreed, D10_synonym_eval_v1): test mode for v11 + sense_fit_v2 (no writes to pairs / fits)
import { FIT_PROMPT_VERSION_V2, buildFitPromptV2 } from './fit-core.ts';
import { PROMPT_VERSION_V11, applyGuardsV11, buildPromptV11, caseDefinitions, parseDecisionsV11, responseSchemaV11,
  type EvalCase } from './verifier-v11.ts';
// D10_synonym_r13_v1 (05.11.2026): prompt v11c (register_kind) for rules_v13
import { PROMPT_VERSION_V11C, buildPromptV11c, responseSchemaV11c } from './verifier-v11.ts';
// D10_synonym_nuance_eval_v1 (05.11.2026): kind of a contextual synonym (style / meaning), first only in the test
import { NUANCE_PROMPT_VERSION, buildNuancePrompt, nuanceKind, nuanceSchema, parseNuanceAnswer, type NuanceItem } from './nuance-core.ts';
// D10 29.10.2026 (agreed, variant A): expression resolver (Ordbøkene, no AI)
import { bmArticleIds, resolveOne, type ResolutionRow, type ResolverDeps } from './expression-resolver.ts';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const RUN_BUDGET_MS = 110_000;
const MAX_CALLS_PER_RUN = 10;
const FIT_ROWS_PER_CALL = 20;
const FIT_CALLS_FIRST = 4;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function callGemini(prompt: string, model: string, schema: unknown = responseSchema(), thinking: string | null = null) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // D10_synonym_eval_v4: thinking level only when given (eval mode); production calls send nothing, as before
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema,
        ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}) },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return { model, text: geminiText(data), usage: data?.usageMetadata ?? null };
}

// D10_synonym_eval_v5 (03.11.2026): eval only - an OpenAI model (gpt-...) answers the same prompt and schema.
// The Gemini schema is converted to JSON Schema (strict); the array is wrapped in an object, as OpenAI requires.
// Usage is mapped to the Gemini names, so the eval log stays the same (completion tokens include reasoning).
function toJsonSchema(g: any): any {
  if (!g || typeof g !== 'object') return g;
  const t = String(g.type ?? '').toLowerCase();
  const out: any = {};
  if (t === 'object') {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(g.properties ?? {})) props[k] = toJsonSchema(v);
    out.type = 'object'; out.properties = props; out.required = Object.keys(props); out.additionalProperties = false;
  } else if (t === 'array') {
    out.type = 'array'; out.items = toJsonSchema(g.items);
  } else {
    out.type = g.nullable ? [t, 'null'] : t;
    if (Array.isArray(g.enum)) out.enum = g.nullable ? [...g.enum, null] : [...g.enum];
  }
  return out;
}
async function callOpenAI(prompt: string, model: string, schema: unknown, effort: string | null) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const wrapped = { type: 'object', properties: { items: toJsonSchema(schema) }, required: ['items'], additionalProperties: false };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: wrapped } },
      ...(effort ? { reasoning_effort: effort } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const raw = String(data?.choices?.[0]?.message?.content ?? '');
  let text = raw;
  try { text = JSON.stringify(JSON.parse(raw)?.items ?? null); } catch { /* left as is: the parser rejects it */ }
  const u = data?.usage ?? null;
  return { model, text, usage: u ? { promptTokenCount: u.prompt_tokens ?? null, candidatesTokenCount: u.completion_tokens ?? 0, thoughtsTokenCount: 0 } : null };
}
// eval only: the provider follows the model name
function callEvalModel(prompt: string, model: string, schema: unknown, thinking: string | null) {
  return model.startsWith('gpt-') ? callOpenAI(prompt, model, schema, thinking) : callGemini(prompt, model, schema, thinking);
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

const RESOLVER_BUDGET_MS = 50_000;
const RESOLVER_ROWS_PER_LEASE = 2;

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

const resolverDeps: ResolverDeps = {
  async searchArticleIds(phrase) {
    const r = await fetchJsonWithTimeout(`https://ord.uib.no/api/articles?w=${encodeURIComponent(phrase)}&dict=bm&scope=e`, {}, 15_000);
    if (!r.ok) throw new Error(`Ordbøkene search HTTP ${r.status}`);
    return bmArticleIds(r.data);
  },
  async fetchArticle(articleId) {
    const r = await fetchJsonWithTimeout(`https://ord.uib.no/bm/article/${articleId}.json`, {}, 15_000);
    if (!r.ok) throw new Error(`Ordbøkene article HTTP ${r.status}`);
    return r.data;
  },
  async state(norm, ownArticleId, parentArticleIds) {
    const data = await rpc('d10_expr_resolver_state_v1', { p_norm: norm, p_own_article_id: ownArticleId,
      p_parent_article_ids: parentArticleIds });
    return { expression_id: data?.expression_id ?? null, parent: data?.parent ?? null };
  },
  async runHeadWordPipeline(parent) {
    // the same call the ordbokene enrichment chain makes for a word card
    const r = await fetchJsonWithTimeout(`${SUPABASE_URL}/functions/v1/ordbokene-lexeme-pipeline-worker`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lemma: parent.lemma, parent_lexeme_id: parent.lexeme_id, entity_mode: 'lexeme',
        pos: parent.pos, expression_id: null, article_id: parent.article_id, parent_article_id: null,
        dictionary_code: 'bm', dry_run: false, force_refresh: false }),
    }, 60_000);
    return { ok: r.ok && r.data?.ok !== false, detail: r.ok ? null : r.data };
  },
};

async function runResolver(): Promise<Record<string, unknown>> {
  const started = Date.now();
  let leased = 0;
  const counts: Record<string, number> = {};
  while (Date.now() - started < RESOLVER_BUDGET_MS) {
    const lease = await rpc('d10_expr_resolver_lease_v1', { p_limit: RESOLVER_ROWS_PER_LEASE });
    const rows = (lease?.rows ?? []) as ResolutionRow[];
    if (!rows.length) break;
    leased += rows.length;
    for (const row of rows) {
      // a row left over when the time is up stays leased; its lease ends in 5 min
      if (Date.now() - started >= RESOLVER_BUDGET_MS) break;
      let result;
      try {
        result = await resolveOne(row, resolverDeps);
      } catch (error) {
        result = { outcome: 'retry' as const, data: { error: error instanceof Error ? error.message : String(error) } };
      }
      await rpc('d10_expr_resolver_record_v1', { p_norm: row.norm_text, p_lease_token: row.lease_token,
        p_outcome: result.outcome, p_data: result.data });
      counts[result.outcome] = (counts[result.outcome] ?? 0) + 1;
    }
  }
  const headWordJob = await rpc('d10_expr_resolver_parent_jobs_v1', {});
  return { leased, outcomes: counts, head_word_job: headWordJob };
}

// v10: a relation answer stored by v10 for the same relation content -> the same decision input
function priorDecision(prior: any): PairDecision | null {
  if (!prior || prior.contract !== 'v10' || typeof prior.ai_decision !== 'string') return null;
  if (typeof prior.substitution_forward !== 'boolean' || typeof prior.substitution_reverse !== 'boolean'
    || typeof prior.same_construction !== 'boolean') return null;
  return {
    decision: prior.ai_decision, confidence: Number(prior.confidence ?? 0), reason: String(prior.reason ?? ''),
    example_nb: typeof prior.example_nb === 'string' ? prior.example_nb : null,
    matched_definition: Number.isInteger(Number(prior.matched_definition)) ? Number(prior.matched_definition) : -1,
    pattern: prior.pattern, substitution_forward: prior.substitution_forward, substitution_reverse: prior.substitution_reverse,
    same_construction: prior.same_construction,
    additional_restriction: typeof prior.additional_restriction === 'boolean' ? prior.additional_restriction : true,
  } as PairDecision;
}

// v10: evaluate waiting translation fits (choice by index from the pipeline list only)
async function runFits(reason: string, jobId: string | null, started: number, callsUsed: number, maxCalls: number) {
  const out = { ok: true, ai_calls: 0, done: 0, back: 0, links_republished: 0, stopped: null as string | null };
  let calls = callsUsed;
  while (calls < maxCalls && Date.now() - started < RUN_BUDGET_MS) {
    // the same switch and model as the pairs (synonym_verifier_config_v1, lease answer)
    const lease = await rpc('d10_synonym_fit_lease_v1', { p_keys: null, p_limit: FIT_ROWS_PER_CALL });
    const rows = (lease?.rows ?? []) as FitRow[];
    if (!rows.length || !lease?.lease_token) { out.stopped = lease?.reason ?? 'nothing_queued'; break; }
    const model = String(lease?.model || Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite');
    // D10_synonym_v12_v1: contract v12 = translation check sense_fit_v2b with the configured model and thinking level
    const v12 = lease?.contract === 'v12';
    const fitVersion = v12 ? FIT_PROMPT_VERSION_V2 : FIT_PROMPT_VERSION;
    const callStarted = Date.now();
    const log: Record<string, unknown> = { reason: `fit:${reason}`.slice(0, 40), job_id: jobId, pairs: rows.length,
      ok: false, model, prompt_version: fitVersion };
    let answers: ReturnType<typeof parseFitAnswer> = [];
    try {
      const answer = v12
        ? await callEvalModel(buildFitPromptV2(rows), model, fitSchema(), lease?.thinking ?? null)
        : await callGemini(buildFitPrompt(rows), model, fitSchema());
      log.model = answer.model;
      if (v12) evalTokens(log, answer.usage);
      else { log.prompt_tokens = answer.usage?.promptTokenCount ?? null; log.output_tokens = answer.usage?.candidatesTokenCount ?? null; }
      answers = parseFitAnswer(answer.text, rows);
      log.ok = true;
    } catch (error) {
      log.error = error instanceof Error ? error.message : String(error);
    }
    calls++; out.ai_calls++;
    // rows without a valid answer go back to the queue (or fail after 3 attempts)
    const saved = await rpc('d10_synonym_fit_record_v1', { p_lease_token: lease.lease_token, p_rows: answers,
      p_model: String(log.model), p_prompt_version: fitVersion });
    out.done += Number(saved?.done ?? 0); out.back += Number(saved?.back ?? 0);
    out.links_republished += Number(saved?.links_republished ?? 0);
    log.decided = Number(saved?.done ?? 0);
    log.duration_ms = Date.now() - callStarted;
    await rpc('d10_synonym_log_ai_call_v2', { p_call: log, p_rows: [] })
      .catch((e) => console.warn('[synonym-verifier] fit log failed', e));
    if (!log.ok) { out.ok = false; out.stopped = 'ai_error'; break; }
  }
  return out;
}


// D10_synonym_v12_v1 (04.11.2026): production check of leased pairs with contract v12. The same input as the eval and
// shadow modes (target senses grouped by article sense), class by the agreed feature rules (ruleClassV12). The full
// answer is kept in the evidence (v11_answer): a pair with the same relation content later reuses it without AI
// (same input -> same result). Clean and contextual decisions request the translation fit (database side).
function priorDecisionV12(prior: any): any | null {
  if (!prior || prior.contract !== 'v12' || !prior.v11_answer || typeof prior.v11_answer !== 'object') return null;
  const d = prior.v11_answer;
  if (typeof d.substitution_forward !== 'boolean' || typeof d.substitution_reverse !== 'boolean') return null;
  return d;
}
async function runPairsV12(pairs: LeasedPair[], model: string, thinking: string | null, version: string, reason: string, jobId: string | null,
  rules: string = 'r12') {
  // D10_synonym_r13_v1: rules 'r13' = prompt v11c + rules_v13 + second answer (vote) for a clean result
  const r13 = rules === 'r13';
  const promptVersion = r13 ? PROMPT_VERSION_V11C : PROMPT_VERSION_V11;
  const out = { ok: true, ai_calls: 0, decided: 0, released: 0, stale: 0, reused: 0 };
  const callStarted = Date.now();
  const log: Record<string, unknown> = { reason, job_id: jobId, pairs: pairs.length, ok: true, model,
    prompt_version: promptVersion };
  const logRows: Record<string, unknown>[] = [];
  const cases = pairs.map((p: any, i) => ({ case_id: String(i), snapshot: p.snapshot, target_groups: p.target_groups ?? [] }));
  const decisions = new Map<number, any>();
  const fromPrior = new Set<number>();
  pairs.forEach((p: any, i) => {
    // a prior answer is reused only under the same rules (the version differs too; this is a second check)
    if ((p.prior?.rules === RULES_V13) !== r13) return;
    const d = priorDecisionV12(p.prior); if (d) { decisions.set(i, d); fromPrior.add(i); }
  });
  const ask = cases.map((c, i) => ({ c, i })).filter((x) => !fromPrior.has(x.i));
  log.reused = fromPrior.size;
  out.reused = fromPrior.size;
  if (ask.length) {
    log.ok = false;
    try {
      const prompt = r13 ? buildPromptV11c(ask.map((x) => x.c) as EvalCase[]) : buildPromptV11(ask.map((x) => x.c) as EvalCase[]);
      const answer = await callEvalModel(prompt, model, r13 ? responseSchemaV11c() : responseSchemaV11(), thinking);
      log.model = answer.model;
      evalTokens(log, answer.usage);
      const parsed = parseDecisionsV11(answer.text, ask.length);
      ask.forEach((x, n) => { const d = parsed.get(n); if (d) decisions.set(x.i, d); });
      log.ok = true;
    } catch (error) {
      log.error = error instanceof Error ? error.message : String(error);
    }
    out.ai_calls++;
  }
  const guardsFor = (i: number, d: any) => {
    const c = cases[i];
    const selectable = new Set<number>();
    for (const g of (c.target_groups ?? [])) for (const x of (g.definitions ?? [])) if (x.selectable) selectable.add(Number(x.n));
    return applyGuardsV11(d, caseDefinitions(c as EvalCase), selectable.size ? selectable : undefined);
  };
  // D10_synonym_r13_v1: a pair that rules_v13 calls clean is asked a second time (only these pairs, in another
  // order); clean only if both answers are clean. Both answers are kept, so a reuse gives the same result.
  const votes = new Map<number, any>();
  if (r13) {
    pairs.forEach((p: any, i) => { if (fromPrior.has(i)) { const v = priorVoteV13(p.prior); if (v) votes.set(i, v); } });
    const needVote = [...decisions.keys()].filter((i) => !votes.has(i) && ruleClassV13(decisions.get(i), guardsFor(i, decisions.get(i))) === 'verified_synonym')
      .sort((a, b) => b - a);
    if (needVote.length) {
      const voteStarted = Date.now();
      const vlog: Record<string, unknown> = { reason: `${reason}:vote`.slice(0, 40), job_id: jobId, pairs: needVote.length, ok: false, model,
        prompt_version: promptVersion };
      try {
        const answer = await callEvalModel(buildPromptV11c(needVote.map((i) => cases[i]) as EvalCase[]), model, responseSchemaV11c(), thinking);
        vlog.model = answer.model;
        evalTokens(vlog, answer.usage);
        const parsed = parseDecisionsV11(answer.text, needVote.length);
        needVote.forEach((i, n) => { const v = parsed.get(n); if (v) votes.set(i, v); });
        vlog.ok = true; vlog.decided = parsed.size;
      } catch (error) {
        vlog.error = error instanceof Error ? error.message : String(error);
      }
      out.ai_calls++;
      vlog.duration_ms = Date.now() - voteStarted;
      await rpc('d10_synonym_log_ai_call_v2', { p_call: vlog, p_rows: [] })
        .catch((e) => console.warn('[synonym-verifier] vote log failed', e));
      if (!vlog.ok) { log.ok = false; log.error = log.error ?? `vote: ${vlog.error}`; }
    }
  }
  for (let i = 0; i < pairs.length; i++) {
    const pair: any = pairs[i];
    const d = decisions.get(i);
    if (!d) {
      await rpc('d10_synonym_release_pair_v1', { p_pair_id: pair.id, p_lease_token: pair.lease_token,
        p_error: String(log.error ?? 'no answer for this pair') });
      out.released++;
      logRows.push({ pair_id: pair.id, content_key: pair.content_key ?? null, snapshot: pair.snapshot,
        error: String(log.error ?? 'no answer for this pair') });
      continue;
    }
    const g = guardsFor(i, d);
    const firstClass = r13 ? ruleClassV13(d, g) : ruleClassV12(d, g);
    let final = firstClass;
    let vote: any = null; let voteClass: string | null = null;
    if (r13 && firstClass === 'verified_synonym') {
      vote = votes.get(i) ?? null;
      if (!vote) {
        // no second answer: the pair goes back to the queue (a clean result needs both answers)
        await rpc('d10_synonym_release_pair_v1', { p_pair_id: pair.id, p_lease_token: pair.lease_token, p_error: 'no second answer (vote)' });
        out.released++;
        logRows.push({ pair_id: pair.id, content_key: pair.content_key ?? null, snapshot: pair.snapshot, error: 'no second answer (vote)' });
        continue;
      }
      voteClass = ruleClassV13(vote, guardsFor(i, vote));
      final = voteClassV13(firstClass, voteClass);
    }
    const guard = r13 && voteClass !== null && final === 'needs_manual_review' ? 'votes_disagree' : g.guard;
    const restriction = r13
      ? d.additional_restriction === true || (String(d.added_component ?? 'none') !== 'none' && !lightRegisterV13(d))
      : d.additional_restriction === true || String(d.added_component ?? 'none') !== 'none';
    const priorId = fromPrior.has(i) ? String(pair.prior?.prior_pair_id ?? '') || null : null;
    const saved = await rpc('d10_synonym_record_decision_v1', {
      p_pair_id: pair.id, p_lease_token: pair.lease_token, p_snapshot_hash: pair.snapshot_hash,
      p_decision: final, p_confidence: Number(d.confidence ?? 0),
      p_evidence: { contract: 'v12', rules: r13 ? RULES_V13 : SHADOW_RULES_VERSION, reason: d.reason, example_nb: g.example_nb ?? d.example_nb ?? null,
        model, thinking, prompt_version: promptVersion, matched_definition: g.matched_definition, matched_text: g.matched_text,
        pattern: d.pattern, ai_decision: d.decision, model_class: g.final, rule_class: final, guard,
        ...(r13 ? { register_kind: d.register_kind ?? null, first_class: firstClass, vote_class: voteClass, v11_vote: vote } : {}),
        substitution_forward: d.substitution_forward === true, substitution_reverse: d.substitution_reverse === true,
        same_construction: d.same_construction === true, additional_restriction: restriction,
        added_component: d.added_component ?? null, meaning_difference: d.meaning_difference ?? null,
        v11_answer: d, reused_from_pair_id: priorId },
      p_verifier_version: version,
    });
    if (saved?.applied) out.decided++; else out.stale++;
    logRows.push({ pair_id: pair.id, content_key: pair.content_key ?? null, snapshot: pair.snapshot,
      ai_decision: d.decision, final_decision: final, guard, matched_definition: g.matched_definition,
      matched_text: g.matched_text, pattern: d.pattern, confidence: d.confidence,
      reason: priorId ? `reused ${priorId}: ${d.reason}` : d.reason, example_nb: g.example_nb ?? null,
      applied: Boolean(saved?.applied), verifier_version: version,
      substitution_forward: d.substitution_forward, substitution_reverse: d.substitution_reverse,
      same_construction: d.same_construction });
  }
  log.decided = out.decided;
  log.duration_ms = Date.now() - callStarted;
  await rpc('d10_synonym_log_ai_call_v2', { p_call: log, p_rows: logRows })
    .catch((e) => console.warn('[synonym-verifier] log failed', e));
  if (!log.ok) out.ok = false;
  return out;
}

async function run(reason: string, jobId: string | null) {
  const started = Date.now();
  const result: Record<string, unknown> = { ok: true, reason, ai_calls: 0, decided: 0, released: 0, stale: 0 };
  try {
    result.resolver = await runResolver();
  } catch (error) {
    result.resolver = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  result.rule = await rpc('d10_synonym_rule_verify_v1', { p_limit: 500 });
  // v10: waiting translation fits first (they decide what is published), at most FIT_CALLS_FIRST calls
  try {
    result.fit_first = await runFits(reason, jobId, started, 0, FIT_CALLS_FIRST);
    result.ai_calls = Number((result.fit_first as any).ai_calls ?? 0);
  } catch (error) {
    result.fit_first = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  for (let call = Number(result.ai_calls); call < MAX_CALLS_PER_RUN && Date.now() - started < RUN_BUDGET_MS; call++) {
    const lease = await rpc('d10_synonym_lease_pairs_v1', { p_limit: null });
    const pairs = (lease?.pairs ?? []) as LeasedPair[];
    if (!pairs.length) { result.stopped = lease?.reason ?? 'nothing_queued'; break; }

    const callStarted = Date.now();
    // the model is set in synonym_verifier_config_v1.model (lease answer)
    const model = String(lease?.model || Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite');
    const version = String(lease?.verifier_version || verifierVersion(model));
    if (lease?.contract === 'v12') {
      // D10_synonym_v12_v1: relation check v11b + rules_v12 (separate function, the v10 path below is unchanged)
      const r12 = await runPairsV12(pairs, model, lease?.thinking ?? null, version, reason, jobId,
        lease?.rules === 'r13' ? 'r13' : 'r12');
      result.ai_calls = Number(result.ai_calls) + r12.ai_calls;
      result.decided = Number(result.decided) + r12.decided;
      result.released = Number(result.released) + r12.released;
      result.stale = Number(result.stale) + r12.stale;
      result.reused = Number(result.reused ?? 0) + r12.reused;
      if (!r12.ok) { result.stopped = 'ai_error'; break; }
      continue;
    }
    const log: Record<string, unknown> = { reason, job_id: jobId, pairs: pairs.length, ok: true, model,
      prompt_version: PROMPT_VERSION };
    const logRows: Record<string, unknown>[] = [];
    // v10: the relation answer already given for the same content is reused (no AI, same result)
    const decisions = new Map<number, PairDecision>();
    const fromPrior = new Set<number>();
    pairs.forEach((p, i) => { const d = priorDecision((p as any).prior); if (d) { decisions.set(i, d); fromPrior.add(i); } });
    const ask = pairs.map((p, i) => ({ p, i })).filter((x) => !fromPrior.has(x.i));
    log.reused = fromPrior.size;
    if (ask.length) {
      log.ok = false;
      try {
        const answer = await callGemini(buildPrompt(ask.map((x) => x.p)), model);
        log.model = answer.model;
        log.prompt_tokens = answer.usage?.promptTokenCount ?? null;
        log.output_tokens = answer.usage?.candidatesTokenCount ?? null;
        const parsed = parseDecisions(answer.text, ask.length);
        ask.forEach((x, n) => { const d = parsed.get(n); if (d) decisions.set(x.i, d); });
        log.ok = true;
      } catch (error) {
        log.error = error instanceof Error ? error.message : String(error);
      }
      result.ai_calls = Number(result.ai_calls) + 1;
    }

    let decided = 0;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const d = decisions.get(i);
      if (!d) {
        await rpc('d10_synonym_release_pair_v1', { p_pair_id: pair.id, p_lease_token: pair.lease_token,
          p_error: String(log.error ?? 'no answer for this pair') });
        result.released = Number(result.released) + 1;
        logRows.push({ pair_id: pair.id, content_key: pair.content_key ?? null, snapshot: pair.snapshot,
          error: String(log.error ?? 'no answer for this pair') });
        continue;
      }
      const g = applyGuards(d, targetDefinitions(pair));
      const priorId = fromPrior.has(i) ? String((pair as any).prior?.prior_pair_id ?? '') || null : null;
      // fit keys for a verified decision are added by the database (same sense texts as everywhere)
      const saved = await rpc('d10_synonym_record_decision_v1', {
        p_pair_id: pair.id, p_lease_token: pair.lease_token, p_snapshot_hash: pair.snapshot_hash,
        p_decision: g.final, p_confidence: g.confidence,
        p_evidence: { contract: 'v10', reason: g.reason, example_nb: g.example_nb, model, prompt_version: PROMPT_VERSION,
          matched_definition: g.matched_definition, matched_text: g.matched_text, pattern: g.pattern,
          ai_decision: g.decision, guard: g.guard, direction: g.direction,
          substitution_forward: g.substitution_forward, substitution_reverse: g.substitution_reverse,
          same_construction: g.same_construction, additional_restriction: g.additional_restriction,
          reused_from_pair_id: priorId },
        p_verifier_version: version,
      });
      if (saved?.applied) decided++; else result.stale = Number(result.stale) + 1;
      logRows.push({ pair_id: pair.id, content_key: pair.content_key ?? null, snapshot: pair.snapshot,
        ai_decision: g.decision, final_decision: g.final, guard: g.guard, matched_definition: g.matched_definition,
        matched_text: g.matched_text, pattern: g.pattern, confidence: g.confidence,
        reason: priorId ? `reused ${priorId}: ${g.reason}` : g.reason,
        example_nb: g.example_nb, applied: Boolean(saved?.applied), verifier_version: version,
        substitution_forward: g.substitution_forward, substitution_reverse: g.substitution_reverse,
        same_construction: g.same_construction });
    }
    result.decided = Number(result.decided) + decided;
    result.reused = Number(result.reused ?? 0) + fromPrior.size;
    log.decided = decided;
    log.duration_ms = Date.now() - callStarted;
    // the call (budget, tokens) and every answer go to the decision log
    await rpc('d10_synonym_log_ai_call_v2', { p_call: log, p_rows: logRows })
      .catch((e) => console.warn('[synonym-verifier] log failed', e));
    if (!log.ok) { result.stopped = 'ai_error'; break; }
  }

  // v10: translation fits waiting for evaluation (requested when verified decisions were recorded)
  try {
    result.fit = await runFits(reason, jobId, started, Number(result.ai_calls), MAX_CALLS_PER_RUN);
  } catch (error) {
    result.fit = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  // D10_synonym_nuance_v1: label (style / meaning) of published contextual pairs without one; one call per run at most
  try {
    result.nuance = Date.now() - started > NUANCE_LATEST_START_MS ? { ok: true, ai_calls: 0, stopped: 'no_time' }
      : await runNuance(reason, jobId);
    result.ai_calls = Number(result.ai_calls) + Number((result.nuance as any)?.ai_calls ?? 0);
  } catch (error) {
    result.nuance = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  result.duration_ms = Date.now() - started;
  console.log('[synonym-verifier]', JSON.stringify(result));
  return result;
}

// D10_synonym_nuance_v1 (05.11.2026, agreed): the label of a published contextual synonym for the app -
// style ("the same meaning, another style") or meaning ("a close meaning"), contrast test nuance_v1 with the configured
// model. The class of the pair is not changed. One answer per pair and content (the database leases only pairs without
// a label for their current content); an unanswered pair is asked again after its lease (5 min) ends.
const NUANCE_LATEST_START_MS = 60_000;
async function runNuance(reason: string, jobId: string | null) {
  let lease: any;
  try {
    lease = await rpc('d10_synonym_nuance_lease_v1', { p_limit: 20 });
  } catch (error) {
    // the database part is not installed yet: nothing to do
    return { ok: true, ai_calls: 0, stopped: 'not_installed', error: error instanceof Error ? error.message : String(error) };
  }
  const items = (lease?.items ?? []) as any[];
  if (!items.length) return { ok: true, ai_calls: 0, done: 0, stopped: lease?.reason ?? 'nothing_queued' };
  const model = String(lease?.model || 'gpt-6-luna');
  const thinking = lease?.thinking ?? null;
  const chunk: NuanceItem[] = items.map((x, n) => ({ ref: n, source_lemma: String(x.source_lemma ?? ''), source_pos: x.source_pos ?? null,
    source_meaning: String(x.source_meaning ?? ''), target_lemma: String(x.target_lemma ?? ''), target_pos: x.target_pos ?? null,
    target_meaning: String(x.target_meaning ?? ''), example_nb: x.example_nb ?? null }));
  const callStarted = Date.now();
  const log: Record<string, unknown> = { reason: `${reason}:nuance`.slice(0, 40), job_id: jobId, pairs: items.length, ok: false, model,
    prompt_version: NUANCE_PROMPT_VERSION };
  let done = 0; let stale = 0;
  try {
    const answer = await callEvalModel(buildNuancePrompt(chunk), model, nuanceSchema(), thinking);
    evalTokens(log, answer.usage);
    const parsed = parseNuanceAnswer(answer.text, chunk.length);
    for (const [n, a] of parsed) {
      const it = items[n];
      const saved = await rpc('d10_synonym_nuance_record_v1', {
        p_pair_id: it.pair_id, p_lease_token: lease.lease_token, p_snapshot_hash: it.snapshot_hash, p_kind: nuanceKind(a).kind,
        p_register_source: a.register_source, p_register_target: a.register_target, p_answer: a, p_model: model,
        p_prompt_version: NUANCE_PROMPT_VERSION,
      });
      if (saved?.applied) done++; else stale++;
    }
    log.ok = true; log.decided = done;
  } catch (error) {
    log.error = error instanceof Error ? error.message : String(error);
  }
  log.duration_ms = Date.now() - callStarted;
  await rpc('d10_synonym_log_ai_call_v2', { p_call: log, p_rows: [] }).catch((e) => console.warn('[synonym-verifier] nuance log failed', e));
  return { ok: Boolean(log.ok), ai_calls: 1, leased: items.length, done, stale, error: log.error ?? undefined };
}

// D10_synonym_eval_v2 (03.11.2026): {"mode":"eval"} runs the test cases (private.synonym_eval_case_v1, regression +
// hold-out) through the relation check v11b and the translation check sense_fit_v2b. The fit check sees ALL dictionary
// translations of the card (every Lexin variant; one AI translation only where Lexin has none) - no new translations.
// Results go to private.synonym_eval_result_v1 only; nothing is published, no pair or fit row changes. Each stage is
// scored separately: chosen sense, class, translations, publication. Refused above the daily eval call limit.
// eval only: billed output = answer + thinking tokens (thinking models bill both as output)
function evalTokens(log: Record<string, unknown>, usage: any) {
  log.prompt_tokens = usage?.promptTokenCount ?? null;
  const out = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  log.output_tokens = usage ? out : null;
}
async function runEval(modelOverride: string | null = null, thinking: string | null = null, rules: string = 'r12', nuance = false) {
  // D10_synonym_r13_v1: {"rules":"r13"} tests prompt v11c + rules_v13 + the second answer (nothing is published)
  const r13 = rules === 'r13';
  const promptVersion = r13 ? PROMPT_VERSION_V11C : PROMPT_VERSION_V11;
  const all = (await rpc('d10_synonym_eval_cases_v2', {})) as any[];
  const cases = (all ?? []).filter((c) => c.found);
  const relChunks: any[][] = [];
  for (let i = 0; i < cases.length; i += 10) relChunks.push(cases.slice(i, i + 10));
  const fitCalls = Math.ceil((cases.length * 2) / 20);
  // D10_synonym_eval_v3 (03.11.2026): the test can run on another Gemini model ({"mode":"eval","model":"..."});
  // the database checks the name and records the model of the run
  // D10_synonym_nuance_eval_v1: {"nuance":true} adds the contrast test (at most one call per 20 cases)
  const nuanceCalls = nuance ? Math.ceil(cases.length / 20) : 0;
  const start = await rpc('d10_synonym_eval_start_v3', { p_planned_calls: Math.max(1, relChunks.length * (r13 ? 2 : 1) + fitCalls + nuanceCalls),
    p_model: modelOverride });
  if (!start?.ok) return { ok: false, refused: start, missing_cases: (all ?? []).filter((c) => !c.found).map((c) => c.case_id) };
  const runId = String(start.run_id);
  const model = String(start.model || Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite');
  const rows: Record<string, unknown>[] = [];
  const rel = new Map<string, any>();
  const relD = new Map<string, any>();
  let calls = 0;
  // chunks run in parallel (a slower model must fit into the function's time)
  await Promise.all(relChunks.map(async (chunk) => {
    const callStarted = Date.now();
    const log: Record<string, unknown> = { reason: 'eval', pairs: chunk.length, ok: false, model, prompt_version: promptVersion };
    try {
      const answer = await callEvalModel(r13 ? buildPromptV11c(chunk as EvalCase[]) : buildPromptV11(chunk as EvalCase[]), model,
        r13 ? responseSchemaV11c() : responseSchemaV11(), thinking);
      evalTokens(log, answer.usage);
      const parsed = parseDecisionsV11(answer.text, chunk.length);
      const guardsOf = (c: any, d: any) => {
        const selectable = new Set<number>();
        for (const g of (c.target_groups ?? [])) for (const x of (g.definitions ?? [])) if (x.selectable) selectable.add(Number(x.n));
        return applyGuardsV11(d, caseDefinitions(c as EvalCase), selectable.size ? selectable : undefined);
      };
      // D10_synonym_r13_v1: second answer for the cases rules_v13 calls clean (only these, in another order)
      const votes = new Map<number, any>();
      if (r13) {
        const need = chunk.map((c, i) => i).filter((i) => parsed.get(i) && ruleClassV13(parsed.get(i), guardsOf(chunk[i], parsed.get(i))) === 'verified_synonym')
          .sort((a, b) => b - a);
        if (need.length) {
          const vlog: Record<string, unknown> = { reason: 'eval:vote', pairs: need.length, ok: false, model, prompt_version: promptVersion };
          const voteStarted = Date.now();
          try {
            const va = await callEvalModel(buildPromptV11c(need.map((i) => chunk[i]) as EvalCase[]), model, responseSchemaV11c(), thinking);
            evalTokens(vlog, va.usage);
            const vp = parseDecisionsV11(va.text, need.length);
            need.forEach((i, n) => { const v = vp.get(n); if (v) votes.set(i, v); });
            vlog.ok = true; vlog.decided = vp.size;
          } catch (error) { vlog.error = error instanceof Error ? error.message : String(error); }
          calls++; vlog.duration_ms = Date.now() - voteStarted;
          await rpc('d10_synonym_log_ai_call_v2', { p_call: vlog, p_rows: [] }).catch(() => null);
        }
      }
      chunk.forEach((c, i) => {
        const d = parsed.get(i);
        if (!d) return;
        const g0 = guardsOf(c, d);
        let g: any = g0;
        let r13info: Record<string, unknown> = {};
        if (r13) {
          const first = ruleClassV13(d, g0);
          const v = votes.get(i) ?? null;
          const voteClass = first === 'verified_synonym' && v ? ruleClassV13(v, guardsOf(c, v)) : null;
          // no second answer for a clean first answer: manual review (the production run puts such a pair back)
          const fin = first !== 'verified_synonym' ? first : voteClass === null ? 'needs_manual_review' : voteClassV13(first, voteClass);
          g = { ...g0, final: fin, guard: fin === 'needs_manual_review' && first === 'verified_synonym' ? (v ? 'votes_disagree' : 'no_vote') : g0.guard };
          r13info = { model_class: g0.final, rule_r12: ruleClassV12(d, g0), rule_r13_first: first, vote_class: voteClass,
            register_kind: d.register_kind ?? null,
            vote: v ? { fwd: v.substitution_forward, rev: v.substitution_reverse, same: v.same_construction,
              restriction: v.additional_restriction, added_component: v.added_component, register_kind: v.register_kind ?? null,
              meaning_difference: v.meaning_difference, reason: v.reason } : null };
        }
        rel.set(c.case_id, g);
        relD.set(c.case_id, d);
        rows.push({ case_id: c.case_id, pair_id: c.pair_id, stage: 'relation', prompt_version: promptVersion,
          final: g.final, guard: g.guard, answer: { ...r13info, ai_decision: d.decision, matched_definition: g.matched_definition,
            matched_text: g.matched_text, pattern: d.pattern, fwd: d.substitution_forward, rev: d.substitution_reverse,
            same: d.same_construction, restriction: d.additional_restriction, added_component: d.added_component,
            component_note: d.component_note, forward_example: d.forward_example, reverse_example: d.reverse_example,
            meaning_difference: d.meaning_difference, confidence: d.confidence, reason: d.reason, example_nb: g.example_nb } });
      });
      log.ok = true; log.decided = parsed.size;
    } catch (error) { log.error = error instanceof Error ? error.message : String(error); }
    calls++; log.duration_ms = Date.now() - callStarted;
    await rpc('d10_synonym_log_ai_call_v2', { p_call: log, p_rows: [] }).catch(() => null);
  }));
  // D10_synonym_nuance_eval_v1: contrast test for every case whose relation answer has both directions
  // (clean and contextual alike, to see the test on both); the class is not changed by it
  let nuanceDone = 0;
  if (nuance) {
    const nItems: (NuanceItem & { c: any })[] = [];
    for (const c of cases) {
      const d = relD.get(c.case_id); const g = rel.get(c.case_id);
      if (!d || d.substitution_forward !== true || d.substitution_reverse !== true || !g?.matched_text) continue;
      const src = c.snapshot?.source ?? {}; const tgt = c.snapshot?.target ?? {};
      nItems.push({ c, ref: 0, source_lemma: String(src.lemma ?? c.source_card?.lemma ?? ''), source_pos: src.part_of_speech ?? null,
        source_meaning: String(src.definition_nb || src.sense_context?.focus_gloss || ''),
        target_lemma: String(tgt.lemma ?? c.target_card?.lemma ?? ''), target_pos: tgt.part_of_speech ?? null,
        target_meaning: String(g.matched_text), example_nb: d.example_nb ?? d.forward_example ?? null });
    }
    const nChunks: (typeof nItems)[] = [];
    for (let i = 0; i < nItems.length; i += 20) nChunks.push(nItems.slice(i, i + 20).map((x, n) => ({ ...x, ref: n })));
    await Promise.all(nChunks.map(async (chunk) => {
      const callStarted = Date.now();
      const log: Record<string, unknown> = { reason: 'eval:nuance', pairs: chunk.length, ok: false, model, prompt_version: NUANCE_PROMPT_VERSION };
      try {
        const answer = await callEvalModel(buildNuancePrompt(chunk), model, nuanceSchema(), thinking);
        evalTokens(log, answer.usage);
        const parsed = parseNuanceAnswer(answer.text, chunk.length);
        for (const x of chunk) {
          const a = parsed.get(x.ref);
          if (!a) continue;
          const k = nuanceKind(a);
          nuanceDone++;
          rows.push({ case_id: x.c.case_id, pair_id: x.c.pair_id, stage: 'nuance', prompt_version: NUANCE_PROMPT_VERSION, final: k.kind,
            answer: { ...a, style_of_target: k.style_of_target, relation_class: rel.get(x.c.case_id)?.final ?? null } });
        }
        log.ok = true; log.decided = parsed.size;
      } catch (error) { log.error = error instanceof Error ? error.message : String(error); }
      calls++; log.duration_ms = Date.now() - callStarted;
      await rpc('d10_synonym_log_ai_call_v2', { p_call: log, p_rows: [] }).catch(() => null);
    }));
  }
  const fitRows: (FitRow & { case_id: string; pair_id: string; side: 'fit_source' | 'fit_target' })[] = [];
  for (const c of cases) {
    const s = c.source_card ?? {}; const t = c.target_card ?? {};
    const srcGroup = (c.snapshot?.source?.sense_context?.group_definitions ?? []) as string[];
    fitRows.push({ case_id: c.case_id, pair_id: c.pair_id, side: 'fit_source', fit_key: `${c.case_id}:s`, lemma: s.lemma,
      part_of_speech: s.pos, sense: s.sense, contexts: srcGroup, tr_uk: s.tr?.uk ?? [], tr_en: s.tr?.en ?? [] });
    const g = rel.get(c.case_id);
    if (g?.matched_text) {
      const tg = (c.target_groups ?? []).find((x: any) => (x.definitions ?? []).some((d: any) => Number(d.n) === g.matched_definition));
      fitRows.push({ case_id: c.case_id, pair_id: c.pair_id, side: 'fit_target', fit_key: `${c.case_id}:t`, lemma: t.lemma,
        part_of_speech: t.pos, sense: g.matched_text, contexts: (tg?.definitions ?? []).map((d: any) => d.text),
        tr_uk: t.tr?.uk ?? [], tr_en: t.tr?.en ?? [] });
    }
  }
  const fitBy = new Map<string, any>();
  const fitChunks: typeof fitRows[] = [];
  for (let i = 0; i < fitRows.length; i += 20) fitChunks.push(fitRows.slice(i, i + 20));
  await Promise.all(fitChunks.map(async (chunk) => {
    const callStarted = Date.now();
    const log: Record<string, unknown> = { reason: 'eval', pairs: chunk.length, ok: false, model, prompt_version: FIT_PROMPT_VERSION_V2 };
    try {
      const answer = await callEvalModel(buildFitPromptV2(chunk), model, fitSchema(), thinking);
      evalTokens(log, answer.usage);
      for (const a of parseFitAnswer(answer.text, chunk)) {
        const r = chunk.find((x) => x.fit_key === a.fit_key)!;
        const uk = a.uk_index >= 0 ? r.tr_uk[a.uk_index] : null; const en = a.en_index >= 0 ? r.tr_en[a.en_index] : null;
        const fit = uk && en ? 'match' : 'no_match';
        fitBy.set(a.fit_key, fit);
        rows.push({ case_id: r.case_id, pair_id: r.pair_id, stage: r.side, prompt_version: FIT_PROMPT_VERSION_V2, final: fit,
          answer: { sense: r.sense, tr_uk: r.tr_uk, tr_en: r.tr_en, chosen_uk: uk, chosen_en: en } });
      }
      log.ok = true;
    } catch (error) { log.error = error instanceof Error ? error.message : String(error); }
    calls++; log.duration_ms = Date.now() - callStarted;
    await rpc('d10_synonym_log_ai_call_v2', { p_call: log, p_rows: [] }).catch(() => null);
  }));
  // per-stage scoring; null = the stage has no expectation for this case
  const norm = (x: unknown) => String(x ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const summary = cases.map((c) => {
    const e = c.expect ?? {}; const g = rel.get(c.case_id);
    const fs = fitBy.get(`${c.case_id}:s`) ?? null; const ft = fitBy.get(`${c.case_id}:t`) ?? null;
    const publish = g?.final === 'verified_synonym' && fs === 'match' && ft === 'match';
    // the chosen definition counts as right when it is in the same article sense as an expected definition
    const groupOf = (txt: unknown) => (c.target_groups ?? []).find((gr: any) => (gr.definitions ?? []).some((d: any) => norm(d.text) === norm(txt)))?.sense ?? `t:${norm(txt)}`;
    const senseOk = e.target_sense == null ? null : String(e.target_sense).split('|').some((x: string) =>
      x === '-1' ? (g?.matched_definition ?? -1) < 0 : (g?.matched_text != null && groupOf(x) === groupOf(g.matched_text)));
    const classOk = e.class == null ? null : e.class === 'not_verified' ? g?.final !== 'verified_synonym'
      : String(e.class).split('|').includes(g?.final);
    const fitSourceOk = e.fit_source == null ? null : e.fit_source === fs;
    const fitTargetOk = e.fit_target == null ? null : e.fit_target === ft;
    const publishOk = e.publish == null ? null : e.publish === publish;
    return { case_id: c.case_id, set: c.case_set, status: e.status, sense_ok: senseOk, class_ok: classOk,
      fit_source_ok: fitSourceOk, fit_target_ok: fitTargetOk, publish_ok: publishOk,
      v10: c.current?.decision, v11: g?.final ?? null, guard: g?.guard ?? null, matched: g?.matched_text ?? null,
      fit_source: fs, fit_target: ft, would_publish: publish };
  });
  const stage = (k: string) => ({ checked: summary.filter((x: any) => x[k] !== null).length,
    ok: summary.filter((x: any) => x[k] === true).length, failed: summary.filter((x: any) => x[k] === false).map((x) => x.case_id) });
  const result = { ok: true, run_id: runId, model, thinking, rules: r13 ? RULES_V13 : 'model_class', prompt: promptVersion,
    fit_prompt: FIT_PROMPT_VERSION_V2, calls, cases: cases.length,
    ...(nuance ? { nuance_prompt: NUANCE_PROMPT_VERSION, nuance_done: nuanceDone } : {}),
    stages: { sense: stage('sense_ok'), class: stage('class_ok'), fit_source: stage('fit_source_ok'),
      fit_target: stage('fit_target_ok'), publish: stage('publish_ok') },
    missing_cases: (all ?? []).filter((c) => !c.found).map((c) => c.case_id), summary };
  await rpc('d10_synonym_eval_record_v1', { p_run: runId, p_rows: rows, p_summary: result });
  return result;
}

async function isServiceCaller(auth: string): Promise<boolean> {
  if (!SERVICE_KEY) return false;
  if (auth === `Bearer ${SERVICE_KEY}`) return true;
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token.startsWith('sb_secret_') || token.length > 200) return false;
  try {
    const probe = createClient(SUPABASE_URL, token, { auth: { persistSession: false } });
    const { error } = await probe.rpc('d10_synonym_verifier_pending_v1');
    return !error;
  } catch {
    return false;
  }
}

// D10_synonym_shadow_v1 (04.11.2026): shadow check of pairs from text analysis by two models (Flash low and
// GPT-6 Luna medium), with the class decided by the agreed feature rules (rules_v12). Nothing is published and no
// pair changes: answers go to private.synonym_shadow_result_v1 next to the production decision, to compare models.
// Started by {"mode":"shadow"}; pairs already checked with the same content are skipped; own daily call limit.
const SHADOW_RULES_VERSION = 'rules_v12';
function ruleClassV12(d: any, g: any): string {
  if (g?.guard && !['ai_category_contradiction', 'code_category', 'meaning_difference'].includes(String(g.guard))) return String(g.final);
  if ((g?.matched_definition ?? -1) < 0 || d?.decision === 'rejected') return 'rejected';
  const fwd = d?.substitution_forward === true; const rev = d?.substitution_reverse === true;
  if (!fwd && !rev) return d?.decision === 'near_synonym' ? 'near_synonym' : 'rejected';
  if (fwd !== rev) return 'one_way_synonym';
  const added = String(d?.added_component ?? 'none') !== 'none';
  const md = String(d?.meaning_difference ?? '').trim();
  const diff = md !== '' && !/^(none|no|nothing|ingen|-)\.?$/i.test(md);
  if (added || d?.additional_restriction === true || diff || d?.same_construction === false) return 'contextual_synonym';
  return 'verified_synonym';
}

// D10_synonym_r13_v1 (05.11.2026, agreed): rules_v13 = rules_v12, except that a difference ONLY in how informal the
// word sounds (register_kind colloquial, nothing else added) keeps a pair clean; formal, literary or archaic,
// regional and technical register always make it contextual. A clean result also needs a second answer that is
// clean too (voteClassV13): second answer contextual -> contextual; anything else -> manual review.
const RULES_V13 = 'rules_v13';
function lightRegisterV13(d: any): boolean {
  return d?.register_kind === 'colloquial' && ['none', 'register'].includes(String(d?.added_component ?? 'none'));
}
function ruleClassV13(d: any, g: any): string {
  if (g?.guard && !['ai_category_contradiction', 'code_category', 'meaning_difference', 'added_component'].includes(String(g.guard))) return String(g.final);
  if ((g?.matched_definition ?? -1) < 0 || d?.decision === 'rejected') return 'rejected';
  const fwd = d?.substitution_forward === true; const rev = d?.substitution_reverse === true;
  if (!fwd && !rev) return d?.decision === 'near_synonym' ? 'near_synonym' : 'rejected';
  if (fwd !== rev) return 'one_way_synonym';
  const light = lightRegisterV13(d);
  const added = String(d?.added_component ?? 'none') !== 'none' && !light;
  const md = String(d?.meaning_difference ?? '').trim();
  const diff = !light && md !== '' && !/^(none|no|nothing|ingen|-)\.?$/i.test(md);
  const heavy = ['formal', 'literary_or_archaic', 'regional', 'technical', 'unknown'].includes(String(d?.register_kind ?? 'none'));
  if (added || heavy || d?.additional_restriction === true || diff || d?.same_construction === false) return 'contextual_synonym';
  return 'verified_synonym';
}
function voteClassV13(first: string, second: string): string {
  if (first !== 'verified_synonym') return first;
  if (second === 'verified_synonym' || second === 'contextual_synonym') return second;
  return 'needs_manual_review';
}
function priorVoteV13(prior: any): any | null {
  const v = prior?.v11_vote;
  if (!v || typeof v !== 'object' || typeof v.substitution_forward !== 'boolean' || typeof v.substitution_reverse !== 'boolean') return null;
  return v;
}
async function shadowOnModel(cases: any[], model: string, thinking: string | null, variant: string, runId: string) {
  const rows: Record<string, unknown>[] = [];
  const rel = new Map<string, any>();
  let calls = 0;
  const relChunks: any[][] = [];
  for (let i = 0; i < cases.length; i += 10) relChunks.push(cases.slice(i, i + 10));
  await Promise.all(relChunks.map(async (chunk) => {
    const callStarted = Date.now();
    const log: Record<string, unknown> = { reason: 'shadow', pairs: chunk.length, ok: false, model, prompt_version: PROMPT_VERSION_V11 };
    try {
      const answer = await callEvalModel(buildPromptV11(chunk as EvalCase[]), model, responseSchemaV11(), thinking);
      evalTokens(log, answer.usage);
      const parsed = parseDecisionsV11(answer.text, chunk.length);
      chunk.forEach((c, i) => {
        const d = parsed.get(i);
        if (!d) return;
        const selectable = new Set<number>();
        for (const g of (c.target_groups ?? [])) for (const x of (g.definitions ?? [])) if (x.selectable) selectable.add(Number(x.n));
        const g = applyGuardsV11(d, caseDefinitions(c as EvalCase), selectable.size ? selectable : undefined);
        const ruled = ruleClassV12(d, g);
        rel.set(c.case_id, { ...g, rule_class: ruled });
        rows.push({ pair_id: c.pair_id, snapshot_hash: c.snapshot_hash, variant, model, thinking, stage: 'relation',
          prompt_version: PROMPT_VERSION_V11, model_class: g.final, rule_class: ruled, guard: g.guard,
          answer: { ai_decision: d.decision, matched_definition: g.matched_definition, matched_text: g.matched_text,
            fwd: d.substitution_forward, rev: d.substitution_reverse, same: d.same_construction,
            restriction: d.additional_restriction, added_component: d.added_component, component_note: d.component_note,
            meaning_difference: d.meaning_difference, confidence: d.confidence, reason: d.reason } });
      });
      log.ok = true; log.decided = parsed.size;
    } catch (error) { log.error = error instanceof Error ? error.message : String(error); }
    calls++; log.duration_ms = Date.now() - callStarted;
    await rpc('d10_synonym_log_ai_call_v2', { p_call: log, p_rows: [] }).catch(() => null);
  }));
  const fitRows: (FitRow & { case_id: string; pair_id: string; snapshot_hash: string; side: string })[] = [];
  for (const c of cases) {
    const s = c.source_card ?? {}; const t = c.target_card ?? {};
    const srcGroup = (c.snapshot?.source?.sense_context?.group_definitions ?? []) as string[];
    fitRows.push({ case_id: c.case_id, pair_id: c.pair_id, snapshot_hash: c.snapshot_hash, side: 'fit_source', fit_key: `${c.case_id}:s`,
      lemma: s.lemma, part_of_speech: s.pos, sense: s.sense, contexts: srcGroup, tr_uk: s.tr?.uk ?? [], tr_en: s.tr?.en ?? [] });
    const g = rel.get(c.case_id);
    if (g?.matched_text) {
      const tg = (c.target_groups ?? []).find((x: any) => (x.definitions ?? []).some((d: any) => Number(d.n) === g.matched_definition));
      fitRows.push({ case_id: c.case_id, pair_id: c.pair_id, snapshot_hash: c.snapshot_hash, side: 'fit_target', fit_key: `${c.case_id}:t`,
        lemma: t.lemma, part_of_speech: t.pos, sense: g.matched_text, contexts: (tg?.definitions ?? []).map((d: any) => d.text),
        tr_uk: t.tr?.uk ?? [], tr_en: t.tr?.en ?? [] });
    }
  }
  const fitChunks: typeof fitRows[] = [];
  for (let i = 0; i < fitRows.length; i += 20) fitChunks.push(fitRows.slice(i, i + 20));
  await Promise.all(fitChunks.map(async (chunk) => {
    const callStarted = Date.now();
    const log: Record<string, unknown> = { reason: 'shadow', pairs: chunk.length, ok: false, model, prompt_version: FIT_PROMPT_VERSION_V2 };
    try {
      const answer = await callEvalModel(buildFitPromptV2(chunk), model, fitSchema(), thinking);
      evalTokens(log, answer.usage);
      for (const a of parseFitAnswer(answer.text, chunk)) {
        const r = chunk.find((x) => x.fit_key === a.fit_key)!;
        const uk = a.uk_index >= 0 ? r.tr_uk[a.uk_index] : null; const en = a.en_index >= 0 ? r.tr_en[a.en_index] : null;
        rows.push({ pair_id: r.pair_id, snapshot_hash: r.snapshot_hash, variant, model, thinking, stage: r.side,
          prompt_version: FIT_PROMPT_VERSION_V2, fit: uk && en ? 'match' : 'no_match',
          answer: { sense: r.sense, tr_uk: r.tr_uk, tr_en: r.tr_en, chosen_uk: uk, chosen_en: en } });
      }
      log.ok = true;
    } catch (error) { log.error = error instanceof Error ? error.message : String(error); }
    calls++; log.duration_ms = Date.now() - callStarted;
    await rpc('d10_synonym_log_ai_call_v2', { p_call: log, p_rows: [] }).catch(() => null);
  }));
  return { rows, calls };
}
// D10_synonym_shadow_v2 (04.11.2026): scope 'analysis' (pairs from text analysis, as before) or 'published' (pairs
// published now, whatever their origin), to find published pairs the new check does not confirm
async function runShadow(limit: number, scope: string = 'analysis') {
  const cases = ((await rpc('d10_synonym_shadow_cases_v2', { p_limit: limit, p_scope: scope })) as any[]) ?? [];
  if (!cases.length) return { ok: true, pairs: 0, scope, note: 'no unchecked pairs in this scope' };
  const perVariant = Math.ceil(cases.length / 10) + Math.ceil((cases.length * 2) / 20);
  const start = await rpc('d10_synonym_shadow_start_v1', { p_pairs: cases.length, p_calls_per_variant: perVariant });
  if (!start?.ok) return { ok: false, refused: start };
  const runId = String(start.run_id);
  const variants = (start.variants ?? []) as { model: string; thinking: string | null }[];
  const results = await Promise.all(variants.map((v) =>
    shadowOnModel(cases, String(v.model), v.thinking ?? null, `${v.model}@${v.thinking ?? 'default'}`, runId)));
  const rows = results.flatMap((r) => r.rows);
  const calls = results.reduce((n, r) => n + r.calls, 0);
  const summary = { rules: SHADOW_RULES_VERSION, prompt: PROMPT_VERSION_V11, fit_prompt: FIT_PROMPT_VERSION_V2, pairs: cases.length, scope,
    calls, variants: variants.map((v) => `${v.model}@${v.thinking ?? 'default'}`) };
  const rec = await rpc('d10_synonym_shadow_record_v1', { p_run: runId, p_rows: rows, p_summary: summary });
  return { ok: true, run_id: runId, ...summary, recorded: rec };
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!(await isServiceCaller(auth))) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason ?? 'manual').slice(0, 40);
  const jobId = typeof body?.job_id === 'string' ? body.job_id : null;

  if (body?.mode === 'shadow') {
    // D10_synonym_shadow_v1: runs in the background; {"wait":true} answers with the result
    const limit = Math.min(Math.max(Number(body?.limit) || 20, 1), 30);
    const scope = body?.scope === 'published' ? 'published' : 'analysis';
    if (body?.wait === true) {
      try { return json(await runShadow(limit, scope)); }
      catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500); }
    }
    const shadowTask = runShadow(limit, scope).then((r) => console.log('[synonym-verifier] shadow', JSON.stringify(r)))
      .catch((error) => console.error('[synonym-verifier] shadow failed', error instanceof Error ? error.message : String(error)));
    (globalThis as any).EdgeRuntime?.waitUntil?.(shadowTask);
    return json({ ok: true, started: true, mode: 'shadow' }, 202);
  }
  if (body?.mode === 'eval') {
    // {"mode":"eval","wait":true} answers with the result; otherwise it runs in the background (result in the DB)
    const evalModel = typeof body?.model === 'string' ? body.model.slice(0, 60) : null;
    // D10_synonym_eval_v4 (03.11.2026): {"thinking":"minimal|low|medium|high"} - Gemini 3 thinking level, eval only
    // Gemini: minimal|low|medium|high; OpenAI (gpt-...): sent as reasoning_effort none|low|medium|high
    const evalThinking = ['minimal', 'none', 'low', 'medium', 'high'].includes(String(body?.thinking)) ? String(body.thinking) : null;
    // D10_synonym_r13_v1: {"rules":"r13"} - prompt v11c + rules_v13 + second answer
    const evalRules = body?.rules === 'r13' ? 'r13' : 'r12';
    // D10_synonym_nuance_eval_v1: {"nuance":true} - contrast test (style / meaning) for contextual labels
    const evalNuance = body?.nuance === true;
    if (body?.wait === true) {
      try { return json(await runEval(evalModel, evalThinking, evalRules, evalNuance)); }
      catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500); }
    }
    const evalTask = runEval(evalModel, evalThinking, evalRules, evalNuance).then((r) => console.log('[synonym-verifier] eval', JSON.stringify(r)))
      .catch((error) => console.error('[synonym-verifier] eval failed', error instanceof Error ? error.message : String(error)));
    (globalThis as any).EdgeRuntime?.waitUntil?.(evalTask);
    return json({ ok: true, started: true, mode: 'eval' }, 202);
  }
  if (body?.wait === true) {
    try { return json(await run(reason, jobId)); }
    catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500); }
  }
  const task = run(reason, jobId).catch((error) =>
    console.error('[synonym-verifier] failed', error instanceof Error ? error.message : String(error)));
  // background work after the answer (the supervisor does not wait)
  (globalThis as any).EdgeRuntime?.waitUntil?.(task);
  return json({ ok: true, started: true }, 202);
});
