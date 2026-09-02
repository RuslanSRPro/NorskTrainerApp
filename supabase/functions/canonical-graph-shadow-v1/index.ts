import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { buildCanonicalSurfaceDocumentV1, type AbbreviationFactV1 } from '../_shared/nlp/canonical-surface-boundary-v1.ts';
import { createCanonicalLanguageGraphV1, applyGraphPatchV1, assertCanonicalLanguageGraphV1, type CanonicalLanguageGraphV1, type GraphPatchV1, type LanguageGraphNodeV1, type LanguageGraphEdgeV1, type LanguageGraphEvidenceV1, type LanguageGraphProvenanceV1 } from '../_shared/nlp/canonical-language-graph-core-v1.ts';
import { buildLegacyCompatibilityMapV1, assertLegacyCompatibilityMapV1, canonicalTokenIdForLegacyIndexV1, canonicalTokenIdsForLegacyRangeV1, type LegacyCompatibilityMapV1 } from '../_shared/nlp/legacy-compatibility-map-v1.ts';
import {
  buildSqlStructuralCompatibilityMapV1,
  assertSqlStructuralCompatibilityMapV1,
  toSqlStructuralRpcTokensV1,
} from '../_shared/nlp/sql-structural-compatibility-map-v1.ts';
import {
  buildCanonicalCandidateLatticePatchV1,
  summarizeCanonicalCandidateLatticePatchV1,
  type CanonicalMorphRegistryEntryV1,
  type CanonicalSurfaceCandidateBatchRowV1,
} from '../_shared/nlp/canonical-candidate-lattice-v1.ts';
import {
  projectLegacyStructureIntoCanonicalGraphV11,
} from '../_shared/nlp/legacy-language-graph-adapter-v1.ts';
import {
  buildCanonicalPhraseCandidateLatticePatchV1,
  normalizeCanonicalPhraseRuntimeRuleRowsV1,
  summarizeCanonicalPhraseCandidateLatticePatchV1,
  type CanonicalPhraseRuntimeRuleRowV1,
} from '../_shared/nlp/canonical-phrase-candidate-lattice-v1.ts';
import {
  buildCanonicalConstraintPropagationPatchV1,
} from '../_shared/nlp/canonical-constraint-propagation-v1.ts';

const VERSION='canonical-phrase-candidate-lattice-v1.43';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
type J=Record<string,any>;

