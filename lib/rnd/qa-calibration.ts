export type CalibrationRating = {
  attemptId: string;
  reviewerKey: string;
  humanOverallScore: number;
  humanHairstyleScore?: number | null;
};

export type CalibrationSample = {
  attemptId: string;
  humanOverallScore: number;
  humanHairstyleScore: number | null;
  reviewerCount: number;
  aiOverallScore: number;
};

export type CalibrationSummary = {
  status: "INSUFFICIENT_DATA" | "HEALTHY" | "DEGRADED";
  sampleCount: number;
  minSamples: number;
  minReviewersPerSample: number;
  falsePassCount: number;
  falsePassRate: number | null;
  falseFailCount: number;
  falseFailRate: number | null;
  correlation: number | null;
  maxFalsePassRate: number;
  minCorrelation: number;
  reason: string;
};

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function pearson(xs: number[], ys: number[]) {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    numerator += dx * dy;
    xDenominator += dx * dx;
    yDenominator += dy * dy;
  }
  if (xDenominator === 0 || yDenominator === 0) return null;
  return numerator / Math.sqrt(xDenominator * yDenominator);
}

export function buildCalibrationSamples(
  ratings: CalibrationRating[],
  aiScores: Map<string, number>,
  minReviewersPerSample: number,
): CalibrationSample[] {
  const grouped = new Map<string, CalibrationRating[]>();
  for (const rating of ratings) {
    const bucket = grouped.get(rating.attemptId) ?? [];
    bucket.push(rating);
    grouped.set(rating.attemptId, bucket);
  }

  const samples: CalibrationSample[] = [];
  for (const [attemptId, bucket] of grouped) {
    const aiOverallScore = aiScores.get(attemptId);
    if (aiOverallScore == null || bucket.length < minReviewersPerSample) continue;
    samples.push({
      attemptId,
      humanOverallScore: median(bucket.map((r) => r.humanOverallScore)),
      humanHairstyleScore: median(
        bucket
          .map((r) => r.humanHairstyleScore)
          .filter((v): v is number => typeof v === "number"),
      ) || null,
      reviewerCount: bucket.length,
      aiOverallScore,
    });
  }
  return samples;
}

export function summarizeCalibration(
  samples: CalibrationSample[],
  policy: {
    minSamples?: number;
    maxFalsePassRate?: number;
    minCorrelation?: number;
  } = {},
): CalibrationSummary {
  const minSamples = policy.minSamples ?? 20;
  const maxFalsePassRate = policy.maxFalsePassRate ?? 0.02;
  const minCorrelation = policy.minCorrelation ?? 0.75;
  const falsePassCount = samples.filter(
    (s) => s.aiOverallScore >= 9.5 && s.humanOverallScore < 9.5,
  ).length;
  const falseFailCount = samples.filter(
    (s) => s.aiOverallScore < 9.5 && s.humanOverallScore >= 9.5,
  ).length;
  const falsePassRate = samples.length ? falsePassCount / samples.length : null;
  const falseFailRate = samples.length ? falseFailCount / samples.length : null;
  const correlation = pearson(
    samples.map((s) => s.aiOverallScore),
    samples.map((s) => s.humanOverallScore),
  );

  if (samples.length < minSamples) {
    return {
      status: "INSUFFICIENT_DATA",
      sampleCount: samples.length,
      minSamples,
      minReviewersPerSample: 3,
      falsePassCount,
      falsePassRate,
      falseFailCount,
      falseFailRate,
      correlation,
      maxFalsePassRate,
      minCorrelation,
      reason: `Need at least ${minSamples} adjudicated benchmark samples before calibration status is considered reliable.`,
    };
  }

  const degraded =
    (falsePassRate ?? 1) > maxFalsePassRate ||
    (correlation != null && correlation < minCorrelation) ||
    correlation == null;

  return {
    status: degraded ? "DEGRADED" : "HEALTHY",
    sampleCount: samples.length,
    minSamples,
    minReviewersPerSample: 3,
    falsePassCount,
    falsePassRate,
    falseFailCount,
    falseFailRate,
    correlation,
    maxFalsePassRate,
    minCorrelation,
    reason: degraded
      ? "Automated QA calibration is outside the configured tolerance; automatic trust should be treated as degraded."
      : "Automated QA remains within the configured false-pass and score-correlation tolerances.",
  };
}
