import Fastify from 'fastify';
import cors from '@fastify/cors';
import { join } from 'path';
import { EventEmitter } from 'events';
import { AgentRegistry } from './lib/agent-registry.js';
import { RunManager } from './lib/run-manager.js';
import { ContractGuard } from './lib/contract-guard.js';
import { ValidationRunner } from './lib/validation-runner.js';
import { agentRoutes } from './routes/agents.js';
import { commandRoutes } from './routes/commands.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = process.env.HOST || '0.0.0.0';

class EventBus extends EventEmitter {}

async function buildServer() {
  const fastify = Fastify({
    logger: true,
  });

  await fastify.register(cors, {
    origin: true,
  });

  // Initialize components
  const eventBus = new EventBus();
  const registry = new AgentRegistry();
  const runManager = new RunManager();
  const contractGuard = new ContractGuard(join(process.cwd(), 'contracts/scopes.yaml'));
  const validationRunner = new ValidationRunner();

  // SSE endpoint for Tower
  fastify.get('/events', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const sendEvent = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const handlers = {
      'command:start': sendEvent,
      'command:end': sendEvent,
      'command:error': sendEvent,
    };

    // Attach listeners
    Object.entries(handlers).forEach(([event, handler]) => {
      eventBus.on(event, handler);
    });

    // Send initial connection event
    sendEvent({
      type: 'connected',
      time: new Date().toISOString(),
      message: 'Connected to Alpha event stream',
    });

    // Cleanup on disconnect
    request.raw.on('close', () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        eventBus.off(event, handler);
      });
    });
  });

  // Register routes
  await agentRoutes(fastify, registry);
  await commandRoutes(fastify, registry, runManager, contractGuard, validationRunner, eventBus);

  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      agents: registry.getAllAgents().length,
    };
  });

  // Cleanup on shutdown
  const cleanup = async () => {
    await validationRunner.cleanup();
    await fastify.close();
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  return fastify;
}

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const fastify = await buildServer();

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 Alpha Orchestrator running on http://${HOST}:${PORT}`);
    console.log(`📊 Events stream: http://${HOST}:${PORT}/events\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

export { buildServer };
