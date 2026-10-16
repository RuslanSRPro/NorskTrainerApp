// D10 stage D2 (plan D10_stage_d_plan_v3, build spec v2): second cards for
// homographs with different paradigms (rule R9-auto).
//
// For every main card promoted in a job, the homonym articles of the same POS
// (rejected in its article binding, or offered by its Ordbøkene check) are
// compared with the main card's own article:
//   - same forms        -> r8_same_forms (one card, rule R8; nothing created)
//   - different forms   -> r9_card (second card with the Roman homograph
//                          number, added to the job as its own item)
//   - article unusable  -> skipped
// A main card without any article (no binding, no snapshot) first gets its
// own article: the lowest Roman homograph number (agreed 14.10.2026; the
// Lexin-forms refinement is applied by lexin-enrichment-worker).
//
// The comparison works on the Ordbøkene article JSON of BOTH articles, so
// like is compared with like (all paradigms of the POS, every word form).

export type ParsedArticle = {
  articleId: number;
  hgno: number;
  forms: string[];
  // D10 15.10.2026 (R9 guard): the article's own explanations (normalized)
  // and the articles they refer to.
  definitions?: string[];
  refArticleIds?: number[];
};

export type HomographDecision = {
  articleId: number;
  decision: 'r9_card' | 'r8_same_forms' | 'main_article' | 'skipped';
  hgno: number | null;
  reason: string;
  forms: string[];
  // D10 15.10.2026: true = shown to the user instead of an automatic split.
  review?: boolean;
};

// D10 15.10.2026 (plan v3, R9 guard): different forms but the same meaning
// -> no automatic second card; the article is recorded as "skipped" with
// review = true and listed for the user (query 112). Same meaning =
//   - the candidate only refers to the main article (a variant entry), or
//   - all its own explanations are explanations of the main article.
function normDef(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('nb-NO').replace(/\s+/g, ' ').trim();
}

function collectExplanations(node: unknown, defs: string[], refs: number[]): void {
  if (Array.isArray(node)) { for (const n of node) collectExplanations(n, defs, refs); return; }
  if (!node || typeof node !== 'object') return;
  const x = node as Record<string, unknown>;
  if (x.type_ === 'sub_article') return;
  if (x.type_ === 'explanation' && typeof x.content === 'string') {
    const items = Array.isArray(x.items) ? x.items as Record<string, unknown>[] : [];
    // An explanation that is ONLY a reference to another article ("$" with an
    // article_ref) is recorded as a reference, not as an own definition.
    if (x.content.trim() === '$' && items.length === 1 && items[0]?.type_ === 'article_ref') {
      const id = Number(items[0].article_id);
      if (Number.isInteger(id)) refs.push(id);
      return;
    }
    let index = 0;
    const text = x.content.replace(/\$/g, () => {
      const item = items[index++];
      if (item?.type_ === 'article_ref') {
        const lemmas = Array.isArray(item.lemmas) ? item.lemmas as Record<string, unknown>[] : [];
        return lemmas.map((l) => String(l.lemma ?? '')).join(' / ');
      }
      if (typeof item?.text === 'string') return item.text;
      return '';
    });
    const clean = normDef(text);
    if (clean) defs.push(clean);
    return;
  }
  if (x.elements) collectExplanations(x.elements, defs, refs);
  if (x.definitions) collectExplanations(x.definitions, defs, refs);
}

export function sameMeaningAsMain(candidate: ParsedArticle, mains: ParsedArticle[]): boolean {
  const mainIds = new Set(mains.map((m) => m.articleId));
  const mainDefs = new Set(mains.flatMap((m) => m.definitions ?? []));
  const own = candidate.definitions ?? [];
  const refs = (candidate.refArticleIds ?? []).filter((id) => id !== candidate.articleId);
  // a variant entry: no own explanation, only references to the main article
  const variantOfMain = own.length === 0 && refs.length > 0 && refs.every((id) => mainIds.has(id));
  // every own explanation is an explanation of the main article
  const subsetOfMain = own.length > 0 && mainDefs.size > 0 && own.every((d) => mainDefs.has(d));
  return variantOfMain || subsetOfMain;
}

const POS_TAG: Record<string, string> = {
  noun: 'NOUN',
  verb: 'VERB',
  adjective: 'ADJ',
  determiner: 'DET',
};

function norm(value: unknown): string {
  return String(value ?? '').normalize('NFC').toLocaleLowerCase('nb-NO').trim();
}

