import '@testing-library/jest-dom/vitest';

// Node exposes an unusable experimental localStorage global unless a backing file is
// configured. Provide the browser Storage contract explicitly for the jsdom tests.
const values = new Map<string, string>();
const testStorage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
};
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: testStorage,
});
