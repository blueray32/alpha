/**
 * Conversation Memory
 * Persists and restores conversation history across sessions
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ConversationMetadata {
  conversationId: string;
  agentName: string;
  createdAt: string;
  lastUpdatedAt: string;
  messageCount: number;
}

export interface ConversationSnapshot {
  metadata: ConversationMetadata;
  messages: ConversationMessage[];
}

export class ConversationMemory {
  private memoryDir: string;
  private currentConversationId: string | null = null;
  private agentName: string;

  constructor(agentName: string, memoryDir = 'memory/conversations') {
    this.agentName = agentName;
    this.memoryDir = join(process.cwd(), memoryDir, agentName.toLowerCase());
    this.ensureMemoryDir();
  }

  /**
   * Start a new conversation
   */
  startConversation(): string {
    this.currentConversationId = nanoid();
    console.log(`[Memory] Started new conversation: ${this.currentConversationId}`);
    return this.currentConversationId;
  }

  /**
   * Load an existing conversation
   */
  loadConversation(conversationId: string): ConversationSnapshot | null {
    const filePath = this.getConversationPath(conversationId);

    if (!existsSync(filePath)) {
      console.log(`[Memory] Conversation ${conversationId} not found`);
      return null;
    }

    try {
      const data = readFileSync(filePath, 'utf-8');
      const snapshot = JSON.parse(data) as ConversationSnapshot;
      this.currentConversationId = conversationId;
      console.log(`[Memory] Loaded conversation: ${conversationId} (${snapshot.messages.length} messages)`);
      return snapshot;
    } catch (error) {
      console.error(`[Memory] Failed to load conversation:`, error);
      return null;
    }
  }

  /**
   * Save messages to current conversation
   */
  saveMessages(messages: ConversationMessage[]): void {
    if (!this.currentConversationId) {
      this.startConversation();
    }

    const snapshot: ConversationSnapshot = {
      metadata: {
        conversationId: this.currentConversationId!,
        agentName: this.agentName,
        createdAt: messages[0]?.timestamp || new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        messageCount: messages.length,
      },
      messages,
    };

    const filePath = this.getConversationPath(this.currentConversationId!);
    writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
    console.log(`[Memory] Saved ${messages.length} messages to ${this.currentConversationId}`);
  }

  /**
   * Append a message to the current conversation
   */
  appendMessage(message: ConversationMessage): void {
    if (!this.currentConversationId) {
      this.startConversation();
    }

    const snapshot = this.loadConversation(this.currentConversationId!) || {
      metadata: {
        conversationId: this.currentConversationId!,
        agentName: this.agentName,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        messageCount: 0,
      },
      messages: [],
    };

    snapshot.messages.push(message);
    snapshot.metadata.lastUpdatedAt = new Date().toISOString();
    snapshot.metadata.messageCount = snapshot.messages.length;

    this.saveMessages(snapshot.messages);
  }

  /**
   * List all conversations for this agent
   */
  listConversations(): ConversationMetadata[] {
    if (!existsSync(this.memoryDir)) {
      return [];
    }

    const files = readdirSync(this.memoryDir).filter((f) => f.endsWith('.json'));

    return files
      .map((file) => {
        try {
          const data = readFileSync(join(this.memoryDir, file), 'utf-8');
          const snapshot = JSON.parse(data) as ConversationSnapshot;
          return snapshot.metadata;
        } catch {
          return null;
        }
      })
      .filter((m): m is ConversationMetadata => m !== null)
      .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
  }

  /**
   * Get the most recent conversation
   */
  getMostRecent(): ConversationSnapshot | null {
    const conversations = this.listConversations();
    if (conversations.length === 0) {
      return null;
    }

    return this.loadConversation(conversations[0].conversationId);
  }

  /**
   * Clear current conversation (start fresh)
   */
  clearCurrent(): void {
    this.currentConversationId = null;
    console.log('[Memory] Cleared current conversation');
  }

  /**
   * Delete a conversation
   */
  deleteConversation(conversationId: string): boolean {
    const filePath = this.getConversationPath(conversationId);

    if (!existsSync(filePath)) {
      return false;
    }

    try {
      unlinkSync(filePath);
      console.log(`[Memory] Deleted conversation: ${conversationId}`);
      return true;
    } catch (error) {
      console.error('[Memory] Failed to delete conversation:', error);
      return false;
    }
  }

  /**
   * Get current conversation ID
   */
  getCurrentConversationId(): string | null {
    return this.currentConversationId;
  }

  /**
   * Get file path for a conversation
   */
  private getConversationPath(conversationId: string): string {
    return join(this.memoryDir, `${conversationId}.json`);
  }

  /**
   * Ensure memory directory exists
   */
  private ensureMemoryDir(): void {
    if (!existsSync(this.memoryDir)) {
      mkdirSync(this.memoryDir, { recursive: true });
    }
  }
}
