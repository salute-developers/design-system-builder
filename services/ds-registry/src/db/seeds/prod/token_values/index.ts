import { seedColorTokenValues } from './color';
import { seedGradientTokenValues } from './gradient';
import { seedFontFamilyTokenValues } from './fontFamily';
import { seedShadowTokenValues } from './shadow';
import { seedShapeTokenValues } from './shape';
import { seedTypographyTokenValues } from './typography';
import { seedSpacingTokenValues } from './spacing';

export async function seedTokenValues(
  db: any,
  ctx: { tokenMap: Record<string, any>; tenant: any },
) {
  const { tokenMap, tenant } = ctx;
  console.log('  token_values:');
  let total = 0;
  total += await seedColorTokenValues(db, tokenMap, tenant.id);
  total += await seedGradientTokenValues(db, tokenMap, tenant.id);
  total += await seedFontFamilyTokenValues(db, tokenMap, tenant.id);
  total += await seedShadowTokenValues(db, tokenMap, tenant.id);
  total += await seedShapeTokenValues(db, tokenMap, tenant.id);
  total += await seedTypographyTokenValues(db, tokenMap, tenant.id);
  total += await seedSpacingTokenValues(db, tokenMap, tenant.id);
  console.log(`  token_values total: ${total} rows`);
}