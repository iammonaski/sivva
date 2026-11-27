const stopWords = new Set(["a", "an", "and", "for", "in", "of", "on", "or", "the", "to", "with"]);

function words(text: string) {
  return text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

function normalize(word: string) {
  return word.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

export function topicMatcher(topicTitle: string) {
  const terms = new Map(words(topicTitle).map((word) => [normalize(word), word]));
  for (const word of stopWords) terms.delete(word);
  if (!terms.size) return null;

  const requiredMatches = Math.ceil((terms.size + 1) / 2);
  return (text: string) => {
    const found = new Set(words(text).map(normalize));
    const matches = [...terms].filter(([word]) => found.has(word)).map(([, original]) => original);
    return matches.length >= requiredMatches ? matches.map((term) => `“${term}”`).join(", ") : null;
  };
}
