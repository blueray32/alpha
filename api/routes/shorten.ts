/**
 * TinyLink URL shortening routes
 * Owner: Forge
 */

import { FastifyInstance } from 'fastify';
import { UrlStore } from '../lib/url-store.js';

export async function shortenRoutes(fastify: FastifyInstance, urlStore: UrlStore) {
  // Create short URL
  fastify.post('/api/shorten', async (request, reply) => {
    const body = request.body as { url?: string };

    if (!body.url) {
      return reply.code(400).send({
        error: 'Missing required field: url',
      });
    }

    // Basic URL validation
    try {
      new URL(body.url);
    } catch {
      return reply.code(400).send({
        error: 'Invalid URL format',
      });
    }

    const shortUrl = urlStore.shorten(body.url);

    return reply.send({
      code: shortUrl.code,
      originalUrl: shortUrl.originalUrl,
      shortUrl: `http://localhost:5050/${shortUrl.code}`,
      createdAt: shortUrl.createdAt,
    });
  });

  // Redirect to original URL
  fastify.get('/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    // Skip API routes
    if (code === 'api' || code === 'health') {
      return reply.callNotFound();
    }

    const originalUrl = urlStore.getAndTrack(code);

    if (!originalUrl) {
      return reply.code(404).send({
        error: 'Short URL not found',
      });
    }

    return reply.redirect(302, originalUrl);
  });

  // Get stats for a short URL
  fastify.get('/api/stats/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    const stats = urlStore.getStats(code);

    if (!stats) {
      return reply.code(404).send({
        error: 'Short URL not found',
      });
    }

    return reply.send({
      code: stats.code,
      originalUrl: stats.originalUrl,
      clicks: stats.clicks,
      createdAt: stats.createdAt,
    });
  });

  // Debug: List all URLs
  fastify.get('/api/urls', async () => {
    return {
      urls: urlStore.getAll(),
      count: urlStore.getAll().length,
    };
  });
}
