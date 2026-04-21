import * as schema from '../../../schema';

// Token values for type: spacing
type PlatformValues = { web: unknown; ios: unknown; android: unknown };

const VALUES: Record<string, PlatformValues> = {
  'spacing.0x': { web: "0rem", ios: {"value":0}, android: {"value":0} },
  'spacing.1x': { web: "0.125rem", ios: {"value":2}, android: {"value":2} },
  'spacing.2x': { web: "0.25rem", ios: {"value":4}, android: {"value":4} },
  'spacing.3x': { web: "0.375rem", ios: {"value":6}, android: {"value":6} },
  'spacing.4x': { web: "0.5rem", ios: {"value":8}, android: {"value":8} },
  'spacing.6x': { web: "0.75rem", ios: {"value":12}, android: {"value":12} },
  'spacing.8x': { web: "1rem", ios: {"value":16}, android: {"value":16} },
  'spacing.10x': { web: "1.25rem", ios: {"value":20}, android: {"value":20} },
  'spacing.12x': { web: "1.5rem", ios: {"value":24}, android: {"value":24} },
  'spacing.16x': { web: "2rem", ios: {"value":32}, android: {"value":32} },
  'spacing.20x': { web: "2.5rem", ios: {"value":40}, android: {"value":40} },
  'spacing.24x': { web: "3rem", ios: {"value":48}, android: {"value":48} },
  'spacing.32x': { web: "4rem", ios: {"value":64}, android: {"value":64} },
  'spacing.40x': { web: "5rem", ios: {"value":80}, android: {"value":80} },
  'spacing.60x': { web: "7.5rem", ios: {"value":120}, android: {"value":120} },
};

function wrapValue(val: unknown): unknown[] {
  return Array.isArray(val) ? val : [val];
}

export async function seedSpacingTokenValues(
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

  console.log(`    spacing: ${rows.length} rows`);
  return rows.length;
}