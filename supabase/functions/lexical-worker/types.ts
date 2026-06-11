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
  source: SourceName;
  stage: string;
  query: string;
  query_type: string;
  attempt_count: number;
  max_attempts: number;
};

export type LookupResult = {
  status: 'done' | 'partial' | 'failed';
  quality: 'strong' | 'medium' | 'weak' | 'not_found' | 'error';
  found: boolean;
  registered_entry?: boolean;
  whole_unit_match?: boolean;
  component_match?: boolean;
  usage_match?: boolean;
  evidence?: Record<string, unknown>;
  urls?: string[];
  error?: string | null;
};