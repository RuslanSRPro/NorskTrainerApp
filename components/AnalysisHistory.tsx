import { Ionicons } from '@expo/vector-icons';
import { GlassOverlay } from '@/components/ui/glass/GlassOverlay';
// components/AnalysisHistory.tsx
// D10 28.10.2026 (agreed): "recent analyses" button + window in the Reading
// tab (next to "Problem words"). Up to 20 analyses kept on this device; an
// entry shows what was analysed, the words not in the database, and the
// result of its own job and of its CHILD jobs (save selected words, save a
// previewed word, re-run problem cards): status, number of words, words
// "for review" with the reason. Results are read with get-job-status when
// the entry is opened (nothing is written).

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getJobStatus } from '@/services/api';
import { loadAnalysisHistory } from '@/services/analysisHistory';
import type { HistoryEntry } from '@/services/analysisHistoryCore';

type Lang = 'ua' | 'en' | 'no';

const UI = {
  button: { ua: 'Останні аналізи', en: 'Recent analyses', no: 'Siste analyser' },
  title: { ua: 'Останні аналізи', en: 'Recent analyses', no: 'Siste analyser' },
  note: { ua: 'До 20 останніх, зберігаються на цьому пристрої.', en: 'Up to 20, kept on this device.', no: 'Opptil 20, lagret på denne enheten.' },
  empty: { ua: 'Аналізів ще немає.', en: 'No analyses yet.', no: 'Ingen analyser ennå.' },
  back: { ua: '← До списку', en: '← Back to the list', no: '← Tilbake til listen' },
  close: { ua: 'Закрити', en: 'Close', no: 'Lukk' },
  refresh: { ua: 'Оновити', en: 'Refresh', no: 'Oppdater' },
  text: { ua: 'Текст', en: 'Text', no: 'Tekst' },
  word: { ua: 'Слова', en: 'Words', no: 'Ord' },
  read: { ua: 'Читання', en: 'Reading', no: 'Lesing' },
  audit: { ua: 'Аудит', en: 'Audit', no: 'Revisjon' },
  not_in_base: { ua: 'Немає в базі', en: 'Not in the database', no: 'Ikke i databasen' },
  in_base: { ua: 'в базі', en: 'in the database', no: 'i databasen' },
  own_job: { ua: 'Задача аналізу', en: 'Analysis job', no: 'Analysejobb' },
  no_job: { ua: 'Без задачі (режим читання нічого не записує).', en: 'No job (reading mode writes nothing).', no: 'Ingen jobb (lesemodus skriver ingenting).' },
  children: { ua: 'Дочірні задачі', en: 'Child jobs', no: 'Underjobber' },
  save_selected: { ua: 'Збереження вибраних слів', en: 'Saving the selected words', no: 'Lagring av valgte ord' },
  save_preview: { ua: 'Збереження слова з перегляду', en: 'Saving a previewed word', no: 'Lagring av forhåndsvist ord' },
  rerun_problems: { ua: 'Повтор проблемних карток', en: 'Re-run of problem cards', no: 'Ny kjøring av problemkort' },
  done: { ua: 'Готово', en: 'Done', no: 'Ferdig' },
  done_review: { ua: 'Готово, частина слів на перевірку', en: 'Done, some words need review', no: 'Ferdig, noen ord må sjekkes' },
  stopped: { ua: 'Потребує перевірки', en: 'Needs review', no: 'Må sjekkes' },
  running: { ua: 'Обробляється', en: 'Processing', no: 'Behandles' },
  unreadable: { ua: 'Не вдалося прочитати стан задачі', en: 'Could not read the job state', no: 'Kunne ikke lese jobbstatus' },
  words_n: { ua: 'слів', en: 'words', no: 'ord' },
  review: { ua: 'На перевірку', en: 'For review', no: 'Til gjennomgang' },
  // D10 28.10.2026: incomplete words, stop reason, synonym child jobs, auto refresh
  incomplete: { ua: 'Не завершено', en: 'Not completed', no: 'Ikke fullført' },
  lacks: { ua: 'бракує', en: 'missing', no: 'mangler' },
  stop_reason: { ua: 'Причина зупинки', en: 'Why it stopped', no: 'Hvorfor den stoppet' },
  synonyms: { ua: 'Синоніми (створено сервером)', en: 'Synonyms (made by the server)', no: 'Synonymer (laget av serveren)' },
  syn_pending: { ua: 'Кандидатів у синоніми без задачі', en: 'Synonym candidates without a job', no: 'Synonymkandidater uten jobb' },
  auto: { ua: 'Стан оновлюється автоматично, поки задача обробляється.', en: 'The state refreshes by itself while a job is processing.', no: 'Statusen oppdateres selv mens en jobb behandles.' },
  translation_ua: { ua: 'переклад (укр.)', en: 'translation (uk)', no: 'oversettelse (uk)' },
  translation_en: { ua: 'переклад (англ.)', en: 'translation (en)', no: 'oversettelse (en)' },
  example: { ua: 'приклад', en: 'example', no: 'eksempel' },
  forms: { ua: 'форми', en: 'forms', no: 'former' },
  not_found_or_not_yet_eligible: { ua: 'не знайдено для збагачення', en: 'not found for enrichment', no: 'ikke funnet for berikelse' },
} as const;

