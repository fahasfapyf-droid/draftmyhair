import { passesRndHardIntegrityGate } from "@/lib/rnd/image-integrity";

type QaResult = {
  verdict: string;
  overall: number;
  identity: number;
  styleAccuracy: number;
  rootIntegration: number;
  lightingConsistency: number;
  hairOnly: string;
  artifacts: string;
};

type FinalVerification = QaResult;

type ImageIntegrity = { canvasMatch: boolean } | null;

export function passesRndCombinedHardGate(input: {
  qa: QaResult;
  imageIntegrity: ImageIntegrity;
  finalVerification: FinalVerification | null;
}): boolean {
  const { qa, imageIntegrity, finalVerification } = input;
  return (
    qa.verdict === "APPROVE" &&
    qa.overall >= 9.5 &&
    qa.identity >= 9.5 &&
    qa.styleAccuracy >= 9.5 &&
    qa.rootIntegration >= 9.5 &&
    qa.lightingConsistency >= 9.5 &&
    qa.hairOnly === "PASS" &&
    qa.artifacts === "NONE" &&
    imageIntegrity !== null &&
    passesRndHardIntegrityGate(imageIntegrity) &&
    finalVerification?.verdict === "PASS" &&
    finalVerification.overall >= 9.5 &&
    finalVerification.identity >= 9.5 &&
    finalVerification.styleAccuracy >= 9.5 &&
    finalVerification.rootIntegration >= 9.5 &&
    finalVerification.lightingConsistency >= 9.5 &&
    finalVerification.hairOnly === "PASS" &&
    finalVerification.artifacts === "NONE"
  );
}
