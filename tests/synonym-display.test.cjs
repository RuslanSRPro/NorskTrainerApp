const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, overrides = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => overrides[name] ?? require(name), m, m.exports);
  return m.exports;
}
const policy = load('services/synonymPresentation.ts');

test('group title names the source word',()=>{
  assert.equal(policy.sourceMeaningsTitle('ta','ua'),'Значення слова «ta»');
});

test('three classes, historical unknown, both one-way orientations', () => {
  assert.equal(policy.synonymClass({ decision: 'verified_synonym' }), 'contextual');
  assert.equal(policy.synonymClass({ decision: 'contextual_synonym' }), 'contextual');
  for (const [f, r] of [[true, false], [false, true]])
    assert.equal(policy.synonymClass({ decision: 'contextual_synonym', can_replace_opened: f, can_replace_target: r }), 'one_way');
  assert.equal(policy.synonymClass({ decision: 'verified_synonym', same_construction:true, can_replace_opened: true, can_replace_target: true, same_construction: false }), 'contextual');
});
test('sense AND category filters; none selected means all classes; empty result stays empty', () => {
  const rows = [{ senseKey: 'a', displayClass: 'strict' }, { senseKey: 'a', displayClass: 'one_way' }, { senseKey: 'b', displayClass: 'contextual' }];
  assert.equal(policy.filterSynonyms(rows, null, []).length, 3);
  assert.equal(policy.filterSynonyms(rows, 'a', []).length, 2);
  assert.equal(policy.filterSynonyms(rows, 'a', ['strict', 'contextual']).length, 1);
  assert.equal(policy.filterSynonyms(rows, 'a', ['contextual']).length, 0);
});
test('strict-only views keep separate meanings and exclude contextual groups', async () => {
  const rows = [
    { card_id: 'god-id', lemma: 'god', pair_id: 'p1', my_sense_key: 's1', my_sense: 'size', my_sense_path: '1', my_sense_ord: 1,
      their_sense: 'stor, romslig', their_sense_uk: 'великий', their_sense_en: 'ample', decision: 'verified_synonym', same_construction:true, can_replace_opened: true, can_replace_target: true },
    { card_id: 'god-id', lemma: 'god', pair_id: 'p2', my_sense_key: 's2', my_sense: 'quality', my_sense_path: '1', my_sense_ord: 2,
      their_sense: 'bra', their_sense_uk: 'добрий', their_sense_en: 'good', decision: 'verified_synonym', same_construction:true,can_replace_opened:true,can_replace_target:true },
  ];
  rows.push({ ...rows[0], pair_id: 'excluded', my_sense_key: 'context-only', decision: 'contextual_synonym', can_replace_opened: false });
  const canonical = [{ lexeme_id: 'god-id', language_code: 'uk', translation: 'добрий, смачний' }];
  const before = JSON.stringify(canonical);
  const service = load('services/synonymCarousel.ts', {
    './synonymPresentation': policy,
    '@/services/supabase': { supabase: { rpc: async name => ({ data: name === 'get_synonym_carousel_v3' ? rows : canonical, error: null }) } },
  });
  const result = await service.fetchSynonymSenseCarousel('stor-id', 'stor');
  assert.equal(result.items.length, 2);
  assert.notEqual(result.items[0].id, result.items[1].id);
  assert.deepEqual(result.items.map(i => i.cardId), ['god-id', 'god-id']);
  assert.deepEqual(result.items.map(i => i.displayClass), ['strict', 'strict']);
  assert.deepEqual(result.items.map(i => i.translation_en), ['', '']);
  assert.deepEqual(result.items.map(i=>i.translation_ua),['добрий, смачний','добрий, смачний']);
  assert.ok(result.senses.every(s=>!s.uk&&!s.en));
  assert.equal(result.senses.length, 2);
  assert.ok(!result.senses.some(s => s.key === 'context-only'));
  assert.deepEqual(result.senses.map(service.senseLabel), ['1', '2']);
  assert.equal(JSON.stringify(canonical), before);
  assert.match(result.items[0].details, /добрий, смачний/);
  assert.equal(result.items[0].sourceMeaning,'size');
  assert.match(result.items[0].sourceMeaningCaption,/stor/);
});

test('same translation does not collapse different dictionary meanings',async()=>{
  const rows=[{card_id:'same-card',lemma:'word',pair_id:'one',my_sense_key:'sense-1',my_sense:'meaning one',
    my_sense_uk:'однаково',their_sense:'target one',their_sense_uk:'однаково',decision:'verified_synonym',same_construction:true,can_replace_opened:true,can_replace_target:true},
    {card_id:'same-card',lemma:'word',pair_id:'two',my_sense_key:'sense-2',my_sense:'meaning two',
    my_sense_uk:'однаково',their_sense:'target two',their_sense_uk:'однаково',decision:'verified_synonym',same_construction:true,can_replace_opened:true,can_replace_target:true}];
  const service=load('services/synonymCarousel.ts',{'./synonymPresentation':policy,
    '@/services/supabase':{supabase:{rpc:async name=>({data:name==='get_synonym_carousel_v3'?rows:[],error:null})}}});
  const result=await service.fetchSynonymSenseCarousel('source','ta');
  assert.equal(result.items.length,2);assert.equal(result.senses.length,2);
  assert.notEqual(result.items[0].senseKey,result.items[1].senseKey);
});
test('v3 RPC failure does not silently expose legacy unfiltered cards', async () => {
  const service = load('services/synonymCarousel.ts', {
    './synonymPresentation': policy,
    '@/services/supabase': { supabase: { rpc: async name => name === 'get_synonym_carousel_v3' ? { error: { message: 'missing' } } : { data: [] } } },
  });
  await assert.rejects(service.fetchSynonymSenseCarousel('id'), /could not be loaded/);
});
test('sense labels require both languages', () => {
  const labels = load('supabase/functions/synonym-verifier/sense-labels.ts');
  assert.deepEqual(labels.parseSenseAnswer('[{"ref":0,"uk":"великий","en":""}]', [{ key: 'x', lemma: 'god', sense: 'stor, romslig' }]), []);
});
test('verifier guard prevents strict one-way and no-substitution publication', () => {
  const core = load('supabase/functions/synonym-verifier/verifier-core.ts');
  const d = { decision: 'verified_synonym', confidence: .95, matched_definition: 0, pattern: 'same_meaning', substitution_forward: true, substitution_reverse: false, same_construction: true };
  assert.equal(core.applyGuards(d, ['sense']).final, 'contextual_synonym');
  assert.equal(core.applyGuards({ ...d, substitution_forward: false }, ['sense']).final, 'near_synonym');
});
