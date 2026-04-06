import type { Lab } from './cielab';

/**
 * CIEDE2000 color difference formula.
 * Returns the perceptual color difference between two CIELAB colors.
 */
export function deltaE00(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  // Step 1: Calculate C'ab
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  // Step 2: Calculate h'
  function hPrime(ap: number, bp: number): number {
    if (ap === 0 && bp === 0) return 0;
    const h = Math.atan2(bp, ap) * (180 / Math.PI);
    return h < 0 ? h + 360 : h;
  }

  const h1p = hPrime(a1p, b1);
  const h2p = hPrime(a2p, b2);

  // Step 3: Calculate delta L', delta C', delta H'
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * (Math.PI / 180));

  // Step 4: Calculate CIEDE2000
  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let Hbarp: number;
  if (C1p * C2p === 0) {
    Hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    Hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    Hbarp = (h1p + h2p + 360) / 2;
  } else {
    Hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((Hbarp - 30) * (Math.PI / 180)) +
    0.24 * Math.cos(2 * Hbarp * (Math.PI / 180)) +
    0.32 * Math.cos((3 * Hbarp + 6) * (Math.PI / 180)) -
    0.20 * Math.cos((4 * Hbarp - 63) * (Math.PI / 180));

  const SL = 1 + 0.015 * Math.pow(Lbar - 50, 2) / Math.sqrt(20 + Math.pow(Lbar - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;

  const Cbarp7 = Math.pow(Cbarp, 7);
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const dTheta = 30 * Math.exp(-Math.pow((Hbarp - 275) / 25, 2));
  const RT = -Math.sin(2 * dTheta * (Math.PI / 180)) * RC;

  return Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );
}
