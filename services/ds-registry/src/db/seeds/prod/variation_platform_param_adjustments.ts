import * as schema from '../../schema';

export async function seedVariationPlatformParamAdjustments(
  db: any,
  ctx: {
    vpvRows: any[];
    properties: {
      findParam: (propertyId: string, platform: string, name: string) => any;
      btn_iconMargin: any;
      btn_valueMargin: any;
      btn_shape: any;
      ib_shape: any;
    };
    styles: Record<string, any>;
  },
) {
  const { vpvRows, styles } = ctx;
  const { findParam, btn_iconMargin, btn_valueMargin, btn_shape, ib_shape } = ctx.properties;

  // Helper: find VPV rows by propertyId (state=null only) with optional styleId filter
  const findVpv = (propertyId: string, styleId?: string) =>
    vpvRows.filter((r: any) =>
      r.propertyId === propertyId &&
      r.state === null &&
      (styleId ? r.styleId === styleId : true),
    );

  const values: any[] = [];

  // ── Button iconMargin — web adjustments (template-based, all sizes) ────
  for (const vpv of findVpv(btn_iconMargin.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(btn_iconMargin.id, 'web', 'buttonLeftContentMargin').id,
      value: null,
      template: '0 $1 -0.125rem',
    });
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(btn_iconMargin.id, 'web', 'buttonRightContentMargin').id,
      value: null,
      template: '0 -0.125rem 0 $1',
    });
  }

  // ── Button valueMargin — web adjustment (template-based, all sizes) ────
  for (const vpv of findVpv(btn_valueMargin.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(btn_valueMargin.id, 'web', 'buttonValueMargin').id,
      value: null,
      template: '0 0 0 $1',
    });
  }

  // ── Button shape — adjustment -2 (style "l" only, all platforms) ───────
  const btnShapeLStyleId = styles.base_btn_size_l.id;
  for (const vpv of findVpv(btn_shape.id, btnShapeLStyleId)) {
    values.push(
      { vpvId: vpv.id, platformParamId: findParam(btn_shape.id, 'xml', 'sd_shapeAppearance').id, value: '-2', template: null },
      { vpvId: vpv.id, platformParamId: findParam(btn_shape.id, 'compose', 'shape').id, value: '-2', template: null },
      { vpvId: vpv.id, platformParamId: findParam(btn_shape.id, 'ios', 'cornerRadius').id, value: '-2', template: null },
      { vpvId: vpv.id, platformParamId: findParam(btn_shape.id, 'web', 'buttonRadius').id, value: '-2', template: null },
    );
  }

  // ── IconButton shape — adjustment -2 (style "l" only, all platforms) ───
  const ibShapeLStyleId = styles.base_ib_size_l.id;
  for (const vpv of findVpv(ib_shape.id, ibShapeLStyleId)) {
    values.push(
      { vpvId: vpv.id, platformParamId: findParam(ib_shape.id, 'xml', 'sd_shapeAppearance').id, value: '-2', template: null },
      { vpvId: vpv.id, platformParamId: findParam(ib_shape.id, 'compose', 'shape').id, value: '-2', template: null },
      { vpvId: vpv.id, platformParamId: findParam(ib_shape.id, 'ios', 'cornerRadius').id, value: '-2', template: null },
      { vpvId: vpv.id, platformParamId: findParam(ib_shape.id, 'web', 'iconButtonRadius').id, value: '-2', template: null },
    );
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
