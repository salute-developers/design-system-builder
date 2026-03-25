import * as schema from '../../schema';

export async function seedStyles(
  db: any,
  ctx: {
    designSystems: { plasmaTest: any };
    variations: Record<string, any>;
  },
) {
  const { plasmaTest } = ctx.designSystems;
  const v = ctx.variations;

  const rows = await db
    .insert(schema.styles)
    .values([
      // ── IconButton ──────────────────────────────────────────────────────────
      // View
      { designSystemId: plasmaTest.id, variationId: v.iconButtonView.id, name: 'default', description: 'Default view', isDefault: true },
      { designSystemId: plasmaTest.id, variationId: v.iconButtonView.id, name: 'secondary', description: 'Secondary view', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.iconButtonView.id, name: 'accent', description: 'Accent view', isDefault: false },
      // Size
      { designSystemId: plasmaTest.id, variationId: v.iconButtonSize.id, name: 'xl', description: 'Extra large size', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.iconButtonSize.id, name: 'l', description: 'Large size', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.iconButtonSize.id, name: 'm', description: 'Medium size', isDefault: true },
      // Shape
      { designSystemId: plasmaTest.id, variationId: v.iconButtonShape.id, name: 'rounded', description: 'Rounded shape', isDefault: true },
      { designSystemId: plasmaTest.id, variationId: v.iconButtonShape.id, name: 'pilled', description: 'Pilled shape', isDefault: false },

      // ── Button ──────────────────────────────────────────────────────────────
      // View
      { designSystemId: plasmaTest.id, variationId: v.buttonView.id, name: 'default', description: 'Default view', isDefault: true },
      { designSystemId: plasmaTest.id, variationId: v.buttonView.id, name: 'secondary', description: 'Secondary view', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.buttonView.id, name: 'accent', description: 'Accent view', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.buttonView.id, name: 'clear', description: 'Clear view', isDefault: false },
      // Size
      { designSystemId: plasmaTest.id, variationId: v.buttonSize.id, name: 'xl', description: 'Extra large size', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.buttonSize.id, name: 'l', description: 'Large size', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.buttonSize.id, name: 'm', description: 'Medium size', isDefault: true },
      // Shape
      { designSystemId: plasmaTest.id, variationId: v.buttonShape.id, name: 'rounded', description: 'Rounded shape', isDefault: true },
      { designSystemId: plasmaTest.id, variationId: v.buttonShape.id, name: 'pilled', description: 'Pilled shape', isDefault: false },

      // ── Link ────────────────────────────────────────────────────────────────
      // View
      { designSystemId: plasmaTest.id, variationId: v.linkView.id, name: 'default', description: 'Default view', isDefault: true },
      { designSystemId: plasmaTest.id, variationId: v.linkView.id, name: 'secondary', description: 'Secondary view', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.linkView.id, name: 'accent', description: 'Accent view', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.linkView.id, name: 'clear', description: 'Clear view', isDefault: false },
      // Size
      { designSystemId: plasmaTest.id, variationId: v.linkSize.id, name: 's', description: 'Small size', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.linkSize.id, name: 'm', description: 'Medium size', isDefault: true },
      { designSystemId: plasmaTest.id, variationId: v.linkSize.id, name: 'l', description: 'Large size', isDefault: false },

      // ── Checkbox ──────────────────────────────────────────────────────────────
      // View
      { designSystemId: plasmaTest.id, variationId: v.checkboxView.id, name: 'accent', description: 'Accent view', isDefault: true },
      { designSystemId: plasmaTest.id, variationId: v.checkboxView.id, name: 'negative', description: 'Negative view', isDefault: false },
      // Size
      { designSystemId: plasmaTest.id, variationId: v.checkboxSize.id, name: 's', description: 'Small size', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.checkboxSize.id, name: 'm', description: 'Medium size', isDefault: true },
      { designSystemId: plasmaTest.id, variationId: v.checkboxSize.id, name: 'l', description: 'Large size', isDefault: false },

      // ── Radiobox ──────────────────────────────────────────────────────────────
      // View
      { designSystemId: plasmaTest.id, variationId: v.radioboxView.id, name: 'accent', description: 'Accent view', isDefault: true },
      { designSystemId: plasmaTest.id, variationId: v.radioboxView.id, name: 'negative', description: 'Negative view', isDefault: false },
      // Size
      { designSystemId: plasmaTest.id, variationId: v.radioboxSize.id, name: 's', description: 'Small size', isDefault: false },
      { designSystemId: plasmaTest.id, variationId: v.radioboxSize.id, name: 'm', description: 'Medium size', isDefault: true },
      { designSystemId: plasmaTest.id, variationId: v.radioboxSize.id, name: 'l', description: 'Large size', isDefault: false },
    ])
    .returning();

  const find = (varId: string, name: string) =>
    rows.find((r: any) => r.variationId === varId && r.name === name)!;

  const s = {
    // IconButton
    plasmaTest_ib_view_default: find(v.iconButtonView.id, 'default'),
    plasmaTest_ib_view_secondary: find(v.iconButtonView.id, 'secondary'),
    plasmaTest_ib_view_accent: find(v.iconButtonView.id, 'accent'),
    plasmaTest_ib_size_xl: find(v.iconButtonSize.id, 'xl'),
    plasmaTest_ib_size_l: find(v.iconButtonSize.id, 'l'),
    plasmaTest_ib_size_m: find(v.iconButtonSize.id, 'm'),
    plasmaTest_ib_shape_rounded: find(v.iconButtonShape.id, 'rounded'),
    plasmaTest_ib_shape_pilled: find(v.iconButtonShape.id, 'pilled'),
    // Button
    plasmaTest_btn_view_default: find(v.buttonView.id, 'default'),
    plasmaTest_btn_view_secondary: find(v.buttonView.id, 'secondary'),
    plasmaTest_btn_view_accent: find(v.buttonView.id, 'accent'),
    plasmaTest_btn_view_clear: find(v.buttonView.id, 'clear'),
    plasmaTest_btn_size_xl: find(v.buttonSize.id, 'xl'),
    plasmaTest_btn_size_l: find(v.buttonSize.id, 'l'),
    plasmaTest_btn_size_m: find(v.buttonSize.id, 'm'),
    plasmaTest_btn_shape_rounded: find(v.buttonShape.id, 'rounded'),
    plasmaTest_btn_shape_pilled: find(v.buttonShape.id, 'pilled'),
    // Link
    plasmaTest_link_view_default: find(v.linkView.id, 'default'),
    plasmaTest_link_view_secondary: find(v.linkView.id, 'secondary'),
    plasmaTest_link_view_accent: find(v.linkView.id, 'accent'),
    plasmaTest_link_view_clear: find(v.linkView.id, 'clear'),
    plasmaTest_link_size_s: find(v.linkSize.id, 's'),
    plasmaTest_link_size_m: find(v.linkSize.id, 'm'),
    plasmaTest_link_size_l: find(v.linkSize.id, 'l'),
    // Checkbox
    plasmaTest_cb_view_accent: find(v.checkboxView.id, 'accent'),
    plasmaTest_cb_view_negative: find(v.checkboxView.id, 'negative'),
    plasmaTest_cb_size_s: find(v.checkboxSize.id, 's'),
    plasmaTest_cb_size_m: find(v.checkboxSize.id, 'm'),
    plasmaTest_cb_size_l: find(v.checkboxSize.id, 'l'),
    // Radiobox
    plasmaTest_rb_view_accent: find(v.radioboxView.id, 'accent'),
    plasmaTest_rb_view_negative: find(v.radioboxView.id, 'negative'),
    plasmaTest_rb_size_s: find(v.radioboxSize.id, 's'),
    plasmaTest_rb_size_m: find(v.radioboxSize.id, 'm'),
    plasmaTest_rb_size_l: find(v.radioboxSize.id, 'l'),
  };

  console.log(`  styles: ${rows.length} rows`);
  return s;
}
