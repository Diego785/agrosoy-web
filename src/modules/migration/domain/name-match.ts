import { normalizeForComparison } from "@/shared/domain/text";

/** Edits between two words, stopping early once more than `limit`. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** Two words read as the same name: equal, or one letter apart in words of four letters or more. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 4 && distance(a, b, 1) <= 1;
}

const words = (name: string) =>
  normalizeForComparison(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1);

/**
 * Registered customers whose name the sheet's name could be a short or misspelled form of (D47):
 * every word of the sheet's name, two at least, matches a word of theirs. "Alexander Jimenez" finds
 * "Alexander Jimenez Montero", "Porfirio Martinez" finds "Porfidio Martinez", "Roberto Seña" finds
 * "Roberto Señas"; "Roberto Mamani" doesn't find "Hermogenes Mamani". Best matches first.
 */
export function similarCustomers<T extends { name: string }>(name: string, candidates: readonly T[]): T[] {
  const wanted = words(name);
  if (wanted.length < 2) return [];
  return candidates
    .map((candidate) => {
      const theirs = words(candidate.name);
      const matched = wanted.filter((word) => theirs.some((their) => sameWord(word, their)));
      const exact = wanted.filter((word) => theirs.includes(word)).length;
      return { candidate, matched: matched.length, exact, extra: theirs.length - matched.length };
    })
    .filter((match) => match.matched === wanted.length)
    .sort(
      (a, b) => b.exact - a.exact || a.extra - b.extra || a.candidate.name.localeCompare(b.candidate.name),
    )
    .map((match) => match.candidate);
}
