import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyEnv from '@fastify/env';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
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

    // Swagger Documentation
    await app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'DustMite API',
          description: 'Autonomous treasury agent that moves idle USDC into yield-bearing tokens using AI decision-making',
          version: '1.0.0'
        },
        servers: [
          {
            url: 'http://localhost:3000',
            description: 'Development server'
          }
        ],
        tags: [
          { name: 'health', description: 'Health check endpoints' },
          { name: 'agent', description: 'Agent operations and status' },
          { name: 'admin', description: 'Administrative operations' }
        ]
      }
    });

    await app.register(fastifySwaggerUi, {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false
      },
      staticCSP: true
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
