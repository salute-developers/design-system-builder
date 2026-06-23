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

            // ── Indicator ──────────────────────────────────────────────────────────
            { propertyId: p.ind_size.id, variationId: v.indicatorSize.id },
            { propertyId: p.ind_color.id, variationId: v.indicatorView.id },

            // ── Badge ──────────────────────────────────────────────────────────
            { propertyId: p.bad_background.id, variationId: v.badgeView.id },
            { propertyId: p.bad_color.id, variationId: v.badgeView.id },
            { propertyId: p.bad_colorTransparent.id, variationId: v.badgeView.id },
            { propertyId: p.bad_backgroundTransparent.id, variationId: v.badgeView.id },
            { propertyId: p.bad_colorClear.id, variationId: v.badgeView.id },
            { propertyId: p.bad_shape.id, variationId: v.badgeSize.id },
            { propertyId: p.bad_height.id, variationId: v.badgeSize.id },
            { propertyId: p.bad_padding.id, variationId: v.badgeSize.id },
            { propertyId: p.bad_paddingIconOnly.id, variationId: v.badgeSize.id },
            { propertyId: p.bad_textStyle.id, variationId: v.badgeSize.id },
            { propertyId: p.bad_leftContentMarginLeft.id, variationId: v.badgeSize.id },
            { propertyId: p.bad_leftContentMarginRight.id, variationId: v.badgeSize.id },
            { propertyId: p.bad_rightContentMarginLeft.id, variationId: v.badgeSize.id },
            { propertyId: p.bad_rightContentMarginRight.id, variationId: v.badgeSize.id },
            { propertyId: p.bad_shape.id, variationId: v.badgeShape.id },

            // ── Spinner ──────────────────────────────────────────────────────────
            { propertyId: p.spi_size.id, variationId: v.spinnerSize.id },
            { propertyId: p.spi_color.id, variationId: v.spinnerView.id },

            // ── Chip ──────────────────────────────────────────────────────────
            { propertyId: p.chi_color.id, variationId: v.chipView.id },
            { propertyId: p.chi_background.id, variationId: v.chipView.id },
            { propertyId: p.chi_backgroundReadOnly.id, variationId: v.chipView.id },
            { propertyId: p.chi_colorReadOnly.id, variationId: v.chipView.id },
            { propertyId: p.chi_closeIconColor.id, variationId: v.chipView.id },
            { propertyId: p.chi_leftContentColor.id, variationId: v.chipView.id },
            { propertyId: p.chi_width.id, variationId: v.chipSize.id },
            { propertyId: p.chi_height.id, variationId: v.chipSize.id },
            { propertyId: p.chi_padding.id, variationId: v.chipSize.id },
            { propertyId: p.chi_textStyle.id, variationId: v.chipSize.id },
            { propertyId: p.chi_closeIconSize.id, variationId: v.chipSize.id },
            { propertyId: p.chi_clearContentMarginLeft.id, variationId: v.chipSize.id },
            { propertyId: p.chi_clearContentMarginRight.id, variationId: v.chipSize.id },
            { propertyId: p.chi_leftContentMarginRight.id, variationId: v.chipSize.id },
            { propertyId: p.chi_rightContentMarginRight.id, variationId: v.chipSize.id },
            { propertyId: p.chi_leftContentMarginLeft.id, variationId: v.chipSize.id },
            { propertyId: p.chi_rightContentMarginLeft.id, variationId: v.chipSize.id },
            { propertyId: p.chi_shape.id, variationId: v.chipSize.id },
            { propertyId: p.chi_outlineSize.id, variationId: v.chipSize.id },
            { propertyId: p.chi_shape.id, variationId: v.chipShape.id },

            // ── Switch ──────────────────────────────────────────────────────────
            { propertyId: p.swi_textStyle.id, variationId: v.switchComponentSize.id },
            { propertyId: p.swi_descriptionStyle.id, variationId: v.switchComponentSize.id },
            { propertyId: p.swi_verticalGap.id, variationId: v.switchComponentSize.id },
            { propertyId: p.swi_labelOffset.id, variationId: v.switchComponentSize.id },
            { propertyId: p.swi_trackWidth.id, variationId: v.switchComponentToggleSize.id },
            { propertyId: p.swi_trackHeight.id, variationId: v.switchComponentToggleSize.id },
            { propertyId: p.swi_trackBorderRadius.id, variationId: v.switchComponentToggleSize.id },
            { propertyId: p.swi_thumbSize.id, variationId: v.switchComponentToggleSize.id },
            { propertyId: p.swi_thumbBorderRadius.id, variationId: v.switchComponentToggleSize.id },
            { propertyId: p.swi_thumbOffsetOn.id, variationId: v.switchComponentToggleSize.id },
            { propertyId: p.swi_thumbOffsetOff.id, variationId: v.switchComponentToggleSize.id },
            { propertyId: p.swi_thumbPressScale.id, variationId: v.switchComponentToggleSize.id },
            { propertyId: p.swi_labelColor.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_descriptionColor.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_descriptionMaxLines.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_trackBackgroundColorOff.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_trackBackgroundColorOn.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_trackBorderWidthOn.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_trackBorderWidthOff.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_thumbBackgroundColorOn.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_thumbBackgroundColorOff.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_trackBorderColorOn.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_trackBorderColorOff.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_thumbBorderColorOff.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_thumbBorderColorOn.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_thumbBoxShadow.id, variationId: v.switchComponentView.id },
            { propertyId: p.swi_thumbBorderWidth.id, variationId: v.switchComponentToggleSize.id },

            // ── Skeleton ──────────────────────────────────────────────────────────
            { propertyId: p.ske_fadeOutColor.id, variationId: v.skeletonView.id },
            { propertyId: p.ske_fadeInColor.id, variationId: v.skeletonView.id },
            { propertyId: p.ske_lineHeight.id, variationId: v.skeletonSize.id },
            { propertyId: p.ske_visibleLineHeight.id, variationId: v.skeletonSize.id },

            // ── List ──────────────────────────────────────────────────────────
            { propertyId: p.lis_listItemColor.id, variationId: v.listView.id },
            { propertyId: p.lis_listItemBackground.id, variationId: v.listView.id },
            { propertyId: p.lis_listItemBorderColor.id, variationId: v.listView.id },
            { propertyId: p.lis_listGap.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemPaddingRight.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemPaddingBottom.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemPaddingLeft.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemPaddingTop.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemBorderRadius.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemBorderWidth.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemGap.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemTightDifference.id, variationId: v.listSize.id },
            { propertyId: p.lis_litItemStyle.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemDividerWidth.id, variationId: v.listSize.id },
            { propertyId: p.lis_listBackground.id, variationId: v.listView.id },
            { propertyId: p.lis_listPadding.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemDividerColor.id, variationId: v.listView.id },
            { propertyId: p.lis_listBorderRadius.id, variationId: v.listSize.id },
            { propertyId: p.lis_listItemContentPadding.id, variationId: v.listSize.id },

            // ── LinkButton ──────────────────────────────────────────────────────────
            { propertyId: p.lin_linkButtonColor.id, variationId: v.linkButtonView.id },
            { propertyId: p.lin_linkButtonTextColor.id, variationId: v.linkButtonView.id },
            { propertyId: p.lin_linkButtonIconColor.id, variationId: v.linkButtonView.id },
            { propertyId: p.lin_linkButtonBackgroundColor.id, variationId: v.linkButtonView.id },
            { propertyId: p.lin_linkButtonHeight.id, variationId: v.linkButtonSize.id },
            { propertyId: p.lin_linkButtonPadding.id, variationId: v.linkButtonSize.id },
            { propertyId: p.lin_linkButtonRadius.id, variationId: v.linkButtonSize.id },
            { propertyId: p.lin_textStyle.id, variationId: v.linkButtonSize.id },
            { propertyId: p.lin_linkButtonSpinnerSize.id, variationId: v.linkButtonSize.id },
            { propertyId: p.lin_linkButtonTextPadding.id, variationId: v.linkButtonSize.id },
            { propertyId: p.lin_linkButtonLeftContentMargin.id, variationId: v.linkButtonSize.id },
            { propertyId: p.lin_linkButtonRightContentMargin.id, variationId: v.linkButtonSize.id },
            { propertyId: p.lin_linkButtonAdditionalContentMargin.id, variationId: v.linkButtonSize.id },
            { propertyId: p.lin_linkButtonSpinnerColor.id, variationId: v.linkButtonView.id },

            // ── EmbedIconButton ──────────────────────────────────────────────────────────
            { propertyId: p.emb_embedIconButtonColor.id, variationId: v.embedIconButtonView.id },
            { propertyId: p.emb_embedIconButtonBackgroundColor.id, variationId: v.embedIconButtonView.id },
            { propertyId: p.emb_embedIconButtonLoadingBackgroundColor.id, variationId: v.embedIconButtonView.id },
            { propertyId: p.emb_textStyle.id, variationId: v.embedIconButtonSize.id },
            { propertyId: p.emb_embedIconButtonHeight.id, variationId: v.embedIconButtonSize.id },
            { propertyId: p.emb_embedIconButtonPadding.id, variationId: v.embedIconButtonSize.id },
            { propertyId: p.emb_embedIconButtonRadius.id, variationId: v.embedIconButtonSize.id },
            { propertyId: p.emb_embedIconButtonSpinnerSize.id, variationId: v.embedIconButtonSize.id },
            { propertyId: p.emb_embedIconButtonSpinnerColor.id, variationId: v.embedIconButtonView.id },
            { propertyId: p.emb_embedIconButtonWidth.id, variationId: v.embedIconButtonSize.id },

            // ── Cell ──────────────────────────────────────────────────────────
            { propertyId: p.cel_cellColor.id, variationId: v.cellView.id },
            { propertyId: p.cel_cellLabelColor.id, variationId: v.cellView.id },
            { propertyId: p.cel_cellTitleColor.id, variationId: v.cellView.id },
            { propertyId: p.cel_cellBackgroundColor.id, variationId: v.cellView.id },
            { propertyId: p.cel_cellSubtitleColor.id, variationId: v.cellView.id },
            { propertyId: p.cel_cellPaddingLeftContent.id, variationId: v.cellSize.id },
            { propertyId: p.cel_cellPadding.id, variationId: v.cellSize.id },
            { propertyId: p.cel_cellWidth.id, variationId: v.cellSize.id },
            { propertyId: p.cel_cellPaddingContent.id, variationId: v.cellSize.id },
            { propertyId: p.cel_cellPaddingRightContent.id, variationId: v.cellSize.id },
            { propertyId: p.cel_cellTextboxGap.id, variationId: v.cellSize.id },
            { propertyId: p.cel_cellGap.id, variationId: v.cellSize.id },
            { propertyId: p.cel_cellLabelStyle.id, variationId: v.cellSize.id },
            { propertyId: p.cel_cellTitleStyle.id, variationId: v.cellSize.id },
            { propertyId: p.cel_cellSubtitleStyle.id, variationId: v.cellSize.id },
        ])
        .onConflictDoNothing()
        .returning();

    console.log(`  property_variations: ${rows.length} rows`);
}
