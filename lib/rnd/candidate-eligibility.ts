export type CandidateQaRecord = {
  hairOnly?: unknown;
  artifacts?: unknown;
  imageIntegrity?: unknown;
  finalVerification?: unknown;
  identity?: unknown;
  styleAccuracy?: unknown;
  rootIntegration?: unknown;
  lightingConsistency?: unknown;
};

export type CandidateEligibilityInput = {
  artifactId: string | null;
  qaJson: unknown;
  overallScore: number | null;
  aiGatePassed: boolean | null;
  publicationTierPassed: boolean | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fail-closed predicate shared by best-candidate selection and regression tests. */
export function isEligibleRndCandidate(attempt: CandidateEligibilityInput): boolean {
  if (!attempt.artifactId || !isRecord(attempt.qaJson)) return false;
  const qa = attempt.qaJson as CandidateQaRecord;
  if (!isRecord(qa.imageIntegrity) || !isRecord(qa.finalVerification)) return false;

  const integrity = qa.imageIntegrity;
  const verification = qa.finalVerification;
  const scores = [
    verification.overall,
    verification.identity,
    verification.styleAccuracy,
    verification.rootIntegration,
    verification.lightingConsistency,
  ];
  return attempt.aiGatePassed === true &&
    attempt.publicationTierPassed === true &&
    attempt.overallScore !== null && Number.isFinite(attempt.overallScore) &&
    qa.hairOnly === "PASS" && qa.artifacts === "NONE" &&
    integrity.canvasMatch === true &&
    integrity.faceTexturePreservationPass === true &&
    verification.verdict === "PASS" &&
    scores.every((score) => typeof score === "number" && Number.isFinite(score) && score >= 9.5 && score <= 10) &&
    verification.hairOnly === "PASS" &&
    verification.artifacts === "NONE";
}
