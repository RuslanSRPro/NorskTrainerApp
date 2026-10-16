import {assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  needsNeighbours,
  neighbourPos,
  normalizeSurface,
  selectByContext,
  type SurfaceCandidateV2,
} from '../../analyze-text/surface-resolver-v2.ts';

function row(id: string, lemma: string, pos: string, formType = 'base', source = 'lexemes'): SurfaceCandidateV2 {
  return {
    lexeme_id: id, lemma, pos,
    form_types: [formType], sources: [source],
    evidence: [{source, form_type: formType, confidence: 'high', grammatical_features: {resolver: source}}],
    base_confidence: 'high', base_priority: 95,
  };
}

const ctx = (prevToken: string | null, nextToken: string | null, inf = false) =>
  ({prevToken, nextToken, precededByInfinitiveMarker: inf});

Deno.test('single POS candidate is returned with its V2 form type', () => {
  const out = selectByContext([row('g', 'gå', 'verb', 'past', 'lexeme_form_display_v2')], ctx('han', 'hjem'), neighbourPos(null, null));
  assertEquals(out.length, 1);
  assertEquals([out[0].lemma, out[0].pos, out[0].form_type, out[0].source], ['gå', 'verb', 'past', 'lexeme_form_display_v2']);
});

Deno.test('no neighbours: all POS candidates are returned (word list)', () => {
  const out = selectByContext([row('v', 'få', 'verb'), row('a', 'få', 'adjective')], ctx(null, null), neighbourPos(null, null));
  assertEquals(out.map((r) => r.pos), ['verb', 'adjective']);
  assertEquals(out[0].confidence, 'medium');
});

Deno.test('legacy context rules pick one POS in running text', () => {
  const both = [row('v', 'møte', 'verb'), row('n', 'møte', 'noun')];
  assertEquals(selectByContext(both, ctx('å', 'deg', true), neighbourPos(null, null))[0].pos, 'verb');
  assertEquals(selectByContext(both, ctx('vil', 'deg'), neighbourPos(null, null))[0].pos, 'verb');
  assertEquals(selectByContext(both, ctx('jeg', 'deg'), neighbourPos(null, null))[0].pos, 'verb');
  const adjAdv = [row('j', 'fin', 'adjective'), row('d', 'fin', 'adverb')];
  assertEquals(selectByContext(adjAdv, ctx('er', 'nå'), neighbourPos(null, null))[0].pos, 'adjective');
  assertEquals(selectByContext(adjAdv, ctx('et', 'hus'), neighbourPos([row('x', 'et', 'determiner')], [row('h', 'hus', 'noun')]))[0].pos, 'adjective');
  assertEquals(selectByContext([row('n', 'rett', 'noun'), row('d', 'rett', 'adverb')], ctx('gikk', 'hjem'),
    neighbourPos([row('g', 'gå', 'verb')], [row('h', 'hjem', 'adverb')]))[0].pos, 'adverb');
});

Deno.test('fallback order verb > noun > adjective > adverb with low confidence', () => {
  const out = selectByContext([row('n', 'løp', 'noun'), row('v', 'løpe', 'verb')], ctx('et', 'til'), neighbourPos(null, null));
  assertEquals([out.length, out[0].pos, out[0].confidence], [1, 'verb', 'low']);
});

Deno.test('one lexeme per POS, first in resolver order', () => {
  const out = selectByContext([row('n1', 'bank', 'noun'), row('n2', 'bank', 'noun')], ctx('en', 'i'), neighbourPos(null, null));
  assertEquals(out.map((r) => r.lexeme_id), ['n1']);
});

Deno.test('outside the four legacy POS: one exact lexeme, known POS first', () => {
  const out = selectByContext([row('u', 'den', 'unknown'), row('p', 'den', 'pronoun'), row('d', 'den', 'determiner')], ctx('og', 'er'), neighbourPos(null, null));
  assertEquals(out.map((r) => r.lexeme_id), ['p']);
});

Deno.test('function word keeps its own exact lexeme over a V2 form of another lexeme', () => {
  const v2Determiner = row('den', 'den', 'determiner', 'neuter', 'lexeme_form_display_v2');
  const exactPronoun = row('det', 'det', 'pronoun', 'base', 'lexemes');
  const out = selectByContext([v2Determiner, exactPronoun], ctx('og', 'er'), neighbourPos(null, null));
  assertEquals(out.map((r) => r.lexeme_id), ['det']);
});

Deno.test('single POS candidate keeps legacy confidence high', () => {
  const alt = {...row('h', 'hus', 'noun', 'plural_indefinite', 'lexeme_form_display_v2'), base_confidence: 'medium'};
  assertEquals(selectByContext([alt], ctx('to', 'er'), neighbourPos(null, null))[0].confidence, 'high');
});

Deno.test('no candidates: empty (grammar graph hook handles unknown words later)', () => {
  assertEquals(selectByContext([], ctx('a', 'b'), neighbourPos(null, null)), []);
});

Deno.test('neighbour lookups only when adjective/adverb ambiguity needs them', () => {
  assertEquals(needsNeighbours([row('v', 'møte', 'verb'), row('n', 'møte', 'noun')], ctx('a', 'b')), false);
  assertEquals(needsNeighbours([row('j', 'fin', 'adjective'), row('d', 'fin', 'adverb')], ctx('a', 'b')), true);
  assertEquals(needsNeighbours([row('j', 'fin', 'adjective'), row('d', 'fin', 'adverb')], ctx(null, null)), false);
});

Deno.test('normalisation matches normalize_surface_form', () => {
  assertEquals(normalizeSurface('  «Huset!» '), 'huset');
  assertEquals(normalizeSurface('...'), null);
});
