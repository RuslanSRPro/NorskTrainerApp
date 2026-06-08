// components/VerificationBadge.tsx
// Norsk Trainer App — verification badge with evidence popup
// Shows verification tier as colored dot/badge
// On press: shows detailed evidence popup

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";

// ── Types ────────────────────────────────────────────────────────────────────
export type VerificationTier =
  | "dictionary_entry"
  | "dictionary_match"
  | "normative_reference"
  | "usage_evidence"
  | "component_match"
  | "ai_candidate"
  | null;

export type EvidenceQuality =
  | "registered_entry"
  | "learner_dictionary"
  | "normative_reference"
  | "exact_expression_match"
  | "search_page_match"
  | "usage_example_match"
  | "component_match"
  | "ai_suggestion"
  | "not_found"
  | "not_checked";

export type SourceEvidence = {
  quality: EvidenceQuality;
  found: boolean;
  registered_entry: boolean;
  whole_unit_match: boolean;
  evidence_label?: string;
};

export type VerificationEvidence = Partial<Record<string, SourceEvidence>>;

type Props = {
  tier: VerificationTier;
  sourceVerified?: string | null;
  evidence?: VerificationEvidence | null;
  lemma?: string;
  size?: "sm" | "md";
};

// ── Config ───────────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<
  string,
  { stars: number; color: string; bg: string; label: string; description: string }
> = {
  dictionary_entry: {
    stars: 5,
    color: "#0F6E56",
    bg: "#E1F5EE",
    label: "Dictionary entry",
    description: "Registered as a separate entry in an authoritative dictionary.",
  },
  dictionary_match: {
    stars: 4,
    color: "#185FA5",
    bg: "#E6F1FB",
    label: "Dictionary match",
    description: "Found as a whole unit in authoritative sources, but no separate entry.",
  },
  normative_reference: {
    stars: 4,
    color: "#854F0B",
    bg: "#FAEEDA",
    label: "Normative reference",
    description: "Confirmed by Språkrådet as a recognised Norwegian language construction.",
  },
  usage_evidence: {
    stars: 3,
    color: "#3B6D11",
    bg: "#EAF3DE",
    label: "Usage evidence",
    description: "Confirmed through usage examples in authoritative sources.",
  },
  component_match: {
    stars: 2,
    color: "#888780",
    bg: "#F1EFE8",
    label: "Components verified",
    description: "Individual words are registered, but the full expression is not.",
  },
  ai_candidate: {
    stars: 1,
    color: "#5F5E5A",
    bg: "#F1EFE8",
    label: "AI candidate",
    description: "No authoritative confirmation found. Based on AI analysis only.",
  },
};

const QUALITY_CONFIG: Record<
  string,
  { icon: string; label: string; strong: boolean }
> = {
  registered_entry:      { icon: "📖", label: "Registered dictionary entry",    strong: true  },
  learner_dictionary:    { icon: "📚", label: "Learner dictionary (Lexin)",      strong: true  },
  normative_reference:   { icon: "🏛",  label: "Normative reference (Språkrådet)", strong: true  },
  exact_expression_match:{ icon: "✓",  label: "Exact expression found",         strong: false },
  search_page_match:     { icon: "🔍", label: "Found in search results",        strong: false },
  usage_example_match:   { icon: "💬", label: "Found in usage examples",        strong: false },
  component_match:       { icon: "🧩", label: "Components verified only",       strong: false },
  ai_suggestion:         { icon: "🤖", label: "AI analysis",                    strong: false },
};

