/**
 * Conversational Agent System for Alpha
 * Enables natural language interaction with Forge, Blink, and QA-Lens
 * Supports Anthropic and OpenAI with automatic model discovery
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { modelDiscovery, type ModelConfig } from '../lib/model-discovery.js';
import { Orchestrator, type OrchestrationPlan } from '../lib/orchestrator.js';
import { OutcomeLedger } from '../lib/outcome-ledger.js';

export type AgentName = 'Alpha' | 'Forge' | 'Blink' | 'QA-Lens';

export interface AgentConfig {
  name: AgentName;
  personaPath: string;
  apiEndpoint: string;
  outcomeLedger?: OutcomeLedger;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ConversationalAgent {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private modelConfig: ModelConfig | null = null;
  private persona: string;
  private conversationHistory: ChatMessage[] = [];
  private agentName: AgentName;
  private alphaApiBase: string;
  private initialized: boolean = false;
  private orchestrator: Orchestrator;
  private pendingPlan: OrchestrationPlan | null = null;
  private lastResponseWasConfirmation: boolean = false;

  constructor(config: AgentConfig) {
    this.agentName = config.name;
    this.alphaApiBase = config.apiEndpoint;

    // Load persona
    const personaPath = join(process.cwd(), config.personaPath);
    this.persona = readFileSync(personaPath, 'utf-8');

    // Initialize orchestrator
    this.orchestrator = new Orchestrator(config.apiEndpoint);

    // Attach outcome ledger if provided
    if (config.outcomeLedger) {
      config.outcomeLedger.attach(this.orchestrator);
    }
  }

  /**
   * Initialize the agent with model discovery
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Discover best available model
      this.modelConfig = await modelDiscovery.discover();

      // Initialize appropriate client
      if (this.modelConfig.provider === 'anthropic') {
        this.anthropicClient = new Anthropic({ apiKey: this.modelConfig.apiKey });
      } else if (this.modelConfig.provider === 'openai') {
        this.openaiClient = new OpenAI({ apiKey: this.modelConfig.apiKey });
      }

      this.initialized = true;
    } catch (error) {
      console.warn('⚠️  AI initialization failed, using demo mode:', error instanceof Error ? error.message : '');
      // Will fall back to demo mode
    }
  }

  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Initialize on first use
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if this is a confirmation (yes/proceed/do it) after a plan
    if (this.shouldExecutePlan(userMessage)) {
      return await this.executePendingPlan();
    }

    // Demo mode if no client available
    if (!this.anthropicClient && !this.openaiClient) {
      const response = this.getSimulatedResponse(userMessage);
      this.trackConfirmationState(response);
      return response;
    }

    try {
      let assistantMessage: string;

      // Route to appropriate provider
      if (this.anthropicClient && this.modelConfig?.provider === 'anthropic') {
        assistantMessage = await this.chatWithAnthropic();
      } else if (this.openaiClient && this.modelConfig?.provider === 'openai') {
        assistantMessage = await this.chatWithOpenAI();
      } else {
        const response = this.getSimulatedResponse(userMessage);
        this.trackConfirmationState(response);
        return response;
      }

      // Add to history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
      });

      // Track if we just asked for confirmation
      this.trackConfirmationState(assistantMessage);

      return assistantMessage;
    } catch (error) {
      return `Error communicating with ${this.agentName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Check if user message is a confirmation to proceed
   */
  private shouldExecutePlan(userMessage: string): boolean {
    if (!this.lastResponseWasConfirmation || !this.pendingPlan) {
      return false;
    }

    const lower = userMessage.toLowerCase().trim();
    const confirmationPhrases = ['yes', 'y', 'proceed', 'do it', 'go ahead', 'let\'s go', 'start'];

    return confirmationPhrases.some((phrase) => lower === phrase || lower.startsWith(phrase));
  }

  /**
   * Track if assistant response included a confirmation question
   */
  private trackConfirmationState(assistantMessage: string): void {
    const lower = assistantMessage.toLowerCase();
    const hasConfirmationQuestion =
      lower.includes('should i proceed') ||
      lower.includes('proceed?') ||
      lower.includes('should i') ||
      lower.includes('shall i');

    this.lastResponseWasConfirmation = hasConfirmationQuestion;

    // Extract plan if this is Alpha asking for confirmation
    if (hasConfirmationQuestion && this.agentName === 'Alpha') {
      this.pendingPlan = this.extractPlanFromMessage(assistantMessage);
    }
  }

  /**
   * Extract orchestration plan from assistant message
   */
  private extractPlanFromMessage(message: string): OrchestrationPlan | null {
    // Simple extraction - in production this could be more sophisticated
    const hasForge = message.toLowerCase().includes('forge');
    const hasBlink = message.toLowerCase().includes('blink');
    const hasQA = message.toLowerCase().includes('qa-lens');

    if (!hasForge && !hasBlink && !hasQA) {
      return null;
    }

    return {
      feature: 'User requested feature',
      agents: {
        ...(hasForge && {
          forge: {
            tasks: ['Build backend components'],
            files: ['api/**'],
          },
        }),
        ...(hasBlink && {
          blink: {
            tasks: ['Build frontend components'],
            files: ['ui/**'],
          },
        }),
        ...(hasQA && {
          qaLens: {
            flow: 'smoke/ui_submit_and_render',
            env: { baseUrl: 'http://localhost:5050' },
          },
        }),
      },
    };
  }

  /**
   * Execute the pending orchestration plan
   */
  private async executePendingPlan(): Promise<string> {
    if (!this.pendingPlan) {
      return 'No plan to execute. Please request a feature first.';
    }

    const plan = this.pendingPlan;
    this.pendingPlan = null;
    this.lastResponseWasConfirmation = false;

    // Stream progress updates
    let progressMessage = '🚀 Starting P→I→V loop...\n\n';

    this.orchestrator.on('phase:start', (data) => {
      const emoji = { plan: '📋', implement: '🔨', validate: '✅' }[data.phase] || '⚙️';
      progressMessage += `${emoji} Phase: ${data.phase.toUpperCase()}\n`;
    });

    this.orchestrator.on('agent:start', (data) => {
      progressMessage += `  → ${data.agent} starting...\n`;
    });

    this.orchestrator.on('agent:complete', (data) => {
      const status = data.result.success ? '✅' : '❌';
      progressMessage += `  ${status} ${data.agent}: ${data.result.status}\n`;
    });

    try {
      const result = await this.orchestrator.execute(plan);

      progressMessage += '\n' + '='.repeat(50) + '\n\n';

      if (result.success) {
        progressMessage += '✅ **All phases completed successfully!**\n\n';
        progressMessage += `📊 Duration: ${result.duration_ms}ms\n`;

        if (result.validate?.artifacts) {
          progressMessage += `📸 Screenshots: ${result.validate.artifacts.length}\n`;
        }

        if (result.validate?.runPath) {
          progressMessage += `📁 Artifacts: ${result.validate.runPath}\n`;
        }

        progressMessage += '\n✨ Feature is ready to merge!';
      } else {
        progressMessage += `❌ **${result.error}**\n\n`;

        if (result.plan && !result.plan.success) {
          progressMessage += `Planning failed: ${result.plan.error}\n`;
        }
        if (result.build && !result.build.success) {
          progressMessage += `Build failed: ${result.build.error}\n`;
        }
        if (result.validate && !result.validate.success) {
          progressMessage += `Validation failed: ${result.validate.error}\n`;
        }

        progressMessage += '\n🔧 Please review the errors and try again.';
      }

      // Add orchestration result to history
      this.conversationHistory.push({
        role: 'assistant',
        content: progressMessage,
      });

      return progressMessage;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorResponse = `❌ Orchestration error: ${errorMsg}`;

      this.conversationHistory.push({
        role: 'assistant',
        content: errorResponse,
      });

      return errorResponse;
    }
  }

  private async chatWithAnthropic(): Promise<string> {
    if (!this.anthropicClient || !this.modelConfig) {
      throw new Error('Anthropic client not initialized');
    }

    const response = await this.anthropicClient.messages.create({
      model: this.modelConfig.model,
      max_tokens: 2048,
      system: this.buildSystemPrompt(),
      messages: this.conversationHistory,
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  private async chatWithOpenAI(): Promise<string> {
    if (!this.openaiClient || !this.modelConfig) {
      throw new Error('OpenAI client not initialized');
    }

    const messages = [
      { role: 'system' as const, content: this.buildSystemPrompt() },
      ...this.conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const response = await this.openaiClient.chat.completions.create({
      model: this.modelConfig.model,
      max_tokens: 2048,
      messages,
    });

    return response.choices[0]?.message?.content || '';
  }

  private buildSystemPrompt(): string {
    return `${this.persona}

## Current Context
- Alpha Orchestrator API: ${this.alphaApiBase}
- You can execute commands through the Alpha API
- Current project has: TinyLink (URL shortener) already built
- Available agents: Forge (backend), Blink (frontend), QA-Lens (testing)

## Your Task
Respond conversationally to user requests. When they ask you to build or test something:
1. Acknowledge what they want
2. Explain what you'll do
3. Mention the files/endpoints you'll create
4. Ask clarifying questions if needed
5. Be helpful and collaborative

Remember: You're ${this.agentName}, stay in character!`;
  }

  private getSimulatedResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();

    // Simulate agent responses based on persona
    if (this.agentName === 'Alpha') {
      // Alpha coordinates all agents
      if (lowerMessage.includes('build') || lowerMessage.includes('add') || lowerMessage.includes('create')) {
        return `I'll coordinate this feature build. Here's my plan:

📋 **Planning:**

**Forge** (Backend):
- Will handle API endpoints and server logic
- Database schema if needed
- Authentication/validation

**Blink** (Frontend):
- Will create the UI components
- Style and make it responsive
- Handle user interactions

**QA-Lens** (Testing):
- Will validate the complete flow
- Test edge cases and accessibility
- Capture screenshots

🔄 **Execution Order:**
1. Forge builds the backend first
2. Blink creates the frontend
3. QA-Lens validates everything

⏱️  **Estimated time:** 30-60 minutes

Should I proceed and coordinate the team?`;
      }

      if (lowerMessage.includes('test') || lowerMessage.includes('validate')) {
        return `I'll have QA-Lens test that for us. They'll create a comprehensive validation flow with:
- Happy path testing
- Error cases
- Mobile responsiveness
- Accessibility checks

Should I proceed?`;
      }

      return `I'm Alpha, your orchestrator. I coordinate Forge (backend), Blink (frontend), and QA-Lens (testing) to build complete features.

Tell me what you want to build, and I'll break it down into tasks and coordinate the team to make it happen!

Examples:
- "Build user authentication"
- "Add a dark mode toggle"
- "Create a user profile page"`;
    }

    if (this.agentName === 'Forge') {
      if (lowerMessage.includes('endpoint') || lowerMessage.includes('api')) {
        return `I'll create that API endpoint for you. Looking at the request, I'll add it to \`/api/routes/\` with proper validation and error handling. I'll also make sure it's protected with authentication middleware. Should I include rate limiting?`;
      }
      if (lowerMessage.includes('database') || lowerMessage.includes('schema')) {
        return `I'll design a database schema for that. I'm thinking we'll need a few tables with proper foreign keys. Let me outline the structure:\n\n- Primary table with UUID keys\n- Indexes on frequently queried fields\n- Timestamps for auditing\n\nDoes this align with your requirements?`;
      }
      return `As Forge (backend specialist), I can help build APIs, configure infrastructure, or handle server-side logic. What would you like me to work on?`;
    }

    if (this.agentName === 'Blink') {
      if (lowerMessage.includes('component') || lowerMessage.includes('ui')) {
        return `I'll design that component! I'm thinking a clean, modern look with smooth animations. I'll make it responsive (works great on mobile) and accessible (keyboard navigation + screen readers). What color scheme matches your app - should I use the purple theme like TinyLink?`;
      }
      if (lowerMessage.includes('page') || lowerMessage.includes('form')) {
        return `Creating that page now! I'll build it at \`/ui/${lowerMessage.split(' ')[0]}.html\` with:\n- Responsive layout\n- Smooth transitions\n- Input validation\n- Mobile-friendly design\n\nWant me to add any specific features?`;
      }
      return `Hi! I'm Blink, your frontend developer. I love creating beautiful, user-friendly interfaces. What would you like me to build?`;
    }

    if (this.agentName === 'QA-Lens') {
      if (lowerMessage.includes('test') || lowerMessage.includes('validate')) {
        return `I'll test that thoroughly! Here's my test strategy:\n\n1. Happy path (everything works)\n2. Error cases (wrong input, network issues)\n3. Edge cases (empty fields, special characters)\n4. Mobile responsiveness\n5. Accessibility (keyboard, screen readers)\n\nCreating the test flow now... shall I run it?`;
      }
      return `QA-Lens here! I'm your quality assurance specialist. I can test user flows, catch bugs, and ensure everything works smoothly. What needs testing?`;
    }

    return `I'm ${this.agentName}. How can I help you today?`;
  }

  resetConversation(): void {
    this.conversationHistory = [];
  }

  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }
}
