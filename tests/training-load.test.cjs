const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');

function harness(){
  const calls={forms:[],rpc:[],selects:0};
  const card=id=>({id,lemma:id,pos:'verb',is_learning_lexeme:true,dictionary_status:'active',
    homonym_card_count:2,homonym_card_ids:['h-'+id]});
  const progress=id=>({lexemes:card(id),priority_score:10,memory_status:'active'});
  const state={failNext:false};
  const supabase={auth:{getSession:async()=>({data:{session:null}})},
    from(table){
      const query={selection:'',max:Infinity};
      query.select=s=>(query.selection=s,query);
      query.limit=n=>(query.max=n,query);
      for(const method of ['eq','lte','or','order','not'])query[method]=()=>query;
      query.then=(resolve,reject)=>Promise.resolve().then(()=>{
        calls.selects++;
        if(state.failNext){state.failNext=false;return {data:null,error:{message:'simulated load failure'}};}
        let rows=[];
        if(table==='lexemes')rows=['a','d','e'].map(card);
        else if(query.selection==='lexeme_id')rows=[];
        else if(query.selection.includes('next_due_at'))rows=['a','b'].map(progress);
        else if(query.selection.includes('difficulty_val'))rows=['b','c'].map(progress);
        else rows=['c','d'].map(progress);
        return {data:rows.slice(0,query.max),error:null};
      }).then(resolve,reject);
      return query;
    },
    async rpc(name,args){
      calls.rpc.push({name,args});
      const ids=args.p_lexeme_ids||args.p_ids||[];
      if(name==='get_canonical_lexeme_translations_v1')return {data:ids.map(id=>({lexeme_id:id,language_code:'uk',translation:'переклад '+id})),error:null};
      if(name==='get_canonical_lexeme_examples_v1')return {data:ids.map(id=>({lexeme_id:id,example_text:'Eksempel '+id})),error:null};
      if(name==='get_homonym_cards_v1')return {data:ids.map(id=>({id,lemma:id,pos:'noun',translation_ua:'омонім'})),error:null};
      return {data:[],error:null};
    }};
  const mocks={
    './supabase':{supabase},
    '@/store/authStore':{getCurrentUserId:()=> 'user'},
    './formReadModel':{fetchFormsMap:async ids=>(calls.forms.push(ids),new Map())},
    './formReadModelCore':{buildV2Bundles:()=>new Map()},
    '../supabase/functions/_shared/example-evidence':{selectNorwegianExample:rows=>rows[0]},
  };
  const file=path.resolve(__dirname,'../services/api.ts');
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports','console',code)(name=>{
    if(!(name in mocks))throw Error('Unexpected dependency '+name);
    return mocks[name];
  },mod,mod.exports,{log(){},info(){},warn(){},error(){}});
  return {api:mod.exports,calls,state};
}

test('mixed queue is deduplicated before one enrichment batch; weights and master translations survive',async()=>{
  const {api,calls}=harness();
  const words=await api.getLearningWordsFromSupabase({daily_limit:4,study_set:'all'});
  assert.deepEqual(words.map(w=>w.id),['a','b','c','d']);
  assert.deepEqual(words.map(w=>w.ua),['переклад a','переклад b','переклад c','переклад d']);
  assert.equal(calls.forms.length,1);
  assert.equal(new Set(calls.forms[0]).size,calls.forms[0].length);
  for(const name of ['get_canonical_lexeme_translations_v1','get_canonical_lexeme_examples_v1','get_homonym_cards_v1','get_lexeme_translation_approx_v1'])
    assert.equal(calls.rpc.filter(c=>c.name===name).length,1,name);
  assert.equal(words[0].homonyms[0].id,'h-a');
});

test('simultaneous identical loads share work; completed loads are not kept stale',async()=>{
  const {api,calls}=harness();const settings={daily_limit:4};
  const first=api.getLearningWordsFromSupabase(settings);
  const second=api.getLearningWordsFromSupabase(settings);
  assert.equal(first,second);
  await Promise.all([first,second]);assert.equal(calls.forms.length,1);
  await api.getLearningWordsFromSupabase(settings);assert.equal(calls.forms.length,2);
});

test('failed load clears the in-flight entry and permits retry',async()=>{
  const {api,state}=harness();state.failNext=true;
  await assert.rejects(api.getLearningWordsFromSupabase({daily_limit:4}),/simulated load failure/);
  const result=await api.getLearningWordsFromSupabase({daily_limit:4});
  assert.equal(result.length,4);
});
