export type ItemType = 'expression' | 'lexeme';

export type EnrichmentInput = {
  item_type: ItemType;

  /**
   * Production-first input.
   * Text analysis layer should pass lemma/expression lemma first.
   */
  lemma?: string;

  /**
   * Optional internal IDs.
   * Used only when the item has already been detected in local catalog.
   */
  expression_id?: string;
  lexeme_id?: string;

  /**
   * For expression lookup in NAOB.
   * Example:
   *   lemma = "legge merke til"
   *   source_lemma = "merke"
   *   candidate_slugs = ["legge", "merke_2"]
   */
  source_lemma?: string;
  candidate_slugs?: string[];

  /**
   * Optional lexeme metadata.
   */
  pos?: string;

  force_refresh?: boolean;
  update_catalog?: boolean;
};

export type SourceName = 'ordbokene' | 'naob';

export type SourceEvidence = {
  source: SourceName;
  status: string | null;
  diagnostic_status?: string | null;
  confidence?: number | null;
  success: boolean;
  error?: string | null;
  raw?: unknown;
};

export type VerificationTier =
  | 'dictionary_entry'
  | 'usage_evidence'
  | 'component_match'
  | 'not_found'
  | 'technical_error';

export type VerificationStatus =
  | 'verified'
  | 'partial'
  | 'unverified'
  | 'infrastructure_failure';

export type SourceDetail = {
  source: SourceName;
  status: string | null;
  success: boolean;
  tier: VerificationTier;
  found: boolean;
  registered_entry: boolean;
  whole_unit_match: boolean;
  component_match: boolean;
  usage_match: boolean;
  confidence: number | null;
  evidence_label: string;
};

export type UnifiedEvidenceSummary = {
  item_type: ItemType;

  /**
   * Prefer internal ID when available, otherwise use lemma.
   */
  item_id: string;

  lemma?: string | null;
  source_lemma?: string | null;

  sources: {
    ordbokene?: SourceEvidence;
    naob?: SourceEvidence;
  };

  summary: {
    attempted_sources: number;
    successful_sources: number;
    positive_sources: number;
    negative_sources: number;
    has_authoritative_evidence: boolean;

    /**
     * Aggregated from the strongest source-level tier.
     * Full source-level evidence is preserved in source_details.
     */
    verification_status: VerificationStatus;
    strongest_tier: VerificationTier;
    strongest_source: SourceName | null;
    source_details: SourceDetail[];
  };
};