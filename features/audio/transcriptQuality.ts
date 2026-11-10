import type { SavedTranscriptSegment } from './lectureTypes';


// Review hints, not calibrated probabilities of an error. Never remove speech.
export function transcriptNeedsReview(segment: SavedTranscriptSegment): boolean {
  const log = segment.avgLogProb;
  const silence = segment.noSpeechProb;
  if (typeof log !== 'number' || !Number.isFinite(log) || log > 0) return false;
  return log <= -1 || (log <= -0.5 && typeof silence === 'number' &&
    Number.isFinite(silence) && silence >= 0.6 && silence <= 1);
}

function combinedConfidence(a: SavedTranscriptSegment, b: SavedTranscriptSegment) {
  // Keep a real pair of scores: combining one fragment's silence score with
  // another's log probability could manufacture a warning neither had.
  const candidates = [a, b].filter(segment => typeof segment.avgLogProb === 'number' &&
    Number.isFinite(segment.avgLogProb) && segment.avgLogProb <= 0);
  candidates.sort((left, right) => Number(transcriptNeedsReview(right)) - Number(transcriptNeedsReview(left)) ||
    left.avgLogProb! - right.avgLogProb!);
  const chosen = candidates[0];
  return { avgLogProb: chosen?.avgLogProb, noSpeechProb: chosen?.noSpeechProb };
}

export function endsTranscriptSentence(text: string): boolean {
  const tail = text.trim().replace(/[”"'»’)}\]]+$/u, '').trim();
  if (/[?!]$/u.test(tail)) return true;
  if (!tail.endsWith('.') || tail.endsWith('...')) return false;
  // Keep common Norwegian/English abbreviations, initials and ordinal numbers
  // attached to their continuation. This is punctuation guidance, not semantics.
  if (/(?:^|\s)(?:kl|ca|nr|dr|prof|mr|mrs|ms|fru|bl\.a|f\.eks|dvs|osv|evt|jf|mfl|mm|etc)\.$/iu.test(tail)) return false;
  if (/(?:^|\s)(?:\p{L}|\d+)\.$/u.test(tail)) return false;
  return true;
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Only remove repeated text backed by the same time interval. Short replies,
// distinct known speakers and similar-but-different wording remain intact.
export function stitchTranscriptSegments(input: SavedTranscriptSegment[]): SavedTranscriptSegment[] {
  const output: SavedTranscriptSegment[] = [];
  const candidates = input.filter(s => Number.isFinite(s.start) && Number.isFinite(s.end)
    && s.start >= 0 && s.end >= s.start && s.text.trim()).sort((a, b) => a.start - b.start);
  let active: number[] = [];
  for (const source of candidates) {
    let candidate = { ...source, text: source.text.trim() };
    active = active.filter(index => output[index].end > candidate.start);
    let consumed = false;
    for (const index of active) {
      const previous = output[index];
      if (previous.speakerId !== candidate.speakerId) continue;
      const overlap = Math.min(previous.end, candidate.end) - Math.max(previous.start, candidate.start);
      if (overlap <= 0) continue;
      const left = words(previous.text), right = words(candidate.text);
      const shorterDuration = Math.min(previous.end - previous.start, candidate.end - candidate.start);
      if (shorterDuration <= 0 || overlap / shorterDuration < 0.6) continue;
      const leftKey = ` ${left.join(' ')} `, rightKey = ` ${right.join(' ')} `;
      if (Math.min(left.length, right.length) >= 3 &&
          (leftKey.includes(rightKey) || rightKey.includes(leftKey))) {
        const longer = left.length >= right.length ? previous : candidate;
        output[index] = { ...longer, ...combinedConfidence(previous, candidate), start: Math.min(previous.start, candidate.start),
          end: Math.max(previous.end, candidate.end) };
        consumed = true;
        break;
      }
      // Preserve new words on either side of an exact boundary overlap.
      if (candidate.end < previous.end) continue;
      const limit = Math.min(left.length, right.length);
      for (let count = limit; count >= 4; count -= 1) {
        if (left.slice(-count).join(' ') !== right.slice(0, count).join(' ')) continue;
        const tokens = [...candidate.text.matchAll(/[\p{L}\p{N}]+/gu)];
        const next = tokens[count];
        if (!next) break;
        output[index] = { ...previous, ...combinedConfidence(previous, candidate), end: Math.max(previous.end, candidate.end),
          text: `${previous.text} ${candidate.text.slice(next.index).trim()}` };
        consumed = true;
        break;
      }
      if (consumed) break;
    }
    if (!consumed) {
      active.push(output.length);
      output.push(candidate);
    }
  }
  return output;
}

export function transcriptReviewGaps(segments: SavedTranscriptSegment[], duration: number) {
  if (!Number.isFinite(duration) || duration <= 0 || segments.length === 0) return [];
  const gaps: Array<{start: number; end: number}> = [];
  let end = 0;
  for (const segment of [...segments].sort((a, b) => a.start - b.start)) {
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.end < segment.start) continue;
    const start = Math.max(0, Math.min(duration, segment.start));
    if (start - end >= 10) gaps.push({start: end, end: start});
    end = Math.max(end, Math.min(duration, segment.end));
  }
  if (duration - end >= 10) gaps.push({start: end, end: duration});
  return gaps;
}

// The translated block retains the span of its source text. Word-level timing
// cannot be reconstructed after translation, which can reorder the words.
export function translationBlocks(segments: SavedTranscriptSegment[]): SavedTranscriptSegment[] {
  const blocks: SavedTranscriptSegment[] = [];
  let pending: SavedTranscriptSegment[] = [];
  const emit = (count = pending.length) => {
    const selected = pending.splice(0, count);
    if (!selected.length) return;
    blocks.push({ ...selected[0], end: selected[selected.length - 1].end,
      text: selected.map(segment => segment.text).join(' ') });
  };
  const exceedsBudget = (next: SavedTranscriptSegment) => pending.length > 0 &&
    (next.end - pending[0].start > 45 ||
      pending.reduce((total, segment) => total + segment.text.length + 1, 0) + next.text.length > 600);
  for (const segment of stitchTranscriptSegments(segments)) {
    const previous = pending.at(-1);
    const gap = previous ? segment.start - previous.end : Infinity;
    const questionOrNewTurn = previous && (/[?!][”"'»)]*$/.test(previous.text) || /^\s*[-–—]/.test(segment.text));
    if (previous && (previous.speakerId !== segment.speakerId || gap < -0.05 || gap > 2 || questionOrNewTurn)) emit();
    while (exceedsBudget(segment)) {
      // Prefer the last complete sentence already in the block. The trailing
      // unfinished sentence moves intact into the next block, with its real times.
      let boundary = -1;
      for (let i = pending.length - 1; i >= 0; i--) {
        if (endsTranscriptSentence(pending[i].text)) { boundary = i; break; }
      }
      emit(boundary >= 0 ? boundary + 1 : pending.length);
    }
    pending.push({ ...segment });
  }
  emit();
  return blocks;
}
