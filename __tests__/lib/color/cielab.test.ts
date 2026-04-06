import { describe, it, expect } from 'vitest';
import { rgbToLab, labToRgb } from '@/lib/color/cielab';

describe('rgbToLab', () => {
  it('converts white (255,255,255) to L≈100, a≈0, b≈0', () => {
    const lab = rgbToLab(255, 255, 255);
    expect(lab.L).toBeCloseTo(100, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it('converts black (0,0,0) to L≈0', () => {
    const lab = rgbToLab(0, 0, 0);
    expect(lab.L).toBeCloseTo(0, 0);
  });

  it('converts a mid-gray to reasonable L', () => {
    const lab = rgbToLab(128, 128, 128);
    expect(lab.L).toBeGreaterThan(40);
    expect(lab.L).toBeLessThan(60);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it('converts red (255,0,0) to high a* value', () => {
    const lab = rgbToLab(255, 0, 0);
    expect(lab.a).toBeGreaterThan(50);
  });

  it('converts blue (0,0,255) to negative b* value', () => {
    const lab = rgbToLab(0, 0, 255);
    expect(lab.b).toBeLessThan(-50);
  });
});

describe('labToRgb', () => {
  it('converts white Lab back to (255,255,255)', () => {
    const { r, g, b } = labToRgb(100, 0, 0);
    expect(r).toBeCloseTo(255, -1);
    expect(g).toBeCloseTo(255, -1);
    expect(b).toBeCloseTo(255, -1);
  });

  it('converts black Lab back to (0,0,0)', () => {
    const { r, g, b } = labToRgb(0, 0, 0);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
});

describe('round-trip rgb→lab→rgb', () => {
  const testCases: Array<[number, number, number]> = [
    [255, 255, 255],
    [0, 0, 0],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [128, 64, 192],
    [200, 150, 100],
  ];

  for (const [r, g, b] of testCases) {
    it(`round-trips (${r},${g},${b}) within 1 unit`, () => {
      const lab = rgbToLab(r, g, b);
      const result = labToRgb(lab.L, lab.a, lab.b);
      expect(result.r).toBeCloseTo(r, -1);
      expect(result.g).toBeCloseTo(g, -1);
      expect(result.b).toBeCloseTo(b, -1);
    });
  }
});
