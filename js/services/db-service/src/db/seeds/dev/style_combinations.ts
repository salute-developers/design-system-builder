import * as schema from '../../schema';

// style_combinations: computed values when specific styles are combined.
export async function seedStyleCombinations(
  db: any,
  ctx: {
    appearances: Record<string, any>;
    properties: Record<string, any>;
  },
) {
  const a = ctx.appearances;
  const p = ctx.properties;

  const rows = await db
    .insert(schema.styleCombinations)
    .values([
      // SDDS: primary + s + rounded → width = 500
      { propertyId: p.btn_width.id, appearanceId: a.sdds_btn_default.id, value: '500' },
      // SDDS: primary + s + rounded → height = 30
      { propertyId: p.btn_height.id, appearanceId: a.sdds_btn_default.id, value: '30' },
      // SDDS: primary + s + rounded → labelColor = dark.text.default.accent
      { propertyId: p.btn_labelColor.id, appearanceId: a.sdds_btn_default.id, value: 'dark.text.default.accent' },
      // PLASMA: primary + m → valueColor = dark.text.default.primary
      { propertyId: p.lnk_valueColor.id, appearanceId: a.plasma_lnk_default.id, value: 'dark.text.default.primary' },
      // PLASMA: primary + m → underLineWidth = 5
      { propertyId: p.lnk_underLineWidth.id, appearanceId: a.plasma_lnk_default.id, value: '5' },
    ])
    .returning();

  const findSdds = (propId: string) =>
    rows.find((r: any) => r.appearanceId === a.sdds_btn_default.id && r.propertyId === propId)!;
  const findPlasma = (propId: string) =>
    rows.find((r: any) => r.appearanceId === a.plasma_lnk_default.id && r.propertyId === propId)!;

  const result = {
    sdds_btn_width: findSdds(p.btn_width.id),
    sdds_btn_height: findSdds(p.btn_height.id),
    sdds_btn_labelColor: findSdds(p.btn_labelColor.id),
    plasma_lnk_valueColor: findPlasma(p.lnk_valueColor.id),
    plasma_lnk_underLineWidth: findPlasma(p.lnk_underLineWidth.id),
  };

  console.log(`  style_combinations: ${rows.length} rows`);
  return result;
}
