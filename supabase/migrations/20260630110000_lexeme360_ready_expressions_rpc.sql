create or replace function public.get_lexeme360_ready_expressions(p_root_lemma text)
returns table (
  lexeme_id uuid,
  lemma text,
  pos text,
  expression_subtype text,
  verification_status text
)
language sql
security definer
set search_path = public
as $$
  select
    ec.lexeme_id,
    lx.lemma,
    lx.pos,
    ec.expression_subtype,
    ec.verification_status
  from public.expression_catalog ec
  join public.lexemes lx
    on lx.id = ec.lexeme_id
  where ec.root_lemma = lower(trim(regexp_replace(p_root_lemma, '^å\s+', '', 'i')))
    and ec.lexeme_id is not null
    and ec.verification_status = 'multi_source'
    and coalesce(lx.is_learning_lexeme, true) = true
    and coalesce(lx.dictionary_status, 'active') = 'active'
  order by ec.lemma;
$$;

grant execute on function public.get_lexeme360_ready_expressions(text) to authenticated;