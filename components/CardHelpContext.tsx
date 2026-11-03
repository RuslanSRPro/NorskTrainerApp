import { useEffect,useState } from 'react';
import { Text,View } from 'react-native';
import { supabase } from '@/services/supabase';

type HelpContext={analysis?:{started_at:string;kind:string}|null;
  alternatives?:Array<{uk?:string;en?:string;definition_nb:string;article_id:number;sense_path?:string}>};
export function CardHelpContext({entityId,lang,enabled,styles}:{
  entityId?:string|null;lang:string;enabled:boolean;styles:any;
}) {
  const [value,setValue]=useState<HelpContext|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    setValue(null);setFailed(false);
    if(!enabled||!entityId||!/^[0-9a-f-]{36}$/i.test(entityId))return;
    let alive=true;
    void supabase.rpc('get_card_help_context_v1',{p_lexeme_id:entityId}).then(({data,error})=>{
      if(!alive)return;if(error){setFailed(true);return;}setValue(data as HelpContext);
    },()=>{if(alive)setFailed(true);});
    return()=>{alive=false;};
  },[entityId,enabled]);
  if(!value&&!failed)return null;
  const tr=(ua:string,en:string,no:string)=>lang==='ua'?ua:lang==='no'?no:en;
  const date=value?.analysis?.started_at?new Date(value.analysis.started_at):null;
  return <>
    <View style={styles.definitionBox}>
      <Text style={styles.sectionTitle}>{tr('Останній запуск аналізу','Last analysis started','Siste analysestart')}</Text>
      <Text style={styles.definitionItem}>{date&&!Number.isNaN(date.getTime())
        ?date.toLocaleString(lang==='ua'?'uk-UA':lang==='no'?'nb-NO':'en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
        :failed?tr('Не вдалося завантажити','Could not load','Kunne ikke laste'):tr('Немає збереженої дати','No recorded date','Ingen lagret dato')}
        {value?.analysis?.kind==='synonym_candidate'?tr(' · фоновий аналіз',' · background analysis',' · bakgrunnsanalyse'):''}</Text>
    </View>
  </>;
}
