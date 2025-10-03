import { FastifyInstance } from 'fastify';
import { CORE_VERSION, GENERATE_ROOT_DIR, addFolderToZip } from '../utils';
import { GenerateRouteBody } from '../types';
import pacote from 'pacote';
import { generateBaseFileStructure, generateComponentsFiles, generateThemeFiles } from '../generate';
import JSZip from 'jszip';
import fs from 'fs-extra';

export const generateRoute = async (server: FastifyInstance) => {
    server.post<{
        Body: GenerateRouteBody;
    }>('/generate', async (request, reply) => {
        const pathToDir = GENERATE_ROOT_DIR;

        let int1;

        try {
            int1 = setInterval(() => {
                reply.raw.write('ping');
            }, 10000);

            const { packageName, packageVersion, componentsMeta, themeSource, exportType } = request.body;

            reply.raw.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename=${packageName}@${packageVersion}.${exportType}`,
                'Access-Control-Allow-Origin': '*',
            });

            await generateBaseFileStructure({ pathToDir, packageName, packageVersion, coreVersion: CORE_VERSION });

            await generateThemeFiles({ pathToDir, packageName, packageVersion, themeSource });

            await generateComponentsFiles({ pathToDir, componentsMeta });

            let buffer;

            if (exportType === 'zip') {
                const zip = new JSZip();
                await addFolderToZip(zip, pathToDir, zip);
                buffer = await zip.generateAsync({ type: 'nodebuffer' });
            } else if (exportType === 'tgz') {
                buffer = await pacote.tarball(pathToDir);
            }

            reply.raw.write(buffer);

            clearInterval(int1);

            reply.raw.end('Stream finished');
        } catch (err) {
            clearInterval(int1);

            console.error(err);

            reply.raw.end('Stream broken');
        } finally {
            fs.rmSync(pathToDir, { recursive: true, force: true });
        }
    });
};
