import * as schema from '../../schema';

// Each combination links to its member styles.
export async function seedStyleCombinationMembers(
  db: any,
  ctx: {
    styleCombinations: Record<string, any>;
    styles: Record<string, any>;
  },
) {
  const c = ctx.styleCombinations;
  const s = ctx.styles;

  const rows = await db
    .insert(schema.styleCombinationMembers)
    .values([
      // SDDS: primary + s + rounded — width combination
      { combinationId: c.sdds_btn_width.id, styleId: s.sdds_btn_view_primary.id },
      { combinationId: c.sdds_btn_width.id, styleId: s.sdds_btn_size_s.id },
      { combinationId: c.sdds_btn_width.id, styleId: s.sdds_btn_shape_rounded.id },
      // SDDS: primary + s + rounded — height combination
      { combinationId: c.sdds_btn_height.id, styleId: s.sdds_btn_view_primary.id },
      { combinationId: c.sdds_btn_height.id, styleId: s.sdds_btn_size_s.id },
      { combinationId: c.sdds_btn_height.id, styleId: s.sdds_btn_shape_rounded.id },
      // SDDS: primary + s + rounded — labelColor combination
      { combinationId: c.sdds_btn_labelColor.id, styleId: s.sdds_btn_view_primary.id },
      { combinationId: c.sdds_btn_labelColor.id, styleId: s.sdds_btn_size_s.id },
      { combinationId: c.sdds_btn_labelColor.id, styleId: s.sdds_btn_shape_rounded.id },
      // PLASMA: primary + m — valueColor combination
      { combinationId: c.plasma_lnk_valueColor.id, styleId: s.plasma_lnk_view_primary.id },
      { combinationId: c.plasma_lnk_valueColor.id, styleId: s.plasma_lnk_size_m.id },
      // PLASMA: primary + m — underLineWidth combination
      { combinationId: c.plasma_lnk_underLineWidth.id, styleId: s.plasma_lnk_view_primary.id },
      { combinationId: c.plasma_lnk_underLineWidth.id, styleId: s.plasma_lnk_size_m.id },
    ])
    .returning();

  console.log(`  style_combination_members: ${rows.length} rows`);
  return rows;
}
