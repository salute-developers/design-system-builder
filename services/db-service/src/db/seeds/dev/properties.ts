import * as schema from '../../schema';

export async function seedProperties(
  db: any,
  ctx: {
    components: { button: any; text: any; link: any; textField: any; cell: any; cellLabel: any; cellTitle: any };
  },
) {
  const { button, text, link, textField, cell, cellLabel, cellTitle } = ctx.components;

  const rows = await db
    .insert(schema.properties)
    .values([
      // ── Button ──────────────────────────────────────────────────────────────
      { componentId: button.id, name: 'backgroundColor', type: 'color' as const, defaultValue: '', description: 'Цвет фона кнопки' },
      { componentId: button.id, name: 'labelColor', type: 'color' as const, defaultValue: '', description: 'Цвет основного текста' },
      { componentId: button.id, name: 'valueColor', type: 'color' as const, defaultValue: '', description: 'Цвет дополнительного текста' },
      { componentId: button.id, name: 'droppedShadow', type: 'shadow' as const, defaultValue: '', description: 'Тень кнопки' },
      { componentId: button.id, name: 'borderColor', type: 'color' as const, defaultValue: '', description: 'Цвет границы кнопки' },
      { componentId: button.id, name: 'height', type: 'dimension' as const, defaultValue: '', description: 'Высота кнопки' },
      { componentId: button.id, name: 'width', type: 'dimension' as const, defaultValue: '', description: 'Ширина кнопки' },
      { componentId: button.id, name: 'shape', type: 'shape' as const, defaultValue: '', description: 'Форма кнопки' },
      { componentId: button.id, name: 'focusColor', type: 'color' as const, defaultValue: '', description: 'Цвет обводки компонента' },
      { componentId: button.id, name: 'disabledAlpha', type: 'float' as const, defaultValue: '0.4', description: 'Значение прозрачности в отключенном варианте' },
      // ── Text ────────────────────────────────────────────────────────────────
      { componentId: text.id, name: 'fontStyle', type: 'typography' as const, defaultValue: '', description: 'Стиль шрифта' },
      // ── Link ────────────────────────────────────────────────────────────────
      { componentId: link.id, name: 'valueColor', type: 'color' as const, defaultValue: '', description: 'Цвет текста ссылки' },
      { componentId: link.id, name: 'underLineWidth', type: 'float' as const, defaultValue: '', description: 'Толщина подчеркивания текста ссылки' },
      // ── TextField ───────────────────────────────────────────────────────────
      { componentId: textField.id, name: 'backgroundColor', type: 'color' as const, defaultValue: '', description: 'Цвет фона поля ввода' },
      { componentId: textField.id, name: 'borderColor', type: 'color' as const, defaultValue: '', description: 'Цвет границы поля ввода' },
      { componentId: textField.id, name: 'valueColor', type: 'color' as const, defaultValue: '', description: 'Цвет текста поля ввода' },
      { componentId: textField.id, name: 'valueFontStyle', type: 'typography' as const, defaultValue: '', description: 'Стиль шрифта поля ввода' },
      { componentId: textField.id, name: 'focusColor', type: 'color' as const, defaultValue: '', description: 'Цвет обводки при фокусе' },
      { componentId: textField.id, name: 'disabledAlpha', type: 'float' as const, defaultValue: '0.4', description: 'Значение прозрачности в отключенном варианте' },
      // ── Cell ──────────────────────────────────────────────────────────────
      { componentId: cell.id, name: 'backgroundColor', type: 'color' as const, defaultValue: '', description: 'Цвет фона ячейки' },
      { componentId: cell.id, name: 'height', type: 'dimension' as const, defaultValue: '', description: 'Высота ячейки' },
      { componentId: cell.id, name: 'width', type: 'dimension' as const, defaultValue: '', description: 'Ширина ячейки' },
      // ── CellLabel ─────────────────────────────────────────────────────────
      { componentId: cellLabel.id, name: 'color', type: 'color' as const, defaultValue: '', description: 'Цвет текста лейбла' },
      { componentId: cellLabel.id, name: 'fontStyle', type: 'typography' as const, defaultValue: '', description: 'Стиль шрифта лейбла' },
      // ── CellTitle ─────────────────────────────────────────────────────────
      { componentId: cellTitle.id, name: 'color', type: 'color' as const, defaultValue: '', description: 'Цвет текста заголовка' },
      { componentId: cellTitle.id, name: 'fontStyle', type: 'typography' as const, defaultValue: '', description: 'Стиль шрифта заголовка' },
    ])
    .returning();

  const find = (compId: string, name: string) =>
    rows.find((r: any) => r.componentId === compId && r.name === name)!;

  // ── Platform params ─────────────────────────────────────────────────────────
  type PlatformMap = { xml?: string[]; compose?: string[]; ios?: string[]; web?: string[] };

  const platformParamsData: { propertyId: string; platform: string; name: string }[] = [];

  function addPlatformParams(propertyId: string, params: PlatformMap) {
    for (const [platform, names] of Object.entries(params)) {
      if (names) {
        for (const n of names) {
          platformParamsData.push({ propertyId, platform, name: n });
        }
      }
    }
  }

  // Button
  addPlatformParams(find(button.id, 'backgroundColor').id, { xml: ['backgroundTint'], compose: ['backgroundColor'], ios: ['backgroundColor'], web: ['buttonBackgroundColor'] });
  addPlatformParams(find(button.id, 'labelColor').id, { xml: ['android:textColor'], compose: ['labelColor'], ios: ['titleColor'], web: ['buttonColor'] });
  addPlatformParams(find(button.id, 'valueColor').id, { xml: ['sd_valueTextColor'], compose: ['valueColor'], ios: ['subtitleColor'], web: ['buttonValueColor'] });
  addPlatformParams(find(button.id, 'droppedShadow').id, { web: ['buttonBoxShadow'] });
  addPlatformParams(find(button.id, 'borderColor').id, { xml: ['sd_borderColor'], compose: ['borderColor'], ios: ['borderColor'], web: ['buttonBorderColor'] });
  addPlatformParams(find(button.id, 'height').id, { xml: ['android:minHeight'], compose: ['height'], ios: ['height'], web: ['buttonHeight'] });
  addPlatformParams(find(button.id, 'width').id, { xml: ['android:minWidth'], compose: ['minWidth'], web: ['buttonWidth'] });
  addPlatformParams(find(button.id, 'shape').id, { xml: ['sd_shapeAppearance'], compose: ['shape'], ios: ['cornerRadius'], web: ['buttonRadius'] });
  addPlatformParams(find(button.id, 'focusColor').id, { web: ['buttonFocusColor'] });
  addPlatformParams(find(button.id, 'disabledAlpha').id, { xml: ['disableAlpha'], compose: ['disableAlpha'], ios: ['disableAlpha'], web: ['buttonDisabledOpacity'] });
  // Text
  addPlatformParams(find(text.id, 'fontStyle').id, { xml: ['android:textAppearance'], compose: ['textStyle'], ios: ['textStyle'], web: ['text'] });
  // Link
  addPlatformParams(find(link.id, 'valueColor').id, { xml: ['contentColor'], compose: ['contentColor'], ios: ['contentColor'], web: ['linkColor'] });
  addPlatformParams(find(link.id, 'underLineWidth').id, { xml: ['underlineBorderWidth'], compose: ['underlineBorderWidth'], ios: ['underlineBorderWidth'], web: ['linkUnderlineBorder'] });
  // TextField
  addPlatformParams(find(textField.id, 'backgroundColor').id, { xml: ['backgroundTint'], compose: ['backgroundColor'], ios: ['backgroundColor'], web: ['textFieldBackgroundColor'] });
  addPlatformParams(find(textField.id, 'borderColor').id, { xml: ['sd_borderColor'], compose: ['borderColor'], ios: ['borderColor'], web: ['textFieldBorderColor'] });
  addPlatformParams(find(textField.id, 'valueColor').id, { xml: ['android:textColor'], compose: ['valueColor'], ios: ['textColor'], web: ['textFieldColor'] });
  addPlatformParams(find(textField.id, 'valueFontStyle').id, { xml: ['android:textAppearance'], compose: ['textStyle'], ios: ['textStyle'], web: ['textField'] });
  addPlatformParams(find(textField.id, 'focusColor').id, { web: ['textFieldFocusColor'] });
  addPlatformParams(find(textField.id, 'disabledAlpha').id, { xml: ['disableAlpha'], compose: ['disableAlpha'], ios: ['disableAlpha'], web: ['textFieldDisabledOpacity'] });
  // Cell
  addPlatformParams(find(cell.id, 'backgroundColor').id, { xml: ['backgroundTint'], compose: ['backgroundColor'], ios: ['backgroundColor'], web: ['cellBackgroundColor'] });
  addPlatformParams(find(cell.id, 'height').id, { xml: ['android:minHeight'], compose: ['height'], ios: ['height'], web: ['cellHeight'] });
  addPlatformParams(find(cell.id, 'width').id, { xml: ['android:minWidth'], compose: ['minWidth'], web: ['cellWidth'] });
  // CellLabel
  addPlatformParams(find(cellLabel.id, 'color').id, { xml: ['android:textColor'], compose: ['color'], ios: ['textColor'], web: ['cellLabelColor'] });
  addPlatformParams(find(cellLabel.id, 'fontStyle').id, { xml: ['android:textAppearance'], compose: ['textStyle'], ios: ['textStyle'], web: ['cellLabel'] });
  // CellTitle
  addPlatformParams(find(cellTitle.id, 'color').id, { xml: ['android:textColor'], compose: ['color'], ios: ['textColor'], web: ['cellTitleColor'] });
  addPlatformParams(find(cellTitle.id, 'fontStyle').id, { xml: ['android:textAppearance'], compose: ['textStyle'], ios: ['textStyle'], web: ['cellTitle'] });

  let platformParams: any[] = [];
  if (platformParamsData.length > 0) {
    platformParams = await db.insert(schema.propertyPlatformParams).values(platformParamsData).returning();
  }
  console.log(`  property_platform_params: ${platformParams.length} rows`);

  const findParam = (propertyId: string, platform: string, name: string) =>
    platformParams.find((p: any) => p.propertyId === propertyId && p.platform === platform && p.name === name)!;

  const result = {
    platformParams,
    findParam,
    btn_backgroundColor: find(button.id, 'backgroundColor'),
    btn_labelColor: find(button.id, 'labelColor'),
    btn_valueColor: find(button.id, 'valueColor'),
    btn_droppedShadow: find(button.id, 'droppedShadow'),
    btn_borderColor: find(button.id, 'borderColor'),
    btn_height: find(button.id, 'height'),
    btn_width: find(button.id, 'width'),
    btn_shape: find(button.id, 'shape'),
    btn_focusColor: find(button.id, 'focusColor'),
    btn_disabledAlpha: find(button.id, 'disabledAlpha'),
    txt_fontStyle: find(text.id, 'fontStyle'),
    lnk_valueColor: find(link.id, 'valueColor'),
    lnk_underLineWidth: find(link.id, 'underLineWidth'),
    tf_backgroundColor: find(textField.id, 'backgroundColor'),
    tf_borderColor: find(textField.id, 'borderColor'),
    tf_valueColor: find(textField.id, 'valueColor'),
    tf_valueFontStyle: find(textField.id, 'valueFontStyle'),
    tf_focusColor: find(textField.id, 'focusColor'),
    tf_disabledAlpha: find(textField.id, 'disabledAlpha'),
    cell_backgroundColor: find(cell.id, 'backgroundColor'),
    cell_height: find(cell.id, 'height'),
    cell_width: find(cell.id, 'width'),
    cl_color: find(cellLabel.id, 'color'),
    cl_fontStyle: find(cellLabel.id, 'fontStyle'),
    ct_color: find(cellTitle.id, 'color'),
    ct_fontStyle: find(cellTitle.id, 'fontStyle'),
  };

  console.log(`  properties: ${rows.length} rows`);
  return result;
}
