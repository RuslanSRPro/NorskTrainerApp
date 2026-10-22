// Run against an isolated checkout/archive of R048M, never against Production.
// Example: deno run --allow-read probe-r048m-subject-seed.ts <r048m-root>
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceRoot = Deno.args[0];
if (!sourceRoot) throw new Error('R048M source root is required');
const moduleRoot = resolve(sourceRoot, 'supabase/functions/_shared/nlp');
const fromBranch = (name: string) => import(pathToFileURL(resolve(moduleRoot, name)).href);
const [authorityModule, bindingModule, shapeModule, seedModule, surfaceModule,
  coreModule, mapModule, adapterModule] = await Promise.all([
  fromBranch('canonical-dependency-runtime-authority-v1.ts'),
  fromBranch('canonical-runtime-manifest-binding-definition-authority-v1.ts'),
  fromBranch('canonical-runtime-manifest-binding-where-shape-authority-v1.ts'),
  fromBranch('canonical-runtime-dependency-s0-seed-composer-v1.ts'),
  fromBranch('canonical-surface-boundary-v1.ts'),
  fromBranch('canonical-language-graph-core-v1.ts'),
  fromBranch('sql-structural-compatibility-map-v1.ts'),
  fromBranch('legacy-language-graph-adapter-v1.ts'),
]);

const manifest = JSON.parse(await Deno.readTextFile(
  new URL('../artifacts/R052-current-subject-manifest-full-row.json', import.meta.url),
));
const capture = JSON.parse(await Deno.readTextFile(
  new URL('../artifacts/R051-current-production-structural-rpc-smoke.json', import.meta.url),
));
const rows = [manifest.row];
const authority = authorityModule.deriveCanonicalDependencyRuntimeAuthoritiesV1(rows);
const bindings = bindingModule.deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(rows);
const shapes = shapeModule.deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(bindings);
const surface = surfaceModule.buildCanonicalSurfaceDocumentV1('Katten sover');
const map = mapModule.buildSqlStructuralCompatibilityMapV1(surface, 0);
const graph = adapterModule.projectLegacyNonPhraseStructureIntoCanonicalGraphV143(
  coreModule.createCanonicalLanguageGraphV1(surface), capture.rpc_output, surface, 0, map,
).graph;
const seed = seedModule.deriveCanonicalRuntimeDependencyS0SeedsV1(rows, graph);
const result = {
  schema_version: 'r048m-subject-seed-probe-v1',
  source_root: sourceRoot,
  manifest_code: manifest.row.code,
  authority: { status: authority.status, count: authority.authorities?.length ?? 0, blocking_reasons: authority.blockingReasons },
  bindings: { status: bindings.status, count: bindings.authorities?.length ?? 0, blocking_reasons: bindings.blockingReasons },
  where_shapes: { status: shapes.status, count: shapes.authorities?.length ?? 0, blocking_reasons: shapes.blockingReasons },
  s0: { status: seed.status, count: seed.seeds.length, expected_authority_count: seed.expectedAuthorityCount ?? null, blocking_reasons: seed.blockingReasons },
};
if (authority.status !== 'ready' || authority.authorities.length !== 1 ||
    bindings.status !== 'ready' || bindings.authorities.length !== 3 ||
    shapes.status !== 'ready' || shapes.authorities.length !== 3 ||
    seed.status !== 'ready' || seed.seeds.length !== 0) {
  throw new Error(`R048M subject seed contract changed: ${JSON.stringify(result)}`);
}
console.log(JSON.stringify(result, null, 2));
