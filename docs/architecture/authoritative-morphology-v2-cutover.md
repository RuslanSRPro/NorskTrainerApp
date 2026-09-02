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

Several exact articles may represent different senses with the same POS. The
resolver never picks the first article and never merges their source
identities. If all learner-facing form keys, values, and primary/alternative
tiers are identical, shadow comparison reports
`resolved_equivalent_source_articles` and the shared projection counts once.
It remains `publishable=false`: the current V2 table has one `article_id`, so
persistence is blocked until a versioned schema can retain every contributing
article ID. Any difference between article projections remains
`ambiguous_source_articles`.

## Migration-history gate

Local/Remote history reached exact equality on 2026-09-02 without repair,
deletion, renaming, or overwriting any existing migration. The reviewed D10
migration is:

```text
supabase/migrations/20260902083000_authoritative_morphology_v2.sql
```

Run `npx supabase db push --dry-run` again immediately before applying. It must
offer only this D10 migration. Apply it only after the versioned pgTAP suite
`supabase/tests/authoritative_morphology_v2.test.sql` succeeds.

## Cleanup gate

```powershell
node scripts/audit-legacy-form-dependencies.mjs --assert-zero
```

Any non-zero result blocks deletion. The audit intentionally counts the V1
producer, V1 comparison read, old application adapter, legacy text-analysis
branch, completion auditor, refresh orchestrator, and manual import bridges.
