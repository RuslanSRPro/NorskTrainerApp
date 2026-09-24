import { Text } from 'react-native';

type Props = {
  value: string;
  word?: any;
  style?: any;
  mainColor: string;
  componentColor?: string;
  separatorColor?: string;
  onPress?: () => void;
};

type Segment = { text: string; color: string };

const normalize = (value: string) =>
  String(value || '').normalize('NFC').toLocaleLowerCase('nb-NO');

function getParts(word: any): string[] {
  const value = word?.compoundParts ?? word?.compound_parts;
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function compoundSegments(
  value: string,
  word: any,
  mainColor: string,
  componentColor: string,
  separatorColor: string,
): Segment[] | null {
  if (word?.isCompound !== true && word?.is_compound !== true) return null;

  const headword = String(word?.headword || word?.morphologySourceLemma || word?.morphology_source_lemma || '').trim();
  const parts = getParts(word);
  if (!headword || parts.length < 2) return null;

  const source = String(value || '');
  const headStart = normalize(source).lastIndexOf(normalize(headword));
  if (headStart < 0) return null;

  const result: Segment[] = [];
  const prefix = source.slice(0, headStart);
  if (prefix) {
    const articlePattern = /^(\s*)(en|ei|et)(\b)/i;
    const match = prefix.match(articlePattern);
    if (match) {
      result.push({ text: match[1], color: separatorColor });
      result.push({ text: match[2], color: mainColor });
      result.push({ text: match[3], color: separatorColor });
      const rest = prefix.slice(match[0].length);
      if (rest) result.push({ text: rest, color: componentColor });
    } else {
      result.push({ text: prefix, color: componentColor });
    }
  }

  const head = source.slice(headStart, headStart + headword.length);
  const normalizedHead = normalize(head);
  let cursor = 0;
  const normalizedParts = parts.map(normalize);
  normalizedParts.forEach((part, index) => {
    const at = normalizedHead.indexOf(part, cursor);
    if (at < 0) return;
    if (at > cursor) {
      result.push({ text: head.slice(cursor, at), color: separatorColor });
    }
    result.push({
      text: head.slice(at, at + part.length),
      color: index === normalizedParts.length - 1 ? mainColor : componentColor,
    });
    cursor = at + part.length;
  });
  if (cursor < head.length) {
    result.push({ text: head.slice(cursor), color: separatorColor });
  }

  const suffix = source.slice(headStart + headword.length);
  if (suffix) result.push({ text: suffix, color: separatorColor });
  return result;
}

export function CompoundWordText({
  value,
  word,
  style,
  mainColor,
  componentColor = '#A85F38',
  separatorColor = mainColor,
  onPress,
}: Props) {
  const segments = compoundSegments(
    value,
    word,
    mainColor,
    componentColor,
    separatorColor,
  );
  if (!segments) return <Text onPress={onPress} style={[style, { color: mainColor }]}>{value}</Text>;

  return (
    <Text onPress={onPress} style={style}>
      {segments.map((segment, index) => (
        <Text key={`${index}-${segment.text}`} style={{ color: segment.color }}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}
