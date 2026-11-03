// D10 synonym verifier, pure parts (prompt, schema, parsing, guards). v3 29.10.2026, v4 30.10.2026.
//   node --experimental-strip-types --test supabase/functions/tests/d10-synonym-verifier/synonym_verifier_core_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGuards, buildPrompt, DECISIONS, geminiText, pairInput, parseDecisions, PATTERNS, PROMPT_VERSION,
  responseSchema, targetDefinitions, verifierVersion } from '../../synonym-verifier/verifier-core.ts';

const pair = (lemma: string, target: string, defs: unknown) => ({
  id: 'p-' + target, lease_token: 't', snapshot_hash: 'h',
  snapshot: { source: { lemma, part_of_speech: 'verb', definition_nb: 'iverksette; realisere', translations: { uk: 'впроваджувати' } },
    target: { lemma: target, part_of_speech: 'verb', definitions_nb: defs, translations: { uk: ['впроваджувати'], en: 'implement' } } },
});
const answer = (o: Record<string, unknown>) => JSON.stringify([{ ref: 0, matched_definition: 0, pattern: 'same_meaning',
  decision: 'verified_synonym', confidence: 0.9, reason: 'r', example_nb: 'Eks.',
  substitution_forward: true, substitution_reverse: true, same_construction: true, additional_restriction: false, source_translation_matches: true, target_translation_matches: true, ...o }]);

test('canonical translations are supplied separately from dictionary sense evidence', () => {
  for (const [lemma, meaning, wrongTranslation, wrongExample] of [
    ['rask', 'sunn, frisk', 'fast', 'gå med raske steg'],
    ['vanskelig', 'umedgjørlig', 'difficult', 'en vanskelig prøve'],
  ]) {
    const p: any = pair(lemma, 'target', ['definition']);
    p.snapshot.source.definition_nb = meaning;
    const clean = pairInput(p, 0);
    p.snapshot.source.translations = { en: wrongTranslation };
    p.snapshot.source.examples_nb = [wrongExample];
    p.snapshot.target.examples_nb = ['unrelated target sense'];
    p.snapshot.target.translations = { en: 'unrelated translation' };
    assert.equal(pairInput(p,0).source.canonical_translations.en,wrongTranslation);
    assert.deepEqual(pairInput(p,0).target.definitions,clean.target.definitions);
    assert.equal(JSON.stringify(pairInput(p,0)).includes(wrongExample),false);
    assert.equal(clean.source.naob_meaning, meaning);
  }
});

test('version names the model', () => {
  assert.equal(PROMPT_VERSION, 'v9');
  assert.equal(verifierVersion('gemini-2.5-flash'), 'ai:synonym_pair_v9:gemini-2.5-flash');
});

