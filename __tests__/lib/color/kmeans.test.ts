import { describe, it, expect } from 'vitest';
import { kmeansLab } from '@/lib/color/kmeans';
import type { Lab } from '@/lib/color/cielab';

describe('kmeansLab', () => {
  it('returns empty result for empty input', () => {
    const result = kmeansLab([], 2);
    expect(result.centroids).toHaveLength(0);
    expect(result.assignments).toHaveLength(0);
  });

  it('assigns all points (assignments.length === points.length)', () => {
    const points: Lab[] = Array.from({ length: 10 }, (_, i) => ({
      L: i * 10,
      a: 0,
      b: 0,
    }));
    const result = kmeansLab(points, 3);
    expect(result.assignments).toHaveLength(points.length);
  });

  it('all assignments are valid cluster indices (0 to k-1)', () => {
    const points: Lab[] = Array.from({ length: 20 }, (_, i) => ({
      L: Math.random() * 100,
      a: Math.random() * 20 - 10,
      b: Math.random() * 20 - 10,
    }));
    const k = 4;
    const result = kmeansLab(points, k);
    for (const assignment of result.assignments) {
      expect(assignment).toBeGreaterThanOrEqual(0);
      expect(assignment).toBeLessThan(k);
    }
  });

  it('correctly separates two distinct groups (L≈90 vs L≈10) with k=2', () => {
    // Group A: high L (bright)
    const brightPoints: Lab[] = Array.from({ length: 5 }, () => ({
      L: 90 + Math.random() * 5,
      a: 0,
      b: 0,
    }));
    // Group B: low L (dark)
    const darkPoints: Lab[] = Array.from({ length: 5 }, () => ({
      L: 10 + Math.random() * 5,
      a: 0,
      b: 0,
    }));

    const points = [...brightPoints, ...darkPoints];
    const result = kmeansLab(points, 2);

    // All bright points should share the same cluster
    const brightClusters = new Set(result.assignments.slice(0, 5));
    const darkClusters = new Set(result.assignments.slice(5, 10));

    expect(brightClusters.size).toBe(1);
    expect(darkClusters.size).toBe(1);

    // The two groups should be in different clusters
    const brightCluster = result.assignments[0];
    const darkCluster = result.assignments[5];
    expect(brightCluster).not.toBe(darkCluster);
  });

  it('returns k centroids', () => {
    const points: Lab[] = Array.from({ length: 20 }, (_, i) => ({
      L: i * 5,
      a: 0,
      b: 0,
    }));
    const result = kmeansLab(points, 3);
    expect(result.centroids).toHaveLength(3);
  });

  it('handles k >= points.length', () => {
    const points: Lab[] = [
      { L: 10, a: 0, b: 0 },
      { L: 90, a: 0, b: 0 },
    ];
    const result = kmeansLab(points, 5);
    expect(result.centroids).toHaveLength(2);
    expect(result.assignments).toHaveLength(2);
  });

  it('respects maxIterations parameter', () => {
    const points: Lab[] = Array.from({ length: 20 }, (_, i) => ({
      L: i * 5,
      a: 0,
      b: 0,
    }));
    // Should not throw with very small maxIterations
    const result = kmeansLab(points, 3, 1);
    expect(result.assignments).toHaveLength(points.length);
  });
});
