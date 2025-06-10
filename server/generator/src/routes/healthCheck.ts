import { FastifyInstance } from 'fastify';

export const healthCheckRoute = async (server: FastifyInstance) => {
    server.get('/check', async (_, reply) => {
        reply.code(200).send({ health: 'ok' });
    });
};
