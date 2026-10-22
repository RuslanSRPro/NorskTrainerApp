-- 154c: undo 154b (bring bære II back). Only if asked.
update public.lexemes l
set dictionary_status = h.previous->>'dictionary_status',
    dictionary_exclusion_reason = h.previous->>'dictionary_exclusion_reason',
    is_learning_lexeme = (h.previous->>'is_learning_lexeme')::boolean,
    updated_at = now()
from private.d10_hidden_cards_v1 h
where h.lexeme_id = l.id and h.reason = 'd10_r9_false_card_no_own_forms_8440';
delete from private.d10_hidden_cards_v1 where reason = 'd10_r9_false_card_no_own_forms_8440';
