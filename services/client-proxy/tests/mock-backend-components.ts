import * as fs from 'fs-extra';
import * as path from 'path';
import { DesignSystemData } from '../src/validation';

export class MockBackendComponentStore {
    private storageDir: string;

    constructor(storageDir?: string) {
        this.storageDir = storageDir || path.join(__dirname, 'test-storage');
    }

    async saveComponents(name: string, version: string, componentsData: DesignSystemData['componentsData']): Promise<void> {
        console.log(`🔄 [MOCK] Saving components to backend: ${name}@${version}`);
        
        // Also save to local file for tests in the expected format
        const componentsFilePath = path.join(this.storageDir, 'design-systems', `${name}@${version}.components.json`);
        await fs.ensureDir(path.dirname(componentsFilePath));
        
        const componentsFileData = {
            componentsData: componentsData,
            savedAt: new Date().toISOString()
        };
        
        await fs.writeJson(componentsFilePath, componentsFileData, { spaces: 2 });
        
        return Promise.resolve();
    }

    async componentsExist(name: string, version: string): Promise<boolean> {
        console.log(`🔍 [MOCK] Checking if components exist: ${name}@${version}`);
        // Mock implementation - always return true for tests
        return Promise.resolve(true);
    }

    async deleteComponents(name: string, version: string): Promise<void> {
        console.log(`🗑️ [MOCK] Deleting components from backend: ${name}@${version}`);
        // Mock implementation - just log and return success
        return Promise.resolve();
    }

    async loadComponents(name: string, version: string): Promise<DesignSystemData['componentsData']> {
        console.log(`📥 [MOCK] Loading components from backend: ${name}@${version}`);
        
        // Load from local file for tests
        const componentsFilePath = path.join(this.storageDir, 'design-systems', `${name}@${version}.components.json`);
        if (await fs.pathExists(componentsFilePath)) {
            const fileData = await fs.readJson(componentsFilePath);
            return fileData.componentsData || [];
        }
        
        return Promise.resolve([]);
    }
}
