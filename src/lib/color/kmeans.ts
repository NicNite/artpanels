import type { Lab } from './cielab';

export type KmeansResult = {
  centroids: Lab[];
  assignments: number[];
};

function labDistance(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

function assignPoints(points: Lab[], centroids: Lab[]): number[] {
  return points.map((p) => {
    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < centroids.length; i++) {
      const d = labDistance(p, centroids[i]);
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    }
    return minIdx;
  });
}

function recomputeCentroids(points: Lab[], assignments: number[], k: number): Lab[] {
  const sums = Array.from({ length: k }, () => ({ L: 0, a: 0, b: 0, count: 0 }));

  for (let i = 0; i < points.length; i++) {
    const cluster = assignments[i];
    sums[cluster].L += points[i].L;
    sums[cluster].a += points[i].a;
    sums[cluster].b += points[i].b;
    sums[cluster].count++;
  }

  return sums.map((s) =>
    s.count > 0
      ? { L: s.L / s.count, a: s.a / s.count, b: s.b / s.count }
      : { L: 0, a: 0, b: 0 }
  );
}

function assignmentsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function kmeansLab(
  points: Lab[],
  k: number,
  maxIterations = 30
): KmeansResult {
  if (points.length === 0) {
    return { centroids: [], assignments: [] };
  }
  if (k >= points.length) {
    return {
      centroids: [...points],
      assignments: points.map((_, i) => i),
    };
  }

  // Initialize by spreading evenly through sorted points (by L)
  const sorted = [...points].sort((a, b) => a.L - b.L);
  const step = sorted.length / k;
  let centroids: Lab[] = Array.from({ length: k }, (_, i) => {
    const idx = Math.floor(i * step + step / 2);
    return { ...sorted[Math.min(idx, sorted.length - 1)] };
  });

  let assignments = assignPoints(points, centroids);

  for (let iter = 0; iter < maxIterations; iter++) {
    const newCentroids = recomputeCentroids(points, assignments, k);
    const newAssignments = assignPoints(points, newCentroids);

    if (assignmentsEqual(assignments, newAssignments)) {
      centroids = newCentroids;
      assignments = newAssignments;
      break;
    }

    centroids = newCentroids;
    assignments = newAssignments;
  }

  return { centroids, assignments };
}
