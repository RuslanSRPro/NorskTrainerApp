export type ConfidenceLevel = 'low' | 'medium' | 'high';

const confidenceRank: Record<ConfidenceLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function minConfidence(
  ...values: Array<string | null | undefined>
): ConfidenceLevel {
  const validValues = values.filter(
    (value): value is ConfidenceLevel =>
      value === 'low' || value === 'medium' || value === 'high',
  );

  if (validValues.length === 0) return 'low';

  return validValues.sort(
    (a, b) => confidenceRank[a] - confidenceRank[b],
  )[0];
}