import {
  deriveCanonicalCrossPredicateAttachmentOwnershipV1,
} from './canonical-cross-predicate-attachment-ownership-bridge-v1.ts';

import type {
  CanonicalLanguageGraphV1,
  GraphNodeType,
  GraphStatus,
  LanguageGraphEdgeV1,
  LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


function node(
  id: string,
  type: GraphNodeType,
  status: GraphStatus = 'resolved',
): LanguageGraphNodeV1 {
  return {
    id,
    type,
    status,
    features: {},
    producer: 'test',
    evidenceIds: [`evidence:${id}`],
    provenanceIds: [`prov:${id}`],
  };
}


function edge(
  input: Partial<LanguageGraphEdgeV1> &
    Pick<
      LanguageGraphEdgeV1,
      'id' | 'relation' | 'sourceId' | 'targetId'
    >,
): LanguageGraphEdgeV1 {
  return {
    status: 'resolved',
    features: {},
    producer: 'test',
    evidenceIds: [`evidence:${input.id}`],
    provenanceIds: [`prov:${input.id}`],
    ...input,
  };
}


function graph(
  nodes: LanguageGraphNodeV1[],
  edges: LanguageGraphEdgeV1[],
): CanonicalLanguageGraphV1 {
  return {
    version: 'canonical-language-graph-v1',
    documentId: 'document:test',
    surfaceVersion: 'canonical-surface-boundary-v1',
    nodes,
    edges,
    evidence: [],
    provenance: [],
    alternativeSets: [],
    constraintTrace: [],
    producerState: {},
    invariants: {
      oneCanonicalGraph: true,
      stableSurfaceTokenIds: true,
      appendEvidenceDoNotReparseText: true,
      candidatesMayCoexist: true,
      resolvedFactsRequireEvidence: true,
      learnerErrorSeparateFromParserUncertainty: true,
    },
  };
}


const matrix =
  node('predicate:matrix', 'predicate');

const embedded =
  node('predicate:embedded', 'predicate');

const clause =
  node('clause:embedded', 'clause');

const token =
  node('token:embedded-head', 'token');


const ownership =
  edge({
    id: 'edge:predicate_of_clause:embedded',
    relation: 'predicate_of_clause',
    sourceId: embedded.id,
    targetId: clause.id,
    producer: 'legacy_clause_adapter_v1',
  });


const attachment =
  edge({
    id: 'edge:ccomp:matrix:embedded',
    relation: 'ccomp',
    sourceId: matrix.id,
    targetId: clause.id,
    producer: 'legacy_attachment_adapter_v1',
  });


Deno.test(
  'v1.49 A2: exact resolved attachment and exact clause ownership derive candidate cross-predicate relation',
  () => {
    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [ownership],
        ),
        [attachment],
      );

    assert(
      result.candidates.length === 1,
      'expected one candidate',
    );

    assert(
      result.rejections.length === 0,
      'unexpected rejection',
    );

    const candidate =
      result.candidates[0];

    assert(
      candidate.matrixPredicateId === matrix.id,
      'matrix predicate identity changed',
    );

    assert(
      candidate.embeddedPredicateId === embedded.id,
      'embedded predicate identity changed',
    );

    assert(
      candidate.embeddedClauseId === clause.id,
      'embedded clause identity changed',
    );

    assert(
      candidate.relation === 'ccomp',
      'relation was not transported opaquely',
    );

    assert(
      candidate.status === 'candidate',
      'bridge resolved semantics',
    );

    assert(
      candidate.attachmentEdgeId === attachment.id,
      'attachment occurrence identity lost',
    );

    assert(
      candidate.predicateOwnershipEdgeId === ownership.id,
      'ownership occurrence identity lost',
    );
  },
);


Deno.test(
  'v1.49 A2: relation remains opaque',
  () => {
    const opaque =
      edge({
        ...attachment,
        id: 'edge:opaque',
        relation: 'future_relation_xyz',
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [ownership],
        ),
        [opaque],
      );

    assert(
      result.candidates[0]?.relation ===
        'future_relation_xyz',
      'bridge interpreted relation vocabulary',
    );
  },
);


Deno.test(
  'v1.49 A2: candidate attachment is rejected',
  () => {
    const unresolved =
      edge({
        ...attachment,
        id: 'edge:candidate',
        status: 'candidate',
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [ownership],
        ),
        [unresolved],
      );

    assert(
      result.candidates.length === 0,
      'candidate attachment was promoted',
    );

    assert(
      result.rejections[0]?.reason ===
        'attachment_not_resolved',
      'wrong rejection',
    );
  },
);


Deno.test(
  'v1.49 A2: token fallback target is rejected',
  () => {
    const fallback =
      edge({
        ...attachment,
        id: 'edge:token-fallback',
        targetId: token.id,
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause, token],
          [ownership],
        ),
        [fallback],
      );

    assert(
      result.candidates.length === 0,
      'token fallback became clause authority',
    );

    assert(
      result.rejections[0]?.reason ===
        'attachment_target_not_clause',
      'wrong rejection',
    );
  },
);


