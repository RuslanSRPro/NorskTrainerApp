// Norsk Trainer — Canonical ↔ Legacy Compatibility Map V1
// v1.40 shadow-only. Never tokenizes raw text.

import type { CanonicalSurfaceDocumentV1, SurfaceTokenV1 } from './canonical-surface-boundary-v1.ts';

export type LegacyCompatibilityTokenV1 = { legacyIndex:number; canonicalTokenId:string; documentTokenIndex:number; canonicalSentenceTokenIndex:number; sentenceIndex:number; surface:string; normalizedSurface:string; startUtf16:number; endUtf16:number; kind:SurfaceTokenV1['kind']; };
export type LegacyCompatibilityMapV1 = { version:'legacy-compatibility-map-v1'; sentenceIndex:number; sentenceId:string; tokens:LegacyCompatibilityTokenV1[]; canonicalToLegacy:Record<string,number>; excludedCanonicalTokenIds:string[]; invariants:{ noRetokenization:true; oneLegacyTokenToOneCanonicalToken:true; documentTokenIdentityPreserved:true; punctuationRemainsCanonical:true; }; };

export function buildLegacyCompatibilityMapV1(surface:CanonicalSurfaceDocumentV1,sentenceIndex:number):LegacyCompatibilityMapV1 {
 const sentence=surface.sentences[sentenceIndex]; if(!sentence) throw new Error(`sentence_not_found:${sentenceIndex}`);
 const ids=new Set(sentence.tokenIds); const sentenceTokens=surface.tokens.filter(t=>ids.has(t.id)).sort((a,b)=>(a.sentenceTokenIndex??0)-(b.sentenceTokenIndex??0));
 const included=sentenceTokens.filter(t=>t.kind!=='punctuation');
 const tokens=included.map((t,legacyIndex)=>({legacyIndex,canonicalTokenId:t.id,documentTokenIndex:t.documentTokenIndex,canonicalSentenceTokenIndex:t.sentenceTokenIndex??-1,sentenceIndex,surface:t.surface,normalizedSurface:t.normalizedSurface,startUtf16:t.startUtf16,endUtf16:t.endUtf16,kind:t.kind}));
 const canonicalToLegacy:Record<string,number>={}; for(const t of tokens) canonicalToLegacy[t.canonicalTokenId]=t.legacyIndex;
 return {version:'legacy-compatibility-map-v1',sentenceIndex,sentenceId:sentence.id,tokens,canonicalToLegacy,excludedCanonicalTokenIds:sentenceTokens.filter(t=>t.kind==='punctuation').map(t=>t.id),invariants:{noRetokenization:true,oneLegacyTokenToOneCanonicalToken:true,documentTokenIdentityPreserved:true,punctuationRemainsCanonical:true}};
}
export function canonicalTokenIdForLegacyIndexV1(map:LegacyCompatibilityMapV1,legacyIndex:unknown):string|undefined { const n=Number(legacyIndex); if(!Number.isInteger(n)) return undefined; return map.tokens[n]?.canonicalTokenId; }
export function canonicalTokenIdsForLegacyRangeV1(map:LegacyCompatibilityMapV1,start:unknown,end:unknown):string[] { const a=Number(start),b=Number(end); if(!Number.isInteger(a)||!Number.isInteger(b)||b<a) return []; return map.tokens.slice(a,b+1).map(t=>t.canonicalTokenId); }
export function assertLegacyCompatibilityMapV1(surface:CanonicalSurfaceDocumentV1,map:LegacyCompatibilityMapV1):string[] { const errors:string[]=[]; const seen=new Set<string>(); for(let i=0;i<map.tokens.length;i++){ const item=map.tokens[i]; if(item.legacyIndex!==i) errors.push(`non_contiguous_legacy_index:${i}:${item.legacyIndex}`); if(seen.has(item.canonicalTokenId)) errors.push(`duplicate_canonical_mapping:${item.canonicalTokenId}`); seen.add(item.canonicalTokenId); const token=surface.tokens.find(t=>t.id===item.canonicalTokenId); if(!token){errors.push(`missing_canonical_token:${item.canonicalTokenId}`);continue;} if(token.documentTokenIndex!==item.documentTokenIndex) errors.push(`document_index_mismatch:${item.canonicalTokenId}`); if(surface.text.slice(item.startUtf16,item.endUtf16)!==item.surface) errors.push(`surface_span_mismatch:${item.canonicalTokenId}`); if(token.kind==='punctuation') errors.push(`punctuation_leaked_to_legacy:${item.canonicalTokenId}`); } return errors; }
