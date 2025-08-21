import * as fs from 'fs-extra';
import * as path from 'path';
import { StoredThemeData } from '../validation';
import { safeValidate, StoredThemeDataSchema } from '../validation';

export class ThemeStore {
    private storageDir: string;
    private designSystemsDir: string;

    constructor(storageDir: string) {
        this.storageDir = storageDir;
        this.designSystemsDir = path.join(storageDir, 'design-systems');
        // Ensure design-systems directory exists
        fs.ensureDirSync(this.designSystemsDir);
    }

    private getThemeFilePath(name: string, version: string): string {
        const fileName = `${name}@${version}.theme.json`;
        return path.join(this.designSystemsDir, fileName);
    }

    async saveTheme(name: string, version: string, themeData: any): Promise<void> {
        const savedAt = new Date().toISOString();
        
        const themeFileData: StoredThemeData = {
            themeData,
            savedAt
        };

        const themeFilePath = this.getThemeFilePath(name, version);
        await fs.writeJson(themeFilePath, themeFileData, { spaces: 2 });

        console.log(`Saved theme: ${name}@${version}`);
    }

    async loadTheme(name: string, version: string): Promise<any> {
        const themeFilePath = this.getThemeFilePath(name, version);

        const themeExists = await fs.pathExists(themeFilePath);
        if (!themeExists) {
            throw new Error('Theme data not found');
        }

        const themeRawData = await fs.readJson(themeFilePath);
        
        const themeValidation = safeValidate(StoredThemeDataSchema, themeRawData);
        if (!themeValidation.success) {
            console.error(`Invalid stored theme data for ${name}@${version}:`, themeValidation.errors);
            throw new Error('The stored theme data does not match expected format');
        }

        const themeData = themeValidation.data!.themeData;
        console.log(`Loaded theme: ${name}@${version}`);
        return themeData;
    }

    async deleteTheme(name: string, version: string): Promise<void> {
        const themeFilePath = this.getThemeFilePath(name, version);

        const themeExists = await fs.pathExists(themeFilePath);
        if (themeExists) {
            await fs.remove(themeFilePath);
            console.log(`Deleted theme: ${name}@${version}`);
        }
    }

    async themeExists(name: string, version: string): Promise<boolean> {
        const themeFilePath = this.getThemeFilePath(name, version);
        return fs.pathExists(themeFilePath);
    }

    async listThemeFiles(): Promise<string[]> {
        const files = await fs.readdir(this.designSystemsDir);
        return files.filter((file: string) => file.endsWith('.theme.json'));
    }

    // Method to manually corrupt theme data for testing
    async corruptThemeData(name: string, version: string, corruptedData: any): Promise<void> {
        const themeFilePath = this.getThemeFilePath(name, version);
        await fs.writeJson(themeFilePath, corruptedData, { spaces: 2 });
    }
}
