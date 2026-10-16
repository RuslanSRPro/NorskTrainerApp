// D10 compound words. Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-compound/compound_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// The worker imports supabase-js from esm.sh (Deno). Node gets a stub; the
// tests pass their own fake client.
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://esm.sh/')) {
    return { url: 'data:text/javascript,export const createClient=()=>{throw new Error("stub")}', shortCircuit: true };
  }
  return next(specifier, context);
}`));

const split = await import('../../_shared/d10-compound-split.ts');
const worker = await import('../../compound-head-forms-worker/index.ts');
const promoter = await import('../../compound-candidate-promoter/lexeme-mode.ts');

// ---------------------------------------------------------------- fake db
type Row = Record<string, any>;
function fakeDb(tables: Record<string, Row[]>, rpcImpl: (name: string, args: any) => any) {
  const calls: Array<{ name: string; args: any }> = [];
  function from(table: string) {
    let rows = [...(tables[table] ?? [])];
    let headCount = false;
    const q: any = {
      select(_cols: string, opts?: { count?: string; head?: boolean }) { headCount = !!opts?.head; return q; },
      eq(col: string, v: any) { rows = rows.filter((r) => r[col] === v); return q; },
      in(col: string, vs: any[]) { rows = rows.filter((r) => vs.includes(r[col])); return q; },
      ilike(col: string, v: string) { rows = rows.filter((r) => String(r[col]).toLowerCase() === v.toLowerCase()); return q; },
      limit(n: number) { rows = rows.slice(0, n); return q; },
      then(res: any, rej: any) {
        return Promise.resolve(headCount ? { data: null, count: rows.length, error: null } : { data: rows, count: rows.length, error: null }).then(res, rej);
      },
    };
    return q;
  }
  return {
    calls,
    client: {
      from,
      rpc: async (name: string, args: any) => { calls.push({ name, args }); return rpcImpl(name, args); },
    } as any,
  };
}
const JAKKE = 'j1';
const forms = (id: string, lemma: string, pos: string, values: Record<string, string[]>) =>
  Object.entries(values).map(([form_key, primary_values]) => ({
    lexeme_id: id, lemma, pos, dictionary_code: 'bm', form_key, primary_values, alternative_values: [],
  }));
const baseTables = () => ({
  lexemes: [{ id: JAKKE, lemma: 'jakke', pos: 'noun' }, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' }],
  lexeme_form_display_v2: forms(JAKKE, 'jakke', 'noun', {
    ubest_entall: ['jakke'], best_entall: ['jakka', 'jakken'], ubest_flertall: ['jakker'], best_flertall: ['jakkene'],
  }),
  lexeme_source_checks: [
    { lexeme_id: 'v1', source: 'Ordbokene', status: 'partial', found: false },
    { lexeme_id: 'v1', source: 'NAOB', status: 'done', found: true },
    { lexeme_id: JAKKE, source: 'Ordbokene', status: 'done', found: true },
  ],
});
const ordbokene = (known: string[], calls: string[] = []) => async (url: string) => {
  const w = new URL(url).searchParams.get('w')!;
  calls.push(w);
  return new Response(JSON.stringify({ articles: { bm: known.includes(w) ? [1] : [] } }), { status: 200 });
};
const okRpc = (name: string) => name === 'd10_write_compound_analysis_v1' ? { data: 'written', error: null }
  : name === 'd10_publish_compound_head_forms_v1' ? { data: 4, error: null } : { data: null, error: null };

// ---------------------------------------------------------------- split rule
test('enumerate: links s/e only after a real first part', () => {
  const c = split.enumerateSplits('barnehage');
  assert.ok(c.some((x: any) => x.base === 'barn' && x.link === 'e' && x.head === 'hage'));
  assert.ok(c.some((x: any) => x.base === 'barne' && x.link === '' && x.head === 'hage'));
  assert.equal(split.enumerateSplits('e-post').length, 0);
});

test('worker: vinterjakke -> vinter + jakke, forms published', async () => {
  const db = fakeDb(baseTables(), okRpc);
  const looked: string[] = [];
  const r = await worker.processLexeme(db.client, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' }, ordbokene(['vinter', 'vin'], looked));
  assert.equal(r.status, 'split_with_forms');
  const w = db.calls.find((c) => c.name === 'd10_write_compound_analysis_v1')!;
  assert.deepEqual(w.args.p_parts, ['vinter', 'jakke']);
  assert.deepEqual(w.args.p_links, ['']);
  assert.equal(w.args.p_source, 'dictionary_split');
  const p = db.calls.find((c) => c.name === 'd10_publish_compound_head_forms_v1')!;
  assert.deepEqual(p.args.p_head_lexeme_ids, [JAKKE]);
  assert.deepEqual(looked, ['vinter']); // only the cut whose head is a card
});

test('worker: word with own forms is left alone', async () => {
  const t = baseTables();
  t.lexeme_form_display_v2.push(...forms('v1', 'vinterjakke', 'noun', { ubest_entall: ['vinterjakke'] }));
  const db = fakeDb(t, okRpc);
  const r = await worker.processLexeme(db.client, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' }, ordbokene(['vinter']));
  assert.equal(r.status, 'own_forms');
  assert.equal(db.calls.length, 0);
});

test('worker: Ordbøkene not answered (outage) -> nothing', async () => {
  const t = baseTables();
  t.lexeme_source_checks[0].status = 'error';
  const db = fakeDb(t, okRpc);
  const r = await worker.processLexeme(db.client, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' }, ordbokene(['vinter']));
  assert.equal(r.status, 'ordbokene_not_confirmed_missing');
  assert.equal(db.calls.length, 0);
});

test('worker: NAOB does not know the word -> nothing', async () => {
  const t = baseTables();
  t.lexeme_source_checks[1].found = false;
  const db = fakeDb(t, okRpc);
  const r = await worker.processLexeme(db.client, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' }, ordbokene(['vinter']));
  assert.equal(r.status, 'not_confirmed_by_naob');
});

test('worker: first part not a headword -> no split', async () => {
  const db = fakeDb(baseTables(), okRpc);
  const r = await worker.processLexeme(db.client, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' }, ordbokene([]));
  assert.equal(r.status, 'no_split');
  assert.equal(db.calls.length, 0);
});

test('worker: two valid splits -> review, nothing written', async () => {
  const t = baseTables();
  t.lexemes.push({ id: 'k1', lemma: 'terjakke', pos: 'noun' });
  t.lexeme_form_display_v2.push(...forms('k1', 'terjakke', 'noun', { ubest_entall: ['terjakke'] }));
  const db = fakeDb(t, okRpc);
  const r = await worker.processLexeme(db.client, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' }, ordbokene(['vinter', 'vin']));
  assert.equal(r.status, 'review');
  assert.deepEqual(db.calls.map((c) => c.name), ['d10_record_compound_review_v1']);
});

test('worker: head homographs with other forms -> review', async () => {
  const t = baseTables();
  t.lexemes.push({ id: 'j2', lemma: 'jakke', pos: 'noun' });
  t.lexeme_form_display_v2.push(...forms('j2', 'jakke', 'noun', { ubest_entall: ['jakke'], ubest_flertall: ['jakkar'] }));
  const db = fakeDb(t, okRpc);
  const r = await worker.processLexeme(db.client, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' }, ordbokene(['vinter']));
  assert.equal(r.status, 'review');
  assert.equal((r.detail as any).reason, 'head_homographs_differ');
});

test('worker: head of another POS is not used', async () => {
  const t = baseTables();
  t.lexeme_form_display_v2 = t.lexeme_form_display_v2.map((r: Row) => ({ ...r, pos: 'verb' }));
  const db = fakeDb(t, okRpc);
  const r = await worker.processLexeme(db.client, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' }, ordbokene(['vinter']));
  assert.equal(r.status, 'no_split');
});

test('worker: Ordbøkene 502 on the first part -> error, nothing written', async () => {
  const db = fakeDb(baseTables(), okRpc);
  await assert.rejects(() => worker.processLexeme(db.client, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' },
    async () => new Response('x', { status: 502 })), /HTTP 502/);
  assert.equal(db.calls.length, 0);
});

test('worker: first part known in our base -> no live lookup', async () => {
  const t = baseTables();
  t.lexemes.push({ id: 'w1', lemma: 'vinter', pos: 'noun' });
  t.lexeme_source_checks.push({ lexeme_id: 'w1', source: 'Ordbokene', status: 'done', found: true });
  const db = fakeDb(t, okRpc);
  const looked: string[] = [];
  const r = await worker.processLexeme(db.client, { id: 'v1', lemma: 'vinterjakke', pos: 'noun' }, ordbokene([], looked));
  assert.equal(r.status, 'split_with_forms');
  assert.deepEqual(looked, []);
});

test('worker: link -s- (arbeidsjakke = arbeid + s + jakke)', async () => {
  const t = baseTables();
  t.lexemes.push({ id: 'a1', lemma: 'arbeidsjakke', pos: 'noun' });
  t.lexeme_source_checks.push({ lexeme_id: 'a1', source: 'Ordbokene', status: 'done', found: false },
    { lexeme_id: 'a1', source: 'NAOB', status: 'done', found: true });
  const db = fakeDb(t, okRpc);
  const r = await worker.processLexeme(db.client, { id: 'a1', lemma: 'arbeidsjakke', pos: 'noun' }, ordbokene(['arbeid']));
  assert.equal(r.status, 'split_with_forms');
  const w = db.calls.find((c) => c.name === 'd10_write_compound_analysis_v1')!;
  assert.deepEqual(w.args.p_parts, ['arbeid', 'jakke']);
  assert.deepEqual(w.args.p_links, ['s']);
});

// ---------------------------------------------------------------- NAOB
test('annet ledd: sykehus -> syke + hus', () => {
  assert.deepEqual(split.naobAnnetLeddParts('sykehus', 'annet ledd hus'), { parts: ['syke', 'hus'], links: [''] });
  assert.equal(split.naobAnnetLeddParts('sykehus', 'annet ledd sted'), null);
  assert.equal(split.naobAnnetLeddParts('hus', 'annet ledd hus'), null);
  assert.equal(split.naobAnnetLeddParts('sykehus', 'annet ledd'), null);
});

test('promoter lexeme mode: sammensatt av + annet ledd + unusable', async () => {
  const rels = [
    { id: 'r1', source_entity_type: 'lexeme', source_entity_id: 'b1', target_text: 'barn og hage', source: 'NAOB', confidence: 'medium', evidence: {} },
    { id: 'r2', source_entity_type: 'lexeme', source_entity_id: 's1', target_text: 'annet ledd hus', source: 'NAOB', confidence: 'medium', evidence: {} },
    { id: 'r3', source_entity_type: 'lexeme', source_entity_id: 's1', target_text: 'tysk krankenhaus', source: 'NAOB', confidence: 'medium', evidence: {} },
  ];
  const updates: Row[] = [];
  const written: Row[] = [];
  const client: any = {
    rpc: async (name: string, args: any) => {
      if (name === 'd10_compound_candidates_for_lexemes_v1') return { data: rels, error: null };
      if (name === 'd10_write_compound_analysis_v1') { written.push(args); return { data: 'written', error: null }; }
      return { data: null, error: { message: 'unexpected ' + name } };
    },
    from: (table: string) => ({
      select: () => ({ in: async () => ({ data: [{ id: 'b1', lemma: 'barnehage' }, { id: 's1', lemma: 'sykehus' }], error: null }) }),
      update: (row: Row) => ({ eq: async (_c: string, id: string) => { updates.push({ table, id, ...row }); return { error: null }; } }),
    }),
  };
  const out = await promoter.promoteForLexemes(client, ['b1', 's1']);
  assert.deepEqual(written.map((w) => [w.p_parts, w.p_links, w.p_source]), [
    [['barn', 'hage'], ['e'], 'naob_sammensatt'],
    [['syke', 'hus'], [''], 'naob_annet_ledd'],
  ]);
  assert.deepEqual(updates.map((u) => [u.id, u.status]), [['r1', 'promoted'], ['r2', 'promoted'], ['r3', 'needs_review']]);
  assert.equal(out.promoted, 2);
  assert.equal(out.needs_review, 1);
});
