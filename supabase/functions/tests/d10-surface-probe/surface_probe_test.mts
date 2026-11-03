// D10 27.10.2026 (agreed): "surface as lemma" probe.
// Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-surface-probe/surface_probe_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
const sp = await import('../../_shared/d10-surface-probe.ts');
const rd = await import('../../_shared/d10-review-decisions.ts');

// planner normalisation stand-in (analyze-text uses normalizeExpression)
const norm = (v: string) => String(v ?? '').toLowerCase().trim();

const tok = (surface: string, lemma: string | null, start = 0, extra: Record<string, unknown> = {}) => ({
  match_type: 'token', raw_input: surface, normalized_input: surface, normalized_lemma: lemma ?? surface,
  surface_form: surface, token_start: start, token_end: start, expression_id: null,
  resolved: lemma ? { lemma } : null, match_strategy: 'token', ...extra,
});

test('plan: bar known only as forms of bære / bare -> one probe "bar"', () => {
  const probes = sp.planSurfaceLemmaProbes([tok('bar', 'bære'), tok('bar', 'bare')], norm);
  assert.equal(probes.length, 1);
  assert.equal(probes[0].normalized_lemma, 'bar');
});

test('plan: a found lemma equal to the word -> no probe (bære, Bar with lemma bar)', () => {
  assert.equal(sp.planSurfaceLemmaProbes([tok('bære', 'bære')], norm).length, 0);
  assert.equal(sp.planSurfaceLemmaProbes([tok('Bar', 'bar'), tok('Bar', 'bære')], norm).length, 0);
});

test('plan: unknown word (no database candidate) -> no probe, the sources already get the word', () => {
  assert.equal(sp.planSurfaceLemmaProbes([tok('chille', null)], norm).length, 0);
  assert.equal(sp.planSurfaceLemmaProbes([tok('bar', 'bære'), tok('bar', null)], norm).length, 0);
});

test('plan: expressions, multi-token items and existing probes are ignored; one probe per position', () => {
  const items = [
    { ...tok('ta med', 'ta med'), match_type: 'expression', expression_id: 'e1', token_end: 1 },
    tok('var', 'være', 3), tok('var', 'være', 3, { normalized_lemma: 'være' }),
    tok('gikk', 'gå', 5),
    tok('gikk', 'gikk', 5, { match_strategy: 'surface_as_lemma_probe', resolved: null }),
  ];
  const probes = sp.planSurfaceLemmaProbes(items, norm);
  assert.deepEqual(probes.map((p: any) => [p.normalized_lemma, p.token_start]), [['var', 3], ['gikk', 5]]);
});

const article = (id: string, lemma: string, tags: string[][], extra: Record<string, unknown> = {}) => ({
  dictionaryCode: 'bm', articleId: id, sourceUrl: `https://ord.uib.no/bm/article/${id}`,
  payload: { lemmas: [{ lemma, paradigm_info: tags.map((t, i) => ({ paradigm_id: i + 1, tags: t })) }], ...extra },
});
const lookup = (scope: 'e' | 'i', articles: any[], errors: any[] = []) => ({
  query: 'x', normalizedQuery: 'x', requestedDictionaries: ['bm'], scopeUsed: scope,
  articleReferences: articles.map((a) => ({ dictionaryCode: 'bm', articleId: a.articleId })),
  articles, errors, checkedAt: '2026-10-27T00:00:00Z',
});

test('decision: bar exact headword noun + adjective -> split into noun, adjective', () => {
  const d = sp.surfaceProbeDecision('bar', lookup('e', [
    article('4500', 'bar', [['NOUN', 'Masc']]), article('4501', 'bar', [['NOUN', 'Neuter']]),
    article('4502', 'bar', [['ADJ']]),
  ]));
  assert.equal(d.outcome, 'split');
  assert.deepEqual(d.pos, ['noun', 'adjective']);
  assert.deepEqual((d.evidence as any).headword_pos, { noun: ['4500', '4501'], adjective: ['4502'] });
});

test('decision: inflection hit (scope i: gikk -> gå) is never a headword', () => {
  const d = sp.surfaceProbeDecision('gikk', lookup('i', [article('20000', 'gå', [['VERB']])]));
  assert.equal(d.outcome, 'no_headword');
  assert.equal(sp.surfaceProbeDecision('gikk', lookup('i', [])).outcome, 'no_headword');
});

test('decision: an article of another headword in scope e does not count', () => {
  const d = sp.surfaceProbeDecision('bar', lookup('e', [article('9', 'bære', [['VERB']])]));
  assert.equal(d.outcome, 'no_headword');
});

test('decision: determiner / adverb only -> no_headword (not probed); determiner never split', () => {
  assert.equal(sp.surfaceProbeDecision('hver', lookup('e', [article('1', 'hver', [['DET']])])).outcome, 'no_headword');
  assert.equal(sp.surfaceProbeDecision('fram', lookup('e', [article('2', 'fram', [], { word_class: 'ADV' })])).outcome, 'no_headword');
  const mixed = sp.surfaceProbeDecision('all', lookup('e', [article('3', 'all', [['DET']]), article('4', 'all', [['NOUN']])]));
  assert.deepEqual(mixed.pos, ['noun']);
});

test('decision: indeclinable noun (paradigm without forms) and word_class fallback are read', () => {
  const noForms = article('56059', 'spille', [['NOUN', 'Neuter']]);
  assert.deepEqual(sp.surfaceProbeDecision('spille', lookup('e', [noForms])).pos, ['noun']);
  const wc = article('7', 'lever', [], { word_class: 'NOUN' });
  assert.deepEqual(sp.surfaceProbeDecision('lever', lookup('e', [wc])).pos, ['noun']);
});

test('decision: any article that could not be read -> retry (Ordbøkene did not answer)', () => {
  const d = sp.surfaceProbeDecision('bar', lookup('e', [article('1', 'bar', [['NOUN']])],
    [{ dictionaryCode: 'bm', articleId: '2', url: 'u', message: 'HTTP 502' }]));
  assert.equal(d.outcome, 'retry');
});

const closed = (reason: string, extra: Record<string, unknown> = {}) => ({ status: 'done', current_stage: 'admission_gate',
  promotion_status: 'not_promoted', admission_status: 'rejected', admission_reason: reason, ...extra });

test('gate: a closed probe is neither review nor blocker; a waiting probe is not closed', () => {
  for (const r of ['surface_probe_split', 'surface_probe_no_headword', 'surface_probe_lookup_failed']) {
    assert.equal(rd.isSurfaceProbeItem(closed(r)), true, r);
    assert.equal(rd.isGateReviewItem(closed(r)), false, r);
    assert.equal(rd.isFunctionWordItem(closed(r)), false, r);
  }
  assert.equal(rd.isSurfaceProbeItem({ status: 'pending', current_stage: 'surface_probe' }), false);
  assert.equal(rd.isSurfaceProbeItem(closed('NO_CONFIRMED_WHOLE_UNIT_REGISTRATION')), false);
  assert.equal(rd.isSurfaceProbeItem(closed('surface_probe_split', { admission_status: 'pos_unverified' })), false);
});
