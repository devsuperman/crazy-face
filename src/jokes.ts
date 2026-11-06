/**
 * Helpers for the silly text. The text itself lives in `src/locales/` (one file per
 * language) and is read through `t()` from `src/i18n.ts`.
 */

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

