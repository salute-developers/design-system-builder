import * as schema from '../../../schema';

// Token values for type: shadow
type PlatformValues = { web: unknown; ios: unknown; android: unknown };

const VALUES: Record<string, PlatformValues> = {
  'down.soft.s': { web: ["0rem 0.25rem 0.875rem -0.25rem #08080814","0rem 0.0625rem 0.25rem -0.0625rem #0000000A"], ios: [{"color":"#08080814","offsetX":0,"offsetY":4,"spreadRadius":-4,"blurRadius":14},{"color":"#0000000A","offsetX":0,"offsetY":1,"spreadRadius":-1,"blurRadius":4}], android: [{"color":"#08080814","offsetX":0,"offsetY":4,"spreadRadius":-4,"blurRadius":14,"fallbackElevation":2},{"color":"#0000000A","offsetX":0,"offsetY":1,"spreadRadius":-1,"blurRadius":4,"fallbackElevation":0}] },
  'down.soft.m': { web: ["0rem 1.5rem 3rem -0.5rem #00000014"], ios: [{"color":"#00000014","offsetX":0,"offsetY":24,"spreadRadius":-8,"blurRadius":48}], android: [{"color":"#00000014","offsetX":0,"offsetY":24,"spreadRadius":-8,"blurRadius":48,"fallbackElevation":4}] },
  'down.soft.l': { web: ["0rem 3.75rem 7rem -0.5rem #00000014"], ios: [{"color":"#00000014","offsetX":0,"offsetY":60,"spreadRadius":-8,"blurRadius":112}], android: [{"color":"#00000014","offsetX":0,"offsetY":60,"spreadRadius":-8,"blurRadius":112,"fallbackElevation":6}] },
  'down.hard.s': { web: ["0rem 0.25rem 0.75rem -0.1875rem #08080829","0rem 0.0625rem 0.25rem -0.125rem #00000014"], ios: [{"color":"#08080829","offsetX":0,"offsetY":4,"spreadRadius":-3,"blurRadius":12},{"color":"#00000014","offsetX":0,"offsetY":1,"spreadRadius":-2,"blurRadius":4}], android: [{"color":"#08080829","offsetX":0,"offsetY":4,"spreadRadius":-3,"blurRadius":12,"fallbackElevation":2},{"color":"#00000014","offsetX":0,"offsetY":1,"spreadRadius":-2,"blurRadius":4,"fallbackElevation":0}] },
  'down.hard.m': { web: ["0rem 1rem 2rem -0.5rem #0000003D"], ios: [{"color":"#0000003D","offsetX":0,"offsetY":16,"spreadRadius":-8,"blurRadius":32}], android: [{"color":"#0000003D","offsetX":0,"offsetY":16,"spreadRadius":-8,"blurRadius":32,"fallbackElevation":4}] },
  'down.hard.l': { web: ["0rem 3.75rem 7rem -0.5rem #00000066"], ios: [{"color":"#00000066","offsetX":0,"offsetY":60,"spreadRadius":-8,"blurRadius":112}], android: [{"color":"#00000066","offsetX":0,"offsetY":60,"spreadRadius":-8,"blurRadius":112,"fallbackElevation":6}] },
  'up.soft.s': { web: ["0rem -0.25rem 0.875rem -0.25rem #08080814","0rem -0.0625rem 0.25rem -0.0625rem #00000008"], ios: [{"color":"#08080814","offsetX":0,"offsetY":-4,"spreadRadius":-4,"blurRadius":14},{"color":"#00000008","offsetX":0,"offsetY":-1,"spreadRadius":-1,"blurRadius":4}], android: [{"color":"#08080814","offsetX":0,"offsetY":-4,"spreadRadius":-4,"blurRadius":14,"fallbackElevation":0},{"color":"#00000008","offsetX":0,"offsetY":-1,"spreadRadius":-1,"blurRadius":4,"fallbackElevation":0}] },
  'up.soft.m': { web: ["0rem -1.5rem 3rem -0.5rem #00000014"], ios: [{"color":"#00000014","offsetX":0,"offsetY":-24,"spreadRadius":-8,"blurRadius":48}], android: [{"color":"#00000014","offsetX":0,"offsetY":-24,"spreadRadius":-8,"blurRadius":48,"fallbackElevation":0}] },
  'up.soft.l': { web: ["0rem -3.75rem 7rem -0.5rem #00000014"], ios: [{"color":"#00000014","offsetX":0,"offsetY":-60,"spreadRadius":-8,"blurRadius":112}], android: [{"color":"#00000014","offsetX":0,"offsetY":-60,"spreadRadius":-8,"blurRadius":112,"fallbackElevation":0}] },
  'up.hard.s': { web: ["0rem -0.25rem 0.75rem -0.1875rem #08080833","0rem -0.0625rem 0.25rem -0.0625rem #00000008"], ios: [{"color":"#08080833","offsetX":0,"offsetY":-4,"spreadRadius":-3,"blurRadius":12},{"color":"#00000008","offsetX":0,"offsetY":-1,"spreadRadius":-1,"blurRadius":4}], android: [{"color":"#08080833","offsetX":0,"offsetY":-4,"spreadRadius":-3,"blurRadius":12,"fallbackElevation":0},{"color":"#00000008","offsetX":0,"offsetY":-1,"spreadRadius":-1,"blurRadius":4,"fallbackElevation":0}] },
  'up.hard.m': { web: ["0rem -1rem 2rem -0.5rem #0000003D"], ios: [{"color":"#0000003D","offsetX":0,"offsetY":-16,"spreadRadius":-8,"blurRadius":32}], android: [{"color":"#0000003D","offsetX":0,"offsetY":-16,"spreadRadius":-8,"blurRadius":32,"fallbackElevation":0}] },
  'up.hard.l': { web: ["0rem -3.75rem 7rem -0.5rem #00000066"], ios: [{"color":"#00000066","offsetX":0,"offsetY":-60,"spreadRadius":-8,"blurRadius":112}], android: [{"color":"#00000066","offsetX":0,"offsetY":-60,"spreadRadius":-8,"blurRadius":112,"fallbackElevation":0}] },
};

function wrapValue(val: unknown): unknown[] {
  return Array.isArray(val) ? val : [val];
}

export async function seedShadowTokenValues(
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

  console.log(`    shadow: ${rows.length} rows`);
  return rows.length;
}