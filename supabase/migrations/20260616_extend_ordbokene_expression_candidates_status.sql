alter table public.ordbokene_expression_candidates
add column if not exists promoted_expression_id uuid null;

alter table public.ordbokene_expression_candidates
add column if not exists review_note text null;

comment on column public.ordbokene_expression_candidates.status is
'Expected values: candidate, promoted, rejected, duplicate, ignored. No hard CHECK constraint yet to keep pipeline flexible.';

comment on column public.ordbokene_expression_candidates.promoted_expression_id is
'Nullable reference to expression_catalog.id after candidate is promoted or matched to an existing expression. Not enforced as FK yet to avoid migration coupling.';

comment on column public.ordbokene_expression_candidates.review_note is
'Optional human or pipeline note explaining promotion, rejection, duplicate detection, or ignored status.';

create index if not exists
idx_ordbokene_expression_candidates_promoted_expression_id
on public.ordbokene_expression_candidates(promoted_expression_id);