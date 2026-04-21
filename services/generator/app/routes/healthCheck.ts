import { FastifyInstance } from 'fastify';

const timeStart = new Date().toLocaleString();

export const healthCheckRoute = async (server: FastifyInstance) => {
    server.get('/health', async (_, reply) => {
        reply.code(200).send({ health: 'ok', startedAt: timeStart });
    });
};
