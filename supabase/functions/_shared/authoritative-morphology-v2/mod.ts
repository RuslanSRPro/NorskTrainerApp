export { OrdbokeneClient } from "./client.ts";
export type { OrdbokeneClientOptions } from "./client.ts";
export {
  buildParadigmIdentity,
  normalizeNorwegian,
  parseOrdbokeneArticles,
} from "./parser.ts";
export {
  buildAuthoritativeDisplayGroups,
  NoFormPreferenceProvider,
  resolveAuthoritativeMorphology,
} from "./resolver.ts";
export {
  BM_WRITTEN_FORM_EVIDENCE,
  BokmalWrittenFormSelectionPolicy,
} from "./selection.ts";
export * from "./types.ts";
