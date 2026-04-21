import * as schema from '../../../schema';

// Token values for type: shape
type PlatformValues = { web: unknown; ios: unknown; android: unknown };

const VALUES: Record<string, PlatformValues> = {
  'round.xxs': { web: "0.25rem", ios: {"kind":"round","cornerRadius":4}, android: {"kind":"round","cornerRadius":4} },
  'round.xs': { web: "0.375rem", ios: {"kind":"round","cornerRadius":6}, android: {"kind":"round","cornerRadius":6} },
  'round.s': { web: "0.5rem", ios: {"kind":"round","cornerRadius":8}, android: {"kind":"round","cornerRadius":8} },
  'round.m': { web: "0.75rem", ios: {"kind":"round","cornerRadius":12}, android: {"kind":"round","cornerRadius":12} },
  'round.l': { web: "1rem", ios: {"kind":"round","cornerRadius":16}, android: {"kind":"round","cornerRadius":16} },
  'round.xl': { web: "1.25rem", ios: {"kind":"round","cornerRadius":20}, android: {"kind":"round","cornerRadius":20} },
  'round.xxl': { web: "2rem", ios: {"kind":"round","cornerRadius":32}, android: {"kind":"round","cornerRadius":32} },
  'round.circle': { web: "625rem", ios: {"kind":"round","cornerRadius":9999}, android: {"kind":"round","cornerRadius":9999} },
};

function wrapValue(val: unknown): unknown[] {
  return Array.isArray(val) ? val : [val];
}

export async function seedShapeTokenValues(
  db: any,
  tokenMap: Record<string, any>,
  tenantId: string,
) {
  const platforms = ['web', 'ios', 'android'] as const;
  const rows: any[] = [];

  for (const [name, vals] of Object.entries(VALUES)) {
    const token = tokenMap[name];
    if (!token) continue;
    for (const platform of platforms) {
      rows.push({ tokenId: token.id, tenantId, platform, value: wrapValue(vals[platform]), paletteId: null });
    }
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await db.insert(schema.tokenValues).values(rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`    shape: ${rows.length} rows`);
  return rows.length;
}