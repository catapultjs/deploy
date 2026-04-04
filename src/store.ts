const store = new Map<string, unknown>()

export function set(key: string, value: unknown): void {
  store.set(key, value)
}

export function get<T>(key: string, defaultValue?: T): T {
  return (store.has(key) ? store.get(key) : defaultValue) as T
}
