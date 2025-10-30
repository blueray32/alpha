#!/usr/bin/env tsx
/**
 * Memory Cleanup Script
 * Removes old conversations and checkpoints based on retention policies
 */

import { ConversationMemory } from '../src/lib/conversation-memory.js';
import { RecoveryHooks } from '../src/lib/recovery-hooks.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

// Read retention periods from environment or use defaults
const CONVERSATION_RETENTION_DAYS = parseInt(process.env.CONVERSATION_RETENTION_DAYS || '30', 10);
const CHECKPOINT_RETENTION_DAYS = parseInt(process.env.CHECKPOINT_RETENTION_DAYS || '7', 10);
const OUTCOME_RETENTION_DAYS = parseInt(process.env.OUTCOME_RETENTION_DAYS || '90', 10);

interface CleanupStats {
  conversationsDeleted: number;
  checkpointsCleared: number;
  outcomesCleared: number;
  totalSizeFreed: number;
}

/**
 * Clean up old conversations for all agents
 */
function cleanupConversations(): number {
  const agents = ['Alpha', 'Forge', 'Blink', 'QA-Lens'];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CONVERSATION_RETENTION_DAYS);

  let totalDeleted = 0;

  for (const agent of agents) {
    const memory = new ConversationMemory(agent);
    const conversations = memory.listConversations();

    let deleted = 0;
    for (const conv of conversations) {
      const lastUpdated = new Date(conv.lastUpdatedAt);
      if (lastUpdated < cutoffDate) {
        const success = memory.deleteConversation(conv.conversationId);
        if (success) {
          deleted++;
        }
      }
    }

    if (deleted > 0) {
      console.log(`${agent}: Deleted ${deleted} conversation(s) older than ${CONVERSATION_RETENTION_DAYS} days`);
    }
    totalDeleted += deleted;
  }

  return totalDeleted;
}

/**
 * Clean up old checkpoints
 */
function cleanupCheckpoints(): number {
  const recovery = new RecoveryHooks();
  const cleared = recovery.clearOldCheckpoints(CHECKPOINT_RETENTION_DAYS);

  if (cleared > 0) {
    console.log(`Cleared ${cleared} checkpoint(s) older than ${CHECKPOINT_RETENTION_DAYS} days`);
  }

  return cleared;
}

/**
 * Clean up old outcomes from ledger
 */
function cleanupOutcomes(): number {
  // Note: OutcomeLedger doesn't have a cleanup method yet
  // This is a placeholder for future implementation
  const ledgerPath = join(process.cwd(), 'ledger', 'outcomes.json');

  try {
    const stats = statSync(ledgerPath);
    const sizeMB = stats.size / (1024 * 1024);

    console.log(`Outcome ledger size: ${sizeMB.toFixed(2)} MB`);

    // Could implement actual cleanup here if needed
    // For now, just report the size
    return 0;
  } catch (error) {
    // Ledger file doesn't exist yet
    return 0;
  }
}

/**
 * Calculate total disk space used by memory directories
 */
function calculateDiskUsage(): number {
  const dirs = [
    join(process.cwd(), 'memory', 'conversations'),
    join(process.cwd(), 'memory', 'checkpoints'),
    join(process.cwd(), 'ledger'),
  ];

  let totalSize = 0;

  for (const dir of dirs) {
    try {
      const files = readdirSync(dir, { recursive: true, withFileTypes: true });
      for (const file of files) {
        if (file.isFile()) {
          const filePath = join(file.path, file.name);
          const stats = statSync(filePath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Directory might not exist
      continue;
    }
  }

  return totalSize;
}

/**
 * Main cleanup function
 */
async function main(): Promise<void> {
  console.log('=== Memory Cleanup Starting ===');
  console.log(`Retention policies:`);
  console.log(`  - Conversations: ${CONVERSATION_RETENTION_DAYS} days`);
  console.log(`  - Checkpoints: ${CHECKPOINT_RETENTION_DAYS} days`);
  console.log(`  - Outcomes: ${OUTCOME_RETENTION_DAYS} days`);
  console.log('');

  const sizeBeforeBytes = calculateDiskUsage();
  const sizeBeforeMB = sizeBeforeBytes / (1024 * 1024);

  const stats: CleanupStats = {
    conversationsDeleted: cleanupConversations(),
    checkpointsCleared: cleanupCheckpoints(),
    outcomesCleared: cleanupOutcomes(),
    totalSizeFreed: 0,
  };

  const sizeAfterBytes = calculateDiskUsage();
  const sizeAfterMB = sizeAfterBytes / (1024 * 1024);
  stats.totalSizeFreed = sizeBeforeBytes - sizeAfterBytes;

  console.log('');
  console.log('=== Cleanup Complete ===');
  console.log(`Total items removed:`);
  console.log(`  - Conversations: ${stats.conversationsDeleted}`);
  console.log(`  - Checkpoints: ${stats.checkpointsCleared}`);
  console.log(`  - Outcomes: ${stats.outcomesCleared}`);
  console.log(`Disk usage:`);
  console.log(`  - Before: ${sizeBeforeMB.toFixed(2)} MB`);
  console.log(`  - After: ${sizeAfterMB.toFixed(2)} MB`);
  console.log(`  - Freed: ${(stats.totalSizeFreed / (1024 * 1024)).toFixed(2)} MB`);
}

// Run cleanup
main().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
