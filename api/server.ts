/**
 * TinyLink - URL Shortener Server
 * Owner: Forge
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { UrlStore } from './lib/url-store.js';
import { shortenRoutes } from './routes/shorten.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 5050;
const HOST = '0.0.0.0';

async function buildServer() {
  const fastify = Fastify({
    logger: true,
  });

  await fastify.register(cors, {
    origin: true,
  });

  // Serve static files from /ui
  await fastify.register(fastifyStatic, {
    root: join(__dirname, '..', 'ui'),
    prefix: '/ui/',
  });

  // Serve index.html at root
  fastify.get('/', async (request, reply) => {
    return reply.sendFile('index.html');
  });

  const urlStore = new UrlStore();

  // Register routes
  await shortenRoutes(fastify, urlStore);

  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      service: 'TinyLink',
      timestamp: new Date().toISOString(),
      urlCount: urlStore.getAll().length,
    };
  });

  return fastify;
}

// Start server
const fastify = await buildServer();

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`\n🔗 TinyLink running on http://${HOST}:${PORT}`);
  console.log(`📊 API docs: http://${HOST}:${PORT}/api/urls\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

export { buildServer };
