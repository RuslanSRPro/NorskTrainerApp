import { useState } from 'react';
import { Linking, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { speakerLabel, type SpeakerAnalysis } from '@/features/audio/lectureStorage';
import { AudioActionButton } from './AudioActionButton';
const COPY = {
  ua:{run:'Розпізнати співрозмовників',resume:'Продовжити розпізнавання',cancel:'Зупинити аналіз',done:'Аналіз завершено',hint:'Аналіз на пристрої. Перший запуск завантажує моделі. Номери призначаються автоматично за голосом і спільними фрагментами аудіо. Сумнівні репліки залишаються невизначеними.',rename:'Ім’я співрозмовника',save:'Зберегти',close:'Скасувати'},
  ru:{run:'Распознать собеседников',resume:'Продолжить распознавание',cancel:'Остановить анализ',done:'Анализ завершён',hint:'Анализ на устройстве. Первый запуск загружает модели. Номера назначаются автоматически по голосу и общим фрагментам аудио. Сомнительные реплики остаются неопределёнными.',rename:'Имя собеседника',save:'Сохранить',close:'Отмена'},
  no:{run:'Identifiser talere',resume:'Fortsett taleranalyse',cancel:'Stopp analysen',done:'Analysen er ferdig',hint:'Analyse på enheten. Første gang lastes modeller ned. Numre tildeles automatisk ut fra stemmer og overlappende lyd. Usikre replikker forblir ukjente.',rename:'Navn på taler',save:'Lagre',close:'Avbryt'},
  en:{run:'Identify speakers',resume:'Continue speaker analysis',cancel:'Stop analysis',done:'Analysis complete',hint:'On-device analysis. Models download on first use. Numbers are assigned automatically using voices and shared audio. Uncertain turns remain unknown.',rename:'Speaker name',save:'Save',close:'Cancel'},
};
type Props={language:string;analysis:SpeakerAnalysis|null;busy:boolean;blocked:boolean;progress:number;error:string|null;accent:string;textColor:string;fontSize:number;onRun:()=>void;onCancel:()=>void;onRename:(id:number,name:string)=>void};
export function SpeakerAnalysisControls(p:Props){
 const key=p.language==='en'?'en':p.language==='no'||p.language==='nb'?'no':p.language==='ru'?'ru':'ua';const t=COPY[key];
 const [editing,setEditing]=useState<number|null>(null),[name,setName]=useState('');
 const done=p.analysis?.status==='done' && p.analysis.engine==='speakerkit-1.1.1-v3-r2';
 const label=p.busy?`${t.cancel} · ${Math.round(p.progress*100)}%`:done?t.done:p.analysis?.engine==='speakerkit-1.1.1-v3-r2'&&p.analysis.nextWindow?t.resume:t.run;
 return <View style={{gap:8,marginVertical:12}}>
  <AudioActionButton label={label} accessibilityLabel={label} accent={p.accent} fontSize={p.fontSize} disabled={!p.busy&&(p.blocked||done)} onPress={p.busy?p.onCancel:p.onRun}/>
  <Text style={{color:p.textColor,fontSize:p.fontSize-2}}>{t.hint}</Text>
  <Text accessibilityRole="link" style={{color:p.accent,fontSize:p.fontSize-3}} onPress={()=>{void Linking.openURL('https://huggingface.co/argmaxinc/speakerkit-coreml').catch(()=>{});}}>SpeakerKit / Pyannote · models CC BY 4.0</Text>
  {!!p.error&&<Text selectable style={{color:p.textColor}}>{p.error}</Text>}
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{p.analysis?.profiles.map(profile=><Pressable key={profile.id} accessibilityRole="button" disabled={p.busy||p.blocked} onPress={()=>{setName(profile.name??'');setEditing(profile.id);}} style={{borderWidth:1,borderColor:p.accent,borderRadius:8,padding:8}}><Text style={{color:p.accent}}>{speakerLabel({speakerId:profile.id,speakerName:profile.name},p.language)} ✎</Text></Pressable>)}</View>
  <Modal transparent visible={editing!==null} animationType="fade" onRequestClose={()=>setEditing(null)}>
   <View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:'#0008'}}><View style={{backgroundColor:'#fff',padding:20,borderRadius:16,gap:12}}>
    <Text style={{color:'#222'}}>{t.rename}</Text>
    <TextInput accessibilityLabel={t.rename} autoFocus value={name} onChangeText={setName} maxLength={80} style={{borderWidth:1,borderColor:'#888',borderRadius:8,padding:10,color:'#111'}}/>
    <AudioActionButton label={t.save} accessibilityLabel={t.save} accent={p.accent} fontSize={p.fontSize} disabled={p.busy||p.blocked} onPress={()=>{if(editing!==null)p.onRename(editing,name);setEditing(null);}}/>
    <AudioActionButton label={t.close} accessibilityLabel={t.close} accent={p.accent} fontSize={p.fontSize} onPress={()=>setEditing(null)}/>
   </View></View>
  </Modal>
 </View>;
}
