// app/(tabs)/index.tsx

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { getDashboardStatsFromSupabase } from '@/services/api';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/contexts/ThemeContext';

type Stats = {
  totalWords:number; learnedWords:number; weakWords:number;
  dueToday:number; reviewsToday:number; accuracyToday:number;
};

function nameFromEmail(email?: string|null): string {
  if (!email) return '';
  const raw = email.split('@')[0].replace(/\d+/g,'').replace(/[._-]/g,' ').trim();
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function timeGreeting(lang:string): string {
  const h = new Date().getHours();
  if (lang==='ua') return h<12?'Доброго ранку':h<18?'Доброго дня':'Доброго вечора';
  if (lang==='no') return h<12?'God morgen':h<18?'God dag':'God kveld';
  return h<12?'Good morning':h<18?'Good afternoon':'Good evening';
}

export default function HomeScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { theme, fonts, themeName } = useTheme();
  const { preferred_user, app_language } = useSettingsStore();
  const { user } = useAuthStore();

  const [stats, setStats] = useState<Stats>({
    totalWords:0, learnedWords:0, weakWords:0,
    dueToday:0, reviewsToday:0, accuracyToday:0,
  });
  const [showAnalytics, setShowAnalytics] = useState(false);

  const lang   = (app_language||'ua') as string;
  const isUa   = lang==='ua';
  const isDark = themeName==='dark';
  const name   = useMemo(()=>nameFromEmail(user?.email),[user?.email]);
  const greet  = useMemo(()=>timeGreeting(lang),[lang]);
  const pct    = stats.totalWords>0 ? Math.round((stats.learnedWords/stats.totalWords)*100) : 0;
  const weakPct= stats.learnedWords>0 ? Math.round((stats.weakWords/stats.learnedWords)*100) : 0;

  // ── visual tokens per theme ───────────────────────────────────────────────
  const screenBg = isDark?'#0A1525'
    :themeName==='reading'?'#D5C5A0'
    :themeName==='turquoise'?'#A4D9D0'
    :'#BACCDD';

  // liquid glass card: nearly transparent, strong blur
  const cardBg   = isDark?'rgba(255,255,255,0.07)'
    :themeName==='reading'?'rgba(255,248,225,0.65)'
    :themeName==='turquoise'?'rgba(255,255,255,0.62)'
    :'rgba(255,255,255,0.65)';

  const cardBorder = isDark?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.85)';
  const cardBorderB = isDark?'rgba(0,0,0,0.25)':'rgba(0,0,0,0.06)';
  const textH  = isDark?'#FFFFFF':theme.textPrimary;
  const textM  = isDark?'rgba(255,255,255,0.46)':theme.textMuted;
  const blurT  = isDark?'dark':'light';
  const blurI  = isDark?35:65; // stronger for liquid glass

  useFocusEffect(useCallback(()=>{
    getDashboardStatsFromSupabase(preferred_user).then(setStats).catch(()=>{});
  },[preferred_user]));

  // ── liquid glass card component ───────────────────────────────────────────
  function LiquidCard({style,row,children}:{style?:any;row?:boolean;children:React.ReactNode}){
    return(
      <BlurView intensity={blurI} tint={blurT} style={[s.blur, style]}>
        <View style={[s.glassInner,{backgroundColor:cardBg,borderColor:cardBorder,borderBottomColor:cardBorderB,borderRightColor:cardBorderB},row&&s.rowLayout]}>
          {children}
        </View>
      </BlurView>
    );
  }

  // ── nav tiles (3 in a row) ────────────────────────────────────────────────
  const navTiles = [
    {icon:'🎯',label:isUa?'Навчання':'Training',route:'/explore',c:'#007AFF',bg:isDark?'rgba(0,122,255,0.25)':'rgba(0,122,255,0.16)'},
    {icon:'📖',label:isUa?'Тести':'Tests',     route:'/reading',c:'#FF9500',bg:isDark?'rgba(255,149,0,0.25)':'rgba(255,149,0,0.16)'},
    {icon:'🎙',label:isUa?'Аудіо':'Audio',     route:'/voice',  c:'#FF2D55',bg:isDark?'rgba(255,45,85,0.25)':'rgba(255,45,85,0.16)'},
  ];

  return(
    <View style={[s.root,{backgroundColor:screenBg}]}>
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={[s.greetText,{color:textH,fontSize:fonts.base+5}]} numberOfLines={1}>
            {greet}{name?`, ${name}!`:'!'} 👋
          </Text>
          <Pressable
            style={[s.iconBtn,{backgroundColor:cardBg,borderColor:cardBorder}]}
            onPress={()=>setShowAnalytics(true)}
          >
            <Text style={{fontSize:16}}>📊</Text>
          </Pressable>
        </View>

        {/* ── Progress card ───────────────────────────────────────────────── */}
        <LiquidCard>
          <View style={s.progTop}>
            <View>
              <Text style={[s.progSub,{color:textM,fontSize:fonts.meta}]}>
                {isUa?'Прогрес у навчанні':'Learning progress'}
              </Text>
              <Text style={[s.progTitle,{color:textH,fontSize:fonts.base+3}]}>
                {isUa?'у навчанні':'in learning'}
              </Text>
            </View>
            <Text style={[s.progPct,{color:theme.accent,fontSize:fonts.base+10}]}>{pct}%</Text>
          </View>
          <View style={[s.barBg,{backgroundColor:isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.08)'}]}>
            <View style={[s.barFill,{backgroundColor:theme.accent,width:`${Math.max(1.5,pct)}%` as any}]}/>
          </View>
          <Text style={[s.progCount,{color:textM,fontSize:fonts.meta}]}>
            {stats.learnedWords} / {stats.totalWords} {isUa?'слів':'words'}
          </Text>
        </LiquidCard>

        {/* ── Stats Row 1: Сьогодні + Точність ───────────────────────────── */}
        <View style={[s.grid2,{marginBottom:12,alignItems:'stretch'}]}>
          <LiquidCard style={s.statCard}>
            <Text style={[s.statLbl,{color:textM,fontSize:fonts.meta}]}>{isUa?'Сьогодні':'Today'}</Text>
            <Text style={[s.statVal,{color:theme.accent,fontSize:fonts.base+9}]}>{stats.reviewsToday}</Text>
            <Text style={[s.statUnit,{color:textM,fontSize:fonts.meta-1}]}>{isUa?'слів':'words'}</Text>
          </LiquidCard>
          <LiquidCard style={s.statCard}>
            <Text style={[s.statLbl,{color:textM,fontSize:fonts.meta}]}>{isUa?'Точність':'Accuracy'}</Text>
            <Text style={[s.statVal,{color:'#30D158',fontSize:fonts.base+9}]}>{stats.accuracyToday}%</Text>
            <Text style={[s.statUnit,{color:textM,fontSize:fonts.meta-1}]}>{isUa?'точність':'accuracy'}</Text>
          </LiquidCard>
        </View>

        {/* ── Stats Row 2: Due + Слабкі (tappable) ────────────────────────── */}
        <View style={[s.grid2,{marginBottom:8,alignItems:'stretch'}]}>
          <Pressable style={s.statCard} onPress={()=>router.push('/explore')}>
            <LiquidCard>
              <Text style={[s.statLbl,{color:textM,fontSize:fonts.meta}]}>Due</Text>
              <Text style={[s.statVal,{color:'#FF9500',fontSize:fonts.base+9}]}>{stats.dueToday}</Text>
              <Text style={[s.statUnit,{color:textM,fontSize:fonts.meta-1}]}>{isUa?'картки':'cards'}</Text>
            </LiquidCard>
          </Pressable>
          <Pressable style={s.statCard} onPress={()=>router.push('/weak')}>
            <LiquidCard>
              <Text style={[s.statLbl,{color:textM,fontSize:fonts.meta}]}>{isUa?'Слабкі':'Weak'}</Text>
              <Text style={[s.statVal,{color:'#FF3B30',fontSize:fonts.base+9}]}>{stats.weakWords}</Text>
              <Text style={[s.statUnit,{color:textM,fontSize:fonts.meta-1}]}>{isUa?'слів':'words'}</Text>
            </LiquidCard>
          </Pressable>
        </View>

        {/* ── Separator ──────────────────────────────────────────────────── */}
        <View style={{height:44}}/>

        {/* ── Nav tiles 3 in a row ───────────────────────────────────────── */}
        <View style={s.grid3}>
          {navTiles.map(t=>(
            <Pressable key={t.route} style={s.navTileWrap} onPress={()=>router.push(t.route as any)}>
              <LiquidCard>
                <View style={[s.navIcon,{backgroundColor:t.bg}]}>
                  <Text style={{fontSize:18}}>{t.icon}</Text>
                </View>
                <Text style={[s.navLabel,{color:textH,fontSize:fonts.base-1}]}>{t.label}</Text>
              </LiquidCard>
            </Pressable>
          ))}
        </View>

        {/* ── Separator ──────────────────────────────────────────────────── */}
        <View style={{height:28}}/>

        {/* ── Settings row ───────────────────────────────────────────────── */}
        <Pressable onPress={()=>router.push('/settings')}>
          <LiquidCard row>
            <View style={[s.navIcon,{backgroundColor:isDark?'rgba(255,255,255,0.1)':'rgba(120,120,130,0.14)'}]}>
              <Text style={{fontSize:17}}>⚙️</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={[s.navLabel,{color:textH,fontSize:fonts.base-1}]}>
                {isUa?'Налаштування':'Settings'}
              </Text>
              <Text style={[s.statUnit,{color:textM,fontSize:fonts.meta-1,paddingHorizontal:0,paddingBottom:0}]}>
                {isUa?'Мова, режим, переклади':'Language, mode, theme'}
              </Text>
            </View>
            <Text style={{color:textM,fontSize:22}}>›</Text>
          </LiquidCard>
        </Pressable>

      </SafeAreaView>

      {/* ── Analytics modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showAnalytics}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={()=>setShowAnalytics(false)}
      >
        <View style={[s.modalRoot,{backgroundColor:isDark?'#0A1525':'#F2F2F7'}]}>
          <SafeAreaView style={{flex:1}} edges={['top']}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle,{color:isDark?'#fff':theme.textPrimary,fontSize:fonts.base+4}]}>
                📊 {isUa?'Аналітика':'Analytics'}
              </Text>
              <Pressable style={[s.closeBtn,{backgroundColor:isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.07)'}]} onPress={()=>setShowAnalytics(false)}>
                <Text style={{fontSize:13,fontWeight:'600',color:isDark?'#fff':theme.textPrimary}}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{padding:16,paddingBottom:40}} showsVerticalScrollIndicator={false}>
              {/* Progress */}
              <View style={[s.aCard,{backgroundColor:isDark?'#1C2E40':'#fff'}]}>
                <Text style={[s.aCardTitle,{color:isDark?'rgba(255,255,255,0.5)':theme.textMuted,fontSize:fonts.meta}]}>
                  {isUa?'ПОКРИТТЯ БАЗИ':'BASE COVERAGE'}
                </Text>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
                  <Text style={{fontSize:28,fontWeight:'800',color:theme.accent}}>{pct}%</Text>
                  <Text style={{fontSize:13,color:isDark?'rgba(255,255,255,0.5)':theme.textMuted}}>
                    {stats.learnedWords} / {stats.totalWords} {isUa?'слів':'words'}
                  </Text>
                </View>
                <View style={[s.barBg,{backgroundColor:isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.08)',marginTop:10,marginHorizontal:0}]}>
                  <View style={[s.barFill,{backgroundColor:theme.accent,width:`${Math.max(1.5,pct)}%` as any}]}/>
                </View>
              </View>

              {/* Stats grid */}
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10}}>
                {[
                  {label:isUa?'Всього слів':'Total words',  v:stats.totalWords,   c:theme.accent},
                  {label:isUa?'У навчанні':'In learning',   v:stats.learnedWords, c:'#30D158'},
                  {label:isUa?'Слабкі слова':'Weak words',  v:stats.weakWords,    c:'#FF3B30'},
                  {label:'Due today',                        v:stats.dueToday,     c:'#FF9500'},
                  {label:isUa?'Повторів':'Reviews',          v:stats.reviewsToday, c:theme.accent},
                  {label:isUa?'Точність':'Accuracy',         v:`${stats.accuracyToday}%`,c:'#30D158'},
                ].map(st=>(
                  <View key={st.label} style={[s.aStatCard,{backgroundColor:isDark?'#1C2E40':'#fff',width:'47%'}]}>
                    <Text style={{fontSize:24,fontWeight:'800',color:st.c,marginBottom:4}}>{st.v}</Text>
                    <Text style={{fontSize:12,fontWeight:'600',color:isDark?'rgba(255,255,255,0.45)':theme.textMuted,lineHeight:18}}>{st.label}</Text>
                  </View>
                ))}
              </View>

              {/* Memory health */}
              <View style={[s.aCard,{backgroundColor:isDark?'#1C2E40':'#fff',marginTop:10}]}>
                <Text style={[s.aCardTitle,{color:isDark?'rgba(255,255,255,0.5)':theme.textMuted,fontSize:fonts.meta}]}>
                  {isUa?'СТАН ПАМ\'ЯТІ':'MEMORY HEALTH'}
                </Text>
                <Text style={{marginTop:8,fontSize:14,fontWeight:'600',color:isDark?'rgba(255,255,255,0.75)':theme.textSecondary,lineHeight:22}}>
                  {isUa
                    ?`Слабких серед активних: ${weakPct}%. Слабкі слова підіймаються вище в тренуванні.`
                    :`Weak among active: ${weakPct}%. Weak words are prioritized in training.`}
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:      {flex:1},
  safe:      {flex:1, paddingHorizontal:14, paddingTop:2},
  header:    {flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingHorizontal:2},
  greetText: {fontWeight:'700', flex:1, paddingRight:8},
  iconBtn:   {width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', borderWidth:0.5},

  // liquid glass card
  blur:       {borderRadius:18, overflow:'hidden', marginBottom:0},
  glassInner: {borderRadius:18, borderWidth:0.5},
  rowLayout:  {flexDirection:'row', alignItems:'center', gap:10, padding:10},

  // progress
  progTop:   {flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', padding:14, paddingBottom:8},
  progSub:   {fontWeight:'500'},
  progTitle: {fontWeight:'700', marginTop:1},
  progPct:   {fontWeight:'800'},
  barBg:     {height:5, borderRadius:3, overflow:'hidden', marginHorizontal:14, marginBottom:6},
  barFill:   {height:5, borderRadius:3},
  progCount: {fontWeight:'500', paddingHorizontal:14, paddingBottom:11},

  // stats
  grid2:     {flexDirection:'row', gap:8},
  statCard:  {flex:1},
  statLbl:   {fontWeight:'500', padding:10, paddingBottom:2},
  statVal:   {fontWeight:'800', paddingHorizontal:10},
  statUnit:  {fontWeight:'400', paddingHorizontal:10, paddingBottom:10},

  // nav tiles 3-in-a-row
  grid3:      {flexDirection:'row', gap:8},
  navTileWrap:{flex:1},
  navTile:    {flex:1},
  navIcon:    {width:36, height:36, borderRadius:11, alignItems:'center', justifyContent:'center', margin:10, marginBottom:6},
  navLabel:   {fontWeight:'600', paddingHorizontal:10, paddingBottom:10},

  // analytics modal
  modalRoot:   {flex:1},
  modalHeader: {flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingBottom:8},
  modalTitle:  {fontWeight:'700'},
  closeBtn:    {width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center'},
  aCard:       {borderRadius:18, padding:14, marginBottom:0},
  aCardTitle:  {fontWeight:'700', textTransform:'uppercase', letterSpacing:0.5},
  aStatCard:   {borderRadius:14, padding:14},
});