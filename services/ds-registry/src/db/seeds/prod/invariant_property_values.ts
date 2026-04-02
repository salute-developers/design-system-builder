import * as schema from '../../schema';

export async function seedInvariantPropertyValues(
  db: any,
  ctx: {
    designSystems: { base: any };
    components: { iconButton: any; button: any; link: any; checkbox: any; radiobox: any };
    appearances: Record<string, any>;
    properties: Record<string, any>;
    tokenMap: Record<string, any>;
  },
) {
  const { base } = ctx.designSystems;
  const { iconButton, button, link, checkbox, radiobox } = ctx.components;
  const a = ctx.appearances;
  const p = ctx.properties;
  const t = ctx.tokenMap;

  const rows = await db
    .insert(schema.invariantPropertyValues)
    .values([
      // IconButton
      { propertyId: p.ib_loadingAlpha.id, designSystemId: base.id, componentId: iconButton.id, appearanceId: a.base_ib_default.id, value: '0', state: null },
      { propertyId: p.ib_disableAlpha.id, designSystemId: base.id, componentId: iconButton.id, appearanceId: a.base_ib_default.id, value: '0.4', state: null },
      { propertyId: p.ib_focusColor.id, designSystemId: base.id, componentId: iconButton.id, appearanceId: a.base_ib_default.id, tokenId: t['text.default.accent'].id, state: null },
      // Button
      { propertyId: p.btn_loadingAlpha.id, designSystemId: base.id, componentId: button.id, appearanceId: a.base_btn_default.id, value: '0', state: null },
      { propertyId: p.btn_disableAlpha.id, designSystemId: base.id, componentId: button.id, appearanceId: a.base_btn_default.id, value: '0.4', state: null },
      { propertyId: p.btn_focusColor.id, designSystemId: base.id, componentId: button.id, appearanceId: a.base_btn_default.id, tokenId: t['text.default.accent'].id, state: null },
      // Link
      { propertyId: p.link_focusColor.id, designSystemId: base.id, componentId: link.id, appearanceId: a.base_link_default.id, tokenId: t['text.default.accent'].id, state: null },
      { propertyId: p.link_disableAlpha.id, designSystemId: base.id, componentId: link.id, appearanceId: a.base_link_default.id, value: '0.4', state: null },
      // Checkbox
      { propertyId: p.cb_focusColor.id, designSystemId: base.id, componentId: checkbox.id, appearanceId: a.base_cb_default.id, tokenId: t['text.default.accent'].id, state: null },
      { propertyId: p.cb_disableAlpha.id, designSystemId: base.id, componentId: checkbox.id, appearanceId: a.base_cb_default.id, value: '0.4', state: null },
      // Radiobox
      { propertyId: p.rb_disableAlpha.id, designSystemId: base.id, componentId: radiobox.id, appearanceId: a.base_rb_default.id, value: '0.4', state: null },
      { propertyId: p.rb_focusColor.id, designSystemId: base.id, componentId: radiobox.id, appearanceId: a.base_rb_default.id, tokenId: t['text.default.accent'].id, state: null },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`  invariant_property_values: ${rows.length} rows`);
  return rows;
}
