// Полные данные компонента Checkbox (аналогично iconbuttonData), сопоставлены по конфигам
export const checkboxData = {
  component: {
    id: 4,
    name: "Checkbox",
    description: "Флажок или чекбокс, который позволяет управлять двумя состояниями.",
    createdAt: "2025-01-27T12:00:00.000Z",
    updatedAt: "2025-01-27T12:00:00.000Z",
    tokenVariations: []
  },
  variations: [
    {
      id: 8,
      componentId: 4,
      name: "view",
      description: "Visual appearance variation",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z",
      tokenVariations: []
    },
    {
      id: 9,
      componentId: 4,
      name: "size",
      description: "Size variation",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z",
      tokenVariations: []
    }
  ],
  tokens: [
    // Инвариантные токены
    {
      id: 43,
      componentId: 4,
      name: "focusColor",
      type: "color",
      defaultValue: "",
      description: "Цвет обводки компонента",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "focusColor",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 44,
      componentId: 4,
      name: "disableAlpha",
      type: "float",
      defaultValue: "",
      description: "Значение прозрачности в отключенном варианте",
      xmlParam: "disableAlpha",
      composeParam: "disableAlpha",
      iosParam: "disableAlpha",
      webParam: "disabledOpacity",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Size variation tokens
    { id: 45, componentId: 4, name: "margin", type: "dimension", defaultValue: "", description: "Внешний отступ", xmlParam: null, composeParam: null, iosParam: null, webParam: "margin", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 46, componentId: 4, name: "togglePadding", type: "dimension", defaultValue: "", description: "Внутренний отступ тоггла", xmlParam: "sd_buttonPadding", composeParam: "innerCheckBoxPadding", iosParam: null, webParam: "triggerPadding", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 47, componentId: 4, name: "toggleShape", type: "shape", defaultValue: "", description: "Скругление тоггла", xmlParam: null, composeParam: "controlRadius", iosParam: null, webParam: "triggerBorderRadius", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 48, componentId: 4, name: "toggleBorderWidth", type: "dimension", defaultValue: "", description: "Толщина бордера тоггла", xmlParam: null, composeParam: "strokeWidth", iosParam: null, webParam: "triggerBorderWidth", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 49, componentId: 4, name: "toggleCheckedBorderWidth", type: "dimension", defaultValue: "", description: "Толщина бордера в состоянии checked/indeterminate", xmlParam: null, composeParam: "checkedStrokeWidth", iosParam: null, webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 50, componentId: 4, name: "toggleWidth", type: "dimension", defaultValue: "", description: "Ширина тоггла", xmlParam: "sd_buttonSize", composeParam: "toggleWidth", iosParam: "imageSize", webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 51, componentId: 4, name: "toggleHeight", type: "dimension", defaultValue: "", description: "Высота тоггла", xmlParam: "sd_buttonSize", composeParam: "toggleHeight", iosParam: "imageSize", webParam: "triggerSize", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 52, componentId: 4, name: "toggleCheckedIconWidth", type: "dimension", defaultValue: "", description: "Ширина checked иконки тоггла", xmlParam: null, composeParam: null, iosParam: null, webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 53, componentId: 4, name: "toggleCheckedIconHeight", type: "dimension", defaultValue: "", description: "Высота checked иконки тоггла", xmlParam: null, composeParam: null, iosParam: null, webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 54, componentId: 4, name: "toggleIndeterminateIconWidth", type: "dimension", defaultValue: "", description: "Ширина indeterminate иконки тоггла", xmlParam: null, composeParam: null, iosParam: null, webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 55, componentId: 4, name: "toggleIndeterminateIconHeight", type: "dimension", defaultValue: "", description: "Высота indeterminate иконки тоггла", xmlParam: null, composeParam: null, iosParam: null, webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 56, componentId: 4, name: "horizontalPadding", type: "dimension", defaultValue: "", description: "Горизонтальный отступ между тогглом и текстом", xmlParam: "android:drawablePadding", composeParam: "horizontalSpacing", iosParam: "horizontalGap", webParam: "contentLeftOffset", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 57, componentId: 4, name: "verticalPadding", type: "dimension", defaultValue: "", description: "Отступ лейбла и описание от верхнего края", xmlParam: null, composeParam: null, iosParam: null, webParam: "contentTopOffset", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 58, componentId: 4, name: "descriptionPadding", type: "dimension", defaultValue: "", description: "Отступ между лейблом и описанием", xmlParam: "sd_descriptionPadding", composeParam: "verticalSpacing", iosParam: "verticalGap", webParam: "descriptionMarginTop", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 59, componentId: 4, name: "labelStyle", type: "typography", defaultValue: "", description: "Стиль подписи", xmlParam: "android:textAppearance", composeParam: "labelStyle", iosParam: "titleTypography", webParam: "label", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 60, componentId: 4, name: "descriptionStyle", type: "typography", defaultValue: "", description: "Стиль описания", xmlParam: "sd_descriptionTextAppearance", composeParam: "descriptionStyle", iosParam: "subtitleTypography", webParam: "description", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // View variation tokens
    { id: 61, componentId: 4, name: "toggleCheckedBackgroundColor", type: "color", defaultValue: "", description: "Цвет фона тоггла", xmlParam: "sd_buttonBoxColor", composeParam: "checkedColor", iosParam: "imageTintColor", webParam: "fillColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 62, componentId: 4, name: "iconColor", type: "color", defaultValue: "", description: "Цвет иконки", xmlParam: null, composeParam: null, iosParam: null, webParam: "iconColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 63, componentId: 4, name: "labelColor", type: "color", defaultValue: "", description: "Цвет подписи", xmlParam: "android:textColor", composeParam: "labelColor", iosParam: "titleColor", webParam: "labelColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 64, componentId: 4, name: "descriptionColor", type: "color", defaultValue: "", description: "Цвет описания", xmlParam: "sd_descriptionTextColor", composeParam: "descriptionColor", iosParam: "subtitleColor", webParam: "descriptionColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 65, componentId: 4, name: "toggleBackgroundColor", type: "color", defaultValue: "", description: "Цвет фона тоггла в невыбранном варианте", xmlParam: null, composeParam: null, iosParam: null, webParam: "triggerBackgroundColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 66, componentId: 4, name: "toggleCheckedBorderColor", type: "color", defaultValue: "", description: "Цвет бордера тоггла", xmlParam: null, composeParam: null, iosParam: null, webParam: "triggerBorderCheckedColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 67, componentId: 4, name: "toggleBorderColor", type: "color", defaultValue: "", description: "Цвет бордера тоггла в невыбранном варианте", xmlParam: "sd_buttonBorderColor", composeParam: "idleColor", iosParam: null, webParam: "triggerBorderColor", createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 68, componentId: 4, name: "toggleIndeterminateIconColor", type: "color", defaultValue: "", description: "Цвет фона indeterminate иконки тоггла", xmlParam: "sd_buttonMarkColor", composeParam: "baseColor", iosParam: null, webParam: null, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" }
  ],
  tokenVariations: [
    // View tokens → variationId: 8
    { id: 130, tokenId: 61, variationId: 8 },
    { id: 131, tokenId: 62, variationId: 8 },
    { id: 132, tokenId: 63, variationId: 8 },
    { id: 133, tokenId: 64, variationId: 8 },
    { id: 134, tokenId: 65, variationId: 8 },
    { id: 135, tokenId: 66, variationId: 8 },
    { id: 136, tokenId: 67, variationId: 8 },
    { id: 137, tokenId: 68, variationId: 8 },
    // Size tokens → variationId: 9
    { id: 140, tokenId: 45, variationId: 9 },
    { id: 141, tokenId: 46, variationId: 9 },
    { id: 142, tokenId: 47, variationId: 9 },
    { id: 143, tokenId: 48, variationId: 9 },
    { id: 144, tokenId: 49, variationId: 9 },
    { id: 145, tokenId: 50, variationId: 9 },
    { id: 146, tokenId: 51, variationId: 9 },
    { id: 147, tokenId: 52, variationId: 9 },
    { id: 148, tokenId: 53, variationId: 9 },
    { id: 149, tokenId: 54, variationId: 9 },
    { id: 150, tokenId: 55, variationId: 9 },
    { id: 151, tokenId: 56, variationId: 9 },
    { id: 152, tokenId: 57, variationId: 9 },
    { id: 153, tokenId: 58, variationId: 9 },
    { id: 154, tokenId: 59, variationId: 9 },
    { id: 155, tokenId: 60, variationId: 9 }
  ],
  variationValues: [
    // View (из конфигов): accent (дефолт), negative
    {
      id: 20,
      variationId: 8,
      value: "accent",
      description: "Accent view",
      isDefaultValue: true,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 21,
      variationId: 8,
      value: "negative",
      description: "Negative view",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Size (из конфигов): s, m (дефолт), l
    {
      id: 22,
      variationId: 9,
      value: "s",
      description: "Small size",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 23,
      variationId: 9,
      value: "m",
      description: "Medium size",
      isDefaultValue: true,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 24,
      variationId: 9,
      value: "l",
      description: "Large size",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  tokenValues: [
    // View: accent
    { id: 401, variationValueId: 20, tokenId: 61, value: "text.default.accent", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 402, variationValueId: 20, tokenId: 62, value: "text.on-dark.primary", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 403, variationValueId: 20, tokenId: 63, value: "text.default.primary", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 404, variationValueId: 20, tokenId: 64, value: "text.default.secondary", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 405, variationValueId: 20, tokenId: 65, value: "transparent", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 406, variationValueId: 20, tokenId: 66, value: "transparent", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 407, variationValueId: 20, tokenId: 67, value: "text.default.secondary", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // View: negative
    { id: 408, variationValueId: 21, tokenId: 61, value: "text.default.negative", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 409, variationValueId: 21, tokenId: 62, value: "text.on-dark.primary", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 410, variationValueId: 21, tokenId: 63, value: "text.default.primary", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 411, variationValueId: 21, tokenId: 64, value: "text.default.secondary", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 412, variationValueId: 21, tokenId: 65, value: "transparent", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 413, variationValueId: 21, tokenId: 66, value: "transparent", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 414, variationValueId: 21, tokenId: 67, value: "text.default.negative", states: null, type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // Size: s
    { id: 420, variationValueId: 22, tokenId: 45, value: "0", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 421, variationValueId: 22, tokenId: 46, value: "1", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 422, variationValueId: 22, tokenId: 50, value: "14", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 423, variationValueId: 22, tokenId: 51, value: "14", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 424, variationValueId: 22, tokenId: 47, value: "round.xxs", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 425, variationValueId: 22, tokenId: 48, value: "1", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 426, variationValueId: 22, tokenId: 57, value: "0", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 427, variationValueId: 22, tokenId: 56, value: "8", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 428, variationValueId: 22, tokenId: 58, value: "2", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 429, variationValueId: 22, tokenId: 59, value: "body.s.normal", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 430, variationValueId: 22, tokenId: 60, value: "body.xs.normal", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // Size: m (default)
    { id: 431, variationValueId: 23, tokenId: 45, value: "0", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 432, variationValueId: 23, tokenId: 46, value: "2", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 433, variationValueId: 23, tokenId: 50, value: "20", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 434, variationValueId: 23, tokenId: 51, value: "20", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 435, variationValueId: 23, tokenId: 47, value: "round.xs", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 436, variationValueId: 23, tokenId: 48, value: "2", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 437, variationValueId: 23, tokenId: 57, value: "1", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 438, variationValueId: 23, tokenId: 56, value: "12", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 439, variationValueId: 23, tokenId: 58, value: "2", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 440, variationValueId: 23, tokenId: 59, value: "body.m.normal", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 441, variationValueId: 23, tokenId: 60, value: "body.s.normal", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    // Size: l
    { id: 442, variationValueId: 24, tokenId: 45, value: "0", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 443, variationValueId: 24, tokenId: 46, value: "2", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 444, variationValueId: 24, tokenId: 50, value: "20", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 445, variationValueId: 24, tokenId: 51, value: "20", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 446, variationValueId: 24, tokenId: 47, value: "round.xs", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 447, variationValueId: 24, tokenId: 48, value: "2", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 448, variationValueId: 24, tokenId: 57, value: "1", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 449, variationValueId: 24, tokenId: 56, value: "12", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 450, variationValueId: 24, tokenId: 58, value: "2", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 451, variationValueId: 24, tokenId: 59, value: "body.l.normal", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 452, variationValueId: 24, tokenId: 60, value: "body.m.normal", type: "variation", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" }
  ],
  propsAPI: [
    {
      id: 8,
      componentId: 4,
      name: "checked",
      type: "boolean",
      description: "Whether the checkbox is checked",
      required: false,
      defaultValue: "false",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 9,
      componentId: 4,
      name: "onChange",
      type: "function",
      description: "Function called when checkbox state changes",
      required: true,
      defaultValue: null,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 10,
      componentId: 4,
      name: "disabled",
      type: "boolean",
      description: "Whether the checkbox is disabled",
      required: false,
      defaultValue: "false",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  invariantTokenValues: [
    { id: 14, tokenId: 44, value: "0.4", type: "invariant", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" },
    { id: 15, tokenId: 43, value: "text.default.accent", type: "invariant", componentId: 4, designSystemId: 1, createdAt: "2025-01-27T12:00:00.000Z", updatedAt: "2025-01-27T12:00:00.000Z" }
  ]
};
