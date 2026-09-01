export { OrdbokeneClient } from "./client.ts";
export type { OrdbokeneClientOptions } from "./client.ts";
export {
  buildParadigmIdentity,
  normalizeNorwegian,
  parseOrdbokeneArticles,
} from "./parser.ts";
export {
  NoFormPreferenceProvider,
  resolveAuthoritativeMorphology,
} from "./resolver.ts";
export * from "./types.ts";
