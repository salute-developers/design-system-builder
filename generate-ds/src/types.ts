export interface Token {
  id: number;
  name: string;
  description: string | null;
  type: string;
  defaultValue?: string | null;
  componentId: number;
  xmlParam?: string | null;
  composeParam?: string | null;
  iosParam?: string | null;
  webParam?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TokenValue {
  id: number;
  variationValueId: number;
  tokenId: number;
  value: string;
  createdAt: string;
  updatedAt: string;
  token: Token;
}

export interface Variation {
  id: number;
  name: string;
  description: string | null;
  componentId: number;
  createdAt: string;
  updatedAt: string;
}

export interface VariationValue {
  id: number;
  designSystemId: number;
  componentId: number;
  variationId: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  tokenValues: TokenValue[];
}

export interface Component {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  variations: Variation[];
}

export interface DesignSystemComponent {
  id: number;
  designSystemId: number;
  componentId: number;
  createdAt: string;
  updatedAt: string;
  component: Component;
}

export interface DesignSystem {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  components: DesignSystemComponent[];
  variationValues: VariationValue[];
}

export interface ComponentConfig {
  defaults: Record<string, string>;
  variations: Record<string, Record<string, string>>;
} 