import { FastifyInstance } from 'fastify';
import fs from 'fs-extra';
import { GENERATE_ROOT_DIR } from '../utils';

export const removeResultRoute = async (server: FastifyInstance) => {
    server.get('/removeResult', async (_, reply) => {
        fs.rmSync(GENERATE_ROOT_DIR, { recursive: true, force: true });

        reply.code(200).send({ removed: 'ok' });
    });
};