const SOURCE_LABELS: Record<string, string> = {
  NAOB:        "NAOB — Det Norske Akademis ordbok",
  Ordbokene:   "Ordbøkene (UiB + Språkrådet)",
  Lexin:       "Lexin — OsloMet",
  Språkrådet:  "Språkrådet",
  Wiktionary:  "Wiktionary",
  Gemini:      "AI analysis",
};

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({ count, color }: { count: number; color: string }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={[styles.star, { color: i <= count ? color : "#D3D1C7" }]}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

// ── Evidence row ──────────────────────────────────────────────────────────────
function EvidenceRow({
  source,
  item,
}: {
  source: string;
  item: SourceEvidence;
}) {
  const qc = QUALITY_CONFIG[item.quality] ?? {
    icon: "○",
    label: item.quality,
    strong: false,
  };
  const sourceLabel = SOURCE_LABELS[source] ?? source;

  return (
    <View style={styles.evidenceRow}>
      <View style={styles.evidenceLeft}>
        <Text style={styles.evidenceIcon}>{qc.icon}</Text>
        <View style={styles.evidenceText}>
          <Text style={styles.evidenceSource}>{sourceLabel}</Text>
          <Text
            style={[
              styles.evidenceQuality,
              qc.strong && styles.evidenceQualityStrong,
            ]}
          >
            {qc.label}
          </Text>
        </View>
      </View>
      {item.registered_entry && (
        <View style={styles.registeredBadge}>
          <Text style={styles.registeredText}>registered</Text>
        </View>
      )}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function VerificationBadge({
  tier,
  sourceVerified,
  evidence,
  lemma,
  size = "md",
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);

  const t = tier ?? "ai_candidate";
  const cfg = TIER_CONFIG[t] ?? TIER_CONFIG.ai_candidate;

  // Filter evidence to only found sources
  const foundSources = evidence
    ? Object.entries(evidence).filter(
        ([, v]) => v?.found && v.quality !== "not_checked" && v.quality !== "ai_suggestion"
      )
    : [];

  const dotSize = size === "sm" ? 8 : 10;

  return (
    <>
      {/* Badge / dot */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={[styles.badge, size === "sm" && styles.badgeSm]}
        accessibilityLabel={`Verification: ${cfg.label}. Tap for details.`}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.dot,
            { width: dotSize, height: dotSize, backgroundColor: cfg.color },
          ]}
        />
        {size === "md" && (
          <Text style={[styles.badgeLabel, { color: cfg.color }]}>
            {cfg.label}
          </Text>
        )}
      </TouchableOpacity>

      {/* Popup modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={styles.popup} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={[styles.popupHeader, { backgroundColor: cfg.bg }]}>
              <Stars count={cfg.stars} color={cfg.color} />
              <Text style={[styles.popupTier, { color: cfg.color }]}>
                {cfg.label}
              </Text>
              {lemma && (
                <Text style={styles.popupLemma}>«{lemma}»</Text>
              )}
            </View>

            <ScrollView style={styles.popupBody} showsVerticalScrollIndicator={false}>
              {/* Description */}
              <Text style={styles.popupDescription}>{cfg.description}</Text>

              {/* Sources */}
              {foundSources.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Confirmed by</Text>
                  {foundSources.map(([source, item]) => (
                    <EvidenceRow key={source} source={source} item={item!} />
                  ))}
                </>
              )}

              {foundSources.length === 0 && (
                <Text style={styles.noEvidence}>
                  No authoritative sources confirmed this expression.
                </Text>
              )}

              {/* Source verified summary */}
              {sourceVerified && (
                <View style={styles.verifiedSummary}>
                  <Text style={styles.verifiedLabel}>Registered in</Text>
                  <Text style={styles.verifiedValue}>{sourceVerified}</Text>
                </View>
              )}
            </ScrollView>

            {/* Close */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  badgeSm: {
    paddingHorizontal: 0,
  },
  dot: {
    borderRadius: 99,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 6,
  },
  star: {
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  popup: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    maxHeight: "80%",
  },
  popupHeader: {
    padding: 20,
    paddingBottom: 16,
  },
  popupTier: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 2,
  },
  popupLemma: {
    fontSize: 13,
    color: "#888780",
    fontStyle: "italic",
    marginTop: 2,
  },
  popupBody: {
    padding: 16,
    maxHeight: 320,
  },
  popupDescription: {
    fontSize: 14,
    color: "#444441",
    lineHeight: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#888780",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  evidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#D3D1C7",
  },
  evidenceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  evidenceIcon: {
    fontSize: 16,
    width: 22,
    textAlign: "center",
  },
  evidenceText: {
    flex: 1,
  },
  evidenceSource: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2C2C2A",
  },
  evidenceQuality: {
    fontSize: 12,
    color: "#888780",
    marginTop: 1,
  },
  evidenceQualityStrong: {
    color: "#0F6E56",
    fontWeight: "500",
  },
  registeredBadge: {
    backgroundColor: "#E1F5EE",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 8,
  },
  registeredText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#0F6E56",
    letterSpacing: 0.3,
  },
  noEvidence: {
    fontSize: 13,
    color: "#888780",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
  verifiedSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#D3D1C7",
  },
  verifiedLabel: {
    fontSize: 12,
    color: "#888780",
  },
  verifiedValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#185FA5",
  },
  closeBtn: {
    margin: 12,
    marginTop: 4,
    padding: 14,
    backgroundColor: "#F1EFE8",
    borderRadius: 10,
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#444441",
  },
});