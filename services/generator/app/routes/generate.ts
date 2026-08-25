import { FastifyInstance } from 'fastify';
import fs from 'fs-extra';

import { DB_SERVICE_URL, CORE_VERSION, GENERATE_ROOT_DIR, PUBLISHER_URL } from '../utils';
import { GenerateRouteBody } from '../types';
import { generateDesignSystem } from '../generate';
import stream from 'stream';
import { ThemeSource } from '../themeBuilder/types';
import { Meta } from '../componentBuilder';

const createGenerateWorkingDir = () => fs.mkdtemp(`${GENERATE_ROOT_DIR}-`);

const getErrorDetails = (error: unknown) => ({
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
});

const cleanupWorkingDir = async (requestId: string, pathToDir: string | null) => {
    if (!pathToDir) {
        return;
    }

    const startedAt = Date.now();

    try {
        await fs.remove(pathToDir);
        console.log('[generator:cleanup:success]', {
            requestId,
            pathToDir,
            durationMs: Date.now() - startedAt,
        });
    } catch (error) {
        console.error('[generator:cleanup:error]', {
            requestId,
            pathToDir,
            durationMs: Date.now() - startedAt,
            ...getErrorDetails(error),
        });
    }
};

export const generateAndDownloadRoute = async (server: FastifyInstance) => {
    server.post<{
        Body: GenerateRouteBody;
    }>('/generate-download', async (request, reply) => {
        const requestId = request.id;
        const requestStartedAt = Date.now();
        let pathToDir: string | null = null;

        try {
            pathToDir = await createGenerateWorkingDir();
            const { packageName, packageVersion = '0.1.0', exportType } = request.body;

            console.log('[generator:request:start]', {
                requestId,
                route: 'generate-download',
                upstreamRequestId: request.headers['x-request-id'],
                forwardedFor: request.headers['x-forwarded-for'],
                packageName,
                packageVersion,
                exportType,
                pathToDir,
            });

            const themeResponse = await fetch(`${DB_SERVICE_URL}/legacy/design-systems/${packageName}/theme-data`);
            console.log('[generator:source:theme]', {
                requestId,
                status: themeResponse.status,
                ok: themeResponse.ok,
            });
            const themeData = (await themeResponse.json()) as unknown as ThemeSource;

            const componentsResponse = await fetch(
                `${DB_SERVICE_URL}/legacy/design-systems/${packageName}/component-configs`,
            );
            console.log('[generator:source:components]', {
                requestId,
                status: componentsResponse.status,
                ok: componentsResponse.ok,
            });
            const componentsData = (await componentsResponse.json()) as unknown as Meta[];

            const buffer = await generateDesignSystem(
                { packageName, packageVersion, componentsData, themeData },
                { pathToDir, exportType, coreVersion: CORE_VERSION, requestId },
            );

            console.log('[generator:request:success]', {
                requestId,
                route: 'generate-download',
                packageName,
                packageVersion,
                exportType,
                bufferBytes: buffer.length,
                durationMs: Date.now() - requestStartedAt,
            });

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
            console.error('[generator:request:error]', {
                requestId,
                route: 'generate-download',
                pathToDir,
                durationMs: Date.now() - requestStartedAt,
                ...getErrorDetails(err),
            });
            reply.status(500).send({
                error: 'Generation failed',
                message: err instanceof Error ? err.message : 'Unknown error',
            });
        } finally {
            await cleanupWorkingDir(requestId, pathToDir);
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
        const requestId = request.id;
        const requestStartedAt = Date.now();
        let pathToDir: string | null = null;

        try {
            pathToDir = await createGenerateWorkingDir();
            const { packageName, packageVersion = '0.1.0', exportType, npmToken } = request.body;

            console.log('[generator:request:start]', {
                requestId,
                route: 'generate-publish',
                upstreamRequestId: request.headers['x-request-id'],
                forwardedFor: request.headers['x-forwarded-for'],
                packageName,
                requestedVersion: packageVersion,
                exportType,
                pathToDir,
                npmTokenProvided: Boolean(npmToken),
            });

            const npmPackage = await fetch(`https://registry.npmjs.org/@salutejs-ds/${packageName}`);
            const packageMeta = (await npmPackage.json()) as any;

            const version = 'error' in packageMeta ? packageVersion : bumpPathVersion(packageMeta['dist-tags'].latest);

            console.log('[generator:registry:metadata]', {
                requestId,
                status: npmPackage.status,
                ok: npmPackage.ok,
                packageExists: !('error' in packageMeta),
                requestedVersion: packageVersion,
                resolvedVersion: version,
            });

            if (!npmToken) {
                throw new Error('Отсутствует npm-токен');
            }

            const themeResponse = await fetch(`${DB_SERVICE_URL}/legacy/design-systems/${packageName}/theme-data`);
            console.log('[generator:source:theme]', {
                requestId,
                status: themeResponse.status,
                ok: themeResponse.ok,
            });
            const themeData = (await themeResponse.json()) as unknown as ThemeSource;

            const componentsResponse = await fetch(
                `${DB_SERVICE_URL}/legacy/design-systems/${packageName}/component-configs`,
            );
            console.log('[generator:source:components]', {
                requestId,
                status: componentsResponse.status,
                ok: componentsResponse.ok,
            });
            const componentsData = (await componentsResponse.json()) as unknown as Meta[];

            const buffer = await generateDesignSystem(
                { packageName, packageVersion: version, componentsData, themeData },
                { pathToDir, exportType, coreVersion: CORE_VERSION, requestId },
            );

            const formData = new FormData();
            formData.append('npmToken', npmToken);
            const blob = new Blob([buffer], { type: 'application/gzip' });
            formData.append('package', blob, 'package.tgz');
            formData.append('packageName', packageName);
            formData.append('packageVersion', version);
            formData.append('requestId', requestId);

            const publishStartedAt = Date.now();
            console.log('[generator:publish:start]', {
                requestId,
                packageName,
                version,
                bufferBytes: buffer.length,
            });

            const response = await fetch(`${PUBLISHER_URL}/upload`, {
                method: 'POST',
                body: formData,
            });

            const publishResponse = await response.json();

            console.log('[generator:publish:response]', {
                requestId,
                packageName,
                version,
                status: response.status,
                ok: response.ok,
                durationMs: Date.now() - publishStartedAt,
            });

            if (!response.ok) {
                throw new Error(JSON.stringify(publishResponse));
            }

            console.log('[generator:request:success]', {
                requestId,
                route: 'generate-publish',
                packageName,
                version,
                durationMs: Date.now() - requestStartedAt,
            });

            reply.status(200).send({
                message: publishResponse,
            });
        } catch (err) {
            console.error('[generator:request:error]', {
                requestId,
                route: 'generate-publish',
                pathToDir,
                durationMs: Date.now() - requestStartedAt,
                ...getErrorDetails(err),
            });

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
            await cleanupWorkingDir(requestId, pathToDir);
        }
    });
};