Deno.test(
  'v1.49 A2: non-predicate matrix endpoint is rejected',
  () => {
    const invalid =
      edge({
        ...attachment,
        id: 'edge:matrix-token',
        sourceId: token.id,
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause, token],
          [ownership],
        ),
        [invalid],
      );

    assert(
      result.candidates.length === 0,
      'token matrix became predicate',
    );

    assert(
      result.rejections[0]?.reason ===
        'attachment_source_not_predicate',
      'wrong rejection',
    );
  },
);


Deno.test(
  'v1.49 A2: zero exact ownership fails closed',
  () => {
    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [],
        ),
        [attachment],
      );

    assert(
      result.candidates.length === 0,
      'missing ownership produced candidate',
    );

    assert(
      result.rejections[0]?.reason ===
        'ownership_not_found',
      'wrong rejection',
    );
  },
);


Deno.test(
  'v1.49 A2: multiple resolved predicate owners fail closed',
  () => {
    const embedded2 =
      node('predicate:embedded:2', 'predicate');

    const ownership2 =
      edge({
        id: 'edge:predicate_of_clause:embedded:2',
        relation: 'predicate_of_clause',
        producer: 'legacy_clause_adapter_v1',
        sourceId: embedded2.id,
        targetId: clause.id,
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, embedded2, clause],
          [ownership, ownership2],
        ),
        [attachment],
      );

    assert(
      result.candidates.length === 0,
      'ambiguous ownership selected a winner',
    );

    assert(
      result.rejections[0]?.reason ===
        'ownership_ambiguous',
      'wrong rejection',
    );
  },
);


Deno.test(
  'v1.49 A2: rejected and blocked ownership edges do not create ambiguity',
  () => {
    const embedded2 =
      node('predicate:embedded:2', 'predicate');

    const rejected =
      edge({
        id: 'edge:rejected-owner',
        relation: 'predicate_of_clause',
        producer: 'legacy_clause_adapter_v1',
        sourceId: embedded2.id,
        targetId: clause.id,
        status: 'rejected',
      });

    const blocked =
      edge({
        id: 'edge:blocked-owner',
        relation: 'predicate_of_clause',
        producer: 'legacy_clause_adapter_v1',
        sourceId: embedded2.id,
        targetId: clause.id,
        status: 'blocked',
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, embedded2, clause],
          [ownership, rejected, blocked],
        ),
        [attachment],
      );

    assert(
      result.candidates.length === 1,
      'non-resolved ownership poisoned exact owner',
    );

    assert(
      result.candidates[0].embeddedPredicateId ===
        embedded.id,
      'wrong owner selected',
    );
  },
);


Deno.test(
  'v1.49 A2: ownership source must be real predicate node',
  () => {
    const badOwnership =
      edge({
        id: 'edge:bad-owner',
        relation: 'predicate_of_clause',
        producer: 'legacy_clause_adapter_v1',
        sourceId: token.id,
        targetId: clause.id,
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, clause, token],
          [badOwnership],
        ),
        [attachment],
      );

    assert(
      result.candidates.length === 0,
      'token owner became predicate',
    );

    assert(
      result.rejections[0]?.reason ===
        'ownership_source_not_predicate',
      'wrong rejection',
    );
  },
);


Deno.test(
  'v1.49 A2: attachment evidence and provenance are mandatory',
  () => {
    const noEvidence =
      edge({
        ...attachment,
        id: 'edge:no-evidence',
        evidenceIds: [],
      });

    const noProvenance =
      edge({
        ...attachment,
        id: 'edge:no-provenance',
        provenanceIds: [],
      });

    const evidenceResult =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [ownership],
        ),
        [noEvidence],
      );

    const provenanceResult =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [ownership],
        ),
        [noProvenance],
      );

    assert(
      evidenceResult.rejections[0]?.reason ===
        'missing_evidence',
      'missing attachment evidence accepted',
    );

    assert(
      provenanceResult.rejections[0]?.reason ===
        'missing_provenance',
      'missing attachment provenance accepted',
    );
  },
);


Deno.test(
  'v1.49 A2: ownership evidence and provenance are mandatory',
  () => {
    const noEvidenceOwner =
      edge({
        ...ownership,
        id: 'edge:owner:no-evidence',
        evidenceIds: [],
      });

    const noProvenanceOwner =
      edge({
        ...ownership,
        id: 'edge:owner:no-provenance',
        provenanceIds: [],
      });

    const evidenceResult =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [noEvidenceOwner],
        ),
        [attachment],
      );

    const provenanceResult =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [noProvenanceOwner],
        ),
        [attachment],
      );

    assert(
      evidenceResult.rejections[0]?.reason ===
        'missing_evidence',
      'missing ownership evidence accepted',
    );

    assert(
      provenanceResult.rejections[0]?.reason ===
        'missing_provenance',
      'missing ownership provenance accepted',
    );
  },
);


