const TRANSLATION_CHUNK_MAX_CHARS = 1200;

// Bound actual translation requests, including a single unbroken token. Keep
// every non-whitespace character, and never cut a UTF-16 surrogate pair.
export function splitTextForTranslation(rawText: string, maxChars = TRANSLATION_CHUNK_MAX_CHARS): string[] {
  if (!Number.isSafeInteger(maxChars) || maxChars < 2) throw new Error('Translation chunk size must be an integer of at least 2.');
  let remaining = rawText.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const chunks: string[] = [];
  while (remaining.length > maxChars) {
    let cut = maxChars;
    // A high surrogate at the boundary belongs to the following low surrogate.
    const code = remaining.charCodeAt(cut - 1);
    if (code >= 0xD800 && code <= 0xDBFF) cut -= 1;
    const head = remaining.slice(0, cut);
    const sentences = [...head.matchAll(/[.!?…][”"'»’)]*(?:\s+|$)/gu)];
    const lastSentence = sentences.at(-1);
    const sentenceEnd = lastSentence ? lastSentence.index! + lastSentence[0].length : 0;
    if (sentenceEnd >= Math.floor(maxChars / 2)) cut = sentenceEnd;
    else {
      const spaces = [...head.matchAll(/\s+/gu)];
      const lastSpace = spaces.at(-1);
      if (lastSpace && lastSpace.index! > 0) cut = lastSpace.index! + lastSpace[0].length;
    }
    const piece = remaining.slice(0, cut).trim();
    if (piece) chunks.push(piece);
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
