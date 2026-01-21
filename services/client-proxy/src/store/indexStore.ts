// Interface for backend design system response
export interface BackendDesignSystem {
    id: number;
    name: string;
    projectName: string;
    grayTone: string;
    accentColor: string;
    lightStrokeSaturation: number;
    lightFillSaturation: number;
    darkStrokeSaturation: number;
    darkFillSaturation: number;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface BackendUser {
    id: number;
    name: string;
    token: string;
    designSystems: number[];
    createdAt: string;
    updatedAt: string;
}

// Interface for creating a design system
export interface CreateDesignSystemRequest {
    name: string;
    description?: string;
}

export class IndexStore {
    private baseUrl: string;

    constructor() {
        // For now, hardcode the backend URL - this could be made configurable
        this.baseUrl = process.env.BACKEND_URL || 'http://localhost:3001/api';
    }

    // Add design system to backend index (design system already created by BackendComponentStore)
    // async addToIndex(name: string, version: string): Promise<void> {
    //     // The design system is already created by BackendComponentStore.ensureDesignSystemExists
    //     // We just need to verify it exists in the backend
    //     const exists = await this.existsInIndex(name, version);
    //     if (exists) {
    //         console.log(`Design system ${name}@${version} exists in backend index`);
    //     } else {
    //         console.log(`Design system ${name}@${version} not found in backend index (may need to wait for backend sync)`);
    //     }
    // }

    // Remove design system from backend
    // async removeFromIndex(name: string, version: string): Promise<void> {
    //     // First, get the design system to find its ID
    //     const response = await fetch(`${this.baseUrl}/design-systems`);
        
    //     if (!response.ok) {
    //         throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    //     }

    //     const backendDesignSystems = await response.json() as BackendDesignSystem[];
    //     const designSystem = backendDesignSystems.find(ds => ds.name === name);
    //     if (!designSystem) {
    //         throw new Error(`Design system ${name} not found in backend`);
    //     }

    //     // Delete by ID
    //     const deleteResponse = await fetch(`${this.baseUrl}/design-systems/${designSystem.id}`, {
    //         method: 'DELETE'
    //     });

    //     if (!deleteResponse.ok) {
    //         throw new Error(`Failed to delete design system from backend: ${deleteResponse.status} ${deleteResponse.statusText}`);
    //     }

    //     console.log(`Design system ${name}@${version} deleted from backend`);
    // }

    // Check if design system exists in backend
    async existsInIndex(name: string, version: string): Promise<boolean> {
        const response = await fetch(`${this.baseUrl}/design-systems`);
        
        if (!response.ok) {
            throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
        }

        const backendDesignSystems = await response.json() as BackendDesignSystem[];
        return backendDesignSystems.some(ds => ds.name === name);
    }

    async getDesignSystem(id: number) {
      const response = await fetch(`${this.baseUrl}/design-systems/${id}`);
        
        if (!response.ok) {
            throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
        }

        const backendDesignSystem = await response.json() as BackendDesignSystem;

        return backendDesignSystem;
    }

    async getUserByToken(token: string): Promise<BackendUser> {
      const response = await fetch(`${this.baseUrl}/users/by-token?token=${token}`);
        
        if (!response.ok) {
            throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
        }

        const user = await response.json() as BackendUser;

        return user;
    }

    // List all design systems from backend
    async listFromIndex(): Promise<Array<BackendDesignSystem>> {
        const response = await fetch(`${this.baseUrl}/design-systems`);
        
        if (!response.ok) {
            throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
        }

        const backendDesignSystems = await response.json() as BackendDesignSystem[];

        return backendDesignSystems;
    }
}
