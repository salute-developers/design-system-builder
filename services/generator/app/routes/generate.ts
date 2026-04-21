import { FastifyInstance } from 'fastify';
import fs from 'fs-extra';

import { DB_SERVICE_URL, CORE_VERSION, GENERATE_ROOT_DIR, PUBLISHER_URL } from '../utils';
import { GenerateRouteBody } from '../types';
import { generateDesignSystem } from '../generate';
import stream from 'stream';
import { ThemeSource } from '../themeBuilder/types';
import { Meta } from '../componentBuilder';

export const generateAndDownloadRoute = async (server: FastifyInstance) => {
    server.post<{
        Body: GenerateRouteBody;
    }>('/generate-download', async (request, reply) => {
        const pathToDir = GENERATE_ROOT_DIR;

        try {
            const { packageName, packageVersion = '0.1.0', exportType, authToken } = request.body;

            const headers: Record<string, string> = {};
            if (authToken) {
                headers['Authorization'] = `Basic ${authToken}`;
            }

            const themeData = (await fetch(`${DB_SERVICE_URL}/legacy/design-systems/${packageName}/theme-data`, {
                headers,
            }).then((response) => response.json())) as unknown as ThemeSource;

            const componentsData = (await fetch(
                `${DB_SERVICE_URL}/legacy/design-systems/${packageName}/component-configs`,
                {
                    headers,
                },
            ).then((response) => response.json())) as unknown as Meta[];

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

const bumpPathVersion = (version: string) => {
    const [major, minor, patch] = version.split('.');
    return `${major}.${minor}.${Number(patch) + 1}`;
};

export const generateAndPublishRoute = async (server: FastifyInstance) => {
    server.post<{
        Body: GenerateRouteBody;
    }>('/generate-publish', async (request, reply) => {
        const pathToDir = GENERATE_ROOT_DIR;

        try {
            const { packageName, packageVersion = '0.1.0', exportType, npmToken, authToken } = request.body;

            const npmPackage = await fetch(`https://registry.npmjs.org/@salutejs-ds/${packageName}`);
            const packageMeta = (await npmPackage.json()) as any;

            const version = 'error' in packageMeta ? packageVersion : bumpPathVersion(packageMeta['dist-tags'].latest);

            if (!npmToken) {
                throw new Error('Отсутствует npm-токен');
            }

            const headers: Record<string, string> = {};
            if (authToken) {
                headers['Authorization'] = `Basic ${authToken}`;
            }

            const themeData = (await fetch(`${DB_SERVICE_URL}/legacy/design-systems/${packageName}/theme-data`, {
                headers,
            }).then((response) => response.json())) as unknown as ThemeSource;
            const componentsData = (await fetch(
                `${DB_SERVICE_URL}/legacy/design-systems/${packageName}/component-configs`,
                {
                    headers,
                },
            ).then((response) => response.json())) as unknown as Meta[];

            const buffer = await generateDesignSystem(
                { packageName, packageVersion: version, componentsData, themeData },
                { pathToDir, exportType, coreVersion: CORE_VERSION },
            );

            const formData = new FormData();
            formData.append('npmToken', npmToken);
            const blob = new Blob([buffer], { type: 'application/gzip' });
            formData.append('package', blob, 'package.tgz');
            formData.append('packageName', packageName);
            formData.append('packageVersion', version);

            const response = await fetch(`${PUBLISHER_URL}/upload`, {
                method: 'POST',
                body: formData,
            });

            const publishResponse = await response.json();

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
