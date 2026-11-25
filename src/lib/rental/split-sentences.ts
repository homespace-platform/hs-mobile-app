// Port of hs-web-app lib/split-sentences.ts (verbatim; only import paths changed).
/** Split display text on period + whitespace only (";" is not a sentence end). Characters of each sentence are kept as-is. */
export function splitSentences(text: string): string[] {
  return text.split(/(?<=\.)\s+/).filter((s) => s.trim() !== '');
}
