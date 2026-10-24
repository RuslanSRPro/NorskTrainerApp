-- 154e: undo 154d. Only if asked.
delete from private.lexeme360_expression_roots_v1 e
using private.d10_hidden_cards_v1 h
where h.reason = 'd10_r9_false_card_no_own_forms_8440'
  and e.root_lexeme_id = (h.previous->>'main_lexeme_id')::uuid
  and e.expression_id in (select (x #>> '{}')::uuid from jsonb_array_elements(h.previous->'added_root_expression_ids') x)
  and e.evidence ? 'd10_copied_from_hidden_card';
update public.lexemes l
set dictionary_status = h.previous->>'dictionary_status',
    dictionary_exclusion_reason = h.previous->>'dictionary_exclusion_reason',
    is_learning_lexeme = (h.previous->>'is_learning_lexeme')::boolean,
    updated_at = now()
from private.d10_hidden_cards_v1 h
where h.lexeme_id = l.id and h.reason = 'd10_r9_false_card_no_own_forms_8440';
delete from private.d10_hidden_cards_v1 where reason = 'd10_r9_false_card_no_own_forms_8440';
