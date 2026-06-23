// app/(tabs)/reading.tsx — themed version
// Logic identical to original. Colours driven by useTheme().
// Semantic status colours (learned=green, in_base=yellow, unknown=red) stay fixed —
// they encode learning state, not UI theme.

import { useMemo, useState } from "react";
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";

import {
  addLexemeToLearningFromSupabase, addPreviewWordViaAppsScript,
  addExpressionCandidateToSupabase, analyzeTextViaAppsScript,
  boostReadingLexemeHitsInSupabase, getReadingLexemesFromSupabase,
  inspectWordViaAppsScript, translateSentenceWithAI,
} from "@/services/api";
import { speakNorwegian, stopSpeech } from "@/services/speech";
import { useSettingsStore } from "@/store/settingsStore";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Lexeme360, Lexeme360Sheet } from "@/components/Lexeme360";
import { t } from "@/services/i18n";
import { resolveVerification } from "@/services/verification";
import { useTheme } from "@/contexts/ThemeContext";

type WordStatus = "learned" | "in_base" | "unknown";
type AnalysisSource = "pwa" | "ai";
type AnalysisItem = { text: string; normalized: string; status: WordStatus; translation?: string; lexeme?: any };
type SentenceAIResult = { translation?: string; grammarNotes?: string[]; expressions?: string[]; literalMeaning?: string; difficulty?: string };
type AnalyzerCandidate = {
  id: string; selected: boolean; source: AnalysisSource; kind: "missing" | "expression";
  status: WordStatus; text?: string; lemma?: string; type?: string;
  meaning_ua?: string; meaning_en?: string; meaning_no?: string;
  example?: string; confidence?: string; cefr?: string; frequency_level?: string;
  expression_subtype?: string; raw: any; lexeme?: any; added?: boolean; error?: string;
};
type AppLanguage = "ua" | "en" | "no";
type ReadingTextKey = keyof typeof READING_TEXT.en;

const READING_TEXT = {
  ua: {
    reading_title:"📖 Аналіз тексту",reading_subtitle:"PWA аналіз і AI аналіз працюють окремо, але обидва використовують локальну базу для підсвітки.",
    word_analysis_title:"🔎 Аналіз слова",word_input_placeholder:"Введи слово будь-якою мовою...",searching:"Пошук...",check:"Перевірити",clear:"Очистити",
    word_preview_title:"🆕 Preview слова",add_preview_database:"➕ Додати preview у базу",adding:"Додавання...",text_analysis_title:"🧾 Аналіз тексту",
    pwa_analyzing:"PWA аналіз...",pwa_analysis:"🧾 Аналіз як у PWA",ai_analyzing:"AI аналіз...",ai_analysis:"✨ AI аналіз",
    total:"Усього",learned:"Вивчені",in_base:"Є в базі",not_in_base:"Немає в базі",learned_legend:"Вивчено",in_database:"Є в базі",
    not_in_database_candidate:"Немає в базі / кандидат",ai_candidates:"✨ AI кандидати",pwa_candidates:"🧾 PWA кандидати",
    select_new:"Вибрати нові",clear_all:"Зняти всі",already_in_learning:"вже в навчанні",in_database_short:"є в базі",not_in_database_short:"немає в базі",
    expression:"вираз",open_card:"📖 Відкрити картку",already_in_base_by_analyzer:"✅ Уже є в базі за аналізом",nothing_found:"Нічого не знайдено.",
    text_methodology:"📊 Методологія тексту",sentences:"🧾 Речення",word_map:"🧩 Розмітка слів",not_in_base_section:"🔴 Не в базі",no_new_words_found:"Нових слів не знайдено.",
    word_preview_modal:"Preview слова",stop_audio:"Зупинити звук",close:"Закрити",forms:"Форми",pronounce:"Озвучити",add_to_learning:"➕ Додати до навчання",
    in_learning:"У навчанні",sentence:"Речення",translate_explain:"✨ Перекласти й пояснити",translation:"Переклад",literal_meaning:"Дослівно",
    grammar:"Граматика",expressions:"Вирази",ai_explanation:"AI пояснення",ai_explanation_hint:"Натисни кнопку AI, щоб отримати переклад і пояснення.",
    pronounce_sentence:"Озвучити речення",enter_word_to_check:"Введи слово для перевірки.",word_found:"Слово знайдено.",
    new_word_review_preview:"Нове слово. Перевір preview перед додаванням.",could_not_process_word:"Не вдалося обробити слово.",
    preview_ready:"Preview готовий. Можна додати в базу.",word_added_global:"Слово додано до глобальної бази.",
    pwa_ready:"PWA аналіз готовий. У базі: {inBase}, кандидатів на додавання: {unknown}. Галочки зняті — вибери потрібні.",
    ai_ready:"AI аналіз готовий. У базі: {inBase}, кандидатів на додавання: {unknown}. Галочки зняті — вибери потрібні.",
    select_words_to_add:"Вибери слова для додавання.",adding_selected:"Додаю вибрані елементи: {count}...",
    already_exists:"Вже є в базі",added_to_database:"Додано в базу",preview_not_created:"Preview не створено",
    done_counts:"Готово. Додано: {ok}, вже було: {duplicate}, помилок: {fail}.",
    candidates_summary:"У базі: {inBase} · Кандидати на додавання: {unknown} · Вибрано: {selected}",
    add_selected_count:"➕ Додати вибрані ({count})",adding_short:"Додаю...",
    unique_words_not_in_base:"Унікальних слів не в базі: {count}",words_in_base_not_learned:"Слів є в базі, але не вивчено: {count}",database_coverage:"Покриття базою: {coverage}%",
  },
  en: {
    reading_title:"📖 Reading Mode",reading_subtitle:"PWA analysis and AI analysis work independently, but both use the local base for highlighting.",
    word_analysis_title:"🔎 Word Analysis",word_input_placeholder:"Enter word in any language...",searching:"Searching...",check:"Check",clear:"Clear",
    word_preview_title:"🆕 Word Preview",add_preview_database:"➕ Add preview to database",adding:"Adding...",text_analysis_title:"🧾 Text Analysis",
    pwa_analyzing:"PWA analyzing...",pwa_analysis:"🧾 PWA-style analysis",ai_analyzing:"AI analyzing...",ai_analysis:"✨ AI analysis",
    total:"Total",learned:"Learned",in_base:"In base",not_in_base:"Not in base",learned_legend:"Learned",in_database:"In database",
    not_in_database_candidate:"Not in database / candidate",ai_candidates:"✨ AI candidates",pwa_candidates:"🧾 PWA candidates",
    select_new:"Select new",clear_all:"Clear all",already_in_learning:"already in learning",in_database_short:"in database",not_in_database_short:"not in database",
    expression:"expression",open_card:"📖 Open card",already_in_base_by_analyzer:"✅ Already in base by analyzer",nothing_found:"Nothing found.",
    text_methodology:"📊 Text Methodology",sentences:"🧾 Sentences",word_map:"🧩 Word map",not_in_base_section:"🔴 Not in database",no_new_words_found:"No new words found.",
    word_preview_modal:"Word preview",stop_audio:"Stop audio",close:"Close",forms:"Forms",pronounce:"Pronounce",add_to_learning:"➕ Add to learning",
    in_learning:"In learning",sentence:"Sentence",translate_explain:"✨ Translate & explain",translation:"Translation",literal_meaning:"Literal meaning",
    grammar:"Grammar",expressions:"Expressions",ai_explanation:"AI explanation",ai_explanation_hint:"Press AI button to get translation and explanation.",
    pronounce_sentence:"Pronounce sentence",enter_word_to_check:"Enter a word to check.",word_found:"Word found.",
    new_word_review_preview:"New word. Review preview before adding.",could_not_process_word:"Could not process word.",
    preview_ready:"Preview ready. You can add it to database.",word_added_global:"Word added to global database.",
    pwa_ready:"PWA analysis ready. In base: {inBase}, candidates to add: {unknown}. Nothing is preselected.",
    ai_ready:"AI analysis ready. In base: {inBase}, candidates to add: {unknown}. Nothing is preselected.",
    select_words_to_add:"Select words to add.",adding_selected:"Adding selected items: {count}...",
    already_exists:"Already in database",added_to_database:"Added to database",preview_not_created:"Preview was not created",
    done_counts:"Done. Added: {ok}, already existed: {duplicate}, errors: {fail}.",
    candidates_summary:"In base: {inBase} · Add candidates: {unknown} · Selected: {selected}",
    add_selected_count:"➕ Add selected ({count})",adding_short:"Adding...",
    unique_words_not_in_base:"Unique words not in base: {count}",words_in_base_not_learned:"Words in base, not learned: {count}",database_coverage:"Database coverage: {coverage}%",
  },
  no: {
    reading_title:"📖 Lesemodus",reading_subtitle:"PWA-analyse og AI-analyse fungerer separat, men begge bruker den lokale databasen til markering.",
    word_analysis_title:"🔎 Ordanalyse",word_input_placeholder:"Skriv inn et ord på valgfritt språk...",searching:"Søker...",check:"Sjekk",clear:"Tøm",
    word_preview_title:"🆕 Forhåndsvisning av ord",add_preview_database:"➕ Legg forhåndsvisning til i databasen",adding:"Legger til...",text_analysis_title:"🧾 Tekstanalyse",
    pwa_analyzing:"PWA analyserer...",pwa_analysis:"🧾 PWA-lignende analyse",ai_analyzing:"AI analyserer...",ai_analysis:"✨ AI-analyse",
    total:"Totalt",learned:"Lært",in_base:"I basen",not_in_base:"Ikke i basen",learned_legend:"Lært",in_database:"I databasen",
    not_in_database_candidate:"Ikke i databasen / kandidat",ai_candidates:"✨ AI-kandidater",pwa_candidates:"🧾 PWA-kandidater",
    select_new:"Velg nye",clear_all:"Fjern alle",already_in_learning:"allerede i læring",in_database_short:"i databasen",not_in_database_short:"ikke i databasen",
    expression:"uttrykk",open_card:"📖 Åpne kort",already_in_base_by_analyzer:"✅ Allerede i basen ifølge analysen",nothing_found:"Ingenting funnet.",
    text_methodology:"📊 Tekstmetodikk",sentences:"🧾 Setninger",word_map:"🧩 Ordkart",not_in_base_section:"🔴 Ikke i databasen",no_new_words_found:"Ingen nye ord funnet.",
    word_preview_modal:"Forhåndsvisning av ord",stop_audio:"Stopp lyd",close:"Lukk",forms:"Former",pronounce:"Uttal",add_to_learning:"➕ Legg til i læring",
    in_learning:"I læring",sentence:"Setning",translate_explain:"✨ Oversett og forklar",translation:"Oversettelse",literal_meaning:"Bokstavelig betydning",
    grammar:"Grammatikk",expressions:"Uttrykk",ai_explanation:"AI-forklaring",ai_explanation_hint:"Trykk på AI-knappen for å få oversettelse og forklaring.",
    pronounce_sentence:"Uttal setningen",enter_word_to_check:"Skriv inn et ord for å sjekke.",word_found:"Ordet ble funnet.",
    new_word_review_preview:"Nytt ord. Sjekk forhåndsvisningen før du legger det til.",could_not_process_word:"Kunne ikke behandle ordet.",
    preview_ready:"Forhåndsvisningen er klar. Du kan legge det til i databasen.",word_added_global:"Ordet ble lagt til i den globale databasen.",
    pwa_ready:"PWA-analysen er klar. I basen: {inBase}, kandidater å legge til: {unknown}. Ingenting er forhåndsvalgt.",
    ai_ready:"AI-analysen er klar. I basen: {inBase}, kandidater å legge til: {unknown}. Ingenting er forhåndsvalgt.",
    select_words_to_add:"Velg ord som skal legges til.",adding_selected:"Legger til valgte elementer: {count}...",
    already_exists:"Finnes allerede i databasen",added_to_database:"Lagt til i databasen",preview_not_created:"Forhåndsvisning ble ikke opprettet",
    done_counts:"Ferdig. Lagt til: {ok}, fantes fra før: {duplicate}, feil: {fail}.",
    candidates_summary:"I basen: {inBase} · Kandidater å legge til: {unknown} · Valgt: {selected}",
    add_selected_count:"➕ Legg til valgte ({count})",adding_short:"Legger til...",
    unique_words_not_in_base:"Unike ord ikke i basen: {count}",words_in_base_not_learned:"Ord i basen, men ikke lært: {count}",database_coverage:"Database-dekning: {coverage}%",
  },
} as const;

