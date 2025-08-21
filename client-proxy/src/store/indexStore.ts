import * as fs from 'fs-extra';
import * as path from 'path';

// Interface for design system index entry
export interface DesignSystemIndexEntry {
    name: string;
    version: string;
    createdAt: string;
    updatedAt: string;
}

// Interface for design system index file
export interface DesignSystemIndex {
    designSystems: DesignSystemIndexEntry[];
    lastUpdated: string;
}

export class IndexStore {
    private indexPath: string;

    constructor(storageDir: string) {
        this.indexPath = path.join(storageDir, 'index.json');
    }

    // Load design system index
    async loadDesignSystemIndex(): Promise<DesignSystemIndex> {
        try {
            if (await fs.pathExists(this.indexPath)) {
                const indexData = await fs.readJson(this.indexPath);
                return indexData as DesignSystemIndex;
            }
        } catch (error) {
            console.warn('Error loading design system index, creating new one:', error);
        }
        
        // Return empty index if file doesn't exist or is corrupted
        return {
            designSystems: [],
            lastUpdated: new Date().toISOString()
        };
    }

    // Save design system index
    async saveDesignSystemIndex(index: DesignSystemIndex): Promise<void> {
        index.lastUpdated = new Date().toISOString();
        await fs.writeJson(this.indexPath, index, { spaces: 2 });
    }

    // Add or update design system in index
    async addToIndex(name: string, version: string): Promise<void> {
        const index = await this.loadDesignSystemIndex();
        const existingIndex = index.designSystems.findIndex(
            ds => ds.name === name && ds.version === version
        );

        const now = new Date().toISOString();
        
        if (existingIndex >= 0) {
            // Update existing entry
            index.designSystems[existingIndex]!.updatedAt = now;
        } else {
            // Add new entry
            index.designSystems.push({
                name,
                version,
                createdAt: now,
                updatedAt: now
            });
        }

        await this.saveDesignSystemIndex(index);
    }

    // Remove design system from index
    async removeFromIndex(name: string, version: string): Promise<void> {
        const index = await this.loadDesignSystemIndex();
        index.designSystems = index.designSystems.filter(
            ds => !(ds.name === name && ds.version === version)
        );
        await this.saveDesignSystemIndex(index);
    }

    // Check if design system exists in index
    async existsInIndex(name: string, version: string): Promise<boolean> {
        const index = await this.loadDesignSystemIndex();
        return index.designSystems.some(
            ds => ds.name === name && ds.version === version
        );
    }

    // List all design systems from index
    async listFromIndex(): Promise<Array<[string, string]>> {
        const index = await this.loadDesignSystemIndex();
        return index.designSystems
            .map(ds => [ds.name, ds.version] as [string, string])
            .sort((a, b) => {
                // Sort by name first, then by version
                const nameComparison = a[0].localeCompare(b[0]);
                return nameComparison !== 0 ? nameComparison : a[1].localeCompare(b[1]);
            });
    }

    // Check if index file exists
    async indexExists(): Promise<boolean> {
        return await fs.pathExists(this.indexPath);
    }
}
