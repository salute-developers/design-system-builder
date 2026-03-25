import * as schema from '../../schema';

type VpvRow = {
  propertyId: string;
  styleId: string;
  appearanceId: string;
  tokenId?: string | null;
  value?: string | null;
  state?: 'pressed' | 'hovered' | 'focused' | 'selected' | 'readonly' | 'disabled' | null;
};

function tok(p: string, s: string, a: string, t: string, state?: VpvRow['state']): VpvRow {
  return { propertyId: p, styleId: s, appearanceId: a, tokenId: t, state: state ?? null };
}
function val(p: string, s: string, a: string, value: string): VpvRow {
  return { propertyId: p, styleId: s, appearanceId: a, value, state: null };
}

export async function seedVariationPropertyValues(
  db: any,
  ctx: {
    tokens: { sdds: Record<string, any>; plasma: Record<string, any> };
    appearances: Record<string, any>;
    properties: Record<string, any>;
    styles: Record<string, any>;
  },
) {
  const st = ctx.tokens.sdds;
  const pt = ctx.tokens.plasma;
  const p = ctx.properties;
  const s = ctx.styles;
  const a = ctx.appearances;

  const rows: VpvRow[] = [
    // SDDS Button.View default
    tok(p.btn_backgroundColor.id, s.sdds_btn_view_primary.id, a.sdds_btn_default.id, st['text.default.accent'].id),
    tok(p.btn_backgroundColor.id, s.sdds_btn_view_primary.id, a.sdds_btn_default.id, st['text.default.secondary'].id, 'pressed'),
    tok(p.btn_labelColor.id, s.sdds_btn_view_primary.id, a.sdds_btn_default.id, st['text.default.primary'].id),
    tok(p.btn_labelColor.id, s.sdds_btn_view_primary.id, a.sdds_btn_default.id, st['text.default.accent'].id, 'hovered'),
    tok(p.btn_valueColor.id, s.sdds_btn_view_primary.id, a.sdds_btn_default.id, st['text.default.secondary'].id),
    tok(p.btn_backgroundColor.id, s.sdds_btn_view_secondary.id, a.sdds_btn_default.id, st['text.default.secondary'].id),
    tok(p.btn_labelColor.id, s.sdds_btn_view_secondary.id, a.sdds_btn_default.id, st['text.default.primary'].id),
    tok(p.btn_valueColor.id, s.sdds_btn_view_secondary.id, a.sdds_btn_default.id, st['text.default.primary'].id),
    // SDDS Button.View outline (same styles, different appearance)
    tok(p.btn_borderColor.id, s.sdds_btn_view_primary.id, a.sdds_btn_outline.id, st['text.default.accent'].id),
    tok(p.btn_labelColor.id, s.sdds_btn_view_primary.id, a.sdds_btn_outline.id, st['text.default.primary'].id),
    tok(p.btn_valueColor.id, s.sdds_btn_view_primary.id, a.sdds_btn_outline.id, st['text.default.secondary'].id),
    tok(p.btn_droppedShadow.id, s.sdds_btn_view_primary.id, a.sdds_btn_outline.id, st['up.hard.s'].id),
    // SDDS Button.Size default
    val(p.btn_height.id, s.sdds_btn_size_s.id, a.sdds_btn_default.id, '30'),
    val(p.btn_width.id, s.sdds_btn_size_s.id, a.sdds_btn_default.id, '200'),
    tok(p.btn_shape.id, s.sdds_btn_size_s.id, a.sdds_btn_default.id, st['round.xs'].id),
    val(p.btn_height.id, s.sdds_btn_size_m.id, a.sdds_btn_default.id, '4'),
    val(p.btn_width.id, s.sdds_btn_size_m.id, a.sdds_btn_default.id, '250'),
    tok(p.btn_shape.id, s.sdds_btn_size_m.id, a.sdds_btn_default.id, st['round.xs'].id),
    // SDDS Button.Size outline
    val(p.btn_height.id, s.sdds_btn_size_m.id, a.sdds_btn_outline.id, '4'),
    val(p.btn_width.id, s.sdds_btn_size_m.id, a.sdds_btn_outline.id, '250'),
    tok(p.btn_shape.id, s.sdds_btn_size_m.id, a.sdds_btn_outline.id, st['round.xs'].id),
    // SDDS Button.Shape default
    tok(p.btn_shape.id, s.sdds_btn_shape_rounded.id, a.sdds_btn_default.id, st['round.circle'].id),
    // SDDS Text.Size default
    tok(p.txt_fontStyle.id, s.sdds_txt_size_s.id, a.sdds_txt_default.id, st['screen-s.header.h2.normal'].id),
    // SDDS Link.View default
    tok(p.lnk_valueColor.id, s.sdds_lnk_view_primary.id, a.sdds_lnk_default.id, st['text.default.accent'].id),
    // SDDS Link.Size default
    val(p.lnk_underLineWidth.id, s.sdds_lnk_size_s.id, a.sdds_lnk_default.id, '0.5'),
    val(p.lnk_underLineWidth.id, s.sdds_lnk_size_m.id, a.sdds_lnk_default.id, '1'),
    // SDDS TextField.View default
    tok(p.tf_backgroundColor.id, s.sdds_tf_view_primary.id, a.sdds_tf_default.id, st['text.default.secondary'].id),
    tok(p.tf_valueColor.id, s.sdds_tf_view_primary.id, a.sdds_tf_default.id, st['text.default.primary'].id),
    // SDDS TextField.View outline
    tok(p.tf_borderColor.id, s.sdds_tf_view_primary.id, a.sdds_tf_outline.id, st['text.default.accent'].id),
    tok(p.tf_valueColor.id, s.sdds_tf_view_primary.id, a.sdds_tf_outline.id, st['text.default.primary'].id),
    // SDDS TextField.Size default
    tok(p.tf_valueFontStyle.id, s.sdds_tf_size_s.id, a.sdds_tf_default.id, st['screen-s.header.h2.normal'].id),
    tok(p.tf_valueFontStyle.id, s.sdds_tf_size_m.id, a.sdds_tf_default.id, st['screen-s.display.l.normal'].id),
    // SDDS TextField.Size outline
    tok(p.tf_valueFontStyle.id, s.sdds_tf_size_m.id, a.sdds_tf_outline.id, st['screen-s.display.l.normal'].id),
    // PLASMA Button.View default
    tok(p.btn_backgroundColor.id, s.plasma_btn_view_primary.id, a.plasma_btn_default.id, pt['text.default.accent'].id),
    tok(p.btn_labelColor.id, s.plasma_btn_view_primary.id, a.plasma_btn_default.id, pt['text.default.primary'].id),
    tok(p.btn_valueColor.id, s.plasma_btn_view_primary.id, a.plasma_btn_default.id, pt['text.default.secondary'].id),
    tok(p.btn_droppedShadow.id, s.plasma_btn_view_primary.id, a.plasma_btn_default.id, pt['up.hard.m'].id),
    tok(p.btn_backgroundColor.id, s.plasma_btn_view_secondary.id, a.plasma_btn_default.id, pt['text.default.secondary'].id),
    tok(p.btn_labelColor.id, s.plasma_btn_view_secondary.id, a.plasma_btn_default.id, pt['text.default.primary'].id),
    tok(p.btn_valueColor.id, s.plasma_btn_view_secondary.id, a.plasma_btn_default.id, pt['text.default.primary'].id),
    // PLASMA Button.Size default
    val(p.btn_height.id, s.plasma_btn_size_s.id, a.plasma_btn_default.id, '40'),
    val(p.btn_width.id, s.plasma_btn_size_s.id, a.plasma_btn_default.id, '200'),
    tok(p.btn_shape.id, s.plasma_btn_size_s.id, a.plasma_btn_default.id, pt['round.xxs'].id),
    val(p.btn_height.id, s.plasma_btn_size_m.id, a.plasma_btn_default.id, '44'),
    val(p.btn_width.id, s.plasma_btn_size_m.id, a.plasma_btn_default.id, '280'),
    tok(p.btn_shape.id, s.plasma_btn_size_m.id, a.plasma_btn_default.id, pt['round.xs'].id),
    // PLASMA Text.Size default
    tok(p.txt_fontStyle.id, s.plasma_txt_size_s.id, a.plasma_txt_default.id, pt['screen-s.header.h2.normal'].id),
    tok(p.txt_fontStyle.id, s.plasma_txt_size_m.id, a.plasma_txt_default.id, pt['screen-s.display.l.normal'].id),
    // PLASMA Link.View default
    tok(p.lnk_valueColor.id, s.plasma_lnk_view_primary.id, a.plasma_lnk_default.id, pt['text.default.accent'].id),
    // PLASMA Link.Size default
    val(p.lnk_underLineWidth.id, s.plasma_lnk_size_s.id, a.plasma_lnk_default.id, '1'),
    val(p.lnk_underLineWidth.id, s.plasma_lnk_size_m.id, a.plasma_lnk_default.id, '2'),
  ];

  const inserted = await db.insert(schema.variationPropertyValues).values(rows).returning();
  console.log(`  variation_property_values: ${inserted.length} rows`);
  return inserted;
}
