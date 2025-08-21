// Sample test data based on the actual design system structure

const sampleDesignSystem = {
  name: "test-design-system",
  version: "1.0.0",
  themeData: {
    meta: {
      name: "test-design-system",
      version: "1.0.0",
      tokens: [
        {
          type: "color",
          name: "dark.text.default.primary",
          tags: ["dark", "text", "default", "primary"],
          displayName: "textPrimary",
          description: "Основной цвет текста",
          enabled: true
        },
        {
          type: "color",
          name: "dark.text.default.secondary",
          tags: ["dark", "text", "default", "secondary"],
          displayName: "textSecondary",
          description: "Вторичный цвет текста",
          enabled: true
        },
        {
          type: "spacing",
          name: "spacing.xs",
          tags: ["spacing", "xs"],
          displayName: "spacingXs",
          description: "Очень маленький отступ",
          enabled: true
        }
      ]
    },
    variations: {
      dark: {
        android: {
          "dark.text.default.primary": "#FFFFFF",
          "dark.text.default.secondary": "#CCCCCC",
          "spacing.xs": "4px"
        },
        ios: {
          "dark.text.default.primary": "#FFFFFF",
          "dark.text.default.secondary": "#CCCCCC", 
          "spacing.xs": "4pt"
        },
        web: {
          "dark.text.default.primary": "#FFFFFF",
          "dark.text.default.secondary": "#CCCCCC",
          "spacing.xs": "4px"
        }
      },
      light: {
        android: {
          "dark.text.default.primary": "#000000",
          "dark.text.default.secondary": "#666666",
          "spacing.xs": "4px"
        },
        ios: {
          "dark.text.default.primary": "#000000",
          "dark.text.default.secondary": "#666666",
          "spacing.xs": "4pt"
        },
        web: {
          "dark.text.default.primary": "#000000",
          "dark.text.default.secondary": "#666666",
          "spacing.xs": "4px"
        }
      }
    }
  },
  componentsData: [
    {
      name: "Button",
      description: "Primary button component",
      sources: {
        android: "ButtonAndroid",
        ios: "ButtonIOS", 
        web: "ButtonWeb"
      },
      defaultVariations: [
        {
          variation: "size",
          value: "m"
        },
        {
          variation: "view",
          value: "primary"
        }
      ],
      variations: [
        {
          id: "size-variation-id",
          name: "size"
        },
        {
          id: "view-variation-id", 
          name: "view"
        }
      ]
    }
  ]
};

const sampleDesignSystem2 = {
  name: "another-design-system",
  version: "2.0.0",
  themeData: {
    meta: {
      name: "another-design-system",
      version: "2.0.0",
      tokens: [
        {
          type: "color",
          name: "primary.background",
          tags: ["primary", "background"],
          displayName: "primaryBackground",
          description: "Primary background color",
          enabled: true
        }
      ]
    },
    variations: {
      default: {
        web: {
          "primary.background": "#F5F5F5"
        }
      }
    }
  },
  componentsData: [
    {
      name: "Input",
      description: "Text input component",
      sources: {
        web: "InputWeb"
      },
      defaultVariations: [],
      variations: []
    }
  ]
};

module.exports = {
  sampleDesignSystem,
  sampleDesignSystem2
};
