import * as schema from '../../schema';

// Token definitions per design system.
// Color/gradient tokens are stored WITHOUT dark./light. prefix (mode is in token_values).
// enabled is taken from the first tenant of each DS (sdds_cs for SDDS, plasma_web for PLASMA).
function tokenRows(designSystemId: string, enabledMap: Record<string, boolean>) {
  return [
    {
      designSystemId,
      name: 'text.default.primary',
      type: 'color' as const,
      displayName: 'onLightTextPrimary',
      description: 'Основной цвет текста',
      enabled: enabledMap['text.default.primary'],
    },
    {
      designSystemId,
      name: 'text.default.secondary',
      type: 'color' as const,
      displayName: 'textSecondary',
      description: 'Вторичный цвет текста',
      enabled: enabledMap['text.default.secondary'],
    },
    {
      designSystemId,
      name: 'text.default.accent',
      type: 'color' as const,
      displayName: 'textAccent',
      description: 'Акцентный цвет текста',
      enabled: enabledMap['text.default.accent'],
    },
    {
      designSystemId,
      name: 'text.default.accent-minor-gradient',
      type: 'gradient' as const,
      displayName: 'textAccentMinorGradient',
      description: 'Акцентный минорный цвет с градиентом',
      enabled: enabledMap['text.default.accent-minor-gradient'],
    },
    {
      designSystemId,
      name: 'text.default.primary-gradient',
      type: 'gradient' as const,
      displayName: 'textPrimaryGradient',
      description: 'Акцентный минорный цвет с градиентом',
      enabled: enabledMap['text.default.primary-gradient'],
    },
    {
      designSystemId,
      name: 'round.xxs',
      type: 'shape' as const,
      displayName: 'roundXxs',
      description: 'borderRadius xxs',
      enabled: true,
    },
    {
      designSystemId,
      name: 'round.xs',
      type: 'shape' as const,
      displayName: 'roundXs',
      description: 'borderRadius xs',
      enabled: true,
    },
    {
      designSystemId,
      name: 'round.circle',
      type: 'shape' as const,
      displayName: 'roundCircle',
      description: 'borderRadius circle',
      enabled: true,
    },
    {
      designSystemId,
      name: 'spacing.1x',
      type: 'spacing' as const,
      displayName: 'spacing1x',
      description: 'spacing 1x',
      enabled: true,
    },
    {
      designSystemId,
      name: 'spacing.2x',
      type: 'spacing' as const,
      displayName: 'spacing2x',
      description: 'spacing 2x',
      enabled: true,
    },
    {
      designSystemId,
      name: 'spacing.3x',
      type: 'spacing' as const,
      displayName: 'spacing3x',
      description: 'spacing 3x',
      enabled: true,
    },
    {
      designSystemId,
      name: 'up.hard.s',
      type: 'shadow' as const,
      displayName: 'upHardS',
      description: 'shadow up hard s',
      enabled: true,
    },
    {
      designSystemId,
      name: 'up.hard.m',
      type: 'shadow' as const,
      displayName: 'upHardM',
      description: 'shadow up hard m',
      enabled: true,
    },
    {
      designSystemId,
      name: 'screen-s.display.l.normal',
      type: 'typography' as const,
      displayName: 'DisplayL N',
      description: 'typography s display-l',
      enabled: true,
    },
    {
      designSystemId,
      name: 'screen-s.header.h2.normal',
      type: 'typography' as const,
      displayName: 'HeaderH2 N',
      description: 'typography s header-h2',
      enabled: true,
    },
    {
      designSystemId,
      name: 'display',
      type: 'fontFamily' as const,
      displayName: 'fontFamilyDisplay',
      description: 'fontFamily display',
      enabled: true,
    },
  ];
}

// Returns a Map from token name to token record for a given design system
function byName(rows: any[]) {
  const map: Record<string, any> = {};
  for (const r of rows) map[r.name] = r;
  return map;
}

export async function seedTokens(
  db: any,
  ctx: {
    designSystems: { sdds: any; plasma: any };
  },
) {
  const { sdds, plasma } = ctx.designSystems;

  // enabled from sdds_cs (first SDDS tenant)
  const sddsEnabled: Record<string, boolean> = {
    'text.default.primary': true,
    'text.default.secondary': false,
    'text.default.accent': true,
    'text.default.accent-minor-gradient': true,
    'text.default.primary-gradient': false,
  };

  // enabled from plasma_web (first PLASMA tenant)
  const plasmaEnabled: Record<string, boolean> = {
    'text.default.primary': true,
    'text.default.secondary': true,
    'text.default.accent': true,
    'text.default.accent-minor-gradient': true,
    'text.default.primary-gradient': false,
  };

  const sddsRows = await db
    .insert(schema.tokens)
    .values(tokenRows(sdds.id, sddsEnabled))
    .returning();

  const plasmaRows = await db
    .insert(schema.tokens)
    .values(tokenRows(plasma.id, plasmaEnabled))
    .returning();

  const sddsMap = byName(sddsRows);
  const plasmaMap = byName(plasmaRows);

  console.log(`  tokens: ${sddsRows.length} SDDS + ${plasmaRows.length} PLASMA`);
  return { sdds: sddsMap, plasma: plasmaMap };
}
