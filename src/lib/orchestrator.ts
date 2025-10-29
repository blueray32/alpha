/**
 * Orchestrator Service
 * Executes the P→I→V loop (Plan → Implement → Validate)
 */

import EventEmitter from 'events';
import { CommandRequest, CommandResponse } from '../types/index.js';

export interface OrchestrationPlan {
  feature: string;
  agents: {
    forge?: {
      tasks: string[];
      files?: string[];
    };
    blink?: {
      tasks: string[];
      files?: string[];
    };
    qaLens?: {
      flow: string;
      env?: Record<string, string>;
    };
  };
}

export interface OrchestrationResult {
  success: boolean;
  plan?: CommandResponse;
  build?: CommandResponse;
  validate?: CommandResponse;
  error?: string;
  duration_ms?: number;
}

export class Orchestrator extends EventEmitter {
  private apiBase: string;

  constructor(apiBase = 'http://localhost:3001') {
    super();
    this.apiBase = apiBase;
  }

  /**
   * Execute full P→I→V loop
   */
  async execute(plan: OrchestrationPlan): Promise<OrchestrationResult> {
    const startTime = Date.now();

    this.emit('orchestration:start', { plan });

    try {
      // Step 1: Plan
      this.emit('phase:start', { phase: 'plan' });
      const planResult = await this.executePlan(plan);
      this.emit('phase:complete', { phase: 'plan', result: planResult });

      if (!planResult.success) {
        return {
          success: false,
          plan: planResult,
          error: 'Planning failed',
          duration_ms: Date.now() - startTime,
        };
      }

      // Step 2: Implement (Build)
      this.emit('phase:start', { phase: 'implement' });
      const buildResult = await this.executeBuild(plan);
      this.emit('phase:complete', { phase: 'implement', result: buildResult });

      if (!buildResult.success) {
        return {
          success: false,
          plan: planResult,
          build: buildResult,
          error: 'Build failed',
          duration_ms: Date.now() - startTime,
        };
      }

      // Step 3: Validate
      this.emit('phase:start', { phase: 'validate' });
      const validateResult = await this.executeValidate(plan);
      this.emit('phase:complete', { phase: 'validate', result: validateResult });

      const success = validateResult.success;
      const result: OrchestrationResult = {
        success,
        plan: planResult,
        build: buildResult,
        validate: validateResult,
        duration_ms: Date.now() - startTime,
      };

      if (!success) {
        result.error = 'Validation failed';
      }

      this.emit('orchestration:complete', { result });
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.emit('orchestration:error', { error: errorMsg });

      return {
        success: false,
        error: errorMsg,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute planning phase
   */
  private async executePlan(plan: OrchestrationPlan): Promise<CommandResponse> {
    // For now, acknowledge the plan
    // In future, this could call an AI to refine the plan
    return {
      success: true,
      runPath: '',
      status: 'completed',
      message: `Planned feature: ${plan.feature}`,
    };
  }

  /**
   * Execute build phase (Forge + Blink)
   */
  private async executeBuild(plan: OrchestrationPlan): Promise<CommandResponse> {
    const buildResults: string[] = [];

    // Build with Forge if needed
    if (plan.agents.forge) {
      this.emit('agent:start', { agent: 'Forge', tasks: plan.agents.forge.tasks });

      const forgeResult = await this.sendCommand('Forge', '/build', {
        feature: plan.feature,
        tasks: plan.agents.forge.tasks,
        // Note: files would be added here if we had actual file content
        // For now, just acknowledge the build tasks
      });

      buildResults.push(`Forge: ${forgeResult.status}`);
      this.emit('agent:complete', { agent: 'Forge', result: forgeResult });

      if (!forgeResult.success) {
        return forgeResult;
      }
    }

    // Build with Blink if needed
    if (plan.agents.blink) {
      this.emit('agent:start', { agent: 'Blink', tasks: plan.agents.blink.tasks });

      const blinkResult = await this.sendCommand('Blink', '/build', {
        feature: plan.feature,
        tasks: plan.agents.blink.tasks,
        // Note: files would be added here if we had actual file content
        // For now, just acknowledge the build tasks
      });

      buildResults.push(`Blink: ${blinkResult.status}`);
      this.emit('agent:complete', { agent: 'Blink', result: blinkResult });

      if (!blinkResult.success) {
        return blinkResult;
      }
    }

    return {
      success: true,
      runPath: '',
      status: 'completed',
      message: buildResults.join(', '),
    };
  }

  /**
   * Execute validation phase (QA-Lens)
   */
  private async executeValidate(plan: OrchestrationPlan): Promise<CommandResponse> {
    if (!plan.agents.qaLens) {
      // No validation specified, consider it passed
      return {
        success: true,
        runPath: '',
        status: 'passed',
        message: 'No validation specified',
      };
    }

    this.emit('agent:start', { agent: 'QA-Lens', flow: plan.agents.qaLens.flow });

    const validateResult = await this.sendCommand('QA-Lens', '/validate', {
      flow: plan.agents.qaLens.flow,
      env: plan.agents.qaLens.env || {},
    });

    this.emit('agent:complete', { agent: 'QA-Lens', result: validateResult });

    return validateResult;
  }

  /**
   * Send command to agent via API
   */
  private async sendCommand(
    agentName: string,
    slash: string,
    payload: unknown
  ): Promise<CommandResponse> {
    // First, ensure agent exists
    const agentId = await this.getOrCreateAgent(agentName);

    const request: CommandRequest = { slash, payload };

    try {
      const response = await fetch(`${this.apiBase}/agents/${agentId}/cmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as CommandResponse;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        runPath: '',
        status: 'error',
        error: errorMsg,
      };
    }
  }

  /**
   * Get or create agent
   */
  private async getOrCreateAgent(agentName: string): Promise<string> {
    // Try to get existing agents
    try {
      const response = await fetch(`${this.apiBase}/agents`);
      if (response.ok) {
        const agents = (await response.json()) as Array<{ id: string; name: string }>;
        const existing = agents.find((a) => a.name === agentName);
        if (existing) {
          return existing.id;
        }
      }
    } catch {
      // Continue to creation
    }

    // Create new agent
    const type = agentName === 'QA-Lens' ? 'validator' : 'builder';
    const response = await fetch(`${this.apiBase}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: agentName, type }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create agent ${agentName}`);
    }

    const agent = (await response.json()) as { id: string };
    return agent.id;
  }
}
