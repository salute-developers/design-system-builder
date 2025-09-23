// Правильная структура для IconButton на основе анализа связей по ID
export const iconbuttonData = {
  component: {
    id: 1,
    name: "IconButton",
    description: "Кнопка с иконкой.",
    createdAt: "2025-01-27T12:00:00.000Z",
    updatedAt: "2025-01-27T12:00:00.000Z",
    tokenVariations: []
  },
  variations: [
    {
      id: 1,
      componentId: 1,
      name: "view",
      description: "View variation",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z",
      tokenVariations: []
    },
    {
      id: 2,
      componentId: 1,
      name: "size",
      description: "Size variation",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z",
      tokenVariations: []
    },
    {
      id: 3,
      componentId: 1,
      name: "shape",
      description: "Shape variation",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z",
      tokenVariations: []
    }
  ],
  tokens: [
    // Invariant tokens (не меняются в зависимости от вариаций)
    {
      id: 1,
      componentId: 1,
      name: "loadingAlpha",
      type: "float",
      defaultValue: "0",
      description: "Значение прозрачности в режиме загрузки",
      xmlParam: "loadingAlpha",
      composeParam: "loadingAlpha",
      iosParam: "loadingAlpha",
      webParam: null,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 2,
      componentId: 1,
      name: "disableAlpha",
      type: "float",
      defaultValue: "0.4",
      description: "Значение прозрачности в отключенном варианте",
      xmlParam: "disableAlpha",
      composeParam: "disableAlpha",
      iosParam: "disableAlpha",
      webParam: "iconButtonDisabledOpacity",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 3,
      componentId: 1,
      name: "focusColor",
      type: "color",
      defaultValue: "text.default.accent",
      description: "Цвет обводки компонента",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "iconButtonFocusColor",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // View variation tokens (меняются в зависимости от view)
    {
      id: 4,
      componentId: 1,
      name: "backgroundColor",
      type: "color",
      defaultValue: "",
      description: "Цвет фона кнопки",
      xmlParam: "backgroundTint",
      composeParam: "backgroundColor",
      iosParam: "backgroundColor",
      webParam: "iconButtonBackgroundColor",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 5,
      componentId: 1,
      name: "loadingBackgroundColor",
      type: "color",
      defaultValue: "",
      description: "Цвет фона в режиме загрузки",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "iconButtonLoadingBackgroundColor",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 6,
      componentId: 1,
      name: "iconColor",
      type: "color",
      defaultValue: "",
      description: "Цвет иконки",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "iconButtonColor",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 7,
      componentId: 1,
      name: "spinnerColor",
      type: "color",
      defaultValue: "",
      description: "Цвет спиннера",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "iconButtonSpinnerColor",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Size variation tokens (меняются в зависимости от size)
    {
      id: 8,
      componentId: 1,
      name: "height",
      type: "dimension",
      defaultValue: "",
      description: "Высота компонента",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "iconButtonHeight",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 9,
      componentId: 1,
      name: "paddingStart",
      type: "dimension",
      defaultValue: "",
      description: "Отступ слева",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "iconButtonPadding",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 10,
      componentId: 1,
      name: "paddingEnd",
      type: "dimension",
      defaultValue: "",
      description: "Отступ справа",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "iconButtonPadding",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 11,
      componentId: 1,
      name: "minWidth",
      type: "dimension",
      defaultValue: "",
      description: "Минимальная ширина",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "iconButtonWidth",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 12,
      componentId: 1,
      name: "iconSize",
      type: "dimension",
      defaultValue: "",
      description: "Размер иконки",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: null,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 13,
      componentId: 1,
      name: "spinnerSize",
      type: "dimension",
      defaultValue: "",
      description: "Размер спиннера",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "iconButtonSpinnerSize",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 14,
      componentId: 1,
      name: "spinnerStrokeWidth",
      type: "dimension",
      defaultValue: "",
      description: "Толщина линии спиннера",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: null,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Shape variation tokens (меняются в зависимости от shape)
    {
      id: 15,
      componentId: 1,
      name: "shape",
      type: "shape",
      defaultValue: "",
      description: "Форма компонента",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "iconButtonRadius",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  tokenVariations: [
    // View variations (tokens that change based on view)
    {
      id: 1,
      tokenId: 4, // backgroundColor
      variationId: 1
    },
    {
      id: 2,
      tokenId: 5, // loadingBackgroundColor
      variationId: 1
    },
    {
      id: 3,
      tokenId: 6, // iconColor
      variationId: 1
    },
    {
      id: 4,
      tokenId: 7, // spinnerColor
      variationId: 1
    },
    // Size variations (tokens that change based on size)
    {
      id: 5,
      tokenId: 8, // height
      variationId: 2
    },
    {
      id: 6,
      tokenId: 9, // paddingStart
      variationId: 2
    },
    {
      id: 7,
      tokenId: 10, // paddingEnd
      variationId: 2
    },
    {
      id: 8,
      tokenId: 11, // minWidth
      variationId: 2
    },
    {
      id: 9,
      tokenId: 12, // iconSize
      variationId: 2
    },
    {
      id: 10,
      tokenId: 13, // spinnerSize
      variationId: 2
    },
    {
      id: 11,
      tokenId: 14, // spinnerStrokeWidth
      variationId: 2
    },
    // Shape variations (tokens that change based on shape)
    {
      id: 12,
      tokenId: 15, // shape
      variationId: 3
    }
  ],
  variationValues: [
    // View variation values (из конфигов)
    {
      id: 1,
      variationId: 1,
      value: "default",
      description: "Default view",
      isDefaultValue: true,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 2,
      variationId: 1,
      value: "secondary",
      description: "Secondary view",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 3,
      variationId: 1,
      value: "accent",
      description: "Accent view",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Size variation values (из конфигов)
    {
      id: 4,
      variationId: 2,
      value: "xl",
      description: "Extra large size",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 5,
      variationId: 2,
      value: "l",
      description: "Large size",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 6,
      variationId: 2,
      value: "m",
      description: "Medium size",
      isDefaultValue: true,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Shape variation values (из конфигов)
    {
      id: 7,
      variationId: 3,
      value: "rounded",
      description: "Rounded shape",
      isDefaultValue: true,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 8,
      variationId: 3,
      value: "pilled",
      description: "Pilled shape",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  tokenValues: [
    // View variation token values (из конфигов)
    // Default view
    {
      id: 1,
      variationValueId: 1, // default view
      tokenId: 6, // iconColor
      value: "text.inverse.primary",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 2,
      variationValueId: 1, // default view
      tokenId: 5, // loadingBackgroundColor
      value: "text.inverse.primary",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 3,
      variationValueId: 1, // default view
      tokenId: 7, // spinnerColor
      value: "text.inverse.primary",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 4,
      variationValueId: 1, // default view
      tokenId: 4, // backgroundColor
      value: "surface.default.solid-default",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Secondary view
    {
      id: 5,
      variationValueId: 2, // secondary view
      tokenId: 6, // iconColor
      value: "text.default.primary",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 6,
      variationValueId: 2, // secondary view
      tokenId: 5, // loadingBackgroundColor
      value: "text.default.primary",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 7,
      variationValueId: 2, // secondary view
      tokenId: 7, // spinnerColor
      value: "text.default.primary",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 8,
      variationValueId: 2, // secondary view
      tokenId: 4, // backgroundColor
      value: "surface.default.transparent-secondary",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Accent view
    {
      id: 9,
      variationValueId: 3, // accent view
      tokenId: 6, // iconColor
      value: "text.on-dark.primary",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 10,
      variationValueId: 3, // accent view
      tokenId: 5, // loadingBackgroundColor
      value: "text.on-dark.primary",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 11,
      variationValueId: 3, // accent view
      tokenId: 7, // spinnerColor
      value: "text.on-dark.primary",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 12,
      variationValueId: 3, // accent view
      tokenId: 4, // backgroundColor
      value: "surface.default.accent",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Size variation token values (из конфигов)
    // XL size
    {
      id: 13,
      variationValueId: 4, // xl size
      tokenId: 8, // height
      value: "64",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 14,
      variationValueId: 4, // xl size
      tokenId: 9, // paddingStart
      value: "20",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 15,
      variationValueId: 4, // xl size
      tokenId: 10, // paddingEnd
      value: "20",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 16,
      variationValueId: 4, // xl size
      tokenId: 11, // minWidth
      value: "64",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 17,
      variationValueId: 4, // xl size
      tokenId: 12, // iconSize
      value: "24",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 18,
      variationValueId: 4, // xl size
      tokenId: 13, // spinnerSize
      value: "24",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 19,
      variationValueId: 4, // xl size
      tokenId: 14, // spinnerStrokeWidth
      value: "2",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // L size
    {
      id: 20,
      variationValueId: 5, // l size
      tokenId: 8, // height
      value: "56",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 21,
      variationValueId: 5, // l size
      tokenId: 9, // paddingStart
      value: "16",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 22,
      variationValueId: 5, // l size
      tokenId: 10, // paddingEnd
      value: "16",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 23,
      variationValueId: 5, // l size
      tokenId: 11, // minWidth
      value: "56",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 24,
      variationValueId: 5, // l size
      tokenId: 12, // iconSize
      value: "24",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 25,
      variationValueId: 5, // l size
      tokenId: 13, // spinnerSize
      value: "22",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 26,
      variationValueId: 5, // l size
      tokenId: 14, // spinnerStrokeWidth
      value: "2",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // M size
    {
      id: 27,
      variationValueId: 6, // m size
      tokenId: 8, // height
      value: "48",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 28,
      variationValueId: 6, // m size
      tokenId: 9, // paddingStart
      value: "12",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 29,
      variationValueId: 6, // m size
      tokenId: 10, // paddingEnd
      value: "12",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 30,
      variationValueId: 6, // m size
      tokenId: 11, // minWidth
      value: "48",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 31,
      variationValueId: 6, // m size
      tokenId: 12, // iconSize
      value: "24",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 32,
      variationValueId: 6, // m size
      tokenId: 13, // spinnerSize
      value: "22",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 33,
      variationValueId: 6, // m size
      tokenId: 14, // spinnerStrokeWidth
      value: "2",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Shape variation token values (из конфигов)
    // rounded shape не имеет токенов (props: null в конфигах)
    {
      id: 34,
      variationValueId: 8, // pilled shape
      tokenId: 15, // shape
      value: "round.circle",
      type: "variation",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  propsAPI: [
    {
      id: 1,
      componentId: 1,
      name: "loadingAlpha",
      type: "float",
      description: "Значение прозрачности в режиме загрузки",
      defaultValue: "0",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 2,
      componentId: 1,
      name: "disableAlpha",
      type: "float",
      description: "Значение прозрачности в отключенном варианте",
      defaultValue: "0.4",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 3,
      componentId: 1,
      name: "focusColor",
      type: "color",
      description: "Цвет обводки компонента",
      defaultValue: "text.default.accent",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  invariantTokenValues: [
    {
      id: 1,
      tokenId: 1, // loadingAlpha
      value: "0",
      type: "invariant",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 2,
      tokenId: 2, // disableAlpha
      value: "0.4",
      type: "invariant",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 3,
      tokenId: 3, // focusColor
      value: "text.default.accent",
      type: "invariant",
      componentId: 1,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ]
};
