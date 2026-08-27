alter table public.lexeme_form_variants
add column if not exists variant_rank integer default 0,
add column if not exists form_group text,
add column if not exists source_priority integer default 100;

-- Синхронизируем старую и новую модель
update public.lexeme_form_variants
set
  form_key = coalesce(form_key, form_type),
  form_type = coalesce(form_type, form_key),
  is_primary = coalesce(is_primary, is_main, true),
  is_accepted = coalesce(
    is_accepted,
    verification_status in ('source_verified', 'multi_source_verified')
  ),
  variant_type = coalesce(
    variant_type,
    case
      when is_alternative = true then 'alternative'
      when is_main = true then 'main'
      else 'main'
    end
  ),
  variant_rank = coalesce(
    variant_rank,
    case
      when is_main = true then 0
      when is_alternative = true then 1
      else 0
    end
  ),
  source_verified = coalesce(source_verified, source),
  evidence = coalesce(
    evidence,
    jsonb_build_object(
      'source', source,
      'source_article_id', source_article_id,
      'source_dictionary', source_dictionary,
      'grammar', grammar
    )
  ),
  confidence = coalesce(
    confidence,
    case
      when verification_status in ('source_verified', 'multi_source_verified') then 1
      when verification_status = 'needs_review' then 0
      else 0.3
    end
  )
where true;

create index if not exists lexeme_form_variants_lexeme_form_type_idx
on public.lexeme_form_variants (lexeme_id, form_type);

create index if not exists lexeme_form_variants_primary_idx
on public.lexeme_form_variants (lexeme_id, pos, is_primary, variant_rank);

create index if not exists lexeme_form_variants_status_idx
on public.lexeme_form_variants (verification_status, needs_review);

comment on column public.lexeme_form_variants.form_type is
'Canonical app-facing form type, e.g. infinitive, present, singular_definite, comparative.';

comment on column public.lexeme_form_variants.form_key is
'Technical alias for form_type used by enrichment workers.';

comment on column public.lexeme_form_variants.is_primary is
'Canonical app-facing flag for the main normative form.';

comment on column public.lexeme_form_variants.variant_rank is
'0 = main form, 1 = accepted alternative, 2 = rare/secondary, 3 = historical/non-learning display only.';

comment on column public.lexeme_form_variants.evidence is
'Canonical source/evidence object for app and audit display.';