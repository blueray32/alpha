import { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';
import { AgentRegistry } from '../lib/agent-registry.js';
import { RunManager } from '../lib/run-manager.js';
import { ValidationRunner } from '../lib/validation-runner.js';
import { ContractGuard } from '../lib/contract-guard.js';
import { GuardedWriter } from '../lib/guarded-writer.js';
import { CommandRequest, CommandResponse } from '../types/index.js';

const ajv = new Ajv();

interface EventBus {
  emit(event: string, data: unknown): void;
}

export async function commandRoutes(
  fastify: FastifyInstance,
  registry: AgentRegistry,
  runManager: RunManager,
  contractGuard: ContractGuard,
  validationRunner: ValidationRunner,
  eventBus: EventBus,
  guardedWriter: GuardedWriter
): Promise<void> {
  // Load schemas
  const schemas = {
    '/plan': JSON.parse(readFileSync(join(process.cwd(), 'slash/plan.schema.json'), 'utf-8')),
    '/build': JSON.parse(readFileSync(join(process.cwd(), 'slash/build.schema.json'), 'utf-8')),
    '/validate': JSON.parse(
      readFileSync(join(process.cwd(), 'slash/validate.schema.json'), 'utf-8')
    ),
  };

  fastify.post('/agents/:id/cmd', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cmdRequest = request.body as CommandRequest;

    // Get agent
    const agent = registry.getAgent(id);
    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    // Validate schema
    const schema = schemas[cmdRequest.slash as keyof typeof schemas];
    if (!schema) {
      return reply.code(400).send({ error: `Unknown command: ${cmdRequest.slash}` });
    }

    const validate = ajv.compile(schema);
    if (!validate(cmdRequest.payload)) {
      return reply.code(400).send({
        error: 'Invalid payload',
        details: validate.errors,
      });
    }

    const startTime = Date.now();
    registry.updateStatus(id, 'busy');

    eventBus.emit('command:start', {
      time: new Date().toISOString(),
      agent: agent.name,
      command: cmdRequest.slash,
      agentId: id,
    });

    try {
      let response: CommandResponse;

      switch (cmdRequest.slash) {
        case '/validate':
          response = await handleValidate(
            cmdRequest,
            agent.name,
            validationRunner,
            runManager
          );
          break;
        case '/build':
          response = await handleBuild(cmdRequest, agent.name, guardedWriter, eventBus);
          break;
        case '/plan':
          response = await handlePlan(cmdRequest, agent.name, runManager);
          break;
        default:
          response = {
            success: false,
            runPath: '',
            status: 'error',
            error: `Command ${cmdRequest.slash} not implemented`,
          };
      }

      const duration = Date.now() - startTime;
      const runPath = await runManager.createRun(
        agent.name,
        cmdRequest.slash,
        cmdRequest,
        response,
        duration
      );

      response.runPath = runManager.getRelativePath(runPath);

      eventBus.emit('command:end', {
        time: new Date().toISOString(),
        agent: agent.name,
        command: cmdRequest.slash,
        agentId: id,
        status: response.status,
        runPath: response.runPath,
        duration_ms: duration,
      });

      registry.updateStatus(id, 'idle');

      // Return 403 for contract violations
      if (response.status === 'denied') {
        return reply.code(403).send(response);
      }

      return reply.send(response);
    } catch (error) {
      registry.updateStatus(id, 'idle');
      const errorMsg = error instanceof Error ? error.message : String(error);

      eventBus.emit('command:error', {
        time: new Date().toISOString(),
        agent: agent.name,
        command: cmdRequest.slash,
        agentId: id,
        error: errorMsg,
      });

      return reply.code(500).send({
        success: false,
        status: 'error',
        error: errorMsg,
      });
    }
  });
}

async function handleValidate(
  request: CommandRequest,
  agentName: string,
  validationRunner: ValidationRunner,
  runManager: RunManager
): Promise<CommandResponse> {
  const { flow, env } = request.payload as { flow: string; env?: Record<string, string> };

  const flowPath = flow.endsWith('.yaml') ? flow : `checks/flows/${flow}.yaml`;
  const runId = Date.now().toString();

  const result = await validationRunner.runFlow(flowPath, env || {}, runId);

  return {
    success: result.success,
    runPath: '',
    status: result.success ? 'passed' : 'failed',
    message: result.error || `Completed ${result.completedSteps}/${result.steps} steps`,
    artifacts: result.screenshots,
  };
}

async function handleBuild(
  request: CommandRequest,
  agentName: string,
  guardedWriter: GuardedWriter,
  eventBus: EventBus
): Promise<CommandResponse> {
  const payload = request.payload as {
    files?: Array<{ path: string; content: string }>;
    feature?: string;
    tasks?: string[];
  };

  const { files, feature, tasks } = payload;

  // If no files provided, just acknowledge the build intent
  if (!files || files.length === 0) {
    return {
      success: true,
      runPath: '',
      status: 'completed',
      message: `Build acknowledged for: ${feature || 'feature'}. Tasks: ${tasks?.join(', ') || 'none specified'}`,
    };
  }

  // Attempt to write files with contract guard
  const result = await guardedWriter.writeFilesWithGuard(agentName, files);

  if (!result.success) {
    // Emit SSE event for denied write
    eventBus.emit('write:denied', {
      time: new Date().toISOString(),
      agent: agentName,
      status: 'denied',
      violations: result.violations,
      attemptedFiles: files.map((f) => f.path),
    });

    return {
      success: false,
      runPath: '',
      status: 'denied',
      error: `Contract violations: ${result.violations.join('; ')}`,
      violations: result.violations,
    };
  }

  // Success - emit event
  eventBus.emit('write:success', {
    time: new Date().toISOString(),
    agent: agentName,
    status: 'completed',
    filesWritten: files.map((f) => f.path),
  });

  return {
    success: true,
    runPath: '',
    status: 'completed',
    message: `Built ${files.length} file(s) successfully`,
    artifacts: files.map((f) => f.path),
  };
}

async function handlePlan(
  request: CommandRequest,
  agentName: string,
  runManager: RunManager
): Promise<CommandResponse> {
  // Stub implementation
  return {
    success: true,
    runPath: '',
    status: 'completed',
    message: 'Plan command acknowledged (stub implementation)',
  };
}
