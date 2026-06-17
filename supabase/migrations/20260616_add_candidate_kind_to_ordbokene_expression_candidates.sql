alter table public.ordbokene_expression_candidates
add column if not exists candidate_kind text null;

comment on column public.ordbokene_expression_candidates.candidate_kind is
'Classification of extracted Ordbokene sub_article candidate: expression, sentence_phrase, question_phrase, exclamation_phrase.';

create index if not exists
idx_ordbokene_expression_candidates_candidate_kind
on public.ordbokene_expression_candidates(candidate_kind);