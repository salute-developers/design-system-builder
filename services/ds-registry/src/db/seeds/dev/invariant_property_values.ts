import * as schema from '../../schema';

// Invariant property values: per (design_system, component, property, appearance).
export async function seedInvariantPropertyValues(
  db: any,
  ctx: {
    tokens: { sdds: Record<string, any>; plasma: Record<string, any> };
    designSystems: { sdds: any; plasma: any };
    components: { button: any; textField: any };
    appearances: Record<string, any>;
    properties: Record<string, any>;
  },
) {
  const st = ctx.tokens.sdds;
  const pt = ctx.tokens.plasma;
  const { sdds, plasma } = ctx.designSystems;
  const { button, textField } = ctx.components;
  const a = ctx.appearances;
  const p = ctx.properties;

  type IpvRow = {
    propertyId: string;
    designSystemId: string;
    componentId: string;
    appearanceId: string;
    tokenId?: string | null;
    value?: string | null;
    state?: 'focused' | 'disabled' | null;
  };

  const rows: IpvRow[] = [
    // ── SDDS Button — default appearance ──────────────────────────────────────
    { propertyId: p.btn_focusColor.id, designSystemId: sdds.id, componentId: button.id, appearanceId: a.sdds_btn_default.id, tokenId: st['text.default.accent'].id, state: null },
    { propertyId: p.btn_focusColor.id, designSystemId: sdds.id, componentId: button.id, appearanceId: a.sdds_btn_default.id, tokenId: st['text.default.primary'].id, state: 'focused' },
    { propertyId: p.btn_disabledAlpha.id, designSystemId: sdds.id, componentId: button.id, appearanceId: a.sdds_btn_default.id, value: '0.4', state: null },
    { propertyId: p.btn_disabledAlpha.id, designSystemId: sdds.id, componentId: button.id, appearanceId: a.sdds_btn_default.id, value: '0.2', state: 'disabled' },

    // ── SDDS Button — outline appearance ───────────────────────────────────────
    { propertyId: p.btn_focusColor.id, designSystemId: sdds.id, componentId: button.id, appearanceId: a.sdds_btn_outline.id, tokenId: st['text.default.primary'].id, state: null },
    { propertyId: p.btn_disabledAlpha.id, designSystemId: sdds.id, componentId: button.id, appearanceId: a.sdds_btn_outline.id, value: '0.4', state: null },

    // ── SDDS TextField — default appearance ───────────────────────────────────
    { propertyId: p.tf_focusColor.id, designSystemId: sdds.id, componentId: textField.id, appearanceId: a.sdds_tf_default.id, tokenId: st['text.default.accent'].id, state: null },
    { propertyId: p.tf_disabledAlpha.id, designSystemId: sdds.id, componentId: textField.id, appearanceId: a.sdds_tf_default.id, value: '0.4', state: null },

    // ── SDDS TextField — outline appearance ───────────────────────────────────
    { propertyId: p.tf_focusColor.id, designSystemId: sdds.id, componentId: textField.id, appearanceId: a.sdds_tf_outline.id, tokenId: st['text.default.primary'].id, state: null },
    { propertyId: p.tf_disabledAlpha.id, designSystemId: sdds.id, componentId: textField.id, appearanceId: a.sdds_tf_outline.id, value: '0.4', state: null },

    // ── PLASMA Button — default appearance ────────────────────────────────────
    { propertyId: p.btn_focusColor.id, designSystemId: plasma.id, componentId: button.id, appearanceId: a.plasma_btn_default.id, tokenId: pt['text.default.accent'].id, state: null },
    { propertyId: p.btn_disabledAlpha.id, designSystemId: plasma.id, componentId: button.id, appearanceId: a.plasma_btn_default.id, value: '0.4', state: null },
  ];

  const inserted = await db.insert(schema.invariantPropertyValues).values(rows).returning();
  console.log(`  invariant_property_values: ${inserted.length} rows`);
  return inserted;
}
