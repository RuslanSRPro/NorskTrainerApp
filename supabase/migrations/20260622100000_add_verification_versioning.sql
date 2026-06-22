-- Версионирование верификации. Чисто аддитивная миграция: только новые
-- колонки и новая таблица, ни одна существующая колонка/функция не
-- меняется. Не требует правок ordbokene-lexeme-pipeline-worker,
-- ordbokene.ts, evidence-summary.ts или promote_verification_results_for_job
-- — те остаются путём "первого знакомства со словом", это путь
-- "перепроверка уже известного".

alter table public.expression_catalog
add column if not exists verification_version integer not null default 1;

alter table public.expression_catalog
add column if not exists source_checked_at timestamptz;

alter table public.lexemes
add column if not exists verification_version integer not null default 1;

alter table public.lexemes
add column if not exists source_checked_at timestamptz;

comment on column public.expression_catalog.verification_version is
'Increments only on a meaningful re-verification change (tier or status differs from previous value). Does not increment on the initial promotion.';

comment on column public.expression_catalog.source_checked_at is
'Timestamp of the last time an authoritative source was actually queried for this record — distinct from updated_at, which can be touched by unrelated processes.';

comment on column public.lexemes.verification_version is
'Increments only on a meaningful re-verification change (tier or status differs from previous value). Does not increment on the initial promotion.';

comment on column public.lexemes.source_checked_at is
'Timestamp of the last time an authoritative source was actually queried for this record — distinct from updated_at, which can be touched by unrelated processes.';

-- Полный журнал изменений верификации — не только тир/статус, а целиком
-- снимок строки до и после, на случай если поменялись и другие поля
-- (пример, определение, источники). Один общий формат для lexeme и
-- expression, по тому же паттерну, что authoritative_semantic_relations
-- (entity_type + entity_id).
create table if not exists public.verification_history (
  id uuid primary key default gen_random_uuid(),

  entity_type text not null check (entity_type in ('lexeme', 'expression')),
  entity_id uuid not null,

  source text not null,

  previous_verification_tier text,
  new_verification_tier text not null,

  previous_verification_status text,
  new_verification_status text not null,

  -- Полный снимок строки целиком, не только verification-поля.
  previous_row jsonb,
  new_row jsonb,

  change_reason text not null,
  evidence jsonb not null default '{}'::jsonb,

  checked_at timestamptz not null default now()
);

create index if not exists idx_verification_history_entity
on public.verification_history(entity_type, entity_id);

create index if not exists idx_verification_history_checked_at
on public.verification_history(checked_at);

comment on table public.verification_history is
'Audit log of every verification_tier/verification_status change after the initial promotion — both upgrades and downgrades, with the source, reason, and a full before/after row snapshot for each.';

comment on column public.verification_history.previous_row is
'Full row snapshot (to_jsonb) of the expression_catalog/lexemes record immediately before this change, not just the verification fields.';

comment on column public.verification_history.new_row is
'Full row snapshot (to_jsonb) of the expression_catalog/lexemes record immediately after this change.';

comment on column public.verification_history.change_reason is
'Free-text but expected values: scheduled_reverification, manual_review, source_update_detected. Not a hard CHECK constraint yet to keep this flexible while the re-verification worker is still being designed.';

-- Единая точка записи изменения — и для будущего воркера переверификации,
-- и для самого пути A, если его тоже захотят завести через общий журнал
-- позже. Атомарно читает текущую строку целиком (блокируя её), пишет
-- новое значение, забирает обновлённую строку целиком через RETURNING,
-- и сохраняет оба снимка в историю — всё в одной транзакции.
create or replace function public.record_verification_change(
  p_entity_type text,
  p_entity_id uuid,
  p_source text,
  p_new_verification_tier text,
  p_new_verification_status text,
  p_change_reason text,
  p_evidence jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
as $function$
declare
  v_previous_row jsonb;
  v_new_row jsonb;
begin
  if p_entity_type = 'expression' then
    select to_jsonb(e.*) into v_previous_row
    from public.expression_catalog e
    where id = p_entity_id
    for update;

    if v_previous_row is null then
      raise exception 'expression_catalog row % not found', p_entity_id;
    end if;

    update public.expression_catalog
    set
      verification_tier = p_new_verification_tier,
      verification_status = p_new_verification_status,
      verification_version = verification_version + 1,
      source_checked_at = now(),
      updated_at = now()
    where id = p_entity_id
    returning to_jsonb(expression_catalog.*) into v_new_row;

  elsif p_entity_type = 'lexeme' then
    select to_jsonb(l.*) into v_previous_row
    from public.lexemes l
    where id = p_entity_id
    for update;

    if v_previous_row is null then
      raise exception 'lexemes row % not found', p_entity_id;
    end if;

    update public.lexemes
    set
      verification_tier = p_new_verification_tier,
      verification_status = p_new_verification_status,
      verification_version = verification_version + 1,
      source_checked_at = now(),
      updated_at = now()
    where id = p_entity_id
    returning to_jsonb(lexemes.*) into v_new_row;

  else
    raise exception 'Unknown entity_type: %', p_entity_type;
  end if;

  insert into public.verification_history (
    entity_type,
    entity_id,
    source,
    previous_verification_tier,
    new_verification_tier,
    previous_verification_status,
    new_verification_status,
    previous_row,
    new_row,
    change_reason,
    evidence,
    checked_at
  )
  values (
    p_entity_type,
    p_entity_id,
    p_source,
    v_previous_row ->> 'verification_tier',
    p_new_verification_tier,
    v_previous_row ->> 'verification_status',
    p_new_verification_status,
    v_previous_row,
    v_new_row,
    p_change_reason,
    p_evidence,
    now()
  );
end;
$function$;