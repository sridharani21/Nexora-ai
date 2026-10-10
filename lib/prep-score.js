export const PLACEMENT_SCORE_FORMULA_VERSION = "placement-score-v3";

export const PLACEMENT_SCORE_WEIGHTS = Object.freeze({
  technical: 25,
  coding: 25,
  aptitude: 15,
  communication: 15,
  interview: 10,
  resume: 10,
});

export function weightedAverageMeasured(values) {
  const measured = values.filter(([value]) => Number.isFinite(value));
  const totalWeight = measured.reduce((total, [, weight]) => total + weight, 0);
  if (!totalWeight) return null;
  return measured.reduce((total, [value, weight]) => total + value * weight, 0) / totalWeight;
}

export function calculatePlacementScore(components) {
  const measured = Object.entries(PLACEMENT_SCORE_WEIGHTS)
    .map(([key, weight]) => {
      const value = components[key];
      return [key, weight, Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null];
    })
    .filter(([, , score]) => score !== null);

  const measuredWeight = measured.reduce((total, [, weight]) => total + weight, 0);
  const overallReadiness = measuredWeight
    ? Math.round(measured.reduce((total, [, weight, score]) => total + score * weight, 0) / measuredWeight)
    : null;
  const scoreComponents = Object.fromEntries(
    Object.entries(PLACEMENT_SCORE_WEIGHTS).map(([key, weight]) => {
      const score = measured.find(([measuredKey]) => measuredKey === key)?.[2] ?? null;
      return [key, {
        score,
        nominalWeight: weight,
        effectiveWeight: score === null ? 0 : Number((weight / measuredWeight * 100).toFixed(2)),
        status: score === null ? "UNKNOWN" : "MEASURED",
      }];
    }),
  );

  return {
    overallReadiness,
    evidenceCoverage: measuredWeight,
    scoreComponents,
  };
}
