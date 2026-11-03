// D10 27.10.2026 (agreed): an AI example of a noun with TWO genders (en/ei,
// 245 nouns on 27.10.2026) shows the preferred form and, right after it, the
// other gender's form in parentheses:
//   definite singular:   "Jeg leste boken (boka)."   (V2: primary boken, alternative boka)
//   indefinite singular: "Jeg kjøpte en bok (ei bok)." (articles en, ei; first = preferred)
// The preferred form is the first one Ordbøkene gives (V2 primary_values /
// the first accepted article). Applied to the AI answer BEFORE the review, so
// the reviewed example is exactly the one written. A form that is already
// "preferred (other)" is left as it is; plural forms that are the same for
// both genders are not touched. Pure functions, no network, no database.

export type V2FormRow = {
  form_key: string;
  primary_values: string[] | null;
  alternative_values: string[] | null;
  accepted_articles: string[] | null;
};

export type GenderRule = {
  // preferred form -> the other form(s) of the same slot (boken -> [boka])
  pairs: Array<{ preferred: string; others: string[] }>;
  // indefinite singular with its articles (bok, [en, ei])
  indefinite: { noun: string; articles: string[] } | null;
};

const norm = (value: string) => value.normalize('NFC').toLocaleLowerCase('nb-NO').trim();

// Rule of one noun from its V2 rows; null when it has fewer than two articles.
export function genderRuleFromForms(rows: V2FormRow[]): GenderRule | null {
  const articles = [...new Set(rows.flatMap((r) => (r.accepted_articles ?? []).map(norm)))]
    .filter((a) => a === 'en' || a === 'ei' || a === 'et');
  if (articles.length < 2) return null;
  const pairs: GenderRule['pairs'] = [];
  let indefinite: GenderRule['indefinite'] = null;
  for (const row of rows) {
    const preferred = (row.primary_values ?? []).find((v) => v && v.trim());
    if (!preferred) continue;
    const others = [...new Set((row.alternative_values ?? []).filter((v) => v && v.trim() && norm(v) !== norm(preferred)))];
    if (others.length) pairs.push({ preferred: preferred.trim(), others: others.map((o) => o.trim()) });
    if (row.form_key === 'noun_singular_indefinite' && !indefinite) {
      indefinite = { noun: preferred.trim(), articles };
    }
  }
  if (!pairs.length && !indefinite) return null;
  return { pairs, indefinite };
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (value: string) => `(?<![\\p{L}])${escape(value)}(?![\\p{L}])`;

// keeps a capital first letter when the replaced word had one
function sameCase(found: string, replacement: string): string {
  const first = found.charAt(0);
  return first && first !== first.toLocaleLowerCase('nb-NO')
    ? replacement.charAt(0).toLocaleUpperCase('nb-NO') + replacement.slice(1)
    : replacement;
}

function applyPair(text: string, preferred: string, others: string[]): string {
  const list = others.join(', ');
  // already "preferred (other)": nothing to do
  if (new RegExp(`${word(preferred)}\\s*\\(${escape(list)}\\)`, 'iu').test(text)) return text;
  const preferredAt = new RegExp(word(preferred), 'iu').exec(text);
  if (preferredAt) {
    const end = preferredAt.index + preferredAt[0].length;
    return `${text.slice(0, end)} (${list})${text.slice(end)}`;
  }
  for (const other of others) {
    const otherAt = new RegExp(word(other), 'iu').exec(text);
    if (otherAt) {
      const end = otherAt.index + otherAt[0].length;
      return `${text.slice(0, otherAt.index)}${sameCase(otherAt[0], preferred)} (${list})${text.slice(end)}`;
    }
  }
  return text;
}

function applyIndefinite(text: string, rule: NonNullable<GenderRule['indefinite']>): string {
  const [preferred, ...rest] = rule.articles;
  const others = rest.map((a) => `${a} ${rule.noun}`).join(', ');
  const any = rule.articles.map(escape).join('|');
  if (new RegExp(`${word(preferred)}\\s+${escape(rule.noun)}\\s*\\(${escape(others)}\\)`, 'iu').test(text)) return text;
  const at = new RegExp(`(?<![\\p{L}])(${any})\\s+${escape(rule.noun)}(?![\\p{L}])`, 'iu').exec(text);
  if (!at) return text;
  const end = at.index + at[0].length;
  return `${text.slice(0, at.index)}${sameCase(at[0], `${preferred} ${rule.noun}`)} (${others})${text.slice(end)}`;
}

// The example with the two-gender convention applied (unchanged when the
// noun has one gender or the example contains none of its singular forms).
export function applyGenderAlternatives(text: string, rule: GenderRule | null): string {
  if (!rule || typeof text !== 'string' || !text.trim()) return text;
  let out = text;
  for (const pair of rule.pairs) out = applyPair(out, pair.preferred, pair.others);
  if (rule.indefinite) out = applyIndefinite(out, rule.indefinite);
  return out;
}

// Short labels for the review ("boken (boka)", "en bok (ei bok)").
export function genderAlternativeLabels(rule: GenderRule | null): string[] {
  if (!rule) return [];
  const labels = rule.pairs.map((p) => `${p.preferred} (${p.others.join(', ')})`);
  if (rule.indefinite) {
    const [preferred, ...rest] = rule.indefinite.articles;
    labels.push(`${preferred} ${rule.indefinite.noun} (${rest.map((a) => `${a} ${rule.indefinite!.noun}`).join(', ')})`);
  }
  return labels;
}
