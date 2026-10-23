export function compilePronounParadigmV1(candidate) {
  if (candidate?.status !== 'source_verified' ||
      candidate?.candidate_code !== 'pronoun.personal.forms.bokmal.paradigm' ||
      candidate?.model_type !== 'grammar_rule' ||
      candidate?.execution_role !== 'morphological_paradigm' ||
      candidate?.disposition !== 'KEEP_GRAMMAR_RUNTIME') {
    throw new Error('PARADIGM_SOURCE_NOT_ADMISSIBLE');
  }
  const match = candidate.statement.match(/paradigmet\s+(.+?)\s+med nominativ og akkusativ/u);
  if (!match) throw new Error('PARADIGM_PAIRS_MISSING');
  const entries = match[1].split(/,\s*/u).map((pair) => {
    const forms = pair.trim().split('/');
    if (forms.length !== 2 || forms.some((form) => !/^[a-zæøå]+$/u.test(form))) {
      throw new Error('PARADIGM_PAIR_INVALID');
    }
    return { lemma: forms[0], nominative: forms[0], accusative: forms[1] };
  });
  if (entries.length !== 9 || new Set(entries.map((entry) => entry.lemma)).size !== entries.length) {
    throw new Error('PARADIGM_COVERAGE_INVALID');
  }
  return Object.freeze({
    source_candidate_id: candidate.candidate_id,
    source_section: candidate.source_section,
    entries: Object.freeze(entries),
  });
}

export function recognizePronounFormV1(paradigm, surface) {
  const value = surface.toLocaleLowerCase('nb-NO');
  const readings = [];
  for (const entry of paradigm.entries) {
    if (entry.nominative === value) readings.push({ lemma: entry.lemma, case: 'Nom' });
    if (entry.accusative === value) readings.push({ lemma: entry.lemma, case: 'Acc' });
  }
  return readings.map((reading) => ({
    ...reading,
    pos: 'pronoun',
    source_candidate_id: paradigm.source_candidate_id,
    source_section: paradigm.source_section,
    status: 'candidate',
  }));
}

export function generatePronounFormV1(paradigm, lemma, grammaticalCase) {
  const entry = paradigm.entries.find((item) => item.lemma === lemma.toLocaleLowerCase('nb-NO'));
  if (!entry || !['Nom', 'Acc'].includes(grammaticalCase)) return null;
  return {
    surface: grammaticalCase === 'Nom' ? entry.nominative : entry.accusative,
    lemma: entry.lemma,
    case: grammaticalCase,
    source_candidate_id: paradigm.source_candidate_id,
    source_section: paradigm.source_section,
  };
}