// D10 28.10.2026 (agreed): known technical stop reasons of the supervisor in
// the app language; anything else is shown as it is.
function stopReasonText(reason: string, l: Lang): string {
  const gate = /^(\d+) items ended at admission_gate without promotion/.exec(reason);
  if (gate) return { ua: `Слів, що не пройшли допуск: ${gate[1]}`, en: `Words that did not pass admission: ${gate[1]}`,
    no: `Ord som ikke ble godkjent: ${gate[1]}` }[l];
  const heal = /still incomplete after (\d+) full heal passes: (\d+) items/.exec(reason);
  if (heal) return { ua: `Не завершено слів: ${heal[2]} (після ${heal[1]} спроб доповнити)`,
    en: `Words not completed: ${heal[2]} (after ${heal[1]} attempts to complete them)`,
    no: `Ord ikke fullført: ${heal[2]} (etter ${heal[1]} forsøk)` }[l];
  return reason;
}

const missingLabel = (field: string, l: Lang) => (UI as any)[field]?.[l] ?? field;

type JobView = { state: 'done' | 'done_review' | 'stopped' | 'running' | 'error'; total: number | null;
  review: Array<{ word: string | null; pos: string | null; code: string | null }>;
  // D10 28.10.2026: words the completion check left incomplete, the stop
  // reason, child jobs made by the server (synonyms)
  incomplete: Array<{ lemma: string; missing: string[]; heal_error: string | null }>;
  stopReason: string | null;
  childJobs: Array<{ id: string; created_at: string; reused: boolean }>;
  synonymPending: number };

async function readJob(jobId: string): Promise<JobView> {
  try {
    const r: any = await getJobStatus(jobId);
    const status = String(r?.status || '');
    const review = Array.isArray(r?.review_items) ? r.review_items : [];
    const state: JobView['state'] = status === 'completed' ? (review.length ? 'done_review' : 'done')
      : status === 'needs_manual_review' ? (String(r?.execution_state || '') === 'completed' ? 'done_review' : 'stopped')
      : 'running';
    const total = Number(r?.job?.total_items);
    const audit = r?.summary?.completion_audit;
    const incomplete = Array.isArray(audit?.incomplete_items) ? audit.incomplete_items.map((x: any) => ({
      lemma: String(x?.lemma ?? '?'), missing: Array.isArray(x?.missing) ? x.missing.map(String) : [],
      heal_error: x?.heal_error ? String(x.heal_error) : null })) : [];
    const stopReason = state === 'stopped' && typeof r?.summary?.supervisor_last_error === 'string'
      ? r.summary.supervisor_last_error : null;
    const childJobs = Array.isArray(r?.child_jobs) ? r.child_jobs.filter((c: any) => c?.id)
      .map((c: any) => ({ id: String(c.id), created_at: String(c.created_at ?? ''),
        reused: c.relationship === 'reused_prior' ||
          Date.parse(String(c.created_at)) < Date.parse(String(r?.job?.created_at)) })) : [];
    const synonymPending = Number(r?.synonym_candidates_without_job ?? 0) || 0;
    return { state, total: Number.isFinite(total) ? total : null, review,
      incomplete: state === 'done' ? [] : incomplete, stopReason, childJobs, synonymPending };
  } catch {
    return { state: 'error', total: null, review: [], incomplete: [], stopReason: null, childJobs: [], synonymPending: 0 };
  }
}

const ICON: Record<JobView['state'], string> = { done: '✅', done_review: '✅', stopped: '⚠️', running: '⏳', error: '✖' };

