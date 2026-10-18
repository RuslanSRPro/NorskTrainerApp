import {inspectR048FManifest} from './r048f-offline-admission-v1.ts';
function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Assertion failed: actual=${JSON.stringify(actual)}, expected=${JSON.stringify(expected)}`
    );
  }
}
const good = () => ({contract:'r048f-offline-admission-v1',projectRef:'kevpkawrbtovrgyjkkvu',rpcName:'run_canonical_legacy_compatibility_v140',releaseCode:'runtime-structural-v1.37',sentenceIndex:0,captureId:'5e7ca3fc-3e32-4558-8a29-5373613e8854',source:'canonical-graph-shadow-v1',producerPath:'clause_build_v1',provenanceStatus:'STATIC_ONLY',credentialPresent:false,productionRpcAuthorized:false});
Deno.test('valid structural manifest still HOLD',()=>{assertEquals(inspectR048FManifest(good()),{structuralChecksPass:true,executionAdmission:'HOLD',reasons:[]});});
Deno.test('wrong project rejected',()=>{assertEquals(inspectR048FManifest({...good(),projectRef:'other'}).structuralChecksPass,false);});
Deno.test('credentials rejected',()=>{assertEquals(inspectR048FManifest({...good(),credentialPresent:true}).structuralChecksPass,false);});
Deno.test('claimed authorization rejected',()=>{assertEquals(inspectR048FManifest({...good(),productionRpcAuthorized:true}).structuralChecksPass,false);});
Deno.test('unexpected payload fields rejected',()=>{assertEquals(inspectR048FManifest({...good(),p_tokens:[]}).structuralChecksPass,false);});
Deno.test('invalid capture ID rejected',()=>{assertEquals(inspectR048FManifest({...good(),captureId:'abc'}).structuralChecksPass,false);});
