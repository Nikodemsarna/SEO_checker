function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;
  if (w.endsWith("e") && count > 1) count--;
  return Math.max(1, count);
}

export interface ReadabilityResult {
  fleschScore: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
}

/** Approximates Flesch Reading Ease (0-100, higher = easier to read). */
export function analyzeReadability(text: string): ReadabilityResult {
  const sentences = text.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter(Boolean);
  const words = text.match(/[A-Za-z''-]+/g) ?? [];

  if (words.length === 0 || sentences.length === 0) {
    return { fleschScore: 0, avgWordsPerSentence: 0, avgSyllablesPerWord: 0 };
  }

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  const fleschScore =
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

  return {
    fleschScore: Math.max(0, Math.min(100, Math.round(fleschScore))),
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
  };
}
