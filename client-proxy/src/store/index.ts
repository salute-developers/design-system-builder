import * as fs from 'fs-extra';
import {
    DesignSystemData,
    DesignSystemTuple
} from '../validation';
import { ThemeStore } from './themes';
import { ComponentStore } from './components';
import { IndexStore } from './indexStore';

export class DesignSystemStore {
    private storageDir: string;
    private themeStore: ThemeStore;
    private componentStore: ComponentStore;
    private indexStore: IndexStore;

    constructor(storageDir: string, indexStore?: IndexStore) {
        this.storageDir = storageDir;
        fs.ensureDirSync(this.storageDir);
        
        this.themeStore = new ThemeStore(storageDir);
        this.componentStore = new ComponentStore(storageDir);
        this.indexStore = indexStore || new IndexStore(storageDir);
    }

    // Save design system data
    async saveDesignSystem(data: DesignSystemData): Promise<void> {
        const { name, version, themeData, componentsData } = data;
        
        // Save both theme and components in parallel
        await Promise.all([
            this.themeStore.saveTheme(name, version, themeData),
            this.componentStore.saveComponents(name, version, componentsData)
        ]);

        // Add to index
        await this.indexStore.addToIndex(name, version);

        console.log(`Saved design system: ${name}@${version} (theme + components)`);
    }

    // Load design system data
    async loadDesignSystem(name: string, version: string): Promise<{ themeData: any; componentsData: any }> {
        // First check if design system exists in index
        const existsInIndex = await this.indexStore.existsInIndex(name, version);
        if (!existsInIndex) {
            throw new Error('Design system not found');
        }

        // Check if both files exist
        const [themeExists, componentsExist] = await Promise.all([
            this.themeStore.themeExists(name, version),
            this.componentStore.componentsExist(name, version)
        ]);

        if (!themeExists || !componentsExist) {
            // Files are missing - clean up index
            await this.indexStore.removeFromIndex(name, version);
            throw new Error('Design system not found');
        }

        // Load both theme and components in parallel
        const [themeData, componentsData] = await Promise.all([
            this.themeStore.loadTheme(name, version),
            this.componentStore.loadComponents(name, version)
        ]);

        console.log(`Loaded design system: ${name}@${version} (theme + components)`);
        return { themeData, componentsData };
    }

    // List all design systems from index
    async listDesignSystems(): Promise<DesignSystemTuple[]> {
        const designSystems = await this.indexStore.listFromIndex();
        console.log(`Listed ${designSystems.length} design systems from index`);
        return designSystems as DesignSystemTuple[];
    }

    // Delete design system
    async deleteDesignSystem(name: string, version: string): Promise<void> {
        // Check if design system exists in index
        const exists = await this.indexStore.existsInIndex(name, version);
        if (!exists) {
            throw new Error('Design system not found');
        }

        // Delete both theme and components in parallel
        await Promise.all([
            this.themeStore.deleteTheme(name, version),
            this.componentStore.deleteComponents(name, version)
        ]);

        // Remove from index
        await this.indexStore.removeFromIndex(name, version);
        
        console.log(`Deleted design system: ${name}@${version} (theme + components)`);
    }
    
}

// Factory function to create a store instance
export const createStore = (storageDir: string, indexStore?: IndexStore): DesignSystemStore => {
    return new DesignSystemStore(storageDir, indexStore);
};
