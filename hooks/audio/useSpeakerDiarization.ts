import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import WhisperKitLocal from '@/modules/whisperkitlocal';
import LectureRecorder from '@/modules/lecturerecorder';
import type { LectureItem } from '@/features/audio/lectureTypes';
import {
  applySpeakerWindow, claimLectureRecovery, releaseLectureRecovery,
  commitLectureTextSnapshot, findAudioFile, getLectureDirectory,
  inspectDurableTranscriptInventory, lectureWorkGeneration, readMetadata,
  readSpeakerAnalysis, readTranscriptSegments, SPEAKER_ANALYSIS_FILE, SPEAKER_PROGRESS_FILE,
  speakerSourceKey, speakerTranscriptKey, speakerWindowPlan, validateLectureAudio,
  withAudioOperationDeadline, type SpeakerAnalysis,
} from '@/features/audio/lectureStorage';

const KEEP_AWAKE = 'norsktrainer-speaker-analysis';
type Options = {
  processingLockRef: MutableRefObject<'transcription' | 'translation' | null>;
  onChanged: (id: string) => void;
};
export function useSpeakerDiarization({ processingLockRef, onChanged }: Options) {
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const current = useRef<{cancel: () => void} | null>(null);
  const onChangedRef = useRef(onChanged);onChangedRef.current = onChanged;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; current.current?.cancel(); };
  }, []);
  const cancel = () => current.current?.cancel();
  const run = async (lecture: LectureItem) => {
    if (current.current || processingLockRef.current) return;
    const directory = getLectureDirectory(lecture.id);
    if (!claimLectureRecovery(directory.uri)) {
      if (mounted.current) setError('Audio recovery is still working on this lecture. Try again after it finishes.');
      return;
    }
    const generation = lectureWorkGeneration(lecture.id);
    let cancelled = false, rejectCancellation: (reason: Error) => void = () => {};
    const cancellation = new Promise<never>((_,reject) => { rejectCancellation = reject; });
    // A cancellation before the first await is also handled, without an unhandled rejection.
    void cancellation.catch(() => {});
    const job = {cancel: () => { cancelled = true; rejectCancellation(new Error('Speaker analysis cancelled.')); }};
    current.current = job;processingLockRef.current = 'transcription';
    let state: SpeakerAnalysis | null = null;
    let previousCompleted: SpeakerAnalysis | null = null;
    let nativeOperation: Promise<unknown> | null = null;
    const wait = <T,>(promise: Promise<T>, ms: number, label: string) =>
      Promise.race([withAudioOperationDeadline(promise, ms, label), cancellation]);
    const exists = () => directory.exists && lectureWorkGeneration(lecture.id) === generation;
    let transcriptKey = '';
    const check = () => {
      if (cancelled) throw new Error('Speaker analysis cancelled.');
      if (!exists() || transcriptKey && speakerTranscriptKey(readTranscriptSegments(directory, false)) !== transcriptKey) {
        throw new Error('The lecture or transcript changed. Late speaker analysis was discarded.');
      }
    };
    const save = () => {
      if (!state || !exists() || speakerTranscriptKey(readTranscriptSegments(directory, false)) !== transcriptKey) return;
      if (state.status === 'done') {
        // Publish only the complete replacement. A failed transaction restores
        // the previous result and leaves the separate checkpoint resumable.
        commitLectureTextSnapshot(directory, {
          [SPEAKER_ANALYSIS_FILE]: JSON.stringify(state),
          [SPEAKER_PROGRESS_FILE]: null,
        });
      } else {
        // Keep the last successful analysis (including user names) visible
        // throughout a replacement run, cancellation, crash or inference error.
        const target = previousCompleted ? SPEAKER_PROGRESS_FILE : SPEAKER_ANALYSIS_FILE;
        commitLectureTextSnapshot(directory, { [target]: JSON.stringify(state) });
      }
    };
    try {
      if (mounted.current) {setLectureId(lecture.id);setProgress(0);setError(null);}
      if (typeof WhisperKitLocal.diarizeWindow !== 'function') throw new Error('Install the iOS build with SpeakerKit support first.');
      const awake = activateKeepAwakeAsync(KEEP_AWAKE);
      void awake.then(() => {
        if (cancelled || current.current !== job) void Promise.resolve().then(() => deactivateKeepAwake(KEEP_AWAKE)).catch(() => {});
      }, () => {});
      await wait(awake,10000,'Keep awake');
      check();
      const metadata = readMetadata(directory), segments = readTranscriptSegments(directory, false);
      const recorder = LectureRecorder.getStatus();
      if (recorder.isRecording || recorder.isStarting || recorder.cleanupPending || recorder.uri ||
          metadata.recordingState === 'recording' || metadata.recordingState === 'interrupted' ||
          !lecture.transcriptReady || !segments.length || metadata.transcription && metadata.transcription.status !== 'done') {
        throw new Error('Finish recording and transcription before identifying speakers.');
      }
      transcriptKey = speakerTranscriptKey(segments);
      const inventory = inspectDurableTranscriptInventory(directory, metadata.durationMillis ?? lecture.durationMillis);
      if (inventory.unresolved || inventory.present && !inventory.complete) throw new Error(inventory.error || 'Audio recovery is required.');
      let sources = inventory.sources;
      let useOverlap = false;
      const audio = findAudioFile(directory, metadata);
      if (audio) {
        try {
          const valid = await wait(validateLectureAudio(audio.file.uri), 12000, 'Speaker source validation');
          check();
          const expected = inventory.complete ? inventory.durationMillis : Math.max(metadata.durationMillis ?? 0, lecture.durationMillis);
          const tolerance = Math.max(2000, Math.min(10000, Math.round(expected * 0.0015)));
          if (valid.valid && valid.playable && valid.durationMillis > 0 && Math.abs(valid.durationMillis - expected) <= tolerance) {
            sources = [{uri: audio.file.uri, durationSeconds: valid.durationMillis / 1000, globalStartSeconds: 0}];
            useOverlap = true;
          }
        } catch (failure) {
          check();
          if (!inventory.complete) throw failure;
        }
      }
      if (!sources.length) throw new Error('Saved audio is unavailable.');
      const windows = speakerWindowPlan(sources, useOverlap ? 30 : 0), sourceKey = speakerSourceKey(windows);
      state = readSpeakerAnalysis(directory, segments);
      if (state?.status === 'done') previousCompleted = state;
      if (!state || state.engine !== 'speakerkit-1.1.1-v3-r2' || state.sourceKey !== sourceKey || state.totalWindows !== windows.length) {
        state = {version: 1, engine: 'speakerkit-1.1.1-v3-r2', transcriptKey, sourceKey,
          status: 'processing', nextWindow: 0, totalWindows: windows.length, profiles: [], turns: [], processedUntilSeconds: 0};
      }
      if (previousCompleted && state.status !== 'done') {
        const progress = readSpeakerAnalysis(directory, segments, SPEAKER_PROGRESS_FILE);
        if (progress && progress.engine === 'speakerkit-1.1.1-v3-r2' &&
            progress.sourceKey === sourceKey && progress.totalWindows === windows.length &&
            progress.status !== 'done') state = progress;
      }
      if (state.status === 'done') {
        if (mounted.current) {setProgress(1);onChangedRef.current(lecture.id);}
        return;
      }
      state={...state,status:'processing',error:undefined};
      if (!previousCompleted) save();
      while (state.nextWindow < windows.length) {
        check();const window=windows[state.nextWindow];
        // Repeated audio links the same voices across windows; native ownership survives JS timeout.
        const operation=WhisperKitLocal.diarizeWindow(window.uri,window.start,window.end);
        nativeOperation=operation;
        const result=await wait(operation,180000,'Speaker analysis window');check();
        state=applySpeakerWindow(state,window,result);save();
        if(mounted.current)setProgress(state.nextWindow/windows.length);
      }
      check();
      if(speakerSourceKey(windows)!==sourceKey)throw new Error('Audio changed during speaker analysis. Retry with the current recording.');
      state={...state,status:'done',error:undefined};save();
      if(mounted.current)onChangedRef.current(lecture.id);
    } catch (failure) {
      const message=failure instanceof Error?failure.message:String(failure);
      if(state && (!previousCompleted || state.nextWindow > 0)){state={...state,status:cancelled?'cancelled':'error',error:message};try{save();}catch{/* Previous committed checkpoint remains resumable. */}}
      if(mounted.current){if(!cancelled)setError(message);onChangedRef.current(lecture.id);}
    } finally {
      // The late native result is never published. Unload only after its real
      // completion; native admission also prevents unloading a newer operation.
      const release=()=>Promise.resolve().then(()=>WhisperKitLocal.releaseSpeakerModels()).catch(()=>{});
      if(nativeOperation)void nativeOperation.then(release,release);
      else void release();
      releaseLectureRecovery(directory.uri);
      if(current.current===job){current.current=null;processingLockRef.current=null;}
      if(mounted.current)setLectureId(null);
      void Promise.resolve().then(()=>deactivateKeepAwake(KEEP_AWAKE)).catch(()=>{});
    }
  };
  const rename = (lecture: LectureItem, id: number, name: string) => {
    if(current.current || processingLockRef.current)return;
    const directory=getLectureDirectory(lecture.id),segments=readTranscriptSegments(directory, false),state=readSpeakerAnalysis(directory,segments);
    if(!state || !state.profiles.some(p=>p.id===id))return;
    const label=name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80);
    try {
    commitLectureTextSnapshot(directory,{[SPEAKER_ANALYSIS_FILE]:JSON.stringify({...state,profiles:state.profiles.map(p=>p.id===id?{...p,name:label||undefined}:p)})});
    onChangedRef.current(lecture.id);
    } catch (failure) { if(mounted.current)setError(String(failure)); }
  };
  return {lectureId,progress,error,run,cancel,rename};
}