// Parses one Ordbøkene article (https://ord.uib.no/bm/article/<id>.json) for
// the given lemma and POS. Returns null when the article has no headword of
// this lemma and POS (e.g. a headword removed at the source).
export function parseHomographArticle(
  payload: unknown,
  articleId: number,
  lemma: string,
  pos: string,
): ParsedArticle | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const article = payload as Record<string, unknown>;
  if (Number(article.article_id) !== articleId || !Array.isArray(article.lemmas)) return null;
  const tag = POS_TAG[pos];
  if (!tag) return null;
  const wanted = norm(lemma);
  for (const entry of article.lemmas as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (norm(e.lemma) !== wanted) continue;
    const paradigms = Array.isArray(e.paradigm_info) ? e.paradigm_info as Record<string, unknown>[] : [];
    const forms = new Set<string>([wanted]);
    let posMatch = false;
    for (const p of paradigms) {
      if (!Array.isArray(p.tags) || !(p.tags as unknown[]).includes(tag)) continue;
      posMatch = true;
      for (const inflection of Array.isArray(p.inflection) ? p.inflection as Record<string, unknown>[] : []) {
        const form = norm(inflection.word_form);
        if (form) forms.add(form);
      }
    }
    if (!posMatch) continue;
    const hgno = Number(e.hgno);
    const definitions: string[] = [];
    const refArticleIds: number[] = [];
    collectExplanations((article.body as Record<string, unknown> | undefined)?.definitions, definitions, refArticleIds);
    return {
      articleId,
      hgno: Number.isInteger(hgno) ? hgno : 0,
      forms: [...forms].sort(),
      definitions: [...new Set(definitions)],
      refArticleIds: [...new Set(refArticleIds)],
    };
  }
  return null;
}