function normalizeAppLanguage(v: any): AppLanguage { return v==="ua"||v==="en"||v==="no"?v:"ua"; }
function formatTemplate(tmpl: string, vals?: Record<string,string|number>) {
  if (!vals) return tmpl;
  return Object.entries(vals).reduce((a,[k,v])=>a.replace(new RegExp(`\\{${k}\\}`,"g"),String(v)),tmpl);
}
function makeReadingTranslator(lang: AppLanguage) {
  return (key: ReadingTextKey, vals?: Record<string,string|number>) => {
    const fb = READING_TEXT[lang]?.[key]??READING_TEXT.en[key]??key;
    const g = t(key as any,lang as any);
    return formatTemplate(g&&g!==key?g:fb,vals);
  };
}
function pickTranslation(item: any, lang: AppLanguage) {
  if (!item) return "";
  const ua=item.ua||item.translation_ua||item.meaning_ua||"";
  const en=item.en||item.translation_en||item.meaning_en||"";
  const no=item.no||item.translation_no||item.meaning_no||"";
  if(lang==="ua")return ua||en||no||"";
  if(lang==="no")return no||en||ua||"";
  return en||ua||no||"";
}
function pickCandidateMeaning(c: AnalyzerCandidate,lang: AppLanguage){return pickTranslation({meaning_ua:c.meaning_ua,meaning_en:c.meaning_en,meaning_no:c.meaning_no},lang);}
function hasVerificationData(item: any){return Boolean(item?.verification_tier||item?.tier||item?.verification_evidence||item?.evidence||item?.source_verified||item?.sourceVerified);}
function getVerificationDotColor(item: any){if(!hasVerificationData(item))return "";return resolveVerification(item).dot;}
function VerificationMiniDot({item}:{item:any}){const c=getVerificationDotColor(item);if(!c)return null;return <View style={[s.miniDot,{backgroundColor:c}]}/>;}

function getFormLabels(word: any):{label:string;value:string}[]{
  const forms:{label:string;value:string}[]=[];
  const pos=(word?.pos||word?.type||word?.category||"").toLowerCase();
  if(word?.noun_forms){const nf=word.noun_forms;["ubest_entall","best_entall","ubest_flertall","best_flertall"].forEach(k=>{if(nf[k])forms.push({label:k.replace("_"," "),value:nf[k]});});return forms;}
  if(word?.verb_forms){const vf=word.verb_forms;["infinitiv","presens","preteritum","perfektum"].forEach(k=>{if(vf[k])forms.push({label:k,value:vf[k]});});return forms;}
  if(word?.adjective_forms){const af=word.adjective_forms;["positiv","intetkjonn","flertall"].forEach(k=>{if(af[k])forms.push({label:k,value:af[k]});});return forms;}
  const isV=pos.includes("verb"),isN=pos.includes("noun")||pos.includes("subst"),isA=pos.includes("adj");
  const fLabels=isV?["infinitiv","presens","preteritum","perfektum"]:isN?["ub. ent.","best. ent.","ub. flt.","best. flt."]:isA?["positiv","intetkjønn","flertall"]:["f1","f2","f3","f4","f5"];
  ["f1","f2","f3","f4","f5"].forEach((k,i)=>{if(word?.[k])forms.push({label:fLabels[i]||k,value:word[k]});});
  return forms;
}

