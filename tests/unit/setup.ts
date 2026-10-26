// In-memory localStorage so the store's persistence runs under Node.
const data = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
  setItem: (k: string, v: string) => void data.set(k, String(v)),
  removeItem: (k: string) => void data.delete(k),
  clear: () => data.clear(),
  key: (i: number) => Array.from(data.keys())[i] ?? null,
  get length() {
    return data.size;
  }
};
