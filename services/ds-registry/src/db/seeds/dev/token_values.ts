import { and, eq } from 'drizzle-orm';
import * as schema from '../../schema';

async function resolvePaletteRef(db: any, ref: string): Promise<{ id: string; value: string }> {
  const [type, shade, saturation] = ref.split('.');
  const [row] = await db
    .select({ id: schema.palette.id, value: schema.palette.value })
    .from(schema.palette)
    .where(
      and(
        eq(schema.palette.type, type as 'general' | 'additional'),
        eq(schema.palette.shade, shade),
        eq(schema.palette.saturation, Number(saturation)),
      ),
    )
    .limit(1);
  if (!row) throw new Error(`Unknown palette reference: ${ref}`);
  return row;
}

// Each entry → 3 rows (web, ios, android)
type TokenPlatformValues = {
  web: unknown[];
  ios: unknown[];
  android: unknown[];
};

type Mode = 'dark' | 'light' | null;

// Color/gradient token names in data have dark./light. prefix.
// The prefix determines mode; the stripped name is used for token lookup.
const COLOR_GRADIENT_PREFIX = /^(dark|light)\./;

function isColorGradientKey(name: string): boolean {
  return COLOR_GRADIENT_PREFIX.test(name);
}

function deriveMode(name: string): Mode {
  if (name.startsWith('light.')) return 'light';
  if (name.startsWith('dark.')) return 'dark';
  return null;
}

function stripPrefix(name: string): string {
  return name.replace(COLOR_GRADIENT_PREFIX, '');
}

function tv(
  tokenMap: Record<string, any>,
  tenantId: string,
  tokenName: string,
  mode: Mode,
  vals: TokenPlatformValues,
  paletteId?: string,
) {
  const token = tokenMap[tokenName];
  if (!token) return [];
  return [
    { tokenId: token.id, tenantId, platform: 'web' as const, mode, value: paletteId ? null : vals.web, paletteId: paletteId ?? null },
    { tokenId: token.id, tenantId, platform: 'ios' as const, mode, value: paletteId ? null : vals.ios, paletteId: paletteId ?? null },
    { tokenId: token.id, tenantId, platform: 'android' as const, mode, value: paletteId ? null : vals.android, paletteId: paletteId ?? null },
  ];
}

function sddsDisplayFontWeb(name: string) {
  return [{
    name,
    fonts: [
      { src: ["url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Light.woff2') format('woff2')"], fontWeight: '300', fontStyle: 'normal' },
      { src: ["url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.woff2') format('woff2')"], fontWeight: 'normal', fontStyle: 'normal' },
      { src: ["url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.woff2') format('woff2')"], fontWeight: '600', fontStyle: 'normal' },
      { src: ["url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.woff2') format('woff2')"], fontWeight: 'bold', fontStyle: 'normal' },
    ],
  }];
}

