#!/usr/bin/env node
/**
 * Interactive CLI for chatting with Alpha agents
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConversationalAgent, type AgentName } from './agent-chat.js';

const AGENTS: Record<AgentName, { persona: string; color: typeof chalk.blue }> = {
  'Alpha': {
    persona: 'agents/personas/alpha.md',
    color: chalk.cyan,
  },
  'Forge': {
    persona: 'agents/personas/forge.md',
    color: chalk.blue,
  },
  'Blink': {
    persona: 'agents/personas/blink.md',
    color: chalk.magenta,
  },
  'QA-Lens': {
    persona: 'agents/personas/qa-lens.md',
    color: chalk.green,
  },
};

async function main() {
  console.log(chalk.bold.cyan('\n🤖 Alpha Conversational Agents\n'));
  console.log('Chat naturally with Forge (backend), Blink (frontend), or QA-Lens (testing)\n');

  // Check for API keys
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (!hasAnthropic && !hasOpenAI) {
    console.log(chalk.yellow('⚠️  No API keys found - running in DEMO mode'));
    console.log(chalk.gray('   Set ANTHROPIC_API_KEY or OPENAI_API_KEY for full AI responses\n'));
  } else if (hasAnthropic) {
    console.log(chalk.green('✅ Anthropic API key detected - will autodiscover model\n'));
  } else if (hasOpenAI) {
    console.log(chalk.green('✅ OpenAI API key detected\n'));
  }

  // Select agent
  // @ts-expect-error - Inquirer types are complex, but this works at runtime
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'agentName',
      message: 'Which agent would you like to chat with?',
      choices: [
        { name: '🎯 Alpha - Master Orchestrator (Coordinates All Agents)', value: 'Alpha' },
        { name: '─────────────────────────────────────────────', disabled: true },
        { name: '🔧 Forge - Backend Builder', value: 'Forge' },
        { name: '🎨 Blink - Frontend Developer', value: 'Blink' },
        { name: '🔍 QA-Lens - Quality Assurance', value: 'QA-Lens' },
      ],
    },
  ]);
  const agentName = answers.agentName as AgentName;

  const agent = new ConversationalAgent({
    name: agentName,
    personaPath: AGENTS[agentName].persona,
    apiEndpoint: 'http://localhost:3001',
  });

  const agentColor = AGENTS[agentName].color;

  console.log(agentColor.bold(`\n💬 Chatting with ${agentName}`));
  console.log(chalk.gray('Type "exit" to quit, "clear" to reset conversation\n'));

  // Chat loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // @ts-expect-error - Inquirer types are complex, but this works at runtime
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'message',
        message: chalk.white('You:'),
        prefix: '  ',
      },
    ]);
    const message = answers.message as string;

    if (message.toLowerCase() === 'exit') {
      console.log(chalk.gray('\nGoodbye! 👋\n'));
      break;
    }

    if (message.toLowerCase() === 'clear') {
      agent.resetConversation();
      console.log(chalk.gray('Conversation cleared\n'));
      continue;
    }

    if (!message.trim()) {
      continue;
    }

    // Get response
    console.log(chalk.gray('  Thinking...\r'), '');
    const response = await agent.chat(message);

    // Display response
    console.log(agentColor(`\n${agentName}:`));
    console.log(chalk.white(`  ${response.split('\n').join('\n  ')}\n`));
  }
}

main().catch((error) => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});
