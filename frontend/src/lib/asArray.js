/**
 * Coerce anything a list query might hand back into a real array.
 *
 * Why this exists: React Query's cache is persisted to localStorage, so a value
 * saved by an older build is restored straight into the query on the next load —
 * it never passes through queryFn. Normalising inside the fetcher therefore only
 * protects fresh responses; a stale cached object still reaches the component
 * and `.filter` throws, blanking the page.
 *
 * Normalising at the point of use covers every source: fresh fetch, restored
 * cache, and error payloads like {error: "..."}.
 */
export default function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    // Paginated envelope: {data: [...], total, page, limit}
    for (const key of ['data', 'items', 'results', 'rows']) {
      if (Array.isArray(value[key])) return value[key];
    }
  }
  return [];
}
