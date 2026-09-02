create or replace function public.runtime_test_token_v1(p_doc jsonb,p_surface text)
returns jsonb
language sql stable
set search_path to 'public','pg_catalog'
as $$
select coalesce((select t from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2,tokens}','[]'::jsonb)) t where lower(t->>'surface')=lower(p_surface) order by (t->>'token_index')::int limit 1),'{}'::jsonb);
$$;

create or replace function public.runtime_has_interpretation_v1(p_doc jsonb,p_family text,p_value_key text default null,p_value text default null)
returns boolean
language sql stable
set search_path to 'public','pg_catalog'
as $$
select exists(
 select 1 from jsonb_array_elements(coalesce(p_doc#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2,interpretations}','[]'::jsonb)) i
 where i->>'family'=p_family
   and (p_value_key is null or i#>>array['value',p_value_key]=p_value)
);
$$;

create or replace function public.run_forms_tenses_degrees_golden_v1(p_release_code text default 'runtime-structural-v1.23')
returns jsonb
language plpgsql stable
set search_path to 'public','pg_catalog'
as $$
declare results jsonb:='[]'::jsonb; d jsonb; t jsonb; a jsonb; s jsonb; total int; passed int; role jsonb;
begin
 -- FORMS: adjective agreement/inflection
 d:=public.analyze_text_structural_shadow_v23('Jeg ser en stor bil.',p_release_code); t:=public.runtime_test_token_v1(d,'stor');
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.common.positive',t#>>'{morphology,features,Degree}'='Pos',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.common.gender',t#>>'{morphology,features,Gender}'='Com',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.common.number',t#>>'{morphology,features,Number}'='Sing',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.common.indefinite',t#>>'{morphology,features,Definite}'='Ind',t));
 a:=d#>'{document_graph,sentences,0,analysis,language_graph,agreement_controller_bridge_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.agreement.common.unifies',a#>>'{relations,0,features_unify}'='true',a));

 d:=public.analyze_text_structural_shadow_v23('Jeg ser et stort hus.',p_release_code); t:=public.runtime_test_token_v1(d,'stort');
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.neuter.positive',t#>>'{morphology,features,Degree}'='Pos',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.neuter.gender',t#>>'{morphology,features,Gender}'='Neut',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.neuter.number',t#>>'{morphology,features,Number}'='Sing',t));
 a:=d#>'{document_graph,sentences,0,analysis,language_graph,agreement_controller_bridge_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.agreement.neuter.unifies',a#>>'{relations,0,features_unify}'='true',a));

 d:=public.analyze_text_structural_shadow_v23('Jeg ser store biler.',p_release_code); t:=public.runtime_test_token_v1(d,'store');
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.plural.positive',t#>>'{morphology,features,Degree}'='Pos',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.plural.number',t#>>'{morphology,features,Number}'='Plur',t));
 a:=d#>'{document_graph,sentences,0,analysis,language_graph,agreement_controller_bridge_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.agreement.plural.unifies',a#>>'{relations,0,features_unify}'='true',a));

 d:=public.analyze_text_structural_shadow_v23('Jeg ser den store bilen.',p_release_code); t:=public.runtime_test_token_v1(d,'store');
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.definite.positive',t#>>'{morphology,features,Degree}'='Pos',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.adjective.definite.form',t#>>'{morphology,features,Definite}'='Def',t));
 a:=d#>'{document_graph,sentences,0,analysis,language_graph,agreement_controller_bridge_v1}';
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.agreement.definite.unifies',a#>>'{relations,0,features_unify}'='true',a));

 d:=public.analyze_text_structural_shadow_v23('Jeg liker å lese.',p_release_code); t:=public.runtime_test_token_v1(d,'lese');
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.verb.infinitive',t#>>'{morphology,features,VerbForm}'='Inf',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.verb.infinitive.pos',t#>>'{pos,selected_grammar_pos}'='verb',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.verb.infinitive.profile',public.runtime_has_interpretation_v1(d,'nonfinite_infinitive_profile'),d#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2}'));

 -- TENSES: surface morphology + interpretation
 d:=public.analyze_text_structural_shadow_v23('Han reiser.',p_release_code); t:=public.runtime_test_token_v1(d,'reiser');
 results:=results||jsonb_build_array(public.golden_assertion_v1('tenses.present.morph',t#>>'{morphology,features,Tense}'='Pres' and t#>>'{morphology,features,VerbForm}'='Fin',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('tenses.present.interpretation',public.runtime_has_interpretation_v1(d,'morphological_tense','morphological_tense','present')));
 d:=public.analyze_text_structural_shadow_v23('Han reiste.',p_release_code); t:=public.runtime_test_token_v1(d,'reiste');
 results:=results||jsonb_build_array(public.golden_assertion_v1('tenses.preterite.morph',t#>>'{morphology,features,Tense}'='Past' and t#>>'{morphology,features,VerbForm}'='Fin',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('tenses.preterite.interpretation',public.runtime_has_interpretation_v1(d,'morphological_tense','morphological_tense','preterite')));
 d:=public.analyze_text_structural_shadow_v23('Han har gått.',p_release_code); t:=public.runtime_test_token_v1(d,'gått');
 results:=results||jsonb_build_array(public.golden_assertion_v1('tenses.present_perfect.participle',t#>>'{morphology,features,VerbForm}'='Part',t));
 results:=results||jsonb_build_array(public.golden_assertion_v1('tenses.present_perfect.interpretation',public.runtime_has_interpretation_v1(d,'perfect_tense_form','tense_form','present_perfect')));
 d:=public.analyze_text_structural_shadow_v23('Han hadde gått.',p_release_code);
 results:=results||jsonb_build_array(public.golden_assertion_v1('tenses.preterite_perfect.interpretation',public.runtime_has_interpretation_v1(d,'perfect_tense_form','tense_form','preterite_perfect')));
 d:=public.analyze_text_structural_shadow_v23('Han vil gå.',p_release_code);
 results:=results||jsonb_build_array(public.golden_assertion_v1('tenses.modal.future.deferred',exists(select 1 from jsonb_array_elements(coalesce(d#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2,interpretations}','[]'::jsonb)) i where i->>'family'='modal_structure' and i#>>'{value,future_reading}'='deferred')));
 results:=results||jsonb_build_array(public.golden_assertion_v1('tenses.modal.no_future_overclaim',not exists(select 1 from jsonb_array_elements(coalesce(d#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2,interpretations}','[]'::jsonb)) i where i#>>'{value,tense_form}'='future' or i#>>'{value,morphological_tense}'='future')));

 -- DEGREES: synthetic/irregular/analytic/equality boundaries
 d:=public.analyze_text_structural_shadow_v23('Bilen er større.',p_release_code); t:=public.runtime_test_token_v1(d,'større');
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.synthetic.comparative',t#>>'{morphology,features,Degree}'='Cmp',t));
 d:=public.analyze_text_structural_shadow_v23('Bilen er størst.',p_release_code); t:=public.runtime_test_token_v1(d,'størst');
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.synthetic.superlative',t#>>'{morphology,features,Degree}'='Sup',t));
 d:=public.analyze_text_structural_shadow_v23('Bilen er mindre.',p_release_code); t:=public.runtime_test_token_v1(d,'mindre');
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.irregular_liten.comparative',t#>>'{morphology,features,Degree}'='Cmp',t));
 d:=public.analyze_text_structural_shadow_v23('Bilen er minst.',p_release_code); t:=public.runtime_test_token_v1(d,'minst');
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.irregular_liten.superlative',t#>>'{morphology,features,Degree}'='Sup',t));
 d:=public.analyze_text_structural_shadow_v23('Bilen er bedre.',p_release_code); t:=public.runtime_test_token_v1(d,'bedre');
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.irregular_god.comparative_known_ambiguity',t#>>'{morphology,status}'='ambiguous' and t#>>'{pos,selected_grammar_pos}'='adjective',t));
 d:=public.analyze_text_structural_shadow_v23('Bilen er best.',p_release_code); t:=public.runtime_test_token_v1(d,'best');
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.irregular_god.superlative_known_ambiguity',t#>>'{morphology,status}'='ambiguous' and t#>>'{pos,selected_grammar_pos}'='adjective',t));

 d:=public.analyze_text_structural_shadow_v23('Det er mer formelt.',p_release_code);
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.analytic.comparative.marker',public.runtime_test_token_v1(d,'mer')#>>'{morphology,features,Degree}'='Cmp'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.analytic.comparative.base_positive',public.runtime_test_token_v1(d,'formelt')#>>'{morphology,features,Degree}'='Pos'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.analytic.comparative.not_composed',not exists(select 1 from jsonb_array_elements(coalesce(d#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2,interpretations}','[]'::jsonb)) i where i->>'family' like '%degree%' or i->>'family' like '%comparison%')));
 d:=public.analyze_text_structural_shadow_v23('Det er mest formelt.',p_release_code);
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.analytic.superlative.marker',public.runtime_test_token_v1(d,'mest')#>>'{morphology,features,Degree}'='Sup'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.analytic.superlative.not_composed',not exists(select 1 from jsonb_array_elements(coalesce(d#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2,interpretations}','[]'::jsonb)) i where i->>'family' like '%degree%' or i->>'family' like '%comparison%')));
 d:=public.analyze_text_structural_shadow_v23('Bilen er like stor som huset.',p_release_code);
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.equality.not_composed',not exists(select 1 from jsonb_array_elements(coalesce(d#>'{document_graph,sentences,0,analysis,language_graph,interpretation_v2,interpretations}','[]'::jsonb)) i where i->>'family' like '%degree%' or i->>'family' like '%comparison%')));
 results:=results||jsonb_build_array(public.golden_assertion_v1('degree.equality.like_upstream_lexical_gap',public.runtime_test_token_v1(d,'like')#>>'{pos,selected_grammar_pos}'='verb',public.runtime_test_token_v1(d,'like')));

 -- DATA-PLANE form inventories
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.data.stor',(select komparativ='større' and superlativ='størst' and best_superlativ='største' from public.adjective_forms where positiv='stor' limit 1)));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.data.god',(select komparativ='bedre' and superlativ='best' and best_superlativ='beste' from public.adjective_forms where positiv='god' limit 1)));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.data.formell_analytic',(select comparison_mode::text='analytic' and komparativ='mer formell' and superlativ='mest formell' from public.adjective_forms where positiv='formell' limit 1)));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.data.reise',(select presens='reiser' and preteritum='reiste' from public.verb_forms where infinitiv='reise' limit 1)));
 results:=results||jsonb_build_array(public.golden_assertion_v1('forms.data.variant_coverage',(select count(*) from public.lexeme_form_variants where pos='adjective' and form_type in ('positive','comparative','superlative'))=162));
 results:=results||jsonb_build_array(public.golden_assertion_v1('tenses.data.variant_coverage',(select count(*) from public.lexeme_form_variants where pos='verb' and form_type in ('present','preterite','perfect','infinitive'))=571));

 -- READINESS boundaries for requested source rule families
 select jsonb_build_object('count',count(*),'ready',count(*) filter(where (public.assess_candidate_activation_readiness_v1(e.candidate_id)->>'state')='activation_ready'),'needs_manifest',count(*) filter(where (public.assess_candidate_activation_readiness_v1(e.candidate_id)->>'state')='needs_manifest')) into role
 from public.grammar_knowledge_candidate_execution_v e where e.execution_contract#>>'{execution,role}'='adjective_degree_rule';
 results:=results||jsonb_build_array(public.golden_assertion_v1('readiness.degree_rules.7',role->>'count'='7',role));
 results:=results||jsonb_build_array(public.golden_assertion_v1('readiness.degree_rules.none_activation_ready',role->>'ready'='0',role));
 results:=results||jsonb_build_array(public.golden_assertion_v1('readiness.degree_rules.need_manifest',role->>'needs_manifest'='7',role));
 select jsonb_build_object('count',count(*),'ready',count(*) filter(where (public.assess_candidate_activation_readiness_v1(e.candidate_id)->>'state')='activation_ready'),'needs_manifest',count(*) filter(where (public.assess_candidate_activation_readiness_v1(e.candidate_id)->>'state')='needs_manifest')) into role
 from public.grammar_knowledge_candidate_execution_v e where e.execution_contract#>>'{execution,role}'='tense_form_selection';
 results:=results||jsonb_build_array(public.golden_assertion_v1('readiness.tense_form_selection.13',role->>'count'='13',role));
 results:=results||jsonb_build_array(public.golden_assertion_v1('readiness.tense_form_selection.none_activation_ready',role->>'ready'='0',role));
 results:=results||jsonb_build_array(public.golden_assertion_v1('readiness.tense_form_selection.need_manifest',role->>'needs_manifest'='13',role));

 select count(*),count(*) filter(where (x->>'passed')::boolean) into total,passed from jsonb_array_elements(results) x;
 return jsonb_build_object('version','forms-tenses-degrees-golden-v1','batch_id',gen_random_uuid(),'total',total,'passed',passed,'failed',total-passed,'failures',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(results) x where not (x->>'passed')::boolean));
end;
$$;