test('only dictionary-scoped examples supplement a focused meaning',()=>{
  const p:any=pair('ta','straffe',['gi straff']);
  p.snapshot.source.examples_nb=['ta toget'];
  p.snapshot.source.sense_context={article_id:59502,sense_path:'5',focus_gloss:'straffe',
    group_definitions:['banke opp','straffe'],examples_nb:['bare vent, jeg skal nok ta deg!']};
  const input=pairInput(p,0);
  assert.deepEqual(input.source.dictionary_group?.examples,['bare vent, jeg skal nok ta deg!']);
  assert.equal(JSON.stringify(input).includes('ta toget'),false);
});
test('pair input: numbered definitions; unaligned card translations excluded', () => {
  const x = pairInput(pair('sette i verk', 'iverksette', ['sette i gang;  realisere', '', null, 'gjennomføre']) as any, 3);
  assert.equal(x.ref, 3);
  assert.deepEqual(x.target.definitions, [{ n: 0, text: 'sette i gang; realisere' }, { n: 1, text: 'gjennomføre' }]);
  assert.equal('translations' in x.target, false);
  assert.equal('translations' in x.source, false);
});
test('prompt: steps, all patterns and decisions, the three worked examples', () => {
  const p = buildPrompt([pair('sette i verk', 'iverksette', []), pair('sette i verk', 'realisere', [])] as any);
  assert.match(p, /"ref":0/); assert.match(p, /"ref":1/);
  for (const d of DECISIONS) assert.ok(p.includes(d), d);
  for (const k of PATTERNS) assert.ok(p.includes(k), k);
  assert.match(p, /STEP 1 - matched_definition: read ALL target definitions/);
  assert.match(p, /"gjøre åpen" matches "åpne"/);
  assert.match(p, /matched_definition 1, same_meaning,\s+forward true, reverse true, same_construction true, verified_synonym/);
  assert.match(p, /substitution_forward/); assert.match(p, /All test sentences MUST instantiate/);
});
test('schema: matched_definition and pattern required', () => {
  const s: any = responseSchema();
  assert.equal(s.type, 'ARRAY');
  assert.deepEqual(s.items.properties.pattern.enum, [...PATTERNS]);
  assert.ok(s.items.required.includes('matched_definition'));
  for (const k of ['substitution_forward', 'substitution_reverse', 'same_construction']) {
    assert.equal(s.items.properties[k].type, 'BOOLEAN'); assert.ok(s.items.required.includes(k), k);
  }
});
test('parse: fields, clamped confidence, unknown pattern -> insufficient_data, example only for synonyms', () => {
  const m = parseDecisions(JSON.stringify([
    { ref: 0, matched_definition: 1, pattern: 'same_meaning', decision: 'verified_synonym', confidence: 1.4, reason: 'same', example_nb: 'Vi iverksetter planen.' },
    { ref: 1, matched_definition: -1, pattern: 'xx', decision: 'related', confidence: -1, reason: 'broader', example_nb: 'Skal bort.' },
  ]), 2);
  assert.equal(m.get(0)?.confidence, 1); assert.equal(m.get(0)?.matched_definition, 1);
  assert.equal(m.get(1)?.pattern, 'insufficient_data'); assert.equal(m.get(1)?.example_nb, null);
});
test('parse: unknown ref, duplicate, invalid decision, broken JSON dropped; code fence ok', () => {
  const m = parseDecisions(JSON.stringify([
    { ref: 5, decision: 'related' }, { ref: 0, decision: 'maybe' },
    { ref: 1, decision: 'rejected', matched_definition: -1, pattern: 'target_other_sense' }, { ref: 1, decision: 'verified_synonym' },
  ]), 2);
  assert.deepEqual([...m.keys()], [1]);
  assert.equal(parseDecisions('not json', 2).size, 0);
  assert.equal(parseDecisions('```json\n' + answer({}) + '\n```', 1).size, 1);
});
test('guards: synonym without a matching definition -> manual', () => {
  const d = parseDecisions(answer({ matched_definition: -1 }), 1).get(0)!;
  const g = applyGuards(d, ['være sømmelig']);
  assert.equal(g.final, 'needs_manual_review'); assert.equal(g.guard, 'synonym_without_matching_definition');
});
test('guards: rejected although same meaning with a match -> manual', () => {
  const d = parseDecisions(answer({ decision: 'rejected', matched_definition: 0 }), 1).get(0)!;
  assert.equal(applyGuards(d, ['gjøre åpen']).final, 'needs_manual_review');
});
test('guards: synonym but other sense -> manual; consistent answer kept with matched text', () => {
  const d1 = parseDecisions(answer({ pattern: 'target_other_sense' }), 1).get(0)!;
  assert.equal(applyGuards(d1, ['x']).guard, 'synonym_but_other_sense');
  const d2 = parseDecisions(answer({ matched_definition: 1 }), 1).get(0)!;
  const g2 = applyGuards(d2, ['overrumple, distrahere', 'hindre i å fungere delta']);
  assert.equal(g2.final, 'verified_synonym'); assert.equal(g2.matched_text, 'hindre i å fungere delta');
});
test('guards: index out of range -> -1; no definitions require review', () => {
  const d = parseDecisions(answer({ matched_definition: 7 }), 1).get(0)!;
  const g = applyGuards(d, ['a']);
  assert.equal(g.matched_definition, -1); assert.equal(g.final, 'needs_manual_review');
  const d0 = parseDecisions(answer({ matched_definition: -1 }), 1).get(0)!;
  assert.equal(applyGuards(d0, []).final, 'needs_manual_review');
});
test('target definitions and gemini text helpers', () => {
  assert.deepEqual(targetDefinitions(pair('a', 'b', ['x', '', 'y']) as any), ['x', 'y']);
  assert.equal(geminiText({ candidates: [{ content: { parts: [{ text: '[' }, { text: ']' }] } }] }), '[]');
  assert.equal(geminiText({}), '');
});

