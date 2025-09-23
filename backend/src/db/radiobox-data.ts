// Полные данные компонента Radiobox (аналогично iconbuttonData/checkboxData), сопоставлены по конфигам
export const radioboxData = {
  component: {
    id: 5,
    name: "Radiobox",
    description: "Переключатель (радиокнопка)",
    createdAt: "2025-01-27T12:00:00.000Z",
    updatedAt: "2025-01-27T12:00:00.000Z",
    tokenVariations: []
  },
  variations: [
    {
      id: 10,
      componentId: 5,
      name: "view",
      description: "Visual appearance variation",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z",
      tokenVariations: []
    },
    {
      id: 11,
      componentId: 5,
      name: "size",
      description: "Size variation",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z",
      tokenVariations: []
    }
  ],
  tokens: [
    // Инвариантные токены
    { id: 69, componentId: 5, name: "focusColor", type: "color", defaultValue: "", description: "Цвет обводки компонента", xmlParam: null, composeParam: null, iosParam: null, webParam: "focusColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 70, componentId: 5, name: "disableAlpha", type: "float", defaultValue: "", description: "Значение прозрачности в отключенном варианте", xmlParam: "disableAlpha", composeParam: "disableAlpha", iosParam: "disableAlpha", webParam: "disabledOpacity", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // Size tokens (вариируют по size)
    { id: 71, componentId: 5, name: "margin", type: "dimension", defaultValue: "", description: "Внешний отступ", xmlParam: null, composeParam: null, iosParam: null, webParam: "margin", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 72, componentId: 5, name: "togglePadding", type: "dimension", defaultValue: "", description: "Внутренний отступ тоггла", xmlParam: "sd_buttonPadding", composeParam: "innerRadioBoxPadding", iosParam: null, webParam: "triggerPadding", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 73, componentId: 5, name: "toggleShape", type: "shape", defaultValue: "", description: "Скругление тоггла", xmlParam: null, composeParam: "controlRadius", iosParam: null, webParam: "triggerBorderRadius", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 74, componentId: 5, name: "toggleBorderWidth", type: "dimension", defaultValue: "", description: "Толщина бордера тоггла", xmlParam: null, composeParam: "strokeWidth", iosParam: null, webParam: "triggerBorderWidth", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 75, componentId: 5, name: "toggleCheckedBorderWidth", type: "dimension", defaultValue: "", description: "Толщина бордера в состоянии checked", xmlParam: null, composeParam: "checkedStrokeWidth", iosParam: null, webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 76, componentId: 5, name: "toggleWidth", type: "dimension", defaultValue: "", description: "Ширина тоггла", xmlParam: "sd_buttonSize", composeParam: "toggleWidth", iosParam: "imageSize", webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 77, componentId: 5, name: "toggleHeight", type: "dimension", defaultValue: "", description: "Высота тоггла", xmlParam: "sd_buttonSize", composeParam: "toggleHeight", iosParam: "imageSize", webParam: "triggerSize", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 78, componentId: 5, name: "ellipseWidth", type: "dimension", defaultValue: "", description: "Ширина кружка", xmlParam: "sd_buttonSize", composeParam: "ellipseWidth", iosParam: "ellipseSize", webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 79, componentId: 5, name: "ellipseHeight", type: "dimension", defaultValue: "", description: "Высота кружка", xmlParam: "sd_buttonSize", composeParam: "ellipseHeight", iosParam: "ellipseSize", webParam: "ellipseSize", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 80, componentId: 5, name: "toggleCheckedIconWidth", type: "dimension", defaultValue: "", description: "Ширина checked иконки тоггла", xmlParam: null, composeParam: null, iosParam: null, webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 81, componentId: 5, name: "toggleCheckedIconHeight", type: "dimension", defaultValue: "", description: "Высота checked иконки тоггла", xmlParam: null, composeParam: null, iosParam: null, webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 82, componentId: 5, name: "horizontalPadding", type: "dimension", defaultValue: "", description: "Горизонтальный отступ между тогглом и текстом", xmlParam: "android:drawablePadding", composeParam: "horizontalSpacing", iosParam: "horizontalGap", webParam: "contentLeftOffset", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 83, componentId: 5, name: "verticalPadding", type: "dimension", defaultValue: "", description: "Отступ лейбла и описание от верхнего края", xmlParam: null, composeParam: null, iosParam: null, webParam: "contentTopOffset", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 84, componentId: 5, name: "descriptionPadding", type: "dimension", defaultValue: "", description: "Отступ между лейблом и описанием", xmlParam: "sd_descriptionPadding", composeParam: "verticalSpacing", iosParam: "verticalGap", webParam: "descriptionMarginTop", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 85, componentId: 5, name: "labelStyle", type: "typography", defaultValue: "", description: "Стиль подписи", xmlParam: "android:textAppearance", composeParam: "labelStyle", iosParam: "titleTypography", webParam: "label", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 86, componentId: 5, name: "descriptionStyle", type: "typography", defaultValue: "", description: "Стиль описания", xmlParam: "sd_descriptionTextAppearance", composeParam: "descriptionStyle", iosParam: "subtitleTypography", webParam: "description", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // View tokens (вариируют по view)
    { id: 87, componentId: 5, name: "toggleCheckedBackgroundColor", type: "color", defaultValue: "", description: "Цвет фона тоггла", xmlParam: "sd_buttonBoxColor", composeParam: "checkedColor", iosParam: "imageTintColor", webParam: "fillColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 88, componentId: 5, name: "ellipseColor", type: "color", defaultValue: "", description: "Цвет кружка", xmlParam: null, composeParam: null, iosParam: null, webParam: "ellipseColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 89, componentId: 5, name: "labelColor", type: "color", defaultValue: "", description: "Цвет подписи", xmlParam: "android:textColor", composeParam: "labelColor", iosParam: "titleColor", webParam: "labelColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 90, componentId: 5, name: "descriptionColor", type: "color", defaultValue: "", description: "Цвет описания", xmlParam: "sd_descriptionTextColor", composeParam: "descriptionColor", iosParam: "subtitleColor", webParam: "descriptionColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 91, componentId: 5, name: "toggleBackgroundColor", type: "color", defaultValue: "", description: "Цвет фона тоггла в невыбранном варианте", xmlParam: null, composeParam: null, iosParam: null, webParam: "triggerBackgroundColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 92, componentId: 5, name: "toggleCheckedBorderColor", type: "color", defaultValue: "", description: "Цвет бордера тоггла", xmlParam: null, composeParam: null, iosParam: null, webParam: "triggerBorderCheckedColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 93, componentId: 5, name: "toggleBorderColor", type: "color", defaultValue: "", description: "Цвет бордера тоггла в невыбранном варианте", xmlParam: "sd_buttonBorderColor", composeParam: "idleColor", iosParam: null, webParam: "triggerBorderColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" }
  ],
  tokenVariations: [
    // View tokens → variationId: 10
    { id: 200, tokenId: 87, variationId: 10 },
    { id: 201, tokenId: 88, variationId: 10 },
    { id: 202, tokenId: 89, variationId: 10 },
    { id: 203, tokenId: 90, variationId: 10 },
    { id: 204, tokenId: 91, variationId: 10 },
    { id: 205, tokenId: 92, variationId: 10 },
    { id: 206, tokenId: 93, variationId: 10 },
    // Size tokens → variationId: 11
    { id: 210, tokenId: 71, variationId: 11 },
    { id: 211, tokenId: 72, variationId: 11 },
    { id: 212, tokenId: 73, variationId: 11 },
    { id: 213, tokenId: 74, variationId: 11 },
    { id: 214, tokenId: 75, variationId: 11 },
    { id: 215, tokenId: 76, variationId: 11 },
    { id: 216, tokenId: 77, variationId: 11 },
    { id: 217, tokenId: 78, variationId: 11 },
    { id: 218, tokenId: 79, variationId: 11 },
    { id: 219, tokenId: 80, variationId: 11 },
    { id: 220, tokenId: 81, variationId: 11 },
    { id: 221, tokenId: 82, variationId: 11 },
    { id: 222, tokenId: 83, variationId: 11 },
    { id: 223, tokenId: 84, variationId: 11 },
    { id: 224, tokenId: 85, variationId: 11 },
    { id: 225, tokenId: 86, variationId: 11 }
  ],
  variationValues: [
    // View (из конфигов): accent (дефолт), negative
    { id: 25, variationId: 10, value: "accent", description: "Accent view", isDefaultValue: true, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 26, variationId: 10, value: "negative", description: "Negative view", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // Size (из конфигов): s, m (дефолт), l
    { id: 27, variationId: 11, value: "s", description: "Small size", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 28, variationId: 11, value: "m", description: "Medium size", isDefaultValue: true, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 29, variationId: 11, value: "l", description: "Large size", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" }
  ],
  tokenValues: [
    // View: accent
    { id: 460, variationValueId: 25, tokenId: 87, value: "text.default.accent", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 461, variationValueId: 25, tokenId: 88, value: "text.on-dark.primary", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 462, variationValueId: 25, tokenId: 89, value: "text.default.primary", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 463, variationValueId: 25, tokenId: 90, value: "text.default.secondary", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 464, variationValueId: 25, tokenId: 91, value: "transparent", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 465, variationValueId: 25, tokenId: 92, value: "transparent", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 466, variationValueId: 25, tokenId: 93, value: "text.default.secondary", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // View: negative
    { id: 467, variationValueId: 26, tokenId: 87, value: "text.default.negative", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 468, variationValueId: 26, tokenId: 88, value: "text.on-dark.primary", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 469, variationValueId: 26, tokenId: 89, value: "text.default.primary", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 470, variationValueId: 26, tokenId: 90, value: "text.default.secondary", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 471, variationValueId: 26, tokenId: 91, value: "transparent", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 472, variationValueId: 26, tokenId: 92, value: "transparent", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 473, variationValueId: 26, tokenId: 93, value: "text.default.negative", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // Size: s
    { id: 480, variationValueId: 27, tokenId: 71, value: "0", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 481, variationValueId: 27, tokenId: 72, value: "1", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 482, variationValueId: 27, tokenId: 76, value: "16", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 483, variationValueId: 27, tokenId: 77, value: "16", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 484, variationValueId: 27, tokenId: 78, value: "8", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 485, variationValueId: 27, tokenId: 79, value: "8", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 486, variationValueId: 27, tokenId: 73, value: "round.xl", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 487, variationValueId: 27, tokenId: 74, value: "1", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 488, variationValueId: 27, tokenId: 83, value: "0", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 489, variationValueId: 27, tokenId: 82, value: "8", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 490, variationValueId: 27, tokenId: 84, value: "2", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 491, variationValueId: 27, tokenId: 85, value: "body.s.normal", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 492, variationValueId: 27, tokenId: 86, value: "body.xs.normal", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // Size: m (default)
    { id: 493, variationValueId: 28, tokenId: 71, value: "0", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 494, variationValueId: 28, tokenId: 72, value: "1", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 495, variationValueId: 28, tokenId: 76, value: "22", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 496, variationValueId: 28, tokenId: 77, value: "22", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 497, variationValueId: 28, tokenId: 78, value: "10", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 498, variationValueId: 28, tokenId: 79, value: "10", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 499, variationValueId: 28, tokenId: 73, value: "round.xl", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 500, variationValueId: 28, tokenId: 74, value: "2", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 501, variationValueId: 28, tokenId: 83, value: "1", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 502, variationValueId: 28, tokenId: 82, value: "12", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 503, variationValueId: 28, tokenId: 84, value: "2", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 504, variationValueId: 28, tokenId: 85, value: "body.m.normal", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 505, variationValueId: 28, tokenId: 86, value: "body.s.normal", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // Size: l
    { id: 506, variationValueId: 29, tokenId: 71, value: "0", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 507, variationValueId: 29, tokenId: 72, value: "1", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 508, variationValueId: 29, tokenId: 76, value: "22", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 509, variationValueId: 29, tokenId: 77, value: "22", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 510, variationValueId: 29, tokenId: 78, value: "10", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 511, variationValueId: 29, tokenId: 79, value: "10", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 512, variationValueId: 29, tokenId: 73, value: "round.xl", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 513, variationValueId: 29, tokenId: 74, value: "2", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 514, variationValueId: 29, tokenId: 83, value: "1", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 515, variationValueId: 29, tokenId: 82, value: "12", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 516, variationValueId: 29, tokenId: 84, value: "2", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 517, variationValueId: 29, tokenId: 85, value: "body.l.normal", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 518, variationValueId: 29, tokenId: 86, value: "body.m.normal", type: "variation", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" }
  ],
  propsAPI: [
    { id: 11, componentId: 5, name: "selected", type: "boolean", description: "Whether the radio button is selected", required: false, defaultValue: "false", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 12, componentId: 5, name: "onChange", type: "function", description: "Function called when radio button state changes", required: true, defaultValue: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 13, componentId: 5, name: "disabled", type: "boolean", description: "Whether the radio button is disabled", required: false, defaultValue: "false", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" }
  ],
  invariantTokenValues: [
    { id: 20, tokenId: 70, value: "0.4", type: "invariant", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 21, tokenId: 69, value: "text.default.accent", type: "invariant", componentId: 5, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" }
  ]
};

 
