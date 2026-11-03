// services/definitionHint.ts
// D10 27.10.2026 (agreed): definitions for the help popup (VerificationBadge).
// Read only, when the popup is opened, by the card's lexeme id:
//   - entity_translations, translation_type 'definition' (Lexin uk, other en);
//   - entity_definitions (Lexin en / nb).
// Own rows of the card only (expression_id is null). Cached per lexeme for the
// popup opening. Errors -> no definition block (the popup works as before).

import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { pickDefinitionHint, type DefinitionHint, type DefinitionRow } from '@/services/definitionText';


async function loadRows(lexemeId: string): Promise<DefinitionRow[]> {
  const [translations, definitions] = await Promise.all([
    supabase
      .from('entity_translations')
      .select('language_code, translation, entry_order, sense_rank, translation_rank')
      .eq('lexeme_id', lexemeId)
      .is('expression_id', null)
      .eq('translation_type', 'definition')
      .order('entry_order', { ascending: true, nullsFirst: false })
      .order('sense_rank', { ascending: true, nullsFirst: false })
      .order('translation_rank', { ascending: true }),
    supabase
      .from('entity_definitions')
      .select('language_code, definition, source_entry_id')
      .eq('lexeme_id', lexemeId)
      .is('expression_id', null)
      .order('source_entry_id', { ascending: true, nullsFirst: false }),
  ]);
  if (translations.error) console.warn('definition hint: translations', translations.error.message);
  if (definitions.error) console.warn('definition hint: definitions', definitions.error.message);
  // Lexin entity_definitions first (en / nb), then entity_translations (uk, other en)
  return [
    ...((definitions.data ?? []) as any[]).map((r) => ({ lang: String(r.language_code ?? ''), text: r.definition ?? null })),
    ...((translations.data ?? []) as any[]).map((r) => ({ lang: String(r.language_code ?? ''), text: r.translation ?? null })),
  ];
}

export function useDefinitionHint(lexemeId: string | null | undefined, appLang: string, enabled: boolean): DefinitionHint | null {
  const [hint, setHint] = useState<DefinitionHint | null>(null);
  useEffect(() => {
    setHint(null);
    // a card of the database only (preview cards have ids like "preview-0")
    if (!enabled || !lexemeId || !/^[0-9a-f-]{36}$/i.test(lexemeId)) return;
    let alive = true;
    void loadRows(lexemeId).then((rows) => { if (alive) setHint(pickDefinitionHint(rows, appLang)); })
      .catch(()=>{if(alive)setHint(null);});
    return () => { alive = false; };
  }, [lexemeId, appLang, enabled]);
  return hint;
}
