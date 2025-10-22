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

        try {
            const { packageName, packageVersion, exportType } = request.body;

            const data = await fetch(
                `${BASE_URL}/design-systems/${encodeURIComponent(packageName)}/${encodeURIComponent(packageVersion)}`,
            );

            const { componentsData, themeData } = (await data.json()) as any;

            const buffer = await generateDesignSystem(
                { packageName, packageVersion, componentsData, themeData },
                { pathToDir, exportType, coreVersion: CORE_VERSION },
            );

            // Создаем stream из буфера
            const stream = require('stream');
            const readable = new stream.Readable();
            readable.push(buffer);
            readable.push(null);

            reply.header('Content-Type', 'application/octet-stream');
            reply.header(
                'Content-Disposition',
                `attachment; filename="${packageName}@${packageVersion}.${exportType}"`,
            );
            reply.header('Content-Length', buffer.length);
            reply.header('Access-Control-Allow-Origin', '*');

            return readable;
        } catch (err) {
            console.error(err);
            reply.status(500).send({
                error: 'Generation failed',
                message: err instanceof Error ? err.message : 'Unknown error',
            });
        } finally {
            fs.rmSync(pathToDir, { recursive: true, force: true });
        }
    });
};
