-- unified semantic pipeline

-- expression semantic enrichment
create table if not exists expression_semantic_enrichment (
id uuid primary key default gen_random_uuid(),

expression_id uuid not null references expression_catalog(id) on delete cascade,

status text not null default 'pending',
quality text null,

semantic_confidence text null,
review_status text null,
conflicts jsonb not null default '[]'::jsonb,
audit_notes jsonb not null default '[]'::jsonb,

semantic_unit_id uuid null references canonical_semantic_units(id),
normalization_status text not null default 'pending',

source text null,
evidence jsonb not null default '{}'::jsonb,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),

unique(expression_id)
);

-- enqueue expressions
create or replace function enqueue_expression_semantic_for_job(p_job_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
v_count integer;
begin
insert into expression_semantic_enrichment (
expression_id,
status
)
select distinct
i.expression_id,
'pending'
from lexeme_processing_items i
where i.job_id = p_job_id
and i.expression_id is not null
on conflict (expression_id) do nothing;

get diagnostics v_count = row_count;
return v_count;
end;
$$;

-- claim expression audit
create or replace function claim_next_expression_semantic_audit(
p_limit int default 20
)
returns table (
id uuid,
expression_id uuid,
lemma text,
display_form text,
normalized_key text,
pos text,
expression_subtype text,
translation_ua text,
translation_en text,
cefr text,
frequency_rank integer,
frequency_level text,
topic text,
verification_tier text,
source_verified text,
verification_status text,
verification_evidence jsonb
)
language plpgsql
security definer
as $$
begin
return query
update expression_semantic_enrichment ese
set
status = 'processing',
updated_at = now()
from expression_catalog ec
where ese.expression_id = ec.id
and ese.id in (
select q.id
from expression_semantic_enrichment q
where q.status in ('pending', 'retry')
order by q.created_at
limit p_limit
for update skip locked
)
returning
ese.id,
ese.expression_id,
ec.lemma,
ec.display_form,
ec.normalized_key,
ec.pos,
ec.expression_subtype,
ec.translation_ua,
ec.translation_en,
ec.cefr,
ec.frequency_rank,
ec.frequency_level,
ec.topic,
ec.verification_tier,
ec.source_verified,
ec.verification_status,
ec.verification_evidence;
end;
$$;

-- update expression audit
create or replace function update_expression_semantic_audit_status(
p_id uuid,
p_status text,
p_quality text,
p_semantic_confidence text,
p_review_status text,
p_conflicts jsonb,
p_audit_notes jsonb,
p_source text,
p_evidence jsonb
)
returns void
language plpgsql
security definer
as $$
begin
update expression_semantic_enrichment
set
status = p_status,
quality = p_quality,
semantic_confidence = p_semantic_confidence,
review_status = p_review_status,
conflicts = coalesce(p_conflicts, '[]'::jsonb),
audit_notes = coalesce(p_audit_notes, '[]'::jsonb),
source = p_source,
evidence = coalesce(p_evidence, '{}'::jsonb),
updated_at = now()
where id = p_id;
end;
$$;

-- claim expression normalization
create or replace function claim_next_expression_semantic_normalization(
p_limit int default 50
)
returns table (
enrichment_id uuid,
expression_id uuid,
lemma text,
pos text,
review_status text,
semantic_confidence text
)
language plpgsql
security definer
as $$
begin
return query
update expression_semantic_enrichment ese
set
normalization_status = 'processing',
updated_at = now()
from expression_catalog ec
where ese.expression_id = ec.id
and ese.review_status = 'trusted'
and coalesce(ese.normalization_status, 'pending') in ('pending', 'retry')
and ese.id in (
select q.id
from expression_semantic_enrichment q
where q.review_status = 'trusted'
and coalesce(q.normalization_status, 'pending') in ('pending', 'retry')
order by q.created_at
limit p_limit
for update skip locked
)
returning
ese.id,
ese.expression_id,
ec.lemma,
coalesce(ec.pos, 'expression') as pos,
ese.review_status,
ese.semantic_confidence;
end;
$$;

-- complete expression normalization
create or replace function complete_expression_semantic_normalization(
p_enrichment_id uuid,
p_semantic_unit_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
update expression_semantic_enrichment
set
normalization_status = 'done',
semantic_unit_id = p_semantic_unit_id,
updated_at = now()
where id = p_enrichment_id;
end;
$$;
