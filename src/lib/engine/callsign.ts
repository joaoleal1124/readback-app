import type { Licence } from "./types";

/**
 * Radio callsign prefixes used in training.
 * Note: "Air Portugal" is the real radiotelephony callsign of TAP. Replace it with an
 * invented one (or get permission) before selling the product.
 */
export const CALLSIGN_PREFIX: Record<Licence, string> = {
  PPL: "Air Dream College",
  ATPL: "Air Portugal",
};

export function newCallsign(licence: Licence, random: () => number = Math.random): string {
  return `${CALLSIGN_PREFIX[licence]} ${100 + Math.floor(random() * 900)}`;
}
