const TRANSLATION_CHUNK_MAX_CHARS =
  1200;

export function splitTextForTranslation(
  rawText: string,
  maxChars =
    TRANSLATION_CHUNK_MAX_CHARS
) {
  const text =
    rawText
      .replace(
        /\r\n/g,
        '\n'
      )
      .replace(
        /[ \t]+/g,
        ' '
      )
      .trim();

  if (!text) {
    return [];
  }

  if (
    text.length <=
      maxChars
  ) {
    return [text];
  }

  const sentenceCandidates =
    text.match(
      /[^.!?…]+(?:[.!?…]+|$)/g
    ) ??
    [text];

  const pieces:
    string[] = [];

  for (
    const rawSentence
    of sentenceCandidates
  ) {
    const sentence =
      rawSentence.trim();

    if (!sentence) {
      continue;
    }

    if (
      sentence.length <=
        maxChars
    ) {
      pieces.push(
        sentence
      );
      continue;
    }

    const words =
      sentence.split(
        /\s+/
      );

    let wordChunk =
      '';

    for (
      const word
      of words
    ) {
      const candidate =
        wordChunk
          ? `${wordChunk} ${word}`
          : word;

      if (
        candidate.length >
          maxChars &&
        wordChunk
      ) {
        pieces.push(
          wordChunk
        );
        wordChunk =
          word;
      } else {
        wordChunk =
          candidate;
      }
    }

    if (wordChunk) {
      pieces.push(
        wordChunk
      );
    }
  }

  const chunks:
    string[] = [];

  let current =
    '';

  for (
    const piece
    of pieces
  ) {
    const candidate =
      current
        ? `${current} ${piece}`
        : piece;

    if (
      candidate.length >
        maxChars &&
      current
    ) {
      chunks.push(
        current
      );
      current =
        piece;
    } else {
      current =
        candidate;
    }
  }

  if (current) {
    chunks.push(
      current
    );
  }

  return chunks;
}
