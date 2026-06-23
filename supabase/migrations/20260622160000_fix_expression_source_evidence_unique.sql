-- Fix expression_source_evidence unique constraint.
--
-- Problem: (lexeme_id, expression_id, source, source_status) is too broad.
-- If Lexin returns two E-idi for the same expression (e.g. a word with two
-- fixed expressions), the second upsert would silently overwrite the first.
--
-- Fix: add expression_text to the constraint so each E-idi is stored separately.
--
-- PostgreSQL NULL semantics: two rows with (null, expr_id, 'lexin', 'e_idi', 'expr1')
-- and (null, expr_id, 'lexin', 'e_idi', 'expr2') are correctly treated as distinct.

alter table public.expression_source_evidence
  drop constraint if exists expression_source_evidence_unique;

alter table public.expression_source_evidence
  add constraint expression_source_evidence_unique unique
    (lexeme_id, expression_id, source, source_status, expression_text);