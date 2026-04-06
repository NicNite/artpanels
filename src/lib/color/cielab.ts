export type Lab = { L: number; a: number; b: number };

// D65 reference white
const REF_X = 95.047;
const REF_Y = 100.0;
const REF_Z = 108.883;

function srgbToLinear(c: number): number {
  const n = c / 255;
  return n > 0.04045 ? Math.pow((n + 0.055) / 1.055, 2.4) : n / 12.92;
}

function linearToSrgb(c: number): number {
  const clamped = Math.max(0, Math.min(1, c));
  const srgb = clamped > 0.0031308
    ? 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
    : 12.92 * clamped;
  return Math.round(Math.max(0, Math.min(255, srgb * 255)));
}

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function labFInv(t: number): number {
  return t > 0.206897 ? t * t * t : (t - 16 / 116) / 7.787;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  // sRGB D65 linear RGB to XYZ matrix
  const X = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const Y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const Z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

  const fx = labF(X / REF_X * 100);
  const fy = labF(Y / REF_Y * 100);
  const fz = labF(Z / REF_Z * 100);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labToRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const X = labFInv(fx) * REF_X / 100;
  const Y = labFInv(fy) * REF_Y / 100;
  const Z = labFInv(fz) * REF_Z / 100;

  // XYZ to linear sRGB (D65) inverse matrix
  const rl =  X * 3.2404542 - Y * 1.5371385 - Z * 0.4985314;
  const gl = -X * 0.9692660 + Y * 1.8760108 + Z * 0.0415560;
  const bl =  X * 0.0556434 - Y * 0.2040259 + Z * 1.0572252;

  return {
    r: linearToSrgb(rl),
    g: linearToSrgb(gl),
    b: linearToSrgb(bl),
  };
}
