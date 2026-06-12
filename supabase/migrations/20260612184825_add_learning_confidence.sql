alter table canonical_semantic_units
add column if not exists learning_confidence text;

alter table lexeme_semantic_enrichment
add column if not exists learning_confidence text;

alter table expression_semantic_enrichment
add column if not exists learning_confidence text;