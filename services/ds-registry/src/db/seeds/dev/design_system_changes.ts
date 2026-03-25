import * as schema from '../../schema';

// Audit log: 8 change records across SDDS and PLASMA.
// `data` stores the full row snapshot for createds/updateds, null for deleteds.
export async function seedDesignSystemChanges(
  db: any,
  ctx: {
    users: { neretin: any; client: any };
    designSystems: { sdds: any; plasma: any };
    tokens: { sdds: Record<string, any>; plasma: Record<string, any> };
    styles: Record<string, any>;
    variations: Record<string, any>;
    tenants: { sddsCe: any; sddsServ: any; plasmaWeb: any; plasmaGiga: any };
    appearances: Record<string, any>;
    properties: Record<string, any>;
  },
) {
  const { neretin, client } = ctx.users;
  const { sdds, plasma } = ctx.designSystems;
  const sddsTokens = ctx.tokens.sdds;
  const plasmaTokens = ctx.tokens.plasma;
  const s = ctx.styles;
  const v = ctx.variations;
  const t = ctx.tenants;
  const p = ctx.properties;

  const rows = await db
    .insert(schema.designSystemChanges)
    .values([
      // 1. token_value updated (client): change sdds text.default.accent sdds_cs web #0095ff → #FF5500
      {
        designSystemId: sdds.id,
        userId: client.id,
        entityType: 'token_value',
        entityId: sddsTokens['text.default.accent'].id,
        operation: 'updated',
        data: {
          tokenId: sddsTokens['text.default.accent'].id,
          tenantId: t.sddsCe.id,
          platform: 'web',
          value: ['#FF5500'],
        },
      },
      // 2. variation_property_value updated (client): change PLASMA btn_height size S '40' → '36'
      {
        designSystemId: plasma.id,
        userId: client.id,
        entityType: 'variation_property_value',
        entityId: s.plasma_btn_size_s.id,
        operation: 'updated',
        data: {
          propertyId: p.btn_height.id,
          styleId: s.plasma_btn_size_s.id,
          appearanceId: ctx.appearances.plasma_btn_default.id,
          value: '36',
          state: null,
        },
      },
      // 3. style created (client): new 'L' style for SDDS Button.Size
      {
        designSystemId: sdds.id,
        userId: client.id,
        entityType: 'style',
        entityId: s.sdds_btn_size_m.id,
        operation: 'created',
        data: {
          designSystemId: sdds.id,
          variationId: v.buttonSize.id,
          name: 'L',
          isDefault: false,
        },
      },
      // 4. property_variation deleted (client): deleted a property-variation link
      {
        designSystemId: sdds.id,
        userId: client.id,
        entityType: 'property_variation',
        entityId: p.btn_droppedShadow.id,
        operation: 'deleted',
        data: null,
      },
      // 5. style deleted (neretin): deleted SDDS Link.Size M
      {
        designSystemId: sdds.id,
        userId: neretin.id,
        entityType: 'style',
        entityId: s.sdds_lnk_size_m.id,
        operation: 'deleted',
        data: null,
      },
      // 6. style updated (neretin): rename PLASMA Button.View Secondary → Outline
      {
        designSystemId: plasma.id,
        userId: neretin.id,
        entityType: 'style',
        entityId: s.plasma_btn_view_secondary.id,
        operation: 'updated',
        data: {
          designSystemId: plasma.id,
          variationId: v.buttonView.id,
          name: 'Outline',
          isDefault: false,
        },
      },
      // 7. token created (neretin): new 'spacing.4x' token in SDDS
      {
        designSystemId: sdds.id,
        userId: neretin.id,
        entityType: 'token',
        entityId: sddsTokens['spacing.3x'].id,
        operation: 'created',
        data: {
          designSystemId: sdds.id,
          name: 'spacing.4x',
          type: 'spacing',
          enabled: true,
          description: 'Spacing token 4x (8px grid)',
        },
      },
      // 8. token_value deleted (neretin): deleted PLASMA plasma_giga round.circle token_value
      {
        designSystemId: plasma.id,
        userId: neretin.id,
        entityType: 'token_value',
        entityId: plasmaTokens['round.circle'].id,
        operation: 'deleted',
        data: null,
      },
    ])
    .returning();

  console.log(`  design_system_changes: ${rows.length} rows`);
  return rows;
}
