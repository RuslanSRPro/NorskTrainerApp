# Canonical translation contract (2026-11-01)

Approved scope: one standard card translation pipeline; separate relationship classification and publication readiness; strict links only in the app; no mass database collection.

## Implemented

- Verifier v9 receives existing canonical translations alongside Norwegian dictionary evidence. It does not generate translations. It reports source/target translation alignment, additional usage restrictions and both substitution directions.
- `publication_ready` is separate from the semantic decision. Strict publication requires both alignments, both directions, same construction, no additional restriction, and ready standard cards. Missing translations, rejected enrichment and unverified cards block publication. Mutual dictionary references alone no longer autoapprove.
- The standalone sense-label worker was removed from the deployed handler. Its lease endpoint returns no rows, and label work no longer wakes the verifier. Historical labels remain stored. The old pure sense-label module remains only for historical tests, without a production caller.
- Carousel translations come exclusively from `get_canonical_lexeme_translations_v1`. Groups and source-meaning captions use original Norwegian definitions. Help retains the analysis launch date; additional AI sense translations are no longer returned or displayed.
- Translation/review/identity changes invalidate registered incident pairs in both directions and enqueue their existing candidates for refresh. Triggers do not call AI, discover words or create card jobs. Standard analysis completion retains its existing refresh path.
- Historical decisions without publication-readiness evidence are retained but withdrawn from publication. They can return after a normal audit/recheck. No global reanalysis was started.
- Strict decisions blocked on readiness are included in synonym problem status. Contextual/one-way decisions remain stored and hidden.

## Validation

17 verifier tests and 8 presentation tests passed. SQL rollback test checks disabled translation leasing, no autoapproval by references, valid canonical publication and withdrawal/refresh on a card change. Full app TypeScript check has pre-existing errors in other modules; changed synonym/UI files produced none. Native phone UI has not been visually checked.

Applied migrations: 20261101194951 and 20261101195304. Edge function version 20, prompt v9.

## Control sample observations (model judgments, not linguistic gold labels)

- god -> stor: contextual, one-way, source translation mismatch; hidden.
- snakke -> samtale: contextual, construction/register restriction; hidden.
- snakke -> prate: strict and canonical-ready; published.
- stor -> diger and diger -> stor: strict and canonical-ready; published.
- romslig -> stor: model reported contextual while declaring no restriction and mutual substitution. Guard now sends this contradictory combination to manual review. The initial v9 answer was preserved in history before correction.

The test worker also processed already queued/sibling pairs through the normal bounded queue. This was not a database collection pass. Bokmålsordboka mass collection remains disabled; after-analysis collection remains enabled.

Model judgments still need linguistic review. In particular, degree/register distinctions must not be inferred to be correct solely because the model returned true flags. Master translations were not rewritten by this change.
