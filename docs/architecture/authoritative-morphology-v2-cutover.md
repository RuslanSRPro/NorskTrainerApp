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

## Migration-history gate

Do not apply D10 until `supabase migration list` shows exact Local/Remote
equality. Never use migration repair and never delete, rename, or overwrite an
existing migration. Create the real D10 filename with:

```powershell
npx supabase migration new authoritative_morphology_v2
```

Copy the reviewed pending SQL into that generated file, run dry-run, and apply
only the generated migration after pgTAP succeeds.

## Cleanup gate

```powershell
node scripts/audit-legacy-form-dependencies.mjs --assert-zero
```

Any non-zero result blocks deletion. The audit intentionally counts the V1
producer, V1 comparison read, old application adapter, legacy text-analysis
branch, completion auditor, refresh orchestrator, and manual import bridges.
