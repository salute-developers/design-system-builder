import * as schema from '../../schema';

// Styles are per (design_system, variation).
// _outline postfixes removed: the same style names work across appearances.
export async function seedStyles(
  db: any,
  ctx: {
    designSystems: { sdds: any; plasma: any };
    variations: Record<string, any>;
  },
) {
  const { sdds, plasma } = ctx.designSystems;
  const v = ctx.variations;

  const rows = await db
    .insert(schema.styles)
    .values([
      // ── SDDS ──────────────────────────────────────────────────────────────
      // Button.View
      { designSystemId: sdds.id, variationId: v.buttonView.id, name: 'Primary', isDefault: true },
      { designSystemId: sdds.id, variationId: v.buttonView.id, name: 'Accent', isDefault: false },
      // Button.Size
      { designSystemId: sdds.id, variationId: v.buttonSize.id, name: 'S', isDefault: false },
      { designSystemId: sdds.id, variationId: v.buttonSize.id, name: 'M', isDefault: true },
      // Button.Shape
      { designSystemId: sdds.id, variationId: v.buttonShape.id, name: 'Rounded', isDefault: true },
      // Text.Size
      { designSystemId: sdds.id, variationId: v.textSize.id, name: 'S', isDefault: true },
      // Link.View
      { designSystemId: sdds.id, variationId: v.linkView.id, name: 'Primary', isDefault: true },
      // Link.Size
      { designSystemId: sdds.id, variationId: v.linkSize.id, name: 'S', isDefault: true },
      { designSystemId: sdds.id, variationId: v.linkSize.id, name: 'M', isDefault: false },
      // TextField.View
      { designSystemId: sdds.id, variationId: v.textFieldView.id, name: 'Primary', isDefault: true },
      // TextField.Size
      { designSystemId: sdds.id, variationId: v.textFieldSize.id, name: 'S', isDefault: true },
      { designSystemId: sdds.id, variationId: v.textFieldSize.id, name: 'M', isDefault: false },
      // Cell.View
      { designSystemId: sdds.id, variationId: v.cellView.id, name: 'Primary', isDefault: true },
      { designSystemId: sdds.id, variationId: v.cellView.id, name: 'Secondary', isDefault: false },
      // Cell.Size
      { designSystemId: sdds.id, variationId: v.cellSize.id, name: 'S', isDefault: true },
      { designSystemId: sdds.id, variationId: v.cellSize.id, name: 'M', isDefault: false },
      // CellLabel.View
      { designSystemId: sdds.id, variationId: v.cellLabelView.id, name: 'Primary', isDefault: true },
      // CellLabel.Size
      { designSystemId: sdds.id, variationId: v.cellLabelSize.id, name: 'S', isDefault: true },
      // CellTitle.View
      { designSystemId: sdds.id, variationId: v.cellTitleView.id, name: 'Primary', isDefault: true },
      // CellTitle.Size
      { designSystemId: sdds.id, variationId: v.cellTitleSize.id, name: 'S', isDefault: true },

      // ── PLASMA ────────────────────────────────────────────────────────────
      // Each design system has its own default per variation (unique index on variationId + designSystemId).
      // Button.View
      { designSystemId: plasma.id, variationId: v.buttonView.id, name: 'Primary', isDefault: true },
      { designSystemId: plasma.id, variationId: v.buttonView.id, name: 'Secondary', isDefault: false },
      // Button.Size
      { designSystemId: plasma.id, variationId: v.buttonSize.id, name: 'S', isDefault: false },
      { designSystemId: plasma.id, variationId: v.buttonSize.id, name: 'M', isDefault: true },
      { designSystemId: plasma.id, variationId: v.buttonSize.id, name: 'L', isDefault: false },
      // Text.Size
      { designSystemId: plasma.id, variationId: v.textSize.id, name: 'S', isDefault: true },
      { designSystemId: plasma.id, variationId: v.textSize.id, name: 'M', isDefault: false },
      // Link.View
      { designSystemId: plasma.id, variationId: v.linkView.id, name: 'Primary', isDefault: true },
      // Link.Size
      { designSystemId: plasma.id, variationId: v.linkSize.id, name: 'S', isDefault: true },
      { designSystemId: plasma.id, variationId: v.linkSize.id, name: 'M', isDefault: false },
    ])
    .returning();

  const find = (dsId: string, varId: string, name: string) =>
    rows.find((r: any) => r.designSystemId === dsId && r.variationId === varId && r.name === name)!;

  const s = {
    // SDDS
    sdds_btn_view_primary: find(sdds.id, v.buttonView.id, 'Primary'),
    sdds_btn_view_secondary: find(sdds.id, v.buttonView.id, 'Accent'),
    sdds_btn_size_s: find(sdds.id, v.buttonSize.id, 'S'),
    sdds_btn_size_m: find(sdds.id, v.buttonSize.id, 'M'),
    sdds_btn_shape_rounded: find(sdds.id, v.buttonShape.id, 'Rounded'),
    sdds_txt_size_s: find(sdds.id, v.textSize.id, 'S'),
    sdds_lnk_view_primary: find(sdds.id, v.linkView.id, 'Primary'),
    sdds_lnk_size_s: find(sdds.id, v.linkSize.id, 'S'),
    sdds_lnk_size_m: find(sdds.id, v.linkSize.id, 'M'),
    sdds_tf_view_primary: find(sdds.id, v.textFieldView.id, 'Primary'),
    sdds_tf_size_s: find(sdds.id, v.textFieldSize.id, 'S'),
    sdds_tf_size_m: find(sdds.id, v.textFieldSize.id, 'M'),
    sdds_cell_view_primary: find(sdds.id, v.cellView.id, 'Primary'),
    sdds_cell_view_secondary: find(sdds.id, v.cellView.id, 'Secondary'),
    sdds_cell_size_s: find(sdds.id, v.cellSize.id, 'S'),
    sdds_cell_size_m: find(sdds.id, v.cellSize.id, 'M'),
    sdds_cl_view_primary: find(sdds.id, v.cellLabelView.id, 'Primary'),
    sdds_cl_size_s: find(sdds.id, v.cellLabelSize.id, 'S'),
    sdds_ct_view_primary: find(sdds.id, v.cellTitleView.id, 'Primary'),
    sdds_ct_size_s: find(sdds.id, v.cellTitleSize.id, 'S'),
    // PLASMA
    plasma_btn_view_primary: find(plasma.id, v.buttonView.id, 'Primary'),
    plasma_btn_view_secondary: find(plasma.id, v.buttonView.id, 'Secondary'),
    plasma_btn_size_s: find(plasma.id, v.buttonSize.id, 'S'),
    plasma_btn_size_m: find(plasma.id, v.buttonSize.id, 'M'),
    plasma_btn_size_l: find(plasma.id, v.buttonSize.id, 'L'),
    plasma_txt_size_s: find(plasma.id, v.textSize.id, 'S'),
    plasma_txt_size_m: find(plasma.id, v.textSize.id, 'M'),
    plasma_lnk_view_primary: find(plasma.id, v.linkView.id, 'Primary'),
    plasma_lnk_size_s: find(plasma.id, v.linkSize.id, 'S'),
    plasma_lnk_size_m: find(plasma.id, v.linkSize.id, 'M'),
  };

  console.log(`  styles: ${rows.length} rows`);
  return s;
}
