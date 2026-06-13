export function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,!?;:()"«»""''\[\]{}]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .trim();
}

export function normalizeExpression(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,!?;:()"«»""''\[\]{}]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^å\s+/i, '')
    .trim();
}

export function tokenize(text: string): string[] {
  return String(text || '')
    .replace(/[.,!?;:()"«»""''\[\]{}]/g, ' ')
    .replace(/[–—]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}