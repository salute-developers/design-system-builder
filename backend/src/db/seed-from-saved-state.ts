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
      "id": 154,
      "name": "test-42",
      "description": "Design System test-42 version 0.1.0",
      "createdAt": "2025-09-05T16:48:33.939Z",
      "updatedAt": "2025-09-05T16:48:33.939Z"
    }
  ],
  "components": [
    {
      "id": 12,
      "name": "Link",
      "description": "Clickable link component for navigation",
      "createdAt": "2025-06-07T00:43:46.495Z",
      "updatedAt": "2025-06-07T00:43:46.495Z",
      "variations": [
        {
          "id": 53,
          "componentId": 12,
          "name": "view",
          "description": "Visual appearance variation (default, primary, secondary, tertiary, paragraph, accent, positive, warning, negative, clear)",
          "createdAt": "2025-06-07T00:43:46.505Z",
          "updatedAt": "2025-06-07T00:43:46.505Z"
        },
        {
          "id": 57,
          "componentId": 12,
          "name": "size",
          "description": "",
          "createdAt": "2025-07-01T18:15:50.078Z",
          "updatedAt": "2025-07-01T18:15:50.078Z"
        }
      ],
      "tokens": [
        {
          "id": 206,
          "componentId": 12,
          "name": "focusColor",
          "type": "color",
          "defaultValue": "",
          "description": "цвет ссылки в фокусе",
          "xmlParam": "sd_focusColor",
          "composeParam": "focusColor",
          "iosParam": "focusColor",
          "webParam": "linkColorFocus",
          "createdAt": "2025-06-07T00:43:46.511Z",
          "updatedAt": "2025-06-07T00:43:46.511Z"
        },
        {
          "id": 205,
          "componentId": 12,
          "name": "disableAlpha",
          "type": "float",
          "defaultValue": "",
          "description": "прозрачность в отключенном состоянии",
          "xmlParam": "android:alpha",
          "composeParam": "disabledOpacity",
          "iosParam": "disabledOpacity",
          "webParam": "linkDisabledOpacity",
          "createdAt": "2025-06-07T00:43:46.511Z",
          "updatedAt": "2025-06-07T00:43:46.511Z"
        },
        {
          "id": 198,
          "componentId": 12,
          "name": "textColor",
          "type": "color",
          "defaultValue": "",
          "description": "цвет текста ссылки",
          "xmlParam": "contentColor",
          "composeParam": "contentColor",
          "iosParam": "contentColor",
          "webParam": "linkColor",
          "createdAt": "2025-06-07T00:43:46.511Z",
          "updatedAt": "2025-06-07T00:43:46.511Z"
        },
        {
          "id": 207,
          "componentId": 12,
          "name": "textColorVisited",
          "type": "color",
          "defaultValue": "",
          "description": "Цвет текста посещённой ссылки",
          "xmlParam": "contentColorVisited",
          "composeParam": "contentColorVisited",
          "iosParam": "contentColorVisited",
          "webParam": "linkColorVisited",
          "createdAt": "2025-07-01T19:55:37.689Z",
          "updatedAt": "2025-07-01T19:55:37.689Z"
        },
        {
          "id": 204,
          "componentId": 12,
          "name": "underlineBorderWidth",
          "type": "dimension",
          "defaultValue": "",
          "description": "толщина подчеркивания",
          "xmlParam": "android:textUnderline",
          "composeParam": "textDecoration",
          "iosParam": "underlineThickness",
          "webParam": "linkUnderlineBorder",
          "createdAt": "2025-06-07T00:43:46.511Z",
          "updatedAt": "2025-06-07T00:43:46.511Z"
        },
        {
          "id": 197,
          "componentId": 12,
          "name": "textStyle",
          "type": "typography",
          "defaultValue": "",
          "description": "семейство шрифта ссылки",
          "xmlParam": "android:minHeight",
          "composeParam": "height",
          "iosParam": "height",
          "webParam": "linkFont",
          "createdAt": "2025-06-07T00:43:46.511Z",
          "updatedAt": "2025-06-07T00:43:46.511Z"
        }
      ],
      "propsAPI": [
        {
          "id": 2,
          "componentId": 12,
          "name": "disabled",
          "value": "false",
          "createdAt": "2025-07-01T19:04:26.302Z",
          "updatedAt": "2025-07-01T19:04:26.302Z"
        },
        {
          "id": 3,
          "componentId": 12,
          "name": "target",
          "value": "_blank",
          "createdAt": "2025-07-01T19:16:59.851Z",
          "updatedAt": "2025-07-01T19:16:59.851Z"
        },
        {
          "id": 4,
          "componentId": 12,
          "name": "href",
          "value": "https://google.com",
          "createdAt": "2025-07-01T19:17:30.029Z",
          "updatedAt": "2025-07-01T19:17:30.029Z"
        },
        {
          "id": 1,
          "componentId": 12,
          "name": "text",
          "value": "hello world",
          "createdAt": "2025-07-01T19:03:30.531Z",
          "updatedAt": "2025-07-01T19:03:30.531Z"
        }
      ]
    },
    {
      "id": 2,
      "name": "IconButton",
      "description": "",
      "createdAt": "2025-05-20T17:24:30.828Z",
      "updatedAt": "2025-08-21T23:19:56.446Z",
      "variations": [
        {
          "id": 18,
          "componentId": 2,
          "name": "view",
          "description": "",
          "createdAt": "2025-06-06T17:55:09.751Z",
          "updatedAt": "2025-06-06T17:55:09.751Z"
        },
        {
          "id": 64,
          "componentId": 2,
          "name": "size",
          "description": "",
          "createdAt": "2025-08-29T08:56:27.313Z",
          "updatedAt": "2025-08-29T08:56:27.313Z"
        },
        {
          "id": 65,
          "componentId": 2,
          "name": "shape",
          "description": "",
          "createdAt": "2025-08-29T08:56:33.209Z",
          "updatedAt": "2025-08-29T08:56:33.209Z"
        }
      ],
      "tokens": [
        {
          "id": 34,
          "componentId": 2,
          "name": "Test token 1",
          "type": "number",
          "defaultValue": "42",
          "description": "",
          "xmlParam": "",
          "composeParam": "",
          "iosParam": "",
          "webParam": "",
          "createdAt": "2025-06-06T17:55:00.778Z",
          "updatedAt": "2025-06-06T17:55:00.778Z"
        }
      ],
      "propsAPI": []
    },
    {
      "id": 14,
      "name": "Button",
      "description": "test empty button",
      "createdAt": "2025-08-26T14:04:44.369Z",
      "updatedAt": "2025-08-26T14:04:44.369Z",
      "variations": [],
      "tokens": [],
      "propsAPI": []
    },
    {
      "id": 15,
      "name": "Checkbox",
      "description": "",
      "createdAt": "2025-08-26T16:16:30.567Z",
      "updatedAt": "2025-08-26T16:16:30.567Z",
      "variations": [],
      "tokens": [],
      "propsAPI": []
    },
    {
      "id": 16,
      "name": "Radiobox",
      "description": "",
      "createdAt": "2025-08-26T16:16:38.357Z",
      "updatedAt": "2025-08-26T16:16:38.357Z",
      "variations": [],
      "tokens": [],
      "propsAPI": []
    },
    {
      "id": 17,
      "name": "TestButton",
      "description": "A test button component",
      "createdAt": "2025-08-26T16:18:33.243Z",
      "updatedAt": "2025-08-26T16:18:33.243Z",
      "variations": [
        {
          "id": 58,
          "componentId": 17,
          "name": "primary",
          "description": "",
          "createdAt": "2025-08-26T16:18:33.255Z",
          "updatedAt": "2025-08-26T16:18:33.255Z"
        }
      ],
      "tokens": [
        {
          "id": 208,
          "componentId": 17,
          "name": "backgroundColor",
          "type": "color",
          "defaultValue": "",
          "description": "Button background color",
          "xmlParam": "android:background",
          "composeParam": "backgroundColor",
          "iosParam": "backgroundColor",
          "webParam": "buttonBg",
          "createdAt": "2025-08-26T16:18:33.278Z",
          "updatedAt": "2025-08-26T16:18:33.278Z"
        }
      ],
      "propsAPI": []
    },
    {
      "id": 26,
      "name": "Link",
      "description": "Clickable link component for navigation",
      "createdAt": "2025-09-05T19:09:33.647Z",
      "updatedAt": "2025-09-05T19:09:33.647Z",
      "variations": [
        {
          "id": 70,
          "componentId": 26,
          "name": "view",
          "description": "Visual appearance variation (default, primary, secondary, tertiary, paragraph, accent, positive, warning, negative, clear)",
          "createdAt": "2025-09-05T19:09:33.652Z",
          "updatedAt": "2025-09-05T19:09:33.652Z"
        },
        {
          "id": 71,
          "componentId": 26,
          "name": "size",
          "description": "",
          "createdAt": "2025-09-05T19:09:33.652Z",
          "updatedAt": "2025-09-05T19:09:33.652Z"
        }
      ],
      "tokens": [
        {
          "id": 217,
          "componentId": 26,
          "name": "focusColor",
          "type": "color",
          "defaultValue": "",
          "description": "цвет ссылки в фокусе",
          "xmlParam": "sd_focusColor",
          "composeParam": "focusColor",
          "iosParam": "focusColor",
          "webParam": "linkColorFocus",
          "createdAt": "2025-09-05T19:09:33.661Z",
          "updatedAt": "2025-09-05T19:09:33.661Z"
        },
        {
          "id": 218,
          "componentId": 26,
          "name": "disableAlpha",
          "type": "float",
          "defaultValue": "",
          "description": "прозрачность в отключенном состоянии",
          "xmlParam": "android:alpha",
          "composeParam": "disabledOpacity",
          "iosParam": "disabledOpacity",
          "webParam": "linkDisabledOpacity",
          "createdAt": "2025-09-05T19:09:33.661Z",
          "updatedAt": "2025-09-05T19:09:33.661Z"
        },
        {
          "id": 219,
          "componentId": 26,
          "name": "textColor",
          "type": "color",
          "defaultValue": "",
          "description": "цвет текста ссылки",
          "xmlParam": "contentColor",
          "composeParam": "contentColor",
          "iosParam": "contentColor",
          "webParam": "linkColor",
          "createdAt": "2025-09-05T19:09:33.661Z",
          "updatedAt": "2025-09-05T19:09:33.661Z"
        },
        {
          "id": 220,
          "componentId": 26,
          "name": "textColorVisited",
          "type": "color",
          "defaultValue": "",
          "description": "Цвет текста посещённой ссылки",
          "xmlParam": "contentColorVisited",
          "composeParam": "contentColorVisited",
          "iosParam": "contentColorVisited",
          "webParam": "linkColorVisited",
          "createdAt": "2025-09-05T19:09:33.661Z",
          "updatedAt": "2025-09-05T19:09:33.661Z"
        },
        {
          "id": 221,
          "componentId": 26,
          "name": "underlineBorderWidth",
          "type": "dimension",
          "defaultValue": "",
          "description": "толщина подчеркивания",
          "xmlParam": "android:textUnderline",
          "composeParam": "textDecoration",
          "iosParam": "underlineThickness",
          "webParam": "linkUnderlineBorder",
          "createdAt": "2025-09-05T19:09:33.661Z",
          "updatedAt": "2025-09-05T19:09:33.661Z"
        },
        {
          "id": 222,
          "componentId": 26,
          "name": "textStyle",
          "type": "typography",
          "defaultValue": "",
          "description": "семейство шрифта ссылки",
          "xmlParam": "android:minHeight",
          "composeParam": "height",
          "iosParam": "height",
          "webParam": "linkFont",
          "createdAt": "2025-09-05T19:09:33.661Z",
          "updatedAt": "2025-09-05T19:09:33.661Z"
        }
      ],
      "propsAPI": [
        {
          "id": 5,
          "componentId": 26,
          "name": "disabled",
          "value": "false",
          "createdAt": "2025-09-05T19:09:33.698Z",
          "updatedAt": "2025-09-05T19:09:33.698Z"
        },
        {
          "id": 6,
          "componentId": 26,
          "name": "target",
          "value": "_blank",
          "createdAt": "2025-09-05T19:09:33.698Z",
          "updatedAt": "2025-09-05T19:09:33.698Z"
        },
        {
          "id": 7,
          "componentId": 26,
          "name": "href",
          "value": "https://google.com",
          "createdAt": "2025-09-05T19:09:33.698Z",
          "updatedAt": "2025-09-05T19:09:33.698Z"
        },
        {
          "id": 8,
          "componentId": 26,
          "name": "text",
          "value": "hello world",
          "createdAt": "2025-09-05T19:09:33.698Z",
          "updatedAt": "2025-09-05T19:09:33.698Z"
        }
      ]
    },
    {
      "id": 27,
      "name": "IconButton",
      "description": "",
      "createdAt": "2025-09-05T19:09:33.647Z",
      "updatedAt": "2025-09-05T19:09:33.647Z",
      "variations": [
        {
          "id": 67,
          "componentId": 27,
          "name": "view",
          "description": "",
          "createdAt": "2025-09-05T19:09:33.652Z",
          "updatedAt": "2025-09-05T19:09:33.652Z"
        },
        {
          "id": 68,
          "componentId": 27,
          "name": "size",
          "description": "",
          "createdAt": "2025-09-05T19:09:33.652Z",
          "updatedAt": "2025-09-05T19:09:33.652Z"
        },
        {
          "id": 69,
          "componentId": 27,
          "name": "shape",
          "description": "",
          "createdAt": "2025-09-05T19:09:33.652Z",
          "updatedAt": "2025-09-05T19:09:33.652Z"
        }
      ],
      "tokens": [
        {
          "id": 216,
          "componentId": 27,
          "name": "Test token 1",
          "type": "number",
          "defaultValue": "42",
          "description": "",
          "xmlParam": "",
          "composeParam": "",
          "iosParam": "",
          "webParam": "",
          "createdAt": "2025-09-05T19:09:33.661Z",
          "updatedAt": "2025-09-05T19:09:33.661Z"
        }
      ],
      "propsAPI": []
    },
    {
      "id": 28,
      "name": "Button",
      "description": "test empty button",
      "createdAt": "2025-09-05T19:09:33.647Z",
      "updatedAt": "2025-09-05T19:09:33.647Z",
      "variations": [],
      "tokens": [],
      "propsAPI": []
    },
    {
      "id": 29,
      "name": "Checkbox",
      "description": "",
      "createdAt": "2025-09-05T19:09:33.647Z",
      "updatedAt": "2025-09-05T19:09:33.647Z",
      "variations": [],
      "tokens": [],
      "propsAPI": []
    },
    {
      "id": 30,
      "name": "Radiobox",
      "description": "",
      "createdAt": "2025-09-05T19:09:33.647Z",
      "updatedAt": "2025-09-05T19:09:33.647Z",
      "variations": [],
      "tokens": [],
      "propsAPI": []
    },
    {
      "id": 31,
      "name": "TestButton",
      "description": "A test button component",
      "createdAt": "2025-09-05T19:09:33.647Z",
      "updatedAt": "2025-09-05T19:09:33.647Z",
      "variations": [
        {
          "id": 66,
          "componentId": 31,
          "name": "primary",
          "description": "",
          "createdAt": "2025-09-05T19:09:33.652Z",
          "updatedAt": "2025-09-05T19:09:33.652Z"
        }
      ],
      "tokens": [
        {
          "id": 215,
          "componentId": 31,
          "name": "backgroundColor",
          "type": "color",
          "defaultValue": "",
          "description": "Button background color",
          "xmlParam": "android:background",
          "composeParam": "backgroundColor",
          "iosParam": "backgroundColor",
          "webParam": "buttonBg",
          "createdAt": "2025-09-05T19:09:33.661Z",
          "updatedAt": "2025-09-05T19:09:33.661Z"
        }
      ],
      "propsAPI": []
    }
  ],
  "variations": [
    {
      "id": 58,
      "componentId": 17,
      "name": "primary",
      "description": "",
      "createdAt": "2025-08-26T16:18:33.255Z",
      "updatedAt": "2025-08-26T16:18:33.255Z",
      "tokenVariations": []
    },
    {
      "id": 18,
      "componentId": 2,
      "name": "view",
      "description": "",
      "createdAt": "2025-06-06T17:55:09.751Z",
      "updatedAt": "2025-06-06T17:55:09.751Z",
      "tokenVariations": []
    },
    {
      "id": 64,
      "componentId": 2,
      "name": "size",
      "description": "",
      "createdAt": "2025-08-29T08:56:27.313Z",
      "updatedAt": "2025-08-29T08:56:27.313Z",
      "tokenVariations": []
    },
    {
      "id": 65,
      "componentId": 2,
      "name": "shape",
      "description": "",
      "createdAt": "2025-08-29T08:56:33.209Z",
      "updatedAt": "2025-08-29T08:56:33.209Z",
      "tokenVariations": []
    },
    {
      "id": 66,
      "componentId": 31,
      "name": "primary",
      "description": "",
      "createdAt": "2025-09-05T19:09:33.652Z",
      "updatedAt": "2025-09-05T19:09:33.652Z",
      "tokenVariations": []
    },
    {
      "id": 67,
      "componentId": 27,
      "name": "view",
      "description": "",
      "createdAt": "2025-09-05T19:09:33.652Z",
      "updatedAt": "2025-09-05T19:09:33.652Z",
      "tokenVariations": []
    },
    {
      "id": 68,
      "componentId": 27,
      "name": "size",
      "description": "",
      "createdAt": "2025-09-05T19:09:33.652Z",
      "updatedAt": "2025-09-05T19:09:33.652Z",
      "tokenVariations": []
    },
    {
      "id": 69,
      "componentId": 27,
      "name": "shape",
      "description": "",
      "createdAt": "2025-09-05T19:09:33.652Z",
      "updatedAt": "2025-09-05T19:09:33.652Z",
      "tokenVariations": []
    },
    {
      "id": 70,
      "componentId": 26,
      "name": "view",
      "description": "Visual appearance variation (default, primary, secondary, tertiary, paragraph, accent, positive, warning, negative, clear)",
      "createdAt": "2025-09-05T19:09:33.652Z",
      "updatedAt": "2025-09-05T19:09:33.652Z",
      "tokenVariations": [
        {
          "id": 408,
          "tokenId": 219,
          "variationId": 70,
          "createdAt": "2025-09-05T19:09:33.686Z",
          "updatedAt": "2025-09-05T19:09:33.686Z",
          "token": {
            "id": 219,
            "componentId": 26,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-09-05T19:09:33.661Z",
            "updatedAt": "2025-09-05T19:09:33.661Z"
          }
        },
        {
          "id": 409,
          "tokenId": 221,
          "variationId": 70,
          "createdAt": "2025-09-05T19:09:33.686Z",
          "updatedAt": "2025-09-05T19:09:33.686Z",
          "token": {
            "id": 221,
            "componentId": 26,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-09-05T19:09:33.661Z",
            "updatedAt": "2025-09-05T19:09:33.661Z"
          }
        },
        {
          "id": 411,
          "tokenId": 220,
          "variationId": 70,
          "createdAt": "2025-09-05T19:09:33.686Z",
          "updatedAt": "2025-09-05T19:09:33.686Z",
          "token": {
            "id": 220,
            "componentId": 26,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-09-05T19:09:33.661Z",
            "updatedAt": "2025-09-05T19:09:33.661Z"
          }
        }
      ]
    },
    {
      "id": 71,
      "componentId": 26,
      "name": "size",
      "description": "",
      "createdAt": "2025-09-05T19:09:33.652Z",
      "updatedAt": "2025-09-05T19:09:33.652Z",
      "tokenVariations": [
        {
          "id": 410,
          "tokenId": 222,
          "variationId": 71,
          "createdAt": "2025-09-05T19:09:33.686Z",
          "updatedAt": "2025-09-05T19:09:33.686Z",
          "token": {
            "id": 222,
            "componentId": 26,
            "name": "textStyle",
            "type": "typography",
            "defaultValue": "",
            "description": "семейство шрифта ссылки",
            "xmlParam": "android:minHeight",
            "composeParam": "height",
            "iosParam": "height",
            "webParam": "linkFont",
            "createdAt": "2025-09-05T19:09:33.661Z",
            "updatedAt": "2025-09-05T19:09:33.661Z"
          }
        }
      ]
    },
    {
      "id": 53,
      "componentId": 12,
      "name": "view",
      "description": "Visual appearance variation (default, primary, secondary, tertiary, paragraph, accent, positive, warning, negative, clear)",
      "createdAt": "2025-06-07T00:43:46.505Z",
      "updatedAt": "2025-06-07T00:43:46.505Z",
      "tokenVariations": [
        {
          "id": 390,
          "tokenId": 198,
          "variationId": 53,
          "createdAt": "2025-06-07T00:43:46.517Z",
          "updatedAt": "2025-06-07T00:43:46.517Z",
          "token": {
            "id": 198,
            "componentId": 12,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        },
        {
          "id": 396,
          "tokenId": 204,
          "variationId": 53,
          "createdAt": "2025-06-07T00:43:46.517Z",
          "updatedAt": "2025-06-07T00:43:46.517Z",
          "token": {
            "id": 204,
            "componentId": 12,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        },
        {
          "id": 404,
          "tokenId": 207,
          "variationId": 53,
          "createdAt": "2025-07-01T19:57:17.334Z",
          "updatedAt": "2025-07-01T19:57:17.334Z",
          "token": {
            "id": 207,
            "componentId": 12,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-07-01T19:55:37.689Z",
            "updatedAt": "2025-07-01T19:55:37.689Z"
          }
        }
      ]
    },
    {
      "id": 57,
      "componentId": 12,
      "name": "size",
      "description": "",
      "createdAt": "2025-07-01T18:15:50.078Z",
      "updatedAt": "2025-07-01T18:15:50.078Z",
      "tokenVariations": [
        {
          "id": 403,
          "tokenId": 197,
          "variationId": 57,
          "createdAt": "2025-07-01T19:56:34.138Z",
          "updatedAt": "2025-07-01T19:56:34.138Z",
          "token": {
            "id": 197,
            "componentId": 12,
            "name": "textStyle",
            "type": "typography",
            "defaultValue": "",
            "description": "семейство шрифта ссылки",
            "xmlParam": "android:minHeight",
            "composeParam": "height",
            "iosParam": "height",
            "webParam": "linkFont",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        }
      ]
    }
  ],
  "tokens": [
    {
      "id": 208,
      "componentId": 17,
      "name": "backgroundColor",
      "type": "color",
      "defaultValue": "",
      "description": "Button background color",
      "xmlParam": "android:background",
      "composeParam": "backgroundColor",
      "iosParam": "backgroundColor",
      "webParam": "buttonBg",
      "createdAt": "2025-08-26T16:18:33.278Z",
      "updatedAt": "2025-08-26T16:18:33.278Z"
    },
    {
      "id": 34,
      "componentId": 2,
      "name": "Test token 1",
      "type": "number",
      "defaultValue": "42",
      "description": "",
      "xmlParam": "",
      "composeParam": "",
      "iosParam": "",
      "webParam": "",
      "createdAt": "2025-06-06T17:55:00.778Z",
      "updatedAt": "2025-06-06T17:55:00.778Z"
    },
    {
      "id": 215,
      "componentId": 31,
      "name": "backgroundColor",
      "type": "color",
      "defaultValue": "",
      "description": "Button background color",
      "xmlParam": "android:background",
      "composeParam": "backgroundColor",
      "iosParam": "backgroundColor",
      "webParam": "buttonBg",
      "createdAt": "2025-09-05T19:09:33.661Z",
      "updatedAt": "2025-09-05T19:09:33.661Z"
    },
    {
      "id": 216,
      "componentId": 27,
      "name": "Test token 1",
      "type": "number",
      "defaultValue": "42",
      "description": "",
      "xmlParam": "",
      "composeParam": "",
      "iosParam": "",
      "webParam": "",
      "createdAt": "2025-09-05T19:09:33.661Z",
      "updatedAt": "2025-09-05T19:09:33.661Z"
    },
    {
      "id": 217,
      "componentId": 26,
      "name": "focusColor",
      "type": "color",
      "defaultValue": "",
      "description": "цвет ссылки в фокусе",
      "xmlParam": "sd_focusColor",
      "composeParam": "focusColor",
      "iosParam": "focusColor",
      "webParam": "linkColorFocus",
      "createdAt": "2025-09-05T19:09:33.661Z",
      "updatedAt": "2025-09-05T19:09:33.661Z"
    },
    {
      "id": 218,
      "componentId": 26,
      "name": "disableAlpha",
      "type": "float",
      "defaultValue": "",
      "description": "прозрачность в отключенном состоянии",
      "xmlParam": "android:alpha",
      "composeParam": "disabledOpacity",
      "iosParam": "disabledOpacity",
      "webParam": "linkDisabledOpacity",
      "createdAt": "2025-09-05T19:09:33.661Z",
      "updatedAt": "2025-09-05T19:09:33.661Z"
    },
    {
      "id": 219,
      "componentId": 26,
      "name": "textColor",
      "type": "color",
      "defaultValue": "",
      "description": "цвет текста ссылки",
      "xmlParam": "contentColor",
      "composeParam": "contentColor",
      "iosParam": "contentColor",
      "webParam": "linkColor",
      "createdAt": "2025-09-05T19:09:33.661Z",
      "updatedAt": "2025-09-05T19:09:33.661Z"
    },
    {
      "id": 220,
      "componentId": 26,
      "name": "textColorVisited",
      "type": "color",
      "defaultValue": "",
      "description": "Цвет текста посещённой ссылки",
      "xmlParam": "contentColorVisited",
      "composeParam": "contentColorVisited",
      "iosParam": "contentColorVisited",
      "webParam": "linkColorVisited",
      "createdAt": "2025-09-05T19:09:33.661Z",
      "updatedAt": "2025-09-05T19:09:33.661Z"
    },
    {
      "id": 221,
      "componentId": 26,
      "name": "underlineBorderWidth",
      "type": "dimension",
      "defaultValue": "",
      "description": "толщина подчеркивания",
      "xmlParam": "android:textUnderline",
      "composeParam": "textDecoration",
      "iosParam": "underlineThickness",
      "webParam": "linkUnderlineBorder",
      "createdAt": "2025-09-05T19:09:33.661Z",
      "updatedAt": "2025-09-05T19:09:33.661Z"
    },
    {
      "id": 222,
      "componentId": 26,
      "name": "textStyle",
      "type": "typography",
      "defaultValue": "",
      "description": "семейство шрифта ссылки",
      "xmlParam": "android:minHeight",
      "composeParam": "height",
      "iosParam": "height",
      "webParam": "linkFont",
      "createdAt": "2025-09-05T19:09:33.661Z",
      "updatedAt": "2025-09-05T19:09:33.661Z"
    },
    {
      "id": 206,
      "componentId": 12,
      "name": "focusColor",
      "type": "color",
      "defaultValue": "",
      "description": "цвет ссылки в фокусе",
      "xmlParam": "sd_focusColor",
      "composeParam": "focusColor",
      "iosParam": "focusColor",
      "webParam": "linkColorFocus",
      "createdAt": "2025-06-07T00:43:46.511Z",
      "updatedAt": "2025-06-07T00:43:46.511Z"
    },
    {
      "id": 205,
      "componentId": 12,
      "name": "disableAlpha",
      "type": "float",
      "defaultValue": "",
      "description": "прозрачность в отключенном состоянии",
      "xmlParam": "android:alpha",
      "composeParam": "disabledOpacity",
      "iosParam": "disabledOpacity",
      "webParam": "linkDisabledOpacity",
      "createdAt": "2025-06-07T00:43:46.511Z",
      "updatedAt": "2025-06-07T00:43:46.511Z"
    },
    {
      "id": 198,
      "componentId": 12,
      "name": "textColor",
      "type": "color",
      "defaultValue": "",
      "description": "цвет текста ссылки",
      "xmlParam": "contentColor",
      "composeParam": "contentColor",
      "iosParam": "contentColor",
      "webParam": "linkColor",
      "createdAt": "2025-06-07T00:43:46.511Z",
      "updatedAt": "2025-06-07T00:43:46.511Z"
    },
    {
      "id": 207,
      "componentId": 12,
      "name": "textColorVisited",
      "type": "color",
      "defaultValue": "",
      "description": "Цвет текста посещённой ссылки",
      "xmlParam": "contentColorVisited",
      "composeParam": "contentColorVisited",
      "iosParam": "contentColorVisited",
      "webParam": "linkColorVisited",
      "createdAt": "2025-07-01T19:55:37.689Z",
      "updatedAt": "2025-07-01T19:55:37.689Z"
    },
    {
      "id": 204,
      "componentId": 12,
      "name": "underlineBorderWidth",
      "type": "dimension",
      "defaultValue": "",
      "description": "толщина подчеркивания",
      "xmlParam": "android:textUnderline",
      "composeParam": "textDecoration",
      "iosParam": "underlineThickness",
      "webParam": "linkUnderlineBorder",
      "createdAt": "2025-06-07T00:43:46.511Z",
      "updatedAt": "2025-06-07T00:43:46.511Z"
    },
    {
      "id": 197,
      "componentId": 12,
      "name": "textStyle",
      "type": "typography",
      "defaultValue": "",
      "description": "семейство шрифта ссылки",
      "xmlParam": "android:minHeight",
      "composeParam": "height",
      "iosParam": "height",
      "webParam": "linkFont",
      "createdAt": "2025-06-07T00:43:46.511Z",
      "updatedAt": "2025-06-07T00:43:46.511Z"
    }
  ],
  "tokenVariations": [
    {
      "id": 408,
      "tokenId": 219,
      "variationId": 70,
      "createdAt": "2025-09-05T19:09:33.686Z",
      "updatedAt": "2025-09-05T19:09:33.686Z"
    },
    {
      "id": 409,
      "tokenId": 221,
      "variationId": 70,
      "createdAt": "2025-09-05T19:09:33.686Z",
      "updatedAt": "2025-09-05T19:09:33.686Z"
    },
    {
      "id": 410,
      "tokenId": 222,
      "variationId": 71,
      "createdAt": "2025-09-05T19:09:33.686Z",
      "updatedAt": "2025-09-05T19:09:33.686Z"
    },
    {
      "id": 411,
      "tokenId": 220,
      "variationId": 70,
      "createdAt": "2025-09-05T19:09:33.686Z",
      "updatedAt": "2025-09-05T19:09:33.686Z"
    },
    {
      "id": 390,
      "tokenId": 198,
      "variationId": 53,
      "createdAt": "2025-06-07T00:43:46.517Z",
      "updatedAt": "2025-06-07T00:43:46.517Z"
    },
    {
      "id": 396,
      "tokenId": 204,
      "variationId": 53,
      "createdAt": "2025-06-07T00:43:46.517Z",
      "updatedAt": "2025-06-07T00:43:46.517Z"
    },
    {
      "id": 403,
      "tokenId": 197,
      "variationId": 57,
      "createdAt": "2025-07-01T19:56:34.138Z",
      "updatedAt": "2025-07-01T19:56:34.138Z"
    },
    {
      "id": 404,
      "tokenId": 207,
      "variationId": 53,
      "createdAt": "2025-07-01T19:57:17.334Z",
      "updatedAt": "2025-07-01T19:57:17.334Z"
    }
  ],
  "variationValues": [
    {
      "id": 620,
      "designSystemId": 154,
      "componentId": 2,
      "variationId": 18,
      "name": "default",
      "description": "",
      "isDefaultValue": "true",
      "createdAt": "2025-09-05T16:48:33.983Z",
      "updatedAt": "2025-09-05T16:48:33.983Z",
      "tokenValues": [
        {
          "id": 1465,
          "tokenId": 208,
          "value": "surface.default.solid-default",
          "type": "variation",
          "variationValueId": 620,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:33.986Z",
          "updatedAt": "2025-09-05T16:48:33.986Z",
          "token": {
            "id": 208,
            "componentId": 17,
            "name": "backgroundColor",
            "type": "color",
            "defaultValue": "",
            "description": "Button background color",
            "xmlParam": "android:background",
            "composeParam": "backgroundColor",
            "iosParam": "backgroundColor",
            "webParam": "buttonBg",
            "createdAt": "2025-08-26T16:18:33.278Z",
            "updatedAt": "2025-08-26T16:18:33.278Z"
          }
        }
      ]
    },
    {
      "id": 621,
      "designSystemId": 154,
      "componentId": 2,
      "variationId": 18,
      "name": "secondary",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-05T16:48:33.992Z",
      "updatedAt": "2025-09-05T16:48:33.992Z",
      "tokenValues": [
        {
          "id": 1466,
          "tokenId": 208,
          "value": "surface.default.transparent-secondary",
          "type": "variation",
          "variationValueId": 621,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:33.993Z",
          "updatedAt": "2025-09-05T16:48:33.993Z",
          "token": {
            "id": 208,
            "componentId": 17,
            "name": "backgroundColor",
            "type": "color",
            "defaultValue": "",
            "description": "Button background color",
            "xmlParam": "android:background",
            "composeParam": "backgroundColor",
            "iosParam": "backgroundColor",
            "webParam": "buttonBg",
            "createdAt": "2025-08-26T16:18:33.278Z",
            "updatedAt": "2025-08-26T16:18:33.278Z"
          }
        }
      ]
    },
    {
      "id": 622,
      "designSystemId": 154,
      "componentId": 2,
      "variationId": 18,
      "name": "accent",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-05T16:48:33.997Z",
      "updatedAt": "2025-09-05T16:48:33.997Z",
      "tokenValues": [
        {
          "id": 1467,
          "tokenId": 208,
          "value": "surface.default.accent",
          "type": "variation",
          "variationValueId": 622,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:33.998Z",
          "updatedAt": "2025-09-05T16:48:33.998Z",
          "token": {
            "id": 208,
            "componentId": 17,
            "name": "backgroundColor",
            "type": "color",
            "defaultValue": "",
            "description": "Button background color",
            "xmlParam": "android:background",
            "composeParam": "backgroundColor",
            "iosParam": "backgroundColor",
            "webParam": "buttonBg",
            "createdAt": "2025-08-26T16:18:33.278Z",
            "updatedAt": "2025-08-26T16:18:33.278Z"
          }
        }
      ]
    },
    {
      "id": 623,
      "designSystemId": 154,
      "componentId": 2,
      "variationId": 64,
      "name": "xl",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-05T16:48:34.002Z",
      "updatedAt": "2025-09-05T16:48:34.002Z",
      "tokenValues": []
    },
    {
      "id": 624,
      "designSystemId": 154,
      "componentId": 2,
      "variationId": 64,
      "name": "l",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-05T16:48:34.007Z",
      "updatedAt": "2025-09-05T16:48:34.007Z",
      "tokenValues": []
    },
    {
      "id": 625,
      "designSystemId": 154,
      "componentId": 2,
      "variationId": 64,
      "name": "m",
      "description": "",
      "isDefaultValue": "true",
      "createdAt": "2025-09-05T16:48:34.011Z",
      "updatedAt": "2025-09-05T16:48:34.011Z",
      "tokenValues": []
    },
    {
      "id": 626,
      "designSystemId": 154,
      "componentId": 2,
      "variationId": 65,
      "name": "rounded",
      "description": "",
      "isDefaultValue": "true",
      "createdAt": "2025-09-05T16:48:34.015Z",
      "updatedAt": "2025-09-05T16:48:34.015Z",
      "tokenValues": []
    },
    {
      "id": 627,
      "designSystemId": 154,
      "componentId": 2,
      "variationId": 65,
      "name": "pilled",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-05T16:48:34.018Z",
      "updatedAt": "2025-09-05T16:48:34.018Z",
      "tokenValues": []
    },
    {
      "id": 632,
      "designSystemId": 154,
      "componentId": 12,
      "variationId": 57,
      "name": "s",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-05T16:48:34.039Z",
      "updatedAt": "2025-09-05T16:48:34.039Z",
      "tokenValues": [
        {
          "id": 1480,
          "tokenId": 197,
          "value": "body.s.normal",
          "type": "variation",
          "variationValueId": 632,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.040Z",
          "updatedAt": "2025-09-05T16:48:34.040Z",
          "token": {
            "id": 197,
            "componentId": 12,
            "name": "textStyle",
            "type": "typography",
            "defaultValue": "",
            "description": "семейство шрифта ссылки",
            "xmlParam": "android:minHeight",
            "composeParam": "height",
            "iosParam": "height",
            "webParam": "linkFont",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        }
      ]
    },
    {
      "id": 633,
      "designSystemId": 154,
      "componentId": 12,
      "variationId": 57,
      "name": "m",
      "description": "",
      "isDefaultValue": "true",
      "createdAt": "2025-09-05T16:48:34.043Z",
      "updatedAt": "2025-09-05T16:48:34.043Z",
      "tokenValues": [
        {
          "id": 1481,
          "tokenId": 197,
          "value": "body.m.normal",
          "type": "variation",
          "variationValueId": 633,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.044Z",
          "updatedAt": "2025-09-05T16:48:34.044Z",
          "token": {
            "id": 197,
            "componentId": 12,
            "name": "textStyle",
            "type": "typography",
            "defaultValue": "",
            "description": "семейство шрифта ссылки",
            "xmlParam": "android:minHeight",
            "composeParam": "height",
            "iosParam": "height",
            "webParam": "linkFont",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        }
      ]
    },
    {
      "id": 634,
      "designSystemId": 154,
      "componentId": 12,
      "variationId": 57,
      "name": "l",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-05T16:48:34.048Z",
      "updatedAt": "2025-09-05T16:48:34.048Z",
      "tokenValues": [
        {
          "id": 1482,
          "tokenId": 197,
          "value": "body.l.normal",
          "type": "variation",
          "variationValueId": 634,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.048Z",
          "updatedAt": "2025-09-05T16:48:34.048Z",
          "token": {
            "id": 197,
            "componentId": 12,
            "name": "textStyle",
            "type": "typography",
            "defaultValue": "",
            "description": "семейство шрифта ссылки",
            "xmlParam": "android:minHeight",
            "composeParam": "height",
            "iosParam": "height",
            "webParam": "linkFont",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        }
      ]
    },
    {
      "id": 628,
      "designSystemId": 154,
      "componentId": 12,
      "variationId": 53,
      "name": "default",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-05T16:48:34.023Z",
      "updatedAt": "2025-09-05T16:48:34.023Z",
      "tokenValues": [
        {
          "id": 1468,
          "tokenId": 198,
          "value": "text.default.primary",
          "type": "variation",
          "variationValueId": 628,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.023Z",
          "updatedAt": "2025-09-05T16:48:34.023Z",
          "token": {
            "id": 198,
            "componentId": 12,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        },
        {
          "id": 1469,
          "tokenId": 207,
          "value": "text.default.secondary",
          "type": "variation",
          "variationValueId": 628,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.023Z",
          "updatedAt": "2025-09-05T16:48:34.023Z",
          "token": {
            "id": 207,
            "componentId": 12,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-07-01T19:55:37.689Z",
            "updatedAt": "2025-07-01T19:55:37.689Z"
          }
        },
        {
          "id": 1470,
          "tokenId": 204,
          "value": "0",
          "type": "variation",
          "variationValueId": 628,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.023Z",
          "updatedAt": "2025-09-05T16:48:34.023Z",
          "token": {
            "id": 204,
            "componentId": 12,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        }
      ]
    },
    {
      "id": 629,
      "designSystemId": 154,
      "componentId": 12,
      "variationId": 53,
      "name": "secondary",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-05T16:48:34.027Z",
      "updatedAt": "2025-09-05T16:48:34.027Z",
      "tokenValues": [
        {
          "id": 1471,
          "tokenId": 198,
          "value": "text.default.secondary",
          "type": "variation",
          "variationValueId": 629,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.028Z",
          "updatedAt": "2025-09-05T16:48:34.028Z",
          "token": {
            "id": 198,
            "componentId": 12,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        },
        {
          "id": 1472,
          "tokenId": 207,
          "value": "text.default.tertiary",
          "type": "variation",
          "variationValueId": 629,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.028Z",
          "updatedAt": "2025-09-05T16:48:34.028Z",
          "token": {
            "id": 207,
            "componentId": 12,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-07-01T19:55:37.689Z",
            "updatedAt": "2025-07-01T19:55:37.689Z"
          }
        },
        {
          "id": 1473,
          "tokenId": 204,
          "value": "0",
          "type": "variation",
          "variationValueId": 629,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.028Z",
          "updatedAt": "2025-09-05T16:48:34.028Z",
          "token": {
            "id": 204,
            "componentId": 12,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        }
      ]
    },
    {
      "id": 631,
      "designSystemId": 154,
      "componentId": 12,
      "variationId": 53,
      "name": "clear",
      "description": "",
      "isDefaultValue": "false",
      "createdAt": "2025-09-05T16:48:34.035Z",
      "updatedAt": "2025-09-05T16:48:34.035Z",
      "tokenValues": [
        {
          "id": 1477,
          "tokenId": 198,
          "value": "inherit",
          "type": "variation",
          "variationValueId": 631,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.036Z",
          "updatedAt": "2025-09-05T16:48:34.036Z",
          "token": {
            "id": 198,
            "componentId": 12,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        },
        {
          "id": 1478,
          "tokenId": 207,
          "value": "inherit",
          "type": "variation",
          "variationValueId": 631,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.036Z",
          "updatedAt": "2025-09-05T16:48:34.036Z",
          "token": {
            "id": 207,
            "componentId": 12,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-07-01T19:55:37.689Z",
            "updatedAt": "2025-07-01T19:55:37.689Z"
          }
        },
        {
          "id": 1479,
          "tokenId": 204,
          "value": "1",
          "type": "variation",
          "variationValueId": 631,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:48:34.036Z",
          "updatedAt": "2025-09-05T16:48:34.036Z",
          "token": {
            "id": 204,
            "componentId": 12,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        }
      ]
    },
    {
      "id": 630,
      "designSystemId": 154,
      "componentId": 12,
      "variationId": 53,
      "name": "accent",
      "description": "",
      "isDefaultValue": "true",
      "createdAt": "2025-09-05T16:48:34.031Z",
      "updatedAt": "2025-09-05T16:48:34.031Z",
      "tokenValues": [
        {
          "id": 1485,
          "tokenId": 198,
          "value": "text.default.accent",
          "type": "variation",
          "variationValueId": 630,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:49:19.553Z",
          "updatedAt": "2025-09-05T16:49:19.553Z",
          "token": {
            "id": 198,
            "componentId": 12,
            "name": "textColor",
            "type": "color",
            "defaultValue": "",
            "description": "цвет текста ссылки",
            "xmlParam": "contentColor",
            "composeParam": "contentColor",
            "iosParam": "contentColor",
            "webParam": "linkColor",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        },
        {
          "id": 1486,
          "tokenId": 207,
          "value": "text.default.accent-minor",
          "type": "variation",
          "variationValueId": 630,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:49:19.553Z",
          "updatedAt": "2025-09-05T16:49:19.553Z",
          "token": {
            "id": 207,
            "componentId": 12,
            "name": "textColorVisited",
            "type": "color",
            "defaultValue": "",
            "description": "Цвет текста посещённой ссылки",
            "xmlParam": "contentColorVisited",
            "composeParam": "contentColorVisited",
            "iosParam": "contentColorVisited",
            "webParam": "linkColorVisited",
            "createdAt": "2025-07-01T19:55:37.689Z",
            "updatedAt": "2025-07-01T19:55:37.689Z"
          }
        },
        {
          "id": 1487,
          "tokenId": 204,
          "value": "0",
          "type": "variation",
          "variationValueId": 630,
          "componentId": null,
          "designSystemId": null,
          "createdAt": "2025-09-05T16:49:19.553Z",
          "updatedAt": "2025-09-05T16:49:19.553Z",
          "token": {
            "id": 204,
            "componentId": 12,
            "name": "underlineBorderWidth",
            "type": "dimension",
            "defaultValue": "",
            "description": "толщина подчеркивания",
            "xmlParam": "android:textUnderline",
            "composeParam": "textDecoration",
            "iosParam": "underlineThickness",
            "webParam": "linkUnderlineBorder",
            "createdAt": "2025-06-07T00:43:46.511Z",
            "updatedAt": "2025-06-07T00:43:46.511Z"
          }
        }
      ]
    }
  ],
  "tokenValues": [
    {
      "id": 1465,
      "tokenId": 208,
      "value": "surface.default.solid-default",
      "type": "variation",
      "variationValueId": 620,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:33.986Z",
      "updatedAt": "2025-09-05T16:48:33.986Z",
      "token": {
        "id": 208,
        "componentId": 17,
        "name": "backgroundColor",
        "type": "color",
        "defaultValue": "",
        "description": "Button background color",
        "xmlParam": "android:background",
        "composeParam": "backgroundColor",
        "iosParam": "backgroundColor",
        "webParam": "buttonBg",
        "createdAt": "2025-08-26T16:18:33.278Z",
        "updatedAt": "2025-08-26T16:18:33.278Z"
      }
    },
    {
      "id": 1466,
      "tokenId": 208,
      "value": "surface.default.transparent-secondary",
      "type": "variation",
      "variationValueId": 621,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:33.993Z",
      "updatedAt": "2025-09-05T16:48:33.993Z",
      "token": {
        "id": 208,
        "componentId": 17,
        "name": "backgroundColor",
        "type": "color",
        "defaultValue": "",
        "description": "Button background color",
        "xmlParam": "android:background",
        "composeParam": "backgroundColor",
        "iosParam": "backgroundColor",
        "webParam": "buttonBg",
        "createdAt": "2025-08-26T16:18:33.278Z",
        "updatedAt": "2025-08-26T16:18:33.278Z"
      }
    },
    {
      "id": 1467,
      "tokenId": 208,
      "value": "surface.default.accent",
      "type": "variation",
      "variationValueId": 622,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:33.998Z",
      "updatedAt": "2025-09-05T16:48:33.998Z",
      "token": {
        "id": 208,
        "componentId": 17,
        "name": "backgroundColor",
        "type": "color",
        "defaultValue": "",
        "description": "Button background color",
        "xmlParam": "android:background",
        "composeParam": "backgroundColor",
        "iosParam": "backgroundColor",
        "webParam": "buttonBg",
        "createdAt": "2025-08-26T16:18:33.278Z",
        "updatedAt": "2025-08-26T16:18:33.278Z"
      }
    },
    {
      "id": 1468,
      "tokenId": 198,
      "value": "text.default.primary",
      "type": "variation",
      "variationValueId": 628,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.023Z",
      "updatedAt": "2025-09-05T16:48:34.023Z",
      "token": {
        "id": 198,
        "componentId": 12,
        "name": "textColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет текста ссылки",
        "xmlParam": "contentColor",
        "composeParam": "contentColor",
        "iosParam": "contentColor",
        "webParam": "linkColor",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1469,
      "tokenId": 207,
      "value": "text.default.secondary",
      "type": "variation",
      "variationValueId": 628,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.023Z",
      "updatedAt": "2025-09-05T16:48:34.023Z",
      "token": {
        "id": 207,
        "componentId": 12,
        "name": "textColorVisited",
        "type": "color",
        "defaultValue": "",
        "description": "Цвет текста посещённой ссылки",
        "xmlParam": "contentColorVisited",
        "composeParam": "contentColorVisited",
        "iosParam": "contentColorVisited",
        "webParam": "linkColorVisited",
        "createdAt": "2025-07-01T19:55:37.689Z",
        "updatedAt": "2025-07-01T19:55:37.689Z"
      }
    },
    {
      "id": 1470,
      "tokenId": 204,
      "value": "0",
      "type": "variation",
      "variationValueId": 628,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.023Z",
      "updatedAt": "2025-09-05T16:48:34.023Z",
      "token": {
        "id": 204,
        "componentId": 12,
        "name": "underlineBorderWidth",
        "type": "dimension",
        "defaultValue": "",
        "description": "толщина подчеркивания",
        "xmlParam": "android:textUnderline",
        "composeParam": "textDecoration",
        "iosParam": "underlineThickness",
        "webParam": "linkUnderlineBorder",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1471,
      "tokenId": 198,
      "value": "text.default.secondary",
      "type": "variation",
      "variationValueId": 629,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.028Z",
      "updatedAt": "2025-09-05T16:48:34.028Z",
      "token": {
        "id": 198,
        "componentId": 12,
        "name": "textColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет текста ссылки",
        "xmlParam": "contentColor",
        "composeParam": "contentColor",
        "iosParam": "contentColor",
        "webParam": "linkColor",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1472,
      "tokenId": 207,
      "value": "text.default.tertiary",
      "type": "variation",
      "variationValueId": 629,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.028Z",
      "updatedAt": "2025-09-05T16:48:34.028Z",
      "token": {
        "id": 207,
        "componentId": 12,
        "name": "textColorVisited",
        "type": "color",
        "defaultValue": "",
        "description": "Цвет текста посещённой ссылки",
        "xmlParam": "contentColorVisited",
        "composeParam": "contentColorVisited",
        "iosParam": "contentColorVisited",
        "webParam": "linkColorVisited",
        "createdAt": "2025-07-01T19:55:37.689Z",
        "updatedAt": "2025-07-01T19:55:37.689Z"
      }
    },
    {
      "id": 1473,
      "tokenId": 204,
      "value": "0",
      "type": "variation",
      "variationValueId": 629,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.028Z",
      "updatedAt": "2025-09-05T16:48:34.028Z",
      "token": {
        "id": 204,
        "componentId": 12,
        "name": "underlineBorderWidth",
        "type": "dimension",
        "defaultValue": "",
        "description": "толщина подчеркивания",
        "xmlParam": "android:textUnderline",
        "composeParam": "textDecoration",
        "iosParam": "underlineThickness",
        "webParam": "linkUnderlineBorder",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1477,
      "tokenId": 198,
      "value": "inherit",
      "type": "variation",
      "variationValueId": 631,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.036Z",
      "updatedAt": "2025-09-05T16:48:34.036Z",
      "token": {
        "id": 198,
        "componentId": 12,
        "name": "textColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет текста ссылки",
        "xmlParam": "contentColor",
        "composeParam": "contentColor",
        "iosParam": "contentColor",
        "webParam": "linkColor",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1478,
      "tokenId": 207,
      "value": "inherit",
      "type": "variation",
      "variationValueId": 631,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.036Z",
      "updatedAt": "2025-09-05T16:48:34.036Z",
      "token": {
        "id": 207,
        "componentId": 12,
        "name": "textColorVisited",
        "type": "color",
        "defaultValue": "",
        "description": "Цвет текста посещённой ссылки",
        "xmlParam": "contentColorVisited",
        "composeParam": "contentColorVisited",
        "iosParam": "contentColorVisited",
        "webParam": "linkColorVisited",
        "createdAt": "2025-07-01T19:55:37.689Z",
        "updatedAt": "2025-07-01T19:55:37.689Z"
      }
    },
    {
      "id": 1479,
      "tokenId": 204,
      "value": "1",
      "type": "variation",
      "variationValueId": 631,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.036Z",
      "updatedAt": "2025-09-05T16:48:34.036Z",
      "token": {
        "id": 204,
        "componentId": 12,
        "name": "underlineBorderWidth",
        "type": "dimension",
        "defaultValue": "",
        "description": "толщина подчеркивания",
        "xmlParam": "android:textUnderline",
        "composeParam": "textDecoration",
        "iosParam": "underlineThickness",
        "webParam": "linkUnderlineBorder",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1480,
      "tokenId": 197,
      "value": "body.s.normal",
      "type": "variation",
      "variationValueId": 632,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.040Z",
      "updatedAt": "2025-09-05T16:48:34.040Z",
      "token": {
        "id": 197,
        "componentId": 12,
        "name": "textStyle",
        "type": "typography",
        "defaultValue": "",
        "description": "семейство шрифта ссылки",
        "xmlParam": "android:minHeight",
        "composeParam": "height",
        "iosParam": "height",
        "webParam": "linkFont",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1481,
      "tokenId": 197,
      "value": "body.m.normal",
      "type": "variation",
      "variationValueId": 633,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.044Z",
      "updatedAt": "2025-09-05T16:48:34.044Z",
      "token": {
        "id": 197,
        "componentId": 12,
        "name": "textStyle",
        "type": "typography",
        "defaultValue": "",
        "description": "семейство шрифта ссылки",
        "xmlParam": "android:minHeight",
        "composeParam": "height",
        "iosParam": "height",
        "webParam": "linkFont",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1482,
      "tokenId": 197,
      "value": "body.l.normal",
      "type": "variation",
      "variationValueId": 634,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:48:34.048Z",
      "updatedAt": "2025-09-05T16:48:34.048Z",
      "token": {
        "id": 197,
        "componentId": 12,
        "name": "textStyle",
        "type": "typography",
        "defaultValue": "",
        "description": "семейство шрифта ссылки",
        "xmlParam": "android:minHeight",
        "composeParam": "height",
        "iosParam": "height",
        "webParam": "linkFont",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1485,
      "tokenId": 198,
      "value": "text.default.accent",
      "type": "variation",
      "variationValueId": 630,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:49:19.553Z",
      "updatedAt": "2025-09-05T16:49:19.553Z",
      "token": {
        "id": 198,
        "componentId": 12,
        "name": "textColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет текста ссылки",
        "xmlParam": "contentColor",
        "composeParam": "contentColor",
        "iosParam": "contentColor",
        "webParam": "linkColor",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1486,
      "tokenId": 207,
      "value": "text.default.accent-minor",
      "type": "variation",
      "variationValueId": 630,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:49:19.553Z",
      "updatedAt": "2025-09-05T16:49:19.553Z",
      "token": {
        "id": 207,
        "componentId": 12,
        "name": "textColorVisited",
        "type": "color",
        "defaultValue": "",
        "description": "Цвет текста посещённой ссылки",
        "xmlParam": "contentColorVisited",
        "composeParam": "contentColorVisited",
        "iosParam": "contentColorVisited",
        "webParam": "linkColorVisited",
        "createdAt": "2025-07-01T19:55:37.689Z",
        "updatedAt": "2025-07-01T19:55:37.689Z"
      }
    },
    {
      "id": 1487,
      "tokenId": 204,
      "value": "0",
      "type": "variation",
      "variationValueId": 630,
      "componentId": null,
      "designSystemId": null,
      "createdAt": "2025-09-05T16:49:19.553Z",
      "updatedAt": "2025-09-05T16:49:19.553Z",
      "token": {
        "id": 204,
        "componentId": 12,
        "name": "underlineBorderWidth",
        "type": "dimension",
        "defaultValue": "",
        "description": "толщина подчеркивания",
        "xmlParam": "android:textUnderline",
        "composeParam": "textDecoration",
        "iosParam": "underlineThickness",
        "webParam": "linkUnderlineBorder",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1483,
      "tokenId": 205,
      "value": "0.4",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 12,
      "designSystemId": 154,
      "createdAt": "2025-09-05T16:48:34.067Z",
      "updatedAt": "2025-09-05T16:48:34.067Z",
      "token": {
        "id": 205,
        "componentId": 12,
        "name": "disableAlpha",
        "type": "float",
        "defaultValue": "",
        "description": "прозрачность в отключенном состоянии",
        "xmlParam": "android:alpha",
        "composeParam": "disabledOpacity",
        "iosParam": "disabledOpacity",
        "webParam": "linkDisabledOpacity",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1484,
      "tokenId": 206,
      "value": "text.default.accent",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 12,
      "designSystemId": 154,
      "createdAt": "2025-09-05T16:48:34.072Z",
      "updatedAt": "2025-09-05T16:48:34.072Z",
      "token": {
        "id": 206,
        "componentId": 12,
        "name": "focusColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет ссылки в фокусе",
        "xmlParam": "sd_focusColor",
        "composeParam": "focusColor",
        "iosParam": "focusColor",
        "webParam": "linkColorFocus",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1295,
      "tokenId": 206,
      "value": "#28a745",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 12,
      "designSystemId": null,
      "createdAt": "2025-09-02T10:53:57.745Z",
      "updatedAt": "2025-09-02T10:53:57.745Z",
      "token": {
        "id": 206,
        "componentId": 12,
        "name": "focusColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет ссылки в фокусе",
        "xmlParam": "sd_focusColor",
        "composeParam": "focusColor",
        "iosParam": "focusColor",
        "webParam": "linkColorFocus",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1296,
      "tokenId": 205,
      "value": "0.8",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 12,
      "designSystemId": null,
      "createdAt": "2025-09-02T10:53:57.745Z",
      "updatedAt": "2025-09-02T10:53:57.745Z",
      "token": {
        "id": 205,
        "componentId": 12,
        "name": "disableAlpha",
        "type": "float",
        "defaultValue": "",
        "description": "прозрачность в отключенном состоянии",
        "xmlParam": "android:alpha",
        "composeParam": "disabledOpacity",
        "iosParam": "disabledOpacity",
        "webParam": "linkDisabledOpacity",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1568,
      "tokenId": 217,
      "value": "#28a745",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 26,
      "designSystemId": null,
      "createdAt": "2025-09-05T19:09:33.723Z",
      "updatedAt": "2025-09-05T19:09:33.723Z",
      "token": {
        "id": 217,
        "componentId": 26,
        "name": "focusColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет ссылки в фокусе",
        "xmlParam": "sd_focusColor",
        "composeParam": "focusColor",
        "iosParam": "focusColor",
        "webParam": "linkColorFocus",
        "createdAt": "2025-09-05T19:09:33.661Z",
        "updatedAt": "2025-09-05T19:09:33.661Z"
      }
    },
    {
      "id": 1569,
      "tokenId": 218,
      "value": "0.8",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 26,
      "designSystemId": null,
      "createdAt": "2025-09-05T19:09:33.723Z",
      "updatedAt": "2025-09-05T19:09:33.723Z",
      "token": {
        "id": 218,
        "componentId": 26,
        "name": "disableAlpha",
        "type": "float",
        "defaultValue": "",
        "description": "прозрачность в отключенном состоянии",
        "xmlParam": "android:alpha",
        "composeParam": "disabledOpacity",
        "iosParam": "disabledOpacity",
        "webParam": "linkDisabledOpacity",
        "createdAt": "2025-09-05T19:09:33.661Z",
        "updatedAt": "2025-09-05T19:09:33.661Z"
      }
    }
  ],
  "designSystemComponents": [
    {
      "id": 310,
      "designSystemId": 154,
      "componentId": 2,
      "createdAt": "2025-09-05T16:48:33.954Z",
      "updatedAt": "2025-09-05T16:48:33.954Z"
    },
    {
      "id": 311,
      "designSystemId": 154,
      "componentId": 14,
      "createdAt": "2025-09-05T16:48:33.960Z",
      "updatedAt": "2025-09-05T16:48:33.960Z"
    },
    {
      "id": 312,
      "designSystemId": 154,
      "componentId": 12,
      "createdAt": "2025-09-05T16:48:33.963Z",
      "updatedAt": "2025-09-05T16:48:33.963Z"
    },
    {
      "id": 313,
      "designSystemId": 154,
      "componentId": 15,
      "createdAt": "2025-09-05T16:48:33.966Z",
      "updatedAt": "2025-09-05T16:48:33.966Z"
    },
    {
      "id": 314,
      "designSystemId": 154,
      "componentId": 16,
      "createdAt": "2025-09-05T16:48:33.969Z",
      "updatedAt": "2025-09-05T16:48:33.969Z"
    }
  ],
  "propsAPI": [
    {
      "id": 2,
      "componentId": 12,
      "name": "disabled",
      "value": "false",
      "createdAt": "2025-07-01T19:04:26.302Z",
      "updatedAt": "2025-07-01T19:04:26.302Z"
    },
    {
      "id": 3,
      "componentId": 12,
      "name": "target",
      "value": "_blank",
      "createdAt": "2025-07-01T19:16:59.851Z",
      "updatedAt": "2025-07-01T19:16:59.851Z"
    },
    {
      "id": 4,
      "componentId": 12,
      "name": "href",
      "value": "https://google.com",
      "createdAt": "2025-07-01T19:17:30.029Z",
      "updatedAt": "2025-07-01T19:17:30.029Z"
    },
    {
      "id": 1,
      "componentId": 12,
      "name": "text",
      "value": "hello world",
      "createdAt": "2025-07-01T19:03:30.531Z",
      "updatedAt": "2025-07-01T19:03:30.531Z"
    },
    {
      "id": 5,
      "componentId": 26,
      "name": "disabled",
      "value": "false",
      "createdAt": "2025-09-05T19:09:33.698Z",
      "updatedAt": "2025-09-05T19:09:33.698Z"
    },
    {
      "id": 6,
      "componentId": 26,
      "name": "target",
      "value": "_blank",
      "createdAt": "2025-09-05T19:09:33.698Z",
      "updatedAt": "2025-09-05T19:09:33.698Z"
    },
    {
      "id": 7,
      "componentId": 26,
      "name": "href",
      "value": "https://google.com",
      "createdAt": "2025-09-05T19:09:33.698Z",
      "updatedAt": "2025-09-05T19:09:33.698Z"
    },
    {
      "id": 8,
      "componentId": 26,
      "name": "text",
      "value": "hello world",
      "createdAt": "2025-09-05T19:09:33.698Z",
      "updatedAt": "2025-09-05T19:09:33.698Z"
    }
  ],
  "invariantTokenValues": [
    {
      "id": 1483,
      "tokenId": 205,
      "value": "0.4",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 12,
      "designSystemId": 154,
      "createdAt": "2025-09-05T16:48:34.067Z",
      "updatedAt": "2025-09-05T16:48:34.067Z",
      "token": {
        "id": 205,
        "componentId": 12,
        "name": "disableAlpha",
        "type": "float",
        "defaultValue": "",
        "description": "прозрачность в отключенном состоянии",
        "xmlParam": "android:alpha",
        "composeParam": "disabledOpacity",
        "iosParam": "disabledOpacity",
        "webParam": "linkDisabledOpacity",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1484,
      "tokenId": 206,
      "value": "text.default.accent",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 12,
      "designSystemId": 154,
      "createdAt": "2025-09-05T16:48:34.072Z",
      "updatedAt": "2025-09-05T16:48:34.072Z",
      "token": {
        "id": 206,
        "componentId": 12,
        "name": "focusColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет ссылки в фокусе",
        "xmlParam": "sd_focusColor",
        "composeParam": "focusColor",
        "iosParam": "focusColor",
        "webParam": "linkColorFocus",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1295,
      "tokenId": 206,
      "value": "#28a745",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 12,
      "designSystemId": null,
      "createdAt": "2025-09-02T10:53:57.745Z",
      "updatedAt": "2025-09-02T10:53:57.745Z",
      "token": {
        "id": 206,
        "componentId": 12,
        "name": "focusColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет ссылки в фокусе",
        "xmlParam": "sd_focusColor",
        "composeParam": "focusColor",
        "iosParam": "focusColor",
        "webParam": "linkColorFocus",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1296,
      "tokenId": 205,
      "value": "0.8",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 12,
      "designSystemId": null,
      "createdAt": "2025-09-02T10:53:57.745Z",
      "updatedAt": "2025-09-02T10:53:57.745Z",
      "token": {
        "id": 205,
        "componentId": 12,
        "name": "disableAlpha",
        "type": "float",
        "defaultValue": "",
        "description": "прозрачность в отключенном состоянии",
        "xmlParam": "android:alpha",
        "composeParam": "disabledOpacity",
        "iosParam": "disabledOpacity",
        "webParam": "linkDisabledOpacity",
        "createdAt": "2025-06-07T00:43:46.511Z",
        "updatedAt": "2025-06-07T00:43:46.511Z"
      }
    },
    {
      "id": 1568,
      "tokenId": 217,
      "value": "#28a745",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 26,
      "designSystemId": null,
      "createdAt": "2025-09-05T19:09:33.723Z",
      "updatedAt": "2025-09-05T19:09:33.723Z",
      "token": {
        "id": 217,
        "componentId": 26,
        "name": "focusColor",
        "type": "color",
        "defaultValue": "",
        "description": "цвет ссылки в фокусе",
        "xmlParam": "sd_focusColor",
        "composeParam": "focusColor",
        "iosParam": "focusColor",
        "webParam": "linkColorFocus",
        "createdAt": "2025-09-05T19:09:33.661Z",
        "updatedAt": "2025-09-05T19:09:33.661Z"
      }
    },
    {
      "id": 1569,
      "tokenId": 218,
      "value": "0.8",
      "type": "invariant",
      "variationValueId": null,
      "componentId": 26,
      "designSystemId": null,
      "createdAt": "2025-09-05T19:09:33.723Z",
      "updatedAt": "2025-09-05T19:09:33.723Z",
      "token": {
        "id": 218,
        "componentId": 26,
        "name": "disableAlpha",
        "type": "float",
        "defaultValue": "",
        "description": "прозрачность в отключенном состоянии",
        "xmlParam": "android:alpha",
        "composeParam": "disabledOpacity",
        "iosParam": "disabledOpacity",
        "webParam": "linkDisabledOpacity",
        "createdAt": "2025-09-05T19:09:33.661Z",
        "updatedAt": "2025-09-05T19:09:33.661Z"
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
