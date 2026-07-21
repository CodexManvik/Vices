/**
 * textCleaner.ts
 *
 * Client-side shorthand normalizer.
 * Ports the SLANG_MAP structure from memory.py to TypeScript.
 * Applied to user input before network submission and before rendering.
 */

// ---------------------------------------------------------------------------
// SLANG_MAP — mirrors memory.py exactly (double-backslash for JS RegExp strings)
// ---------------------------------------------------------------------------

const SLANG_MAP: Record<string, string> = {
  "\\b2\\b": "to",
  "\\b4\\b": "for",
  "\\bu\\b": "you",
  "\\br\\b": "are",
  "\\bur\\b": "your",
  "\\bn\\b":  "and",
};

// Pre-compile patterns once at module load time for zero-overhead per-call.
const COMPILED_PATTERNS: Array<[RegExp, string]> = Object.entries(SLANG_MAP).map(
  ([pattern, replacement]) => [new RegExp(pattern, "gi"), replacement]
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expands common chat shorthand tokens to their full English equivalents.
 * Applies all replacements in a single pass per pattern (no multiple-pass loops).
 */
export function cleanClientShorthand(text: string): string {
  let result = text;
  for (const [pattern, replacement] of COMPILED_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