test('late dictionary meanings are available for polysemous target words',()=>{
  const definitions=Array.from({length:48},(_,i)=>`meaning ${i}`);
  const p:any=pair('stjele','ta',definitions);
  assert.equal(targetDefinitions(p).length,48);
  assert.equal(pairInput(p,0).target.definitions[35].text,'meaning 35');
});
test('v4 guards: verified needs both ways + same construction', () => {
  const ok = parseDecisions(answer({}), 1).get(0)!;
  assert.equal(applyGuards(ok, ['x']).final, 'verified_synonym');
  const oneWay = parseDecisions(answer({ substitution_reverse: false }), 1).get(0)!;
  const g1 = applyGuards(oneWay, ['x']);
  assert.equal(g1.final, 'contextual_synonym'); assert.equal(g1.guard, 'not_mutually_substitutable');
  const construction = parseDecisions(answer({ same_construction: false }), 1).get(0)!;
  assert.equal(applyGuards(construction, ['x']).final, 'contextual_synonym');
  const none = parseDecisions(answer({ substitution_forward: false, substitution_reverse: false }), 1).get(0)!;
  const g3 = applyGuards(none, ['x']);
  assert.equal(g3.final, 'near_synonym'); assert.equal(g3.example_nb, null);
});
test('v4 guards: contextual without any substitution -> near; missing fields count as false', () => {
  const c = parseDecisions(answer({ decision: 'contextual_synonym', substitution_forward: false, substitution_reverse: false }), 1).get(0)!;
  assert.equal(applyGuards(c, ['x']).final, 'near_synonym');
  const c2 = parseDecisions(answer({ decision: 'contextual_synonym', substitution_reverse: false }), 1).get(0)!;
  assert.equal(applyGuards(c2, ['x']).final, 'contextual_synonym');
  const raw = JSON.stringify([{ ref: 0, matched_definition: 0, pattern: 'same_meaning', decision: 'verified_synonym', confidence: 0.9, reason: 'r', example_nb: 'e' }]);
  const m = parseDecisions(raw, 1).get(0)!;
  assert.equal(m.substitution_forward, false);
  assert.equal(applyGuards(m, ['x']).final, 'near_synonym');
});


test('translation alignment controls publication independently of semantic decision',()=>{
 const d=parseDecisions(answer({}),1).get(0)!;
 assert.equal(applyGuards(d,['meaning']).publication_ready,true);
 for(const key of ['source_translation_matches','target_translation_matches']) {
  const result=applyGuards({...d,[key]:false},['meaning']);
  assert.equal(result.final,'verified_synonym');assert.equal(result.publication_ready,false);
 }
 const narrow=applyGuards({...d,additional_restriction:true},['meaning']);
 assert.equal(narrow.final,'contextual_synonym');assert.equal(narrow.publication_ready,false);
 const inconsistent=applyGuards({...d,decision:'contextual_synonym'},['meaning']);
 assert.equal(inconsistent.final,'needs_manual_review');
 assert.equal(inconsistent.guard,'contextual_without_restriction');
});
