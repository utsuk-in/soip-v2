const store = new Map<string, { data: unknown; ts: number }>();

const DEFAULT_TTL = 5 * 60 * 1000;

export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
