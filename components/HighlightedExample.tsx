import React from 'react';
import { Text, type TextProps } from 'react-native';
import { storedHighlightRanges } from '../supabase/functions/_shared/example-highlights';

function escapePattern(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function legacyRange(text: string, phrase: string) {
  const normalized = phrase.replace(/^å\s+/i, '').trim();
  if (!normalized) return [];
  const pattern = normalized.split(/(\[[^\]]+\])/g).map(part =>
    part.startsWith('[') && part.endsWith(']')
      ? `(?:${part.slice(1, -1).split('|').map(escapePattern).join('|')})`
      : escapePattern(part).replace(/\s+/g, '\\s+')).join('')
    .replace(/^gripe(?=\\s|$)/i, '(?:gripe|griper|grep|grepet)')
    .replace(/\\s\+seg(?=\\s|$)/gi, '\\s+(?:seg|meg|deg|oss|dere)');
  try {
    const match = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'iu').exec(text);
    return match ? [{ start: match.index, end: match.index + match[0].length }] : [];
  } catch { return []; }
}
export function HighlightedExample({ text, phrase = '', compact = false, textStyle, evidence, language = 'nb', ...props }:
  { text: string; phrase?: string; compact?: boolean; textStyle?: TextProps['style']; evidence?: unknown; language?: 'nb' | 'uk' } & TextProps) {
  const ranges = evidence && (evidence as any).example_highlights
    ? storedHighlightRanges(text, evidence, language) ?? [] : legacyRange(text, phrase);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    parts.push(text.slice(cursor, range.start));
    parts.push(<Text key={range.start} style={{ color: '#8B4513', fontWeight: '700' }}>{text.slice(range.start, range.end)}</Text>);
    cursor = range.end;
  }
  parts.push(text.slice(cursor));
  return <Text {...props} style={[compact && { fontSize: 14, lineHeight: 19 }, textStyle, props.style]}>{parts}</Text>;
}
