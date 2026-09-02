import { buildCanonicalSurfaceDocumentV1 } from './canonical-surface-boundary-v1.ts';
import {
  applyGraphPatchV1,
  assertCanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
  type CanonicalLanguageGraphV1,
  type GraphPatchV1,
  type LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';
import {
  buildCanonicalPhraseCandidateLatticePatchV1,
  summarizeCanonicalPhraseCandidateLatticePatchV1,
  normalizeCanonicalPhraseRuntimeRuleRowsV1,
  type CanonicalPhraseLexicalClassFactV1,
  type CanonicalPhraseRuntimeRuleV1,
  type CanonicalPhraseRelationSpecV1,
} from './canonical-phrase-candidate-lattice-v1.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const AP_RULE: CanonicalPhraseRuntimeRuleV1 = {
  ruleId: 'rule-ap',
  ruleCode: 'nrg_rt_v1.structural.adjective_phrase.adjective_head',
  runtimeFamily: 'adjective_phrase',
  executionPhase: 'phrase_build',
  patternType: 'phrase_pattern',
  constraintStrength: 'categorical',
  pattern: {
    bindings: {
      head: {
        scope: 'sentence',
        entity: 'candidate',
        cardinality: 'one_or_more',
        where: { op: 'eq', left: { ref: 'head.pos' }, right: 'adjective' },
      },
    },
    head_ref: 'head',
    phrase_type: 'AP',
    build_strategy: 'head_only',
  },
  sourceCandidateCodes: ['adjective_phrase.structure.head.required'],
  sourceSections: ['5.3'],
};


const AP_PREDEPENDENT_OF_NP: CanonicalPhraseRelationSpecV1 = {
  relation: 'predependent_of_np',
  sourcePhraseType: 'AP',
  targetPhraseType: 'NP',
  position: 'left',
  sourceCandidateCodes: ['test.source.ap_predependent_np'],
  sourceSections: ['test'],
};

const NP_RULE: CanonicalPhraseRuntimeRuleV1 = {
  ruleId: 'rule-np',
  ruleCode: 'nrg_rt_v1.structural.noun_phrase.noun_head',
  runtimeFamily: 'noun_phrase',
  executionPhase: 'phrase_build',
  patternType: 'phrase_pattern',
  constraintStrength: 'default',
  pattern: {
    bindings: {
      head: {
        scope: 'sentence',
        entity: 'candidate',
        cardinality: 'one_or_more',
        where: { op: 'eq', left: { ref: 'head.pos' }, right: 'noun' },
      },
    },
    head_ref: 'head',
    phrase_type: 'NP',
    build_strategy: 'head_plus_left_dependents',
    max_left_tokens: 2,
    allowed_left_dependents: ['indefinite_article', 'AP'],
  },
  sourceCandidateCodes: ['noun_phrase.structure.noun_head_default'],
  sourceSections: ['3.3'],
};

function tokenBySurface(graph: CanonicalLanguageGraphV1, surface: string, occurrence = 0): LanguageGraphNodeV1 {
  const matches = graph.nodes.filter((n) => n.type === 'token' && n.features.surface === surface);
  const node = matches[occurrence];
  if (!node) throw new Error(`token not found: ${surface}[${occurrence}]`);
  return node;
}

function posPatch(graph: CanonicalLanguageGraphV1, rows: Array<{ surface: string; pos: string; suffix?: string }>): GraphPatchV1 {
  const nodes: LanguageGraphNodeV1[] = rows.map((row, i) => {
    const token = tokenBySurface(graph, row.surface);
    const id = `poscand:${token.id}:${row.pos}:${row.suffix ?? i}`;
    return {
      id,
      type: 'lexical_reading',
      subtype: 'pos_candidate',
      status: 'candidate',
      span: { ...token.span },
      features: { pos: row.pos },
      producer: 'canonical_candidate_lattice_v1',
      evidenceIds: [`evidence:${id}`],
      provenanceIds: ['prov:test:pos'],
    };
  });
  return {
    producer: 'canonical_candidate_lattice_v1',
    producerVersion: '1',
    nodes,
    evidence: nodes.map((n) => ({
      id: n.evidenceIds[0],
      kind: 'lexical',
      status: 'supports',
      targetIds: [n.id],
      payload: { test: true },
      producer: 'canonical_candidate_lattice_v1',
      provenanceIds: ['prov:test:pos'],
    })),
    provenance: [{ id: 'prov:test:pos', sourceType: 'system', sourceId: 'test' }],
  };
}

