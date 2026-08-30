import {
  type EntityEvidenceSnapshot,
  type FormEvidence,
  SNAPSHOT_VERSION,
  type TranslationEvidence,
} from "../../_shared/completion-contract/v1/contract.ts";

const UUIDS = {
  job: "10000000-0000-4000-8000-000000000001",
  lexeme: "20000000-0000-4000-8000-000000000001",
  expression: "30000000-0000-4000-8000-000000000001",
  item: "40000000-0000-4000-8000-000000000001",
};

const CAPTURED_AT = "2026-08-29T12:00:00.000Z";
const TOKEN = "sha256:golden-corpus-v1";

function form(
  formType: string,
  options: Partial<FormEvidence> = {},
): FormEvidence {
  return {
    id: `form:${formType}`,
    form_type: formType,
    normalized_form: `${formType}-value`,
    is_accepted: true,
    needs_review: false,
    verification_status: "source_verified",
    is_irregular: false,
    source_refs: [`lexin:form:${formType}`],
    ...options,
  };
}

function translation(
  locale: "uk" | "en",
  options: Partial<TranslationEvidence> = {},
): TranslationEvidence {
  return {
    id: `translation:${locale}`,
    locale,
    value: locale === "uk" ? "значення" : "meaning",
    provider: "lexin",
    canonical: true,
    needs_review: false,
    source_refs: [`lexin:translation:${locale}`],
    lexeme_id: UUIDS.lexeme,
    expression_id: null,
    ...options,
  };
}

export function baseSnapshot(
  overrides: Partial<EntityEvidenceSnapshot> = {},
): EntityEvidenceSnapshot {
  return {
    snapshot_version: SNAPSHOT_VERSION,
    snapshot_token: TOKEN,
    captured_at: CAPTURED_AT,
    entity_key: `lexeme:${UUIDS.lexeme}`,
    entity_kind: "lexeme",
    entity_id: UUIDS.lexeme,
    lemma: "bok",
    pos: "noun",
    item_ids: [UUIDS.item],
    execution_state: "completed",
    identity: {
      accepted: true,
      verification_status: "source_verified",
      source_refs: ["lexin:identity:bok"],
      expression_whole_unit_source_refs: [],
      is_learning_lexeme: true,
      paradigm_type: null,
      paradigm_source_refs: [],
      allowed_missing_slots: [],
    },
    forms: [
      form("singular_indefinite"),
      form("singular_definite"),
      form("plural_indefinite"),
      form("plural_definite"),
    ],
    translations: [translation("uk"), translation("en")],
    relations: [],
    ...overrides,
  };
}

const verbForms = [
  "infinitive",
  "present",
  "past",
  "present_perfect",
  "past_participle",
]
  .map((slot) => form(slot, { is_irregular: true }));

export const GOLDEN_CORPUS_V1 = [
  {
    name: "source-verified regular noun is learner-ready",
    snapshot: baseSnapshot(),
    expected: {
      quality: "ready",
      paradigm: "regular",
      uk: "ready",
      en: "ready",
    },
  },
  {
    name:
      "uregelrett verb is valid when all required forms are source-verified",
    snapshot: baseSnapshot({ lemma: "gå", pos: "verb", forms: verbForms }),
    expected: {
      quality: "ready",
      paradigm: "irregular",
      uk: "ready",
      en: "ready",
    },
  },
  {
    name: "AI-only translations remain provisional and reusable",
    snapshot: baseSnapshot({
      translations: [
        translation("uk", {
          provider: "ai_fallback",
          canonical: false,
          source_refs: ["ai:run:101"],
        }),
        translation("en", {
          provider: "ai_fallback",
          canonical: false,
          source_refs: ["ai:run:101"],
        }),
      ],
    }),
    expected: {
      quality: "provisional",
      paradigm: "regular",
      uk: "provisional",
      en: "provisional",
    },
  },
  {
    name: "needs_review translation is not learner-ready",
    snapshot: baseSnapshot({
      translations: [
        translation("uk", { needs_review: true }),
        translation("en"),
      ],
    }),
    expected: {
      quality: "needs_review",
      paradigm: "regular",
      uk: "blocked",
      en: "ready",
    },
  },
  {
    name: "missing required forms fail closed with unknown paradigm",
    snapshot: baseSnapshot({ forms: [form("singular_indefinite")] }),
    expected: {
      quality: "blocked",
      paradigm: "unknown",
      uk: "ready",
      en: "ready",
    },
  },
  {
    name: "source-backed uncountable exception may omit plural slots",
    snapshot: baseSnapshot({
      lemma: "melk",
      identity: {
        ...baseSnapshot().identity,
        paradigm_type: "uncountable",
        paradigm_source_refs: ["ordbok:paradigm:melk"],
        allowed_missing_slots: ["plural_indefinite", "plural_definite"],
      },
      forms: [form("singular_indefinite"), form("singular_definite")],
    }),
    expected: {
      quality: "ready",
      paradigm: "uncountable",
      uk: "ready",
      en: "ready",
    },
  },
  {
    name:
      "whole-unit expression with expression-specific translations is ready",
    snapshot: baseSnapshot({
      entity_key: `expression:${UUIDS.expression}`,
      entity_kind: "expression",
      entity_id: UUIDS.expression,
      lemma: "å gå på ski",
      pos: "expression",
      identity: {
        ...baseSnapshot().identity,
        source_refs: ["lexin:expression:ski"],
        expression_whole_unit_source_refs: ["lexin:expression:ski"],
        paradigm_type: null,
      },
      forms: [],
      translations: [
        translation("uk", {
          lexeme_id: null,
          expression_id: UUIDS.expression,
          canonical: false,
        }),
        translation("en", {
          lexeme_id: null,
          expression_id: UUIDS.expression,
          canonical: false,
        }),
      ],
    }),
    expected: { quality: "ready", paradigm: null, uk: "ready", en: "ready" },
  },
  {
    name: "linked lexeme translations do not satisfy an expression",
    snapshot: baseSnapshot({
      entity_key: `expression:${UUIDS.expression}`,
      entity_kind: "expression",
      entity_id: UUIDS.expression,
      lemma: "ta av",
      pos: "expression",
      identity: {
        ...baseSnapshot().identity,
        expression_whole_unit_source_refs: ["lexin:expression:ta-av"],
      },
      forms: [],
    }),
    expected: {
      quality: "blocked",
      paradigm: null,
      uk: "blocked",
      en: "blocked",
    },
  },
  {
    name: "verified function word excluded from learning needs analysis only",
    snapshot: baseSnapshot({
      lemma: "og",
      pos: "conjunction",
      identity: { ...baseSnapshot().identity, is_learning_lexeme: false },
      forms: [],
      translations: [],
    }),
    expected: {
      quality: "ready",
      paradigm: null,
      uk: "not_applicable",
      en: "not_applicable",
    },
  },
  {
    name: "unknown POS blocks analysis and training",
    snapshot: baseSnapshot({ pos: "unknown", forms: [] }),
    expected: { quality: "blocked", paradigm: null, uk: "ready", en: "ready" },
  },
] as const;
