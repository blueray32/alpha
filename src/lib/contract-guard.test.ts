import { describe, it, expect, beforeAll } from 'vitest';
import { ContractGuard } from './contract-guard.js';
import { join } from 'path';

describe('ContractGuard', () => {
  let guard: ContractGuard;

  beforeAll(() => {
    const scopesPath = join(process.cwd(), 'contracts/scopes.yaml');
    guard = new ContractGuard(scopesPath);
  });

  describe('canWrite', () => {
    it('allows Forge to write to /api/**', () => {
      const result = guard.canWrite('Forge', '/api/server.ts');
      expect(result.allowed).toBe(true);
    });

    it('allows Forge to write to /infra/**', () => {
      const result = guard.canWrite('Forge', '/infra/config.yaml');
      expect(result.allowed).toBe(true);
    });

    it('denies Forge writing to /ui/**', () => {
      const result = guard.canWrite('Forge', '/ui/components/Button.tsx');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('cannot write');
    });

    it('allows Blink to write to /ui/**', () => {
      const result = guard.canWrite('Blink', '/ui/App.tsx');
      expect(result.allowed).toBe(true);
    });

    it('denies Blink writing to /api/**', () => {
      const result = guard.canWrite('Blink', '/api/routes.ts');
      expect(result.allowed).toBe(false);
    });

    it('allows QA-Lens to write to /checks/**', () => {
      const result = guard.canWrite('QA-Lens', '/checks/flows/test.yaml');
      expect(result.allowed).toBe(true);
    });

    it('denies unknown agents', () => {
      const result = guard.canWrite('UnknownAgent', '/api/test.ts');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('canRead', () => {
    it('allows Forge to read from write scopes', () => {
      const result = guard.canRead('Forge', '/api/server.ts');
      expect(result.allowed).toBe(true);
    });

    it('allows Forge to read from /ui/** (read scope)', () => {
      const result = guard.canRead('Forge', '/ui/App.tsx');
      expect(result.allowed).toBe(true);
    });

    it('allows QA-Lens to read from anywhere', () => {
      const result = guard.canRead('QA-Lens', '/api/server.ts');
      expect(result.allowed).toBe(true);
    });
  });

  describe('validateWrites', () => {
    it('validates multiple files', () => {
      const result = guard.validateWrites('Forge', [
        '/api/server.ts',
        '/api/routes.ts',
        '/infra/config.yaml',
      ]);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('detects violations in batch', () => {
      const result = guard.validateWrites('Forge', [
        '/api/server.ts',
        '/ui/App.tsx', // violation
        '/checks/test.yaml', // violation
      ]);
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
});
