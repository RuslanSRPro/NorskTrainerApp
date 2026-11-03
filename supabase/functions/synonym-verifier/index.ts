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

async function callGemini(prompt: string, model: string, schema: unknown = responseSchema()) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return { model, text: geminiText(data), usage: data?.usageMetadata ?? null };
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
    const callStarted = Date.now();
    const log: Record<string, unknown> = { reason: `fit:${reason}`.slice(0, 40), job_id: jobId, pairs: rows.length,
      ok: false, model, prompt_version: FIT_PROMPT_VERSION };
    let answers: ReturnType<typeof parseFitAnswer> = [];
    try {
      const answer = await callGemini(buildFitPrompt(rows), model, fitSchema());
      log.model = answer.model;
      log.prompt_tokens = answer.usage?.promptTokenCount ?? null;
      log.output_tokens = answer.usage?.candidatesTokenCount ?? null;
      answers = parseFitAnswer(answer.text, rows);
      log.ok = true;
    } catch (error) {
      log.error = error instanceof Error ? error.message : String(error);
    }
    calls++; out.ai_calls++;
    // rows without a valid answer go back to the queue (or fail after 3 attempts)
    const saved = await rpc('d10_synonym_fit_record_v1', { p_lease_token: lease.lease_token, p_rows: answers,
      p_model: String(log.model), p_prompt_version: FIT_PROMPT_VERSION });
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
  result.duration_ms = Date.now() - started;
  console.log('[synonym-verifier]', JSON.stringify(result));
  return result;
}

// D10_synonym_eval_v2 (03.11.2026): {"mode":"eval"} runs the test cases (private.synonym_eval_case_v1, regression +
// hold-out) through the relation check v11b and the translation check sense_fit_v2b. The fit check sees ALL dictionary
// translations of the card (every Lexin variant; one AI translation only where Lexin has none) - no new translations.
// Results go to private.synonym_eval_result_v1 only; nothing is published, no pair or fit row changes. Each stage is
// scored separately: chosen sense, class, translations, publication. Refused above the daily eval call limit.
async function runEval() {
  const all = (await rpc('d10_synonym_eval_cases_v2', {})) as any[];
  const cases = (all ?? []).filter((c) => c.found);
  const relChunks: any[][] = [];
  for (let i = 0; i < cases.length; i += 10) relChunks.push(cases.slice(i, i + 10));
  const fitCalls = Math.ceil((cases.length * 2) / 20);
  const start = await rpc('d10_synonym_eval_start_v1', { p_planned_calls: Math.max(1, relChunks.length + fitCalls) });
  if (!start?.ok) return { ok: false, refused: start, missing_cases: (all ?? []).filter((c) => !c.found).map((c) => c.case_id) };
  const runId = String(start.run_id);
  const model = String(start.model || Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite');
  const rows: Record<string, unknown>[] = [];
  const rel = new Map<string, any>();
  let calls = 0;
  for (const chunk of relChunks) {
    const callStarted = Date.now();
    const log: Record<string, unknown> = { reason: 'eval', pairs: chunk.length, ok: false, model, prompt_version: PROMPT_VERSION_V11 };
    try {
      const answer = await callGemini(buildPromptV11(chunk as EvalCase[]), model, responseSchemaV11());
      log.prompt_tokens = answer.usage?.promptTokenCount ?? null; log.output_tokens = answer.usage?.candidatesTokenCount ?? null;
      const parsed = parseDecisionsV11(answer.text, chunk.length);
      chunk.forEach((c, i) => {
        const d = parsed.get(i);
        if (!d) return;
        const selectable = new Set<number>();
        for (const g of (c.target_groups ?? [])) for (const x of (g.definitions ?? [])) if (x.selectable) selectable.add(Number(x.n));
        const g = applyGuardsV11(d, caseDefinitions(c as EvalCase), selectable.size ? selectable : undefined);
        rel.set(c.case_id, g);
        rows.push({ case_id: c.case_id, pair_id: c.pair_id, stage: 'relation', prompt_version: PROMPT_VERSION_V11,
          final: g.final, guard: g.guard, answer: { ai_decision: d.decision, matched_definition: g.matched_definition,
            matched_text: g.matched_text, pattern: d.pattern, fwd: d.substitution_forward, rev: d.substitution_reverse,
            same: d.same_construction, restriction: d.additional_restriction, added_component: d.added_component,
            component_note: d.component_note, forward_example: d.forward_example, reverse_example: d.reverse_example,
            meaning_difference: d.meaning_difference, confidence: d.confidence, reason: d.reason, example_nb: g.example_nb } });
      });
      log.ok = true; log.decided = parsed.size;
    } catch (error) { log.error = error instanceof Error ? error.message : String(error); }
    calls++; log.duration_ms = Date.now() - callStarted;
    await rpc('d10_synonym_log_ai_call_v2', { p_call: log, p_rows: [] }).catch(() => null);
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
  for (let i = 0; i < fitRows.length; i += 20) {
    const chunk = fitRows.slice(i, i + 20);
    const callStarted = Date.now();
    const log: Record<string, unknown> = { reason: 'eval', pairs: chunk.length, ok: false, model, prompt_version: FIT_PROMPT_VERSION_V2 };
    try {
      const answer = await callGemini(buildFitPromptV2(chunk), model, fitSchema());
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
  }
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
  const result = { ok: true, run_id: runId, prompt: PROMPT_VERSION_V11, fit_prompt: FIT_PROMPT_VERSION_V2, calls, cases: cases.length,
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

serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!(await isServiceCaller(auth))) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason ?? 'manual').slice(0, 40);
  const jobId = typeof body?.job_id === 'string' ? body.job_id : null;

  if (body?.mode === 'eval') {
    // {"mode":"eval","wait":true} answers with the result; otherwise it runs in the background (result in the DB)
    if (body?.wait === true) {
      try { return json(await runEval()); }
      catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500); }
    }
    const evalTask = runEval().then((r) => console.log('[synonym-verifier] eval', JSON.stringify(r)))
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
