-- D10 / pending only: evidence-backed article bindings approved by the 97-item read-only review.
-- Category A only. Do not promote or apply until the matching pgTAP gate passes.

do $block$
declare
  v_inserted_count integer;
begin
  with decisions (
    rollout_order,
    lexeme_id,
    normalized_lemma,
    pos,
    article_id,
    rejected_article_ids,
    semantic_evidence
  ) as (
    values
    (1, '01cb83da-68fe-4320-a591-01b147b64b86'::uuid, 'skap', 'noun', 52502::bigint, array[52501]::bigint[], 'cupboard-cabinet'),
    (2, '07b239dd-132f-49f6-9c28-6ebb030f20f0'::uuid, 'gjelde', 'verb', 19726::bigint, array[19727]::bigint[], 'apply-be-valid'),
    (3, '0c5f670f-a9a4-4b8d-8db5-de33d534f1d0'::uuid, 'jus', 'noun', 28054::bigint, array[28055]::bigint[], 'juice'),
    (4, '1021b5bd-c763-42d5-b2ee-c37db1a54344'::uuid, 'bære', 'verb', 8439::bigint, array[8440]::bigint[], 'carry'),
    (5, '16b32aba-520f-4f00-bcad-a75da3a8f7e2'::uuid, 'bråk', 'noun', 7932::bigint, array[97067]::bigint[], 'noise-row'),
    (6, '18237ded-6911-4cd3-a2d5-f3bbd0178679'::uuid, 'elv', 'noun', 12477::bigint, array[12478]::bigint[], 'river'),
    (7, '1b897bfa-a24b-4034-a727-0bd74712de14'::uuid, 'trene', 'verb', 62116::bigint, array[62115]::bigint[], 'train-practise'),
    (8, '1f744c0a-33b7-4b24-a0a2-04176a66d5e4'::uuid, 'tape', 'verb', 59896::bigint, array[60079]::bigint[], 'lose'),
    (9, '215f961f-5c2c-4ee9-b530-c523f3ec4482'::uuid, 'dyne', 'noun', 11334::bigint, array[11335]::bigint[], 'duvet'),
    (10, '2cfb7c0e-046c-450a-9358-5d80483152b1'::uuid, 'legg', 'noun', 34285::bigint, array[100240, 34287]::bigint[], 'lower-leg-calf'),
    (11, '30a3cb30-f805-47f3-88c4-57241ad72b8b'::uuid, 'lån', 'noun', 34686::bigint, array[34685]::bigint[], 'loan'),
    (12, '317e7b95-3985-4922-8b8c-afe4b7061ef3'::uuid, 'ost', 'noun', 43443::bigint, array[43444]::bigint[], 'cheese'),
    (13, '35997a35-75ee-4bec-9186-528c704b85ae'::uuid, 'ting', 'noun', 61047::bigint, array[61048]::bigint[], 'thing-object-matter'),
    (14, '370728af-947a-4c0e-9464-9940469d6ec2'::uuid, 'pass', 'noun', 44340::bigint, array[44338, 44339, 44341, 44342]::bigint[], 'passport'),
    (15, '3a26d01e-3fec-4093-9469-5792fe1743cb'::uuid, 'verk', 'noun', 67841::bigint, array[67840]::bigint[], 'work-works'),
    (16, '3bb3a0f9-5098-4e1c-aeac-a6786e967eb1'::uuid, 'tre', 'verb', 61961::bigint, array[62648]::bigint[], 'step-move-aside'),
    (17, '4188741a-0857-46cd-a8d4-c53227856ed8'::uuid, 'egg', 'noun', 11756::bigint, array[11755]::bigint[], 'egg-food'),
    (18, '434ee6a1-be00-4042-95e4-f37fa4b9b47f'::uuid, 'plikt', 'noun', 45258::bigint, array[45259]::bigint[], 'duty'),
    (19, '443274a6-0348-4a57-a8f5-18f765036c5f'::uuid, 'peis', 'noun', 44517::bigint, array[43853, 44518]::bigint[], 'fireplace'),
    (20, '4b4f871a-2f1e-4183-9a23-2e5eb8a2ae20'::uuid, 'far', 'noun', 13845::bigint, array[13846]::bigint[], 'father'),
    (21, '4dac94db-14fc-45e3-9894-8e556cdb722c'::uuid, 'ski', 'noun', 52693::bigint, array[52697]::bigint[], 'skis'),
    (22, '4ecc6662-58d3-4684-be5d-154a6e9b48cb'::uuid, 'knekke', 'verb', 30482::bigint, array[30483]::bigint[], 'break-intransitively'),
    (23, '51882e59-a996-4262-88b0-82986ffd9d6f'::uuid, 'brenne', 'verb', 7434::bigint, array[7433]::bigint[], 'burn-something'),
    (24, '53d2516f-7db7-4882-bcac-9026925b11b9'::uuid, 'rom', 'noun', 48792::bigint, array[48791, 98629]::bigint[], 'room-space'),
    (25, '58649153-c4c6-4dde-93f1-8b658308f9c9'::uuid, 'skjegg', 'noun', 52972::bigint, array[52971]::bigint[], 'beard'),
    (26, '5a6b2c76-7f84-40d7-9f12-44836dd762d9'::uuid, 'stille', 'verb', 57187::bigint, array[57186]::bigint[], 'place-calm'),
    (27, '5f7cad73-e7a2-4fa9-b597-9e66a43f5988'::uuid, 'gir', 'noun', 19661::bigint, array[19659, 19660]::bigint[], 'gear'),
    (28, '61c4c675-6ca4-4667-8426-c5e5c3dc05d6'::uuid, 'syn', 'noun', 59034::bigint, array[136674]::bigint[], 'sight-vision'),
    (29, '65fbe4db-57d9-4fa3-bae2-ea4a6ab35c11'::uuid, 'filet', 'noun', 14601::bigint, array[14602]::bigint[], 'meat-fish-fillet'),
    (30, '699faf3c-82c9-48d6-bb27-aca9ffb81663'::uuid, 'klare', 'verb', 29921::bigint, array[29920]::bigint[], 'manage-succeed'),
    (31, '69d25e48-e66d-420b-99ce-bc1e6d7d4a44'::uuid, 'by', 'verb', 8263::bigint, array[8264]::bigint[], 'invite-offer'),
    (32, '6c2dc736-17e8-4963-982e-8e78707f5803'::uuid, 'rev', 'noun', 48433::bigint, array[48434, 48435]::bigint[], 'fox'),
    (33, '6c42849d-1610-4630-b167-d7501624e347'::uuid, 'mygg', 'noun', 39681::bigint, array[136473]::bigint[], 'mosquito'),
    (34, '737fe29d-e2f7-47ec-a068-e9d4abbbbe0e'::uuid, 'stand', 'noun', 56653::bigint, array[56654, 56655]::bigint[], 'condition-state'),
    (35, '7a08e8c8-8acd-439c-9f8f-c1c318cf5341'::uuid, 'brett', 'noun', 7479::bigint, array[7478]::bigint[], 'tray-board'),
    (36, '7f9e4139-8d28-4f40-955f-45bf7a17be3e'::uuid, 'fryse', 'verb', 18274::bigint, array[18275]::bigint[], 'freeze-be-cold'),
    (37, '8064c576-5677-4919-a1e8-8093f93b5f82'::uuid, 'yrke', 'noun', 69622::bigint, array[69621]::bigint[], 'occupation'),
    (38, '8e513bd3-7205-460e-a4d8-5ab6a7ba3fcb'::uuid, 'bit', 'noun', 6134::bigint, array[6133]::bigint[], 'piece-part'),
    (39, '99d58ac0-794b-4aac-9e30-721795c2d6fd'::uuid, 'gjerde', 'noun', 19924::bigint, array[116244]::bigint[], 'fence'),
    (40, '9b6a0bd8-0332-4fc9-b081-7ec201225627'::uuid, 'bo', 'noun', 6739::bigint, array[6738]::bigint[], 'estate-property'),
    (41, '9cee5298-53c2-4fa6-bb8f-310560335c12'::uuid, 'røre', 'noun', 49384::bigint, array[49385]::bigint[], 'mixture-batter'),
    (42, 'a208102c-46dd-4baf-8628-6ebbeecf4ac1'::uuid, 'gris', 'noun', 20985::bigint, array[115943, 20984]::bigint[], 'pig'),
    (43, 'ad347caf-7e81-4230-825f-8bd691a7b1d1'::uuid, 'fylle', 'verb', 18515::bigint, array[18516]::bigint[], 'fill'),
    (44, 'aeabf851-70b6-42c1-825f-dca47407cc56'::uuid, 'lure', 'verb', 36096::bigint, array[36097]::bigint[], 'deceive-wonder-sneak'),
    (45, 'b2477c5e-d69d-46d0-9bcc-50f6af780201'::uuid, 'ringe', 'verb', 48612::bigint, array[48613]::bigint[], 'ring-call'),
    (46, 'b59a71b6-ca24-42bf-bd55-b9f0aa539c14'::uuid, 'skip', 'noun', 52833::bigint, array[97604]::bigint[], 'ship'),
    (47, 'b7ad6f8e-8689-4514-b8ca-2493ef975079'::uuid, 'skrelle', 'verb', 53556::bigint, array[53555]::bigint[], 'peel'),
    (48, 'b82ca900-4aef-486e-a565-031b7a37146b'::uuid, 'plan', 'noun', 45117::bigint, array[45118]::bigint[], 'plan'),
    (49, 'b871baba-561e-4b16-8c96-5d25d12f80c0'::uuid, 'gate', 'noun', 19244::bigint, array[115397]::bigint[], 'street'),
    (50, 'bd88f762-f05e-4cff-aa61-0b130da760d6'::uuid, 'late', 'verb', 33970::bigint, array[33971]::bigint[], 'seem-pretend'),
    (51, 'c209e919-c46b-4ff3-bb13-ffabeec835c1'::uuid, 'love', 'verb', 35841::bigint, array[35840]::bigint[], 'promise'),
    (52, 'c8c83624-f4c2-4e7f-a654-cdd249af452e'::uuid, 'senter', 'noun', 50965::bigint, array[50964]::bigint[], 'centre'),
    (53, 'c996bf9d-0b0c-4288-9036-e5df8f31564e'::uuid, 'øre', 'noun', 42756::bigint, array[42754, 42755]::bigint[], 'ear'),
    (54, 'd02f18e3-b21b-440c-ac9a-ab9ee04a00b9'::uuid, 'kurv', 'noun', 32889::bigint, array[32890]::bigint[], 'basket'),
    (55, 'd0cb2597-1493-42d7-93c5-658b70a70b1f'::uuid, 'lønn', 'noun', 34436::bigint, array[34437, 34438]::bigint[], 'salary-wage'),
    (56, 'd1998183-257b-4e21-ab7f-8625e3a13872'::uuid, 'kraft', 'noun', 31865::bigint, array[113560]::bigint[], 'force-strength-legal-force'),
    (57, 'd2031328-f8a2-4457-92aa-6e90e403f1e0'::uuid, 'larve', 'noun', 33912::bigint, array[33913]::bigint[], 'larva'),
    (58, 'd4cda977-9af2-43ea-9cbc-06778c024ef3'::uuid, 'rake', 'noun', 47322::bigint, array[47321]::bigint[], 'rake-tool'),
    (59, 'd9babf3f-589a-4536-914b-fbfd310feba3'::uuid, 'brems', 'noun', 7420::bigint, array[117579, 7418]::bigint[], 'brake'),
    (60, 'df3a82a0-624b-49a3-813e-ed273ab2bff4'::uuid, 'hestehov', 'noun', 23444::bigint, array[23443]::bigint[], 'coltsfoot-plant'),
    (61, 'dfed58ee-6e9b-4954-a214-f7d12c3e3a8a'::uuid, 'røyke', 'verb', 49426::bigint, array[136672]::bigint[], 'smoke-tobacco'),
    (62, 'e1bf337f-d6ef-46a7-b173-ab66c26d67b5'::uuid, 'rot', 'noun', 48919::bigint, array[48920]::bigint[], 'root'),
    (63, 'e30de985-ad15-4eec-b477-0b38fe2d043c'::uuid, 'tyde', 'verb', 63180::bigint, array[63179]::bigint[], 'interpret-decipher'),
    (64, 'e69e4dc0-22ed-4a85-99f7-7ed3b36793ee'::uuid, 'brekke', 'verb', 7407::bigint, array[7408]::bigint[], 'break-fracture'),
    (65, 'e6d91103-ddc9-4e48-b1dd-4cef3ffe8404'::uuid, 'ris', 'noun', 48650::bigint, array[48651, 48652]::bigint[], 'rice'),
    (66, 'e70d56a2-9bdc-4047-9eff-f88b272fec2b'::uuid, 'sekund', 'noun', 50558::bigint, array[50557]::bigint[], 'second-time-unit'),
    (67, 'ec9da2b9-22d4-4292-81e3-05b26f4aa852'::uuid, 'bok', 'noun', 6790::bigint, array[106786]::bigint[], 'book'),
    (68, 'ecfc4724-fe62-401a-ac7b-c3809a68c2ba'::uuid, 'gård', 'noun', 19096::bigint, array[128322]::bigint[], 'farm-yard'),
    (69, 'f16477a7-b742-49a3-a54a-0a9198750352'::uuid, 'hete', 'verb', 23468::bigint, array[23467]::bigint[], 'be-called'),
    (70, 'f19ee351-b7eb-406a-bf0a-88dbc50b52ef'::uuid, 'vare', 'noun', 66635::bigint, array[66636]::bigint[], 'goods-product'),
    (71, 'f5be5a51-2bc9-4f12-aaab-92c7ceabe926'::uuid, 'friste', 'verb', 18106::bigint, array[17942, 18107]::bigint[], 'tempt'),
    (72, 'f67c3245-fc57-49c6-8817-59b8185ffda8'::uuid, 'ark', 'noun', 2649::bigint, array[2647, 2648]::bigint[], 'sheet-of-paper'),
    (73, 'ff4c7a13-2098-45b0-970e-83ac51467fd5'::uuid, 'la', 'verb', 33442::bigint, array[33479]::bigint[], 'let-allow-leave')
  )
  insert into private.authoritative_morphology_article_bindings_v2 (
    lexeme_id,
    dictionary_code,
    article_id,
    normalized_lemma,
    pos,
    evidence_ids,
    provider_version,
    evidence
  )
  select
    lexeme.id,
    'bm',
    decision.article_id,
    decision.normalized_lemma,
    decision.pos,
    array[
      'ordbokene:bm:' || decision.article_id::text,
      'manual:lexeme-semantic-binding:' || decision.semantic_evidence
    ]::text[],
    'authoritative-article-binding/v1',
    jsonb_build_object(
      'decision', 'learner_evidence_selects_single_bm_article',
      'acceptedArticleId', decision.article_id,
      'rejectedHomographArticleIds', to_jsonb(decision.rejected_article_ids),
      'reviewCategory', 'A',
      'learnerMeaning', jsonb_build_object(
        'translationUa', lexeme.translation_ua,
        'translationEn', lexeme.translation_en,
        'notes', lexeme.notes,
        'example', lexeme.example,
        'verificationVersion', lexeme.verification_version
      ),
      'reason', decision.semantic_evidence
    )
  from decisions as decision
  join public.lexemes as lexeme
    on lexeme.id = decision.lexeme_id
   and lexeme.lemma = decision.normalized_lemma
   and lexeme.pos = decision.pos;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> 73 then
    raise exception using
      errcode = '55000',
      message = 'D10_REVIEWED_ARTICLE_BINDINGS_NOT_CREATED',
      detail = format('expected 73 rows, inserted %s', v_inserted_count);
  end if;
end;
$block$;
