-- D10 plan F3 (rule R11), data from 74_d10_function_words_inventory.sql.
-- du and dere (pronouns) are function words by the admission rules but their
-- lexemes were never marked, so they could enter learning. They are marked
-- like the other pronoun function words (excluded, not a learning lexeme).
-- Nothing else changes: the noun lexeme "på" (suspicious data) and the noun
-- "ved" (real homonym "firewood") are NOT touched here.
-- Why "ved" waits (F1): the only "ved" lexeme in the base is the noun. In a
-- text the analyzer therefore resolves the very common preposition "ved" to
-- that noun; today the function-word rule rejects it. Returning the noun to
-- learning now would admit "firewood" for every preposition. It needs the
-- function-word lexemes of F2 (a preposition "ved") first.
-- Learning progress rows are not touched.

UPDATE public.lexemes l
   SET dictionary_status = 'excluded',
       dictionary_exclusion_reason = 'function_word_pronoun',
       is_learning_lexeme = false,
       updated_at = now()
 WHERE l.id IN ('2ee88925-e282-4679-80a1-a4bf966d0471',   -- du
                '60348e0f-cdef-4778-9eb0-84c711eee26f')   -- dere
   AND l.pos = 'pronoun'
   AND l.lemma IN ('du', 'dere')
   AND l.dictionary_status = 'active';