function buildGraph(text: string, pos: Array<{ surface: string; pos: string; suffix?: string }>) {
  const surface = buildCanonicalSurfaceDocumentV1(text);
  let graph = createCanonicalLanguageGraphV1(surface);
  graph = applyGraphPatchV1(graph, posPatch(graph, pos));
  return graph;
}

Deno.test('v1.43 AP: adjective POS candidate creates candidate AP, never auto-resolved', () => {
  const graph = buildGraph('stor', [{ surface: 'stor', pos: 'adjective' }]);
  const patch = buildCanonicalPhraseCandidateLatticePatchV1(graph, [AP_RULE]);
  const summary = summarizeCanonicalPhraseCandidateLatticePatchV1(patch);
  assert(summary.phraseNodes === 1, `phraseNodes=${summary.phraseNodes}`);
  assert(summary.phraseTypes.AP === 1, `AP=${summary.phraseTypes.AP}`);
  assert(summary.resolvedFacts === 0, `resolvedFacts=${summary.resolvedFacts}`);
  assert((patch.alternativeSets ?? []).length === 1, 'AP alternative set missing');
  assert((patch.alternativeSets ?? [])[0].status === 'open', 'AP alt set must stay open');
});

Deno.test('v1.43 NP: noun POS candidate creates head-only candidate NP', () => {
  const graph = buildGraph('bil', [{ surface: 'bil', pos: 'noun' }]);
  const patch = buildCanonicalPhraseCandidateLatticePatchV1(graph, [NP_RULE]);
  const np = (patch.nodes ?? []).filter((n) => n.type === 'phrase' && n.subtype === 'NP');
  assert(np.length === 1, `NP count=${np.length}`);
  assert(np[0].span?.tokenIds?.length === 1, 'head-only NP expected');
  assert(np[0].status === 'candidate', 'NP must remain candidate');
});

Deno.test('v1.43 ambiguity: noun+adjective POS candidates may coexist as NP and AP', () => {
  const graph = buildGraph('test', [
    { surface: 'test', pos: 'noun', suffix: 'noun' },
    { surface: 'test', pos: 'adjective', suffix: 'adj' },
  ]);
  const patch = buildCanonicalPhraseCandidateLatticePatchV1(graph, [AP_RULE, NP_RULE]);
  const types = new Set((patch.nodes ?? []).filter((n) => n.type === 'phrase').map((n) => n.subtype));
  assert(types.has('AP'), 'AP candidate missing');
  assert(types.has('NP'), 'NP candidate missing');
  assert((patch.nodes ?? []).every((n) => n.status === 'candidate'), 'no phrase may auto-resolve');
});

Deno.test('v1.43 NP structural alternatives: AP+noun does not replace head-only NP', () => {
  const graph = buildGraph('stor bil', [
    { surface: 'stor', pos: 'adjective' },
    { surface: 'bil', pos: 'noun' },
  ]);
  const patch = buildCanonicalPhraseCandidateLatticePatchV1(graph, [AP_RULE, NP_RULE], [], [AP_PREDEPENDENT_OF_NP]);
  const nps = (patch.nodes ?? []).filter((n) => n.type === 'phrase' && n.subtype === 'NP');
  assert(nps.length === 2, `NP alternatives=${nps.length}`);
  assert(nps.some((n) => n.span?.tokenIds?.length === 1), 'head-only NP missing');
  assert(nps.some((n) => n.span?.tokenIds?.length === 2), 'AP+noun NP missing');
  const alt = (patch.alternativeSets ?? []).find((a) => a.memberIds.some((id) => nps.some((n) => n.id === id)));
  assert(alt?.memberIds.length === 2, `NP alt members=${alt?.memberIds.length}`);
  assert((patch.edges ?? []).some((e) => e.relation === 'predependent_of_np'), 'predependent_of_np missing');
});

