import { FastifyInstance } from 'fastify';
import fs from 'fs-extra';

import { BASE_URL, CORE_VERSION, GENERATE_ROOT_DIR } from '../utils';
import { GenerateRouteBody } from '../types';
import { generateDesignSystem } from '../generate';

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

            const { packageName, packageVersion, exportType } = request.body;

            const data = await fetch(
                `${BASE_URL}/design-systems/${encodeURIComponent(packageName)}/${encodeURIComponent(packageVersion)}`,
            );

            const { componentsData, themeData } = (await data.json()) as any;

            reply.raw.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename=${packageName}@${packageVersion}.${exportType}`,
                'Access-Control-Allow-Origin': '*',
            });

            const buffer = await generateDesignSystem(
                { packageName, packageVersion, componentsData, themeData },
                { pathToDir, exportType, coreVersion: CORE_VERSION },
            );

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