function sddsDisplayFontIos(name: string) {
  return [{
    name,
    fonts: [
      { link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Light.otf', weight: 'light', style: 'normal' },
      { link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.otf', weight: 'regular', style: 'normal' },
      { link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.otf', weight: 'semibold', style: 'normal' },
      { link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.otf', weight: 'bold', style: 'normal' },
    ],
  }];
}

function sddsDisplayFontAndroid(name: string) {
  return [{
    name,
    fonts: [
      { link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Light.otf', fontWeight: 300, fontStyle: 'normal' },
      { link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.otf', fontWeight: 400, fontStyle: 'normal' },
      { link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.otf', fontWeight: 600, fontStyle: 'normal' },
      { link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.otf', fontWeight: 700, fontStyle: 'normal' },
    ],
  }];
}

function buildTenantRows(
  tokenMap: Record<string, any>,
  tenantId: string,
  data: Record<string, TokenPlatformValues>,
  paletteMap?: Record<string, string>,
) {
  return Object.entries(data).flatMap(([name, vals]) => {
    const mode = deriveMode(name);
    const tokenName = stripPrefix(name);
    return tv(tokenMap, tenantId, tokenName, mode, vals, paletteMap?.[name]);
  });
}

export async function seedTokenValues(
  db: any,
  ctx: {
    tokens: { sdds: Record<string, any>; plasma: Record<string, any> };
    tenants: { sddsCe: any; sddsServ: any; plasmaWeb: any; plasmaGiga: any };
  },
) {
  const { sdds: sddsTokens, plasma: plasmaTokens } = ctx.tokens;
  const { sddsCe, sddsServ, plasmaWeb, plasmaGiga } = ctx.tenants;

  // Resolve palette references from DB
  const [blue500, green500, red500, pink500] = await Promise.all([
    resolvePaletteRef(db, 'general.blue.500'),
    resolvePaletteRef(db, 'general.green.500'),
    resolvePaletteRef(db, 'general.red.500'),
    resolvePaletteRef(db, 'general.pink.500'),
  ]);

  // ── sdds_cs ────────────────────────────────────────────────────────────────
  const sddsCsData: Record<string, TokenPlatformValues> = {
    // Color/gradient: dark mode
    'dark.text.default.primary': { web: [blue500.value], ios: [blue500.value], android: [blue500.value] },
    'dark.text.default.secondary': { web: ['#1a0f24'], ios: ['#1a0f24'], android: ['#1a0f24'] },
    'dark.text.default.accent': { web: ['#0095ff'], ios: ['#0095ff'], android: ['#0095ff'] },
    'dark.text.default.accent-minor-gradient': {
      web: ['linear-gradient(45.00deg, #1A9E32FF 0%, #04C6C9FF 99.688%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#FFFFFF', '#000000'], angle: 90 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#FFFFFF', '#000000'], angle: 90 }],
    },
    'dark.text.default.primary-gradient': {
      web: ['linear-gradient(45.00deg, rgb(185, 9, 185) 0%, rgb(138, 218, 0) 99.688%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#c32525', '#000000'], angle: 90 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#27d7e1', '#000000'], angle: 90 }],
    },
    // Color/gradient: light mode
    'light.text.default.primary': { web: ['#171717F5'], ios: ['#171717F5'], android: ['#171717F5'] },
    'light.text.default.secondary': { web: ['#1717178F'], ios: ['#1717178F'], android: ['#1717178F'] },
    'light.text.default.accent': { web: ['#0084E6'], ios: ['#0084E6'], android: ['#0084E6'] },
    'light.text.default.accent-minor-gradient': {
      web: ['linear-gradient(45.00deg, #15802AFF 0%, #039EA0FF 99.688%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#15802A', '#039EA0'], angle: 90 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#15802A', '#039EA0'], angle: 90 }],
    },
    'light.text.default.primary-gradient': {
      web: ['linear-gradient(45.00deg, rgb(148, 7, 148) 0%, rgb(110, 174, 0) 99.688%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#9C1E1E', '#000000'], angle: 90 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#1FACB4', '#000000'], angle: 90 }],
    },
    // Non-color/gradient: mode = null
    'round.xxs': { web: ['4'], ios: [{ kind: 'round', cornerRadius: 4 }], android: [{ kind: 'round', cornerRadius: 4 }] },
    'round.xs': { web: ['6'], ios: [{ kind: 'round', cornerRadius: 6 }], android: [{ kind: 'round', cornerRadius: 6 }] },
    'round.circle': { web: ['999'], ios: [{ kind: 'round', cornerRadius: 999 }], android: [{ kind: 'round', cornerRadius: 999 }] },
    'spacing.1x': { web: ['2'], ios: [{ value: 2 }], android: [{ value: 2 }] },
    'spacing.2x': { web: ['4'], ios: [{ value: 4 }], android: [{ value: 4 }] },
    'spacing.3x': { web: ['6'], ios: [{ value: 6 }], android: [{ value: 6 }] },
    'up.hard.s': {
      web: ['0rem 1.5rem 3rem -0.5rem #00000014'],
      ios: [{ color: '#00000014', offsetX: 0, offsetY: 24, spreadRadius: -8, blurRadius: 48 }],
      android: [{ color: '#00000014', offsetX: 0, offsetY: 24, spreadRadius: -8, blurRadius: 48, fallbackElevation: 4 }],
    },
    'up.hard.m': {
      web: ['1rem 1.5rem 3rem -0.5rem #e21111b9'],
      ios: [{ color: '#bb202086', offsetX: 0, offsetY: 32, spreadRadius: -8, blurRadius: 48 }],
      android: [{ color: '#046f43dd', offsetX: 0, offsetY: 32, spreadRadius: -8, blurRadius: 48, fallbackElevation: 4 }],
    },
    'screen-s.display.l.normal': {
      web: [{ fontFamilyRef: 'fontFamily.display', fontWeight: 600, fontStyle: 'normal', textSize: 88, lineHeight: 92, letterSpacing: 0 }],
      ios: [{ fontFamilyRef: 'fontFamily.display', weight: 'light', style: 'normal', size: 56, lineHeight: 62, kerning: 0 }],
      android: [{ fontFamilyRef: 'fontFamily.display', fontWeight: '300', fontStyle: 'normal', fontSize: '3.5rem', lineHeight: '3.875rem', letterSpacing: 'normal' }],
    },
    'screen-s.header.h2.normal': {
      web: [{ fontFamilyRef: 'fontFamily.display', fontWeight: 600, fontStyle: 'normal', textSize: 32, lineHeight: 40, letterSpacing: 0 }],
      ios: [{ fontFamilyRef: 'fontFamily.display', weight: 'light', style: 'normal', size: 32, lineHeight: 40, kerning: 0 }],
      android: [{ fontFamilyRef: 'fontFamily.display', fontWeight: '300', fontStyle: 'normal', fontSize: '32', lineHeight: '40', letterSpacing: 'normal' }],
    },
    'display': {
      web: sddsDisplayFontWeb('SB Sans Display'),
      ios: sddsDisplayFontIos('SB Sans Display'),
      android: sddsDisplayFontAndroid('SB Sans Display'),
    },
  };

  // ── sdds_serv ──────────────────────────────────────────────────────────────
  const sddsServData: Record<string, TokenPlatformValues> = {
    // Color/gradient: dark mode
    'dark.text.default.primary': { web: [green500.value], ios: [green500.value], android: [green500.value] },
    'dark.text.default.secondary': { web: ['#a0a8b4'], ios: ['#a0a8b4'], android: ['#a0a8b4'] },
    'dark.text.default.accent': { web: ['#21a038'], ios: ['#21a038'], android: ['#21a038'] },
    'dark.text.default.accent-minor-gradient': {
      web: ['linear-gradient(135.00deg, #21A038FF 0%, #00B2FFFF 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#21A038', '#00B2FF'], angle: 135 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#21A038', '#00B2FF'], angle: 135 }],
    },
    'dark.text.default.primary-gradient': {
      web: ['linear-gradient(90.00deg, rgb(33, 160, 56) 0%, rgb(0, 178, 255) 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#21a038', '#00b2ff'], angle: 90 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#21a038', '#00b2ff'], angle: 90 }],
    },
    // Color/gradient: light mode
    'light.text.default.primary': { web: ['#171717F5'], ios: ['#171717F5'], android: ['#171717F5'] },
    'light.text.default.secondary': { web: ['#1717178F'], ios: ['#1717178F'], android: ['#1717178F'] },
    'light.text.default.accent': { web: ['#1B8A30'], ios: ['#1B8A30'], android: ['#1B8A30'] },
    'light.text.default.accent-minor-gradient': {
      web: ['linear-gradient(135.00deg, #1B8A30FF 0%, #008FD6FF 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#1B8A30', '#008FD6'], angle: 135 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#1B8A30', '#008FD6'], angle: 135 }],
    },
    'light.text.default.primary-gradient': {
      web: ['linear-gradient(90.00deg, rgb(27, 138, 48) 0%, rgb(0, 143, 214) 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#1b8a30', '#008fd6'], angle: 90 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#1b8a30', '#008fd6'], angle: 90 }],
    },
    // Non-color/gradient: mode = null
    'round.xxs': { web: ['2'], ios: [{ kind: 'round', cornerRadius: 2 }], android: [{ kind: 'round', cornerRadius: 2 }] },
    'round.xs': { web: ['4'], ios: [{ kind: 'round', cornerRadius: 4 }], android: [{ kind: 'round', cornerRadius: 4 }] },
    'round.circle': { web: ['999'], ios: [{ kind: 'round', cornerRadius: 999 }], android: [{ kind: 'round', cornerRadius: 999 }] },
    'spacing.1x': { web: ['4'], ios: [{ value: 4 }], android: [{ value: 4 }] },
    'spacing.2x': { web: ['8'], ios: [{ value: 8 }], android: [{ value: 8 }] },
    'spacing.3x': { web: ['12'], ios: [{ value: 12 }], android: [{ value: 12 }] },
    'up.hard.s': {
      web: ['0rem 0.5rem 1rem 0rem #0000001f'],
      ios: [{ color: '#0000001f', offsetX: 0, offsetY: 8, spreadRadius: 0, blurRadius: 16 }],
      android: [{ color: '#0000001f', offsetX: 0, offsetY: 8, spreadRadius: 0, blurRadius: 16, fallbackElevation: 2 }],
    },
    'up.hard.m': {
      web: ['0rem 1rem 2rem 0rem #21a03833'],
      ios: [{ color: '#21a03833', offsetX: 0, offsetY: 16, spreadRadius: 0, blurRadius: 32 }],
      android: [{ color: '#21a03833', offsetX: 0, offsetY: 16, spreadRadius: 0, blurRadius: 32, fallbackElevation: 6 }],
    },
    'screen-s.display.l.normal': {
      web: [{ fontFamilyRef: 'fontFamily.display', fontWeight: 400, fontStyle: 'normal', textSize: 72, lineHeight: 80, letterSpacing: -1 }],
      ios: [{ fontFamilyRef: 'fontFamily.display', weight: 'regular', style: 'normal', size: 48, lineHeight: 56, kerning: -0.5 }],
      android: [{ fontFamilyRef: 'fontFamily.display', fontWeight: '400', fontStyle: 'normal', fontSize: '4.5rem', lineHeight: '5rem', letterSpacing: '-0.0625rem' }],
    },
    'screen-s.header.h2.normal': {
      web: [{ fontFamilyRef: 'fontFamily.display', fontWeight: 400, fontStyle: 'normal', textSize: 28, lineHeight: 36, letterSpacing: 0 }],
      ios: [{ fontFamilyRef: 'fontFamily.display', weight: 'regular', style: 'normal', size: 28, lineHeight: 36, kerning: 0 }],
      android: [{ fontFamilyRef: 'fontFamily.display', fontWeight: '400', fontStyle: 'normal', fontSize: '28', lineHeight: '36', letterSpacing: 'normal' }],
    },
    'display': {
      web: [{ name: 'SB Sans Text', fonts: [{ src: ["url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Regular.woff2') format('woff2')"], fontWeight: 'normal', fontStyle: 'normal' }] }],
      ios: [{ name: 'SB Sans Text', fonts: [{ link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Regular.otf', weight: 'regular', style: 'normal' }] }],
      android: [{ name: 'SB Sans Text', fonts: [{ link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Regular.otf', fontWeight: 400, fontStyle: 'normal' }] }],
    },
  };

  // ── plasma_web ─────────────────────────────────────────────────────────────
  const plasmaWebData: Record<string, TokenPlatformValues> = {
    // Color/gradient: dark mode
    'dark.text.default.primary': { web: [red500.value], ios: [red500.value], android: [red500.value] },
    'dark.text.default.secondary': { web: ['#ffffff66'], ios: ['#ffffff66'], android: ['#ffffff66'] },
    'dark.text.default.accent': { web: ['#24b23e'], ios: ['#24b23e'], android: ['#24b23e'] },
    'dark.text.default.accent-minor-gradient': {
      web: ['linear-gradient(270.00deg, #24B23EFF 0%, #7CFC90FF 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#24B23E', '#7CFC90'], angle: 270 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#24B23E', '#7CFC90'], angle: 270 }],
    },
    'dark.text.default.primary-gradient': {
      web: ['linear-gradient(180.00deg, rgb(36, 178, 62) 0%, rgb(124, 252, 144) 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#24b23e', '#7cfc90'], angle: 180 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#24b23e', '#7cfc90'], angle: 180 }],
    },
    // Color/gradient: light mode
    'light.text.default.primary': { web: ['#171717F5'], ios: ['#171717F5'], android: ['#171717F5'] },
    'light.text.default.secondary': { web: ['#17171766'], ios: ['#17171766'], android: ['#17171766'] },
    'light.text.default.accent': { web: ['#1E9A35'], ios: ['#1E9A35'], android: ['#1E9A35'] },
    'light.text.default.accent-minor-gradient': {
      web: ['linear-gradient(270.00deg, #1E9A35FF 0%, #64D478FF 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#1E9A35', '#64D478'], angle: 270 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#1E9A35', '#64D478'], angle: 270 }],
    },
    'light.text.default.primary-gradient': {
      web: ['linear-gradient(180.00deg, rgb(30, 154, 53) 0%, rgb(100, 212, 120) 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#1e9a35', '#64d478'], angle: 180 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#1e9a35', '#64d478'], angle: 180 }],
    },
    // Non-color/gradient: mode = null
    'round.xxs': { web: ['8'], ios: [{ kind: 'round', cornerRadius: 8 }], android: [{ kind: 'round', cornerRadius: 8 }] },
    'round.xs': { web: ['12'], ios: [{ kind: 'round', cornerRadius: 12 }], android: [{ kind: 'round', cornerRadius: 12 }] },
    'round.circle': { web: ['999'], ios: [{ kind: 'round', cornerRadius: 999 }], android: [{ kind: 'round', cornerRadius: 999 }] },
    'spacing.1x': { web: ['4'], ios: [{ value: 4 }], android: [{ value: 4 }] },
    'spacing.2x': { web: ['8'], ios: [{ value: 8 }], android: [{ value: 8 }] },
    'spacing.3x': { web: ['12'], ios: [{ value: 12 }], android: [{ value: 12 }] },
    'up.hard.s': {
      web: ['0rem 0.25rem 0.75rem 0rem #00000029'],
      ios: [{ color: '#00000029', offsetX: 0, offsetY: 4, spreadRadius: 0, blurRadius: 12 }],
      android: [{ color: '#00000029', offsetX: 0, offsetY: 4, spreadRadius: 0, blurRadius: 12, fallbackElevation: 3 }],
    },
    'up.hard.m': {
      web: ['0rem 0.5rem 1.5rem 0rem #24b23e29'],
      ios: [{ color: '#24b23e29', offsetX: 0, offsetY: 8, spreadRadius: 0, blurRadius: 24 }],
      android: [{ color: '#24b23e29', offsetX: 0, offsetY: 8, spreadRadius: 0, blurRadius: 24, fallbackElevation: 8 }],
    },
    'screen-s.display.l.normal': {
      web: [{ fontFamilyRef: 'fontFamily.display', fontWeight: 700, fontStyle: 'normal', textSize: 96, lineHeight: 104, letterSpacing: -2 }],
      ios: [{ fontFamilyRef: 'fontFamily.display', weight: 'bold', style: 'normal', size: 64, lineHeight: 72, kerning: -1 }],
      android: [{ fontFamilyRef: 'fontFamily.display', fontWeight: '700', fontStyle: 'normal', fontSize: '6rem', lineHeight: '6.5rem', letterSpacing: '-0.125rem' }],
    },
    'screen-s.header.h2.normal': {
      web: [{ fontFamilyRef: 'fontFamily.display', fontWeight: 700, fontStyle: 'normal', textSize: 36, lineHeight: 44, letterSpacing: 0 }],
      ios: [{ fontFamilyRef: 'fontFamily.display', weight: 'bold', style: 'normal', size: 36, lineHeight: 44, kerning: 0 }],
      android: [{ fontFamilyRef: 'fontFamily.display', fontWeight: '700', fontStyle: 'normal', fontSize: '36', lineHeight: '44', letterSpacing: 'normal' }],
    },
    'display': {
      web: [{ name: 'SB Sans Interface', fonts: [{ src: ["url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Regular.woff2') format('woff2')"], fontWeight: 'normal', fontStyle: 'normal' }] }],
      ios: [{ name: 'SB Sans Interface', fonts: [{ link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Regular.otf', weight: 'regular', style: 'normal' }] }],
      android: [{ name: 'SB Sans Interface', fonts: [{ link: 'https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Regular.otf', fontWeight: 400, fontStyle: 'normal' }] }],
    },
  };

  // ── plasma_giga ────────────────────────────────────────────────────────────
  const plasmaGigaData: Record<string, TokenPlatformValues> = {
    // Color/gradient: dark mode
    'dark.text.default.primary': { web: [pink500.value], ios: [pink500.value], android: [pink500.value] },
    'dark.text.default.secondary': { web: ['#9e9e9eff'], ios: ['#9e9e9eff'], android: ['#9e9e9eff'] },
    'dark.text.default.accent': { web: ['#a855f7'], ios: ['#a855f7'], android: ['#a855f7'] },
    'dark.text.default.accent-minor-gradient': {
      web: ['linear-gradient(225.00deg, #A855F7FF 0%, #EC4899FF 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#A855F7', '#EC4899'], angle: 225 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#A855F7', '#EC4899'], angle: 225 }],
    },
    'dark.text.default.primary-gradient': {
      web: ['linear-gradient(315.00deg, rgb(168, 85, 247) 0%, rgb(236, 72, 153) 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#a855f7', '#ec4899'], angle: 315 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#a855f7', '#ec4899'], angle: 315 }],
    },
    // Color/gradient: light mode
    'light.text.default.primary': { web: ['#171717F5'], ios: ['#171717F5'], android: ['#171717F5'] },
    'light.text.default.secondary': { web: ['#1717179E'], ios: ['#1717179E'], android: ['#1717179E'] },
    'light.text.default.accent': { web: ['#9333EA'], ios: ['#9333EA'], android: ['#9333EA'] },
    'light.text.default.accent-minor-gradient': {
      web: ['linear-gradient(225.00deg, #9333EAFF 0%, #DB2777FF 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#9333EA', '#DB2777'], angle: 225 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#9333EA', '#DB2777'], angle: 225 }],
    },
    'light.text.default.primary-gradient': {
      web: ['linear-gradient(315.00deg, rgb(147, 51, 234) 0%, rgb(219, 39, 119) 100%)'],
      ios: [{ kind: 'linear', locations: [0, 1], colors: ['#9333ea', '#db2777'], angle: 315 }],
      android: [{ kind: 'linear', locations: [0, 1], colors: ['#9333ea', '#db2777'], angle: 315 }],
    },
    // Non-color/gradient: mode = null
    'round.xxs': { web: ['6'], ios: [{ kind: 'round', cornerRadius: 6 }], android: [{ kind: 'round', cornerRadius: 6 }] },
    'round.xs': { web: ['10'], ios: [{ kind: 'round', cornerRadius: 10 }], android: [{ kind: 'round', cornerRadius: 10 }] },
    'round.circle': { web: ['999'], ios: [{ kind: 'round', cornerRadius: 999 }], android: [{ kind: 'round', cornerRadius: 999 }] },
    'spacing.1x': { web: ['3'], ios: [{ value: 3 }], android: [{ value: 3 }] },
    'spacing.2x': { web: ['6'], ios: [{ value: 6 }], android: [{ value: 6 }] },
    'spacing.3x': { web: ['9'], ios: [{ value: 9 }], android: [{ value: 9 }] },
    'up.hard.s': {
      web: ['0rem 0.75rem 2rem 0rem #a855f714'],
      ios: [{ color: '#a855f714', offsetX: 0, offsetY: 12, spreadRadius: 0, blurRadius: 32 }],
      android: [{ color: '#a855f714', offsetX: 0, offsetY: 12, spreadRadius: 0, blurRadius: 32, fallbackElevation: 3 }],
    },
    'up.hard.m': {
      web: ['0rem 1.25rem 3rem 0rem #ec489933'],
      ios: [{ color: '#ec489933', offsetX: 0, offsetY: 20, spreadRadius: 0, blurRadius: 48 }],
      android: [{ color: '#ec489933', offsetX: 0, offsetY: 20, spreadRadius: 0, blurRadius: 48, fallbackElevation: 10 }],
    },
    'screen-s.display.l.normal': {
      web: [{ fontFamilyRef: 'fontFamily.display', fontWeight: 500, fontStyle: 'normal', textSize: 80, lineHeight: 88, letterSpacing: -1.5 }],
      ios: [{ fontFamilyRef: 'fontFamily.display', weight: 'medium', style: 'normal', size: 52, lineHeight: 60, kerning: -0.75 }],
      android: [{ fontFamilyRef: 'fontFamily.display', fontWeight: '500', fontStyle: 'normal', fontSize: '5rem', lineHeight: '5.5rem', letterSpacing: '-0.09375rem' }],
    },
    'screen-s.header.h2.normal': {
      web: [{ fontFamilyRef: 'fontFamily.display', fontWeight: 500, fontStyle: 'normal', textSize: 30, lineHeight: 38, letterSpacing: 0 }],
      ios: [{ fontFamilyRef: 'fontFamily.display', weight: 'medium', style: 'normal', size: 30, lineHeight: 38, kerning: 0 }],
      android: [{ fontFamilyRef: 'fontFamily.display', fontWeight: '500', fontStyle: 'normal', fontSize: '30', lineHeight: '38', letterSpacing: 'normal' }],
    },
    'display': {
      web: sddsDisplayFontWeb('SB Sans Display'),
      ios: sddsDisplayFontIos('SB Sans Display'),
      android: sddsDisplayFontAndroid('SB Sans Display'),
    },
  };

  // Palette references for dark.text.default.primary (mode: dark)
  const sddsPaletteMap = { 'dark.text.default.primary': blue500.id };
  const sddsServPaletteMap = { 'dark.text.default.primary': green500.id };
  const plasmaWebPaletteMap = { 'dark.text.default.primary': red500.id };
  const plasmaGigaPaletteMap = { 'dark.text.default.primary': pink500.id };

  const allRows = [
    ...buildTenantRows(sddsTokens, sddsCe.id, sddsCsData, sddsPaletteMap),
    ...buildTenantRows(sddsTokens, sddsServ.id, sddsServData, sddsServPaletteMap),
    ...buildTenantRows(plasmaTokens, plasmaWeb.id, plasmaWebData, plasmaWebPaletteMap),
    ...buildTenantRows(plasmaTokens, plasmaGiga.id, plasmaGigaData, plasmaGigaPaletteMap),
  ];

  const rows = await db.insert(schema.tokenValues).values(allRows).returning();
  console.log(`  token_values: ${rows.length} rows`);
  return rows;
}
