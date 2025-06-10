const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Types for API responses
interface DesignSystem {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface DesignSystemDetailed extends DesignSystem {
  components: DesignSystemComponent[];
  variationValues: VariationValue[];
}

interface DesignSystemComponent {
  id: number;
  designSystemId: number;
  componentId: number;
  component: ComponentDetailed;
  createdAt: string;
  updatedAt: string;
}

interface Component {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface ComponentDetailed extends Component {
  variations: Variation[];
  tokens: Token[];
}

interface Variation {
  id: number;
  name: string;
  description?: string;
  componentId: number;
  createdAt: string;
  updatedAt: string;
  tokenVariations?: Array<{
    id: number;
    tokenId: number;
    variationId: number;
    createdAt: string;
    updatedAt: string;
    token: Token;
  }>;
}

interface Token {
  id: number;
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
  componentId?: number;
  xmlParam?: string;
  composeParam?: string;
  iosParam?: string;
  webParam?: string;
  createdAt: string;
  updatedAt: string;
}

interface VariationValue {
  id: number;
  designSystemId: number;
  componentId: number;
  variationId: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateDesignSystemRequest {
  name: string;
  description?: string;
}

interface UpdateDesignSystemRequest {
  name: string;
  description?: string;
}

interface AddComponentRequest {
  designSystemId: number;
  componentId: number;
}

interface CreateVariationValueRequest {
  designSystemId: number;
  componentId: number;
  variationId: number;
  name: string;
  description?: string;
  tokenValues?: Array<{
    tokenId: number;
    value: string;
  }>;
}

interface UpdateVariationValueRequest {
  name: string;
  description?: string;
  tokenValues?: Array<{
    tokenId: number;
    value: string;
  }>;
}

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

interface ApiError {
  error: string;
  missingFields?: string[];
}

class DesignSystemAPI {
  private baseURL = API_BASE_URL;

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // ========== HEALTH CHECK ==========
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  // ========== DESIGN SYSTEMS ==========
  async getDesignSystems(): Promise<DesignSystem[]> {
    return this.request<DesignSystem[]>('/design-systems');
  }

  async getDesignSystem(id: number): Promise<DesignSystemDetailed> {
    return this.request<DesignSystemDetailed>(`/design-systems/${id}`);
  }

  async createDesignSystem(data: CreateDesignSystemRequest): Promise<DesignSystem> {
    return this.request<DesignSystem>('/design-systems', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDesignSystem(id: number, data: UpdateDesignSystemRequest): Promise<DesignSystem> {
    return this.request<DesignSystem>(`/design-systems/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDesignSystem(id: number): Promise<void> {
    return this.request<void>(`/design-systems/${id}`, {
      method: 'DELETE',
    });
  }

  // ========== DESIGN SYSTEM COMPONENTS ==========
  async addComponentToDesignSystem(data: AddComponentRequest): Promise<DesignSystemComponent> {
    return this.request<DesignSystemComponent>('/design-systems/components', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeComponentFromDesignSystem(relationshipId: number): Promise<void> {
    return this.request<void>(`/design-systems/components/${relationshipId}`, {
      method: 'DELETE',
    });
  }

  // ========== COMPONENTS ==========
  async getAvailableComponents(): Promise<ComponentDetailed[]> {
    return this.request<ComponentDetailed[]>('/components/available');
  }

  // ========== VARIATION VALUES ==========
  async getVariationValues(): Promise<VariationValue[]> {
    return this.request<VariationValue[]>('/variation-values');
  }

  async getVariationValue(id: number): Promise<VariationValue> {
    return this.request<VariationValue>(`/variation-values/${id}`);
  }

  async createVariationValue(data: CreateVariationValueRequest): Promise<VariationValue> {
    return this.request<VariationValue>('/variation-values', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVariationValue(id: number, data: UpdateVariationValueRequest): Promise<VariationValue> {
    return this.request<VariationValue>(`/variation-values/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVariationValue(id: number): Promise<void> {
    return this.request<void>(`/variation-values/${id}`, {
      method: 'DELETE',
    });
  }
}

// Export singleton instance
export const designSystemAPI = new DesignSystemAPI();

// Export types for use in components
export type {
  DesignSystem,
  DesignSystemDetailed,
  DesignSystemComponent,
  Component,
  ComponentDetailed,
  Variation,
  Token,
  VariationValue,
  CreateDesignSystemRequest,
  UpdateDesignSystemRequest,
  AddComponentRequest,
  CreateVariationValueRequest,
  UpdateVariationValueRequest,
  HealthResponse,
  ApiError,
}; 