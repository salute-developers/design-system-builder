import fs from 'fs-extra';
import path from 'path';
import JSZip from 'jszip';

export const CORE_VERSION = '0.328.0-canary.1983.15896947411.0';

export const GENERATE_ROOT_DIR = './result';

// TODO: вынести в общее место
export const lowerFirstLetter = (str: string) => {
    return str.charAt(0).toLocaleLowerCase() + str.slice(1);
};

// TODO: вынести в общее место
export const upperFirstLetter = (str: string) => {
    return str.charAt(0).toLocaleUpperCase() + str.slice(1);
};

export const kebabToCamel = (str: string) => {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
};

export const camelToKebab = (str?: string) => {
    if (!str) {
        return '';
    }

    return str
        ?.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();
};

export const indentedLine = (content: string, indentLevel = 0, indentSize = 4, indentChar = ' ') => {
    const indent = indentChar.repeat(indentLevel * indentSize);
    return indent + content;
};

export const addFolderToZip = async (zip: JSZip, folderPath: string, zipFolder: JSZip): Promise<void> => {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
            const folder = zipFolder.folder(entry.name);
            if (folder) {
                await addFolderToZip(zip, fullPath, folder);
            }
        }

        if (entry.isFile()) {
            const data = await fs.readFile(fullPath);
            zipFolder.file(entry.name, data as unknown as Blob);
        }
    }
};
