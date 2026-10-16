export type SourceName =
  | 'NAOB'
  | 'Ordbokene'
  | 'Lexin'
  | 'Wiktionary'
  | 'Språkrådet';

export type SourceCheck = {
  id: string;
  job_id: string;
  item_id: string;

  lexeme_id: string | null;
  expression_id: string | null;

  source: SourceName;

  stage: string;

  query: string;
  query_type: string;
  surface_form?: string | null;
  // Loaded from the processing item for the Ordbøkene check; absent for other sources.
  pos?: string | null;
  expected_expression_article?: { articleId: string; parentArticleId: string; parentArticleIds?: string[] } | null;
  // Bokmål article identity already bound to the resolved token lexeme
  // (lexeme_form_display_v2.article_ids for that lexeme and POS). Used only to
  // choose between several same-POS homonym articles; never for text lookup.
  bound_token_article_ids?: string[] | null;
  // D10 15.10.2026: article numbers of the last successful exact Ordbøkene
  // search for this word and POS (our lookup cache). Used ONLY when the live
  // search fails with a server error and no bound article is known.
  cached_search_article_ids?: string[] | null;
  cached_search_checked_at?: string | null;

  attempt_count: number;
  max_attempts: number;
};

export type AuthoritativeRelationCandidate = {
  relation_type:
    | 'synonym_candidate'
    | 'related_candidate'
    | 'derived_candidate'
    | 'compound_component_candidate';

  target_text: string;

  source: SourceName;

  confidence: 'high' | 'medium' | 'low';

  evidence_label?: string;
  url?: string;
};

export type LookupResult = {
  status: 'done' | 'partial' | 'failed';

  quality:
    | 'strong'
    | 'medium'
    | 'weak'
    | 'not_found'
    | 'error';

  found: boolean;

  registered_entry?: boolean;
  whole_unit_match?: boolean;
  component_match?: boolean;
  usage_match?: boolean;

  evidence?: Record<string, unknown>;

  urls?: string[];

  authoritative_relations?: AuthoritativeRelationCandidate[];

  error?: string | null;
};
