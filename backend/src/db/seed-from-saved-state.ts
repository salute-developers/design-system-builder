import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { eq, and } from 'drizzle-orm';

// Get database URL from environment or use default
const connectionString = `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ds_builder'}`;

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Extracted data from current database state
const extractedData = {
  "designSystems": [
    {
      "id": 4,
      "name": "test-42",
      "description": "Design System test-42 version 0.1.0",
      "createdAt": "2025-09-06T08:49:39.232Z",
      "updatedAt": "2025-09-06T08:49:39.232Z"
    }
  ],
  "components": [
    {
      "id": 16,
      "name": "Link",
      "description": "Clickable link component for navigation",
      "createdAt": "2025-09-06T08:49:39.239Z",
      "updatedAt": "2025-09-06T08:49:39.239Z",
      "variations": [
        {
          "id": 35,
          "componentId": 16,
          "name": "view",
          "description": "Visual appearance variation (default, primary, secondary, tertiary, paragraph, accent, positive, warning, negative, clear)",
          "createdAt": "2025-09-06T08:49:39.246Z",
          "updatedAt": "2025-09-06T08:49:39.246Z"
        },
        {
          "id": 36,
          "componentId": 16,
          "name": "size",
          "description": "",
          "createdAt": "2025-09-06T08:49:39.246Z",
          "updatedAt": "2025-09-06T08:49:39.246Z"
        }
      ],
      "tokens": [
        {
          "id": 83,
          "componentId": 16,
          "name": "focusColor",
          "type": "color",
          "defaultValue": "",
          "description": "цвет ссылки в фокусе",
          "xmlParam": "sd_focusColor",
          "composeParam": "focusColor",
          "iosParam": "focusColor",
          "webParam": "linkColorFocus",
          "createdAt": "2025-09-06T08:49:39.254Z",
          "updatedAt": "2025-09-06T08:49:39.254Z"
        },
        {
          "id": 84,
          "componentId": 16,
          "name": "disableAlpha",
          "type": "float",
          "defaultValue": "",
          "description": "прозрачность в отключенном состоянии",
          "xmlParam": "android:alpha",
          "composeParam": "disabledOpacity",
          "iosParam": "disabledOpacity",
          "webParam": "linkDisabledOpacity",
          "createdAt": "2025-09-06T08:49:39.254Z",
          "updatedAt": "2025-09-06T08:49:39.254Z"
        },
        {
          "id": 85,
          "componentId": 16,
          "name": "textColor",
          "type": "color",
          "defaultValue": "",
          "description": "цвет текста ссылки",
          "xmlParam": "contentColor",
          "composeParam": "contentColor",
          "iosParam": "contentColor",
          "webParam": "linkColor",
          "createdAt": "2025-09-06T08:49:39.254Z",
          "updatedAt": "2025-09-06T08:49:39.254Z"
        },
        {
          "id": 86,
          "componentId": 16,
          "name": "textColorVisited",
          "type": "color",
          "defaultValue": "",
          "description": "Цвет текста посещённой ссылки",
          "xmlParam": "contentColorVisited",
          "composeParam": "contentColorVisited",
          "iosParam": "contentColorVisited",
          "webParam": "linkColorVisited",
          "createdAt": "2025-09-06T08:49:39.254Z",
          "updatedAt": "2025-09-06T08:49:39.254Z"
        },
        {
          "id": 87,
          "componentId": 16,
          "name": "underlineBorderWidth",
          "type": "dimension",
          "defaultValue": "",
          "description": "толщина подчеркивания",
          "xmlParam": "android:textUnderline",
          "composeParam": "textDecoration",
          "iosParam": "underlineThickness",
          "webParam": "linkUnderlineBorder",
          "createdAt": "2025-09-06T08:49:39.254Z",
          "updatedAt": "2025-09-06T08:49:39.254Z"
        },
        {
          "id": 88,
          "componentId": 16,
          "name": "textStyle",
          "type": "typography",
          "defaultValue": "",
          "description": "семейство шрифта ссылки",
          "xmlParam": "android:minHeight",
          "composeParam": "height",
          "iosParam": "height",
          "webParam": "linkFont",
          "createdAt": "2025-09-06T08:49:39.254Z",
          "updatedAt": "2025-09-06T08:49:39.254Z"
        }
      ],
      "propsAPI": [
        {
          "id": 9,
          "componentId": 16,
          "name": "disabled",
          "value": "false",
          "createdAt": "2025-09-06T08:49:39.271Z",
          "updatedAt": "2025-09-06T08:49:39.271Z"
        },
        {
          "id": 10,
          "componentId": 16,
          "name": "target",
          "value": "_blank",
          "createdAt": "2025-09-06T08:49:39.271Z",
          "updatedAt": "2025-09-06T08:49:39.271Z"
        },
        {
          "id": 11,
          "componentId": 16,
          "name": "href",
          "value": "https://google.com",
          "createdAt": "2025-09-06T08:49:39.271Z",
          "updatedAt": "2025-09-06T08:49:39.271Z"
        },
        {
          "id": 12,
          "componentId": 16,
          "name": "text",
          "value": "hello world",
          "createdAt": "2025-09-06T08:49:39.271Z",
          "updatedAt": "2025-09-06T08:49:39.271Z"
        }
      ]
    },
    {
      "id": 17,
      "name": "IconButton",
      "description": "",
      "createdAt": "2025-09-06T08:49:39.239Z",
      "updatedAt": "2025-09-06T08:49:39.239Z",
      "variations": [
        {
          "id": 26,
          "componentId": 17,
          "name": "view",
          "description": "",
          "createdAt": "2025-09-06T08:49:39.246Z",
          "updatedAt": "2025-09-06T08:49:39.246Z"
        },
        {
          "id": 27,
          "componentId": 17,
          "name": "size",
          "description": "",
          "createdAt": "2025-09-06T08:49:39.246Z",
          "updatedAt": "2025-09-06T08:49:39.246Z"
        },
        {
          "id": 28,
          "componentId": 17,
          "name": "shape",
          "description": "",
          "createdAt": "2025-09-06T08:49:39.246Z",
          "updatedAt": "2025-09-06T08:49:39.246Z"
        }
      ],
      "tokens": [
        {
          "id": 74,
          "componentId": 17,
          "name": "Test token 1",
          "type": "number",
          "defaultValue": "42",
          "description": "",
          "xmlParam": "",
          "composeParam": "",
          "iosParam": "",
          "webParam": "",
          "createdAt": "2025-09-06T08:49:39.254Z",
          "updatedAt": "2025-09-06T08:49:39.254Z"
        }
      ],
      "propsAPI": []
    },
    {
      "id": 18,
      "name": "Button",
      "description": "test empty button",
      "createdAt": "2025-09-06T08:49:39.239Z",
      "updatedAt": "2025-09-06T08:49:39.239Z",
      "variations": [],
      "tokens": [],
      "propsAPI": []
    },
    {
      "id": 19,
      "name": "Checkbox",
      "description": "",
      "createdAt": "2025-09-06T08:49:39.239Z",
      "updatedAt": "2025-09-06T08:49:39.239Z",
      "variations": [],
      "tokens": [],
      "propsAPI": []
    },
    {
      "id": 20,
      "name": "Radiobox",
      "description": "",
      "createdAt": "2025-09-06T08:49:39.239Z",
      "updatedAt": "2025-09-06T08:49:39.239Z",
      "variations": [],
      "tokens": [],
      "propsAPI": []
    },
    {
      "id": 21,
      "name": "TestButton",
      "description": "A test button component",
      "createdAt": "2025-09-06T08:49:39.239Z",
      "updatedAt": "2025-09-06T08:49:39.239Z",
      "variations": [
        {
          "id": 25,
          "componentId": 21,
          "name": "primary",
          "description": "",
          "createdAt": "2025-09-06T08:49:39.246Z",
          "updatedAt": "2025-09-06T08:49:39.246Z"
        }
      ],
      "tokens": [
        {
          "id": 73,
          "componentId": 21,
          "name": "backgroundColor",
          "type": "color",
          "defaultValue": "",
          "description": "Button background color",
          "xmlParam": "android:background",
          "composeParam": "backgroundColor",
          "iosParam": "backgroundColor",
          "webParam": "buttonBg",
          "createdAt": "2025-09-06T08:49:39.254Z",
          "updatedAt": "2025-09-06T08:49:39.254Z"
        }
      ],
      "propsAPI": []
    }
  ],
  "variations": [
    {
      "id": 25,
      "componentId": 21,
      "name": "primary",
      "description": "",
      "createdAt": "2025-09-06T08:49:39.246Z",
      "updatedAt": "2025-09-06T08:49:39.246Z",
      "tokenVariations": []
    },
    {
      "id": 26,
      "componentId": 17,
      "name": "view",
      "description": "",
      "createdAt": "2025-09-06T08:49:39.246Z",
      "updatedAt": "2025-09-06T08:49:39.246Z",
      "tokenVariations": []
    },
    {
      "id": 27,
      "componentId": 17,
      "name": "size",
      "description": "",
      "createdAt": "2025-09-06T08:49:39.246Z",
      "updatedAt": "2025-09-06T08:49:39.246Z",
      "tokenVariations": []
    },
    {
      "id": 28,
      "componentId": 17,
      "name": "shape",
      "description": "",
      "createdAt": "2025-09-06T08:49:39.246Z",
      "updatedAt": "2025-09-06T08:49:39.246Z",
      "tokenVariations": []
    },
    {
      "id": 35,
      "componentId": 16,
      "name": "view",
      "description": "Visual appearance variation (default, primary, secondary, tertiary, paragraph, accent, positive, warning, negative, clear)",
      "createdAt": "2025-09-06T08:49:39.246Z",
      "updatedAt": "2025-09-06T08:49:39.246Z",
      "tokenVariations": [
        {
          "id": 86,
          "tokenId": 85,
          "variationId": 35,
          "createdAt": "2025-09-06T08:49:39.262Z",
          "updatedAt": "2025-09-06T08:49:39.262Z",
          "token": {
            "id": 85,
            "componentId": 16,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        },
        {
          "id": 87,
          "tokenId": 87,
          "variationId": 35,
          "createdAt": "2025-09-06T08:49:39.262Z",
          "updatedAt": "2025-09-06T08:49:39.262Z",
          "token": {
            "id": 87,
            "componentId": 16,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        },
        {
          "id": 89,
          "tokenId": 86,
          "variationId": 35,
          "createdAt": "2025-09-06T08:49:39.262Z",
          "updatedAt": "2025-09-06T08:49:39.262Z",
          "token": {
            "id": 86,
            "componentId": 16,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    },
    {
      "id": 36,
      "componentId": 16,
      "name": "size",
      "description": "",
      "createdAt": "2025-09-06T08:49:39.246Z",
      "updatedAt": "2025-09-06T08:49:39.246Z",
      "tokenVariations": [
        {
          "id": 88,
          "tokenId": 88,
          "variationId": 36,
          "createdAt": "2025-09-06T08:49:39.262Z",
          "updatedAt": "2025-09-06T08:49:39.262Z",
          "token": {
            "id": 88,
            "componentId": 16,
            "name": "textStyle",
            "type": "typography",
            "defaultValue": "",
            "description": "семейство шрифта ссылки",
            "xmlParam": "android:minHeight",
            "composeParam": "height",
            "iosParam": "height",
            "webParam": "linkFont",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    }
  ],
  "tokens": [
    {
      "id": 73,
      "componentId": 21,
      "name": "backgroundColor",
      "type": "color",
      "defaultValue": "",
      "description": "Button background color",
      "xmlParam": "android:background",
      "composeParam": "backgroundColor",
      "iosParam": "backgroundColor",
      "webParam": "buttonBg",
      "createdAt": "2025-09-06T08:49:39.254Z",
      "updatedAt": "2025-09-06T08:49:39.254Z"
    },
    {
      "id": 74,
      "componentId": 17,
      "name": "Test token 1",
      "type": "number",
      "defaultValue": "42",
      "description": "",
      "xmlParam": "",
      "composeParam": "",
      "iosParam": "",
      "webParam": "",
      "createdAt": "2025-09-06T08:49:39.254Z",
      "updatedAt": "2025-09-06T08:49:39.254Z"
    },
    {
      "id": 83,
      "componentId": 16,
      "name": "focusColor",
      "type": "color",
      "defaultValue": "",
      "description": "цвет ссылки в фокусе",
      "xmlParam": "sd_focusColor",
      "composeParam": "focusColor",
      "iosParam": "focusColor",
      "webParam": "linkColorFocus",
      "createdAt": "2025-09-06T08:49:39.254Z",
      "updatedAt": "2025-09-06T08:49:39.254Z"
    },
    {
      "id": 84,
      "componentId": 16,
      "name": "disableAlpha",
      "type": "float",
      "defaultValue": "",
      "description": "прозрачность в отключенном состоянии",
      "xmlParam": "android:alpha",
      "composeParam": "disabledOpacity",
      "iosParam": "disabledOpacity",
      "webParam": "linkDisabledOpacity",
      "createdAt": "2025-09-06T08:49:39.254Z",
      "updatedAt": "2025-09-06T08:49:39.254Z"
    },
    {
      "id": 85,
      "componentId": 16,
      "name": "textColor",
      "type": "color",
      "defaultValue": "",
      "description": "цвет текста ссылки",
      "xmlParam": "contentColor",
      "composeParam": "contentColor",
      "iosParam": "contentColor",
      "webParam": "linkColor",
      "createdAt": "2025-09-06T08:49:39.254Z",
      "updatedAt": "2025-09-06T08:49:39.254Z"
    },
    {
      "id": 86,
      "componentId": 16,
      "name": "textColorVisited",
      "type": "color",
      "defaultValue": "",
      "description": "Цвет текста посещённой ссылки",
      "xmlParam": "contentColorVisited",
      "composeParam": "contentColorVisited",
      "iosParam": "contentColorVisited",
      "webParam": "linkColorVisited",
      "createdAt": "2025-09-06T08:49:39.254Z",
      "updatedAt": "2025-09-06T08:49:39.254Z"
    },
    {
      "id": 87,
      "componentId": 16,
      "name": "underlineBorderWidth",
      "type": "dimension",
      "defaultValue": "",
      "description": "толщина подчеркивания",
      "xmlParam": "android:textUnderline",
      "composeParam": "textDecoration",
      "iosParam": "underlineThickness",
      "webParam": "linkUnderlineBorder",
      "createdAt": "2025-09-06T08:49:39.254Z",
      "updatedAt": "2025-09-06T08:49:39.254Z"
    },
    {
      "id": 88,
      "componentId": 16,
      "name": "textStyle",
      "type": "typography",
      "defaultValue": "",
      "description": "семейство шрифта ссылки",
      "xmlParam": "android:minHeight",
      "composeParam": "height",
      "iosParam": "height",
      "webParam": "linkFont",
      "createdAt": "2025-09-06T08:49:39.254Z",
      "updatedAt": "2025-09-06T08:49:39.254Z"
    }
  ],
  "tokenVariations": [
    {
      "id": 86,
      "tokenId": 85,
      "variationId": 35,
      "createdAt": "2025-09-06T08:49:39.262Z",
      "updatedAt": "2025-09-06T08:49:39.262Z"
    },
    {
      "id": 87,
      "tokenId": 87,
      "variationId": 35,
      "createdAt": "2025-09-06T08:49:39.262Z",
      "updatedAt": "2025-09-06T08:49:39.262Z"
    },
    {
      "id": 88,
      "tokenId": 88,
      "variationId": 36,
      "createdAt": "2025-09-06T08:49:39.262Z",
      "updatedAt": "2025-09-06T08:49:39.262Z"
    },
    {
      "id": 89,
      "tokenId": 86,
      "variationId": 35,
      "createdAt": "2025-09-06T08:49:39.262Z",
      "updatedAt": "2025-09-06T08:49:39.262Z"
    }
  ],
  "variationValues": [
    {
      "id": 60,
      "designSystemId": 4,
      "componentId": 17,
      "variationId": 26,
      "name": "default",
      "description": "",
      "isDefaultValue": "true",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": [
        {
          "id": 63,
          "tokenId": 73,
          "value": "surface.default.solid-default",
          "type": "variation",
          "variationValueId": 60,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 73,
            "componentId": 21,
            "name": "backgroundColor",
            "type": "color",
            "defaultValue": "",
            "description": "Button background color",
            "xmlParam": "android:background",
            "composeParam": "backgroundColor",
            "iosParam": "backgroundColor",
            "webParam": "buttonBg",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    },
    {
      "id": 61,
      "designSystemId": 4,
      "componentId": 17,
      "variationId": 26,
      "name": "secondary",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": [
        {
          "id": 64,
          "tokenId": 73,
          "value": "surface.default.transparent-secondary",
          "type": "variation",
          "variationValueId": 61,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 73,
            "componentId": 21,
            "name": "backgroundColor",
            "type": "color",
            "defaultValue": "",
            "description": "Button background color",
            "xmlParam": "android:background",
            "composeParam": "backgroundColor",
            "iosParam": "backgroundColor",
            "webParam": "buttonBg",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    },
    {
      "id": 62,
      "designSystemId": 4,
      "componentId": 17,
      "variationId": 26,
      "name": "accent",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": [
        {
          "id": 65,
          "tokenId": 73,
          "value": "surface.default.accent",
          "type": "variation",
          "variationValueId": 62,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 73,
            "componentId": 21,
            "name": "backgroundColor",
            "type": "color",
            "defaultValue": "",
            "description": "Button background color",
            "xmlParam": "android:background",
            "composeParam": "backgroundColor",
            "iosParam": "backgroundColor",
            "webParam": "buttonBg",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    },
    {
      "id": 63,
      "designSystemId": 4,
      "componentId": 17,
      "variationId": 27,
      "name": "xl",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": []
    },
    {
      "id": 64,
      "designSystemId": 4,
      "componentId": 17,
      "variationId": 27,
      "name": "l",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": []
    },
    {
      "id": 65,
      "designSystemId": 4,
      "componentId": 17,
      "variationId": 27,
      "name": "m",
      "description": "",
      "isDefaultValue": "true",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": []
    },
    {
      "id": 66,
      "designSystemId": 4,
      "componentId": 17,
      "variationId": 28,
      "name": "rounded",
      "description": "",
      "isDefaultValue": "true",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": []
    },
    {
      "id": 67,
      "designSystemId": 4,
      "componentId": 17,
      "variationId": 28,
      "name": "pilled",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": []
    },
    {
      "id": 68,
      "designSystemId": 4,
      "componentId": 16,
      "variationId": 36,
      "name": "s",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": [
        {
          "id": 75,
          "tokenId": 88,
          "value": "body.s.normal",
          "type": "variation",
          "variationValueId": 68,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 88,
            "componentId": 16,
            "name": "textStyle",
            "type": "typography",
            "defaultValue": "",
            "description": "семейство шрифта ссылки",
            "xmlParam": "android:minHeight",
            "composeParam": "height",
            "iosParam": "height",
            "webParam": "linkFont",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    },
    {
      "id": 69,
      "designSystemId": 4,
      "componentId": 16,
      "variationId": 36,
      "name": "m",
      "description": "",
      "isDefaultValue": "true",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": [
        {
          "id": 76,
          "tokenId": 88,
          "value": "body.m.normal",
          "type": "variation",
          "variationValueId": 69,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 88,
            "componentId": 16,
            "name": "textStyle",
            "type": "typography",
            "defaultValue": "",
            "description": "семейство шрифта ссылки",
            "xmlParam": "android:minHeight",
            "composeParam": "height",
            "iosParam": "height",
            "webParam": "linkFont",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    },
    {
      "id": 70,
      "designSystemId": 4,
      "componentId": 16,
      "variationId": 36,
      "name": "l",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": [
        {
          "id": 77,
          "tokenId": 88,
          "value": "body.l.normal",
          "type": "variation",
          "variationValueId": 70,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 88,
            "componentId": 16,
            "name": "textStyle",
            "type": "typography",
            "defaultValue": "",
            "description": "семейство шрифта ссылки",
            "xmlParam": "android:minHeight",
            "composeParam": "height",
            "iosParam": "height",
            "webParam": "linkFont",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    },
    {
      "id": 71,
      "designSystemId": 4,
      "componentId": 16,
      "variationId": 35,
      "name": "default",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": [
        {
          "id": 66,
          "tokenId": 85,
          "value": "text.default.primary",
          "type": "variation",
          "variationValueId": 71,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 85,
            "componentId": 16,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        },
        {
          "id": 67,
          "tokenId": 86,
          "value": "text.default.secondary",
          "type": "variation",
          "variationValueId": 71,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 86,
            "componentId": 16,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        },
        {
          "id": 68,
          "tokenId": 87,
          "value": "0",
          "type": "variation",
          "variationValueId": 71,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 87,
            "componentId": 16,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    },
    {
      "id": 72,
      "designSystemId": 4,
      "componentId": 16,
      "variationId": 35,
      "name": "secondary",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": [
        {
          "id": 69,
          "tokenId": 85,
          "value": "text.default.secondary",
          "type": "variation",
          "variationValueId": 72,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 85,
            "componentId": 16,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        },
        {
          "id": 70,
          "tokenId": 86,
          "value": "text.default.tertiary",
          "type": "variation",
          "variationValueId": 72,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 86,
            "componentId": 16,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        },
        {
          "id": 71,
          "tokenId": 87,
          "value": "0",
          "type": "variation",
          "variationValueId": 72,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 87,
            "componentId": 16,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    },
    {
      "id": 73,
      "designSystemId": 4,
      "componentId": 16,
      "variationId": 35,
      "name": "clear",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": [
        {
          "id": 72,
          "tokenId": 85,
          "value": "inherit",
          "type": "variation",
          "variationValueId": 73,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 85,
            "componentId": 16,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        },
        {
          "id": 73,
          "tokenId": 86,
          "value": "inherit",
          "type": "variation",
          "variationValueId": 73,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 86,
            "componentId": 16,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        },
        {
          "id": 74,
          "tokenId": 87,
          "value": "1",
          "type": "variation",
          "variationValueId": 73,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 87,
            "componentId": 16,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    },
    {
      "id": 74,
      "designSystemId": 4,
      "componentId": 16,
      "variationId": 35,
      "name": "accent",
      "description": "",
      "isDefaultValue": "true",
      "createdAt": "2025-09-06T08:49:39.276Z",
      "updatedAt": "2025-09-06T08:49:39.276Z",
      "tokenValues": [
        {
          "id": 78,
          "tokenId": 85,
          "value": "text.default.accent",
          "type": "variation",
          "variationValueId": 74,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 85,
            "componentId": 16,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        },
        {
          "id": 79,
          "tokenId": 86,
          "value": "text.default.accent-minor",
          "type": "variation",
          "variationValueId": 74,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 86,
            "componentId": 16,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        },
        {
          "id": 80,
          "tokenId": 87,
          "value": "0",
          "type": "variation",
          "variationValueId": 74,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-06T08:49:39.283Z",
          "updatedAt": "2025-09-06T08:49:39.283Z",
          "token": {
            "id": 87,
            "componentId": 16,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-09-06T08:49:39.254Z",
            "updatedAt": "2025-09-06T08:49:39.254Z"
          }
        }
      ]
    }
  ],
  "tokenValues": [
    {
      "id": 63,
      "tokenId": 73,
      "value": "surface.default.solid-default",
      "type": "variation",
      "variationValueId": 60,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 73,
        "componentId": 21,
        "name": "backgroundColor",
        "type": "color",
        "defaultValue": "",
        "description": "Button background color",
        "xmlParam": "android:background",
        "composeParam": "backgroundColor",
        "iosParam": "backgroundColor",
        "webParam": "buttonBg",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 64,
      "tokenId": 73,
      "value": "surface.default.transparent-secondary",
      "type": "variation",
      "variationValueId": 61,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 73,
        "componentId": 21,
        "name": "backgroundColor",
        "type": "color",
        "defaultValue": "",
        "description": "Button background color",
        "xmlParam": "android:background",
        "composeParam": "backgroundColor",
        "iosParam": "backgroundColor",
        "webParam": "buttonBg",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 65,
      "tokenId": 73,
      "value": "surface.default.accent",
      "type": "variation",
      "variationValueId": 62,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 73,
        "componentId": 21,
        "name": "backgroundColor",
        "type": "color",
        "defaultValue": "",
        "description": "Button background color",
        "xmlParam": "android:background",
        "composeParam": "backgroundColor",
        "iosParam": "backgroundColor",
        "webParam": "buttonBg",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 66,
      "tokenId": 85,
      "value": "text.default.primary",
      "type": "variation",
      "variationValueId": 71,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 85,
        "componentId": 16,
        "name": "textColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет текста ссылки",
        "xmlParam": "contentColor",
        "composeParam": "contentColor",
        "iosParam": "contentColor",
        "webParam": "linkColor",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 67,
      "tokenId": 86,
      "value": "text.default.secondary",
      "type": "variation",
      "variationValueId": 71,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 86,
        "componentId": 16,
        "name": "textColorVisited",
        "type": "color",
        "defaultValue": "",
        "description": "Цвет текста посещённой ссылки",
        "xmlParam": "contentColorVisited",
        "composeParam": "contentColorVisited",
        "iosParam": "contentColorVisited",
        "webParam": "linkColorVisited",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 68,
      "tokenId": 87,
      "value": "0",
      "type": "variation",
      "variationValueId": 71,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 87,
        "componentId": 16,
        "name": "underlineBorderWidth",
        "type": "dimension",
        "defaultValue": "",
        "description": "толщина подчеркивания",
        "xmlParam": "android:textUnderline",
        "composeParam": "textDecoration",
        "iosParam": "underlineThickness",
        "webParam": "linkUnderlineBorder",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 69,
      "tokenId": 85,
      "value": "text.default.secondary",
      "type": "variation",
      "variationValueId": 72,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 85,
        "componentId": 16,
        "name": "textColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет текста ссылки",
        "xmlParam": "contentColor",
        "composeParam": "contentColor",
        "iosParam": "contentColor",
        "webParam": "linkColor",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 70,
      "tokenId": 86,
      "value": "text.default.tertiary",
      "type": "variation",
      "variationValueId": 72,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 86,
        "componentId": 16,
        "name": "textColorVisited",
        "type": "color",
        "defaultValue": "",
        "description": "Цвет текста посещённой ссылки",
        "xmlParam": "contentColorVisited",
        "composeParam": "contentColorVisited",
        "iosParam": "contentColorVisited",
        "webParam": "linkColorVisited",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 71,
      "tokenId": 87,
      "value": "0",
      "type": "variation",
      "variationValueId": 72,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 87,
        "componentId": 16,
        "name": "underlineBorderWidth",
        "type": "dimension",
        "defaultValue": "",
        "description": "толщина подчеркивания",
        "xmlParam": "android:textUnderline",
        "composeParam": "textDecoration",
        "iosParam": "underlineThickness",
        "webParam": "linkUnderlineBorder",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 72,
      "tokenId": 85,
      "value": "inherit",
      "type": "variation",
      "variationValueId": 73,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 85,
        "componentId": 16,
        "name": "textColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет текста ссылки",
        "xmlParam": "contentColor",
        "composeParam": "contentColor",
        "iosParam": "contentColor",
        "webParam": "linkColor",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 73,
      "tokenId": 86,
      "value": "inherit",
      "type": "variation",
      "variationValueId": 73,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 86,
        "componentId": 16,
        "name": "textColorVisited",
        "type": "color",
        "defaultValue": "",
        "description": "Цвет текста посещённой ссылки",
        "xmlParam": "contentColorVisited",
        "composeParam": "contentColorVisited",
        "iosParam": "contentColorVisited",
        "webParam": "linkColorVisited",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 74,
      "tokenId": 87,
      "value": "1",
      "type": "variation",
      "variationValueId": 73,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 87,
        "componentId": 16,
        "name": "underlineBorderWidth",
        "type": "dimension",
        "defaultValue": "",
        "description": "толщина подчеркивания",
        "xmlParam": "android:textUnderline",
        "composeParam": "textDecoration",
        "iosParam": "underlineThickness",
        "webParam": "linkUnderlineBorder",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 75,
      "tokenId": 88,
      "value": "body.s.normal",
      "type": "variation",
      "variationValueId": 68,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 88,
        "componentId": 16,
        "name": "textStyle",
        "type": "typography",
        "defaultValue": "",
        "description": "семейство шрифта ссылки",
        "xmlParam": "android:minHeight",
        "composeParam": "height",
        "iosParam": "height",
        "webParam": "linkFont",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 76,
      "tokenId": 88,
      "value": "body.m.normal",
      "type": "variation",
      "variationValueId": 69,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 88,
        "componentId": 16,
        "name": "textStyle",
        "type": "typography",
        "defaultValue": "",
        "description": "семейство шрифта ссылки",
        "xmlParam": "android:minHeight",
        "composeParam": "height",
        "iosParam": "height",
        "webParam": "linkFont",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 77,
      "tokenId": 88,
      "value": "body.l.normal",
      "type": "variation",
      "variationValueId": 70,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 88,
        "componentId": 16,
        "name": "textStyle",
        "type": "typography",
        "defaultValue": "",
        "description": "семейство шрифта ссылки",
        "xmlParam": "android:minHeight",
        "composeParam": "height",
        "iosParam": "height",
        "webParam": "linkFont",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 78,
      "tokenId": 85,
      "value": "text.default.accent",
      "type": "variation",
      "variationValueId": 74,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 85,
        "componentId": 16,
        "name": "textColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет текста ссылки",
        "xmlParam": "contentColor",
        "composeParam": "contentColor",
        "iosParam": "contentColor",
        "webParam": "linkColor",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 79,
      "tokenId": 86,
      "value": "text.default.accent-minor",
      "type": "variation",
      "variationValueId": 74,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 86,
        "componentId": 16,
        "name": "textColorVisited",
        "type": "color",
        "defaultValue": "",
        "description": "Цвет текста посещённой ссылки",
        "xmlParam": "contentColorVisited",
        "composeParam": "contentColorVisited",
        "iosParam": "contentColorVisited",
        "webParam": "linkColorVisited",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 80,
      "tokenId": 87,
      "value": "0",
      "type": "variation",
      "variationValueId": 74,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.283Z",
      "updatedAt": "2025-09-06T08:49:39.283Z",
      "token": {
        "id": 87,
        "componentId": 16,
        "name": "underlineBorderWidth",
        "type": "dimension",
        "defaultValue": "",
        "description": "толщина подчеркивания",
        "xmlParam": "android:textUnderline",
        "composeParam": "textDecoration",
        "iosParam": "underlineThickness",
        "webParam": "linkUnderlineBorder",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 81,
      "tokenId": 84,
      "value": "0.4",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 16,
      "designSystemId": 4,
      "createdAt": "2025-09-06T08:49:39.289Z",
      "updatedAt": "2025-09-06T08:49:39.289Z",
      "token": {
        "id": 84,
        "componentId": 16,
        "name": "disableAlpha",
        "type": "float",
        "defaultValue": "",
        "description": "прозрачность в отключенном состоянии",
        "xmlParam": "android:alpha",
        "composeParam": "disabledOpacity",
        "iosParam": "disabledOpacity",
        "webParam": "linkDisabledOpacity",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 82,
      "tokenId": 83,
      "value": "text.default.accent",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 16,
      "designSystemId": 4,
      "createdAt": "2025-09-06T08:49:39.289Z",
      "updatedAt": "2025-09-06T08:49:39.289Z",
      "token": {
        "id": 83,
        "componentId": 16,
        "name": "focusColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет ссылки в фокусе",
        "xmlParam": "sd_focusColor",
        "composeParam": "focusColor",
        "iosParam": "focusColor",
        "webParam": "linkColorFocus",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 83,
      "tokenId": 83,
      "value": "#28a745",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 16,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.289Z",
      "updatedAt": "2025-09-06T08:49:39.289Z",
      "token": {
        "id": 83,
        "componentId": 16,
        "name": "focusColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет ссылки в фокусе",
        "xmlParam": "sd_focusColor",
        "composeParam": "focusColor",
        "iosParam": "focusColor",
        "webParam": "linkColorFocus",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 84,
      "tokenId": 84,
      "value": "0.8",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 16,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.289Z",
      "updatedAt": "2025-09-06T08:49:39.289Z",
      "token": {
        "id": 84,
        "componentId": 16,
        "name": "disableAlpha",
        "type": "float",
        "defaultValue": "",
        "description": "прозрачность в отключенном состоянии",
        "xmlParam": "android:alpha",
        "composeParam": "disabledOpacity",
        "iosParam": "disabledOpacity",
        "webParam": "linkDisabledOpacity",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    }
  ],
  "designSystemComponents": [
    {
      "id": 19,
      "designSystemId": 4,
      "componentId": 17,
      "createdAt": "2025-09-06T08:49:39.267Z",
      "updatedAt": "2025-09-06T08:49:39.267Z"
    },
    {
      "id": 20,
      "designSystemId": 4,
      "componentId": 18,
      "createdAt": "2025-09-06T08:49:39.267Z",
      "updatedAt": "2025-09-06T08:49:39.267Z"
    },
    {
      "id": 21,
      "designSystemId": 4,
      "componentId": 16,
      "createdAt": "2025-09-06T08:49:39.267Z",
      "updatedAt": "2025-09-06T08:49:39.267Z"
    },
    {
      "id": 22,
      "designSystemId": 4,
      "componentId": 19,
      "createdAt": "2025-09-06T08:49:39.267Z",
      "updatedAt": "2025-09-06T08:49:39.267Z"
    },
    {
      "id": 23,
      "designSystemId": 4,
      "componentId": 20,
      "createdAt": "2025-09-06T08:49:39.267Z",
      "updatedAt": "2025-09-06T08:49:39.267Z"
    }
  ],
  "propsAPI": [
    {
      "id": 9,
      "componentId": 16,
      "name": "disabled",
      "value": "false",
      "createdAt": "2025-09-06T08:49:39.271Z",
      "updatedAt": "2025-09-06T08:49:39.271Z"
    },
    {
      "id": 10,
      "componentId": 16,
      "name": "target",
      "value": "_blank",
      "createdAt": "2025-09-06T08:49:39.271Z",
      "updatedAt": "2025-09-06T08:49:39.271Z"
    },
    {
      "id": 11,
      "componentId": 16,
      "name": "href",
      "value": "https://google.com",
      "createdAt": "2025-09-06T08:49:39.271Z",
      "updatedAt": "2025-09-06T08:49:39.271Z"
    },
    {
      "id": 12,
      "componentId": 16,
      "name": "text",
      "value": "hello world",
      "createdAt": "2025-09-06T08:49:39.271Z",
      "updatedAt": "2025-09-06T08:49:39.271Z"
    }
  ],
  "invariantTokenValues": [
    {
      "id": 81,
      "tokenId": 84,
      "value": "0.4",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 16,
      "designSystemId": 4,
      "createdAt": "2025-09-06T08:49:39.289Z",
      "updatedAt": "2025-09-06T08:49:39.289Z",
      "token": {
        "id": 84,
        "componentId": 16,
        "name": "disableAlpha",
        "type": "float",
        "defaultValue": "",
        "description": "прозрачность в отключенном состоянии",
        "xmlParam": "android:alpha",
        "composeParam": "disabledOpacity",
        "iosParam": "disabledOpacity",
        "webParam": "linkDisabledOpacity",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 82,
      "tokenId": 83,
      "value": "text.default.accent",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 16,
      "designSystemId": 4,
      "createdAt": "2025-09-06T08:49:39.289Z",
      "updatedAt": "2025-09-06T08:49:39.289Z",
      "token": {
        "id": 83,
        "componentId": 16,
        "name": "focusColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет ссылки в фокусе",
        "xmlParam": "sd_focusColor",
        "composeParam": "focusColor",
        "iosParam": "focusColor",
        "webParam": "linkColorFocus",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 83,
      "tokenId": 83,
      "value": "#28a745",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 16,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.289Z",
      "updatedAt": "2025-09-06T08:49:39.289Z",
      "token": {
        "id": 83,
        "componentId": 16,
        "name": "focusColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет ссылки в фокусе",
        "xmlParam": "sd_focusColor",
        "composeParam": "focusColor",
        "iosParam": "focusColor",
        "webParam": "linkColorFocus",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    },
    {
      "id": 84,
      "tokenId": 84,
      "value": "0.8",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 16,
      "designSystemId": null,
      "createdAt": "2025-09-06T08:49:39.289Z",
      "updatedAt": "2025-09-06T08:49:39.289Z",
      "token": {
        "id": 84,
        "componentId": 16,
        "name": "disableAlpha",
        "type": "float",
        "defaultValue": "",
        "description": "прозрачность в отключенном состоянии",
        "xmlParam": "android:alpha",
        "composeParam": "disabledOpacity",
        "iosParam": "disabledOpacity",
        "webParam": "linkDisabledOpacity",
        "createdAt": "2025-09-06T08:49:39.254Z",
        "updatedAt": "2025-09-06T08:49:39.254Z"
      }
    }
  ]
};

async function seedFromExtractedData(clearDatabase = false) {
  console.log('🌱 Starting database seed from extracted data...');

  if (clearDatabase) {
    console.log('⚠️  WARNING: This will clear all existing data!');
    console.log('🧹 Clearing existing data...');
    await db.delete(schema.tokenValues);
    await db.delete(schema.tokenVariations);
    await db.delete(schema.variationValues);
    await db.delete(schema.propsAPI);
    await db.delete(schema.tokens);
    await db.delete(schema.variations);
    await db.delete(schema.designSystemComponents);
    await db.delete(schema.components);
    await db.delete(schema.designSystems);
  } else {
    console.log('ℹ️  Adding data to existing database (no clearing)');
  }

  try {
    // Insert Design Systems
    console.log('📊 Creating design systems...');
    const designSystemInserts = extractedData.designSystems.map(ds => ({
      name: ds.name,
      description: ds.description
    }));
    const insertedDesignSystems = await db.insert(schema.designSystems).values(designSystemInserts).returning();
    console.log(`✅ Created ${insertedDesignSystems.length} design systems`);

    // Create ID mapping for design systems
    const designSystemIdMap = new Map();
    extractedData.designSystems.forEach((ds, index) => {
      designSystemIdMap.set(ds.id, insertedDesignSystems[index].id);
    });

    // Insert Components
    console.log('🔧 Creating components...');
    const componentInserts = extractedData.components.map(c => ({
      name: c.name,
      description: c.description
    }));
    const insertedComponents = await db.insert(schema.components).values(componentInserts).returning();
    console.log(`✅ Created ${insertedComponents.length} components`);

    // Create ID mapping for components
    const componentIdMap = new Map();
    extractedData.components.forEach((comp, index) => {
      componentIdMap.set(comp.id, insertedComponents[index].id);
    });

    // Insert Variations
    console.log('🎨 Creating variations...');
    const variationInserts = extractedData.variations.map(variation => ({
      name: variation.name,
      description: variation.description,
      componentId: componentIdMap.get(variation.componentId)
    }));
    const insertedVariations = await db.insert(schema.variations).values(variationInserts).returning();
    console.log(`✅ Created ${insertedVariations.length} variations`);

    // Create ID mapping for variations
    const variationIdMap = new Map();
    extractedData.variations.forEach((variation, index) => {
      variationIdMap.set(variation.id, insertedVariations[index].id);
    });

    // Insert Tokens
    console.log('🎯 Creating tokens...');
    const tokenInserts = extractedData.tokens.map(token => ({
      name: token.name,
      description: token.description,
      type: token.type,
      defaultValue: token.defaultValue,
      componentId: componentIdMap.get(token.componentId),
      xmlParam: token.xmlParam,
      composeParam: token.composeParam,
      iosParam: token.iosParam,
      webParam: token.webParam
    }));
    const insertedTokens = await db.insert(schema.tokens).values(tokenInserts).returning();
    console.log(`✅ Created ${insertedTokens.length} tokens`);

    // Create ID mapping for tokens
    const tokenIdMap = new Map();
    extractedData.tokens.forEach((token, index) => {
      tokenIdMap.set(token.id, insertedTokens[index].id);
    });

    // Insert Token-Variation Assignments
    console.log('🔗 Creating token-variation assignments...');
    const tokenVariationInserts = extractedData.tokenVariations.map(tv => ({
      tokenId: tokenIdMap.get(tv.tokenId),
      variationId: variationIdMap.get(tv.variationId)
    }));
    await db.insert(schema.tokenVariations).values(tokenVariationInserts);
    console.log(`✅ Created ${tokenVariationInserts.length} token-variation assignments`);

    // Insert Design System Components
    console.log('🔗 Creating design system-component relationships...');
    const designSystemComponentInserts = extractedData.designSystemComponents.map(dsc => ({
      designSystemId: designSystemIdMap.get(dsc.designSystemId),
      componentId: componentIdMap.get(dsc.componentId)
    }));
    await db.insert(schema.designSystemComponents).values(designSystemComponentInserts);
    console.log(`✅ Created ${designSystemComponentInserts.length} design system-component relationships`);

    // Insert Props API
    console.log('⚙️ Creating props API...');
    const propsAPIInserts = extractedData.propsAPI.map(props => ({
      componentId: componentIdMap.get(props.componentId),
      name: props.name,
      value: props.value
    }));
    await db.insert(schema.propsAPI).values(propsAPIInserts);
    console.log(`✅ Created ${propsAPIInserts.length} props API entries`);

    // Insert Variation Values
    console.log('📝 Creating variation values...');
    const variationValueInserts = extractedData.variationValues.map(vv => ({
      designSystemId: designSystemIdMap.get(vv.designSystemId),
      componentId: componentIdMap.get(vv.componentId),
      variationId: variationIdMap.get(vv.variationId),
      name: vv.name,
      description: vv.description,
      isDefaultValue: vv.isDefaultValue
    }));
    const insertedVariationValues = await db.insert(schema.variationValues).values(variationValueInserts).returning();
    console.log(`✅ Created ${insertedVariationValues.length} variation values`);

    // Create ID mapping for variation values
    const variationValueIdMap = new Map();
    extractedData.variationValues.forEach((vv, index) => {
      variationValueIdMap.set(vv.id, insertedVariationValues[index].id);
    });

    // Insert Token Values (variation values)
    console.log('🎨 Creating token values for variation values...');
    const variationTokenValueInserts = extractedData.tokenValues
      .filter(tv => tv.variationValueId)
      .map(tv => ({
        variationValueId: variationValueIdMap.get(tv.variationValueId),
        tokenId: tokenIdMap.get(tv.tokenId),
        value: tv.value
      }));
    await db.insert(schema.tokenValues).values(variationTokenValueInserts);
    console.log(`✅ Created ${variationTokenValueInserts.length} variation token values`);

    // Insert Invariant Token Values
    console.log('🔒 Creating invariant token values...');
    const invariantTokenValueInserts = extractedData.invariantTokenValues.map(tv => ({
      tokenId: tokenIdMap.get(tv.tokenId),
      value: tv.value,
      type: tv.type,
      componentId: componentIdMap.get(tv.componentId),
      designSystemId: designSystemIdMap.get(tv.designSystemId)
    }));
    await db.insert(schema.tokenValues).values(invariantTokenValueInserts);
    console.log(`✅ Created ${invariantTokenValueInserts.length} invariant token values`);

    console.log('\n✅ Seed from extracted data completed successfully!');
    console.log('📊 Summary:');
    console.log(`  • ${insertedDesignSystems.length} Design Systems`);
    console.log(`  • ${insertedComponents.length} Components`);
    console.log(`  • ${insertedVariations.length} Variations`);
    console.log(`  • ${insertedTokens.length} Tokens`);
    console.log(`  • ${tokenVariationInserts.length} Token-Variation Assignments`);
    console.log(`  • ${designSystemComponentInserts.length} Design System-Component Relationships`);
    console.log(`  • ${propsAPIInserts.length} Props API Entries`);
    console.log(`  • ${insertedVariationValues.length} Variation Values`);
    console.log(`  • ${variationTokenValueInserts.length} Variation Token Values`);
    console.log(`  • ${invariantTokenValueInserts.length} Invariant Token Values`);

  } catch (error) {
    console.error('❌ Error during seed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the seed function
if (require.main === module) {
  const clearDatabase = process.argv.includes('--clear');
  
  async function runSeed() {
    if (clearDatabase) {
      console.log('⚠️  WARNING: Running with --clear flag will delete all existing data!');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    await seedFromExtractedData(clearDatabase);
  }
  
  runSeed().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}

export { seedFromExtractedData };
