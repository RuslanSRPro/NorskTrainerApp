-- Меняет compute_expression_review_status() с AND (требуется согласие
-- источников) на MAX (любой сильный источник достаточен) — финальное
-- решение пользователя для каталожного expression_review_status. Не
-- путать со "звёздами"/общим рейтингом для UI — это другая, отдельная,
-- ещё не реализованная величина (architecture-audit-full.md раздел 47).
-- См. раздел 48 — это уже третья смена правила в одну сторону и обратно,
-- финальная.

create or replace function public.compute_expression_review_status(
  p_ordbokene_status text,
  p_naob_status text
)
returns text
language sql
immutable
as $function$
  select case
    when coalesce(p_ordbokene_status, 'not_listed') = 'expr_entry'
      or coalesce(p_naob_status, 'not_listed') = 'uttrykk'
      then 'verified'
    when coalesce(p_ordbokene_status, 'not_listed') = 'not_listed'
      and coalesce(p_naob_status, 'not_listed') = 'not_listed'
      then 'unverified'
    when coalesce(p_ordbokene_status, 'not_listed') = 'article_ref'
      and coalesce(p_naob_status, 'not_listed') = 'not_listed'
      then 'unverified'
    else 'partial'
  end;
$function$;

-- Бэкафилл: пересчитать уже существующие строки под новым правилом.
-- Триггер сработает сам, как только что-то ИЗМЕНИТ ordbokene_status/
-- naob_status в будущем — но строки, посчитанные под старым (AND)
-- правилом и с тех пор не тронутые, останутся с устаревшим значением без
-- этого шага.
update public.expression_catalog
set naob_status = naob_status
where naob_status is not null
   or ordbokene_status is not null;