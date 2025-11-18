import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({ bodyLimit: 10 * 1024 * 1024 });

import { healthCheckRoute, removeResultRoute, generateAndDownloadRoute, generateAndPublishRoute } from './routes';

(async () => {
    await fastify.register(cors, {
        origin: '*',
    });

    await fastify.register(healthCheckRoute);
    await fastify.register(removeResultRoute);
    await fastify.register(generateAndDownloadRoute);
    await fastify.register(generateAndPublishRoute);

    fastify.listen({ port: 3005, host: '0.0.0.0' });
})();
