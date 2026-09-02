export const AUTHORITATIVE_MORPHOLOGY_VERSION =
  "authoritative-morphology/v2" as const;

export type DictionaryCode = "bm" | "nn";

export type MorphologyPos =
  | "verb"
  | "noun"
  | "adjective"
  | "determiner";

export type LookupScope = "e" | "i";

export type RegularityMarker =
  | "regular"
  | "irregular"
  | "suppletive"
  | "unknown";

export type FormDisplayTier = "primary" | "alternative";

export type ArticleReference = {
  dictionaryCode: DictionaryCode;
  articleId: string;
};

export type SourceError = ArticleReference & {
  url: string;
  message: string;
};

export type OrdbokeneArticle = ArticleReference & {
  sourceUrl: string;
  payload: Record<string, unknown>;
};

export type OrdbokeneLookup = {
  query: string;
  normalizedQuery: string;
  requestedDictionaries: DictionaryCode[];
  scopeUsed: LookupScope;
  articleReferences: ArticleReference[];
  articles: OrdbokeneArticle[];
  errors: SourceError[];
  checkedAt: string;
};

export type SourceForm = {
  formKey: string;
  value: string;
  normalizedValue: string;
  tags: string[];
  sourceOrdinal: number;
};

export type ParadigmPreference = {
  regularity: RegularityMarker;
  preferredFormKeys?: string[];
  usageNotes?: Record<string, string>;
  evidenceIds: string[];
  providerVersion: string;
};

export type AuthoritativeParadigm = {
  identity: string;
  source: "Ordbokene";
  dictionaryCode: DictionaryCode;
  dictionaryName: "Bokmålsordboka" | "Nynorskordboka";
  articleId: string;
  articleUrl: string;
  articleVersion: string | null;
  pos: MorphologyPos;
  paradigmId: string;
  lemma: string;
  paradigmTags: string[];
  inflectionGroup: string | null;
  standardisation: string | null;
  forms: SourceForm[];
  preference: ParadigmPreference | null;
};

export interface FormPreferenceProvider {
  readonly providerVersion: string;

  getPreference(
    paradigm: Readonly<AuthoritativeParadigm>,
  ): Promise<ParadigmPreference | null>;
}

export type SelectedSourceForm = SourceForm & {
  tier: FormDisplayTier;
  paradigmIdentity: string;
  paradigmId: string;
  evidenceIds: string[];
};

export type FormDisplayGroup = {
  dictionaryCode: DictionaryCode;
  articleId: string;
  pos: MorphologyPos;
  lemma: string;
  formKey: string;
  primary: SelectedSourceForm[];
  alternatives: SelectedSourceForm[];
  regularityMarker: RegularityMarker;
  evidenceIds: string[];
  policyVersion: string;
};

export interface FormSelectionPolicy {
  readonly policyVersion: string;

  select(
    paradigms: readonly AuthoritativeParadigm[],
  ): FormDisplayGroup[];
}

export type ResolveRequest = {
  query: string;
  pos?: MorphologyPos;
  dictionaries?: DictionaryCode[];
};

export type ResolveStatus =
  | "resolved"
  | "partial"
  | "not_found"
  | "source_error";

export type ResolveResult = {
  version: typeof AUTHORITATIVE_MORPHOLOGY_VERSION;
  status: ResolveStatus;
  requestedPos: MorphologyPos | null;
  lookup: OrdbokeneLookup;
  paradigms: AuthoritativeParadigm[];
  writesPerformed: false;
};
