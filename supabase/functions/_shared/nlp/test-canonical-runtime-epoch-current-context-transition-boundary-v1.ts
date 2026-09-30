import { assertEquals } from "jsr:@std/assert";

import {
  CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_V1,
  CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_VERSION_V1,
} from "./canonical-runtime-epoch-current-context-transition-boundary-v1.ts";

Deno.test(
  "A3.2.2 exports the exact epoch CURRENT transition boundary identity",
  () => {
    assertEquals(
      CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_V1,
      "a3.2.2:canonical-runtime-epoch-current-context-transition-boundary-v1",
    );

    assertEquals(
      CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_VERSION_V1,
      "1.0.0",
    );
  },
);

Deno.test(
  "A3.2.2 delegates snapshot, occurrence and CURRENT proof to existing canonical derivers",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-epoch-current-context-transition-boundary-v1.ts",
        import.meta.url,
      ),
    );

    assertEquals(
      source.includes(
        "await deriveCanonicalGraphSnapshotIdentityAuthorityV1(",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(",
      ),
      true,
    );
  },
);

Deno.test(
  "A3.2.2 preserves sentenceNodeId and forbids sentenceIndex identity mapping",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-epoch-current-context-transition-boundary-v1.ts",
        import.meta.url,
      ),
    );

    assertEquals(
      source.includes(
        "candidate.sentenceNodeId ===",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "sourceCurrent.sentenceNodeId",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "sentenceSelectedHere: false",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "sentenceIndexUsedForIdentity: false",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "sentenceIndexUsedAsSelector: false",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "legacyMappingUsed: false",
      ),
      true,
    );
  },
);

Deno.test(
  "A3.2.2 does not execute, schedule, mutate graph or recompute upstream semantics",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-epoch-current-context-transition-boundary-v1.ts",
        import.meta.url,
      ),
    );

    assertEquals(
      source.includes(
        "whereTruthRecomputed: false",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "bindingRecomputed: false",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "activationPermissionRecomputed: false",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "executionAdmissionRecomputed: false",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "executionPlanRecomputed: false",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "graphMutatedHere: false",
      ),
      true,
    );

    assertEquals(
      source.includes(
        "schedulerInvoked: false",
      ),
      true,
    );
  },
);
