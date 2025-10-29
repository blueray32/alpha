import { FastifyInstance } from 'fastify';
import { AgentRegistry } from '../lib/agent-registry.js';
import { AgentType } from '../types/index.js';

export async function agentRoutes(
  fastify: FastifyInstance,
  registry: AgentRegistry
): Promise<void> {
  // Create agent
  fastify.post('/agents', async (request, reply) => {
    const body = request.body as {
      name: string;
      type: AgentType;
      profile?: Record<string, unknown>;
    };

    if (!body.name || !body.type) {
      return reply.code(400).send({
        error: 'Missing required fields: name, type',
      });
    }

    const agent = registry.createAgent(body.name, body.type, body.profile);
    return reply.code(201).send(agent);
  });

  // List agents
  fastify.get('/agents', async (_request, reply) => {
    const agents = registry.getAllAgents();
    return reply.send({ agents, count: agents.length });
  });

  // Get specific agent
  fastify.get('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = registry.getAgent(id);

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    return reply.send(agent);
  });
}
