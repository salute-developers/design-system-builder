// Данные компонента Link (структура аналогична iconbuttonData)
export const linkData = {
  component: {
    id: 2,
    name: "Link",
    description: "Ссылка.",
    createdAt: "2025-01-27T12:00:00.000Z",
    updatedAt: "2025-01-27T12:00:00.000Z",
    tokenVariations: []
  },
  variations: [
    {
      id: 4,
      componentId: 2,
      name: "view",
      description: "View variation",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z",
      tokenVariations: []
    },
    {
      id: 5,
      componentId: 2,
      name: "size",
      description: "Size variation",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z",
      tokenVariations: []
    }
  ],
  tokens: [
    // Invariant tokens
    {
      id: 16,
      componentId: 2,
      name: "focusColor",
      type: "color",
      defaultValue: "",
      description: "Цвет обводки компонента",
      xmlParam: null,
      composeParam: null,
      iosParam: null,
      webParam: "linkColorFocus",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 17,
      componentId: 2,
      name: "disableAlpha",
      type: "float",
      defaultValue: "",
      description: "Значение прозрачности в отключенном варианте",
      xmlParam: "disableAlpha",
      composeParam: "disableAlpha",
      iosParam: "disableAlpha",
      webParam: "linkDisabledOpacity",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Size variation token
    {
      id: 18,
      componentId: 2,
      name: "textStyle",
      type: "typography",
      defaultValue: "",
      description: "Стиль текста ссылки",
      xmlParam: "android:minHeight",
      composeParam: "height",
      iosParam: "height",
      webParam: "link",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // View variation tokens
    {
      id: 19,
      componentId: 2,
      name: "textColor",
      type: "color",
      defaultValue: "",
      description: "Цвет текста ссылки",
      xmlParam: "contentColor",
      composeParam: "contentColor",
      iosParam: "contentColor",
      webParam: "linkColor",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 20,
      componentId: 2,
      name: "textColorVisited",
      type: "color",
      defaultValue: "",
      description: "Цвет текста посещённой ссылки",
      xmlParam: "contentColorVisited",
      composeParam: "contentColorVisited",
      iosParam: "contentColorVisited",
      webParam: "linkColorVisited",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 21,
      componentId: 2,
      name: "underlineBorderWidth",
      type: "dimension",
      defaultValue: "",
      description: "Толщина подчеркивания текста ссылки",
      xmlParam: "underlineBorderWidth",
      composeParam: "underlineBorderWidth",
      iosParam: "underlineBorderWidth",
      webParam: "linkUnderlineBorder",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  tokenVariations: [
    // View
    { id: 16, tokenId: 19, variationId: 4 },
    { id: 17, tokenId: 20, variationId: 4 },
    { id: 18, tokenId: 21, variationId: 4 },
    // Size
    { id: 19, tokenId: 18, variationId: 5 }
  ],
  variationValues: [
    // View values
    {
      id: 10,
      variationId: 4,
      value: "default",
      description: "Default view",
      isDefaultValue: true,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 11,
      variationId: 4,
      value: "secondary",
      description: "Secondary view",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 12,
      variationId: 4,
      value: "accent",
      description: "Accent view",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 13,
      variationId: 4,
      value: "clear",
      description: "Clear view",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Size values
    {
      id: 14,
      variationId: 5,
      value: "s",
      description: "Small size",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 15,
      variationId: 5,
      value: "m",
      description: "Medium size",
      isDefaultValue: true,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 16,
      variationId: 5,
      value: "l",
      description: "Large size",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  tokenValues: [
    // View: default
    {
      id: 45,
      variationValueId: 10,
      tokenId: 19,
      value: "text.default.primary",
      states: [
        { state: ["pressed"], value: "text.default.primary-active" },
        { state: ["hovered"], value: "text.default.primary-hover" }
      ],
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 46,
      variationValueId: 10,
      tokenId: 20,
      value: "text.default.secondary",
      states: [
        { state: ["pressed"], value: "text.default.secondary-active" },
        { state: ["hovered"], value: "text.default.secondary-hover" }
      ],
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 47,
      variationValueId: 10,
      tokenId: 21,
      value: "0",
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // View: secondary
    {
      id: 48,
      variationValueId: 11,
      tokenId: 19,
      value: "text.default.secondary",
      states: [
        { state: ["pressed"], value: "text.default.secondary-active" },
        { state: ["hovered"], value: "text.default.secondary-hover" }
      ],
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 49,
      variationValueId: 11,
      tokenId: 20,
      value: "text.default.tertiary",
      states: [
        { state: ["pressed"], value: "text.default.tertiary-active" },
        { state: ["hovered"], value: "text.default.tertiary-hover" }
      ],
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 50,
      variationValueId: 11,
      tokenId: 21,
      value: "0",
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // View: accent
    {
      id: 51,
      variationValueId: 12,
      tokenId: 19,
      value: "text.default.accent",
      states: [
        { state: ["pressed"], value: "text.default.accent-active" },
        { state: ["hovered"], value: "text.default.accent-hover" }
      ],
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 52,
      variationValueId: 12,
      tokenId: 20,
      value: "text.default.accent-minor",
      states: [
        { state: ["pressed"], value: "text.default.accent-minor-active" },
        { state: ["hovered"], value: "text.default.accent-minor-hover" }
      ],
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 53,
      variationValueId: 12,
      tokenId: 21,
      value: "0",
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // View: clear
    {
      id: 54,
      variationValueId: 13,
      tokenId: 19,
      value: "inherit",
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 55,
      variationValueId: 13,
      tokenId: 20,
      value: "inherit",
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 56,
      variationValueId: 13,
      tokenId: 21,
      value: "1",
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Size: s
    {
      id: 57,
      variationValueId: 14,
      tokenId: 18,
      value: "body.s.normal",
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Size: m
    {
      id: 58,
      variationValueId: 15,
      tokenId: 18,
      value: "body.m.normal",
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    // Size: l
    {
      id: 59,
      variationValueId: 16,
      tokenId: 18,
      value: "body.l.normal",
      type: "variation",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  propsAPI: [
    {
      id: 3,
      componentId: 2,
      name: "href",
      type: "string",
      description: "URL to navigate to",
      required: true,
      defaultValue: null,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 4,
      componentId: 2,
      name: "target",
      type: "string",
      description: "Target window for link",
      required: false,
      defaultValue: "_self",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  invariantTokenValues: [
    {
      id: 6,
      tokenId: 16, // focusColor
      value: "text.default.accent",
      type: "invariant",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 7,
      tokenId: 17, // disableAlpha
      value: "0.4",
      type: "invariant",
      componentId: 2,
      designSystemId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ]
};
