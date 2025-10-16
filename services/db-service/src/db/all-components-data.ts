// Объединённые данные всех компонентов
import { iconbuttonData } from './iconbutton-data';
import { linkData } from './link-data';
import { buttonData } from './button-data';
import { checkboxData } from './checkbox-data';
import { radioboxData } from './radiobox-data';

export const allComponentsData = {
  designSystems: [
    {
      id: 1,
      name: "test_66",
      description: "Design System with all components from pseudo_data_base",
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  components: [
    iconbuttonData.component,
    linkData.component,
    buttonData.component,
    checkboxData.component,
    radioboxData.component
  ],
  variations: [
    ...iconbuttonData.variations,
    ...linkData.variations,
    ...buttonData.variations,
    ...checkboxData.variations,
    ...radioboxData.variations
  ],
  tokens: [
    ...iconbuttonData.tokens,
    ...linkData.tokens,
    ...buttonData.tokens,
    ...checkboxData.tokens,
    ...radioboxData.tokens
  ],
  tokenVariations: [
    ...iconbuttonData.tokenVariations,
    ...linkData.tokenVariations,
    ...buttonData.tokenVariations,
    ...checkboxData.tokenVariations,
    ...radioboxData.tokenVariations
  ],
  variationValues: [
    ...iconbuttonData.variationValues,
    ...linkData.variationValues,
    ...buttonData.variationValues,
    ...checkboxData.variationValues,
    ...radioboxData.variationValues
  ],
  tokenValues: [
    ...iconbuttonData.tokenValues,
    ...linkData.tokenValues,
    ...buttonData.tokenValues,
    ...checkboxData.tokenValues,
    ...radioboxData.tokenValues
  ],
  designSystemComponents: [
    {
      id: 1,
      designSystemId: 1,
      componentId: 1,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 2,
      designSystemId: 1,
      componentId: 2,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 3,
      designSystemId: 1,
      componentId: 3,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 4,
      designSystemId: 1,
      componentId: 4,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    },
    {
      id: 5,
      designSystemId: 1,
      componentId: 5,
      createdAt: "2025-01-27T12:00:00.000Z",
      updatedAt: "2025-01-27T12:00:00.000Z"
    }
  ],
  propsAPI: [
    ...iconbuttonData.propsAPI,
    ...linkData.propsAPI,
    ...buttonData.propsAPI,
    ...checkboxData.propsAPI,
    ...radioboxData.propsAPI
  ],
  invariantTokenValues: [
    ...iconbuttonData.invariantTokenValues,
    ...linkData.invariantTokenValues,
    ...buttonData.invariantTokenValues,
    ...checkboxData.invariantTokenValues,
    ...radioboxData.invariantTokenValues
  ]
};
