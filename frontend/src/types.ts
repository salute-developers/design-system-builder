export interface DesignSystem {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  components: DesignSystemComponent[];
  variationValues: VariationValue[];
}

export interface DesignSystemComponent {
  id: number;
  designSystemId: number;
  componentId: number;
  createdAt: string;
  updatedAt: string;
  component: Component;
}

export interface Component {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  variations: Variation[];
}

export interface Variation {
  id: number;
  componentId: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  tokens?: Token[];
  tokenVariations?: TokenVariation[];
}

export interface Token {
  id: number;
  componentId?: number;
  name: string;
  type: string;
  defaultValue: string | null;
  description: string | null;
  xmlParam: string | null;
  composeParam: string | null;
  iosParam: string | null;
  webParam: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TokenVariation {
  id: number;
  tokenId: number;
  variationId: number;
  createdAt: string;
  updatedAt: string;
  token?: Token;
}

export interface VariationValue {
  id: number;
  designSystemId: number;
  componentId: number;
  variationId: number;
  name: string;
  description: string | null;
  isDefaultValue: string; // 'true' or 'false' as string from backend
  createdAt: string;
  updatedAt: string;
  tokenValues: TokenValue[];
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

export interface InvariantTokenValue {
  id: number;
  tokenId: number;
  value: string;
  type: string;
  componentId: number;
  createdAt: string;
  updatedAt: string;
  token: Token;
} 