export function AnalysisHistory({ lang, theme: T, reasonText, posText, iconOnly = false, dark = false }: {
  iconOnly?: boolean; dark?: boolean;
  lang: Lang; theme: any;
  reasonText: (code: any) => string;
  posText: (pos: any) => string;
}) {
  const l: Lang = lang === 'en' || lang === 'no' ? lang : 'ua';
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<HistoryEntry[]>([]);
  const [current, setCurrent] = useState<HistoryEntry | null>(null);
  const [jobs, setJobs] = useState<Record<string, JobView | 'loading'>>({});

  async function show() {
    setList(await loadAnalysisHistory());
    setCurrent(null);
    setOpen(true);
  }

  // own job + app child jobs; the server child jobs (synonyms) of each are
  // read when its parent answers (one level, no recursion)
  function loadJobs(entry: HistoryEntry, quiet = false) {
    const ids = [entry.jobId, ...entry.children.map((c) => c.jobId)].filter(Boolean) as string[];
    if (!quiet) setJobs((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, 'loading' as const])) }));
    for (const id of ids) void readJob(id).then((view) => {
      setJobs((prev) => ({ ...prev, [id]: view }));
      for (const child of view.childJobs) {
        void readJob(child.id).then((cv) => setJobs((prev) => ({ ...prev, [child.id]: { ...cv, childJobs: [] } })));
      }
    });
  }

  // auto refresh every 10 s while a job of the open entry is still processing
  const anyRunning = Object.values(jobs).some((v) => v !== 'loading' && v.state === 'running');
  useEffect(() => {
    if (!open || !current || !anyRunning) return;
    const timer = setInterval(() => loadJobs(current, true), 10000);
    return () => clearInterval(timer);
  }, [open, current, anyRunning]);

  function openEntry(entry: HistoryEntry) {
    setCurrent(entry);
    loadJobs(entry);
  }

  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(l === 'ua' ? 'uk-UA' : l === 'no' ? 'nb-NO' : 'en-GB',
      { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  const modeLabel = (mode: string) => mode === 'audit' ? UI.audit[l] : UI.read[l];

  const JobBlock = ({ jobId, title, words }: { jobId: string; title: string; words?: string[] }) => {
    const view = jobs[jobId];
    return (
      <View style={[st.block, { borderColor: T.border, backgroundColor: T.cardAlt }]}>
        <Text style={[st.blockTitle, { color: T.textPrimary }]}>
          {view && view !== 'loading' ? `${ICON[view.state]} ` : '⏳ '}{title}
        </Text>
        {words?.length ? <Text style={[st.small, { color: T.textSecondary }]}>{words.join(', ')}</Text> : null}
        {view === 'loading' || !view ? <Text style={[st.small, { color: T.textMuted }]}>…</Text>
          : view.state === 'error' ? <Text style={[st.small, { color: T.danger }]}>{UI.unreadable[l]}</Text>
          : (
            <>
              <Text style={[st.small, { color: T.textSecondary }]}>
                {UI[view.state === 'done' ? 'done' : view.state === 'done_review' ? 'done_review' : view.state === 'stopped' ? 'stopped' : 'running'][l]}
                {view.total !== null ? ` · ${view.total} ${UI.words_n[l]}` : ''}
              </Text>
              {view.incomplete.length ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={[st.label, { color: T.textMuted }]}>⚠️ {UI.incomplete[l]}: {view.incomplete.length}</Text>
                  {view.incomplete.map((item, i) => (
                    <Text key={`${jobId}-inc-${i}`} style={[st.small, { color: T.textSecondary }]}>
                      {item.lemma}{item.missing.length ? ` — ${UI.lacks[l]}: ${item.missing.map((f) => missingLabel(f, l)).join(', ')}` : ''}
                    </Text>
                  ))}
                </View>
              ) : view.stopReason ? (
                <Text style={[st.small, { color: T.textSecondary, marginTop: 6 }]}>{UI.stop_reason[l]}: {stopReasonText(view.stopReason, l)}</Text>
              ) : null}
              {view.synonymPending > 0 ? (
                <Text style={[st.small, { color: T.textMuted, marginTop: 4 }]}>{UI.syn_pending[l]}: {view.synonymPending}</Text>
              ) : null}
              {view.review.length ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={[st.label, { color: T.textMuted }]}>⚠️ {UI.review[l]}: {view.review.length}</Text>
                  {view.review.map((item, i) => (
                    <Text key={`${jobId}-${i}`} style={[st.small, { color: T.textSecondary }]}>
                      {String(item?.word || '?')}{item?.pos ? ` (${posText(item.pos)})` : ''} — {reasonText(item?.code)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </>
          )}
        {view && view !== 'loading' && view.childJobs.length ? view.childJobs.map((child) => (
          <View key={child.id} style={{ marginTop: 8, marginLeft: 10 }}>
            <JobBlock jobId={child.id} title={`${child.reused
              ? (l === 'ua' ? 'Синоніми · попередня обробка' : l === 'no' ? 'Synonymer · tidligere behandling' : 'Synonyms · previous processing')
              : UI.synonyms[l]} · ${when(child.created_at)}`} />
          </View>
        )) : null}
      </View>
    );
  };

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={UI.button[l]}
        style={({pressed}) => [iconOnly ? { width:44,height:44,borderRadius:22,overflow:'hidden',alignItems:'center',justifyContent:'center' } : st.button,
          !iconOnly && {backgroundColor:T.cardAlt}, {opacity:pressed ? 0.65 : 1, transform:[{scale:pressed ? 0.94 : 1}]}]}
        onPress={() => { void show(); }}>
        {iconOnly ? <><GlassOverlay dark={dark} material="button" shape="card" radius={22}/><Ionicons name="time-outline" size={23} color={T.textPrimary}/></>
          : <Text style={{ color: T.textPrimary, fontWeight: '700' }}>🕘 {UI.button[l]}</Text>}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={st.overlay}>
          <View style={[st.card, { backgroundColor: T.card ?? '#FFFFFF' }]}>
            <ScrollView contentContainerStyle={{ padding: 18 }}>
              {!current ? (
                <>
                  <Text style={[st.title, { color: T.textPrimary }]}>🕘 {UI.title[l]}</Text>
                  <Text style={[st.small, { color: T.textMuted, marginBottom: 10 }]}>{UI.note[l]}</Text>
                  {list.length === 0 ? <Text style={[st.small, { color: T.textSecondary }]}>{UI.empty[l]}</Text> : null}
                  {list.map((entry) => (
                    <Pressable key={entry.id} onPress={() => openEntry(entry)}
                      style={[st.row, { borderBottomColor: T.border }]}>
                      <Text style={[st.small, { color: T.textMuted }]}>
                        {when(entry.startedAt)} · {modeLabel(entry.mode)} · {entry.kind === 'word' ? UI.word[l] : UI.text[l]}
                        {entry.children.length ? ` · +${entry.children.length}` : ''}
                      </Text>
                      <Text style={[st.rowText, { color: T.textPrimary }]} numberOfLines={2}>{entry.preview || '—'}</Text>
                    </Pressable>
                  ))}
                </>
              ) : (
                <>
                  <Pressable onPress={() => setCurrent(null)}>
                    <Text style={[st.link, { color: T.accent }]}>{UI.back[l]}</Text>
                  </Pressable>
                  <Text style={[st.small, { color: T.textMuted, marginTop: 8 }]}>
                    {when(current.startedAt)} · {modeLabel(current.mode)} · {current.kind === 'word' ? UI.word[l] : UI.text[l]}
                  </Text>
                  <Text style={[st.preview, { color: T.textPrimary }]}>{current.preview || '—'}</Text>
                  {current.counts ? (
                    <Text style={[st.small, { color: T.textSecondary }]}>
                      {UI.in_base[l]}: {current.counts.inBase} · {UI.not_in_base[l]}: {current.counts.unknown}
                    </Text>
                  ) : null}
                  {current.unknownWords?.length ? (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[st.label, { color: T.textMuted }]}>{UI.not_in_base[l]}</Text>
                      <Text style={[st.small, { color: T.danger }]}>{current.unknownWords.join(', ')}</Text>
                    </View>
                  ) : null}

                  <Text style={[st.label, { color: T.textMuted, marginTop: 14 }]}>{UI.own_job[l]}</Text>
                  {current.jobId ? <JobBlock jobId={current.jobId} title={UI.own_job[l]} />
                    : <Text style={[st.small, { color: T.textSecondary }]}>{UI.no_job[l]}</Text>}

                  {current.children.length ? (
                    <>
                      <Text style={[st.label, { color: T.textMuted, marginTop: 14 }]}>{UI.children[l]}: {current.children.length}</Text>
                      {current.children.map((child) => (
                        <JobBlock key={child.jobId} jobId={child.jobId}
                          title={`${UI[child.kind][l]} · ${when(child.startedAt)}`} words={child.words} />
                      ))}
                    </>
                  ) : null}

                  <Text style={[st.small, { color: T.textMuted, marginTop: 12 }]}>{UI.auto[l]}</Text>
                </>
              )}
              <Pressable style={[st.close, { backgroundColor: T.accent }]} onPress={() => setOpen(false)}>
                <Text style={st.closeText}>{UI.close[l]}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  button: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12, alignSelf: 'flex-start' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  card: { borderRadius: 22, maxHeight: '88%', width: '100%', maxWidth: 560, alignSelf: 'center', overflow: 'hidden' },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  row: { paddingVertical: 10, borderBottomWidth: 0.5 },
  rowText: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  preview: { fontSize: 15, fontWeight: '600', marginTop: 6, marginBottom: 6, lineHeight: 21 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  small: { fontSize: 13, lineHeight: 19 },
  link: { fontSize: 14, fontWeight: '700' },
  block: { borderRadius: 14, borderWidth: 0.5, padding: 12, marginTop: 8 },
  blockTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  close: { marginTop: 16, borderRadius: 16, paddingVertical: 14 },
  closeText: { textAlign: 'center', color: '#FFFFFF', fontWeight: '800' },
});
