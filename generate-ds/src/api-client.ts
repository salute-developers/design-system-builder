const fetch = require('node-fetch');
import { DesignSystem } from './types';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async getDesignSystem(id: number): Promise<DesignSystem> {
    const response = await fetch(`${this.baseUrl}/api/design-systems/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Design system with ID ${id} not found`);
      }
      throw new Error(`Failed to fetch design system: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as DesignSystem;
    return data;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/design-systems`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
} 