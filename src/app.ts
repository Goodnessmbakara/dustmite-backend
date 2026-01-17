import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyEnv from '@fastify/env';
import routes from './routes';
import { startAgentLoop } from './worker/agentLoop';
import dotenv from 'dotenv';

dotenv.config();

const app: FastifyInstance = fastify({
  logger: true
});

const schema = {
  type: 'object',
  required: ['DATABASE_URL', 'CIRCLE_API_KEY'],
  properties: {
    PORT: {
      type: 'string',
      default: 3000
    },
    DATABASE_URL: {
      type: 'string'
    },
    CIRCLE_API_KEY: {
        type: 'string'
    }
  }
};

const options = {
  confKey: 'config',
  schema: schema,
  dotenv: true
};

const start = async () => {
  try {
    // Plugins
    await app.register(fastifyEnv, options);
    await app.register(cors, {
      origin: '*'
    });

    // Routes
    await app.register(routes);

    // Start Server
    const port = parseInt(process.env.PORT || '3000');
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening at http://localhost:${port}`);

    // Start Background Worker
    startAgentLoop();
    console.log('DustMite Agent Loop initialized.');

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
