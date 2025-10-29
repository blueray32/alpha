export type AgentType = 'builder' | 'validator' | 'research';

export type SlashCommand = '/plan' | '/build' | '/validate' | '/observe';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  profile?: Record<string, unknown>;
  createdAt: Date;
  status: 'active' | 'idle' | 'busy';
}

export interface CommandRequest {
  slash: SlashCommand;
  payload: Record<string, unknown>;
}

export interface CommandResponse {
  success: boolean;
  runPath: string;
  status: string;
  message?: string;
  artifacts?: string[];
  error?: string;
}

export interface RunMetadata {
  timestamp: string;
  agent: string;
  command: string;
  duration_ms: number;
  request: CommandRequest;
  response: CommandResponse;
}

export interface ScopeRule {
  write?: string[];
  read?: string[];
}

export interface ContractScopes {
  owners: Record<string, ScopeRule>;
  pre_merge_gates?: string[];
}

export interface ValidationFlow {
  name: string;
  steps: ValidationStep[];
}

export type ValidationStep =
  | { open: string }
  | { assert: string }
  | { type: { selector: string; text: string } }
  | { click: string }
  | { wait_for: string }
  | { screenshot: string };
