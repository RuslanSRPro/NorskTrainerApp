create extension if not exists pgcrypto;
create role anon; create role authenticated; create role service_role;
create schema private;
create table public.lexeme_processing_jobs (id uuid primary key default gen_random_uuid(), user_id text, input_type text default 'text', input_text text,
 status text default 'pending', total_items int default 0, done_items int default 0, partial_items int default 0, failed_items int default 0,
 skipped_items int default 0, summary jsonb default '{}', error_message text, created_at timestamptz default now(), started_at timestamptz,
 finished_at timestamptz, updated_at timestamptz default now(), last_resume_at timestamptz, orchestrator_locked_at timestamptz);
create table public.lexeme_processing_items (id uuid primary key default gen_random_uuid(), job_id uuid, expression_id uuid, lexeme_id uuid,
 raw_input text, normalized_input text, normalized_lemma text, surface_form text, pos text, match_type text, status text, current_stage text,
 attempt_count int, max_attempts int, result_summary jsonb);
create table public.lexeme_source_checks (id uuid primary key default gen_random_uuid(), job_id uuid, item_id uuid, lexeme_id uuid, source text,
 stage text, query text, surface_form text, query_type text, status text, attempt_count int, max_attempts int, evidence jsonb, urls jsonb, verification_version int);
create table public.lexemes (id uuid primary key default gen_random_uuid(), lemma text, pos text, display_form text, homograph_key text default '',
 verification_status text, dictionary_status text default 'active', is_learning_lexeme boolean default true, created_at timestamptz default now());
create table public.expression_catalog (id uuid primary key default gen_random_uuid(), lemma text, normalized_key text, lexeme_id uuid,
 verification_status text, root_lemma text);
create table public.naob_expression_glosses (id uuid primary key default gen_random_uuid(), normalized_key text, naob_slug text, anchor_id text,
 anchor_id_source text, expression_lemma text, gloss_text text, gloss_type text, context_label text, gloss_index int, extractor_version text);
create table public.authoritative_semantic_relations (id uuid primary key default gen_random_uuid(), source_entity_type text, source_entity_id uuid,
 relation_type text, target_text text, status text, evidence jsonb, created_at timestamptz default now());
create table public.pipeline_supervisor_state (job_id uuid primary key, stage text);
create table private.d10_runtime_settings_v1 (key text primary key, value jsonb);
create table public.entity_examples (lexeme_id uuid, expression_id uuid, language_code text, example_text text);
create table private.d10_ai_review_rejections_v1 (lexeme_id uuid, reason text);
create function public.get_canonical_lexeme_translations_v1(p uuid[]) returns table(lexeme_id uuid, translation text) language sql as $$ select null::uuid, null::text where false $$;
