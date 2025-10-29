#!/usr/bin/env node
/**
 * Interactive CLI for chatting with Alpha agents
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConversationalAgent, type AgentName } from './agent-chat.js';

const AGENTS: Record<AgentName, { persona: string; color: typeof chalk.blue }> = {
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

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log(chalk.yellow('⚠️  No ANTHROPIC_API_KEY found - running in DEMO mode'));
    console.log(chalk.gray('   Set ANTHROPIC_API_KEY environment variable for full AI responses\n'));
  }

  // Select agent
  const { agentName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'agentName',
      message: 'Which agent would you like to chat with?',
      choices: [
        { name: '🔧 Forge - Backend Builder', value: 'Forge' },
        { name: '🎨 Blink - Frontend Developer', value: 'Blink' },
        { name: '🔍 QA-Lens - Quality Assurance', value: 'QA-Lens' },
      ],
    },
  ]);

  const agent = new ConversationalAgent(
    {
      name: agentName,
      personaPath: AGENTS[agentName].persona,
      apiEndpoint: 'http://localhost:3001',
    },
    apiKey
  );

  const agentColor = AGENTS[agentName].color;

  console.log(agentColor.bold(`\n💬 Chatting with ${agentName}`));
  console.log(chalk.gray('Type "exit" to quit, "clear" to reset conversation\n'));

  // Chat loop
  while (true) {
    const { message } = await inquirer.prompt([
      {
        type: 'input',
        name: 'message',
        message: chalk.white('You:'),
        prefix: '  ',
      },
    ]);

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
