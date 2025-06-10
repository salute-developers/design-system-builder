import { fastify } from 'fastify';
import cors from '@fastify/cors';

import { generateRoute, healthCheckRoute } from './routes';

const server = fastify({
    bodyLimit: 10 * 1024 * 1024,
});
await server.register(cors);
await server.register(healthCheckRoute);
await server.register(generateRoute);

server.listen({ port: 3000 });
