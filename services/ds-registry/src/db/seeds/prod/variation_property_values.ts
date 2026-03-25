import * as schema from '../../schema';

type State = 'pressed' | 'hovered' | 'focused' | 'selected' | 'readonly' | 'disabled';

type VpvRow = {
  propertyId: string;
  styleId: string;
  appearanceId: string;
  tokenId?: string | null;
  value?: string | null;
  state: State | null;
};

export async function seedVariationPropertyValues(
  db: any,
  ctx: {
    appearances: Record<string, any>;
    properties: Record<string, any>;
    styles: Record<string, any>;
    tokenMap: Record<string, any>;
  },
) {
  const p = ctx.properties;
  const s = ctx.styles;
  const a = ctx.appearances;
  const tokenMap = ctx.tokenMap;
  const ibApp = a.plasmaTest_ib_default.id;
  const btnApp = a.plasmaTest_btn_default.id;
  const linkApp = a.plasmaTest_link_default.id;
  const cbApp = a.plasmaTest_cb_default.id;
  const rbApp = a.plasmaTest_rb_default.id;

  const rows: VpvRow[] = [
    // ══════════════════════════════════════════════════════════════════════════
    // IconButton
    // ══════════════════════════════════════════════════════════════════════════

    // ── Default view ──────────────────────────────────────────────────────────
    // iconColor
    { propertyId: p.ib_iconColor.id, styleId: s.plasmaTest_ib_view_default.id, appearanceId: ibApp, tokenId: tokenMap['text.inverse.primary'].id, state: null },
    { propertyId: p.ib_iconColor.id, styleId: s.plasmaTest_ib_view_default.id, appearanceId: ibApp, tokenId: tokenMap['text.inverse.primary-active'].id, state: 'pressed' },
    { propertyId: p.ib_iconColor.id, styleId: s.plasmaTest_ib_view_default.id, appearanceId: ibApp, tokenId: tokenMap['text.inverse.primary-hover'].id, state: 'hovered' },
    // loadingBackgroundColor
    { propertyId: p.ib_loadingBackgroundColor.id, styleId: s.plasmaTest_ib_view_default.id, appearanceId: ibApp, tokenId: tokenMap['text.inverse.primary'].id, state: null },
    // spinnerColor
    { propertyId: p.ib_spinnerColor.id, styleId: s.plasmaTest_ib_view_default.id, appearanceId: ibApp, tokenId: tokenMap['text.inverse.primary'].id, state: null },
    // backgroundColor
    { propertyId: p.ib_backgroundColor.id, styleId: s.plasmaTest_ib_view_default.id, appearanceId: ibApp, tokenId: tokenMap['surface.default.solid-default'].id, state: null },
    { propertyId: p.ib_backgroundColor.id, styleId: s.plasmaTest_ib_view_default.id, appearanceId: ibApp, tokenId: tokenMap['surface.default.solid-default-active'].id, state: 'pressed' },
    { propertyId: p.ib_backgroundColor.id, styleId: s.plasmaTest_ib_view_default.id, appearanceId: ibApp, tokenId: tokenMap['surface.default.solid-default-hover'].id, state: 'hovered' },

    // ── Secondary view ────────────────────────────────────────────────────────
    // iconColor
    { propertyId: p.ib_iconColor.id, styleId: s.plasmaTest_ib_view_secondary.id, appearanceId: ibApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    { propertyId: p.ib_iconColor.id, styleId: s.plasmaTest_ib_view_secondary.id, appearanceId: ibApp, tokenId: tokenMap['text.default.primary-active'].id, state: 'pressed' },
    { propertyId: p.ib_iconColor.id, styleId: s.plasmaTest_ib_view_secondary.id, appearanceId: ibApp, tokenId: tokenMap['text.default.primary-hover'].id, state: 'hovered' },
    // loadingBackgroundColor
    { propertyId: p.ib_loadingBackgroundColor.id, styleId: s.plasmaTest_ib_view_secondary.id, appearanceId: ibApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    // spinnerColor
    { propertyId: p.ib_spinnerColor.id, styleId: s.plasmaTest_ib_view_secondary.id, appearanceId: ibApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    // backgroundColor
    { propertyId: p.ib_backgroundColor.id, styleId: s.plasmaTest_ib_view_secondary.id, appearanceId: ibApp, tokenId: tokenMap['surface.default.transparent-secondary'].id, state: null },
    { propertyId: p.ib_backgroundColor.id, styleId: s.plasmaTest_ib_view_secondary.id, appearanceId: ibApp, tokenId: tokenMap['surface.default.transparent-secondary-active'].id, state: 'pressed' },
    { propertyId: p.ib_backgroundColor.id, styleId: s.plasmaTest_ib_view_secondary.id, appearanceId: ibApp, tokenId: tokenMap['surface.default.transparent-secondary-hover'].id, state: 'hovered' },

    // ── Accent view ───────────────────────────────────────────────────────────
    // iconColor
    { propertyId: p.ib_iconColor.id, styleId: s.plasmaTest_ib_view_accent.id, appearanceId: ibApp, tokenId: tokenMap['text.on-dark.primary'].id, state: null },
    { propertyId: p.ib_iconColor.id, styleId: s.plasmaTest_ib_view_accent.id, appearanceId: ibApp, tokenId: tokenMap['text.on-dark.primary-active'].id, state: 'pressed' },
    { propertyId: p.ib_iconColor.id, styleId: s.plasmaTest_ib_view_accent.id, appearanceId: ibApp, tokenId: tokenMap['text.on-dark.primary-hover'].id, state: 'hovered' },
    // loadingBackgroundColor
    { propertyId: p.ib_loadingBackgroundColor.id, styleId: s.plasmaTest_ib_view_accent.id, appearanceId: ibApp, tokenId: tokenMap['text.on-dark.primary'].id, state: null },
    // spinnerColor
    { propertyId: p.ib_spinnerColor.id, styleId: s.plasmaTest_ib_view_accent.id, appearanceId: ibApp, tokenId: tokenMap['text.on-dark.primary'].id, state: null },
    // backgroundColor
    { propertyId: p.ib_backgroundColor.id, styleId: s.plasmaTest_ib_view_accent.id, appearanceId: ibApp, tokenId: tokenMap['surface.default.accent'].id, state: null },
    { propertyId: p.ib_backgroundColor.id, styleId: s.plasmaTest_ib_view_accent.id, appearanceId: ibApp, tokenId: tokenMap['surface.default.accent-active'].id, state: 'pressed' },
    { propertyId: p.ib_backgroundColor.id, styleId: s.plasmaTest_ib_view_accent.id, appearanceId: ibApp, tokenId: tokenMap['surface.default.accent-hover'].id, state: 'hovered' },

    // ── XL size ───────────────────────────────────────────────────────────────
    { propertyId: p.ib_height.id, styleId: s.plasmaTest_ib_size_xl.id, appearanceId: ibApp, value: '64', state: null },
    { propertyId: p.ib_paddingStart.id, styleId: s.plasmaTest_ib_size_xl.id, appearanceId: ibApp, value: '20', state: null },
    { propertyId: p.ib_paddingEnd.id, styleId: s.plasmaTest_ib_size_xl.id, appearanceId: ibApp, value: '20', state: null },
    { propertyId: p.ib_minWidth.id, styleId: s.plasmaTest_ib_size_xl.id, appearanceId: ibApp, value: '64', state: null },
    { propertyId: p.ib_iconSize.id, styleId: s.plasmaTest_ib_size_xl.id, appearanceId: ibApp, value: '24', state: null },
    { propertyId: p.ib_spinnerSize.id, styleId: s.plasmaTest_ib_size_xl.id, appearanceId: ibApp, value: '24', state: null },
    { propertyId: p.ib_spinnerStrokeWidth.id, styleId: s.plasmaTest_ib_size_xl.id, appearanceId: ibApp, value: '2', state: null },
    { propertyId: p.ib_shape.id, styleId: s.plasmaTest_ib_size_xl.id, appearanceId: ibApp, tokenId: tokenMap['round.l'].id, state: null },

    // ── L size ────────────────────────────────────────────────────────────────
    { propertyId: p.ib_height.id, styleId: s.plasmaTest_ib_size_l.id, appearanceId: ibApp, value: '56', state: null },
    { propertyId: p.ib_paddingStart.id, styleId: s.plasmaTest_ib_size_l.id, appearanceId: ibApp, value: '16', state: null },
    { propertyId: p.ib_paddingEnd.id, styleId: s.plasmaTest_ib_size_l.id, appearanceId: ibApp, value: '16', state: null },
    { propertyId: p.ib_minWidth.id, styleId: s.plasmaTest_ib_size_l.id, appearanceId: ibApp, value: '56', state: null },
    { propertyId: p.ib_iconSize.id, styleId: s.plasmaTest_ib_size_l.id, appearanceId: ibApp, value: '24', state: null },
    { propertyId: p.ib_spinnerSize.id, styleId: s.plasmaTest_ib_size_l.id, appearanceId: ibApp, value: '22', state: null },
    { propertyId: p.ib_spinnerStrokeWidth.id, styleId: s.plasmaTest_ib_size_l.id, appearanceId: ibApp, value: '2', state: null },
    { propertyId: p.ib_shape.id, styleId: s.plasmaTest_ib_size_l.id, appearanceId: ibApp, tokenId: tokenMap['round.l'].id, state: null },

    // ── M size ────────────────────────────────────────────────────────────────
    { propertyId: p.ib_height.id, styleId: s.plasmaTest_ib_size_m.id, appearanceId: ibApp, value: '48', state: null },
    { propertyId: p.ib_paddingStart.id, styleId: s.plasmaTest_ib_size_m.id, appearanceId: ibApp, value: '12', state: null },
    { propertyId: p.ib_paddingEnd.id, styleId: s.plasmaTest_ib_size_m.id, appearanceId: ibApp, value: '12', state: null },
    { propertyId: p.ib_minWidth.id, styleId: s.plasmaTest_ib_size_m.id, appearanceId: ibApp, value: '48', state: null },
    { propertyId: p.ib_iconSize.id, styleId: s.plasmaTest_ib_size_m.id, appearanceId: ibApp, value: '24', state: null },
    { propertyId: p.ib_spinnerSize.id, styleId: s.plasmaTest_ib_size_m.id, appearanceId: ibApp, value: '22', state: null },
    { propertyId: p.ib_spinnerStrokeWidth.id, styleId: s.plasmaTest_ib_size_m.id, appearanceId: ibApp, value: '2', state: null },
    { propertyId: p.ib_shape.id, styleId: s.plasmaTest_ib_size_m.id, appearanceId: ibApp, tokenId: tokenMap['round.m'].id, state: null },

    // ── Shape: pilled ─────────────────────────────────────────────────────────
    { propertyId: p.ib_shape.id, styleId: s.plasmaTest_ib_shape_pilled.id, appearanceId: ibApp, tokenId: tokenMap['round.circle'].id, state: null },

    // ══════════════════════════════════════════════════════════════════════════
    // Button
    // ══════════════════════════════════════════════════════════════════════════

    // ── Default view ──────────────────────────────────────────────────────────
    // backgroundColor
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_default.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.solid-default'].id, state: null },
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_default.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.solid-default-active'].id, state: 'pressed' },
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_default.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.solid-default-hover'].id, state: 'hovered' },
    // loadingBackgroundColor
    { propertyId: p.btn_loadingBackgroundColor.id, styleId: s.plasmaTest_btn_view_default.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.solid-default'].id, state: null },
    // labelColor
    { propertyId: p.btn_labelColor.id, styleId: s.plasmaTest_btn_view_default.id, appearanceId: btnApp, tokenId: tokenMap['text.inverse.primary'].id, state: null },
    // iconColor
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_default.id, appearanceId: btnApp, tokenId: tokenMap['text.inverse.primary'].id, state: null },
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_default.id, appearanceId: btnApp, tokenId: tokenMap['text.inverse.primary'].id, state: 'pressed' },
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_default.id, appearanceId: btnApp, tokenId: tokenMap['text.inverse.primary'].id, state: 'hovered' },
    // spinnerColor
    { propertyId: p.btn_spinnerColor.id, styleId: s.plasmaTest_btn_view_default.id, appearanceId: btnApp, tokenId: tokenMap['text.inverse.primary'].id, state: null },
    // valueColor
    { propertyId: p.btn_valueColor.id, styleId: s.plasmaTest_btn_view_default.id, appearanceId: btnApp, tokenId: tokenMap['text.inverse.secondary'].id, state: null },

    // ── Secondary view ────────────────────────────────────────────────────────
    // backgroundColor
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_secondary.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.transparent-secondary'].id, state: null },
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_secondary.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.transparent-secondary-active'].id, state: 'pressed' },
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_secondary.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.transparent-secondary-hover'].id, state: 'hovered' },
    // loadingBackgroundColor
    { propertyId: p.btn_loadingBackgroundColor.id, styleId: s.plasmaTest_btn_view_secondary.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.transparent-secondary'].id, state: null },
    // labelColor
    { propertyId: p.btn_labelColor.id, styleId: s.plasmaTest_btn_view_secondary.id, appearanceId: btnApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    // iconColor
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_secondary.id, appearanceId: btnApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_secondary.id, appearanceId: btnApp, tokenId: tokenMap['text.default.primary-active'].id, state: 'pressed' },
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_secondary.id, appearanceId: btnApp, tokenId: tokenMap['text.default.primary-hover'].id, state: 'hovered' },
    // spinnerColor
    { propertyId: p.btn_spinnerColor.id, styleId: s.plasmaTest_btn_view_secondary.id, appearanceId: btnApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    // valueColor
    { propertyId: p.btn_valueColor.id, styleId: s.plasmaTest_btn_view_secondary.id, appearanceId: btnApp, tokenId: tokenMap['text.default.secondary'].id, state: null },

    // ── Accent view ───────────────────────────────────────────────────────────
    // backgroundColor
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_accent.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.accent'].id, state: null },
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_accent.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.accent-active'].id, state: 'pressed' },
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_accent.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.accent-hover'].id, state: 'hovered' },
    // loadingBackgroundColor
    { propertyId: p.btn_loadingBackgroundColor.id, styleId: s.plasmaTest_btn_view_accent.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.accent'].id, state: null },
    // labelColor
    { propertyId: p.btn_labelColor.id, styleId: s.plasmaTest_btn_view_accent.id, appearanceId: btnApp, tokenId: tokenMap['text.on-dark.primary'].id, state: null },
    // iconColor
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_accent.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.accent'].id, state: null },
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_accent.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.accent-active'].id, state: 'pressed' },
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_accent.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.accent-hover'].id, state: 'hovered' },
    // spinnerColor
    { propertyId: p.btn_spinnerColor.id, styleId: s.plasmaTest_btn_view_accent.id, appearanceId: btnApp, tokenId: tokenMap['text.on-dark.primary'].id, state: null },
    // valueColor
    { propertyId: p.btn_valueColor.id, styleId: s.plasmaTest_btn_view_accent.id, appearanceId: btnApp, tokenId: tokenMap['text.on-dark.secondary'].id, state: null },

    // ── Clear view ────────────────────────────────────────────────────────────
    // backgroundColor
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_clear.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.clear'].id, state: null },
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_clear.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.transparent-secondary-active'].id, state: 'pressed' },
    { propertyId: p.btn_backgroundColor.id, styleId: s.plasmaTest_btn_view_clear.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.transparent-secondary-hover'].id, state: 'hovered' },
    // loadingBackgroundColor
    { propertyId: p.btn_loadingBackgroundColor.id, styleId: s.plasmaTest_btn_view_clear.id, appearanceId: btnApp, tokenId: tokenMap['surface.default.clear'].id, state: null },
    // labelColor
    { propertyId: p.btn_labelColor.id, styleId: s.plasmaTest_btn_view_clear.id, appearanceId: btnApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    // iconColor
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_clear.id, appearanceId: btnApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_clear.id, appearanceId: btnApp, tokenId: tokenMap['text.default.primary-active'].id, state: 'pressed' },
    { propertyId: p.btn_iconColor.id, styleId: s.plasmaTest_btn_view_clear.id, appearanceId: btnApp, tokenId: tokenMap['text.default.primary-hover'].id, state: 'hovered' },
    // spinnerColor
    { propertyId: p.btn_spinnerColor.id, styleId: s.plasmaTest_btn_view_clear.id, appearanceId: btnApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    // valueColor
    { propertyId: p.btn_valueColor.id, styleId: s.plasmaTest_btn_view_clear.id, appearanceId: btnApp, tokenId: tokenMap['text.default.secondary'].id, state: null },

    // ── XL size ───────────────────────────────────────────────────────────────
    { propertyId: p.btn_height.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, value: '64', state: null },
    { propertyId: p.btn_paddingStart.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, value: '28', state: null },
    { propertyId: p.btn_paddingEnd.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, value: '28', state: null },
    { propertyId: p.btn_minWidth.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, value: '200', state: null },
    { propertyId: p.btn_iconSize.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, value: '24', state: null },
    { propertyId: p.btn_spinnerSize.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, value: '24', state: null },
    { propertyId: p.btn_spinnerStrokeWidth.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, value: '2', state: null },
    { propertyId: p.btn_iconMargin.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, value: '10', state: null },
    { propertyId: p.btn_valueMargin.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, value: '2', state: null },
    { propertyId: p.btn_labelStyle.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, tokenId: tokenMap['screen-s.body.l.bold'].id, state: null },
    { propertyId: p.btn_valueStyle.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, tokenId: tokenMap['screen-s.body.l.bold'].id, state: null },
    { propertyId: p.btn_shape.id, styleId: s.plasmaTest_btn_size_xl.id, appearanceId: btnApp, tokenId: tokenMap['round.l'].id, state: null },

    // ── L size ────────────────────────────────────────────────────────────────
    { propertyId: p.btn_height.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, value: '56', state: null },
    { propertyId: p.btn_paddingStart.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, value: '24', state: null },
    { propertyId: p.btn_paddingEnd.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, value: '24', state: null },
    { propertyId: p.btn_minWidth.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, value: '200', state: null },
    { propertyId: p.btn_iconSize.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, value: '22', state: null },
    { propertyId: p.btn_spinnerSize.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, value: '22', state: null },
    { propertyId: p.btn_spinnerStrokeWidth.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, value: '2', state: null },
    { propertyId: p.btn_iconMargin.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, value: '8', state: null },
    { propertyId: p.btn_valueMargin.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, value: '2', state: null },
    { propertyId: p.btn_labelStyle.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, tokenId: tokenMap['screen-s.body.l.bold'].id, state: null },
    { propertyId: p.btn_valueStyle.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, tokenId: tokenMap['screen-s.body.l.bold'].id, state: null },
    { propertyId: p.btn_shape.id, styleId: s.plasmaTest_btn_size_l.id, appearanceId: btnApp, tokenId: tokenMap['round.l'].id, state: null },

    // ── M size ────────────────────────────────────────────────────────────────
    { propertyId: p.btn_height.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, value: '48', state: null },
    { propertyId: p.btn_paddingStart.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, value: '20', state: null },
    { propertyId: p.btn_paddingEnd.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, value: '20', state: null },
    { propertyId: p.btn_minWidth.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, value: '180', state: null },
    { propertyId: p.btn_iconSize.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, value: '22', state: null },
    { propertyId: p.btn_spinnerSize.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, value: '22', state: null },
    { propertyId: p.btn_spinnerStrokeWidth.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, value: '2', state: null },
    { propertyId: p.btn_iconMargin.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, value: '6', state: null },
    { propertyId: p.btn_valueMargin.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, value: '2', state: null },
    { propertyId: p.btn_labelStyle.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, tokenId: tokenMap['screen-s.body.m.bold'].id, state: null },
    { propertyId: p.btn_valueStyle.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, tokenId: tokenMap['screen-s.body.m.bold'].id, state: null },
    { propertyId: p.btn_shape.id, styleId: s.plasmaTest_btn_size_m.id, appearanceId: btnApp, tokenId: tokenMap['round.m'].id, state: null },

    // ── Shape: pilled ─────────────────────────────────────────────────────────
    { propertyId: p.btn_shape.id, styleId: s.plasmaTest_btn_shape_pilled.id, appearanceId: btnApp, tokenId: tokenMap['round.circle'].id, state: null },

    // ══════════════════════════════════════════════════════════════════════════
    // Link
    // ══════════════════════════════════════════════════════════════════════════

    // ── Default view ──────────────────────────────────────────────────────────
    // textColor
    { propertyId: p.link_textColor.id, styleId: s.plasmaTest_link_view_default.id, appearanceId: linkApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    { propertyId: p.link_textColor.id, styleId: s.plasmaTest_link_view_default.id, appearanceId: linkApp, tokenId: tokenMap['text.default.primary-active'].id, state: 'pressed' },
    { propertyId: p.link_textColor.id, styleId: s.plasmaTest_link_view_default.id, appearanceId: linkApp, tokenId: tokenMap['text.default.primary-hover'].id, state: 'hovered' },
    // textColorVisited
    { propertyId: p.link_textColorVisited.id, styleId: s.plasmaTest_link_view_default.id, appearanceId: linkApp, tokenId: tokenMap['text.default.secondary'].id, state: null },
    { propertyId: p.link_textColorVisited.id, styleId: s.plasmaTest_link_view_default.id, appearanceId: linkApp, tokenId: tokenMap['text.default.secondary-active'].id, state: 'pressed' },
    { propertyId: p.link_textColorVisited.id, styleId: s.plasmaTest_link_view_default.id, appearanceId: linkApp, tokenId: tokenMap['text.default.secondary-hover'].id, state: 'hovered' },
    // underlineBorderWidth
    { propertyId: p.link_underlineBorderWidth.id, styleId: s.plasmaTest_link_view_default.id, appearanceId: linkApp, value: '0', state: null },

    // ── Secondary view ────────────────────────────────────────────────────────
    // textColor
    { propertyId: p.link_textColor.id, styleId: s.plasmaTest_link_view_secondary.id, appearanceId: linkApp, tokenId: tokenMap['text.default.secondary'].id, state: null },
    { propertyId: p.link_textColor.id, styleId: s.plasmaTest_link_view_secondary.id, appearanceId: linkApp, tokenId: tokenMap['text.default.secondary-active'].id, state: 'pressed' },
    { propertyId: p.link_textColor.id, styleId: s.plasmaTest_link_view_secondary.id, appearanceId: linkApp, tokenId: tokenMap['text.default.secondary-hover'].id, state: 'hovered' },
    // textColorVisited
    { propertyId: p.link_textColorVisited.id, styleId: s.plasmaTest_link_view_secondary.id, appearanceId: linkApp, tokenId: tokenMap['text.default.tertiary'].id, state: null },
    { propertyId: p.link_textColorVisited.id, styleId: s.plasmaTest_link_view_secondary.id, appearanceId: linkApp, tokenId: tokenMap['text.default.tertiary-active'].id, state: 'pressed' },
    { propertyId: p.link_textColorVisited.id, styleId: s.plasmaTest_link_view_secondary.id, appearanceId: linkApp, tokenId: tokenMap['text.default.tertiary-hover'].id, state: 'hovered' },
    // underlineBorderWidth
    { propertyId: p.link_underlineBorderWidth.id, styleId: s.plasmaTest_link_view_secondary.id, appearanceId: linkApp, value: '0', state: null },

    // ── Accent view ───────────────────────────────────────────────────────────
    // textColor
    { propertyId: p.link_textColor.id, styleId: s.plasmaTest_link_view_accent.id, appearanceId: linkApp, tokenId: tokenMap['text.default.accent'].id, state: null },
    { propertyId: p.link_textColor.id, styleId: s.plasmaTest_link_view_accent.id, appearanceId: linkApp, tokenId: tokenMap['text.default.accent-active'].id, state: 'pressed' },
    { propertyId: p.link_textColor.id, styleId: s.plasmaTest_link_view_accent.id, appearanceId: linkApp, tokenId: tokenMap['text.default.accent-hover'].id, state: 'hovered' },
    // textColorVisited
    { propertyId: p.link_textColorVisited.id, styleId: s.plasmaTest_link_view_accent.id, appearanceId: linkApp, tokenId: tokenMap['text.default.accent-minor'].id, state: null },
    { propertyId: p.link_textColorVisited.id, styleId: s.plasmaTest_link_view_accent.id, appearanceId: linkApp, tokenId: tokenMap['text.default.accent-minor-active'].id, state: 'pressed' },
    { propertyId: p.link_textColorVisited.id, styleId: s.plasmaTest_link_view_accent.id, appearanceId: linkApp, tokenId: tokenMap['text.default.accent-minor-hover'].id, state: 'hovered' },
    // underlineBorderWidth
    { propertyId: p.link_underlineBorderWidth.id, styleId: s.plasmaTest_link_view_accent.id, appearanceId: linkApp, value: '0', state: null },

    // ── Clear view ──────────────────────────────────────────────────────────
    // textColor
    { propertyId: p.link_textColor.id, styleId: s.plasmaTest_link_view_clear.id, appearanceId: linkApp, value: 'inherit', state: null },
    // textColorVisited
    { propertyId: p.link_textColorVisited.id, styleId: s.plasmaTest_link_view_clear.id, appearanceId: linkApp, value: 'inherit', state: null },
    // underlineBorderWidth
    { propertyId: p.link_underlineBorderWidth.id, styleId: s.plasmaTest_link_view_clear.id, appearanceId: linkApp, value: '1', state: null },

    // ── S size ──────────────────────────────────────────────────────────────
    { propertyId: p.link_textStyle.id, styleId: s.plasmaTest_link_size_s.id, appearanceId: linkApp, tokenId: tokenMap['screen-s.body.s.normal'].id, state: null },

    // ── M size ──────────────────────────────────────────────────────────────
    { propertyId: p.link_textStyle.id, styleId: s.plasmaTest_link_size_m.id, appearanceId: linkApp, tokenId: tokenMap['screen-s.body.m.normal'].id, state: null },

    // ── L size ──────────────────────────────────────────────────────────────
    { propertyId: p.link_textStyle.id, styleId: s.plasmaTest_link_size_l.id, appearanceId: linkApp, tokenId: tokenMap['screen-s.body.l.normal'].id, state: null },

    // ══════════════════════════════════════════════════════════════════════════
    // Checkbox
    // ══════════════════════════════════════════════════════════════════════════

    // ── Accent view ───────────────────────────────────────────────────────────
    { propertyId: p.cb_toggleCheckedBackgroundColor.id, styleId: s.plasmaTest_cb_view_accent.id, appearanceId: cbApp, tokenId: tokenMap['text.default.accent'].id, state: null },
    { propertyId: p.cb_iconColor.id, styleId: s.plasmaTest_cb_view_accent.id, appearanceId: cbApp, tokenId: tokenMap['text.on-dark.primary'].id, state: null },
    { propertyId: p.cb_labelColor.id, styleId: s.plasmaTest_cb_view_accent.id, appearanceId: cbApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    { propertyId: p.cb_descriptionColor.id, styleId: s.plasmaTest_cb_view_accent.id, appearanceId: cbApp, tokenId: tokenMap['text.default.secondary'].id, state: null },
    { propertyId: p.cb_toggleBackgroundColor.id, styleId: s.plasmaTest_cb_view_accent.id, appearanceId: cbApp, value: 'transparent', state: null },
    { propertyId: p.cb_toggleBorderColor.id, styleId: s.plasmaTest_cb_view_accent.id, appearanceId: cbApp, tokenId: tokenMap['text.default.secondary'].id, state: null },
    { propertyId: p.cb_toggleCheckedBorderColor.id, styleId: s.plasmaTest_cb_view_accent.id, appearanceId: cbApp, value: 'transparent', state: null },

    // ── Negative view ─────────────────────────────────────────────────────────
    { propertyId: p.cb_toggleCheckedBackgroundColor.id, styleId: s.plasmaTest_cb_view_negative.id, appearanceId: cbApp, tokenId: tokenMap['text.default.negative'].id, state: null },
    { propertyId: p.cb_iconColor.id, styleId: s.plasmaTest_cb_view_negative.id, appearanceId: cbApp, tokenId: tokenMap['text.on-dark.primary'].id, state: null },
    { propertyId: p.cb_labelColor.id, styleId: s.plasmaTest_cb_view_negative.id, appearanceId: cbApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    { propertyId: p.cb_descriptionColor.id, styleId: s.plasmaTest_cb_view_negative.id, appearanceId: cbApp, tokenId: tokenMap['text.default.secondary'].id, state: null },
    { propertyId: p.cb_toggleBackgroundColor.id, styleId: s.plasmaTest_cb_view_negative.id, appearanceId: cbApp, value: 'transparent', state: null },
    { propertyId: p.cb_toggleBorderColor.id, styleId: s.plasmaTest_cb_view_negative.id, appearanceId: cbApp, tokenId: tokenMap['text.default.negative'].id, state: null },
    { propertyId: p.cb_toggleCheckedBorderColor.id, styleId: s.plasmaTest_cb_view_negative.id, appearanceId: cbApp, value: 'transparent', state: null },

    // ── S size ──────────────────────────────────────────────────────────────
    { propertyId: p.cb_margin.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, value: '0', state: null },
    { propertyId: p.cb_togglePadding.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, value: '1', state: null },
    { propertyId: p.cb_toggleWidth.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, value: '14', state: null },
    { propertyId: p.cb_toggleHeight.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, value: '14', state: null },
    { propertyId: p.cb_toggleShape.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, tokenId: tokenMap['round.xxs'].id, state: null },
    { propertyId: p.cb_toggleBorderWidth.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, value: '1', state: null },
    { propertyId: p.cb_verticalPadding.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, value: '0', state: null },
    { propertyId: p.cb_horizontalPadding.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, value: '8', state: null },
    { propertyId: p.cb_descriptionPadding.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, value: '2', state: null },
    { propertyId: p.cb_labelStyle.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, tokenId: tokenMap['screen-s.body.s.normal'].id, state: null },
    { propertyId: p.cb_descriptionStyle.id, styleId: s.plasmaTest_cb_size_s.id, appearanceId: cbApp, tokenId: tokenMap['screen-s.body.xs.normal'].id, state: null },

    // ── M size ──────────────────────────────────────────────────────────────
    { propertyId: p.cb_margin.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, value: '0', state: null },
    { propertyId: p.cb_togglePadding.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, value: '2', state: null },
    { propertyId: p.cb_toggleWidth.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, value: '20', state: null },
    { propertyId: p.cb_toggleHeight.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, value: '20', state: null },
    { propertyId: p.cb_toggleShape.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, tokenId: tokenMap['round.xs'].id, state: null },
    { propertyId: p.cb_toggleBorderWidth.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, value: '2', state: null },
    { propertyId: p.cb_verticalPadding.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, value: '1', state: null },
    { propertyId: p.cb_horizontalPadding.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, value: '12', state: null },
    { propertyId: p.cb_descriptionPadding.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, value: '2', state: null },
    { propertyId: p.cb_labelStyle.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, tokenId: tokenMap['screen-s.body.m.normal'].id, state: null },
    { propertyId: p.cb_descriptionStyle.id, styleId: s.plasmaTest_cb_size_m.id, appearanceId: cbApp, tokenId: tokenMap['screen-s.body.s.normal'].id, state: null },

    // ── L size ──────────────────────────────────────────────────────────────
    { propertyId: p.cb_margin.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, value: '0', state: null },
    { propertyId: p.cb_togglePadding.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, value: '2', state: null },
    { propertyId: p.cb_toggleWidth.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, value: '20', state: null },
    { propertyId: p.cb_toggleHeight.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, value: '20', state: null },
    { propertyId: p.cb_toggleShape.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, tokenId: tokenMap['round.xs'].id, state: null },
    { propertyId: p.cb_toggleBorderWidth.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, value: '2', state: null },
    { propertyId: p.cb_verticalPadding.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, value: '1', state: null },
    { propertyId: p.cb_horizontalPadding.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, value: '12', state: null },
    { propertyId: p.cb_descriptionPadding.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, value: '2', state: null },
    { propertyId: p.cb_labelStyle.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, tokenId: tokenMap['screen-s.body.l.normal'].id, state: null },
    { propertyId: p.cb_descriptionStyle.id, styleId: s.plasmaTest_cb_size_l.id, appearanceId: cbApp, tokenId: tokenMap['screen-s.body.m.normal'].id, state: null },

    // ══════════════════════════════════════════════════════════════════════════
    // Radiobox
    // ══════════════════════════════════════════════════════════════════════════

    // ── Accent view ─────────────────────────────────────────────────────────
    { propertyId: p.rb_toggleCheckedBackgroundColor.id, styleId: s.plasmaTest_rb_view_accent.id, appearanceId: rbApp, tokenId: tokenMap['text.default.accent'].id, state: null },
    { propertyId: p.rb_ellipseColor.id, styleId: s.plasmaTest_rb_view_accent.id, appearanceId: rbApp, tokenId: tokenMap['text.on-dark.primary'].id, state: null },
    { propertyId: p.rb_labelColor.id, styleId: s.plasmaTest_rb_view_accent.id, appearanceId: rbApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    { propertyId: p.rb_descriptionColor.id, styleId: s.plasmaTest_rb_view_accent.id, appearanceId: rbApp, tokenId: tokenMap['text.default.secondary'].id, state: null },
    { propertyId: p.rb_toggleBackgroundColor.id, styleId: s.plasmaTest_rb_view_accent.id, appearanceId: rbApp, value: 'transparent', state: null },
    { propertyId: p.rb_toggleCheckedBorderColor.id, styleId: s.plasmaTest_rb_view_accent.id, appearanceId: rbApp, value: 'transparent', state: null },
    { propertyId: p.rb_toggleBorderColor.id, styleId: s.plasmaTest_rb_view_accent.id, appearanceId: rbApp, tokenId: tokenMap['text.default.secondary'].id, state: null },

    // ── Negative view ───────────────────────────────────────────────────────
    { propertyId: p.rb_toggleCheckedBackgroundColor.id, styleId: s.plasmaTest_rb_view_negative.id, appearanceId: rbApp, tokenId: tokenMap['text.default.negative'].id, state: null },
    { propertyId: p.rb_ellipseColor.id, styleId: s.plasmaTest_rb_view_negative.id, appearanceId: rbApp, tokenId: tokenMap['text.on-dark.primary'].id, state: null },
    { propertyId: p.rb_labelColor.id, styleId: s.plasmaTest_rb_view_negative.id, appearanceId: rbApp, tokenId: tokenMap['text.default.primary'].id, state: null },
    { propertyId: p.rb_descriptionColor.id, styleId: s.plasmaTest_rb_view_negative.id, appearanceId: rbApp, tokenId: tokenMap['text.default.secondary'].id, state: null },
    { propertyId: p.rb_toggleBackgroundColor.id, styleId: s.plasmaTest_rb_view_negative.id, appearanceId: rbApp, value: 'transparent', state: null },
    { propertyId: p.rb_toggleCheckedBorderColor.id, styleId: s.plasmaTest_rb_view_negative.id, appearanceId: rbApp, value: 'transparent', state: null },
    { propertyId: p.rb_toggleBorderColor.id, styleId: s.plasmaTest_rb_view_negative.id, appearanceId: rbApp, tokenId: tokenMap['text.default.negative'].id, state: null },

    // ── S size ──────────────────────────────────────────────────────────────
    { propertyId: p.rb_margin.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, value: '0', state: null },
    { propertyId: p.rb_togglePadding.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, value: '1', state: null },
    { propertyId: p.rb_toggleWidth.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, value: '16', state: null },
    { propertyId: p.rb_toggleHeight.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, value: '16', state: null },
    { propertyId: p.rb_ellipseWidth.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, value: '8', state: null },
    { propertyId: p.rb_ellipseHeight.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, value: '8', state: null },
    { propertyId: p.rb_toggleShape.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, tokenId: tokenMap['round.xl'].id, state: null },
    { propertyId: p.rb_toggleBorderWidth.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, value: '1', state: null },
    { propertyId: p.rb_verticalPadding.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, value: '0', state: null },
    { propertyId: p.rb_horizontalPadding.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, value: '8', state: null },
    { propertyId: p.rb_descriptionPadding.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, value: '2', state: null },
    { propertyId: p.rb_labelStyle.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, tokenId: tokenMap['screen-s.body.s.normal'].id, state: null },
    { propertyId: p.rb_descriptionStyle.id, styleId: s.plasmaTest_rb_size_s.id, appearanceId: rbApp, tokenId: tokenMap['screen-s.body.xs.normal'].id, state: null },

    // ── M size ──────────────────────────────────────────────────────────────
    { propertyId: p.rb_margin.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, value: '0', state: null },
    { propertyId: p.rb_togglePadding.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, value: '1', state: null },
    { propertyId: p.rb_toggleWidth.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, value: '22', state: null },
    { propertyId: p.rb_toggleHeight.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, value: '22', state: null },
    { propertyId: p.rb_ellipseWidth.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, value: '10', state: null },
    { propertyId: p.rb_ellipseHeight.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, value: '10', state: null },
    { propertyId: p.rb_toggleShape.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, tokenId: tokenMap['round.xl'].id, state: null },
    { propertyId: p.rb_toggleBorderWidth.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, value: '2', state: null },
    { propertyId: p.rb_verticalPadding.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, value: '1', state: null },
    { propertyId: p.rb_horizontalPadding.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, value: '12', state: null },
    { propertyId: p.rb_descriptionPadding.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, value: '2', state: null },
    { propertyId: p.rb_labelStyle.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, tokenId: tokenMap['screen-s.body.m.normal'].id, state: null },
    { propertyId: p.rb_descriptionStyle.id, styleId: s.plasmaTest_rb_size_m.id, appearanceId: rbApp, tokenId: tokenMap['screen-s.body.s.normal'].id, state: null },

    // ── L size ──────────────────────────────────────────────────────────────
    { propertyId: p.rb_margin.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, value: '0', state: null },
    { propertyId: p.rb_togglePadding.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, value: '1', state: null },
    { propertyId: p.rb_toggleWidth.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, value: '22', state: null },
    { propertyId: p.rb_toggleHeight.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, value: '22', state: null },
    { propertyId: p.rb_ellipseWidth.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, value: '10', state: null },
    { propertyId: p.rb_ellipseHeight.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, value: '10', state: null },
    { propertyId: p.rb_toggleShape.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, tokenId: tokenMap['round.xl'].id, state: null },
    { propertyId: p.rb_toggleBorderWidth.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, value: '2', state: null },
    { propertyId: p.rb_verticalPadding.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, value: '1', state: null },
    { propertyId: p.rb_horizontalPadding.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, value: '12', state: null },
    { propertyId: p.rb_descriptionPadding.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, value: '2', state: null },
    { propertyId: p.rb_labelStyle.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, tokenId: tokenMap['screen-s.body.l.normal'].id, state: null },
    { propertyId: p.rb_descriptionStyle.id, styleId: s.plasmaTest_rb_size_l.id, appearanceId: rbApp, tokenId: tokenMap['screen-s.body.m.normal'].id, state: null },
  ];

  const inserted = await db.insert(schema.variationPropertyValues).values(rows).returning();
  console.log(`  variation_property_values: ${inserted.length} rows`);
  return inserted;
}
