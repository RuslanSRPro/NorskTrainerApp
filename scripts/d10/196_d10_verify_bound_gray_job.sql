-- 196: run the new verification once for the job "var, chille, motivert, spille"
-- (51a66573), which ended before this package. WRITES: only the verification
-- fields of cards without an accepted status that have a bound Ordbøkene
-- article of their own part of speech (spille verb, vare noun). Returns the
-- number of cards; then the check below shows them.
select public.d10_verify_bound_gray_cards_v1(j.id) as cards_verified
from public.lexeme_processing_jobs j where j.id::text like '51a66573%';
