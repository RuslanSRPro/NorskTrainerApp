-- D10 V2-only cutover. Legacy form data is intentionally discarded.
-- Canonical article bindings are preserved and will guide the clean backfill.

-- Removing snapshots cascades through paradigms, source forms, comparisons and
-- the public display projection. The subsequent V2 backfill rebuilds all of it
-- exclusively from Ordbokene.
delete from private.authoritative_morphology_snapshots_v2;

create or replace function private.reject_legacy_form_write_v2()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception using
    errcode = '55000',
    message = 'D10_LEGACY_FORM_WRITE_DISABLED';
end;
$function$;

revoke all on function private.reject_legacy_form_write_v2()
from public, anon, authenticated, service_role;

do $cutover$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'lexeme_form_variants',
    'verb_forms',
    'noun_forms',
    'adjective_forms',
    'word_forms'
  ]
  loop
    if to_regclass('public.' || relation_name) is not null then
      execute format('delete from public.%I', relation_name);
      execute format(
        'revoke insert, update, delete, truncate on public.%I from public, anon, authenticated, service_role',
        relation_name
      );
      execute format(
        'comment on table public.%I is %L',
        relation_name,
        'D10 legacy form storage retained read-only for schema compatibility; canonical data lives only in public.lexeme_form_display_v2.'
      );
      execute format(
        'drop trigger if exists reject_legacy_form_write_v2 on public.%I',
        relation_name
      );
      execute format(
        'create trigger reject_legacy_form_write_v2 before insert or update on public.%I for each statement execute function private.reject_legacy_form_write_v2()',
        relation_name
      );
    end if;
  end loop;
end;
$cutover$;

comment on table public.lexeme_form_display_v2 is
  'Sole application-facing Bokmal morphology projection, rebuilt from Ordbokene by forms-enrichment-v2-worker.';
