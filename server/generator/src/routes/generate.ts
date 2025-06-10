import { FastifyInstance } from 'fastify';

import { generateBaseFileStructure, generateComponentsFiles, generateThemeFiles } from '../generate';
import { createAndSendTgzSource, createAndSendZipSource, GENERATE_ROOT_DIR, CORE_VERSION } from '../utils';
import { GenerateRouteBody } from '../types';

export const generateRoute = async (server: FastifyInstance) => {
    server.post<{
        Body: GenerateRouteBody;
    }>('/generate', async (request, reply) => {
        const { packageName, packageVersion, componentsMeta, themeSource, exportType } = request.body;

        const pathToDir = GENERATE_ROOT_DIR;

        await generateBaseFileStructure({ pathToDir, packageName, packageVersion, coreVersion: CORE_VERSION });

        await generateThemeFiles({ pathToDir, packageName, packageVersion, themeSource });

        await generateComponentsFiles({ pathToDir, componentsMeta });

        if (exportType === 'zip') {
            await createAndSendZipSource({ packageName, packageVersion, pathToDir, reply });
        }

        if (exportType === 'tgz') {
            await createAndSendTgzSource({ packageName, packageVersion, pathToDir, reply });
        }
    });
};
