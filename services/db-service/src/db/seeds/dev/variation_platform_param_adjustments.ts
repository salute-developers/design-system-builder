import * as schema from '../../schema';

export async function seedVariationPlatformParamAdjustments(
  db: any,
  ctx: {
    vpvRows: any[];
    properties: {
      findParam: (propertyId: string, platform: string, name: string) => any;
      btn_shape: any;
      btn_height: any;
    };
  },
) {
  const { vpvRows } = ctx;
  const { findParam, btn_shape, btn_height } = ctx.properties;

  const findVpv = (propertyId: string, styleId: string) =>
    vpvRows.find((r: any) => r.propertyId === propertyId && r.styleId === styleId && r.state === null);

  const values: any[] = [];

  // ── Button shape (SDDS, size_s) — web template adjustment ──────────────
  const sddsShapeSVpv = vpvRows.find((r: any) =>
    r.propertyId === btn_shape.id && r.state === null &&
    // sdds_btn_size_s is the first shape VPV in the list — match by position
    // We rely on the VPV rows having been inserted in order
    true,
  );
  // Find by iterating: btn_shape VPVs in order are: sdds_btn_size_s, sdds_btn_size_m, sdds_btn_shape_rounded, plasma_btn_size_s, plasma_btn_size_m
  const shapeVpvs = vpvRows.filter((r: any) => r.propertyId === btn_shape.id && r.state === null);
  if (shapeVpvs.length > 0) {
    // First shape VPV = sdds_btn_size_s
    values.push({
      vpvId: shapeVpvs[0].id,
      platformParamId: findParam(btn_shape.id, 'web', 'buttonRadius').id,
      value: null,
      template: 'var(--#{value})',
    });
  }

  // ── Button height (PLASMA, size_m) — web value adjustment ──────────────
  const heightVpvs = vpvRows.filter((r: any) => r.propertyId === btn_height.id && r.state === null);
  // Height VPVs order: sdds_btn_size_s, sdds_btn_size_m, (outline size_m), plasma_btn_size_s, plasma_btn_size_m
  // plasma_btn_size_m is the last one
  if (heightVpvs.length > 0) {
    const plasmaHeightM = heightVpvs[heightVpvs.length - 1];
    values.push({
      vpvId: plasmaHeightM.id,
      platformParamId: findParam(btn_height.id, 'web', 'buttonHeight').id,
      value: '-4',
      template: null,
    });
  }

  if (values.length > 0) {
    const rows = await db
      .insert(schema.variationPlatformParamAdjustments)
      .values(values)
      .returning();
    console.log(`  variation_platform_param_adjustments: ${rows.length} rows`);
    return rows;
  }

  console.log('  variation_platform_param_adjustments: 0 rows');
  return [];
}
