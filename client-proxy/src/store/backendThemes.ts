import { Logger } from '../utils/logger';
import { ThemeSource } from '../validation';

// Backend API response interfaces
interface BackendThemeResponse {
    id: number;
    designSystemId: number;
    name: string;
    version: string;
    themeData: ThemeSource;
    createdAt: string;
    updatedAt: string;
}

interface BackendDesignSystemResponse {
    id: number;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
}

export class BackendThemeStore {
    private baseUrl: string;

    constructor() {
        this.baseUrl = process.env.BACKEND_URL || 'http://localhost:3001/api';
        Logger.log(`🎨 BackendThemeStore baseUrl set to: ${this.baseUrl}`);
    }

    /**
     * Save theme to backend database
     */
    async saveTheme(name: string, version: string, themeData: ThemeSource): Promise<void> {
        Logger.log(`🎨 Saving theme to backend: ${name}@${version}`);
        
        try {
            // First, get or create the design system
            const designSystemId = await this.ensureDesignSystemExists(name);
            
            // Save theme to backend
            const response = await fetch(`${this.baseUrl}/themes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    designSystemId,
                    name,
                    version,
                    themeData
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to save theme: ${response.status} ${response.statusText} - ${errorText}`);
            }

            Logger.log(`✅ Theme saved to backend: ${name}@${version}`);
        } catch (error) {
            Logger.error(`❌ Failed to save theme to backend: ${name}@${version}`, error);
            throw error;
        }
    }

    /**
     * Load theme from backend database
     */
    async loadTheme(name: string, version: string): Promise<ThemeSource> {
        Logger.log(`🎨 Loading theme from backend: ${name}@${version}`);
        
        try {
            // Get design system ID first
            const designSystemId = await this.getDesignSystemId(name);
            if (!designSystemId) {
                throw new Error(`Design system ${name} not found in backend`);
            }

            // Load theme from backend
            const response = await fetch(`${this.baseUrl}/themes/${designSystemId}/${name}/${version}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Theme data not found');
                }
                throw new Error(`Failed to load theme: ${response.status} ${response.statusText}`);
            }

            const themeResponse = await response.json() as BackendThemeResponse;
            Logger.log(`✅ Theme loaded from backend: ${name}@${version}`);
            return themeResponse.themeData;
        } catch (error) {
            Logger.error(`❌ Failed to load theme from backend: ${name}@${version}`, error);
            throw error;
        }
    }

    /**
     * Delete theme from backend database
     */
    async deleteTheme(name: string, version: string): Promise<void> {
        Logger.log(`🗑️ Deleting theme from backend: ${name}@${version}`);
        
        try {
            // Get design system ID first
            const designSystemId = await this.getDesignSystemId(name);
            if (!designSystemId) {
                Logger.log(`⚠️ Design system ${name} not found, nothing to delete`);
                return;
            }

            // Delete theme from backend
            const response = await fetch(`${this.baseUrl}/themes/${designSystemId}/${name}/${version}`, {
                method: 'DELETE'
            });

            if (!response.ok && response.status !== 404) {
                throw new Error(`Failed to delete theme: ${response.status} ${response.statusText}`);
            }

            Logger.log(`✅ Theme deleted from backend: ${name}@${version}`);
        } catch (error) {
            Logger.error(`❌ Failed to delete theme from backend: ${name}@${version}`, error);
            throw error;
        }
    }

    /**
     * Check if theme exists in backend database
     */
    async themeExists(name: string, version: string): Promise<boolean> {
        try {
            // Get design system ID first
            const designSystemId = await this.getDesignSystemId(name);
            if (!designSystemId) {
                return false;
            }

            // Check if theme exists
            const response = await fetch(`${this.baseUrl}/themes/${designSystemId}/${name}/${version}`, {
                method: 'HEAD'
            });

            return response.ok;
        } catch (error) {
            Logger.error(`❌ Failed to check if theme exists: ${name}@${version}`, error);
            return false;
        }
    }

    /**
     * List all theme files from backend
     */
    async listThemeFiles(): Promise<string[]> {
        try {
            // Get all design systems first
            const response = await fetch(`${this.baseUrl}/design-systems`);
            if (!response.ok) {
                throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
            }

            const designSystems = await response.json() as BackendDesignSystemResponse[];
            const themeFiles: string[] = [];

            // For each design system, get its themes
            for (const designSystem of designSystems) {
                const themesResponse = await fetch(`${this.baseUrl}/themes/design-system/${designSystem.id}`);
                if (themesResponse.ok) {
                    const themes = await themesResponse.json() as Array<{ name: string; version: string }>;
                    themes.forEach(theme => {
                        themeFiles.push(`${theme.name}@${theme.version}.theme.json`);
                    });
                }
            }

            return themeFiles;
        } catch (error) {
            Logger.error('❌ Failed to list theme files from backend:', error);
            return [];
        }
    }

    /**
     * Ensure design system exists in backend
     */
    private async ensureDesignSystemExists(name: string): Promise<number> {
        try {
            // First check if design system already exists
            const existingId = await this.getDesignSystemId(name);
            if (existingId) {
                Logger.log(`✅ Design system already exists in backend: ${name} with ID: ${existingId}`);
                return existingId;
            }

            // Create new design system if it doesn't exist
            const response = await fetch(`${this.baseUrl}/design-systems`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    description: `Design System ${name}`
                })
            });

            if (response.ok) {
                const result = await response.json() as any;
                Logger.log(`✅ New design system created in backend: ${name} with ID: ${result.id}`);
                return result.id;
            } else {
                throw new Error(`Failed to create design system: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            Logger.error(`❌ Failed to ensure design system exists: ${name}`, error);
            throw error;
        }
    }

    /**
     * Get design system ID by name from backend
     */
    private async getDesignSystemId(name: string): Promise<number | null> {
        try {
            const response = await fetch(`${this.baseUrl}/design-systems`);
            if (!response.ok) {
                throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
            }

            const designSystems = await response.json() as BackendDesignSystemResponse[];
            const designSystem = designSystems.find(ds => ds.name === name);
            return designSystem ? designSystem.id : null;
        } catch (error) {
            Logger.error(`❌ Failed to get design system ID for ${name}:`, error);
            return null;
        }
    }
}
