import * as path from 'path';
import * as fs from 'fs-extra';
import { IndexStore } from '../src/store/indexStore';
import createApp from '../src/app';

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

// Create app with mock index store for tests
export function createTestApp(storageDir: string) {
    const mockIndexStore = new MockIndexStore(storageDir);
    return createApp(storageDir, mockIndexStore);
}
