/**
 * Guarded File Writer
 * Enforces contract guard on all file writes
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { ContractGuard } from './contract-guard.js';
import { RunManager } from './run-manager.js';

export interface WriteResult {
  success: boolean;
  path?: string;
  error?: string;
  violations?: string[];
}

export interface WriteViolationArtifact {
  timestamp: string;
  agent: string;
  attemptedWrites: Array<{
    path: string;
    reason: string;
  }>;
  status: 'denied';
}

export class GuardedWriter {
  constructor(
    private contractGuard: ContractGuard,
    private runManager: RunManager,
    private rootDir: string = process.cwd()
  ) {}

  /**
   * Write file with contract guard enforcement
   * Returns success or creates violation artifact
   */
  async writeFileWithGuard(
    agentName: string,
    filePath: string,
    content: string
  ): Promise<WriteResult> {
    // Check contract
    const check = this.contractGuard.canWrite(agentName, filePath);

    if (!check.allowed) {
      // Create violation artifact
      await this.createViolationArtifact(agentName, [
        {
          path: filePath,
          reason: check.reason || 'Contract violation',
        },
      ]);

      return {
        success: false,
        error: check.reason,
        violations: [check.reason || 'Contract violation'],
      };
    }

    // Write is allowed, proceed
    try {
      const fullPath = join(this.rootDir, filePath);

      // Ensure directory exists
      const dir = dirname(fullPath);
      mkdirSync(dir, { recursive: true });

      // Write file
      writeFileSync(fullPath, content, 'utf-8');

      return {
        success: true,
        path: filePath,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Write failed: ${errorMsg}`,
      };
    }
  }

  /**
   * Write multiple files with contract guard
   */
  async writeFilesWithGuard(
    agentName: string,
    files: Array<{ path: string; content: string }>
  ): Promise<{ success: boolean; results: WriteResult[]; violations: string[] }> {
    const results: WriteResult[] = [];
    const allViolations: string[] = [];

    // First, check all writes
    const checks = files.map((f) => ({
      file: f,
      check: this.contractGuard.canWrite(agentName, f.path),
    }));

    // Collect all violations
    const violations: Array<{ path: string; reason: string }> = [];
    for (const { file, check } of checks) {
      if (!check.allowed && check.reason) {
        violations.push({
          path: file.path,
          reason: check.reason,
        });
        allViolations.push(check.reason);
      }
    }

    // If any violations, create artifact and fail all
    if (violations.length > 0) {
      await this.createViolationArtifact(agentName, violations);

      return {
        success: false,
        results: files.map((_f) => ({
          success: false,
          error: 'Batch write failed due to contract violations',
          violations: allViolations,
        })),
        violations: allViolations,
      };
    }

    // All checks passed, write all files
    for (const file of files) {
      const result = await this.writeFileWithGuard(agentName, file.path, file.content);
      results.push(result);
    }

    const allSucceeded = results.every((r) => r.success);

    return {
      success: allSucceeded,
      results,
      violations: [],
    };
  }

  /**
   * Create violation artifact in runs directory
   */
  private async createViolationArtifact(
    agentName: string,
    violations: Array<{ path: string; reason: string }>
  ): Promise<void> {
    const artifact: WriteViolationArtifact = {
      timestamp: new Date().toISOString(),
      agent: agentName,
      attemptedWrites: violations,
      status: 'denied',
    };

    // Create run directory for violations
    const runPath = await this.runManager.createRun(
      agentName,
      '/build',
      { violations: true },
      {
        success: false,
        runPath: '',
        status: 'denied',
        error: 'Contract violations',
      },
      0
    );

    // Write violation artifact
    const artifactPath = join(runPath, 'violations.json');
    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf-8');

    console.error(
      `❌ Contract violations by ${agentName}:\n${violations.map((v) => `  - ${v.path}: ${v.reason}`).join('\n')}`
    );
  }

  /**
   * Validate writes without actually writing
   */
  validateWrites(agentName: string, filePaths: string[]): { allowed: boolean; violations: string[] } {
    return this.contractGuard.validateWrites(agentName, filePaths);
  }
}
