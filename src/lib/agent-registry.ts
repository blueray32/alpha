import { Agent, AgentType } from '../types/index.js';
import { nanoid } from 'nanoid';

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();

  createAgent(name: string, type: AgentType, profile?: Record<string, unknown>): Agent {
    const id = `a_${this.agents.size + 1}`;
    const agent: Agent = {
      id,
      name,
      type,
      profile: profile || {},
      createdAt: new Date(),
      status: 'idle',
    };

    this.agents.set(id, agent);
    return agent;
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  updateStatus(id: string, status: Agent['status']): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;

    agent.status = status;
    this.agents.set(id, agent);
    return true;
  }

  deleteAgent(id: string): boolean {
    return this.agents.delete(id);
  }
}
