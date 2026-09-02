do $patch$
declare ddl text;
begin
 select pg_get_functiondef('public.run_subordinate_clause_foundation_golden_v1(text)'::regprocedure) into ddl;
 ddl:=replace(
   ddl,
   'results:=results||jsonb_build_array(public.golden_assertion_v1(''immutability.sentence_model'',d#>''{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}''=p#>''{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}''));',
   'results:=results||jsonb_build_array(public.golden_assertion_v1(''immutability.sentence_model'',(d#>''{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}'')-''release_code''=(p#>''{document_graph,sentences,0,analysis,language_graph,sentence_model_v2}'')-''release_code''));'
 );
 execute ddl;
end;
$patch$;
