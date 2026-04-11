import type { LayerColorMap, CostEstimate } from "./types";

const PURGE_GRAMS_PER_SWAP = 0.5;
const SECONDS_PER_SWAP = 2;

export function estimateCost(layers: LayerColorMap): CostEstimate {
  let totalSwaps = 0;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const uniqueFilaments = new Set(layer.blocks.map((b) => b.filamentId));
    const withinLayerSwaps = Math.max(0, uniqueFilaments.size - 1);
    totalSwaps += withinLayerSwaps;

    if (i > 0) {
      const prevFilaments = new Set(layers[i - 1].blocks.map((b) => b.filamentId));
      if (prevFilaments.size === 1 && uniqueFilaments.size === 1) {
        const prevId = [...prevFilaments][0];
        const currId = [...uniqueFilaments][0];
        if (prevId !== currId) {
          totalSwaps += 1;
        }
      }
    }
  }

  return {
    filamentSwaps: totalSwaps,
    purgeWasteGrams: totalSwaps * PURGE_GRAMS_PER_SWAP,
    timeOverheadMinutes: (totalSwaps * SECONDS_PER_SWAP) / 60,
  };
}
