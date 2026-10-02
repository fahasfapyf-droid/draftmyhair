export function deriveHairstyleAccuracy(input: {
  styleLengthAccuracy: number;
  styleSilhouetteAccuracy: number;
  styleWeightDistribution: number;
  stylePerimeterAccuracy: number;
  styleStylingAccuracy: number;
  styleRealism: number;
}) {
  return Number((
    input.styleLengthAccuracy * 0.20 +
    input.styleSilhouetteAccuracy * 0.25 +
    input.styleWeightDistribution * 0.15 +
    input.stylePerimeterAccuracy * 0.15 +
    input.styleStylingAccuracy * 0.15 +
    input.styleRealism * 0.10
  ).toFixed(2));
}

