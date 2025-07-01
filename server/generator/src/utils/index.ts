import fs from 'fs-extra';
import path from 'path';
import JSZip from 'jszip';
import pacote from 'pacote';

import { GenerateRouteBodyResponse } from '../types';

export const CORE_VERSION = '0.326.0-canary.1983.15343210393.0';

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

export const indentedLine = (content: string, indentLevel = 0, indentSize = 4, indentChar = ' ') => {
    const indent = indentChar.repeat(indentLevel * indentSize);
    return indent + content;
};

const addFolderToZip = async (zip: JSZip, folderPath: string, zipFolder: JSZip): Promise<void> => {
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

export const createAndSendZipSource = async ({
    packageName,
    packageVersion,
    pathToDir,
    reply,
}: GenerateRouteBodyResponse) => {
    const zip = new JSZip();
    await addFolderToZip(zip, pathToDir, zip);
    const stream = await zip.generateAsync({ type: 'nodebuffer' });

    reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename=${packageName}@${packageVersion}.zip`)
        .send(stream);

    fs.rmSync(pathToDir, { recursive: true, force: true });
};

export const createAndSendTgzSource = async ({
    packageName,
    packageVersion,
    pathToDir,
    reply,
}: GenerateRouteBodyResponse) => {
    await pacote.tarball.stream(pathToDir, (stream) => {
        reply
            .header('Content-Type', 'application/octet-stream')
            .header('Content-Disposition', `attachment; filename=${packageName}@${packageVersion}.tgz`)
            .send(stream);

        return new Promise((resolve, reject) => {
            stream.on('end', (value: undefined) => {
                fs.rmSync(pathToDir, { recursive: true, force: true });
                resolve(value);
            });
            stream.on('error', (error: string) => {
                console.log('error', error);
                reject(error);
            });
        });
    });
};
