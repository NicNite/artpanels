import type { Lab } from "@/lib/color/cielab";
import { deltaE00 } from "@/lib/color/delta-e";
import { generateBayer, bayerThreshold } from "./bayer";

type BlockInput = {
  row: number;
  col: number;
  targetLab: Lab;
};

type BlockResult = {
  row: number;
  col: number;
  filamentId: string;
};

type XYDitherInput = {
  blocks: BlockInput[];
  filaments: { id: string; lab: Lab }[];
  bayerOrder: number;
};

function findTwoClosest(
  target: Lab,
  filaments: { id: string; lab: Lab }[]
): [
  { id: string; lab: Lab; deltaE: number },
  { id: string; lab: Lab; deltaE: number }
] {
  let best1 = { id: "", lab: target, deltaE: Infinity };
  let best2 = { id: "", lab: target, deltaE: Infinity };

  for (const f of filaments) {
    const de = deltaE00(target, f.lab);
    if (de < best1.deltaE) {
      best2 = best1;
      best1 = { id: f.id, lab: f.lab, deltaE: de };
    } else if (de < best2.deltaE) {
      best2 = { id: f.id, lab: f.lab, deltaE: de };
    }
  }

  return [best1, best2];
}

/**
 * Assign each block a filament color using Bayer-matrix ordered dithering.
 */
export function computeXYDither(input: XYDitherInput): BlockResult[] {
  const { blocks, filaments, bayerOrder } = input;
  const matrix = generateBayer(bayerOrder);

  return blocks.map((block) => {
    const [closest, secondClosest] = findTwoClosest(block.targetLab, filaments);

    if (closest.deltaE < 1 || secondClosest.deltaE === Infinity) {
      return { row: block.row, col: block.col, filamentId: closest.id };
    }

    const totalDeltaE = closest.deltaE + secondClosest.deltaE;
    const ratioClosest = 1 - closest.deltaE / totalDeltaE;

    const threshold = bayerThreshold(matrix, block.row, block.col);

    const filamentId =
      ratioClosest > threshold ? closest.id : secondClosest.id;

    return { row: block.row, col: block.col, filamentId };
  });
}
