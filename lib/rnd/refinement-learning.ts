/** Historical memory is advisory metadata, never a second QA authority.
 * Refinement acceptance is deterministic: the current QA correction is applied
 * only when the report route's repeat-effectiveness checks permit it.
 * This avoids an additional paid LLM call and prevents retrieved memories from
 * overriding the current image's independent evaluation.
 */
import type { RndHindsightEvidence } from "@/lib/rnd/hindsight";

export function chooseRndRefinement(candidate: string | null, history: RndHindsightEvidence[]) {
  return {
    candidate,
    decision: candidate ? "DETERMINISTIC_APPLY" : "DETERMINISTIC_STOP",
    evidenceIds: history.map((item) => item.id),
  };
}
