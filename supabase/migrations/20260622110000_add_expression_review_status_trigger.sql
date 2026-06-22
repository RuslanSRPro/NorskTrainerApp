-- expression_review_status больше не вычисляется внутри отдельных edge-
-- функций (naob-structure-extractor и, в будущем, Ordbokene-сторона) — это
-- приводило к устареванию: чей бы источник ни записался первым, пересчёт
-- происходил только в его коде, и обновление второго источника не
-- триггерило пересчёт. Теперь это делает сама база: каждый источник честно
-- пишет только свою колонку (ordbokene_status / naob_status),
-- expression_review_status пересчитывается автоматически триггером при
-- изменении любой из них — независимо от порядка записи и количества
-- источников.
-- Источник решения: architecture-audit-full.md, разделы 46-47.

alter table public.expression_catalog
add column if not exists ordbokene_status text;

comment on column public.expression_catalog.ordbokene_status is
'Honest, source-specific status from the Ordbokene pipeline only. Never combined with naob_status here — see expression_review_status / compute_expression_review_status().';

comment on column public.expression_catalog.naob_status is
'Honest, source-specific status from the NAOB pipeline only. Never combined with ordbokene_status here — see expression_review_status / compute_expression_review_status().';

-- Правило соответствует исходной таблице пользователя из 9 строк (AND —
-- требуется согласие источников для 'verified', не максимум по одному).
-- "Звёзды"/общий рейтинг, показываемый пользователю — отдельная,
-- MAX-вычисляемая величина (вероятно, существующий verification_tier из
-- пути A, либо будущее отдельное вычисление при добавлении новых
-- источников), не совпадает с этим полем. Подтверждено пользователем.
create or replace function public.compute_expression_review_status(
  p_ordbokene_status text,
  p_naob_status text
)
returns text
language sql
immutable
as $function$
  select case
    when coalesce(p_ordbokene_status, 'not_listed') in ('expr_entry', 'sub_article')
      and coalesce(p_naob_status, 'not_listed') = 'uttrykk'
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

create or replace function public.expression_catalog_recompute_review_status()
returns trigger
language plpgsql
as $function$
begin
  new.expression_review_status := public.compute_expression_review_status(
    new.ordbokene_status,
    new.naob_status
  );
  return new;
end;
$function$;

drop trigger if exists trg_expression_catalog_recompute_review_status
on public.expression_catalog;

create trigger trg_expression_catalog_recompute_review_status
before insert or update of ordbokene_status, naob_status
on public.expression_catalog
for each row
execute function public.expression_catalog_recompute_review_status();

-- Бэкафилл: пересчитать уже существующие строки, у которых есть хотя бы
-- один из двух статусов. "set naob_status = naob_status" — не меняет
-- значение, но засчитывается как UPDATE OF naob_status и запускает триггер.
update public.expression_catalog
set naob_status = naob_status
where naob_status is not null
   or ordbokene_status is not null;