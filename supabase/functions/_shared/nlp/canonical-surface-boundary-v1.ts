// Norsk Trainer — Canonical Surface & Boundary Contract V1
// Language Graph foundation. Pure surface processing only: no Norwegian POS,
// lexeme, syntax, or grammar-rule decisions.

export type SurfaceTokenKind = 'word' | 'number' | 'punctuation' | 'symbol';
export type BoundaryStatus = 'candidate' | 'resolved' | 'rejected' | 'ambiguous';
export type EvidencePolarity = 'support' | 'oppose';

export type SurfaceTokenV1 = {
  id: string;
  documentTokenIndex: number;
  sentenceIndex: number | null;
  sentenceTokenIndex: number | null;
  surface: string;
  normalizedSurface: string;
  startUtf16: number;
  endUtf16: number;
  kind: SurfaceTokenKind;
};

export type AbbreviationBoundaryPolicy = 'never' | 'may' | 'usually_not';

export type AbbreviationFactV1 = {
  id: string;
  surface: string;
  boundaryPolicy: AbbreviationBoundaryPolicy;
  provenance?: unknown;
};

export type BoundaryEvidenceV1 = {
  code: string;
  polarity: EvidencePolarity;
  weight: number;
  details?: Record<string, unknown>;
};

export type SentenceBoundaryCandidateV1 = {
  id: string;
  afterTokenId: string;
  afterDocumentTokenIndex: number;
  punctuationTokenIds: string[];
  startUtf16: number;
  endUtf16: number;
  status: BoundaryStatus;
  confidence: 'high' | 'medium' | 'low';
  evidence: BoundaryEvidenceV1[];
  abbreviationFactId?: string;
};

export type SurfaceSentenceV1 = {
  id: string;
  index: number;
  text: string;
  startUtf16: number;
  endUtf16: number;
  startTokenId: string;
  endTokenId: string;
  tokenIds: string[];
  boundaryCandidateId: string | null;
};

export type CanonicalSurfaceDocumentV1 = {
  version: 'canonical-surface-boundary-v1';
  text: string;
  textLengthUtf16: number;
  tokens: SurfaceTokenV1[];
  boundaryCandidates: SentenceBoundaryCandidateV1[];
  sentences: SurfaceSentenceV1[];
  invariants: {
    losslessTokenSpans: true;
    stableDocumentTokenIds: true;
    punctuationPreserved: true;
    offsets: 'utf16-half-open';
    grammarFree: true;
  };
};

const LETTER_OR_MARK = /^[\p{L}\p{M}]$/u;
const DIGIT = /^\p{Nd}$/u;
const WHITESPACE = /^\s$/u;
const INTERNAL_WORD_PUNCT = new Set(["'", '\u2019', '-']);
const PUNCTUATION = new Set([
  '.', ',', '!', '?', ';', ':', '(', ')', '[', ']', '{', '}',
  '"', '\u00ab', '\u00bb', '\u201c', '\u201d', "'", '\u2019',
  '\u2013', '\u2014', '\u2026',
]);
const SENTENCE_FINAL = new Set(['.', '!', '?', '\u2026']);
const CLOSERS = new Set(['"', '\u00bb', '\u201d', ')', ']', '}']);

// Surface-level numeric sequence. Interpretation as decimal/date/time/ordinal
// belongs to a later orthographic-entity layer. This only prevents meaningful
// numeric punctuation from being silently discarded.
const NUMERIC_SEQUENCE = /(?:\d{1,3}(?:[ .\u00A0\u202F]\d{3})+(?:,\d+)?|\d+(?:(?:[.,:])\d+)+|\d+)/y;

function codePointAt(source: string, utf16Index: number): string {
  const cp = source.codePointAt(utf16Index);
  return cp === undefined ? '' : String.fromCodePoint(cp);
}
function cpWidth(ch: string): number { return ch.length; }
function isLetterOrMark(ch: string): boolean { return LETTER_OR_MARK.test(ch); }
function isDigit(ch: string): boolean { return DIGIT.test(ch); }
function isWhitespace(ch: string): boolean { return WHITESPACE.test(ch); }
function normalizedSurface(surface: string): string {
  return surface.normalize('NFC').toLocaleLowerCase('nb-NO');
}
function tokenId(index: number, start: number, end: number): string {
  return `tok:${index}:${start}:${end}`;
}

