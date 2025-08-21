import * as fs from 'fs-extra';
import * as path from 'path';
import {
    DesignSystemData,
    DesignSystemTuple
} from '../validation';
import { ThemeStore } from './themes';
import { ComponentStore } from './components';

export class DesignSystemStore {
    private storageDir: string;
    private themeStore: ThemeStore;
    private componentStore: ComponentStore;

    constructor(storageDir: string) {
        this.storageDir = storageDir;
        // Ensure storage directory exists
        fs.ensureDirSync(this.storageDir);
        
        this.themeStore = new ThemeStore(storageDir);
        this.componentStore = new ComponentStore(storageDir);
    }

    // Save design system data
    async saveDesignSystem(data: DesignSystemData): Promise<void> {
        const { name, version, themeData, componentsData } = data;
        
        // Save both theme and components in parallel
        await Promise.all([
            this.themeStore.saveTheme(name, version, themeData),
            this.componentStore.saveComponents(name, version, componentsData)
        ]);

        console.log(`Saved design system: ${name}@${version} (theme + components)`);
    }

    // Load design system data
    async loadDesignSystem(name: string, version: string): Promise<{ themeData: any; componentsData: any }> {
        // Check if both files exist first
        const [themeExists, componentsExist] = await Promise.all([
            this.themeStore.themeExists(name, version),
            this.componentStore.componentsExist(name, version)
        ]);

        if (!themeExists || !componentsExist) {
            const missing = [];
            if (!themeExists) missing.push('theme');
            if (!componentsExist) missing.push('components');
            throw new Error(`Missing ${missing.join(' and ')} data`);
        }

        // Load both theme and components in parallel
        const [themeData, componentsData] = await Promise.all([
            this.themeStore.loadTheme(name, version),
            this.componentStore.loadComponents(name, version)
        ]);

        console.log(`Loaded design system: ${name}@${version} (theme + components)`);
        return { themeData, componentsData };
    }

    // List all design systems
    async listDesignSystems(): Promise<DesignSystemTuple[]> {
        // Get both theme and component files in parallel
        const [themeFiles, componentFiles] = await Promise.all([
            this.themeStore.listThemeFiles(),
            this.componentStore.listComponentFiles()
        ]);
        
        // Get unique design systems by looking for .theme.json files
        // and checking if corresponding .components.json exists
        const designSystems: DesignSystemTuple[] = [];

        for (const themeFile of themeFiles) {
            const nameVersion = themeFile.replace('.theme.json', '');
            const [name, version] = nameVersion.split('@');
            
            if (name && version) {
                // Check if corresponding components file exists
                const componentsFile = `${nameVersion}.components.json`;
                if (componentFiles.includes(componentsFile)) {
                    designSystems.push([name, version] as const);
                }
            }
        }

        console.log(`Listed ${designSystems.length} design systems`);
        return designSystems;
    }

    // Delete design system
    async deleteDesignSystem(name: string, version: string): Promise<void> {
        // Check if design system exists before attempting to delete
        const [themeExists, componentsExist] = await Promise.all([
            this.themeStore.themeExists(name, version),
            this.componentStore.componentsExist(name, version)
        ]);

        if (!themeExists && !componentsExist) {
            throw new Error('Design system not found');
        }

        // Delete both theme and components in parallel
        await Promise.all([
            this.themeStore.deleteTheme(name, version),
            this.componentStore.deleteComponents(name, version)
        ]);
        
        console.log(`Deleted design system: ${name}@${version} (theme + components)`);
    }

    // Check if design system exists
    async designSystemExists(name: string, version: string): Promise<boolean> {
        const [themeExists, componentsExist] = await Promise.all([
            this.themeStore.themeExists(name, version),
            this.componentStore.componentsExist(name, version)
        ]);

        return themeExists && componentsExist;
    }
}

// Factory function to create a store instance
export const createStore = (storageDir: string): DesignSystemStore => {
    return new DesignSystemStore(storageDir);
};
