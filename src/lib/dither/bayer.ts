/**
 * Generate a Bayer ordered-dithering threshold matrix.
 * @param order - recursion depth: 1→2×2, 2→4×4, 3→8×8
 * @returns 2D array of integer threshold values [0, size²-1]
 */
export function generateBayer(order: number): number[][] {
  if (order === 0) {
    return [[0]];
  }

  const prev = generateBayer(order - 1);
  const n = prev.length;
  const size = n * 2;
  const result: number[][] = Array.from({ length: size }, () =>
    Array(size).fill(0)
  );

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const val = prev[r][c] * 4;
      result[r][c] = val;             // top-left: 4*M
      result[r][c + n] = val + 2;     // top-right: 4*M + 2
      result[r + n][c] = val + 3;     // bottom-left: 4*M + 3
      result[r + n][c + n] = val + 1; // bottom-right: 4*M + 1
    }
  }

  return result;
}

/**
 * Get the normalized threshold [0, 1) for a position in the Bayer matrix.
 * Coordinates wrap modulo the matrix size.
 */
export function bayerThreshold(
  matrix: number[][],
  row: number,
  col: number
): number {
  const size = matrix.length;
  const r = ((row % size) + size) % size;
  const c = ((col % size) + size) % size;
  return (matrix[r][c] + 0.5) / (size * size);
}
