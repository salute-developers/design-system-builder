import {
    DesignSystemData,
    DesignSystemTuple
} from '../validation';
import { BackendThemeStore } from './backendThemes';
import { BackendComponentStore } from './backendComponents';
import { IndexStore } from './indexStore';
import { Logger } from '../utils/logger';
import { ThemeSource, Meta } from '../validation';

export class DesignSystemStore {
    private themeStore: BackendThemeStore;
    private componentStore: BackendComponentStore;
    private indexStore: IndexStore;

    constructor(indexStore?: IndexStore, componentStore?: BackendComponentStore) {
        this.themeStore = new BackendThemeStore();
        this.componentStore = componentStore || new BackendComponentStore();
        this.indexStore = indexStore || new IndexStore();
    }

    // Save design system data with enhanced transformation
    async saveDesignSystem(data: DesignSystemData): Promise<void> {
        const { name, version, themeData, componentsData } = data;
        
        Logger.log(`🔄 Processing design system: ${name}@${version}`);
        Logger.log(`📊 Components: ${componentsData.length}, Theme: ${themeData ? 'present' : 'missing'}`);

        // Save components using our enhanced transformation system
        await this.componentStore.saveComponents(name, version, componentsData);

        // Save theme data using existing theme store
        await this.themeStore.saveTheme(name, version, themeData);

        // Add to index

        // await this.indexStore.addToIndex(name, version);

        Logger.log(`✅ Saved design system to backend: ${name}@${version} (theme + components with transformation)`);
    }

    // Load design system data with enhanced transformation
    async loadDesignSystem(name: string, version: string): Promise<{ themeData: ThemeSource; componentsData: Meta[] }> {
        // First check if design system exists in index
        const existsInIndex = await this.indexStore.existsInIndex(name, version);
        if (!existsInIndex) {
            throw new Error('Design system not found in backend index');
        }

        // Check if both theme and components exist
        // const [themeExists, componentsExist] = await Promise.all([
        //     this.themeStore.themeExists(name, version),
        //     this.componentStore.componentsExist(name, version)
        // ]);


        // if (!themeExists || !componentsExist) {
        //     // Files are missing - clean up index
        //     await this.indexStore.removeFromIndex(name, version);
        //     throw new Error('Design system data not found in storage');
        // }

        // Load both theme and components in parallel using our enhanced system
        const [themeData, componentsData] = await Promise.all([
            this.themeStore.loadTheme(name, version),
            this.componentStore.loadComponents(name, version)
        ]);

        Logger.log(`✅ Loaded design system from storage: ${name}@${version} (theme + components with transformation)`);
        return { themeData, componentsData };
    }

    // List all design systems from index
    async listDesignSystems(): Promise<DesignSystemTuple[]> {
        const designSystems = await this.indexStore.listFromIndex();
        Logger.log(`📋 Listed ${designSystems.length} design systems from storage index`);
        return designSystems as DesignSystemTuple[];
    }

    // Delete design system with enhanced cleanup
    async deleteDesignSystem(name: string, version: string): Promise<void> {
        // Check if design system exists in index
        const exists = await this.indexStore.existsInIndex(name, version);
        if (!exists) {
            throw new Error('Design system not found in backend index');
        }

        // Delete both theme and components in parallel using our enhanced system
        await Promise.all([
            this.themeStore.deleteTheme(name, version),
            // INFO: здесь удаляется дизайн система
            this.componentStore.deleteComponents(name, version)
        ]);

        // Remove from index
        // await this.indexStore.removeFromIndex(name, version);
        
        Logger.log(`🗑️ Deleted design system from storage: ${name}@${version} (theme + components with transformation)`);
    }
    
}

// Factory function to create a store instance
export const createStore = (indexStore?: IndexStore, componentStore?: BackendComponentStore): DesignSystemStore => {
    return new DesignSystemStore(indexStore, componentStore);
};
