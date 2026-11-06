/**
 * Helpers for the silly text. The text itself lives in `src/locales/` (one file per
 * language) and is read through `t()` from `src/i18n.ts`.
 */

import type { EffectKind } from './warp';

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** A camera pose challenge: the pose asked for and the effect that plays right after the photo. */
export interface PoseChallenge {
  prompt: string;
  effect: EffectKind;
}