Deno.test(
  'v1.49 A2: evidence and provenance from both authorities are preserved',
  () => {
    const richAttachment =
      edge({
        ...attachment,
        id: 'edge:rich-attachment',
        evidenceIds: ['e:a', 'e:shared'],
        provenanceIds: ['p:a', 'p:shared'],
      });

    const richOwnership =
      edge({
        ...ownership,
        id: 'edge:rich-owner',
        evidenceIds: ['e:o', 'e:shared'],
        provenanceIds: ['p:o', 'p:shared'],
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [richOwnership],
        ),
        [richAttachment],
      );

    const candidate =
      result.candidates[0];

    assert(
      candidate.evidenceIds.length === 3 &&
        candidate.evidenceIds.includes('e:a') &&
        candidate.evidenceIds.includes('e:o') &&
        candidate.evidenceIds.includes('e:shared'),
      'evidence not preserved',
    );

    assert(
      candidate.provenanceIds.length === 3 &&
        candidate.provenanceIds.includes('p:a') &&
        candidate.provenanceIds.includes('p:o') &&
        candidate.provenanceIds.includes('p:shared'),
      'provenance not preserved',
    );
  },
);


Deno.test(
  'v1.49 A2: unrelated clause ownership is ignored',
  () => {
    const otherClause =
      node('clause:other', 'clause');

    const otherPredicate =
      node('predicate:other', 'predicate');

    const unrelated =
      edge({
        id: 'edge:predicate_of_clause:other',
        relation: 'predicate_of_clause',
        producer: 'legacy_clause_adapter_v1',
        sourceId: otherPredicate.id,
        targetId: otherClause.id,
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [
            matrix,
            embedded,
            clause,
            otherClause,
            otherPredicate,
          ],
          [ownership, unrelated],
        ),
        [attachment],
      );

    assert(
      result.candidates.length === 1,
      'unrelated ownership poisoned exact join',
    );

    assert(
      result.candidates[0].embeddedPredicateId ===
        embedded.id,
      'unrelated predicate selected',
    );
  },
);


Deno.test(
  'v1.49 A2: bridge does not mutate graph',
  () => {
    const g =
      graph(
        [matrix, embedded, clause],
        [ownership],
      );

    const before =
      JSON.stringify(g);

    deriveCanonicalCrossPredicateAttachmentOwnershipV1(
      g,
      [attachment],
    );

    assert(
      JSON.stringify(g) === before,
      'bridge mutated canonical graph',
    );
  },
);


Deno.test(
  'v1.49 A2: arbitrary resolved predicate to clause edge is not attachment authority',
  () => {
    const foreignAttachment =
      edge({
        ...attachment,
        id: 'edge:foreign-attachment',
        producer: 'unrelated_producer_v1',
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [ownership],
        ),
        [foreignAttachment],
      );

    assert(
      result.candidates.length === 0,
      'foreign resolved edge became attachment authority',
    );

    assert(
      result.rejections[0]?.reason ===
        'attachment_wrong_producer',
      'wrong rejection for foreign attachment producer',
    );
  },
);


Deno.test(
  'v1.49 A2: foreign predicate_of_clause producer is not ownership authority',
  () => {
    const foreignOwnership =
      edge({
        ...ownership,
        id: 'edge:foreign-owner',
        producer: 'unrelated_producer_v1',
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [matrix, embedded, clause],
          [foreignOwnership],
        ),
        [attachment],
      );

    assert(
      result.candidates.length === 0,
      'foreign predicate_of_clause became ownership authority',
    );

    assert(
      result.rejections[0]?.reason ===
        'ownership_not_found',
      'foreign ownership was not excluded from authority set',
    );
  },
);


Deno.test(
  'v1.49 A2: foreign ownership does not create false ambiguity beside exact owner',
  () => {
    const foreignPredicate =
      node('predicate:foreign-owner', 'predicate');

    const foreignOwnership =
      edge({
        id: 'edge:foreign-owner:duplicate-clause',
        relation: 'predicate_of_clause',
        sourceId: foreignPredicate.id,
        targetId: clause.id,
        producer: 'unrelated_producer_v1',
      });

    const result =
      deriveCanonicalCrossPredicateAttachmentOwnershipV1(
        graph(
          [
            matrix,
            embedded,
            foreignPredicate,
            clause,
          ],
          [ownership, foreignOwnership],
        ),
        [attachment],
      );

    assert(
      result.candidates.length === 1,
      'foreign ownership poisoned exact ownership cardinality',
    );

    assert(
      result.rejections.length === 0,
      'foreign ownership created false rejection',
    );

    assert(
      result.candidates[0].embeddedPredicateId ===
        embedded.id,
      'foreign ownership selected as owner',
    );
  },
);