type ResolverRow={lexeme_id:string;lemma:string;pos:string;form_types:any;sources:any;evidence:any;base_confidence:string|null;base_priority:number|null;score:number|null;trace:any;is_ambiguous:boolean;candidate_count:number;resolution_status:string;resolution_context:any};
type AnalysisToken={index:number;surface:string;normalized_surface:string;token_role:string|null;candidates:any[];lexical_status?:string;is_ambiguous?:boolean;candidate_count?:number;resolution_context?:any};

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json'}})}
function arr(v:any):any[]{return Array.isArray(v)?v:[]}
function obj(v:any):J{return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function norm(v:any){return String(v??'').normalize('NFC').toLocaleLowerCase('nb-NO').trim()}
function strArr(v:any){return arr(v).filter(x=>typeof x==='string').map(norm).filter(Boolean)}
function graphStatus(v:any,fallback:'candidate'|'resolved'|'ambiguous'='candidate'):'candidate'|'resolved'|'rejected'|'blocked'|'ambiguous'{const s=norm(v);if(['resolved','valid','recognized','resolved_single','resolved_by_evidence','resolved_by_structure','preferred','only_candidate'].includes(s))return'resolved';if(['rejected','pruned','invalid','suppressed'].includes(s))return'rejected';if(s==='blocked')return'blocked';if(['ambiguous','unresolved','tied','weak_preference','hypothesis'].includes(s))return s==='hypothesis'?'candidate':'ambiguous';return fallback}

async function callInternal<T extends J>(url:string,key:string,name:string,body:unknown):Promise<T>{const r=await fetch(`${url}/functions/v1/${name}`,{method:'POST',headers:{Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body)});const txt=await r.text();let data:any;try{data=txt?JSON.parse(txt):{}}catch{throw new Error(`${name}:non_json:${r.status}`)}if(!r.ok||data.ok!==true)throw new Error(`${name}:${data.error??r.status}`);return data as T}

async function abbreviationFacts(supabase:any):Promise<AbbreviationFactV1[]>{const {data,error}=await supabase.from('grammar_abbreviation_facts_v1').select('code,surface,boundary_policy,provenance').eq('is_enabled',true);if(error)throw new Error(`abbreviation_facts:${error.message}`);return (data??[]).map((x:any)=>({id:String(x.code),surface:String(x.surface),boundaryPolicy:x.boundary_policy,provenance:x.provenance}))}

async function tokenRoles(supabase:any):Promise<Map<string,string>>{const {data,error}=await supabase.from('grammar_rules').select('code,pattern_type,pattern').eq('is_active',true).eq('pattern_type','token_sequence');if(error)throw new Error(`token_roles:${error.message}`);const out=new Map<string,string>();for(const r of data??[]){for(const slot of arr(r?.pattern?.slots)){if(typeof slot?.token==='string'&&typeof slot?.token_role==='string'){const k=norm(slot.token);if(k&&!out.has(k))out.set(k,norm(slot.token_role));}}}return out}

function mapCandidate(r:ResolverRow){return{lexeme_id:r.lexeme_id,lemma:r.lemma,pos:r.pos,form_types:strArr(r.form_types),sources:strArr(r.sources),evidence:r.evidence??[],base_confidence:r.base_confidence??null,base_priority:Number(r.base_priority??0),score:Number(r.score??0),trace:arr(r.trace)}}

async function resolveTokens(supabase:any,map:LegacyCompatibilityMapV1,roles:Map<string,string>):Promise<AnalysisToken[]>{return await Promise.all(map.tokens.map(async(t,i)=>{const prev=i?map.tokens[i-1].surface:null;const next=i<map.tokens.length-1?map.tokens[i+1].surface:null;const {data,error}=await supabase.rpc('resolve_surface_form_v2',{p_surface_form:t.surface,p_prev_token:prev,p_next_token:next,p_preceded_by_infinitive_marker:i>0&&norm(prev)==='\u00e5'});if(error)throw new Error(`resolve_surface_form_v2:${i}:${error.message}`);const rows=(data??[]) as ResolverRow[];const candidates=rows.map(mapCandidate);return{index:i,surface:t.surface,normalized_surface:t.normalizedSurface,token_role:roles.get(t.normalizedSurface)??null,candidates,lexical_status:rows[0]?.resolution_status??(candidates.length?'resolved':'unresolved'),is_ambiguous:rows[0]?.is_ambiguous??candidates.length>1,candidate_count:rows[0]?.candidate_count??candidates.length,resolution_context:rows[0]?.resolution_context??null}}))}

function spanFor(map:LegacyCompatibilityMapV1,start:any,end:any){const ids=canonicalTokenIdsForLegacyRangeV1(map,start,end);if(!ids.length)return undefined;const first=map.tokens.find(t=>t.canonicalTokenId===ids[0]);const last=map.tokens.find(t=>t.canonicalTokenId===ids[ids.length-1]);return{startTokenId:ids[0],endTokenId:ids[ids.length-1],tokenIds:ids,startUtf16:first?.startUtf16,endUtf16:last?.endUtf16}}
function prov(producer:string,sentenceIndex:number):LanguageGraphProvenanceV1{return{id:`prov:${producer}:s${sentenceIndex}`,sourceType:'runtime_fact',sourceId:producer,payload:{sentenceIndex,runtimeBinding:VERSION}}}
function ev(producer:string,id:string,targets:string[],payload:J,provId:string,kind:'lexical'|'structural'='structural'):LanguageGraphEvidenceV1{return{id:`evidence:${producer}:${id}`,kind,status:'supports',targetIds:targets,payload,producer,provenanceIds:[provId]}}

function lexicalPatch(tokens:AnalysisToken[],map:LegacyCompatibilityMapV1):GraphPatchV1{const producer='v140_legacy_lexical_projection';const p=prov(producer,map.sentenceIndex);const nodes:LanguageGraphNodeV1[]=[];const evidence:LanguageGraphEvidenceV1[]=[];for(const t of tokens){const tid=canonicalTokenIdForLegacyIndexV1(map,t.index);if(!tid)continue;for(let i=0;i<t.candidates.length;i++){const c=t.candidates[i];const id=`lexread:${tid}:${c.lexeme_id??i}:${c.pos??'unknown'}`;const eid=`${id}:runtime`;const status=t.candidates.length===1?'resolved':'candidate';nodes.push({id,type:'lexical_reading',subtype:'candidate',status,span:{startTokenId:tid,endTokenId:tid,tokenIds:[tid]},features:{...c,legacyIndex:t.index},producer,evidenceIds:[`evidence:${producer}:${eid}`],provenanceIds:[p.id]});evidence.push(ev(producer,eid,[id,tid],c,p.id,'lexical'))}}return{producer,producerVersion:'1.40',nodes,evidence,provenance:[p]}}

function predicatePatch(sentenceModel:J,map:LegacyCompatibilityMapV1):GraphPatchV1{const producer='v140_predicate_projection';const p=prov(producer,map.sentenceIndex);const nodes:LanguageGraphNodeV1[]=[];const edges:LanguageGraphEdgeV1[]=[];const evidence:LanguageGraphEvidenceV1[]=[];for(const x of arr(sentenceModel.predicates)){const start=x.token_start??x.span_start??x.head?.token_index;const end=x.token_end??x.span_end??x.head?.token_index;const span=spanFor(map,start,end);if(!span)continue;const id=`predicate:${map.sentenceIndex}:${x.id??`${start}:${end}`}`;const eid=`${id}:runtime`;nodes.push({id,type:'predicate',subtype:String(x.construction_type??x.predicate_kind??'predicate'),status:'resolved',span,features:{...x},producer,evidenceIds:[`evidence:${producer}:${eid}`],provenanceIds:[p.id]});evidence.push(ev(producer,eid,[id],x,p.id));const hi=x.head?.token_index??x.lexical_head_token_index??x.finite_member?.token_index;const h=canonicalTokenIdForLegacyIndexV1(map,hi);if(h)edges.push({id:`edge:head_of:${h}:${id}`,relation:'head_of',sourceId:h,targetId:id,status:'resolved',features:{},producer,evidenceIds:[`evidence:${producer}:${eid}`],provenanceIds:[p.id]})}return{producer,producerVersion:'1.40',nodes,edges,evidence,provenance:[p]}}

function clausePatch(sentenceModel:J,map:LegacyCompatibilityMapV1):GraphPatchV1{const producer='v140_clause_projection';const p=prov(producer,map.sentenceIndex);const nodes:LanguageGraphNodeV1[]=[];const edges:LanguageGraphEdgeV1[]=[];const evidence:LanguageGraphEvidenceV1[]=[];for(const x of arr(sentenceModel.clauses)){const starts=[x.token_start,x.start_token_index,x.span_start,x.subject_token_index,x.subject?.token_index].filter((n:any)=>Number.isInteger(Number(n))).map(Number);const ends=[x.token_end,x.end_token_index,x.span_end,x.finite_token_index].filter((n:any)=>Number.isInteger(Number(n))).map(Number);if(!starts.length&&!ends.length)continue;const start=Math.min(...(starts.length?starts:ends));const end=Math.max(...(ends.length?ends:starts));const span=spanFor(map,start,end);if(!span)continue;const id=`clause:${map.sentenceIndex}:${x.id??`${start}:${end}`}`;const eid=`${id}:runtime`;const status=graphStatus(x.status,'resolved');nodes.push({id,type:'clause',subtype:String(x.clause_type??x.type??x.schema??'clause'),status,span,features:{...x,sentenceIndex:map.sentenceIndex},producer,evidenceIds:[`evidence:${producer}:${eid}`],provenanceIds:[p.id]});evidence.push(ev(producer,eid,[id],x,p.id));const subjectIndex=x.subject_token_index??x.subject?.token_index;const subject=canonicalTokenIdForLegacyIndexV1(map,subjectIndex);if(subject)edges.push({id:`edge:subject_of:${subject}:${id}`,relation:'subject_of',sourceId:subject,targetId:id,status,features:{sentenceIndex:map.sentenceIndex},producer,evidenceIds:[`evidence:${producer}:${eid}`],provenanceIds:[p.id]});if(typeof x.predicate_id==='string'){const predicateId=`predicate:${map.sentenceIndex}:${x.predicate_id}`;edges.push({id:`edge:predicate_of_clause:${predicateId}:${id}`,relation:'predicate_of_clause',sourceId:predicateId,targetId:id,status,features:{sentenceIndex:map.sentenceIndex},producer,evidenceIds:[`evidence:${producer}:${eid}`],provenanceIds:[p.id]})}else{const finite=canonicalTokenIdForLegacyIndexV1(map,x.finite_token_index??x.predicate_token_index);if(finite)edges.push({id:`edge:predicate_of_clause:${finite}:${id}`,relation:'predicate_of_clause',sourceId:finite,targetId:id,status,features:{sentenceIndex:map.sentenceIndex},producer,evidenceIds:[`evidence:${producer}:${eid}`],provenanceIds:[p.id]})}}return{producer,producerVersion:'1.40',nodes,edges,evidence,provenance:[p]}}

function dependencyPatch(sentenceModel:J,map:LegacyCompatibilityMapV1):GraphPatchV1{const producer='v140_dependency_projection';const p=prov(producer,map.sentenceIndex);const edges:LanguageGraphEdgeV1[]=[];const evidence:LanguageGraphEvidenceV1[]=[];const endpoint=(ep:any,fallbackIndex:any):string|undefined=>{const e=obj(ep);const kind=norm(e.kind);if(kind==='predicate'){const pid=typeof e.predicate_id==='string'?e.predicate_id:(typeof e.id==='string'?String(e.id).replace(/^predicate:/,''):null);return pid?`predicate:${map.sentenceIndex}:${pid}`:undefined}const idx=e.token_index??fallbackIndex;return canonicalTokenIdForLegacyIndexV1(map,idx)};for(const x of arr(sentenceModel.dependencies)){const source=endpoint(x.source,x.source_token_index??x.dependent_token_index??x.from_token_index);const target=endpoint(x.target,x.target_token_index??x.head_token_index??x.to_token_index);if(!source||!target)continue;const relation=String(x.relation??x.type??'dependency');const rawId=String(x.id??`${relation}:${source}:${target}`);const id=`edge:${relation}:s${map.sentenceIndex}:${rawId}`;const eid=`${id}:runtime`;const status=graphStatus(x.status,'resolved');edges.push({id,relation,sourceId:source,targetId:target,status,features:{...x,sentenceIndex:map.sentenceIndex},producer,evidenceIds:[`evidence:${producer}:${eid}`],provenanceIds:[p.id]});evidence.push(ev(producer,eid,[id,source,target],x,p.id))}return{producer,producerVersion:'1.40',edges,evidence,provenance:[p]}}

async function runSentence(url:string,key:string,surface:any,map:LegacyCompatibilityMapV1,lexical:AnalysisToken[],selectionMargin:number){const grammar=await callInternal<J>(url,key,'grammar-pattern-engine',{tokens:lexical.map(t=>({index:t.index,surface:t.surface,normalized_surface:t.normalized_surface,token_role:t.token_role,candidates:t.candidates})),dryRun:false});const finalTokens=Array.isArray(grammar.tokens)?grammar.tokens:lexical;const constructions=arr(grammar.constructions);const cr=await callInternal<J>(url,key,'construction-resolution-engine',{constructions,includeTrace:false,strictValidation:true});const resolved=arr(cr.resolved_constructions);const pb=await callInternal<J>(url,key,'predicate-builder',{text:surface.sentences[map.sentenceIndex].text,tokens:finalTokens,constructions:resolved,construction_model:obj(cr.construction_model),selectionMargin});let sm=obj(pb.sentence_model);const ce=await callInternal<J>(url,key,'clause-pattern-engine',{sentence_model:sm});const clauses=arr(ce.clauses);const de=await callInternal<J>(url,key,'dependency-engine',{sentence_model:sm,clauses,dryRun:false,includeTrace:false,strictValidation:false,allowStructuralFallback:true});sm=obj(de.sentence_model);return{lexicalTokens:finalTokens,sentenceModel:sm,engines:{grammar:grammar.engine_version??null,construction:cr.engine_version??null,predicate:pb.builder_version??pb.predicate_builder_version??null,clause:ce.engine_version??null,dependency:de.engine_version??null},raw:{grammarSummary:grammar.summary??{},constructionSummary:cr.summary??{},clauseSummary:ce.summary??{},dependencySummary:de.summary??{}}}}

Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return json({ok:false,version:VERSION,error:'Method not allowed'},405);try{const body=await req.json();if(typeof body?.text!=='string'||!body.text.length)return json({ok:false,version:VERSION,error:'Body must contain text'},400);const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw new Error('Missing Supabase runtime env');const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const [abbr,roles]=await Promise.all([abbreviationFacts(supabase),tokenRoles(supabase)]);const surface=buildCanonicalSurfaceDocumentV1(body.text,abbr);let graph:CanonicalLanguageGraphV1=createCanonicalLanguageGraphV1(surface);const sentenceRuns:any[]=[];const bindingErrors:string[]=[];const candidateSurfaces = [
  ...new Set(
    surface.tokens
      .filter((t) => t.kind === 'word')
      .map((t) => t.normalizedSurface),
  ),
];

const [candidateBatchResult, morphRegistryResult] = await Promise.all([
  supabase.rpc('canonical_surface_candidate_batch_v1', {
    p_surfaces: candidateSurfaces,
  }),
  supabase.rpc('canonical_morph_registry_snapshot_v1'),
]);

if (candidateBatchResult.error) {
  throw new Error(
    `canonical_surface_candidate_batch_v1:${candidateBatchResult.error.message}`,
  );
}
if (morphRegistryResult.error) {
  throw new Error(
    `canonical_morph_registry_snapshot_v1:${morphRegistryResult.error.message}`,
  );
}

const candidatePatch = buildCanonicalCandidateLatticePatchV1(
  surface,
  (candidateBatchResult.data ?? []) as CanonicalSurfaceCandidateBatchRowV1[],
  (Array.isArray(morphRegistryResult.data)
    ? morphRegistryResult.data
    : []) as CanonicalMorphRegistryEntryV1[],
);
graph = applyGraphPatchV1(graph, candidatePatch);
const candidateLatticeSummary =
  summarizeCanonicalCandidateLatticePatchV1(candidatePatch);
// v1.43 NP/AP native phrase shadow binding.
// Runtime IR is loaded through a read-only allowlisted snapshot. Compiled rules
// remain inactive in grammar_rules; canonical shadow interprets them only as
// source-backed candidate-generation knowledge. Phrase facts remain candidates.
const { data: phraseRuntimeSnapshotData, error: phraseRuntimeSnapshotError } =
  await supabase.rpc('canonical_phrase_runtime_snapshot_v1');

if (phraseRuntimeSnapshotError) {
  throw new Error(
    `canonical_phrase_runtime_snapshot_v1:${phraseRuntimeSnapshotError.message}`,
  );
}

const phraseRuntimeSnapshot = obj(phraseRuntimeSnapshotData);
if (phraseRuntimeSnapshot.version !== 'canonical-phrase-runtime-snapshot-v1') {
  throw new Error(
    `canonical_phrase_runtime_snapshot_v1:unexpected_version:${String(phraseRuntimeSnapshot.version ?? '')}`,
  );
}

const phraseRuntimeRows = arr(
  phraseRuntimeSnapshot.rows,
) as CanonicalPhraseRuntimeRuleRowV1[];

if (Number(phraseRuntimeSnapshot.row_count ?? -1) !== 2) {
  throw new Error(
    `canonical_phrase_runtime_snapshot_v1:expected_2_rows:${String(phraseRuntimeSnapshot.row_count ?? '')}`,
  );
}

if (phraseRuntimeRows.some((row: any) => row?.is_active === true)) {
  throw new Error('canonical_phrase_runtime_snapshot_v1:unexpected_active_rule');
}

const phraseRuntimeRules = normalizeCanonicalPhraseRuntimeRuleRowsV1(
  phraseRuntimeRows,
);
if (phraseRuntimeRules.length !== 2) {
  throw new Error(
    `canonical_phrase_runtime_snapshot_v1:normalized_rule_count:${phraseRuntimeRules.length}`,
  );
}

const phraseManifestCodes = phraseRuntimeRules
  .map((rule) => rule.manifestCode ?? '')
  .filter(Boolean)
  .sort();
const expectedPhraseManifestCodes = [
  'ir.structural.adjective_phrase.adjective_head',
  'ir.structural.noun_phrase.noun_head',
].sort();
if (JSON.stringify(phraseManifestCodes) !== JSON.stringify(expectedPhraseManifestCodes)) {
  throw new Error(
    `canonical_phrase_runtime_snapshot_v1:unexpected_manifests:${JSON.stringify(phraseManifestCodes)}`,
  );
}

const phrasePatch = buildCanonicalPhraseCandidateLatticePatchV1(
  graph,
  phraseRuntimeRules,
);
graph = applyGraphPatchV1(graph, phrasePatch);

const phraseLatticeSummary = {
  ...summarizeCanonicalPhraseCandidateLatticePatchV1(phrasePatch),
  runtime_snapshot: {
    version: phraseRuntimeSnapshot.version,
    row_count: phraseRuntimeRows.length,
    normalized_rule_count: phraseRuntimeRules.length,
    manifest_codes: phraseManifestCodes,
    active_rule_count: phraseRuntimeRows.filter((row: any) => row?.is_active === true)
      .length,
    read_only: obj(phraseRuntimeSnapshot.policy).read_only === true,
    compiled_does_not_mean_activated:
      obj(phraseRuntimeSnapshot.policy).compiled_does_not_mean_activated === true,
    production_parser_unchanged:
      obj(phraseRuntimeSnapshot.policy).production_parser_unchanged === true,
  },
};

// v1.42 first shadow binding: load the selected runtime release for observability,
// but activate no runtime fact family until a family has a native canonical graph
// capability and an explicit activation wave. Current v1.37 facts are structural
// (clause/valency/MWE) and must not prune the v1.41 lexical/POS/morph lattice.
const constraintReleaseCode =
  typeof body.constraintReleaseCode === 'string' && body.constraintReleaseCode.trim()
    ? body.constraintReleaseCode.trim()
    : typeof body.structuralReleaseCode === 'string' && body.structuralReleaseCode.trim()
    ? body.structuralReleaseCode.trim()
    : 'runtime-structural-v1.37';

const { data: constraintReleaseRows, error: constraintReleaseError } = await supabase
  .from('grammar_runtime_releases')
  .select('id,code,status')
  .eq('code', constraintReleaseCode)
  .limit(1);

if (constraintReleaseError) {
  throw new Error(`constraint_release:${constraintReleaseError.message}`);
}
const constraintRelease = arr(constraintReleaseRows)[0];
if (!constraintRelease?.id) {
  throw new Error(`constraint_release:not_found:${constraintReleaseCode}`);
}

const { data: runtimeConstraintFacts, error: runtimeConstraintFactsError } = await supabase
  .from('grammar_runtime_constraint_facts_v1')
  .select('constraint_code,fact_family,subject_type,relation,object_type,polarity,strength')
  .eq('release_id', constraintRelease.id)
  .eq('is_enabled', true)
  .order('constraint_code');

if (runtimeConstraintFactsError) {
  throw new Error(`runtime_constraint_facts:${runtimeConstraintFactsError.message}`);
}

const loadedRuntimeConstraintFacts = arr(runtimeConstraintFacts);
const deferredFactFamilies = [
  ...new Set(
    loadedRuntimeConstraintFacts
      .map((x: any) => String(x?.fact_family ?? '').trim())
      .filter(Boolean),
  ),
].sort();

const constraintPropagation = buildCanonicalConstraintPropagationPatchV1(
  graph,
  () => [],
  {
    maxIterations: 8,
    availableCapabilities: ['canonical_candidate_lattice_v1', 'canonical_phrase_candidate_lattice_v1'],
    minimumResolutionStrength: 'strong',
  },
);
graph = applyGraphPatchV1(graph, constraintPropagation.patch);

const constraintPropagationSummary = {
  release_code: constraintReleaseCode,
  release_status: constraintRelease.status ?? null,
  runtime_facts_loaded: loadedRuntimeConstraintFacts.length,
  activated_runtime_fact_families: [] as string[],
  deferred_runtime_facts: loadedRuntimeConstraintFacts.length,
  deferred_fact_families: deferredFactFamilies,
  reason: 'no_v142_compatible_runtime_fact_family_activated',
  propagation: constraintPropagation.summary,
};

const structuralReleaseCode =
  typeof body.structuralReleaseCode === 'string' &&
  body.structuralReleaseCode.trim()
    ? body.structuralReleaseCode.trim()
    : 'runtime-structural-v1.37';

const includeEdgeComparator = body.includeEdgeComparator !== false;

for (let i = 0; i < surface.sentences.length; i++) {
  const edgeMap = buildLegacyCompatibilityMapV1(surface, i);
  bindingErrors.push(
    ...assertLegacyCompatibilityMapV1(surface, edgeMap).map(
      (e) => `edge:s${i}:${e}`,
    ),
  );

  const sqlMap = buildSqlStructuralCompatibilityMapV1(surface, i);
  bindingErrors.push(
    ...assertSqlStructuralCompatibilityMapV1(surface, sqlMap).map(
      (e) => `sql:s${i}:${e}`,
    ),
  );

  // Legacy lexical resolution is comparator input only in v1.41.
  // Canonical lexical/POS/morph facts come only from canonical_candidate_lattice_v1.
  const lexical = await resolveTokens(supabase, edgeMap, roles);

  const { data: sqlAnalysis, error: sqlError } = await supabase.rpc(
    'run_canonical_legacy_compatibility_v140',
    {
      p_tokens: toSqlStructuralRpcTokensV1(sqlMap),
      p_release_code: structuralReleaseCode,
    },
  );

  if (sqlError) {
    throw new Error(
      `run_canonical_legacy_compatibility_v140:s${i}:${sqlError.message}`,
    );
  }

  if (
    !sqlAnalysis ||
    typeof sqlAnalysis !== 'object' ||
    Array.isArray(sqlAnalysis)
  ) {
    throw new Error(
      `run_canonical_legacy_compatibility_v140:s${i}:invalid_payload`,
    );
  }

  const projection = projectLegacyStructureIntoCanonicalGraphV11(
    graph,
    sqlAnalysis as J,
    surface,
    i,
    sqlMap,
  );
  graph = projection.graph;

  let edgeComparator: J | null = null;

  if (includeEdgeComparator) {
    const edgeRun = await runSentence(
      url,
      key,
      surface,
      edgeMap,
      lexical,
      Number(body.selectionMargin ?? 20),
    );

    edgeComparator = {
      engines: edgeRun.engines,
      summary: edgeRun.sentenceModel.summary ?? {},
      legacySnapshot: {
        tokens: edgeRun.sentenceModel.tokens ?? [],
        predicates: edgeRun.sentenceModel.predicates ?? [],
        clauses: edgeRun.sentenceModel.clauses ?? [],
        dependencies: edgeRun.sentenceModel.dependencies ?? [],
      },
    };
  }

  sentenceRuns.push({
    sentenceIndex: i,
    sentenceId: surface.sentences[i].id,
    text: surface.sentences[i].text,
    compatibilityMap: edgeMap,
    sqlCompatibilityMap: sqlMap,
    structuralReleaseCode,
    sqlStructuralSummary: {
      morphologyCount: arr(
        (sqlAnalysis as J)?.language_graph?.morphology_v1,
      ).length,
      localPosCount: arr(
        (sqlAnalysis as J)?.language_graph?.local_pos_v1,
      ).length,
      phrase:
        obj((sqlAnalysis as J)?.language_graph?.phrase_build_v1).summary ?? {},
      structuralPos:
        obj((sqlAnalysis as J)?.language_graph?.structural_pos_v1).summary ?? {},
      mwe:
        obj(
          (sqlAnalysis as J)?.language_graph
            ?.multiword_function_expression_v1,
        ).summary ?? {},
      predicate:
        obj((sqlAnalysis as J)?.language_graph?.predicate_build_v1).summary ?? {},
      clause:
        obj((sqlAnalysis as J)?.language_graph?.clause_build_v1).summary ?? {},
      attachment:
        obj(
          (sqlAnalysis as J)?.language_graph
            ?.clause_attachment_function_v1,
        ).summary ?? {},
      dependency:
        obj((sqlAnalysis as J)?.language_graph?.dependency_build_v2).summary ?? {},
    },
    adapterDiagnostics: projection.diagnostics,
    edgeComparator,
  });
}
const graphErrors=assertCanonicalLanguageGraphV1(graph);const spanErrors=surface.tokens.filter((t:any)=>surface.text.slice(t.startUtf16,t.endUtf16)!==t.surface).map((t:any)=>`surface_span:${t.id}`);const crossSentenceEdges=graph.edges.filter(e=>{const s=graph.nodes.find(n=>n.id===e.sourceId),t=graph.nodes.find(n=>n.id===e.targetId);const si=(s?.features as any)?.sentenceIndex??surface.tokens.find(x=>x.id===e.sourceId)?.sentenceIndex;const ti=(t?.features as any)?.sentenceIndex??surface.tokens.find(x=>x.id===e.targetId)?.sentenceIndex;return si!=null&&ti!=null&&si!==ti}).map(e=>e.id);const errors=[...bindingErrors,...graphErrors,...spanErrors,...crossSentenceEdges.map(x=>`cross_sentence_edge:${x}`)];return json({ok:errors.length===0,version:VERSION,shadow_only:true,production_replacement:false,grammar_activation:false,surface,language_graph:graph,candidate_lattice:candidateLatticeSummary,phrase_lattice:phraseLatticeSummary,constraint_propagation:constraintPropagationSummary,sentence_runs:sentenceRuns,invariants:{errors,passed:errors.length===0,no_retokenization:true,global_activation:false}})}catch(e){console.error('[V1.43 SHADOW]',e);return json({ok:false,version:VERSION,shadow_only:true,error:e instanceof Error?e.message:String(e)},500)}});



