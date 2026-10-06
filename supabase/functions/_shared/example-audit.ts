import { linguisticText, norwegianExample, createAiExampleBinding } from './example-evidence.ts';
export const EXAMPLE_AUDIT_VERSION='d10_example_audit_v1';
export function auditExample(row:any,identity:any) {
 const e=row.enrichment_evidence??{}, h=row.history??[],latest=h.find((x:any)=>identity.article_ids?.includes(String(x.article_id)));
 const bindingMatches=(b:any)=>b?.lexeme_id===identity.id&&b?.expression_id===null&&b?.lemma===identity.lemma&&b?.pos===identity.pos&&
 b?.dictionary==='bm'&&identity.article_ids?.includes(String(b.article_id))&&b?.language_code==='nb'&&b?.translation_language_code==='uk'&&
 b?.value===row.example_text?.trim()&&b?.translation_value===row.translation_uk?.trim();
 let state:string,reason:string;
 if(!norwegianExample(row)){state='invalid_format';reason='NOT_BOKMAL_LINGUISTIC_EXAMPLE';}
 else if(!linguisticText(row.translation_uk)){state='missing_translation';reason='UK_PAIR_MISSING';}
 else if(latest?.status==='rejected'){state='needs_review';reason=latest.reason;}
 else if(latest?.kind==='manual'&&latest?.status==='accepted'){
   const proof=latest.decision,b=proof?.manual_binding;
   const valid=b?.version===EXAMPLE_AUDIT_VERSION&&b?.kind==='manual_example'&&bindingMatches(b)&&
     linguisticText(proof?.reviewer)&&linguisticText(proof?.reason)&&Array.isArray(proof?.references)&&proof.references.length>0&&
     proof.references.every((r:any)=>typeof r==='string'&&r.startsWith('https://'))&&
     Array.isArray(proof.context?.definitions)&&proof.context.definitions.length>0&&
     JSON.stringify(proof?.context)===JSON.stringify(latest.context);
   state=valid?'manual_reviewed':'stale_proof';reason=valid?'EXACT_PAIR_MANUALLY_CONFIRMED':'MANUAL_PROOF_INVALID_OR_SOURCE_CHANGED';
 } else if(row.source==='ai_fallback'){
   try{const source=e.source;
     if(e.version!=='d10_ai_pos_sense_v3'||e.status!=='ai_reviewed'||e.source_verified!==false||source?.provider!=='Ordbokene')throw Error('INVALID_SOURCE');
     const ctx={dictionary:source.dictionary,article_id:source.article_id,lemma:source.lemma,pos:source.pos,
      definitions:source.definitions,examples:source.examples,translation_constraints:source.translation_constraints??[]};
     // Approved context is authoritative for key order; compare source fields structurally below.
     const approved=e.review?.approved_proposal?.context;
     for(const key of Object.keys(ctx))if(JSON.stringify(ctx[key as keyof typeof ctx])!==JSON.stringify(approved?.[key]))throw Error('SOURCE_CHANGED');
     const b=createAiExampleBinding(JSON.stringify(approved),e.review,{lexemeId:identity.id,exampleNb:row.example_text,translationUk:row.translation_uk});
     if(!bindingMatches(b)||Object.keys(b).some(k=>(b as any)[k]!==e.example_binding?.[k]))throw Error('BINDING_CHANGED');
     state='ai_reviewed';reason='EXACT_PAIR_AI_REVIEWED';
   }catch{state=e.example_binding?'stale_proof':e.review?.status==='accepted'?'legacy_evidence':'needs_review';reason='NO_VALID_CURRENT_AI_PAIR_PROOF';}
 }else {
   const b=e.content_binding,s=e.source;
   const index=s?.example?.index;
   const valid=e.version==='d10_example_evidence_v1'&&e.status==='source_extracted'&&s?.provider==='Lexin'&&
     s?.pairing_status==='matched'&&s?.pairing_method==='same_entry_unique_index'&&Number.isInteger(index)&&index>=0&&
     s?.example?.id===s?.translation?.id&&index===s?.translation?.index&&s?.example?.text===row.example_text?.trim()&&
     s?.translation?.text===row.translation_uk?.trim()&&b?.kind==='source_example'&&b?.lexeme_id===identity.id&&
     b?.lemma===identity.lemma&&b?.pos===identity.pos&&b?.language_code==='nb'&&b?.translation_language_code==='uk'&&
     b?.value===row.example_text?.trim()&&b?.translation_value===row.translation_uk?.trim();
   state=valid?'source_pair_recorded':'source_unbound';reason=valid?'SOURCE_PAIR_EXTRACTION_RECORDED_NOT_SEMANTIC_REVIEW':'NO_EXACT_SOURCE_PAIR_PROOF';
 }
 return {example_id:row.id,lexeme_id:identity.id,lemma:identity.lemma,pos:identity.pos,language_code:row.language_code,
   text:row.example_text,translation_uk:row.translation_uk,source:row.source,state,reason,
   selected_for_display:row.selected_for_display===true,history:h};
}
export function buildExampleAudit(data:any){
 if(!data||data.version!==EXAMPLE_AUDIT_VERSION||!Array.isArray(data.lexemes))throw Error('REPORT_EXAMPLE_AUDIT_INVALID');
 const items:any[]=[];const ids=new Set<string>(),exampleIds=new Set<string>();let missing=0;
 for(const l of data.lexemes){if(!l?.id||ids.has(l.id)||!Array.isArray(l.examples)||!Array.isArray(l.article_ids))throw Error('REPORT_EXAMPLE_AUDIT_INVALID');ids.add(l.id);
   if(!l.examples.some(norwegianExample))missing++;
   for(const row of l.examples){
     if(!row?.id||exampleIds.has(row.id)||row.lexeme_id!==l.id||row.expression_id!==null)throw Error('REPORT_EXAMPLE_AUDIT_INVALID');
     exampleIds.add(row.id);items.push(auditExample(row,l));
   }
 }
 const counts:Record<string,number>={};for(const item of items)counts[item.state]=(counts[item.state]??0)+1;
 return {version:EXAMPLE_AUDIT_VERSION,captured_at:data.captured_at,scope:'confirmed_lexemes_bokmal_examples_only',
   affects_completion_readiness:false,source_pair_recorded_is_semantic_review:false,lexemes:data.lexemes.length,
   lexemes_without_usable_example:missing,total_examples:items.length,counts,items};
}
