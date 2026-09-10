import * as schema from '../../schema';
import { SENTINEL_STATE_SET_ID } from '../state-sets';

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
      tex_padding: any;
      tex_leftContentMargin: any;
      tex_rightContentMargin: any;
      tex_hintMargin: any;
      tex_hintInnerLabelPlacementOffset: any;
      tex_leftHelperOffset: any;
      tex_rightHelperOffset: any;
      tex_labelInnerPadding: any;
      tex_contentLabelInnerPadding: any;
      tex_textBeforeMargin: any;
      tex_textAfterMargin: any;
      tex_chipPadding: any;
      tex_indicatorLabelPlacementInner: any;
      tex_indicatorLabelPlacementOuter: any;
      tex_indicatorLabelPlacementInnerRight: any;
      tex_indicatorLabelPlacementOuterRight: any;
      tex_rightContentWithHintMargin: any;
      tex_contentRightWrapperMargin: any;
      tex_clearHintInnerLabelPlacementOffset: any;
    };
    styles: Record<string, any>;
  },
) {
  const { vpvRows, styles } = ctx;
  const { findParam, btn_iconMargin, btn_valueMargin, btn_shape, ib_shape } = ctx.properties;

  // Helper: find base VPV rows by propertyId (empty state set only) with optional styleId filter.
  // Rows come back from the DB with `stateSetId`, not the seed-side `state` field.
  const findVpv = (propertyId: string, styleId?: string) =>
    vpvRows.filter((r: any) =>
      r.propertyId === propertyId &&
      r.stateSetId === SENTINEL_STATE_SET_ID &&
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

  // ── TextField — web templates for multi-value tokens (base value goes to $1) ──
  const texBase = (propertyId: string) =>
    vpvRows.filter((r: any) => r.propertyId === propertyId && r.stateSetId === SENTINEL_STATE_SET_ID);
  for (const vpv of texBase(ctx.properties.tex_padding.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_padding.id, 'web', 'padding').id,
      value: null,
      template: '$1 1rem $1 1rem',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_leftContentMargin.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_leftContentMargin.id, 'web', 'leftContentMargin').id,
      value: null,
      template: '-0.125rem $1 -0.125rem -0.125rem',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_rightContentMargin.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_rightContentMargin.id, 'web', 'rightContentMargin').id,
      value: null,
      template: '$1 -0.125rem $1 0.75rem',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_hintMargin.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_hintMargin.id, 'web', 'hintMargin').id,
      value: null,
      template: '-0.688rem $1 -0.688rem -0.5rem',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_hintInnerLabelPlacementOffset.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_hintInnerLabelPlacementOffset.id, 'web', 'hintInnerLabelPlacementOffset').id,
      value: null,
      template: '$1 -2.813rem auto auto',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_leftHelperOffset.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_leftHelperOffset.id, 'web', 'leftHelperOffset').id,
      value: null,
      template: '$1 0 0 0',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_rightHelperOffset.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_rightHelperOffset.id, 'web', 'rightHelperOffset').id,
      value: null,
      template: '$1 0 0 0.25rem',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_labelInnerPadding.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_labelInnerPadding.id, 'web', 'labelInnerPadding').id,
      value: null,
      template: '$1 0 0.125rem 0',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_contentLabelInnerPadding.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_contentLabelInnerPadding.id, 'web', 'contentLabelInnerPadding').id,
      value: null,
      template: '$1 0 0.375rem 0',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_textBeforeMargin.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_textBeforeMargin.id, 'web', 'textBeforeMargin').id,
      value: null,
      template: '0 $1 0 0',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_textAfterMargin.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_textAfterMargin.id, 'web', 'textAfterMargin').id,
      value: null,
      template: '0 0 0 $1',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_chipPadding.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_chipPadding.id, 'web', 'chipPadding').id,
      value: null,
      template: '0 $1 0 0.875rem',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_indicatorLabelPlacementInner.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_indicatorLabelPlacementInner.id, 'web', 'indicatorLabelPlacementInner').id,
      value: null,
      template: '$1 0 0 0',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_indicatorLabelPlacementOuter.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_indicatorLabelPlacementOuter.id, 'web', 'indicatorLabelPlacementOuter').id,
      value: null,
      template: '$1 auto auto -0.75rem',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_indicatorLabelPlacementInnerRight.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_indicatorLabelPlacementInnerRight.id, 'web', 'indicatorLabelPlacementInnerRight').id,
      value: null,
      template: '$1 0 auto auto',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_indicatorLabelPlacementOuterRight.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_indicatorLabelPlacementOuterRight.id, 'web', 'indicatorLabelPlacementOuterRight').id,
      value: null,
      template: '$1 -0.6875rem auto auto',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_rightContentWithHintMargin.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_rightContentWithHintMargin.id, 'web', 'rightContentWithHintMargin').id,
      value: null,
      template: '-0.125rem $1 -0.125rem 0.75rem',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_contentRightWrapperMargin.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_contentRightWrapperMargin.id, 'web', 'contentRightWrapperMargin').id,
      value: null,
      template: '$1 $1 $1 0',
    });
  }
  for (const vpv of texBase(ctx.properties.tex_clearHintInnerLabelPlacementOffset.id)) {
    values.push({
      vpvId: vpv.id,
      platformParamId: findParam(ctx.properties.tex_clearHintInnerLabelPlacementOffset.id, 'web', 'clearHintInnerLabelPlacementOffset').id,
      value: null,
      template: '$1 -2.188rem auto auto',
    });
  }

  if (values.length > 0) {
    const rows = await db
      .insert(schema.variationPlatformParamAdjustments)
      .values(values)
      .onConflictDoNothing()
      .returning();
    console.log(`  variation_platform_param_adjustments: ${rows.length} rows`);
    return rows;
  }

  console.log('  variation_platform_param_adjustments: 0 rows');
  return [];
}
