import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { buildCalibrationSamples, summarizeCalibration } from "./qa-calibration";

export const CALIBRATION_POLICY_VERSION = "dmh.prompt-calibration.v1";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export type CalibrationCandidate = { id: string; hairstyleId: string; prompt: string; sourceRnDAttemptId: string | null; qaStatus: string };
type Client = Pick<Prisma.TransactionClient, "$queryRaw" | "rnDQAReferenceRating" | "rnDPromptCalibration">;
export async function lockCalibration(tx: Pick<Client, "$queryRaw">) {
  await tx.$queryRaw`WITH lock AS (SELECT pg_advisory_xact_lock(hashtext('dmh-rnd-prompt-calibration-v1'))) SELECT 1 AS locked FROM lock`;
}
function policy() {
  const value = { minSamples: Number(process.env.RND_QA_CALIBRATION_MIN_SAMPLES ?? 20), maxFalsePassRate: Number(process.env.RND_QA_CALIBRATION_MAX_FALSE_PASS_RATE ?? 0.02), minCorrelation: Number(process.env.RND_QA_CALIBRATION_MIN_CORRELATION ?? 0.75) };
  if (!Number.isInteger(value.minSamples) || value.minSamples < 20 || value.minSamples > 500 || !Number.isFinite(value.maxFalsePassRate) || value.maxFalsePassRate < 0 || value.maxFalsePassRate > 0.02 || !Number.isFinite(value.minCorrelation) || value.minCorrelation < 0.75 || value.minCorrelation > 1) throw new Error("RND_CALIBRATION_POLICY_INVALID");
  return value;
}
/** Existing QA reliability policy, scoped to the candidate's exact prompt/style.
 * Old unbound/worker-authored reviews do not become trusted evidence. */
export async function computeCalibration(tx: Pick<Client, "rnDQAReferenceRating">, candidate: CalibrationCandidate) {
  const promptChecksum = hash(candidate.prompt), limits = policy();
  const rows = await tx.rnDQAReferenceRating.findMany({
    where: { reviewedByUserId: { not: null }, promptChecksum, attempt: { job: { target: { hairstyleId: candidate.hairstyleId } } } },
    orderBy: [{ attemptId: "asc" }, { reviewedByUserId: "asc" }], take: 1501,
    include: { reviewedByUser: true, attempt: { include: { artifact: true, job: { include: { target: { include: { sourceAsset: true } } } } } } },
  });
  const trusted = rows.filter(r => r.reviewedByUser?.role === "ADMIN" && r.reviewedByUser.isActive && !r.reviewedByUser.isDeleted && r.reviewerKey === `admin:${r.reviewedByUserId}` && r.reviewedAt &&
    hash(r.attempt.prompt) === promptChecksum && r.attempt.artifact?.kind === "GENERATED" && r.attempt.generationCompletedAt && r.attempt.overallScore !== null &&
    r.artifactChecksum === r.attempt.artifact.checksum && /^[a-f0-9]{64}$/.test(r.artifactChecksum ?? "") && /^[a-f0-9]{64}$/.test(r.attempt.job.target.sourceAsset.checksum ?? "") &&
    r.attempt.artifact.storageKey.startsWith(`rnd/attempts/${r.attempt.jobId}/${r.attempt.attemptNumber}-`) &&
    [Number(r.humanOverallScore), Number(r.attempt.overallScore), ...(r.humanHairstyleScore === null ? [] : [Number(r.humanHairstyleScore)])].every(v => Number.isFinite(v) && v >= 0 && v <= 10));
  const normalized = trusted.map(r => ({ attemptId: r.attemptId, reviewerKey: r.reviewedByUserId!, humanOverallScore: Number(r.humanOverallScore), humanHairstyleScore: r.humanHairstyleScore === null ? null : Number(r.humanHairstyleScore) }));
  const samples = buildCalibrationSamples(normalized, new Map(trusted.map(r => [r.attemptId, Number(r.attempt.overallScore)])), 3);
  const sources = new Map(trusted.map(r => [r.attemptId, r.attempt.job.target.sourceAsset.checksum]));
  const repeatedSources = new Set(samples.map(s => sources.get(s.attemptId))).size !== samples.length;
  const summary = summarizeCalibration(samples, limits);
  const source = samples.find(s => s.attemptId === candidate.sourceRnDAttemptId);
  const result = rows.length > 1500 || repeatedSources || summary.status === "INSUFFICIENT_DATA" || !source ? "INCOMPLETE" :
    summary.status === "HEALTHY" && source.humanOverallScore >= 9.5 && (source.humanHairstyleScore ?? -1) >= 9.5 ? "PASSED" : "FAILED";
  const input = trusted.map(r => ({ id: r.id, attemptId: r.attemptId, reviewerId: r.reviewedByUserId, reviewedAt: r.reviewedAt!.toISOString(), artifactChecksum: r.artifactChecksum,
    sourceChecksum: r.attempt.job.target.sourceAsset.checksum, overall: Number(r.humanOverallScore), style: r.humanHairstyleScore === null ? null : Number(r.humanHairstyleScore), ai: Number(r.attempt.overallScore) }));
  const evidenceDigest = hash(JSON.stringify({ policyVersion: CALIBRATION_POLICY_VERSION, candidateId: candidate.id, styleId: candidate.hairstyleId, promptChecksum, sourceAttemptId: candidate.sourceRnDAttemptId, limits, input }));
  return { promptChecksum, evidenceDigest, result, summary: { ...summary, repeatedSources, inputLimitExceeded: rows.length > 1500, sourceAdjudicated: Boolean(source) } };
}
/** Caller holds style lock, then calibration lock. Recompute: mutable status alone
 * and stale/replayed executions are never authoritative. */
export async function hasVerifiedCalibration(tx: Client, candidate: CalibrationCandidate) {
  if (candidate.qaStatus !== "PASSED" || !candidate.sourceRnDAttemptId) return false;
  await lockCalibration(tx);
  const run = await tx.rnDPromptCalibration.findFirst({ where: { promptVersionId: candidate.id }, orderBy: { id: "desc" }, include: { executedByUser: true } });
  if (!run || run.result !== "PASSED" || run.promptVersionId !== candidate.id || run.hairstyleId !== candidate.hairstyleId || run.sourceAttemptId !== candidate.sourceRnDAttemptId || run.promptChecksum !== hash(candidate.prompt) ||
    run.policyVersion !== CALIBRATION_POLICY_VERSION || !Number.isFinite(run.completedAt.getTime()) || run.completedAt.getTime() > Date.now() ||
    run.executedByUser.role !== "ADMIN" || !run.executedByUser.isActive || run.executedByUser.isDeleted) return false;
  const computed = await computeCalibration(tx, candidate);
  return computed.result === "PASSED" && computed.evidenceDigest === run.evidenceDigest && canonical(computed.summary) === canonical(run.summary);
}
