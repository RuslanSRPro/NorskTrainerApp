alter table public.lexemes
add column if not exists dictionary_status text not null default 'active',
add column if not exists dictionary_exclusion_reason text null,
add column if not exists is_learning_lexeme boolean not null default true;

update public.lexemes l
set
  dictionary_status = 'excluded',
  dictionary_exclusion_reason = d.reason,
  is_learning_lexeme = false,
  updated_at = now()
from public.dictionary_admission_rules d
where d.is_active = true
  and d.action = 'reject'
  and d.normalized_value = lower(l.lemma);

create index if not exists idx_lexemes_learning_status
on public.lexemes (is_learning_lexeme, dictionary_status);