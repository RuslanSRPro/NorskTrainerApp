import type {
  DictionaryCode,
  OrdbokeneArticle,
} from "../../_shared/authoritative-morphology-v2/mod.ts";

type Inflection = [string, string[]];

function article(args: {
  dictionaryCode: DictionaryCode;
  articleId: string;
  lemma: string;
  paradigms: Array<{
    id: number;
    tags: string[];
    group: string;
    forms: Inflection[];
  }>;
}): OrdbokeneArticle {
  return {
    dictionaryCode: args.dictionaryCode,
    articleId: args.articleId,
    sourceUrl:
      `https://ord.uib.no/${args.dictionaryCode}/article/${args.articleId}.json`,
    payload: {
      lemmas: [{
        lemma: args.lemma,
        final_lexeme: args.lemma,
        paradigm_info: args.paradigms.map((paradigm) => ({
          tags: paradigm.tags,
          paradigm_id: paradigm.id,
          inflection_group: paradigm.group,
          standardisation: "STANDARD",
          inflection: paradigm.forms.map(([word_form, tags]) => ({
            word_form,
            tags,
          })),
        })),
      }],
    },
  };
}

export const FA_BM_VERB = article({
  dictionaryCode: "bm",
  articleId: "18820",
  lemma: "få",
  paradigms: [{
    id: 195,
    tags: ["VERB"],
    group: "VERB_regular",
    forms: [
      ["få", ["Inf"]],
      ["får", ["Pres"]],
      ["fikk", ["Past"]],
      ["fått", ["<PerfPart>"]],
    ],
  }],
});

export const FA_BM_DETERMINER = article({
  dictionaryCode: "bm",
  articleId: "18819",
  lemma: "få",
  paradigms: [{
    id: 427,
    tags: ["DET", "Quant", "Def", "Sing"],
    group: "DET_simple",
    forms: [["få", []]],
  }],
});

export const FA_NN_VERB = article({
  dictionaryCode: "nn",
  articleId: "23680",
  lemma: "få",
  paradigms: [{
    id: 1508,
    tags: ["VERB"],
    group: "VERB_regular",
    forms: [
      ["få", ["Inf"]],
      ["får", ["Pres"]],
      ["fekk", ["Past"]],
      ["fått", ["<PerfPart>"]],
    ],
  }],
});

export const FA_NN_ADJECTIVE = article({
  dictionaryCode: "nn",
  articleId: "23679",
  lemma: "få",
  paradigms: [
    {
      id: 2130,
      tags: ["ADJ"],
      group: "ADJ_regular",
      forms: [
        ["få", ["Pos", "Masc/Fem", "Ind", "Sing"]],
        ["fått", ["Pos", "Neuter", "Ind", "Sing"]],
        ["færre", ["Cmp"]],
        ["færrast", ["Sup", "Ind"]],
      ],
    },
    {
      id: 2132,
      tags: ["ADJ"],
      group: "ADJ_regular",
      forms: [
        ["få", ["Pos", "Masc/Fem", "Ind", "Sing"]],
        ["fått", ["Pos", "Neuter", "Ind", "Sing"]],
        ["færre", ["Cmp"]],
        ["færrast", ["Sup", "Ind"]],
      ],
    },
  ],
});

export const GAPE_BM = article({
  dictionaryCode: "bm",
  articleId: "19072",
  lemma: "gape",
  paradigms: [
    {
      id: 1,
      tags: ["VERB"],
      group: "VERB_regular",
      forms: [
        ["gape", ["Inf"]],
        ["gaper", ["Pres"]],
        ["gapa", ["Past"]],
        ["gapa", ["<PerfPart>"]],
      ],
    },
    {
      id: 16,
      tags: ["VERB"],
      group: "VERB_regular",
      forms: [
        ["gape", ["Inf"]],
        ["gaper", ["Pres"]],
        ["gapte", ["Past"]],
        ["gapt", ["<PerfPart>"]],
      ],
    },
  ],
});

export const HOPE_BM = article({
  dictionaryCode: "bm",
  articleId: "25496",
  lemma: "håpe",
  paradigms: [
    {
      id: 1,
      tags: ["VERB"],
      group: "VERB_regular",
      forms: [["håpe", ["Inf"]], ["håpa", ["Past"]], ["håpa", ["<PerfPart>"]]],
    },
    {
      id: 6,
      tags: ["VERB"],
      group: "VERB_regular",
      forms: [["håpe", ["Inf"]], ["håpet", ["Past"]], ["håpet", [
        "<PerfPart>",
      ]]],
    },
    {
      id: 7,
      tags: ["VERB"],
      group: "VERB_regular",
      forms: [["håpe", ["Inf"]], ["håpet", ["Past"]], ["håpet", [
        "<PerfPart>",
      ]]],
    },
    {
      id: 16,
      tags: ["VERB"],
      group: "VERB_regular",
      forms: [["håpe", ["Inf"]], ["håpte", ["Past"]], ["håpt", ["<PerfPart>"]]],
    },
  ],
});

export const FA_CORPUS = [
  FA_BM_VERB,
  FA_BM_DETERMINER,
  FA_NN_VERB,
  FA_NN_ADJECTIVE,
];
