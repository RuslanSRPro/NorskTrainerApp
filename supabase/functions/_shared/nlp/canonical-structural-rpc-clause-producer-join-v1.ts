import { validateLinkedStructuralRpcPairV1, type LinkedPairV1 } from "./canonical-structural-rpc-linked-pair-validation-v1.ts";
type Obj = Record<string, unknown>;
const obj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const idx = (v: unknown): number | null => Number.isInteger(v) && (v as number) >= 0 ? v as number : null;
const id = (v: unknown): string | null => typeof v === "string" && v.length > 0 ? v : null;
function fail(code: string, issues: string[]) { if (!issues.includes(code)) issues.push(code); }
export function validateClauseProducerJoinR047C(pair: LinkedPairV1) {
  const base = validateLinkedStructuralRpcPairV1(pair);
  const issues = [...base.issues];
  const lg = obj(pair.sqlAnalysis) && obj(pair.sqlAnalysis.language_graph) ? pair.sqlAnalysis.language_graph : null;
  const anchors = lg ? arr(lg.clauses) : [];
  const predicates = lg && obj(lg.predicate_build_v1) ? arr(lg.predicate_build_v1.predicates) : [];
  const clauses = lg && obj(lg.clause_build_v1) ? arr(lg.clause_build_v1.clauses) : [];
  const tokens = lg ? arr(lg.tokens) : [];
  if (!anchors.length) fail("legacy_anchors_missing", issues);
  if (!predicates.length) fail("resolved_predicates_missing", issues);
  if (!clauses.length) fail("resolved_clauses_missing", issues);
  if (!tokens.length) fail("canonical_tokens_missing", issues);
  const matches: { finiteTokenIndex: number; subjectTokenIndex: number; predicateId: string; canonicalTokenId: string }[] = [];
  for (const clause of clauses) {
    if (!obj(clause) || clause.status !== "resolved") continue;
    const finite = idx(clause.finite_token_index), subject = idx(clause.subject_token_index);
    const predicateId = id(clause.predicate_id);
    if (finite === null || subject === null || !predicateId) { fail("resolved_clause_fields_invalid", issues); continue; }
    const ps = predicates.filter(p => obj(p) && p.status === "resolved" && p.finite_token_index === finite && p.id === predicateId);
    const as = anchors.filter(a => obj(a) && a.finite_token_index === finite && a.subject_token_index === subject);
    const ts = tokens.filter(t => obj(t) && t.legacy_index === subject && id(t.canonical_token_id));
    if (ps.length !== 1) { fail("predicate_join_not_unique", issues); continue; }
    if (as.length !== 1) { fail("anchor_join_not_unique", issues); continue; }
    if (ts.length !== 1) { fail("canonical_subject_mapping_not_unique", issues); continue; }
    matches.push({ finiteTokenIndex: finite, subjectTokenIndex: subject, predicateId, canonicalTokenId: (ts[0] as Obj).canonical_token_id as string });
  }
  if (!matches.length) fail("no_complete_resolved_join", issues);
  if (base.status !== "STRUCTURE_ONLY_PASS") fail("r047b_base_blocked", issues);
  return {
    contract: "r047c-clause-producer-join-v1" as const,
    captureId: pair.captureId,
    status: issues.length ? "BLOCKED" as const : "LOCAL_JOIN_PASS" as const,
    matchedClauseCount: matches.length,
    // Only indices and identifiers; never expose request text, token surfaces or complete payload.
    matches, issues,
    producerExecutionProof: "NOT_ESTABLISHED" as const,
    subjectOfPredicateReady: false as const,
  };
}
