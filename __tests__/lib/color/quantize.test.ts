import { describe, it, expect } from 'vitest';
import {
  quantizeAndMatch,
  hexToRgb,
  rgbToHex,
  type Pixel,
  type FilamentRef,
} from '@/lib/color/quantize';

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('parses 3-digit hex shorthand', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('rgbToHex', () => {
  it('converts to lowercase hex with # prefix', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('clamps out-of-range values', () => {
    expect(rgbToHex(300, -10, 128)).toBe('#ff0080');
  });
});

describe('quantizeAndMatch', () => {
  it('returns empty mappings for empty pixels', () => {
    const result = quantizeAndMatch([], 2, [{ id: 'f1', hexColor: '#ff0000' }]);
    expect(result.mappings).toHaveLength(0);
    expect(result.assignments).toHaveLength(0);
  });

  it('returns empty mappings for empty filaments', () => {
    const result = quantizeAndMatch([{ r: 255, g: 0, b: 0 }], 2, []);
    expect(result.mappings).toHaveLength(0);
    expect(result.assignments).toHaveLength(0);
  });

  it('matches 2 red-ish pixels + 2 blue-ish pixels to red and blue filaments', () => {
    const pixels: Pixel[] = [
      { r: 220, g: 30, b: 30 },   // red-ish
      { r: 200, g: 20, b: 20 },   // red-ish
      { r: 20, g: 30, b: 210 },   // blue-ish
      { r: 10, g: 20, b: 220 },   // blue-ish
    ];

    const filaments: FilamentRef[] = [
      { id: 'red', hexColor: '#ff0000' },
      { id: 'blue', hexColor: '#0000ff' },
      { id: 'green', hexColor: '#00ff00' },
    ];

    const result = quantizeAndMatch(pixels, 2, filaments);

    // Should produce 2 mappings
    expect(result.mappings).toHaveLength(2);

    // All pixels should have assignments
    expect(result.assignments).toHaveLength(4);

    // Collect matched filament IDs
    const matchedIds = new Set(result.mappings.map((m) => m.filamentId));

    // Should match red and blue (not green)
    expect(matchedIds.has('red')).toBe(true);
    expect(matchedIds.has('blue')).toBe(true);
    expect(matchedIds.has('green')).toBe(false);
  });

  it('each mapping has required fields', () => {
    const pixels: Pixel[] = [{ r: 255, g: 0, b: 0 }];
    const filaments: FilamentRef[] = [{ id: 'red', hexColor: '#ff0000' }];

    const result = quantizeAndMatch(pixels, 1, filaments);
    expect(result.mappings).toHaveLength(1);

    const mapping = result.mappings[0];
    expect(mapping).toHaveProperty('sourceRgb');
    expect(mapping).toHaveProperty('sourceLab');
    expect(mapping).toHaveProperty('filamentId');
    expect(mapping).toHaveProperty('targetRgb');
    expect(mapping).toHaveProperty('deltaE');
    expect(typeof mapping.deltaE).toBe('number');
    expect(mapping.deltaE).toBeGreaterThanOrEqual(0);
  });

  it('assignments are all valid mapping indices', () => {
    const pixels: Pixel[] = [
      { r: 255, g: 0, b: 0 },
      { r: 200, g: 0, b: 0 },
      { r: 0, g: 0, b: 255 },
    ];
    const filaments: FilamentRef[] = [
      { id: 'red', hexColor: '#ff0000' },
      { id: 'blue', hexColor: '#0000ff' },
    ];

    const result = quantizeAndMatch(pixels, 2, filaments);
    expect(result.assignments).toHaveLength(3);
    for (const a of result.assignments) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(result.mappings.length);
    }
  });
});
