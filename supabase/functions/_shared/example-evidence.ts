export const EXAMPLE_EVIDENCE_VERSION = 'd10_example_evidence_v1';
export function linguisticText(value: unknown): value is string {
  return typeof value === 'string' && /\p{L}/u.test(value) &&
    !/^\s*(?:https?:\/\/|<)/i.test(value);
}
export function norwegianExample(row: any): boolean {
  return row?.language_code === 'nb' && linguisticText(row.example_text);
}
export function selectNorwegianExample(rows: any[]): any | null {
  return rows.filter(norwegianExample).slice().sort((a,b)=>{
    const rank=(r:any)=>(r.source==='ai_fallback'?10:0)+(linguisticText(r.translation_uk)?0:2);
    return rank(a)-rank(b) || String(a.id).localeCompare(String(b.id));
  })[0] ?? null;
}
export function pairLexinExample(example: any, norwegian: any[], ukrainian: any[]) {
  const index=example.index;
  const validIndex=typeof index==='number' && Number.isInteger(index) && index>=0;
  const own=validIndex?norwegian.filter(e=>e.id===example.id && e.index===index):[];
  const matches=validIndex?ukrainian.filter(e=>e.id===example.id && e.index===index):[];
  const matched=own.length===1 && matches.length===1 && linguisticText(matches[0].text);
  return {entry:matched?matches[0]:null,
    status:!validIndex?'missing_index':own.length!==1||matches.length>1?'ambiguous_index':matched?'matched':'missing_translation'};
}
export function lexinExampleEvidence(identity: {lexemeId:string|null;expressionId:string|null;lemma:string;pos:string|null;entryPos:string|null;url:string}, example:any, pair:{entry:any;status:string}) {
  const capture=(e:any)=>e?{id:e.id,sub_id:e.sub_id??null,type:e.type,index:e.index??null,text:e.text.trim()}:null;
  return {version:EXAMPLE_EVIDENCE_VERSION,status:'source_extracted',
    source:{provider:'Lexin',url:identity.url,lemma:identity.lemma,pos:identity.pos,
      detected_pos:identity.entryPos,entry_id:example.id,example: capture(example),
      translation: capture(pair.entry),pairing_status:pair.status,pairing_method:'same_entry_unique_index'},
    content_binding:{version:EXAMPLE_EVIDENCE_VERSION,kind:'source_example',
      lexeme_id:identity.lexemeId,expression_id:identity.expressionId,lemma:identity.lemma,pos:identity.pos,
      language_code:'nb',value:example.text.trim(),translation_language_code:'uk',
      translation_value:pair.entry?.text.trim()??null,source_entry_id:example.id,
      source_example_sub_id:example.sub_id??null,source_translation_sub_id:pair.entry?.sub_id??null,
      source_index:example.index??null}};
}
export function createAiExampleBinding(context:string,review:any,identity:{lexemeId:string;exampleNb:string;translationUk:string|null}) {
  const source=JSON.parse(context),proposal=review?.approved_proposal;
  if(review?.version!=='d10_ai_pos_sense_v3'||review?.status!=='accepted'||review?.provider!=='gemini'||
    !linguisticText(review.model)||!linguisticText(review.reason)||!Number.isFinite(Date.parse(review.reviewed_at))||
    JSON.stringify(proposal?.context)!==JSON.stringify(source)||!Array.isArray(proposal?.missing)||!proposal.missing.includes('example')||
    !linguisticText(identity.exampleNb)||!linguisticText(identity.translationUk)||
    !linguisticText(proposal?.answer?.example_nb)||proposal.answer.example_nb.trim()!==identity.exampleNb.trim()||
    !linguisticText(proposal?.answer?.example_translation_ua)||proposal.answer.example_translation_ua.trim()!==identity.translationUk.trim()||
    source.dictionary!=='bm'||!source.lemma||!source.pos||!/^\d+$/.test(String(source.article_id)))
    throw Error('AI_REVIEWED_EXAMPLE_MISMATCH');
  return {version:EXAMPLE_EVIDENCE_VERSION,kind:'ai_example',lexeme_id:identity.lexemeId,
    expression_id:null,lemma:source.lemma,pos:source.pos,dictionary:'bm',article_id:String(source.article_id),
    language_code:'nb',value:identity.exampleNb.trim(),translation_language_code:'uk',translation_value:identity.translationUk.trim()};
}