export function tokenizeCanonicalSurfaceV1(text: string): SurfaceTokenV1[] {
  const source = String(text ?? '');
  const out: SurfaceTokenV1[] = [];
  let i = 0;

  const push = (start: number, end: number, kind: SurfaceTokenKind) => {
    const surface = source.slice(start, end);
    const documentTokenIndex = out.length;
    out.push({
      id: tokenId(documentTokenIndex, start, end),
      documentTokenIndex,
      sentenceIndex: null,
      sentenceTokenIndex: null,
      surface,
      normalizedSurface: normalizedSurface(surface),
      startUtf16: start,
      endUtf16: end,
      kind,
    });
  };

  while (i < source.length) {
    const ch = codePointAt(source, i);
    if (!ch) break;

    if (isWhitespace(ch)) {
      i += cpWidth(ch);
      continue;
    }

    if (isDigit(ch)) {
      NUMERIC_SEQUENCE.lastIndex = i;
      const m = NUMERIC_SEQUENCE.exec(source);
      if (m && m.index === i) {
        push(i, i + m[0].length, 'number');
        i += m[0].length;
        continue;
      }
    }

    if (isLetterOrMark(ch)) {
      const start = i;
      i += cpWidth(ch);
      while (i < source.length) {
        const cur = codePointAt(source, i);
        if (isLetterOrMark(cur) || isDigit(cur)) {
          i += cpWidth(cur);
          continue;
        }
        if (INTERNAL_WORD_PUNCT.has(cur)) {
          const nextIndex = i + cpWidth(cur);
          const next = codePointAt(source, nextIndex);
          if (next && isLetterOrMark(next)) {
            i = nextIndex;
            continue;
          }
        }
        break;
      }
      push(start, i, 'word');
      continue;
    }

    const width = cpWidth(ch);
    push(i, i + width, PUNCTUATION.has(ch) ? 'punctuation' : 'symbol');
    i += width;
  }

  return out;
}

type Span = { start: number; end: number; fact: AbbreviationFactV1 };

function findAbbreviationSpans(text: string, facts: readonly AbbreviationFactV1[]): Span[] {
  const normalizedText = text.normalize('NFC').toLocaleLowerCase('nb-NO');
  const spans: Span[] = [];
  for (const fact of facts) {
    const needle = fact.surface.normalize('NFC').toLocaleLowerCase('nb-NO');
    if (!needle) continue;
    let from = 0;
    while (from < normalizedText.length) {
      const idx = normalizedText.indexOf(needle, from);
      if (idx < 0) break;
      from = idx + 1;
      const prev = idx > 0 ? codePointAt(normalizedText, idx - 1) : '';
      if (prev && isLetterOrMark(prev)) continue;
      spans.push({ start: idx, end: idx + needle.length, fact });
    }
  }
  return spans;
}

function startsUpperOrDigit(surface: string): boolean {
  const first = Array.from(surface)[0] ?? '';
  return /^\p{Lu}$/u.test(first) || /^\p{Nd}$/u.test(first);
}

function nextLexicalToken(tokens: readonly SurfaceTokenV1[], fromExclusive: number): SurfaceTokenV1 | undefined {
  for (let i = fromExclusive + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === 'word' || t.kind === 'number') return t;
    if (!CLOSERS.has(t.surface) && t.kind !== 'punctuation') return t;
  }
  return undefined;
}

function abbreviationAtPeriod(spans: readonly Span[], pos: number): { span: Span; isFinalPeriod: boolean } | undefined {
  for (const span of spans) {
    if (pos < span.start || pos >= span.end) continue;
    // Period is final if it is the last '.' in the abbreviation surface.
    const local = pos - span.start;
    const last = span.fact.surface.lastIndexOf('.');
    return { span, isFinalPeriod: local === last };
  }
  return undefined;
}

