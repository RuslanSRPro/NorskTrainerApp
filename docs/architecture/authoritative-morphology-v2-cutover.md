# D10 production cutover runbook

## Invariants

- Ordbøkene is the only source allowed to create forms.
- The production application reads one model per request.
- Bokmål is the only default and the only persisted D10 dictionary.
- Nynorsk is available only by explicit source-debug lookup and is never
  published to the application projection.
- V2 shadow failures never affect legacy completion accounting.
- No legacy table or bridge is removed while a dependency remains.

## Gates

| Stage | Producer | Persistence | App read | Required evidence |
| --- | --- | --- | --- | --- |
| Baseline | V1 | V1 only | legacy | Current production |
| Shadow compare | V1 + V2 | V1 only | legacy | Coverage/error comparison |
| Shadow persist | V1 + V2 | V1 + V2 | legacy | Atomic V2 snapshots, bounded growth |
| Read canary | V1 + V2 | V1 + V2 | V2 canary build | Learner-facing review |
| V2 read | V1 + V2 | V1 + V2 | V2 | All readers converted |
| Cleanup eligible | V2 | V2 | V2 | Legacy dependency count = 0 |

## Flags

| Flag | Default | Effect |
| --- | --- | --- |
| `D10_FORMS_V2_SHADOW_ENABLED` | `false` | Runs V2 beside V1 in the forms chain |
| `D10_FORMS_V2_PERSIST_ENABLED` | `false` | Publishes complete successful V2 snapshots |
| `D10_FORMS_V2_PERSIST_CANARY_ENABLED` | `false` | Unlocks the operator-only single-lexeme canary |
| `D10_FORMS_V2_PERSIST_CANARY_LEXEME_IDS` | empty | Allowlist for operator-only persistence |
| `EXPO_PUBLIC_FORMS_READ_MODEL` | `legacy` | Selects the mobile application read model |
| `D10_FORMS_READ_MODEL` | `legacy` | Selects the analyze-text verb-map source |

The persistence flag has no effect unless shadow is also enabled.
The V2 worker also enforces this flag internally: `persist:true` is rejected
unless `D10_FORMS_V2_PERSIST_ENABLED` is exactly `true`. All worker requests
must carry the exact internal service-role bearer credential; an ordinary
authenticated user JWT is rejected before any database access.

`forms-enrichment-v2-compare-shadow` is the operator-facing comparison gate.
It accepts only the named modern `completionshadow` secret, requires a terminal
job, selects at most 25 job-scoped lexemes, and calls the internal V2 worker
with the literal `persist:false`. It returns bounded V1/V2 differences without
publishing a snapshot or changing legacy completion accounting. Page through a
larger job with `offset`/`nextOffset`; do not raise the per-request limit.
Source ambiguity, `not_found`, and V1/V2 differences are returned as an HTTP
200 audit result with `comparisonOk=false`. HTTP 502 is reserved for a failed
or invalid internal-worker response.

The comparison normalizes V1 technical aliases to V2 form keys before testing
coverage. Legacy `present_perfect`/`past_perfect` phrases and `needs_review`
pseudo-forms are reported under `intentionalLegacyExclusions`; they are not
treated as missing Ordbøkene forms.

`forms-enrichment-v2-persist-canary` is the only operator-facing persistence
entrypoint. It accepts exactly one lexeme UUID, requires the named modern
`completionshadow` secret, an exact confirmation phrase, the dedicated canary
flag, the global persistence flag, and membership in
`D10_FORMS_V2_PERSIST_CANARY_LEXEME_IDS`. The allowlist fails closed when it is
empty, malformed, or larger than 20 UUIDs. It calls only the V2 worker and never
invokes or writes through the legacy producer. The operator canary also refuses
to run while `D10_FORMS_V2_SHADOW_ENABLED=true`, preventing background jobs from
sharing the temporary global persistence window.

Several exact articles may represent different senses with the same POS. The
resolver never picks the first article and never merges their source
identities. If all learner-facing form keys, values, and primary/alternative
tiers are identical, shadow comparison reports
`resolved_equivalent_source_articles` and the shared projection counts once.
V2.1 publishes that projection while retaining every contributing article ID;
it never chooses an arbitrary primary article. Any difference between article
projections remains `ambiguous_source_articles` and fails closed.

## Migration-history gate

Local/Remote history reached exact equality on 2026-09-02 without repair,
deletion, renaming, or overwriting any existing migration. The reviewed D10
migrations are:

```text
supabase/migrations/20260902083000_authoritative_morphology_v2.sql
supabase/migrations/20260902181604_authoritative_morphology_v2_multi_article_provenance.sql
```

V2.1 was applied only after Local/Remote history matched, a dry-run offered no
other migration, and the 54-test versioned pgTAP suite
`supabase/tests/authoritative_morphology_v2.test.sql` succeeded.

## Cleanup gate

```powershell
node scripts/audit-legacy-form-dependencies.mjs --assert-zero
```

Any non-zero result blocks deletion. The audit intentionally counts the V1
producer, V1 comparison read, old application adapter, legacy text-analysis
branch, completion auditor, refresh orchestrator, and manual import bridges.
