import { OrdbokeneClient } from "./client.ts";
import { parseOrdbokeneArticles } from "./parser.ts";
import {
  AUTHORITATIVE_MORPHOLOGY_VERSION,
  type AuthoritativeParadigm,
  type FormPreferenceProvider,
  type ResolveRequest,
  type ResolveResult,
} from "./types.ts";
import { BokmalWrittenFormSelectionPolicy } from "./selection.ts";

export class NoFormPreferenceProvider implements FormPreferenceProvider {
  readonly providerVersion = "none/v1";

  getPreference(): Promise<null> {
    return Promise.resolve(null);
  }
}

export async function resolveAuthoritativeMorphology(args: {
  request: ResolveRequest;
  client?: OrdbokeneClient;
  preferenceProvider?: FormPreferenceProvider;
}): Promise<ResolveResult> {
  const client = args.client ?? new OrdbokeneClient();
  const preferenceProvider = args.preferenceProvider ??
    new NoFormPreferenceProvider();
  const lookup = await client.lookup(
    args.request.query,
    args.request.dictionaries ?? ["bm"],
  );

  let paradigms = parseOrdbokeneArticles(lookup.articles);
  if (args.request.pos) {
    paradigms = paradigms.filter((paradigm) =>
      paradigm.pos === args.request.pos
    );
  }

  paradigms = await annotatePreferences(paradigms, preferenceProvider);

  const status = paradigms.length > 0
    ? lookup.errors.length > 0 ? "partial" : "resolved"
    : lookup.errors.length > 0
    ? "source_error"
    : "not_found";

  return {
    version: AUTHORITATIVE_MORPHOLOGY_VERSION,
    status,
    requestedPos: args.request.pos ?? null,
    lookup,
    paradigms,
    writesPerformed: false,
  };
}

export function buildAuthoritativeDisplayGroups(
  paradigms: readonly AuthoritativeParadigm[],
) {
  return new BokmalWrittenFormSelectionPolicy().select(paradigms);
}

async function annotatePreferences(
  paradigms: readonly AuthoritativeParadigm[],
  provider: FormPreferenceProvider,
): Promise<AuthoritativeParadigm[]> {
  return await Promise.all(paradigms.map(async (paradigm) => {
    const preference = await provider.getPreference(paradigm);
    return { ...paradigm, preference };
  }));
}