export function resolveSentenceBoundariesV1(
  text: string,
  tokens: readonly SurfaceTokenV1[],
  abbreviationFacts: readonly AbbreviationFactV1[] = [],
): SentenceBoundaryCandidateV1[] {
  const spans = findAbbreviationSpans(text, abbreviationFacts);
  const candidates: SentenceBoundaryCandidateV1[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== 'punctuation' || !SENTENCE_FINAL.has(t.surface)) continue;

    let endIdx = i;
    const punctuationIds = [t.id];
    while (endIdx + 1 < tokens.length && tokens[endIdx + 1].kind === 'punctuation' && SENTENCE_FINAL.has(tokens[endIdx + 1].surface)) {
      endIdx++;
      punctuationIds.push(tokens[endIdx].id);
    }
    while (endIdx + 1 < tokens.length && CLOSERS.has(tokens[endIdx + 1].surface)) endIdx++;

    const evidence: BoundaryEvidenceV1[] = [
      { code: 'sentence_final_punctuation', polarity: 'support', weight: t.surface === '.' ? 3 : 5, details: { surface: t.surface } },
    ];

    let status: BoundaryStatus = 'resolved';
    let confidence: 'high' | 'medium' | 'low' = t.surface === '.' ? 'medium' : 'high';
    let abbreviationFactId: string | undefined;

    if (t.surface === '.') {
      const abbr = abbreviationAtPeriod(spans, t.startUtf16);
      if (abbr) {
        abbreviationFactId = abbr.span.fact.id;
        if (!abbr.isFinalPeriod) {
          status = 'rejected';
          confidence = 'high';
          evidence.push({ code: 'internal_abbreviation_period', polarity: 'oppose', weight: 10, details: { abbreviation: abbr.span.fact.surface } });
        } else {
          const policy = abbr.span.fact.boundaryPolicy;
          const next = nextLexicalToken(tokens, endIdx);
          if (policy === 'never') {
            status = 'rejected';
            confidence = 'high';
            evidence.push({ code: 'abbreviation_never_ends_sentence', polarity: 'oppose', weight: 10, details: { abbreviation: abbr.span.fact.surface } });
          } else if (!next) {
            status = 'resolved';
            confidence = 'high';
            evidence.push({ code: 'end_of_document', polarity: 'support', weight: 6 });
          } else if (policy === 'may' && startsUpperOrDigit(next.surface)) {
            status = 'resolved';
            confidence = 'medium';
            evidence.push({ code: 'abbreviation_may_end_sentence', polarity: 'support', weight: 2, details: { abbreviation: abbr.span.fact.surface } });
            evidence.push({ code: 'next_lexical_token_upper_or_digit', polarity: 'support', weight: 2, details: { surface: next.surface } });
          } else {
            status = policy === 'may' ? 'ambiguous' : 'rejected';
            confidence = 'medium';
            evidence.push({ code: 'abbreviation_biases_non_boundary', polarity: 'oppose', weight: policy === 'usually_not' ? 5 : 2, details: { abbreviation: abbr.span.fact.surface } });
          }
        }
      }
    }

    candidates.push({
      id: `boundary:${t.documentTokenIndex}:${tokens[endIdx].documentTokenIndex}`,
      afterTokenId: tokens[endIdx].id,
      afterDocumentTokenIndex: tokens[endIdx].documentTokenIndex,
      punctuationTokenIds: punctuationIds,
      startUtf16: t.startUtf16,
      endUtf16: tokens[endIdx].endUtf16,
      status,
      confidence,
      evidence,
      ...(abbreviationFactId ? { abbreviationFactId } : {}),
    });
    i = Math.max(i, endIdx);
  }

  return candidates;
}

export function buildCanonicalSurfaceDocumentV1(
  text: string,
  abbreviationFacts: readonly AbbreviationFactV1[] = [],
): CanonicalSurfaceDocumentV1 {
  const source = String(text ?? '');
  const rawTokens = tokenizeCanonicalSurfaceV1(source);
  const boundaryCandidates = resolveSentenceBoundariesV1(source, rawTokens, abbreviationFacts);
  const resolvedAfter = new Map<number, SentenceBoundaryCandidateV1>();
  for (const b of boundaryCandidates) if (b.status === 'resolved') resolvedAfter.set(b.afterDocumentTokenIndex, b);

  const tokens = rawTokens.map(t => ({ ...t }));
  const sentences: SurfaceSentenceV1[] = [];
  let startIndex = 0;

  const flush = (endIndexInclusive: number, boundary: SentenceBoundaryCandidateV1 | null) => {
    if (endIndexInclusive < startIndex || startIndex >= tokens.length) return;
    const slice = tokens.slice(startIndex, endIndexInclusive + 1);
    const sentenceIndex = sentences.length;
    slice.forEach((tok, i) => {
      tok.sentenceIndex = sentenceIndex;
      tok.sentenceTokenIndex = i;
    });
    sentences.push({
      id: `sentence:${sentenceIndex}:${slice[0].startUtf16}:${slice[slice.length - 1].endUtf16}`,
      index: sentenceIndex,
      text: source.slice(slice[0].startUtf16, slice[slice.length - 1].endUtf16),
      startUtf16: slice[0].startUtf16,
      endUtf16: slice[slice.length - 1].endUtf16,
      startTokenId: slice[0].id,
      endTokenId: slice[slice.length - 1].id,
      tokenIds: slice.map(t => t.id),
      boundaryCandidateId: boundary?.id ?? null,
    });
    startIndex = endIndexInclusive + 1;
  };

  for (let i = 0; i < tokens.length; i++) {
    const boundary = resolvedAfter.get(i);
    if (boundary) flush(i, boundary);
  }
  if (startIndex < tokens.length) flush(tokens.length - 1, null);

  return {
    version: 'canonical-surface-boundary-v1',
    text: source,
    textLengthUtf16: source.length,
    tokens,
    boundaryCandidates,
    sentences,
    invariants: {
      losslessTokenSpans: true,
      stableDocumentTokenIds: true,
      punctuationPreserved: true,
      offsets: 'utf16-half-open',
      grammarFree: true,
    },
  };
}
