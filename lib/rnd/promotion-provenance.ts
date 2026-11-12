import { createHash } from "node:crypto";
import { passesRndCombinedHardGate } from "./qa-hard-gate";
import type { Prisma } from "@prisma/client";
import { hasVerifiedCalibration } from "./calibration-evidence";

export const rndPromptChecksum = (prompt: string) => createHash("sha256").update(prompt).digest("hex");
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const metrics = ["overall", "identity", "styleAccuracy", "rootIntegration", "lightingConsistency"] as const;
function evaluator(value: unknown) {
  const v = record(value);
  if (!v || !metrics.every(key => typeof v[key] === "number" && Number.isFinite(v[key]) && Number(v[key]) >= 9.5 && Number(v[key]) <= 10)) return null;
  return { verdict: v.verdict as string, overall: v.overall as number, identity: v.identity as number, styleAccuracy: v.styleAccuracy as number,
    rootIntegration: v.rootIntegration as number, lightingConsistency: v.lightingConsistency as number, hairOnly: v.hairOnly as string, artifacts: v.artifacts as string };
}
export type ApprovalEvidence = {
  id: string; jobId: string; attemptNumber: number; prompt: string; artifactId: string | null;
  overallScore: unknown; aiGatePassed: boolean | null; publicationTierPassed: boolean | null; qaJson: unknown;
  artifact: { id: string; kind: string; checksum: string | null; storageKey: string } | null;
};
export function eligibleRndApproval(attempt: ApprovalEvidence | null | undefined) {
  if (!attempt || !attempt.prompt || !attempt.artifactId || attempt.artifact?.id !== attempt.artifactId || attempt.artifact.kind !== "GENERATED" ||
      !attempt.artifact.storageKey.startsWith(`rnd/attempts/${attempt.jobId}/${attempt.attemptNumber}-`) || !/^[a-f0-9]{64}$/.test(attempt.artifact.checksum ?? "") ||
      attempt.aiGatePassed !== true || attempt.publicationTierPassed !== true || !Number.isFinite(Number(attempt.overallScore)) || Number(attempt.overallScore) < 9.5 || Number(attempt.overallScore) > 10) return false;
  const qa = record(attempt.qaJson), primary = evaluator(qa), final = evaluator(qa?.finalVerification), integrity = record(qa?.imageIntegrity);
  return Boolean(primary && final && passesRndCombinedHardGate({ qa: primary, finalVerification: final,
    imageIntegrity: { canvasMatch: integrity?.canvasMatch === true, faceTexturePreservationPass: integrity?.faceTexturePreservationPass === true } }));
}
export function humanApprovalProof(attempt: ApprovalEvidence, reviewerId: string) {
  return { version: 1, reviewerId, reviewerRole: "ADMIN", approvedAt: new Date().toISOString(), attemptId: attempt.id,
    artifactId: attempt.artifactId, artifactChecksum: attempt.artifact!.checksum!, promptChecksum: rndPromptChecksum(attempt.prompt) };
}
export function verifiedHumanApproval(attempt: ApprovalEvidence) {
  if (!eligibleRndApproval(attempt)) return false;
  const proof = record(record(attempt.qaJson)?.humanApproval);
  return Boolean(proof && proof.version === 1 && typeof proof.reviewerId === "string" && proof.reviewerId.length > 0 && proof.reviewerRole === "ADMIN" &&
    typeof proof.approvedAt === "string" && Number.isFinite(Date.parse(proof.approvedAt)) && proof.attemptId === attempt.id && proof.artifactId === attempt.artifactId &&
    proof.artifactChecksum === attempt.artifact!.checksum && proof.promptChecksum === rndPromptChecksum(attempt.prompt));
}
/** Row lock serializes every prompt-version writer for this hairstyle. */
export async function lockPromptStyle(tx: { $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> }, hairstyleId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Hairstyle" WHERE "id" = ${hairstyleId} FOR UPDATE`;
  return rows.length === 1;
}
export async function verifiedPromptCandidate(tx: Pick<Prisma.TransactionClient, "rnDAttempt" | "$queryRaw" | "rnDQAReferenceRating" | "rnDPromptCalibration">,
  candidate: { id: string; sourceRnDAttemptId: string | null; hairstyleId: string; prompt: string; qaStatus: string }) {
  if (!candidate.sourceRnDAttemptId || candidate.qaStatus !== "PASSED") return false;
  const source = await tx.rnDAttempt.findUnique({ where: { id: candidate.sourceRnDAttemptId }, include: { artifact: true, job: { include: { target: true } } } });
  return Boolean(source && source.verdict === "APPROVED" && source.job.status === "COMPLETED" && source.job.target.status === "APPROVED" &&
    source.job.target.hairstyleId === candidate.hairstyleId && source.prompt === candidate.prompt && verifiedHumanApproval(source) && await hasVerifiedCalibration(tx, candidate));
}