function normalizeToken(v:string){return String(v||"").toLowerCase().replace(/[.,!?;:()"«»]/g,"").replace(/^å\s+/i,"").replace(/^(en|ei|et)\s+/i,"").trim();}

function adaptV7ResponseToLegacyFormat(v7:any,dict:Map<string,any>):{ok:boolean;known:any[];missing:any[];expressions:any[]}{
  const items:any[]=v7?.ingestion?.planned_items??[];
  const isOk=v7?.ok===true&&items.length>0;
  const known:any[]=[],missing:any[]=[],expressions:any[]=[];
  for(const item of items){
    const sk=normalizeToken(item.surface_form??""),lk=normalizeToken(item.normalized_lemma??"");
    const lm=(sk&&dict.get(sk))||(lk&&dict.get(lk))||null;
    if(item.match_type==="expression"){
      expressions.push({text:item.surface_form||item.normalized_lemma,lemma:item.normalized_lemma,type:"expression",expression_subtype:item.expression_subtype??null,in_base:true,
        found:lm??(item.expression_id?{id:item.expression_id,lemma:item.normalized_lemma}:null),
        meaning_ua:lm?.translation_ua||lm?.ua||"",meaning_en:lm?.translation_en||lm?.en||"",cefr:lm?.cefr||item.cefr||"",frequency_level:lm?.frequency_level||item.frequency_level||"",chunk_index:item.chunk_index??0});
    } else {
      const r=item.resolved,ld=lm||(r?.lexeme_id?{id:r.lexeme_id,lemma:r.lemma??item.normalized_lemma,pos:r.pos}:null);
      if(ld)known.push({text:item.surface_form,lemma:item.normalized_lemma,match_type:"single",in_base:true,found:ld});
      else missing.push({text:item.surface_form,lemma:item.normalized_lemma,type:item.pos??null,in_base:false,found:null,meaning_ua:"",meaning_en:""});
    }
  }
  return{ok:isOk,known,missing,expressions};
}

function splitWords(t:string){return String(t||"").split(/\s+/).map(i=>i.trim()).filter(Boolean);}
function splitSentences(t:string){return String(t||"").replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]?/g)?.map(i=>i.trim()).filter(Boolean)||[];}
function makeCandidateId(src:string,kind:string,item:any,idx:number){return `${src}-${kind}-${item?.lemma||item?.text||"item"}-${idx}`;}
function displayCandidateText(item:AnalyzerCandidate){return item.lemma||item.text||"";}
async function boostReadingHits(items:AnalysisItem[],user:string){
  try{const ids=Array.from(new Set(items.map(i=>i.lexeme?.id).filter(Boolean)));if(!ids.length)return;await boostReadingLexemeHitsInSupabase({preferred_user:user,lexemeIds:ids});}catch{}
}

export default function ReadingScreen() {
  const { theme, fonts } = useTheme();
  const { preferred_user, app_language } = useSettingsStore();
  const lang = normalizeAppLanguage(app_language);
  const tr = useMemo(()=>makeReadingTranslator(lang),[lang]);

  const [text,setText]=useState("");
  const [wordQuery,setWordQuery]=useState("");
  const [wordSearchMessage,setWordSearchMessage]=useState("");
  const [loading,setLoading]=useState(false);
  const [wordLoading,setWordLoading]=useState(false);
  const [pwaLoading,setPwaLoading]=useState(false);
  const [aiTextLoading,setAiTextLoading]=useState(false);
  const [batchAdding,setBatchAdding]=useState(false);
  const [analysis,setAnalysis]=useState<AnalysisItem[]>([]);
  const [sentences,setSentences]=useState<string[]>([]);
  const [error,setError]=useState("");
  const [activeSource,setActiveSource]=useState<AnalysisSource|null>(null);
  const [analyzerResult,setAnalyzerResult]=useState<any>(null);
  const [analyzerCandidates,setAnalyzerCandidates]=useState<AnalyzerCandidate[]>([]);
  const [analyzerMessage,setAnalyzerMessage]=useState("");
  const [selectedWord,setSelectedWord]=useState<any>(null);
  const [selectedSentence,setSelectedSentence]=useState<string|null>(null);
  const [sentenceAI,setSentenceAI]=useState<SentenceAIResult|null>(null);
  const [sentenceUsage,setSentenceUsage]=useState<any>(null);
  const [sentenceLoading,setSentenceLoading]=useState(false);
  const [sentenceError,setSentenceError]=useState("");
  const [addingWord,setAddingWord]=useState(false);
  const [show360,setShow360]=useState(false);
  const [word360,setWord360]=useState<{id:string;lemma:string;pos?:string}|null>(null);
  const [addingGlobalWord,setAddingGlobalWord]=useState(false);
  const [previewWord,setPreviewWord]=useState<any>(null);

  const stats=useMemo(()=>{
    const total=analysis.length,learned=analysis.filter(i=>i.status==="learned").length;
    const inBase=analysis.filter(i=>i.status==="in_base").length,unknown=analysis.filter(i=>i.status==="unknown").length;
    return{total,learned,inBase,unknown,coverage:total>0?Math.round(((learned+inBase)/total)*100):0};
  },[analysis]);

  const selectedCandidates=analyzerCandidates.filter(i=>i.selected&&!i.added&&i.status==="unknown");
  const unknownCandidatesCount=analyzerCandidates.filter(i=>i.status==="unknown").length;
  const inBaseCandidatesCount=analyzerCandidates.filter(i=>i.status==="in_base"||i.status==="learned").length;
  const uniqueUnknownWords=Array.from(new Set(analysis.filter(i=>i.status==="unknown"&&i.normalized).map(i=>i.normalized)));
  const uniqueInBaseWords=Array.from(new Map(analysis.filter(i=>i.status==="in_base"&&i.normalized).map(i=>[i.normalized,i])).values());

  function clearText(){setText("");setAnalysis([]);setSentences([]);setError("");setSelectedWord(null);setSelectedSentence(null);setSentenceAI(null);setSentenceUsage(null);setSentenceError("");setAddingWord(false);setActiveSource(null);setAnalyzerResult(null);setAnalyzerCandidates([]);setAnalyzerMessage("");}
  function clearWordSearch(){setWordQuery("");setWordSearchMessage("");setPreviewWord(null);}
  function openSentence(sentence:string){setSelectedSentence(sentence);setSentenceAI(null);setSentenceUsage(null);setSentenceError("");}

  async function buildLocalDictionary(){
    const lexemes=await getReadingLexemesFromSupabase(preferred_user);
    const dict=new Map<string,any>();
    function addKey(raw:any,word:any){const k=normalizeToken(String(raw||""));if(!k)return;const ex=dict.get(k);if(!ex||word.learned)dict.set(k,word);}
    function addVariants(raw:any,word:any){const v=String(raw||"").trim();if(!v)return;[v,v.replace(/^å\s+/i,""),v.replace(/^(en|ei|et)\s+/i,"")].forEach(x=>addKey(x,word));}
    lexemes.forEach((w:any)=>[w.lemma,w.word,w.display_form,w.canonical,w.f1,w.f2,w.f3,w.f4,w.f5].forEach(k=>addVariants(k,w)));
    return dict;
  }

  async function analyzeTextLocal(){
    const dict=await buildLocalDictionary();
    const result=splitWords(text).map(raw=>{
      const normalized=normalizeToken(raw),found=dict.get(normalized);
      let status:WordStatus="unknown";
      if(found?.learned)status="learned";else if(found)status="in_base";
      return{text:raw,normalized,status,lexeme:found||null,translation:found?pickTranslation(found,lang):""};
    });
    setAnalysis(result);setSentences(splitSentences(text));boostReadingHits(result,preferred_user);
    return{dictionary:dict,localAnalysis:result};
  }

  function rebuildAnalysisFromEdgeResult(result:any,learnedIds:Set<string>){
    const map=new Map<string,any>();
    for(const item of result.known||[]){if(!item.found)continue;for(const tok of (item.text||"").split(/\s+/).filter(Boolean)){const k=normalizeToken(tok);if(!k)continue;const lx={...item.found,learned:learnedIds.has(item.found.id)};if(!map.has(k)||lx.learned)map.set(k,lx);}}
    for(const item of result.expressions||[]){if(!item.in_base||!item.found)continue;for(const tok of (item.text||"").split(/\s+/).filter(Boolean)){const k=normalizeToken(tok);if(!k)continue;const lx={...item.found,ua:item.found.ua||item.meaning_ua||"",en:item.found.en||item.meaning_en||"",learned:learnedIds.has(item.found.id)};if(!map.has(k)||lx.learned)map.set(k,lx);}}
    const na=splitWords(text).map(raw=>{const k=normalizeToken(raw),found=map.get(k);let status:WordStatus="unknown";if(found?.learned)status="learned";else if(found)status="in_base";return{text:raw,normalized:k,status,lexeme:found||null,translation:found?pickTranslation(found,lang):""};});
    setAnalysis(na);setSentences(splitSentences(text));boostReadingHits(na,preferred_user);
  }

  function getCandidateLocalStatus(item:any,dict:Map<string,any>){
    if(item?.in_base===true){const lx=item?.found||null;if(lx?.learned)return{status:"learned" as WordStatus,lexeme:lx};return{status:"in_base" as WordStatus,lexeme:lx};}
    if(item?.in_base===false)return{status:"unknown" as WordStatus,lexeme:null};
    const keys=new Set<string>();
    [item?.lemma,item?.text,item?.word,item?.canonical,item?.display_form,item?.found?.lemma,item?.found?.word,item?.found?.display_form,item?.found?.canonical].forEach(raw=>{const v=String(raw||"").trim();if(!v)return;[v,v.replace(/^å\s+/i,""),v.replace(/^(en|ei|et)\s+/i,"")].map(normalizeToken).filter(Boolean).forEach(k=>keys.add(k));});
    for(const k of keys){const f=dict.get(k);if(f?.learned)return{status:"learned" as WordStatus,lexeme:f};if(f)return{status:"in_base" as WordStatus,lexeme:f};}
    if(item?.found)return{status:"in_base" as WordStatus,lexeme:item.found};
    return{status:"unknown" as WordStatus,lexeme:null};
  }

  function buildAnalyzerCandidates(result:any,source:AnalysisSource,dict:Map<string,any>){
    const map=(item:any,index:number,kind:"missing"|"expression"):AnalyzerCandidate=>{
      const local=getCandidateLocalStatus(item,dict);
      return{id:makeCandidateId(source,kind,item,index),selected:false,source,kind,status:local.status,lexeme:local.lexeme,
        text:item.text||item.lemma||"",lemma:item.lemma||item.text||"",type:item.type||(kind==="expression"?"expression":""),
        meaning_ua:item.meaning_ua||item.translation_ua||item.ua||"",meaning_en:item.meaning_en||item.translation_en||item.en||"",
        meaning_no:item.meaning_no||item.translation_no||item.no||"",example:item.example||"",confidence:item.confidence||"",
        cefr:item.cefr||"",frequency_level:item.frequency_level||"",expression_subtype:item.expression_subtype||"",raw:item};
    };
    return[...(result?.missing||[]).map((i:any,idx:number)=>map(i,idx,"missing")),...(result?.expressions||[]).map((i:any,idx:number)=>map(i,idx,"expression"))];
  }

  function toggleCandidate(id:string){setAnalyzerCandidates(prev=>prev.map(item=>{if(item.id!==id)return item;if(item.status!=="unknown"||item.added)return item;return{...item,selected:!item.selected};}));}
  function selectAllUnknownCandidates(){setAnalyzerCandidates(prev=>prev.map(item=>({...item,selected:item.status==="unknown"&&!item.added})));}
  function unselectAllCandidates(){setAnalyzerCandidates(prev=>prev.map(item=>({...item,selected:false})));}

  async function checkWord(){
    try{
      const nq=normalizeToken(wordQuery);if(!nq){setWordSearchMessage(tr("enter_word_to_check"));return;}
      setWordLoading(true);setWordSearchMessage("");setSelectedWord(null);setPreviewWord(null);
      const r=await inspectWordViaAppsScript(nq);
      if(r?.found&&r?.item){setSelectedWord({...r.item,learned:false,ua:r.item.ua||r.item.translation_ua||"",en:r.item.en||r.item.translation_en||"",category:r.item.type||r.item.category||""});setWordSearchMessage(tr("word_found"));return;}
      if(r?.preview){setPreviewWord(r.preview);setWordSearchMessage(tr("new_word_review_preview"));return;}
      setWordSearchMessage((r as any)?.message||tr("could_not_process_word"));
    }catch(err:any){setWordSearchMessage(String(err?.message||err));}finally{setWordLoading(false);}
  }

  async function inspectUnknownWord(value:string){
    const q=normalizeToken(value);if(!q)return;
    setWordQuery(q);setPreviewWord(null);setSelectedWord(null);setWordSearchMessage("");
    try{
      setWordLoading(true);const r=await inspectWordViaAppsScript(q);
      if(r?.found&&r?.item){setSelectedWord({...r.item,learned:false,ua:r.item.ua||r.item.translation_ua||"",en:r.item.en||r.item.translation_en||"",category:r.item.type||r.item.category||""});setWordSearchMessage(tr("word_found"));return;}
      if(r?.preview){setPreviewWord(r.preview);setWordSearchMessage(tr("preview_ready"));return;}
      setWordSearchMessage((r as any)?.message||tr("could_not_process_word"));
    }catch(err:any){setWordSearchMessage(String(err?.message||err));}finally{setWordLoading(false);}
  }

  async function addWordToGlobalBase(){
    try{if(!previewWord)return;setAddingGlobalWord(true);const r=await addPreviewWordViaAppsScript(previewWord);if(!r?.ok)throw new Error((r as any)?.message||"Add preview failed");setWordSearchMessage(tr("word_added_global"));setPreviewWord(null);await checkWord();}
    catch(err:any){setWordSearchMessage(String(err?.message||err));}finally{setAddingGlobalWord(false);}
  }

  async function loadSentenceAI(){
    try{if(!selectedSentence)return;setSentenceLoading(true);setSentenceError("");
      const data=await translateSentenceWithAI({sentence:selectedSentence,profileKey:preferred_user,targetLanguage:lang==="ua"?"ua":"en"});
      setSentenceAI(data.result||null);setSentenceUsage(data.usage||null);
    }catch(err:any){setSentenceError(String(err?.message||err));}finally{setSentenceLoading(false);}
  }

  async function addCurrentWordToLearning(){
    try{if(!selectedWord?.id)return;setAddingWord(true);await addLexemeToLearningFromSupabase({preferred_user,lexemeId:selectedWord.id});
      setAnalysis(prev=>prev.map(item=>item.lexeme?.id===selectedWord.id?{...item,status:"learned",lexeme:{...item.lexeme,learned:true}}:item));
      setSelectedWord({...selectedWord,learned:true});
    }catch(err:any){setError(String(err?.message||err));}finally{setAddingWord(false);}
  }

  async function runAnalysis(source: AnalysisSource){
    const isPwa=source==="pwa";
    try{
      if(!text.trim())return;
      if(isPwa)setPwaLoading(true);else setAiTextLoading(true);
      setLoading(true);setError("");setAnalyzerMessage("");setAnalyzerResult(null);setAnalyzerCandidates([]);setActiveSource(source);
      const{dictionary}=await analyzeTextLocal();
      const learnedIds=new Set<string>(Array.from(dictionary.values()).filter((w:any)=>w.learned&&w.id).map((w:any)=>w.id));
      const result=await analyzeTextViaAppsScript(text.trim());
      if(!result?.ok)throw new Error(result?.message||(isPwa?"PWA text analyzer failed":"AI text analyzer failed"));
      const adapted=adaptV7ResponseToLegacyFormat(result,dictionary);
      rebuildAnalysisFromEdgeResult(adapted,learnedIds);
      const candidates=buildAnalyzerCandidates(adapted,source,dictionary);
      setAnalyzerResult(adapted);setAnalyzerCandidates(candidates);
      const unk=candidates.filter(i=>i.status==="unknown").length,inB=candidates.filter(i=>i.status==="in_base"||i.status==="learned").length;
      setAnalyzerMessage(tr(isPwa?"pwa_ready":"ai_ready",{inBase:inB,unknown:unk}));
    }catch(err:any){setAnalyzerMessage(String(err?.message||err));}
    finally{if(isPwa)setPwaLoading(false);else setAiTextLoading(false);setLoading(false);}
  }

  async function addSelectedAnalyzerItems(){
    if(!selectedCandidates.length){setAnalyzerMessage(tr("select_words_to_add"));return;}
    setBatchAdding(true);setAnalyzerMessage(tr("adding_selected",{count:selectedCandidates.length}));
    let ok=0,dup=0,fail=0;const proc:Record<string,any>={};
    for(const c of selectedCandidates){
      const q=displayCandidateText(c).trim();if(!q){fail++;proc[c.id]={ok:false,message:"Empty"};continue;}
      try{
        if(c.kind==="expression"){
          const r=await addExpressionCandidateToSupabase({candidate:c.raw,preferred_user});
          if(!r?.ok){fail++;proc[c.id]={ok:false,message:r?.message||"Add failed"};continue;}
          ok+=r.alreadyExists?0:1;dup+=r.alreadyExists?1:0;
          proc[c.id]={ok:true,duplicate:r.alreadyExists,message:r.alreadyExists?tr("already_exists"):tr("added_to_database"),foundItem:r.item||null};continue;
        }
        const ir=await inspectWordViaAppsScript(q);
        if(ir?.found&&ir?.item){dup++;proc[c.id]={ok:true,duplicate:true,message:tr("already_exists"),foundItem:ir.item};continue;}
        if(!ir?.preview){fail++;proc[c.id]={ok:false,message:(ir as any)?.message||tr("preview_not_created")};continue;}
        const ar=await addPreviewWordViaAppsScript(ir.preview);
        if(!ar?.ok){fail++;proc[c.id]={ok:false,message:(ar as any)?.message||"Add failed"};continue;}
        const rr=await inspectWordViaAppsScript(ir.preview.word||q);ok++;
        proc[c.id]={ok:true,message:(ar as any)?.message||tr("added_to_database"),foundItem:rr?.item||null};
      }catch(err:any){fail++;proc[c.id]={ok:false,message:String(err?.message||err)};}
    }
    setAnalyzerCandidates(prev=>prev.map(c=>{const r=proc[c.id];if(!r)return c;if(!r.ok)return{...c,selected:false,error:r.message||"Add failed"};return{...c,selected:false,added:true,status:"in_base",lexeme:r.foundItem||c.lexeme,error:""};}));
    const{dictionary}=await analyzeTextLocal();
    setAnalyzerCandidates(prev=>prev.map(c=>{const local=getCandidateLocalStatus(c.raw,dictionary);return{...c,status:local.status,lexeme:local.lexeme||c.lexeme,selected:false,added:c.added||local.status==="in_base"||local.status==="learned"};}));
    setAnalyzerMessage(tr("done_counts",{ok,duplicate:dup,fail}));setBatchAdding(false);
  }

  async function inspectCandidate(c:AnalyzerCandidate){if(c.lexeme){setSelectedWord(c.lexeme);return;}await inspectUnknownWord(displayCandidateText(c));}

  // ─── theme-derived colours ────────────────────────────────────────────────
  const T = theme; // shorthand
  const F = fonts;

  return (
    <>
      <ScrollView style={{flex:1,backgroundColor:T.background}} contentContainerStyle={s.content}>
        <Text style={[s.title,{color:T.textPrimary,fontSize:20}]}>{tr("reading_title")}</Text>
        <Text style={[s.subtitle,{color:T.textSecondary,fontSize:F.base}]}>{tr("reading_subtitle")}</Text>

        {/* Word check card */}
        <View style={[s.card,{backgroundColor:T.card,borderColor:T.border}]}>
          <Text style={[s.sectionTitle,{color:T.textPrimary,fontSize:F.base+4}]}>{tr("word_analysis_title")}</Text>
          <TextInput style={[s.wordInput,{backgroundColor:T.inputBg,borderColor:T.border,color:T.textPrimary}]} value={wordQuery} onChangeText={setWordQuery} placeholder={tr("word_input_placeholder")} placeholderTextColor={T.textMuted} autoCapitalize="none"/>
          <View style={s.actionsRow}>
            <Pressable style={[s.btn,{backgroundColor:T.accent,flex:1},wordLoading&&s.disabled]} disabled={wordLoading||!wordQuery.trim()} onPress={checkWord}>
              <Text style={[s.btnText]}>{wordLoading?tr("searching"):tr("check")}</Text>
            </Pressable>
            <Pressable style={[s.clearBtn,{backgroundColor:T.cardAlt}]} onPress={clearWordSearch}>
              <Text style={[s.clearBtnText,{color:T.textPrimary}]}>{tr("clear")}</Text>
            </Pressable>
          </View>
          {previewWord?(<View style={[s.previewBox,{backgroundColor:T.cardAlt}]}>
            <Text style={[s.sectionTitle,{color:T.textPrimary,fontSize:F.base+3}]}>{tr("word_preview_title")}</Text>
            <Text style={[s.modalWord,{color:T.textPrimary,fontSize:F.word}]}>{previewWord.word}</Text>
            <Text style={[s.modalTrans,{color:T.accent,fontSize:F.translation}]}>{pickTranslation(previewWord,lang)}</Text>
            <Text style={[s.modalCat,{color:T.textMuted,fontSize:F.meta}]}>{previewWord.type||previewWord.category||""}{previewWord.gender?` · ${previewWord.gender}`:""}</Text>
            <View style={s.formsBox}>{getFormLabels(previewWord).map(({label,value})=>(<View key={label} style={s.formRow}><Text style={[s.formLabel,{color:T.textMuted}]}>{label}</Text><Text style={[s.formVal,{color:T.textPrimary}]}>{value}</Text></View>))}</View>
            {previewWord.example?(<View style={[s.exBox,{backgroundColor:T.cardInner}]}><Text style={[s.exText,{color:T.textSecondary}]}>{previewWord.example}</Text></View>):null}
            <Pressable style={[s.addBtn,{backgroundColor:T.accentBg},addingGlobalWord&&s.disabled]} disabled={addingGlobalWord} onPress={addWordToGlobalBase}>
              <Text style={[s.addBtnText,{color:T.accent}]}>{addingGlobalWord?tr("adding"):tr("add_preview_database")}</Text>
            </Pressable>
          </View>):null}
          {wordSearchMessage?(<View style={[s.msgBox,{backgroundColor:T.accentBg}]}><Text style={[s.msgText,{color:T.textPrimary,fontSize:F.base}]}>{wordSearchMessage}</Text></View>):null}
        </View>

        {/* Text analysis card */}
        <View style={[s.card,{backgroundColor:T.card,borderColor:T.border}]}>
          <Text style={[s.sectionTitle,{color:T.textPrimary,fontSize:F.base+4}]}>{tr("text_analysis_title")}</Text>
          <TextInput style={[s.textArea,{backgroundColor:T.inputBg,borderColor:T.border,color:T.textPrimary}]} value={text} onChangeText={setText} placeholder="Jeg har hatt det travelt i det siste..." placeholderTextColor={T.textMuted} multiline textAlignVertical="top"/>
          <View style={s.actionsCol}>
            <Pressable style={[s.pwaBtn,{backgroundColor:T.accentBg},pwaLoading&&s.disabled]} disabled={pwaLoading||aiTextLoading||!text.trim()} onPress={()=>runAnalysis("pwa")}>
              <Text style={[s.pwaBtnText,{color:T.accent}]}>{pwaLoading?tr("pwa_analyzing"):tr("pwa_analysis")}</Text>
            </Pressable>
            <Pressable style={[s.aiBtn,aiTextLoading&&s.disabled]} disabled={pwaLoading||aiTextLoading||!text.trim()} onPress={()=>runAnalysis("ai")}>
              <Text style={s.aiBtnText}>{aiTextLoading?tr("ai_analyzing"):tr("ai_analysis")}</Text>
            </Pressable>
            <Pressable style={[s.clearWide,{backgroundColor:T.cardAlt}]} onPress={clearText}>
              <Text style={[s.clearBtnText,{color:T.textPrimary}]}>{tr("clear")}</Text>
            </Pressable>
          </View>
        </View>

        {loading||pwaLoading||aiTextLoading?<ActivityIndicator size="large" color={T.accent}/>:null}
        {error?<Text style={[s.error,{backgroundColor:T.dangerSoft,color:T.danger}]}>{error}</Text>:null}
        {analyzerMessage?<View style={[s.msgBox,{backgroundColor:T.accentBg,marginBottom:14}]}><Text style={[s.msgText,{color:T.textPrimary,fontSize:F.base}]}>{analyzerMessage}</Text></View>:null}

        {/* Stats */}
        {analysis.length>0?(<>
          <View style={s.statsGrid}>
            {[{l:tr("total"),v:stats.total},{l:tr("learned"),v:stats.learned},{l:tr("in_base"),v:stats.inBase},{l:tr("not_in_base"),v:stats.unknown},{l:"Coverage",v:`${stats.coverage}%`}].map(({l,v})=>(
              <View key={l} style={[s.statCard,{backgroundColor:T.card,borderColor:T.border}]}>
                <Text style={[s.statVal,{color:T.accent,fontSize:F.translation}]}>{v}</Text>
                <Text style={[s.statLabel,{color:T.textMuted,fontSize:F.meta}]}>{l}</Text>
              </View>
            ))}
          </View>
          <View style={[s.legendCard,{backgroundColor:T.card,borderColor:T.border}]}>
            <Text style={[s.legendText,{color:T.textSecondary,fontSize:F.base}]}>🟢 {tr("learned_legend")}</Text>
            <Text style={[s.legendText,{color:T.textSecondary,fontSize:F.base}]}>🟡 {tr("in_database")}</Text>
            <Text style={[s.legendText,{color:T.textSecondary,fontSize:F.base}]}>🔴 {tr("not_in_database_candidate")}</Text>
          </View>
        </>):null}

        {/* Candidates */}
        {analyzerCandidates.length>0?(<View style={[s.card,{backgroundColor:T.card,borderColor:T.border}]}>
          <Text style={[s.sectionTitle,{color:T.textPrimary,fontSize:F.base+4}]}>{activeSource==="ai"?tr("ai_candidates"):tr("pwa_candidates")}</Text>
          <Text style={[s.methodText,{color:T.textSecondary,fontSize:F.base}]}>{tr("candidates_summary",{inBase:inBaseCandidatesCount,unknown:unknownCandidatesCount,selected:selectedCandidates.length})}</Text>
          <View style={s.actionsRow}>
            <Pressable style={[s.smallCtrl,{backgroundColor:T.cardAlt}]} onPress={selectAllUnknownCandidates}><Text style={[s.smallCtrlText,{color:T.textPrimary}]}>{tr("select_new")}</Text></Pressable>
            <Pressable style={[s.smallCtrl,{backgroundColor:T.cardAlt}]} onPress={unselectAllCandidates}><Text style={[s.smallCtrlText,{color:T.textPrimary}]}>{tr("clear_all")}</Text></Pressable>
          </View>
          {analyzerCandidates.map(candidate=>{
            const vs=candidate.lexeme||candidate.raw;
            return(<View key={candidate.id} style={[s.candidateCard,candidate.status==="learned"&&s.cLearned,candidate.status==="in_base"&&s.cInBase,candidate.status==="unknown"&&s.cUnknown]}>
              <Pressable style={s.candidateHeader} onPress={()=>toggleCandidate(candidate.id)}>
                <Text style={s.checkbox}>{candidate.added?"✅":candidate.status!=="unknown"?"🟡":candidate.selected?"☑️":"⬜️"}</Text>
                <View style={{flex:1}}>
                  <View style={s.candidateTitleRow}>
                    <Text style={[s.candidateTitle,{color:T.textPrimary,fontSize:F.base+2}]}>{displayCandidateText(candidate)}</Text>
                    <VerificationMiniDot item={vs}/>
                  </View>
                  <Text style={[s.candidateMeta,{color:T.textMuted,fontSize:F.meta}]}>
                    {candidate.status==="learned"?tr("already_in_learning"):candidate.status==="in_base"?tr("in_database_short"):tr("not_in_database_short")}
                    {" · "}{candidate.kind==="expression"?tr("expression"):candidate.type||"word"}
                    {candidate.expression_subtype?` · ${candidate.expression_subtype}`:""}
                    {candidate.cefr?` · ${candidate.cefr}`:""}
                    {candidate.frequency_level?` · ${candidate.frequency_level}`:""}
                  </Text>
                </View>
              </Pressable>
              {hasVerificationData(vs)?(<View style={s.verRow}><VerificationBadge tier={vs.verification_tier||vs.tier} sourceVerified={vs.source_verified||vs.sourceVerified} evidence={vs.verification_evidence||vs.evidence} lemma={vs.lemma||vs.word||displayCandidateText(candidate)} size="sm" lang={lang}/></View>):null}
              {pickCandidateMeaning(candidate,lang)?<Text style={[s.candidateMeaning,{color:T.accent,fontSize:F.base}]}>{pickCandidateMeaning(candidate,lang)}</Text>:null}
              {candidate.example?<Text style={[s.candidateExample,{color:T.textSecondary,fontSize:F.base-1}]}>{candidate.example}</Text>:null}
              {candidate.error?<Text style={[s.candidateError,{color:T.danger}]}>❌ {candidate.error}</Text>:null}
              <Pressable style={[s.previewBtn,{backgroundColor:T.card}]} onPress={()=>inspectCandidate(candidate)}>
                <Text style={[s.previewBtnText,{color:T.accent}]}>{candidate.status==="unknown"?"🔎 Preview":tr("open_card")}</Text>
              </Pressable>
            </View>);
          })}
          <Pressable style={[s.addBtn,{backgroundColor:T.accentBg},(batchAdding||selectedCandidates.length===0)&&s.disabled]} disabled={batchAdding||selectedCandidates.length===0} onPress={addSelectedAnalyzerItems}>
            <Text style={[s.addBtnText,{color:T.accent,fontSize:F.base}]}>{batchAdding?tr("adding_short"):tr("add_selected_count",{count:selectedCandidates.length})}</Text>
          </Pressable>
        </View>):null}

        {/* Known */}
        {analyzerResult?(<View style={[s.card,{backgroundColor:T.card,borderColor:T.border}]}>
          <Text style={[s.sectionTitle,{color:T.textPrimary,fontSize:F.base+4}]}>{tr("already_in_base_by_analyzer")}</Text>
          {(analyzerResult.known||[]).length===0?<Text style={[s.emptyText,{color:T.textMuted}]}>{tr("nothing_found")}</Text>:
            (analyzerResult.known||[]).slice(0,80).map((item:any,i:number)=>(
              <View key={`k-${i}`} style={[s.knownItem,{borderBottomColor:T.border}]}>
                <Text style={[s.knownTitle,{color:T.accent,fontSize:F.base}]}>{item.lemma||item.text}</Text>
                {item.found?.ua||item.found?.en?<Text style={[s.knownTrans,{color:T.textSecondary,fontSize:F.base-1}]}>{pickTranslation(item.found,lang)}</Text>:null}
              </View>
            ))}
        </View>):null}

        {/* Methodology + sentences + word map */}
        {analysis.length>0?(<>
          <View style={[s.card,{backgroundColor:T.card,borderColor:T.border}]}>
            <Text style={[s.sectionTitle,{color:T.textPrimary,fontSize:F.base+4}]}>{tr("text_methodology")}</Text>
            <Text style={[s.methodText,{color:T.textSecondary,fontSize:F.base}]}>{tr("unique_words_not_in_base",{count:uniqueUnknownWords.length})}</Text>
            <Text style={[s.methodText,{color:T.textSecondary,fontSize:F.base}]}>{tr("words_in_base_not_learned",{count:uniqueInBaseWords.length})}</Text>
            <Text style={[s.methodText,{color:T.textSecondary,fontSize:F.base}]}>{tr("database_coverage",{coverage:stats.coverage})}</Text>
          </View>
          <View style={[s.card,{backgroundColor:T.card,borderColor:T.border}]}>
            <Text style={[s.sectionTitle,{color:T.textPrimary,fontSize:F.base+4}]}>{tr("sentences")}</Text>
            {sentences.map((sentence,i)=>(<Pressable key={`${sentence}-${i}`} style={[s.sentenceCard,{backgroundColor:T.cardAlt}]} onPress={()=>openSentence(sentence)}><Text style={[s.sentenceText,{color:T.textSecondary,fontSize:F.base}]}>{sentence}</Text></Pressable>))}
          </View>
          <View style={[s.card,{backgroundColor:T.card,borderColor:T.border}]}>
            <Text style={[s.sectionTitle,{color:T.textPrimary,fontSize:F.base+4}]}>{tr("word_map")}</Text>
            <View style={s.wordWrap}>
              {analysis.map((item,i)=>(<TouchableOpacity key={`${item.text}-${i}`} activeOpacity={0.7} onPress={()=>{if(item.lexeme){setSelectedWord(item.lexeme);return;}inspectUnknownWord(item.normalized);}}
                style={[s.chip,item.status==="learned"&&s.chipLearned,item.status==="in_base"&&s.chipInBase,item.status==="unknown"&&s.chipUnknown]}>
                <Text style={[s.chipText,item.status==="learned"&&s.txLearned,item.status==="in_base"&&s.txInBase,item.status==="unknown"&&s.txUnknown,{fontSize:F.base-1}]}>{item.text}</Text>
                {item.lexeme?<VerificationMiniDot item={item.lexeme}/>:null}
              </TouchableOpacity>))}
            </View>
          </View>
          <View style={[s.card,{backgroundColor:T.card,borderColor:T.border}]}>
            <Text style={[s.sectionTitle,{color:T.textPrimary,fontSize:F.base+4}]}>{tr("not_in_base_section")}</Text>
            {uniqueUnknownWords.length===0?<Text style={[s.emptyText,{color:T.textMuted}]}>{tr("no_new_words_found")}</Text>:
              uniqueUnknownWords.slice(0,80).map((item,i)=>(<Pressable key={`${item}-${i}`} onPress={()=>inspectUnknownWord(item)}><Text style={[s.unknownItem,{color:T.danger,borderBottomColor:T.border,fontSize:F.base}]}>{item}</Text></Pressable>))}
          </View>
        </>):null}
      </ScrollView>

      {/* ── Modal helper */}
      {[
        {visible:!!previewWord,onClose:()=>{stopSpeech();setPreviewWord(null);},content:(
          <>
            <Text style={[s.modalLabel,{color:T.textMuted,fontSize:F.meta}]}>{tr("word_preview_modal")}</Text>
            <Text style={[s.modalWord,{color:T.textPrimary,fontSize:F.word}]}>{previewWord?.word||previewWord?.lemma||wordQuery}</Text>
            <Text style={[s.modalTrans,{color:T.accent,fontSize:F.translation}]}>{pickTranslation(previewWord,lang)}</Text>
            <Text style={[s.modalCat,{color:T.textMuted,fontSize:F.meta}]}>{previewWord?.type||previewWord?.category||""}{previewWord?.gender?` · ${previewWord.gender}`:""}</Text>
            <View style={s.formsBox}>{getFormLabels(previewWord||{}).map(({label,value})=>(<View key={label} style={s.formRow}><Text style={[s.formLabel,{color:T.textMuted}]}>{label}</Text><Text style={[s.formVal,{color:T.textPrimary}]}>{value}</Text></View>))}</View>
            {previewWord?.example?<View style={[s.exBox,{backgroundColor:T.cardAlt}]}><Text style={[s.exText,{color:T.textSecondary}]}>{previewWord.example}</Text></View>:null}
            {previewWord?.notes_ua||previewWord?.notes?<View style={[s.exBox,{backgroundColor:T.cardAlt}]}><Text style={[s.exText,{color:T.textSecondary}]}>{previewWord.notes_ua||previewWord.notes}</Text></View>:null}
            <Pressable style={[s.addBtn,{backgroundColor:T.accentBg},addingGlobalWord&&s.disabled]} disabled={addingGlobalWord} onPress={addWordToGlobalBase}><Text style={[s.addBtnText,{color:T.accent}]}>{addingGlobalWord?tr("adding"):tr("add_preview_database")}</Text></Pressable>
            <Pressable style={[s.stopBtn,{backgroundColor:T.cardAlt}]} onPress={stopSpeech}><Text style={[s.stopBtnText,{color:T.textSecondary}]}>⏹ {tr("stop_audio")}</Text></Pressable>
            <Pressable style={[s.closeBtn,{backgroundColor:T.accent}]} onPress={()=>{stopSpeech();setPreviewWord(null);}}><Text style={s.closeBtnText}>{tr("close")}</Text></Pressable>
          </>
        )},
        {visible:!!selectedWord,onClose:()=>{stopSpeech();setSelectedWord(null);},content:(
          <>
            <Text style={[s.modalWord,{color:T.textPrimary,fontSize:F.word}]}>{selectedWord?.lemma||selectedWord?.word}</Text>
            <Text style={[s.modalTrans,{color:T.accent,fontSize:F.translation}]}>{pickTranslation(selectedWord,lang)}</Text>
            <View style={s.modalMetaRow}>
              <Text style={[s.modalCat,{color:T.textMuted,fontSize:F.meta}]}>{selectedWord?.category||selectedWord?.type||""}</Text>
              {selectedWord?.verification_tier||selectedWord?.verification_evidence?<VerificationBadge tier={selectedWord.verification_tier} sourceVerified={selectedWord.source_verified} evidence={selectedWord.verification_evidence} lemma={selectedWord.lemma||selectedWord.word} size="md" lang={lang}/>:null}
            </View>
            {selectedWord?.id?<View style={{marginTop:12}}><Lexeme360 lexemeId={selectedWord.id} lemma={selectedWord.lemma||selectedWord.word} pos={selectedWord.pos||selectedWord.category||selectedWord.type} lang={lang} onSelectWord={(id:string,lemma:string)=>setSelectedWord({id,word:lemma,lemma})}/></View>:null}
            {selectedWord?.example?<View style={[s.exBox,{backgroundColor:T.cardAlt}]}><Text style={[s.exText,{color:T.textSecondary}]}>{selectedWord.example}</Text></View>:null}
            {getFormLabels(selectedWord||{}).length>0?<View style={s.formsBox}><Text style={[s.formsTitle,{color:T.textMuted}]}>{tr("forms")}</Text>{getFormLabels(selectedWord||{}).map(({label,value})=>(<View key={label} style={s.formRow}><Text style={[s.formLabel,{color:T.textMuted}]}>{label}</Text><Text style={[s.formVal,{color:T.textPrimary}]}>{value}</Text></View>))}</View>:null}
            <Pressable style={[s.speakBtn,{backgroundColor:T.accentBg}]} onPress={()=>speakNorwegian(selectedWord?.lemma||selectedWord?.word||"")}><Text style={[s.speakBtnText,{color:T.accent}]}>🔊 {tr("pronounce")}</Text></Pressable>
            {!selectedWord?.learned?<Pressable style={[s.addBtn,{backgroundColor:T.accentBg},addingWord&&s.disabled]} disabled={addingWord} onPress={addCurrentWordToLearning}><Text style={[s.addBtnText,{color:T.accent}]}>{addingWord?tr("adding"):tr("add_to_learning")}</Text></Pressable>:<View style={[s.addBtn,{backgroundColor:T.accentBg}]}><Text style={[s.addBtnText,{color:T.accent}]}>✅ {tr("in_learning")}</Text></View>}
            <Pressable style={[s.stopBtn,{backgroundColor:T.cardAlt}]} onPress={stopSpeech}><Text style={[s.stopBtnText,{color:T.textSecondary}]}>⏹ {tr("stop_audio")}</Text></Pressable>
            <Pressable style={[s.closeBtn,{backgroundColor:T.accent}]} onPress={()=>{stopSpeech();setSelectedWord(null);}}><Text style={s.closeBtnText}>{tr("close")}</Text></Pressable>
          </>
        )},
        {visible:!!selectedSentence,onClose:()=>{stopSpeech();setSelectedSentence(null);setSentenceAI(null);setSentenceUsage(null);setSentenceError("");},content:(
          <>
            <Text style={[s.modalLabel,{color:T.textMuted,fontSize:F.meta}]}>{tr("sentence")}</Text>
            <Text style={[s.sentenceModalText,{color:T.textPrimary,fontSize:F.prompt}]}>{selectedSentence}</Text>
            <Pressable style={[s.aiBtn,sentenceLoading&&s.disabled]} disabled={sentenceLoading} onPress={loadSentenceAI}><Text style={s.aiBtnText}>{sentenceLoading?tr("ai_analyzing"):tr("translate_explain")}</Text></Pressable>
            {sentenceError?<Text style={[s.error,{backgroundColor:T.dangerSoft,color:T.danger}]}>{sentenceError}</Text>:null}
            {sentenceAI?(<>
              {[{label:tr("translation"),text:sentenceAI.translation||"-"},{label:tr("literal_meaning"),text:sentenceAI.literalMeaning}].filter(x=>x.text).map(x=>(<View key={x.label} style={[s.placeholderBox,{backgroundColor:T.cardAlt}]}><Text style={[s.placeholderTitle,{color:T.textPrimary}]}>{x.label}</Text><Text style={[s.placeholderText,{color:T.textSecondary}]}>{x.text}</Text></View>))}
              {[{label:tr("grammar"),items:sentenceAI.grammarNotes||[]},{label:tr("expressions"),items:sentenceAI.expressions||[]}].map(({label,items})=>(<View key={label} style={[s.placeholderBox,{backgroundColor:T.cardAlt}]}><Text style={[s.placeholderTitle,{color:T.textPrimary}]}>{label}</Text>{items.length>0?items.map((item,i)=>(<Text key={i} style={[s.bulletText,{color:T.textSecondary}]}>• {item}</Text>)):<Text style={[s.placeholderText,{color:T.textMuted}]}>-</Text>}</View>))}
              {sentenceUsage?<Text style={[s.usageText,{color:T.textMuted}]}>AI: {sentenceUsage.used}/{sentenceUsage.limit}</Text>:null}
            </>):(<View style={[s.placeholderBox,{backgroundColor:T.cardAlt}]}><Text style={[s.placeholderTitle,{color:T.textPrimary}]}>{tr("ai_explanation")}</Text><Text style={[s.placeholderText,{color:T.textMuted}]}>{tr("ai_explanation_hint")}</Text></View>)}
            <Pressable style={[s.speakBtn,{backgroundColor:T.accentBg}]} onPress={()=>speakNorwegian(selectedSentence||"")}><Text style={[s.speakBtnText,{color:T.accent}]}>🔊 {tr("pronounce_sentence")}</Text></Pressable>
            <Pressable style={[s.stopBtn,{backgroundColor:T.cardAlt}]} onPress={stopSpeech}><Text style={[s.stopBtnText,{color:T.textSecondary}]}>⏹ {tr("stop_audio")}</Text></Pressable>
            <Pressable style={[s.closeBtn,{backgroundColor:T.accent}]} onPress={()=>{stopSpeech();setSelectedSentence(null);setSentenceAI(null);setSentenceUsage(null);setSentenceError("");}}><Text style={s.closeBtnText}>{tr("close")}</Text></Pressable>
          </>
        )},
      ].map(({visible,onClose,content},i)=>(
        <Modal key={i} visible={visible} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={[s.modalCard,{backgroundColor:T.card}]}>
              <ScrollView style={s.modalScroll} contentContainerStyle={s.modalScrollContent} showsVerticalScrollIndicator={false}>
                {content}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ))}

      <Modal visible={show360} transparent animationType="slide" onRequestClose={()=>setShow360(false)} statusBarTranslucent>
        <Pressable style={s.overlay360} onPress={()=>setShow360(false)}>
          <Pressable onPress={e=>e.stopPropagation()} style={[s.sheet360,{backgroundColor:T.card}]}>
            {word360&&<Lexeme360Sheet lexemeId={word360.id} lemma={word360.lemma} pos={word360.pos} lang={lang} onClose={()=>setShow360(false)} onSelectWord={(id,lemma)=>{setShow360(false);setSelectedWord({id,word:lemma,lemma});}}/>}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Stat({label,value}:{label:string;value:string|number}){
  return(<View style={s.statCard}><Text style={s.statVal}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>);
}

const s=StyleSheet.create({
  content:{paddingTop:70,paddingHorizontal:20,paddingBottom:120},
  title:{fontWeight:"900",marginBottom:10},subtitle:{lineHeight:24,marginBottom:20},
  card:{borderRadius:22,padding:18,marginBottom:18,borderWidth:0.5},
  sectionTitle:{fontWeight:"900",marginBottom:14},
  wordInput:{borderWidth:0.5,borderRadius:16,padding:14,fontWeight:"700",marginBottom:14},
  textArea:{minHeight:160,borderWidth:0.5,borderRadius:16,padding:14,fontWeight:"600",marginBottom:14},
  actionsRow:{flexDirection:"row",gap:10,marginTop:4},actionsCol:{gap:10},
  btn:{borderRadius:16,paddingVertical:16},btnText:{color:"#fff",textAlign:"center",fontSize:16,fontWeight:"900"},
  clearBtn:{borderRadius:16,paddingHorizontal:18,justifyContent:"center"},clearBtnText:{fontSize:15,fontWeight:"800",textAlign:"center"},
  clearWide:{borderRadius:16,paddingVertical:16},
  pwaBtn:{borderRadius:16,paddingVertical:16},pwaBtnText:{textAlign:"center",fontSize:16,fontWeight:"900"},
  aiBtn:{backgroundColor:"#F5E8FF",borderRadius:16,paddingVertical:16},aiBtnText:{color:"#7E22CE",textAlign:"center",fontSize:16,fontWeight:"900"},
  disabled:{opacity:0.55},
  previewBox:{marginTop:16,borderRadius:20,padding:16},
  msgBox:{marginTop:14,borderRadius:16,padding:14},msgText:{fontWeight:"800",lineHeight:22},
  addBtn:{marginTop:14,borderRadius:16,paddingVertical:16},addBtnText:{textAlign:"center",fontWeight:"900"},
  statsGrid:{flexDirection:"row",flexWrap:"wrap",gap:12,marginBottom:18},
  statCard:{width:"47%",borderRadius:18,padding:16,borderWidth:0.5},
  statVal:{fontWeight:"900",marginBottom:4},statLabel:{fontWeight:"700"},
  legendCard:{borderRadius:18,padding:14,marginBottom:18,gap:6,borderWidth:0.5},legendText:{fontWeight:"800"},
  methodText:{fontWeight:"800",lineHeight:25,marginBottom:4},
  smallCtrl:{flex:1,borderRadius:14,paddingVertical:12,marginBottom:12},smallCtrlText:{textAlign:"center",fontSize:15,fontWeight:"900"},
  candidateCard:{borderRadius:18,padding:14,marginTop:12,borderWidth:1,borderColor:"#E5E7EB"},
  cLearned:{backgroundColor:"#DCFCE7",borderColor:"#86EFAC"},cInBase:{backgroundColor:"#FEF3C7",borderColor:"#FCD34D"},cUnknown:{backgroundColor:"#FEE2E2",borderColor:"#FCA5A5"},
  candidateHeader:{flexDirection:"row",gap:10,alignItems:"flex-start"},checkbox:{fontSize:22,lineHeight:28},
  candidateTitleRow:{flexDirection:"row",alignItems:"center",gap:6},candidateTitle:{fontWeight:"900"},
  verRow:{marginTop:10,alignSelf:"flex-start"},
  candidateMeta:{marginTop:3,fontWeight:"700"},candidateMeaning:{marginTop:10,fontWeight:"800",lineHeight:23},
  candidateExample:{marginTop:10,fontWeight:"700",lineHeight:22},candidateError:{marginTop:10,fontWeight:"800"},
  previewBtn:{marginTop:12,borderRadius:14,paddingVertical:12,borderWidth:0.5,borderColor:"#E5E7EB"},previewBtnText:{textAlign:"center",fontSize:15,fontWeight:"900"},
  knownItem:{borderBottomWidth:0.5,paddingVertical:10},knownTitle:{fontWeight:"900"},knownTrans:{marginTop:4,fontWeight:"700"},
  sentenceCard:{borderRadius:16,padding:14,marginBottom:10},sentenceText:{lineHeight:24,fontWeight:"700"},
  wordWrap:{flexDirection:"row",flexWrap:"wrap",gap:8},
  chip:{borderRadius:999,paddingVertical:7,paddingHorizontal:10,flexDirection:"row",alignItems:"center",gap:5},
  chipLearned:{backgroundColor:"#DCFCE7"},chipInBase:{backgroundColor:"#FEF3C7"},chipUnknown:{backgroundColor:"#FEE2E2"},
  chipText:{fontWeight:"800"},txLearned:{color:"#166534"},txInBase:{color:"#92400E"},txUnknown:{color:"#991B1B"},
  unknownItem:{fontWeight:"800",paddingVertical:8,borderBottomWidth:0.5},
  emptyText:{lineHeight:24},error:{padding:14,borderRadius:12,marginBottom:20},
  miniDot:{width:8,height:8,borderRadius:99,borderWidth:0.5,borderColor:"rgba(0,0,0,0.15)"},
  modalOverlay:{flex:1,backgroundColor:"rgba(0,0,0,0.45)",justifyContent:"center",alignItems:"center",padding:24},
  modalCard:{width:"100%",maxHeight:"88%",borderRadius:28,overflow:"hidden"},
  modalScroll:{width:"100%"},modalScrollContent:{padding:24,paddingBottom:28},
  modalLabel:{fontWeight:"900",marginBottom:8},modalWord:{fontWeight:"900"},
  modalTrans:{marginTop:10,fontWeight:"800",lineHeight:28},
  modalMetaRow:{marginTop:8,flexDirection:"row",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
  modalCat:{fontWeight:"700"},sentenceModalText:{lineHeight:31,fontWeight:"900"},
  placeholderBox:{marginTop:18,borderRadius:16,padding:14},placeholderTitle:{fontSize:15,fontWeight:"900",marginBottom:6},
  placeholderText:{fontSize:15,fontWeight:"700",lineHeight:22},bulletText:{fontSize:15,fontWeight:"700",lineHeight:22,marginBottom:4},
  usageText:{marginTop:12,fontSize:13,fontWeight:"800",textAlign:"center"},
  exBox:{marginTop:14,borderRadius:14,padding:14},exText:{fontWeight:"700",lineHeight:24},
  formsBox:{marginTop:14,gap:6},formsTitle:{fontSize:13,fontWeight:"900",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6},
  formRow:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:3},formLabel:{width:90,fontSize:12,fontWeight:"700"},formVal:{flex:1,fontSize:16,fontWeight:"800"},
  speakBtn:{marginTop:18,borderRadius:16,paddingVertical:16},speakBtnText:{textAlign:"center",fontSize:16,fontWeight:"900"},
  stopBtn:{marginTop:14,borderRadius:16,paddingVertical:16},stopBtnText:{textAlign:"center",fontSize:16,fontWeight:"900"},
  closeBtn:{marginTop:14,borderRadius:16,paddingVertical:16},closeBtnText:{color:"#fff",textAlign:"center",fontSize:16,fontWeight:"900"},
  overlay360:{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"},
  sheet360:{height:"80%",borderTopLeftRadius:24,borderTopRightRadius:24,overflow:"hidden"},
  prompt:{fontWeight:"700"},
});
