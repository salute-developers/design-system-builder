import * as schema from '../../schema';

export async function seedPropertyVariations(
    db: any,
    ctx: {
        properties: Record<string, any>;
        variations: Record<string, any>;
    },
) {
    const p = ctx.properties;
    const v = ctx.variations;

    const rows = await db
        .insert(schema.propertyVariations)
        .values([
            // ── IconButton ──────────────────────────────────────────────────────────
            // View
            { propertyId: p.ib_backgroundColor.id, variationId: v.iconButtonView.id },
            { propertyId: p.ib_loadingBackgroundColor.id, variationId: v.iconButtonView.id },
            { propertyId: p.ib_iconColor.id, variationId: v.iconButtonView.id },
            { propertyId: p.ib_spinnerColor.id, variationId: v.iconButtonView.id },
            // Size
            { propertyId: p.ib_height.id, variationId: v.iconButtonSize.id },
            { propertyId: p.ib_paddingStart.id, variationId: v.iconButtonSize.id },
            { propertyId: p.ib_paddingEnd.id, variationId: v.iconButtonSize.id },
            { propertyId: p.ib_minWidth.id, variationId: v.iconButtonSize.id },
            { propertyId: p.ib_iconSize.id, variationId: v.iconButtonSize.id },
            { propertyId: p.ib_spinnerSize.id, variationId: v.iconButtonSize.id },
            { propertyId: p.ib_spinnerStrokeWidth.id, variationId: v.iconButtonSize.id },
            { propertyId: p.ib_shape.id, variationId: v.iconButtonSize.id },
            // Shape
            { propertyId: p.ib_shape.id, variationId: v.iconButtonShape.id },

            // ── Button ──────────────────────────────────────────────────────────────
            // View
            { propertyId: p.btn_backgroundColor.id, variationId: v.buttonView.id },
            { propertyId: p.btn_loadingBackgroundColor.id, variationId: v.buttonView.id },
            { propertyId: p.btn_labelColor.id, variationId: v.buttonView.id },
            { propertyId: p.btn_iconColor.id, variationId: v.buttonView.id },
            { propertyId: p.btn_spinnerColor.id, variationId: v.buttonView.id },
            { propertyId: p.btn_valueColor.id, variationId: v.buttonView.id },
            // Size
            { propertyId: p.btn_shape.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_height.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_paddingStart.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_paddingEnd.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_minWidth.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_iconSize.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_spinnerSize.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_spinnerStrokeWidth.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_iconMargin.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_valueMargin.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_labelStyle.id, variationId: v.buttonSize.id },
            { propertyId: p.btn_valueStyle.id, variationId: v.buttonSize.id },
            // Shape
            { propertyId: p.btn_shape.id, variationId: v.buttonShape.id },

            // ── Link ────────────────────────────────────────────────────────────────
            // View
            { propertyId: p.link_textColor.id, variationId: v.linkView.id },
            { propertyId: p.link_textColorVisited.id, variationId: v.linkView.id },
            { propertyId: p.link_underlineBorderWidth.id, variationId: v.linkView.id },
            // Size
            { propertyId: p.link_textStyle.id, variationId: v.linkSize.id },

            // ── Checkbox ──────────────────────────────────────────────────────────────
            // View
            { propertyId: p.cb_toggleCheckedBackgroundColor.id, variationId: v.checkboxView.id },
            { propertyId: p.cb_iconColor.id, variationId: v.checkboxView.id },
            { propertyId: p.cb_labelColor.id, variationId: v.checkboxView.id },
            { propertyId: p.cb_descriptionColor.id, variationId: v.checkboxView.id },
            { propertyId: p.cb_toggleBackgroundColor.id, variationId: v.checkboxView.id },
            { propertyId: p.cb_toggleCheckedBorderColor.id, variationId: v.checkboxView.id },
            { propertyId: p.cb_toggleBorderColor.id, variationId: v.checkboxView.id },
            { propertyId: p.cb_toggleIndeterminateIconColor.id, variationId: v.checkboxView.id },
            // Size
            { propertyId: p.cb_margin.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_togglePadding.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_toggleShape.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_toggleBorderWidth.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_toggleCheckedBorderWidth.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_toggleWidth.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_toggleHeight.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_toggleCheckedIconWidth.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_toggleCheckedIconHeight.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_toggleIndeterminateIconWidth.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_toggleIndeterminateIconHeight.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_horizontalPadding.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_verticalPadding.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_descriptionPadding.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_labelStyle.id, variationId: v.checkboxSize.id },
            { propertyId: p.cb_descriptionStyle.id, variationId: v.checkboxSize.id },

            // ── Radiobox ──────────────────────────────────────────────────────────────
            // View
            { propertyId: p.rb_toggleCheckedBackgroundColor.id, variationId: v.radioboxView.id },
            { propertyId: p.rb_ellipseColor.id, variationId: v.radioboxView.id },
            { propertyId: p.rb_labelColor.id, variationId: v.radioboxView.id },
            { propertyId: p.rb_descriptionColor.id, variationId: v.radioboxView.id },
            { propertyId: p.rb_toggleBackgroundColor.id, variationId: v.radioboxView.id },
            { propertyId: p.rb_toggleCheckedBorderColor.id, variationId: v.radioboxView.id },
            { propertyId: p.rb_toggleBorderColor.id, variationId: v.radioboxView.id },
            // Size
            { propertyId: p.rb_margin.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_togglePadding.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_toggleShape.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_toggleBorderWidth.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_toggleCheckedBorderWidth.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_toggleWidth.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_toggleHeight.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_ellipseWidth.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_ellipseHeight.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_toggleCheckedIconWidth.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_toggleCheckedIconHeight.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_horizontalPadding.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_verticalPadding.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_descriptionPadding.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_labelStyle.id, variationId: v.radioboxSize.id },
            { propertyId: p.rb_descriptionStyle.id, variationId: v.radioboxSize.id },

            // ── Counter ──────────────────────────────────────────────────────────
            { propertyId: p.cou_color.id, variationId: v.counterView.id },
            { propertyId: p.cou_background.id, variationId: v.counterView.id },
            { propertyId: p.cou_shape.id, variationId: v.counterSize.id },
            { propertyId: p.cou_height.id, variationId: v.counterSize.id },
            { propertyId: p.cou_padding.id, variationId: v.counterSize.id },
            { propertyId: p.cou_labelStyle.id, variationId: v.counterSize.id },
        ])
        .onConflictDoNothing()
        .returning();

    console.log(`  property_variations: ${rows.length} rows`);
}