Deno.test('v1.43 optional lexical-class evidence enables article+AP+noun without word hardcode', () => {
  const graph = buildGraph('en stor bil', [
    { surface: 'stor', pos: 'adjective' },
    { surface: 'bil', pos: 'noun' },
  ]);
  const article = tokenBySurface(graph, 'en');
  const facts: CanonicalPhraseLexicalClassFactV1[] = [{
    id: 'lexclass:test:article',
    tokenId: article.id,
    classCode: 'indefinite_article',
    status: 'candidate',
    evidenceIds: ['evidence:lexclass:test:article'],
    provenanceIds: ['prov:test:lexclass'],
  }];
  const patch = buildCanonicalPhraseCandidateLatticePatchV1(graph, [AP_RULE, NP_RULE], facts, [AP_PREDEPENDENT_OF_NP]);
  const nps = (patch.nodes ?? []).filter((n) => n.type === 'phrase' && n.subtype === 'NP');
  assert(nps.some((n) => n.span?.tokenIds?.length === 3), 'article+AP+noun candidate missing');
});

Deno.test('v1.43 sentence boundary: left expansion never crosses sentences', () => {
  const graph = buildGraph('stor. bil', [
    { surface: 'stor', pos: 'adjective' },
    { surface: 'bil', pos: 'noun' },
  ]);
  const patch = buildCanonicalPhraseCandidateLatticePatchV1(graph, [AP_RULE, NP_RULE]);
  const nps = (patch.nodes ?? []).filter((n) => n.type === 'phrase' && n.subtype === 'NP');
  assert(nps.length === 1, `cross-sentence NP candidate generated: ${nps.length}`);
  assert(nps[0].span?.tokenIds?.length === 1, 'NP crossed sentence boundary');
});

Deno.test('v1.43 graph invariants: phrase patch has no dangling canonical edges', () => {
  const graph0 = buildGraph('en stor bil', [
    { surface: 'stor', pos: 'adjective' },
    { surface: 'bil', pos: 'noun' },
  ]);
  const article = tokenBySurface(graph0, 'en');
  const patch = buildCanonicalPhraseCandidateLatticePatchV1(graph0, [AP_RULE, NP_RULE], [{
    id: 'lexclass:test:article',
    tokenId: article.id,
    classCode: 'indefinite_article',
    status: 'candidate',
  }], [AP_PREDEPENDENT_OF_NP]);
  const graph = applyGraphPatchV1(graph0, patch);
  const errors = assertCanonicalLanguageGraphV1(graph);
  assert(errors.length === 0, `graph invariant errors: ${errors.join(', ')}`);
});

Deno.test('v1.43 deterministic: identical input produces identical patch', () => {
  const graph = buildGraph('stor bil', [
    { surface: 'stor', pos: 'adjective' },
    { surface: 'bil', pos: 'noun' },
  ]);
  const a = buildCanonicalPhraseCandidateLatticePatchV1(graph, [AP_RULE, NP_RULE]);
  const b = buildCanonicalPhraseCandidateLatticePatchV1(graph, [AP_RULE, NP_RULE]);
  assert(JSON.stringify(a) === JSON.stringify(b), 'phrase patch must be deterministic');
});


