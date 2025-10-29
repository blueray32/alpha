import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { ContractScopes } from '../types/index.js';
import { join } from 'path';

export class ContractGuard {
  private scopes: ContractScopes;
  private rootDir: string;

  constructor(scopesPath: string, rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    const scopesFile = readFileSync(scopesPath, 'utf-8');
    this.scopes = parse(scopesFile) as ContractScopes;
  }

  /**
   * Check if an agent can write to a given path
   */
  canWrite(agentName: string, filePath: string): { allowed: boolean; reason?: string } {
    const owner = this.scopes.owners[agentName];
    if (!owner) {
      return {
        allowed: false,
        reason: `Agent "${agentName}" not found in contract scopes`,
      };
    }

    const writeScopes = owner.write || [];
    const normalizedPath = this.normalizePath(filePath);

    for (const scope of writeScopes) {
      if (this.matchesGlob(normalizedPath, scope)) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `Agent "${agentName}" cannot write to "${filePath}". Allowed: ${writeScopes.join(', ')}`,
    };
  }

  /**
   * Check if an agent can read from a given path
   */
  canRead(agentName: string, filePath: string): { allowed: boolean; reason?: string } {
    const owner = this.scopes.owners[agentName];
    if (!owner) {
      return {
        allowed: false,
        reason: `Agent "${agentName}" not found in contract scopes`,
      };
    }

    const readScopes = owner.read || [];
    const writeScopes = owner.write || [];
    const normalizedPath = this.normalizePath(filePath);

    // Can read from write scopes
    for (const scope of [...writeScopes, ...readScopes]) {
      if (this.matchesGlob(normalizedPath, scope)) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `Agent "${agentName}" cannot read from "${filePath}"`,
    };
  }

  /**
   * Validate multiple file writes at once
   */
  validateWrites(
    agentName: string,
    filePaths: string[]
  ): { allowed: boolean; violations: string[] } {
    const violations: string[] = [];

    for (const filePath of filePaths) {
      const check = this.canWrite(agentName, filePath);
      if (!check.allowed && check.reason) {
        violations.push(check.reason);
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
    };
  }

  private normalizePath(filePath: string): string {
    // Ensure path starts with /
    let normalized = filePath.startsWith('/') ? filePath : `/${filePath}`;
    // Remove root dir if present
    if (this.rootDir && normalized.startsWith(this.rootDir)) {
      normalized = normalized.slice(this.rootDir.length);
    }
    return normalized;
  }

  private matchesGlob(path: string, pattern: string): boolean {
    // Simple glob matching for /** patterns
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      return path.startsWith(prefix);
    }

    // Exact match
    if (pattern === path) {
      return true;
    }

    // Single wildcard at end
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      const remainder = path.slice(prefix.length);
      return path.startsWith(prefix) && !remainder.includes('/');
    }

    return false;
  }

  getScopes(): ContractScopes {
    return this.scopes;
  }
}
