import * as fs from 'fs-extra';
import * as path from 'path';
import { StoredComponentsData } from '../validation';
import { safeValidate, StoredComponentsDataSchema } from '../validation';

export class ComponentStore {
    private storageDir: string;
    private designSystemsDir: string;

    constructor(storageDir: string) {
        this.storageDir = storageDir;
        this.designSystemsDir = path.join(storageDir, 'design-systems');
        // Ensure design-systems directory exists
        fs.ensureDirSync(this.designSystemsDir);
    }

    private getComponentsFilePath(name: string, version: string): string {
        const fileName = `${name}@${version}.components.json`;
        return path.join(this.designSystemsDir, fileName);
    }

    async saveComponents(name: string, version: string, componentsData: any): Promise<void> {
        const savedAt = new Date().toISOString();
        
        const componentsFileData: StoredComponentsData = {
            componentsData,
            savedAt
        };

        const componentsFilePath = this.getComponentsFilePath(name, version);
        await fs.writeJson(componentsFilePath, componentsFileData, { spaces: 2 });

        console.log(`Saved components: ${name}@${version}`);
    }

    async loadComponents(name: string, version: string): Promise<any> {
        const componentsFilePath = this.getComponentsFilePath(name, version);

        const componentsExists = await fs.pathExists(componentsFilePath);
        if (!componentsExists) {
            throw new Error('Components data not found');
        }

        const componentsRawData = await fs.readJson(componentsFilePath);
        
        const componentsValidation = safeValidate(StoredComponentsDataSchema, componentsRawData);
        if (!componentsValidation.success) {
            console.error(`Invalid stored components data for ${name}@${version}:`, componentsValidation.errors);
            throw new Error('The stored components data does not match expected format');
        }

        const componentsData = componentsValidation.data!.componentsData;
        console.log(`Loaded components: ${name}@${version}`);
        return componentsData;
    }

    async deleteComponents(name: string, version: string): Promise<void> {
        const componentsFilePath = this.getComponentsFilePath(name, version);

        const componentsExists = await fs.pathExists(componentsFilePath);
        if (componentsExists) {
            await fs.remove(componentsFilePath);
            console.log(`Deleted components: ${name}@${version}`);
        }
    }

    async componentsExist(name: string, version: string): Promise<boolean> {
        const componentsFilePath = this.getComponentsFilePath(name, version);
        return fs.pathExists(componentsFilePath);
    }

    async listComponentFiles(): Promise<string[]> {
        const files = await fs.readdir(this.designSystemsDir);
        return files.filter((file: string) => file.endsWith('.components.json'));
    }

    // Method to manually corrupt component data for testing
    async corruptComponentsData(name: string, version: string, corruptedData: any): Promise<void> {
        const componentsFilePath = this.getComponentsFilePath(name, version);
        await fs.writeJson(componentsFilePath, corruptedData, { spaces: 2 });
    }
}