function sameForms(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

// Pure decision for one main card.
//   mainArticles  parsed own articles of the main card ([] = no article yet)
//   candidates    parsed homonym articles (null = could not be used)
export function decideHomographs(
  mainArticles: ParsedArticle[],
  candidates: Array<{ articleId: number; parsed: ParsedArticle | null }>,
): HomographDecision[] {
  const decisions: HomographDecision[] = [];
  let reference = mainArticles.filter((a) => a.hgno >= 1);
  const usable = candidates
    .filter((c): c is { articleId: number; parsed: ParsedArticle } => c.parsed !== null && c.parsed.hgno >= 1)
    .sort((x, y) => x.parsed.hgno - y.parsed.hgno);

  for (const c of candidates) {
    if (c.parsed === null || c.parsed.hgno < 1) {
      decisions.push({ articleId: c.articleId, decision: 'skipped', hgno: c.parsed?.hgno ?? null,
        reason: c.parsed === null ? 'no_headword_for_lemma_and_pos' : 'no_homograph_number', forms: [] });
    }
  }

  let rest = usable;
  if (reference.length === 0) {
    if (usable.length === 0) return decisions;
    // Main card without an article: lowest Roman number becomes its article.
    const main = usable[0];
    decisions.push({ articleId: main.articleId, decision: 'main_article', hgno: main.parsed.hgno,
      reason: 'lowest_homograph_number', forms: main.parsed.forms });
    reference = [main.parsed];
    rest = usable.slice(1);
  }

  for (const c of rest) {
    const equal = reference.some((r) => sameForms(r.forms, c.parsed.forms));
    const sameNumber = reference.some((r) => r.hgno === c.parsed.hgno);
    if (equal) {
      decisions.push({ articleId: c.articleId, decision: 'r8_same_forms', hgno: c.parsed.hgno,
        reason: 'identical_paradigm', forms: c.parsed.forms });
    } else if (sameNumber) {
      decisions.push({ articleId: c.articleId, decision: 'skipped', hgno: c.parsed.hgno,
        reason: 'homograph_number_of_main_card', forms: c.parsed.forms });
    } else if (sameMeaningAsMain(c.parsed, reference)) {
      // R9 guard: different forms, same meaning -> shown to the user.
      decisions.push({ articleId: c.articleId, decision: 'skipped', hgno: c.parsed.hgno,
        reason: 'r9_guard_same_meaning', forms: c.parsed.forms, review: true });
    } else {
      decisions.push({ articleId: c.articleId, decision: 'r9_card', hgno: c.parsed.hgno,
        reason: 'different_paradigm', forms: c.parsed.forms });
    }
  }
  return decisions;
}

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
type FetchJson = (url: string) => Promise<unknown>;

export type HomographStepResult = {
  added: number;
  decided: number;
  hasMore: boolean;
  notEnabled: boolean;
  errors: string[];
};

const CANDIDATE_LIMIT = 20;

export async function runHomographStep(
  rpc: Rpc,
  fetchJson: FetchJson,
  jobId: string,
): Promise<HomographStepResult> {
  const result: HomographStepResult = { added: 0, decided: 0, hasMore: false, notEnabled: false, errors: [] };

  const { data: rows, error } = await rpc('d10_homograph_candidates_for_job_v1', {
    p_job_id: jobId, p_limit: CANDIDATE_LIMIT,
  });
  if (error) throw new Error(`HOMOGRAPH_CANDIDATES_FAILED:${JSON.stringify(error)}`);
  const list = (Array.isArray(rows) ? rows : []) as Array<{
    main_lexeme_id: string; lemma: string; pos: string; main_article_ids: number[] | null; article_id: number;
  }>;
  result.hasMore = list.length >= CANDIDATE_LIMIT;

  const articleCache = new Map<number, Promise<unknown>>();
  const loadArticle = (id: number) => {
    if (!articleCache.has(id)) {
      articleCache.set(id, fetchJson(`https://ord.uib.no/bm/article/${id}.json`).catch(() => null));
    }
    return articleCache.get(id)!;
  };

  const byMain = new Map<string, typeof list>();
  for (const row of list) {
    const group = byMain.get(row.main_lexeme_id) ?? [];
    group.push(row);
    byMain.set(row.main_lexeme_id, group);
  }

  for (const [mainId, group] of byMain) {
    const { lemma, pos } = group[0];
    const mainIds = (group[0].main_article_ids ?? []).map(Number);
    const mainArticles = (await Promise.all(mainIds.map(async (id) =>
      parseHomographArticle(await loadArticle(id), id, lemma, pos)))).filter((a): a is ParsedArticle => a !== null);
    if (mainIds.length > 0 && mainArticles.length === 0) {
      result.errors.push(`${lemma}/${pos}: main article not readable`);
      continue;
    }
    const loaded = await Promise.all(group.map(async (row) => ({
      articleId: Number(row.article_id),
      payload: await loadArticle(Number(row.article_id)),
    })));
    // An article that could not be fetched is not decided: it is retried in
    // a later job instead of being recorded as skipped.
    for (const l of loaded) {
      if (l.payload === null) result.errors.push(`${lemma}/${pos}/${l.articleId}: article not fetched`);
    }
    const candidates = loaded.filter((l) => l.payload !== null).map((l) => ({
      articleId: l.articleId,
      parsed: parseHomographArticle(l.payload, l.articleId, lemma, pos),
    }));

    for (const d of decideHomographs(mainArticles, candidates)) {
      const { data: cardId, error: decisionError } = await rpc('d10_record_homograph_decision_v1', {
        p_main_lexeme_id: mainId, p_article_id: d.articleId, p_decision: d.decision,
        p_hgno: d.hgno, p_job_id: jobId,
        p_evidence: { reason: d.reason, forms: d.forms, version: 'd10-homograph-cards/v1',
          ...(d.review ? { review: true } : {}) },
      });
      if (decisionError) {
        const message = JSON.stringify(decisionError);
        if (message.includes('HOMOGRAPH_CARDS_NOT_ENABLED')) { result.notEnabled = true; return result; }
        result.errors.push(`${lemma}/${pos}/${d.articleId}: ${message}`);
        continue;
      }
      result.decided += 1;
      if (d.decision === 'r9_card' && cardId) {
        const { data: itemId, error: injectError } = await rpc('d10_inject_homograph_item_v1', {
          p_job_id: jobId, p_card_lexeme_id: cardId, p_main_lexeme_id: mainId,
        });
        if (injectError) result.errors.push(`${lemma}/${pos}: inject ${JSON.stringify(injectError)}`);
        else if (itemId) result.added += 1;
      }
    }
  }

  // Second cards created in earlier jobs: add them to this job as well.
  const { data: existing, error: existingError } = await rpc('d10_existing_homograph_cards_for_job_v1', {
    p_job_id: jobId,
  });
  if (existingError) {
    result.errors.push(`existing cards: ${JSON.stringify(existingError)}`);
  } else {
    for (const row of (Array.isArray(existing) ? existing : []) as Array<{ card_lexeme_id: string; main_lexeme_id: string }>) {
      const { data: itemId, error: injectError } = await rpc('d10_inject_homograph_item_v1', {
        p_job_id: jobId, p_card_lexeme_id: row.card_lexeme_id, p_main_lexeme_id: row.main_lexeme_id,
      });
      if (injectError) result.errors.push(`existing inject: ${JSON.stringify(injectError)}`);
      else if (itemId) result.added += 1;
    }
  }
  return result;
}
