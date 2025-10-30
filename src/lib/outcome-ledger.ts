/**
 * Outcome Ledger
 * Records orchestration outcomes for observability and debugging
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import type { Orchestrator, OrchestrationPlan } from './orchestrator.js';
import type { CommandResponse } from '../types/index.js';

export interface OutcomeRecord {
  id: string;
  timestamp: string;
  type: 'orchestration' | 'phase' | 'agent';
  event: string;
  orchestrationId: string;
  data: {
    phase?: 'plan' | 'implement' | 'validate';
    agent?: string;
    plan?: OrchestrationPlan;
    result?: CommandResponse;
    error?: string;
    duration_ms?: number;
    tasks?: string[];
    flow?: string;
  };
}

export interface OutcomeSummary {
  id: string;
  timestamp: string;
  feature: string;
  success: boolean;
  duration_ms: number;
  phases: {
    plan: { status: string; duration_ms?: number };
    implement: { status: string; duration_ms?: number };
    validate: { status: string; duration_ms?: number };
  };
  error?: string;
}

export class OutcomeLedger {
  private records: OutcomeRecord[] = [];
  private ledgerPath: string;
  private currentOrchestrationId: string | null = null;
  private phaseStartTimes: Map<string, number> = new Map();

  constructor(ledgerDir = 'ledger') {
    this.ledgerPath = join(process.cwd(), ledgerDir);
    this.ensureLedgerDir();
    this.loadLedger();
  }

  /**
   * Attach ledger to orchestrator event emitter
   */
  attach(orchestrator: Orchestrator): void {
    orchestrator.on('orchestration:start', (data) => {
      this.currentOrchestrationId = nanoid();
      this.recordEvent('orchestration', 'orchestration:start', {
        plan: data.plan,
      });
    });

    orchestrator.on('phase:start', (data) => {
      const phase = data.phase as 'plan' | 'implement' | 'validate';
      this.phaseStartTimes.set(phase, Date.now());
      this.recordEvent('phase', 'phase:start', {
        phase,
      });
    });

    orchestrator.on('phase:complete', (data) => {
      const phase = data.phase as 'plan' | 'implement' | 'validate';
      const startTime = this.phaseStartTimes.get(phase);
      const duration_ms = startTime ? Date.now() - startTime : undefined;

      this.recordEvent('phase', 'phase:complete', {
        phase,
        result: data.result,
        duration_ms,
      });

      this.phaseStartTimes.delete(phase);
    });

    orchestrator.on('agent:start', (data) => {
      this.recordEvent('agent', 'agent:start', {
        agent: data.agent,
        tasks: data.tasks,
        flow: data.flow,
      });
    });

    orchestrator.on('agent:complete', (data) => {
      this.recordEvent('agent', 'agent:complete', {
        agent: data.agent,
        result: data.result,
      });
    });

    orchestrator.on('orchestration:complete', (data) => {
      this.recordEvent('orchestration', 'orchestration:complete', {
        result: data.result.success,
        duration_ms: data.result.duration_ms,
      });
      this.currentOrchestrationId = null;
      this.persist();
    });

    orchestrator.on('orchestration:error', (data) => {
      this.recordEvent('orchestration', 'orchestration:error', {
        error: data.error,
      });
      this.currentOrchestrationId = null;
      this.persist();
    });
  }

  /**
   * Record an event
   */
  private recordEvent(
    type: 'orchestration' | 'phase' | 'agent',
    event: string,
    data: OutcomeRecord['data']
  ): void {
    const record: OutcomeRecord = {
      id: nanoid(),
      timestamp: new Date().toISOString(),
      type,
      event,
      orchestrationId: this.currentOrchestrationId || 'unknown',
      data,
    };

    this.records.push(record);
    console.log(`[Ledger] Recorded: ${event} (orchestration: ${record.orchestrationId})`);
  }

  /**
   * Get all records
   */
  getAllRecords(): OutcomeRecord[] {
    return [...this.records];
  }

  /**
   * Get records for a specific orchestration
   */
  getOrchestrationRecords(orchestrationId: string): OutcomeRecord[] {
    return this.records.filter((r) => r.orchestrationId === orchestrationId);
  }

  /**
   * Get summary of all orchestrations
   */
  getSummaries(): OutcomeSummary[] {
    const orchestrationIds = new Set(this.records.map((r) => r.orchestrationId));
    const summaries: OutcomeSummary[] = [];

    for (const orchId of orchestrationIds) {
      if (orchId === 'unknown') continue;

      const records = this.getOrchestrationRecords(orchId);
      const startRecord = records.find((r) => r.event === 'orchestration:start');
      const completeRecord = records.find((r) => r.event === 'orchestration:complete');
      const errorRecord = records.find((r) => r.event === 'orchestration:error');

      if (!startRecord) continue;

      const planPhase = records.filter((r) => r.type === 'phase' && r.data.phase === 'plan');
      const implementPhase = records.filter((r) => r.type === 'phase' && r.data.phase === 'implement');
      const validatePhase = records.filter((r) => r.type === 'phase' && r.data.phase === 'validate');

      const summary: OutcomeSummary = {
        id: orchId,
        timestamp: startRecord.timestamp,
        feature: startRecord.data.plan?.feature || 'unknown',
        success: Boolean(completeRecord?.data.result),
        duration_ms: completeRecord?.data.duration_ms || 0,
        phases: {
          plan: {
            status: planPhase.find((r) => r.event === 'phase:complete')?.data.result?.status || 'not run',
            duration_ms: planPhase.find((r) => r.event === 'phase:complete')?.data.duration_ms,
          },
          implement: {
            status: implementPhase.find((r) => r.event === 'phase:complete')?.data.result?.status || 'not run',
            duration_ms: implementPhase.find((r) => r.event === 'phase:complete')?.data.duration_ms,
          },
          validate: {
            status: validatePhase.find((r) => r.event === 'phase:complete')?.data.result?.status || 'not run',
            duration_ms: validatePhase.find((r) => r.event === 'phase:complete')?.data.duration_ms,
          },
        },
        error: errorRecord?.data.error,
      };

      summaries.push(summary);
    }

    return summaries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Get most recent orchestration summary
   */
  getLatestSummary(): OutcomeSummary | null {
    const summaries = this.getSummaries();
    return summaries.length > 0 ? summaries[0] : null;
  }

  /**
   * Clear all records (for testing)
   */
  clear(): void {
    this.records = [];
    this.persist();
  }

  /**
   * Persist ledger to disk
   */
  private persist(): void {
    const ledgerFile = join(this.ledgerPath, 'outcomes.json');
    writeFileSync(ledgerFile, JSON.stringify(this.records, null, 2));
  }

  /**
   * Load ledger from disk
   */
  private loadLedger(): void {
    const ledgerFile = join(this.ledgerPath, 'outcomes.json');

    if (existsSync(ledgerFile)) {
      try {
        const data = readFileSync(ledgerFile, 'utf-8');
        this.records = JSON.parse(data) as OutcomeRecord[];
        console.log(`[Ledger] Loaded ${this.records.length} records from disk`);
      } catch (error) {
        console.error('[Ledger] Failed to load ledger from disk:', error);
        this.records = [];
      }
    }
  }

  /**
   * Ensure ledger directory exists
   */
  private ensureLedgerDir(): void {
    if (!existsSync(this.ledgerPath)) {
      mkdirSync(this.ledgerPath, { recursive: true });
    }
  }
}
