export const normalizeText = value => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const STOP_TERMS = new Set(['파손', '고장', '불편', '문제', '발생', '신고', '수리', '위험', '시설', '보수', '교체', '계속']);
// Supplement both bundled and server dictionaries without requiring a DB migration.
const RELATED_TERMS = {
  ad: ['포스터', '불법 포스터', '광고지', '홍보물', '홍보 전단', '광고 포스터', '선정적인 광고', '음란 광고', '무단으로 붙인', '불법 부착물']
};
export const MAX_CATEGORY_CANDIDATES = 5;

export function characterFeatures(value) {
  const text = normalizeText(value), result = new Set();
  for (const width of [2, 3, 4]) {
    for (let i = 0; i <= text.length - width; i++) {
      const part = text.slice(i, i + width);
      if (!STOP_TERMS.has(part)) result.add(part);
    }
  }
  return result;
}

export function jaccardSimilarity(a, b) {
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (const [term, weight] of a) { normA += weight * weight; dot += weight * (b.get(term) || 0); }
  for (const weight of b.values()) normB += weight * weight;
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

const indexes = new WeakMap();
function indexCategories(categories) {
  if (indexes.has(categories)) return indexes.get(categories);
  const documents = categories.map(category => {
    const terms = [...new Set([...category.keywords, ...(RELATED_TERMS[category.id] || [])])]
      .filter(term => normalizeText(term).length >= 2 && !STOP_TERMS.has(normalizeText(term)));
    const features = new Set(terms.flatMap(term => [...characterFeatures(term)]));
    return { category, terms, features };
  });
  const df = new Map();
  for (const doc of documents) for (const feature of doc.features) df.set(feature, (df.get(feature) || 0) + 1);
  const idf = new Map([...df].map(([feature, count]) => [feature, 1 + Math.log((categories.length + 1) / (count + 1))]));
  for (const doc of documents) doc.vector = new Map([...doc.features].map(feature => [feature, idf.get(feature)]));
  const result = { documents, df, idf }; indexes.set(categories, result); return result;
}

export function rankCategories(text, categories) {
  const query = normalizeText(text);
  if (query.length < 2 || !categories.length) return { candidates: [], best: 0, scores: [] };
  const { documents, df, idf } = indexCategories(categories);
  const features = characterFeatures(query);
  // As in a fitted TF-IDF vectorizer, out-of-vocabulary features are not dimensions.
  // The evidence gate below separately rejects generic or unrelated inputs.
  const vector = new Map([...features].filter(feature => idf.has(feature)).map(feature => [feature, idf.get(feature)]));
  const scores = documents.map(doc => {
    const matches = doc.terms.filter(term => query.includes(normalizeText(term)))
      .sort((a,b) => normalizeText(b).length - normalizeText(a).length)
      .filter((term, i, terms) => !terms.slice(0, i).some(longer => normalizeText(longer).includes(normalizeText(term))));
    const shared = [...features].filter(f => doc.features.has(f));
    const distinctive = shared.filter(f => f.length >= 3 && df.get(f) <= Math.max(1, categories.length / 3));
    const cosine = cosineSimilarity(vector, doc.vector);
    const jaccard = jaccardSimilarity(features, doc.features);
    // One distinctive fragment is enough to offer a choice, even for a small dictionary.
    // Still require category-specific evidence instead of filling five unrelated slots.
    const supported = matches.length > 0 || (distinctive.length >= 1 && shared.length >= 2);
    // Partial fragments remain selectable, but explicit words are stronger evidence.
    const score = (0.7 * cosine + 0.3 * jaccard) * (matches.length ? 1 : 0.6);
    return { category: doc.category, matches, evidence: matches.length ? matches.slice(0, 3) : distinctive.sort((a,b) => b.length - a.length).slice(0, 3), cosine, jaccard, score, supported };
  }).sort((a,b) => b.score - a.score || a.category.id.localeCompare(b.category.id));
  const eligible = scores.filter(item => item.supported && (item.matches.length > 0 || item.score >= 0.01));
  const best = eligible[0]?.score || 0;
  const candidates = eligible.slice(0, MAX_CATEGORY_CANDIDATES);
  for (const item of candidates) {
    if (!item.matches.length) item.evidence = item.category.keywords
      .map(term => ({ term, value: jaccardSimilarity(features, characterFeatures(term)) }))
      .sort((a,b) => b.value - a.value).slice(0, 2).map(entry => entry.term);
  }
  return { candidates, best, scores };
}
