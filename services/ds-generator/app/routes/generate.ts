import { FastifyInstance } from 'fastify';
import fs from 'fs-extra';

import { BASE_URL, CORE_VERSION, GENERATE_ROOT_DIR, PUBLISHER_URL } from '../utils';
import { GenerateRouteBody } from '../types';
import { generateDesignSystem } from '../generate';
import stream from 'stream';

export const generateAndDownloadRoute = async (server: FastifyInstance) => {
    server.post<{
        Body: GenerateRouteBody;
    }>('/generate-download', async (request, reply) => {
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

export const generateAndPublishRoute = async (server: FastifyInstance) => {
    server.post<{
        Body: GenerateRouteBody;
    }>('/generate-publish', async (request, reply) => {
        const pathToDir = GENERATE_ROOT_DIR;

        try {
            const { packageName, packageVersion, exportType, npmToken } = request.body;

            if (!npmToken) {
                throw new Error('Отсутствует npm-токен');
            }

            const data = await fetch(
                `${BASE_URL}/design-systems/${encodeURIComponent(packageName)}/${encodeURIComponent(packageVersion)}`,
            );

            const { componentsData, themeData } = (await data.json()) as any;

            const buffer = await generateDesignSystem(
                { packageName, packageVersion, componentsData, themeData },
                { pathToDir, exportType, coreVersion: CORE_VERSION },
            );

            const formData = new FormData();
            formData.append('npmToken', npmToken);
            const blob = new Blob([buffer], { type: 'application/gzip' });
            formData.append('package', blob, 'package.tgz');

            const response = await fetch(`${PUBLISHER_URL}/upload`, {
                method: 'POST',
                body: formData,
            });

            const publishResponse = await response.json();

            // console.log('publishResponse', typeof publishResponse, publishResponse);

            if (!response.ok) {
                throw new Error(JSON.stringify(publishResponse));
            }

            console.log('Публикация прошла успешно:', publishResponse);

            reply.status(200).send({
                message: publishResponse,
            });
        } catch (err) {
            console.error(typeof err, err);

            if (err instanceof Error) {
                reply.status(500).send({
                    error: 'Generation failed',
                    message: err.message,
                });
            } else {
                reply.status(500).send({
                    message: 'Unexpected error type:' + err,
                });
            }
        } finally {
            fs.rmSync(pathToDir, { recursive: true, force: true });
        }
    });
};
