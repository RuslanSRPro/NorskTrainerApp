// app/(tabs)/weak.tsx
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getLearningWordsFromSupabase } from '@/services/api';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/contexts/ThemeContext';

export default function WeakScreen() {
  const router = useRouter();
  const { theme, fonts } = useTheme();
  const { preferred_user, app_language } = useSettingsStore();
  const isUa = app_language === 'ua';

  const [loading, setLoading] = useState(true);
  const [words, setWords]     = useState<any[]>([]);
  const [error, setError]     = useState('');

  useEffect(() => { loadWeakWords(); }, [preferred_user]);

  const summary = useMemo(() => ({
    total:          words.length,
    veryWeak:       words.filter(w => getWeakScore(w) >= 70).length,
    readingBoosted: words.filter(w => getPersonalHits(w) > 0).length,
    passive:        words.filter(w => getMemoryStatus(w) === 'passive_known').length,
  }), [words]);

  async function loadWeakWords() {
    try {
      setLoading(true); setError('');
      const data = await getLearningWordsFromSupabase({ preferred_user, study_set: 'weak', category_filter: 'all', daily_limit: 100 });
      setWords(data);
    } catch (e: any) { console.log('Weak words load error:', e); setError(String(e?.message || e)); }
    finally { setLoading(false); }
  }

  function getSrs(w: any)          { return w?.srs || {}; }
  function getWeakScore(w: any)    { return Number(w?.weakScore    ?? getSrs(w).weak_score    ?? 0); }
  function getPriorityScore(w: any){ return Number(w?.priorityScore?? getSrs(w).priority_score?? 0); }
  function getMemoryScore(w: any)  { return Number(w?.memoryScore  ?? getSrs(w).memory_score  ?? 0); }
  function getPersonalHits(w: any) { return Number(w?.personalHits ?? getSrs(w).personal_hits ?? 0); }
  function getMemoryStatus(w: any) { return String(w?.memoryStatus ?? getSrs(w).memory_status ?? 'active'); }
  function getTranslation(w: any)  { const ua=w?.ua||'',en=w?.en||''; return isUa ? ua||en : en||ua; }

  function getWeakLevel(score: number) {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'weak';
    if (score >= 20) return 'unstable';
    return 'stable';
  }
  function getWeakLevelLabel(score: number) {
    const l = getWeakLevel(score);
    return l === 'critical' ? 'CRITICAL' : l === 'weak' ? 'WEAK' : l === 'unstable' ? 'UNSTABLE' : 'STABLE';
  }
  function getWeakReason(w: any) {
    const wk=getWeakScore(w), pr=getPriorityScore(w), hi=getPersonalHits(w), st=getMemoryStatus(w);
    if (wk >= 80) return isUa ? 'Критично слабке слово: багато помилок або провалів.' : 'Critical weak word: many mistakes or lapses.';
    if (wk >= 50) return isUa ? 'Слабке слово: потребує частого повторення.' : 'Weak word: needs frequent review.';
    if (wk >= 20) return isUa ? 'Нестабільне слово: краще ще закріпити.' : 'Unstable word: should be reinforced.';
    if (pr >= 90) return isUa ? 'Високий пріоритет повторення' : 'High review priority';
    if (hi > 0)   return isUa ? 'Часто зустрічалось у Reading' : 'Seen often in Reading';
    if (st === 'weak') return isUa ? 'Позначено як слабке' : 'Marked as weak';
    return isUa ? 'Потребує повторення' : 'Needs review';
  }
  function getStatusLabel(status: string) {
    const ua: Record<string,string> = { active:'Active', reinforcement:'Закріплення', passive_known:'Пасивно відоме', weak:'Слабке', archived:'Архів' };
    const en: Record<string,string> = { active:'Active', reinforcement:'Reinforcement', passive_known:'Passive known', weak:'Weak', archived:'Archived' };
    return isUa ? ua[status]||status : en[status]||status;
  }

  // badge colours — semantic, stay fixed
  function badgeStyle(level: string) {
    if (level === 'critical') return { bg: '#FEE2E2', text: '#991B1B' };
    if (level === 'weak')     return { bg: '#FED7AA', text: '#C2410C' };
    if (level === 'unstable') return { bg: '#FEF3C7', text: '#B45309' };
    return { bg: '#E5E7EB', text: '#6B7280' };
  }

  const T = theme, F = fonts;

  return (
    <ScrollView style={{ flex:1, backgroundColor:T.background }} contentContainerStyle={s.content}>
      <Text style={[s.title, { color:T.textPrimary, fontSize:22 }]}>
        {isUa ? '🔥 Слабкі слова' : '🔥 Weak Words'}
      </Text>
      <Text style={[s.subtitle, { color:T.textSecondary, fontSize:F.base }]}>
        {isUa ? 'Слова, які потребують додаткового повторення.' : 'Forgotten, unstable and difficult vocabulary.'}
      </Text>

      {loading ? <ActivityIndicator size="large" color={T.accent} /> : null}
      {error    ? <Text style={[s.error, { backgroundColor:T.dangerSoft, color:T.danger }]}>{error}</Text> : null}

      {/* Summary grid */}
      {!loading && !error && words.length > 0 ? (
        <View style={s.summaryGrid}>
          {[
            { label: isUa?'Усього':'Total',           value: summary.total },
            { label: isUa?'Дуже слабкі':'Very weak',  value: summary.veryWeak },
            { label: 'Reading',                        value: summary.readingBoosted },
            { label: isUa?'Пасивні':'Passive',         value: summary.passive },
          ].map(({ label, value }) => (
            <View key={label} style={[s.summaryCard, { backgroundColor:T.card, borderColor:T.border }]}>
              <Text style={[s.summaryValue, { color:T.accent, fontSize:F.translation }]}>{value}</Text>
              <Text style={[s.summaryLabel, { color:T.textMuted, fontSize:F.meta }]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Empty state */}
      {!loading && !error && words.length === 0 ? (
        <View style={[s.emptyCard, { backgroundColor:T.card, borderColor:T.border }]}>
          <Text style={[s.emptyTitle, { color:T.textPrimary, fontSize:F.base+4 }]}>
            {isUa ? 'Поки немає слабких слів' : 'No weak words yet'}
          </Text>
          <Text style={[s.emptyText, { color:T.textSecondary, fontSize:F.base }]}>
            {isUa ? 'Натискай Hard або помиляйся в тренуванні — слова зʼявляться тут.' : 'Press Hard or make mistakes in training, and words will appear here.'}
          </Text>
        </View>
      ) : null}

      {/* Word cards */}
      {words.map(word => {
        const ws = getWeakScore(word), level = getWeakLevel(ws), badge = badgeStyle(level);
        return (
          <View key={word.id} style={[s.wordCard, { backgroundColor:T.card, borderColor:T.border }]}>
            <View style={s.wordHeader}>
              <View style={{ flex:1 }}>
                <Text style={[s.word, { color:T.textPrimary, fontSize:F.base+6 }]}>{word.word}</Text>
                <Text style={[s.translation, { color:T.accent, fontSize:F.base }]}>{getTranslation(word)}</Text>
              </View>
              <View style={[s.scoreBadge, { backgroundColor:badge.bg }]}>
                <Text style={[s.scoreBadgeValue, { color:badge.text, fontSize:F.base+4 }]}>{ws}</Text>
                <Text style={[s.scoreBadgeLabel, { color:badge.text }]}>{getWeakLevelLabel(ws)}</Text>
              </View>
            </View>
            <Text style={[s.meta, { color:T.textMuted, fontSize:F.meta }]}>{word.category||word.type||''}</Text>
            <View style={[s.reasonBox, { backgroundColor:T.cardAlt }]}>
              <Text style={[s.reasonLabel, { color:T.textMuted }]}>{isUa?'Причина':'Reason'}</Text>
              <Text style={[s.reasonText, { color:T.textSecondary, fontSize:F.base }]}>{getWeakReason(word)}</Text>
            </View>
            <View style={s.metricsGrid}>
              {[
                { label:'Memory',      value: getMemoryScore(word) },
                { label:'Priority',    value: getPriorityScore(word) },
                { label:'Reading hits',value: getPersonalHits(word) },
                { label:'Status',      value: getStatusLabel(getMemoryStatus(word)) },
              ].map(({ label, value }) => (
                <View key={label} style={[s.metricBox, { backgroundColor:T.cardAlt }]}>
                  <Text style={[s.metricLabel, { color:T.textMuted }]}>{label}</Text>
                  <Text style={[s.metricValue, { color:T.textPrimary, fontSize:F.base }]}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}

      {words.length > 0 ? (
        <Pressable style={[s.trainBtn, { backgroundColor:T.accent }]} onPress={() => router.push('/explore')}>
          <Text style={[s.trainBtnText, { fontSize:F.base }]}>
            {isUa ? 'Тренувати слабкі слова' : 'Train weak words'}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content:        { paddingTop:70, paddingHorizontal:20, paddingBottom:120 },
  title:          { fontWeight:'900', marginBottom:10 },
  subtitle:       { lineHeight:24, marginBottom:24 },
  summaryGrid:    { flexDirection:'row', flexWrap:'wrap', gap:12, marginBottom:18 },
  summaryCard:    { width:'47%', borderRadius:18, padding:16, borderWidth:0.5 },
  summaryValue:   { fontWeight:'900', marginBottom:4 },
  summaryLabel:   { fontWeight:'700' },
  wordCard:       { borderRadius:22, padding:18, marginBottom:14, borderWidth:0.5 },
  wordHeader:     { flexDirection:'row', gap:12, alignItems:'flex-start' },
  word:           { fontWeight:'900', marginBottom:6 },
  translation:    { fontWeight:'700', lineHeight:24, marginBottom:6 },
  scoreBadge:     { minWidth:76, borderRadius:16, paddingVertical:10, paddingHorizontal:10, alignItems:'center' },
  scoreBadgeValue:{ fontWeight:'900' },
  scoreBadgeLabel:{ marginTop:2, fontSize:10, fontWeight:'900', textTransform:'uppercase' },
  meta:           { fontWeight:'700', marginTop:4 },
  reasonBox:      { marginTop:14, borderRadius:16, padding:14 },
  reasonLabel:    { fontSize:12, fontWeight:'900', marginBottom:4, textTransform:'uppercase' },
  reasonText:     { fontWeight:'800', lineHeight:22 },
  metricsGrid:    { flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:14 },
  metricBox:      { width:'47%', borderRadius:14, padding:12 },
  metricLabel:    { fontSize:11, fontWeight:'900', textTransform:'uppercase', marginBottom:5 },
  metricValue:    { fontWeight:'900' },
  emptyCard:      { borderRadius:20, padding:20, borderWidth:0.5 },
  emptyTitle:     { fontWeight:'900', marginBottom:8 },
  emptyText:      { lineHeight:22 },
  trainBtn:       { marginTop:12, borderRadius:18, paddingVertical:16 },
  trainBtnText:   { color:'#FFFFFF', textAlign:'center', fontWeight:'900' },
  error:          { padding:14, borderRadius:12, marginBottom:20 },
});