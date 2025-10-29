/**
 * Recovery Hooks
 * Provides checkpointing and recovery for operations
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';

export interface Checkpoint {
  id: string;
  operation: string;
  timestamp: string;
  state: Record<string, unknown>;
  completedSteps: string[];
}

export interface RecoveryContext {
  checkpointId: string;
  operation: string;
  attemptNumber: number;
  lastError?: string;
}

export type RecoveryCallback = (context: RecoveryContext) => Promise<void>;

export class RecoveryHooks {
  private checkpointsDir: string;
  private recoveryCallbacks: Map<string, RecoveryCallback> = new Map();
  private activeCheckpoint: Checkpoint | null = null;

  constructor(checkpointsDir = 'memory/checkpoints') {
    this.checkpointsDir = join(process.cwd(), checkpointsDir);
    this.ensureCheckpointsDir();
  }

  /**
   * Create a checkpoint before a risky operation
   */
  createCheckpoint(operation: string, state: Record<string, unknown>): string {
    const checkpoint: Checkpoint = {
      id: nanoid(),
      operation,
      timestamp: new Date().toISOString(),
      state,
      completedSteps: [],
    };

    this.activeCheckpoint = checkpoint;
    this.saveCheckpoint(checkpoint);

    console.log(`[Recovery] Created checkpoint: ${checkpoint.id} for operation: ${operation}`);
    return checkpoint.id;
  }

  /**
   * Mark a step as completed in the current checkpoint
   */
  markStepCompleted(step: string): void {
    if (!this.activeCheckpoint) {
      console.warn('[Recovery] No active checkpoint');
      return;
    }

    this.activeCheckpoint.completedSteps.push(step);
    this.saveCheckpoint(this.activeCheckpoint);
    console.log(`[Recovery] Step completed: ${step}`);
  }

  /**
   * Commit checkpoint (operation succeeded)
   */
  commitCheckpoint(checkpointId: string): void {
    if (this.activeCheckpoint?.id === checkpointId) {
      this.activeCheckpoint = null;
    }

    // Optionally delete checkpoint file on success
    // For now, we keep them for audit purposes
    console.log(`[Recovery] Checkpoint committed: ${checkpointId}`);
  }

  /**
   * Rollback to a checkpoint (operation failed)
   */
  async rollbackToCheckpoint(checkpointId: string, error: Error): Promise<void> {
    const checkpoint = this.loadCheckpoint(checkpointId);

    if (!checkpoint) {
      console.error(`[Recovery] Checkpoint ${checkpointId} not found`);
      return;
    }

    console.log(`[Recovery] Rolling back to checkpoint: ${checkpointId}`);
    console.log(`[Recovery] Completed steps: ${checkpoint.completedSteps.join(', ')}`);
    console.log(`[Recovery] Error: ${error.message}`);

    // Execute recovery callback if registered
    const callback = this.recoveryCallbacks.get(checkpoint.operation);
    if (callback) {
      const context: RecoveryContext = {
        checkpointId,
        operation: checkpoint.operation,
        attemptNumber: 1,
        lastError: error.message,
      };

      try {
        await callback(context);
        console.log(`[Recovery] Recovery callback executed successfully`);
      } catch (recoveryError) {
        console.error(`[Recovery] Recovery callback failed:`, recoveryError);
      }
    }
  }

  /**
   * Register a recovery callback for an operation type
   */
  registerRecoveryCallback(operation: string, callback: RecoveryCallback): void {
    this.recoveryCallbacks.set(operation, callback);
    console.log(`[Recovery] Registered recovery callback for: ${operation}`);
  }

  /**
   * Execute with automatic checkpointing and recovery
   */
  async executeWithRecovery<T>(
    operation: string,
    state: Record<string, unknown>,
    fn: (checkpoint: Checkpoint) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const checkpointId = this.createCheckpoint(operation, { ...state, attempt });

      try {
        const result = await fn(this.activeCheckpoint!);
        this.commitCheckpoint(checkpointId);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[Recovery] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

        await this.rollbackToCheckpoint(checkpointId, lastError);

        if (attempt < maxRetries) {
          // Exponential backoff
          const delayMs = Math.pow(2, attempt) * 1000;
          console.log(`[Recovery] Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * List all checkpoints
   */
  listCheckpoints(): Checkpoint[] {
    if (!existsSync(this.checkpointsDir)) {
      return [];
    }

    const files = readdirSync(this.checkpointsDir).filter((f: string) => f.endsWith('.json'));

    return files
      .map((file: string) => {
        try {
          const data = readFileSync(join(this.checkpointsDir, file), 'utf-8');
          return JSON.parse(data) as Checkpoint;
        } catch {
          return null;
        }
      })
      .filter((c: Checkpoint | null): c is Checkpoint => c !== null)
      .sort((a: Checkpoint, b: Checkpoint) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Clear old checkpoints
   */
  clearOldCheckpoints(olderThanDays = 7): number {
    const checkpoints = this.listCheckpoints();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let cleared = 0;

    for (const checkpoint of checkpoints) {
      if (new Date(checkpoint.timestamp) < cutoffDate) {
        try {
          unlinkSync(join(this.checkpointsDir, `${checkpoint.id}.json`));
          cleared++;
        } catch {
          // Ignore errors
        }
      }
    }

    console.log(`[Recovery] Cleared ${cleared} old checkpoints`);
    return cleared;
  }

  /**
   * Save checkpoint to disk
   */
  private saveCheckpoint(checkpoint: Checkpoint): void {
    const filePath = join(this.checkpointsDir, `${checkpoint.id}.json`);
    writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
  }

  /**
   * Load checkpoint from disk
   */
  private loadCheckpoint(checkpointId: string): Checkpoint | null {
    const filePath = join(this.checkpointsDir, `${checkpointId}.json`);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const data = readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as Checkpoint;
    } catch {
      return null;
    }
  }

  /**
   * Ensure checkpoints directory exists
   */
  private ensureCheckpointsDir(): void {
    if (!existsSync(this.checkpointsDir)) {
      mkdirSync(this.checkpointsDir, { recursive: true });
    }
  }
}
