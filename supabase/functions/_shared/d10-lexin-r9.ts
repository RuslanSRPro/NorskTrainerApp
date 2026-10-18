// D10 17.10.2026 (agreed): addition to stage D3 (d10-lexin-homograph-forms.ts).
// D3 takes for an R9 card every Lexin entry whose inflection (E-mor) fits the
// card's forms. When an Ordbøkene article lists BOTH forms (brente / brant),
// both Lexin entries fit it and the card got the senses of both (brenne 7433:
// "горіти, палити, смажити"). Here:
//   exactly one entry fits                -> that entry (as D3);
//   several fit, some fit ONLY this card  -> only those (not the sibling's);
//   several fit, all fit a sibling too    -> unchanged (as D3) + "for review";
//   none fits                             -> unchanged (as D3: AI translates
//                                            from the card's own article) +
//                                            "for review".
// Pure function, no network, no database. D3 functions are reused unchanged.

import { lexinEntryFitsCard } from './d10-lexin-homograph-forms.ts';

export type R9Entry = { id: number; forms: string[] };
export type R9Selection = {
  status: 'one_fits' | 'exclusive' | 'several_shared' | 'none_fits';
  allowed: number[] | null;      // null = no extra filter (D3 as is)
  review: string | null;         // reason for the "for review" mark
  detail: Array<{ id: number; fits: boolean; fitsSibling: boolean }>;
};

export function selectR9Entries(entries: R9Entry[], cardForms: Set<string>, siblingForms: Set<string>[]): R9Selection {
  const detail = entries.map((e) => ({
    id: e.id,
    fits: lexinEntryFitsCard(e.forms, cardForms),
    fitsSibling: siblingForms.some((s) => lexinEntryFitsCard(e.forms, s)),
  }));
  const fitting = detail.filter((d) => d.fits);
  if (fitting.length === 0) return { status: 'none_fits', allowed: null, review: 'lexin_r9_no_entry_fits', detail };
  if (fitting.length === 1) return { status: 'one_fits', allowed: null, review: null, detail };
  const exclusive = fitting.filter((d) => !d.fitsSibling);
  if (exclusive.length > 0) return { status: 'exclusive', allowed: exclusive.map((d) => d.id), review: null, detail };
  return { status: 'several_shared', allowed: null, review: 'lexin_r9_several_entries_fit', detail };
}
