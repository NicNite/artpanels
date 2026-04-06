import { describe, it, expect } from 'vitest';
import { deltaE00 } from '@/lib/color/delta-e';
import { rgbToLab } from '@/lib/color/cielab';

describe('deltaE00', () => {
  it('returns 0 for identical colors', () => {
    const lab = rgbToLab(100, 150, 200);
    expect(deltaE00(lab, lab)).toBe(0);
  });

  it('returns 0 for identical Lab values directly', () => {
    const lab = { L: 50, a: 20, b: -10 };
    expect(deltaE00(lab, lab)).toBe(0);
  });

  it('returns a small value for very similar colors', () => {
    const lab1 = rgbToLab(100, 100, 100);
    const lab2 = rgbToLab(102, 102, 102);
    const de = deltaE00(lab1, lab2);
    expect(de).toBeGreaterThan(0);
    expect(de).toBeLessThan(3);
  });

  it('returns a large value for black vs white (>50)', () => {
    const black = rgbToLab(0, 0, 0);
    const white = rgbToLab(255, 255, 255);
    expect(deltaE00(black, white)).toBeGreaterThan(50);
  });

  it('is symmetric: deltaE(a,b) === deltaE(b,a)', () => {
    const lab1 = rgbToLab(200, 50, 80);
    const lab2 = rgbToLab(30, 180, 120);
    expect(deltaE00(lab1, lab2)).toBeCloseTo(deltaE00(lab2, lab1), 10);
  });

  it('returns a large value for very different colors', () => {
    const red = rgbToLab(255, 0, 0);
    const blue = rgbToLab(0, 0, 255);
    expect(deltaE00(red, blue)).toBeGreaterThan(10);
  });
});