Deno.test('v1.43 Runtime IR binding: exact live NP/AP snapshot preserves manifest and rule provenance', () => {
  const rows = [
    {
      rule_id: 'fca3bded-e47c-49a6-a94c-5fdbe3b4677c',
      manifest_code: 'ir.structural.adjective_phrase.adjective_head',
      runtime_family: 'adjective_phrase',
      execution_phase: 'phrase_build',
      constraint_strength: 'categorical',
      rule_code: 'nrg_rt_v1.structural.adjective_phrase.adjective_head',
      pattern_type: 'phrase_pattern',
      pattern: {
        bindings: { head: { scope: 'sentence', entity: 'candidate', cardinality: 'one_or_more', where: { op: 'eq', left: { ref: 'head.pos' }, right: 'adjective' } } },
        head_ref: 'head',
        condition: { op: 'exists', left: { ref: 'head.id' } },
        phrase_type: 'AP',
        build_strategy: 'head_only',
        runtime_ir_version: '1.0',
      },
      actions: [{ value: { phrase_type: 'AP' }, action: 'create_phrase', target: 'head', reason_code: 'nrg_adjective_phrase_head' }, { value: { phrase_type: 'AP' }, action: 'set_head', target: 'head', reason_code: 'nrg_adjective_head_required' }],
      compiler_version: 'grammar-runtime-compiler-structural-v1',
      compile_hash: 'b1e97b2c1091ec6b0081d74ec9fbf4297fbba5f2c515e1695f3b2a7a127d3f87',
      manifest_sources: [
        { title: 'Kjerneordets ordklasse bestemmer frasetypen', status: 'source_verified', candidate_id: '428fa51f-69c1-43a2-a7a0-0a60cfe3a76c', candidate_code: 'grammar.foundations.phrase.type_from_head', source_section: '1.4.1' },
        { title: 'Adjektivet er kjernen i adjektivfrasen', status: 'source_verified', candidate_id: '6e020322-7621-46c1-888b-9912950f94b7', candidate_code: 'adjective_phrase.structure.head.required', source_section: '5.3' },
      ],
      rule_sources: [
        { title: 'Adjektivet er kjernen i adjektivfrasen', status: 'source_verified', candidate_id: '6e020322-7621-46c1-888b-9912950f94b7', candidate_code: 'adjective_phrase.structure.head.required', source_section: '5.3' },
      ],
    },
    {
      rule_id: '2ba2cf3a-5570-455f-a689-4e488da11c6f',
      manifest_code: 'ir.structural.noun_phrase.noun_head',
      runtime_family: 'noun_phrase',
      execution_phase: 'phrase_build',
      constraint_strength: 'default',
      rule_code: 'nrg_rt_v1.structural.noun_phrase.noun_head',
      pattern_type: 'phrase_pattern',
      pattern: {
        bindings: { head: { scope: 'sentence', entity: 'candidate', cardinality: 'one_or_more', where: { op: 'eq', left: { ref: 'head.pos' }, right: 'noun' } } },
        head_ref: 'head',
        condition: { op: 'exists', left: { ref: 'head.id' } },
        phrase_type: 'NP',
        build_strategy: 'head_plus_left_dependents',
        max_left_tokens: 2,
        allowed_left_dependents: ['indefinite_article', 'AP'],
        runtime_ir_version: '1.0',
      },
      actions: [{ value: { phrase_type: 'NP' }, action: 'create_phrase', target: 'head', reason_code: 'nrg_noun_head_default' }, { value: { phrase_type: 'NP' }, action: 'set_head', target: 'head', reason_code: 'nrg_noun_phrase_head' }],
      compiler_version: 'grammar-runtime-compiler-structural-v1',
      compile_hash: 'edf681761fe71a6033aad6a753ff2a55d4908f42a15373e63f24e32638fc3884',
      manifest_sources: [
        { title: 'Kjerneordets ordklasse bestemmer frasetypen', status: 'source_verified', candidate_id: '428fa51f-69c1-43a2-a7a0-0a60cfe3a76c', candidate_code: 'grammar.foundations.phrase.type_from_head', source_section: '1.4.1' },
        { title: 'Substantivfrasen kan bestå av kjerne alene eller kjerne med adledd', status: 'source_verified', candidate_id: 'b4e4b740-c650-4936-ad42-908a90ed5b15', candidate_code: 'noun_phrase.structure.core_schema', source_section: '3.3' },
        { title: 'Substantivfrasen har normalt substantiv som kjerne', status: 'source_verified', candidate_id: '480ef100-7072-4c49-91d0-b846a836c691', candidate_code: 'noun_phrase.structure.noun_head_default', source_section: '3.3' },
      ],
      rule_sources: [
        { title: 'Substantivfrasen har normalt substantiv som kjerne', status: 'source_verified', candidate_id: '480ef100-7072-4c49-91d0-b846a836c691', candidate_code: 'noun_phrase.structure.noun_head_default', source_section: '3.3' },
      ],
    },
  ];

  const rules = normalizeCanonicalPhraseRuntimeRuleRowsV1(rows);
  assert(rules.length === 2, `normalized rules=${rules.length}`);
  const ap = rules.find((r) => r.pattern.phrase_type === 'AP');
  const np = rules.find((r) => r.pattern.phrase_type === 'NP');
  assert(ap, 'live AP rule missing');
  assert(np, 'live NP rule missing');
  assert(JSON.stringify(ap.ruleSourceCandidateCodes) === JSON.stringify(['adjective_phrase.structure.head.required']), `AP direct sources=${JSON.stringify(ap.ruleSourceCandidateCodes)}`);
  assert((ap.manifestSourceCandidateCodes ?? []).includes('grammar.foundations.phrase.type_from_head'), 'AP manifest foundation source missing');
  assert(JSON.stringify(np.ruleSourceCandidateCodes) === JSON.stringify(['noun_phrase.structure.noun_head_default']), `NP direct sources=${JSON.stringify(np.ruleSourceCandidateCodes)}`);
  assert((np.manifestSourceCandidateCodes ?? []).includes('noun_phrase.structure.core_schema'), 'NP core schema manifest source missing');
  assert((np.sourceRefs ?? []).some((ref) => ref.candidateCode === 'noun_phrase.structure.noun_head_default' && ref.bindingLevel === 'rule'), 'NP rule-level source ref missing');
  assert((np.sourceRefs ?? []).some((ref) => ref.candidateCode === 'noun_phrase.structure.noun_head_default' && ref.bindingLevel === 'manifest'), 'NP manifest-level source ref missing');

  const graph = buildGraph('stor bil', [
    { surface: 'stor', pos: 'adjective' },
    { surface: 'bil', pos: 'noun' },
  ]);
  const patch = buildCanonicalPhraseCandidateLatticePatchV1(graph, rules);
  assert((patch.nodes ?? []).some((n) => n.type === 'phrase' && n.subtype === 'AP'), 'AP candidate missing from exact live row contract');
  assert((patch.nodes ?? []).some((n) => n.type === 'phrase' && n.subtype === 'NP'), 'NP candidate missing from exact live row contract');
  assert((patch.nodes ?? []).every((n) => n.status === 'candidate'), 'live Runtime IR binding must not auto-resolve phrases');
  const npEvidence = (patch.evidence ?? []).find((e) => e.payload.phraseType === 'NP');
  assert(npEvidence, 'NP source evidence missing');
  assert(Array.isArray(npEvidence.payload.sourceRefs), 'NP evidence must preserve sourceRefs');
  assert((npEvidence.payload.sourceRefs as Array<{ bindingLevel?: string }>).some((ref) => ref.bindingLevel === 'manifest'), 'NP evidence lost manifest-level provenance');
  assert((npEvidence.payload.sourceRefs as Array<{ bindingLevel?: string }>).some((ref) => ref.bindingLevel === 'rule'), 'NP evidence lost rule-level provenance');
});
