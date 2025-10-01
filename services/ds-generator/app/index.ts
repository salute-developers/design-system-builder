import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({ bodyLimit: 10 * 1024 * 1024 });

import { generateRoute, healthCheckRoute, removeResultRoute } from './routes';

(async () => {
    await fastify.register(cors, {
        origin: '*',
    });

    await fastify.register(healthCheckRoute);
    await fastify.register(removeResultRoute);
    await fastify.register(generateRoute);

    fastify.listen({ port: 3000, host: '0.0.0.0' });
})();
