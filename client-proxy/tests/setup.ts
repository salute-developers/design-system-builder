import * as path from 'path';
import * as fs from 'fs-extra';
import { IndexStore } from '../src/store/indexStore';
import { BackendComponentStore } from '../src/store/backendComponents';
import createApp from '../src/app';

// Set test environment
process.env.NODE_ENV = 'test';

// Test storage directory
const TEST_STORAGE_DIR = path.join(__dirname, 'test-storage');

// Override the storage directory for tests
process.env.TEST_STORAGE_DIR = TEST_STORAGE_DIR;

// Set mock backend URL for tests to avoid calling real backend
process.env.BACKEND_URL = 'http://mock-backend-for-tests';

// Mock IndexStore for tests that uses local file storage instead of backend
export class MockIndexStore extends IndexStore {
    private indexPath: string;

    constructor(storageDir: string) {
        super(storageDir);
        this.indexPath = path.join(storageDir, 'index.json');
        // Ensure the index file exists
        this.ensureIndexExists();
    }

    private async ensureIndexExists(): Promise<void> {
        if (!(await fs.pathExists(this.indexPath))) {
            const emptyIndex = {
                designSystems: [],
                lastUpdated: new Date().toISOString()
            };
            await fs.writeJson(this.indexPath, emptyIndex, { spaces: 2 });
        }
    }

    async addToIndex(name: string, version: string): Promise<void> {
        const index = await this.loadFromLocalFile();
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

        index.lastUpdated = now;
        await fs.writeJson(this.indexPath, index, { spaces: 2 });
    }

    async removeFromIndex(name: string, version: string): Promise<void> {
        const index = await this.loadFromLocalFile();
        index.designSystems = index.designSystems.filter(
            ds => !(ds.name === name && ds.version === version)
        );
        index.lastUpdated = new Date().toISOString();
        await fs.writeJson(this.indexPath, index, { spaces: 2 });
    }

    async existsInIndex(name: string, version: string): Promise<boolean> {
        const index = await this.loadFromLocalFile();
        return index.designSystems.some(
            ds => ds.name === name && ds.version === version
        );
    }

    async listFromIndex(): Promise<Array<[string, string]>> {
        const index = await this.loadFromLocalFile();
        return index.designSystems
            .map(ds => [ds.name, ds.version] as [string, string])
            .sort((a, b) => {
                // Sort by name first, then by version
                const nameComparison = a[0].localeCompare(b[0]);
                return nameComparison !== 0 ? nameComparison : a[1].localeCompare(b[1]);
            });
    }

    // Helper method to load from local file
    private async loadFromLocalFile() {
        try {
            const indexData = await fs.readJson(this.indexPath);
            return indexData as {
                designSystems: Array<{
                    name: string;
                    version: string;
                    createdAt: string;
                    updatedAt: string;
                }>;
                lastUpdated: string;
            };
        } catch (error) {
            // Return empty index if file is corrupted
            return {
                designSystems: [],
                lastUpdated: new Date().toISOString()
            };
        }
    }
}

// Mock BackendComponentStore for tests that doesn't make real HTTP calls
export class MockBackendComponentStore {
    private storageDir: string;

    constructor(storageDir: string) {
        this.storageDir = storageDir;
    }

    async saveComponents(name: string, version: string, componentsData: any[]): Promise<void> {
        // Just save to local files instead of making HTTP calls
        const componentsFilePath = path.join(this.storageDir, 'design-systems', `${name}@${version}.components.json`);
        await fs.ensureDir(path.dirname(componentsFilePath));
        await fs.writeJson(componentsFilePath, {
            componentsData,
            savedAt: new Date().toISOString()
        });
    }

    async loadComponents(name: string, version: string): Promise<any[]> {
        const componentsFilePath = path.join(this.storageDir, 'design-systems', `${name}@${version}.components.json`);
        if (await fs.pathExists(componentsFilePath)) {
            const data = await fs.readJson(componentsFilePath);
            return data.componentsData || [];
        }
        throw new Error(`Components not found: ${name}@${version}`);
    }

    async deleteComponents(name: string, version: string): Promise<void> {
        const componentsFilePath = path.join(this.storageDir, 'design-systems', `${name}@${version}.components.json`);
        if (await fs.pathExists(componentsFilePath)) {
            await fs.remove(componentsFilePath);
        }
    }

    // Mock methods that would normally make HTTP calls
    async componentsExist(name: string, version: string): Promise<boolean> {
        const componentsFilePath = path.join(this.storageDir, 'design-systems', `${name}@${version}.components.json`);
        return await fs.pathExists(componentsFilePath);
    }

    async getDesignSystemId(name: string): Promise<number | null> {
        // Return a mock ID for tests
        return 1;
    }

    async ensureDesignSystemExists(name: string, version: string): Promise<number> {
        // Return a mock ID for tests
        return 1;
    }
}

// Create app with mock stores for tests
export function createTestApp(storageDir: string) {
    const mockIndexStore = new MockIndexStore(storageDir);
    const mockComponentStore = new MockBackendComponentStore(storageDir);
    return createApp(storageDir, mockIndexStore, mockComponentStore);
}
