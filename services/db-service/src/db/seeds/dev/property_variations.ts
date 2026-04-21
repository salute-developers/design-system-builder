import * as schema from '../../schema';

// Links properties to variations.
// Link.Size also inherits Text.fontStyle (cross-component property via property_variations)
export async function seedPropertyVariations(
  db: any,
  ctx: {
    properties: Record<string, any>;
    variations: Record<string, any>;
  },
) {
  const { properties: p, variations: v } = ctx;

  const rows = await db
    .insert(schema.propertyVariations)
    .values([
      // Button.View: backgroundColor, labelColor, valueColor, droppedShadow, borderColor
      { propertyId: p.btn_backgroundColor.id, variationId: v.buttonView.id },
      { propertyId: p.btn_labelColor.id, variationId: v.buttonView.id },
      { propertyId: p.btn_valueColor.id, variationId: v.buttonView.id },
      { propertyId: p.btn_droppedShadow.id, variationId: v.buttonView.id },
      { propertyId: p.btn_borderColor.id, variationId: v.buttonView.id },
      // Button.Size: height, width, shape
      { propertyId: p.btn_height.id, variationId: v.buttonSize.id },
      { propertyId: p.btn_width.id, variationId: v.buttonSize.id },
      { propertyId: p.btn_shape.id, variationId: v.buttonSize.id },
      // Button.Shape: shape (same property, different variation)
      { propertyId: p.btn_shape.id, variationId: v.buttonShape.id },
      // Text.Size: fontStyle
      { propertyId: p.txt_fontStyle.id, variationId: v.textSize.id },
      // Link.View: valueColor
      { propertyId: p.lnk_valueColor.id, variationId: v.linkView.id },
      // Link.Size: underLineWidth + inherited Text.fontStyle
      { propertyId: p.lnk_underLineWidth.id, variationId: v.linkSize.id },
      { propertyId: p.txt_fontStyle.id, variationId: v.linkSize.id },
      // TextField.View: backgroundColor, borderColor, valueColor
      { propertyId: p.tf_backgroundColor.id, variationId: v.textFieldView.id },
      { propertyId: p.tf_borderColor.id, variationId: v.textFieldView.id },
      { propertyId: p.tf_valueColor.id, variationId: v.textFieldView.id },
      // TextField.Size: valueFontStyle
      { propertyId: p.tf_valueFontStyle.id, variationId: v.textFieldSize.id },
      // Cell.View: backgroundColor
      { propertyId: p.cell_backgroundColor.id, variationId: v.cellView.id },
      // Cell.Size: height, width
      { propertyId: p.cell_height.id, variationId: v.cellSize.id },
      { propertyId: p.cell_width.id, variationId: v.cellSize.id },
      // CellLabel.View: color
      { propertyId: p.cl_color.id, variationId: v.cellLabelView.id },
      // CellLabel.Size: fontStyle
      { propertyId: p.cl_fontStyle.id, variationId: v.cellLabelSize.id },
      // CellTitle.View: color
      { propertyId: p.ct_color.id, variationId: v.cellTitleView.id },
      // CellTitle.Size: fontStyle
      { propertyId: p.ct_fontStyle.id, variationId: v.cellTitleSize.id },
    ])
    .returning();

  console.log(`  property_variations: ${rows.length} rows`);
  return rows;
}
