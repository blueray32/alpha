#!/usr/bin/env node
/**
 * OpenAI Realtime API Relay Server
 * Relays WebSocket connections between browser and OpenAI Realtime API
 */

import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync } from 'fs';
import { join } from 'path';

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
const PORT = 8081;

interface AgentConfig {
  name: string;
  voice: string;
  personaPath: string;
}

const AGENTS: Record<string, AgentConfig> = {
  alpha: {
    name: 'Alpha',
    voice: 'alloy', // Confident, strategic
    personaPath: 'agents/personas/alpha.md',
  },
  forge: {
    name: 'Forge',
    voice: 'echo', // Technical, precise
    personaPath: 'agents/personas/forge.md',
  },
  blink: {
    name: 'Blink',
    voice: 'nova', // Creative, friendly
    personaPath: 'agents/personas/blink.md',
  },
  'qa-lens': {
    name: 'QA-Lens',
    voice: 'shimmer', // Thorough, detail-oriented
    personaPath: 'agents/personas/qa-lens.md',
  },
};

function loadPersona(agentKey: string): string {
  const config = AGENTS[agentKey];
  if (!config) return '';

  const personaPath = join(process.cwd(), config.personaPath);
  return readFileSync(personaPath, 'utf-8');
}

function createSessionConfig(agentKey: string) {
  const agent = AGENTS[agentKey] || AGENTS.alpha;
  const persona = loadPersona(agentKey);

  return {
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: `${persona}

## Voice Context
You are speaking with the user through voice. Be conversational, natural, and engaging.
Keep responses concise but informative. You're ${agent.name}, stay in character!

Current context:
- Alpha Orchestrator API: http://localhost:3001
- Project: Alpha multi-agent development system
- Available agents: Forge (backend), Blink (frontend), QA-Lens (testing)`,
      voice: agent.voice,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'whisper-1',
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
      temperature: 0.8,
      max_response_output_tokens: 4096,
    },
  };
}

const server = new WebSocketServer({ port: PORT });

console.log(`🎤 Alpha Voice Server running on ws://localhost:${PORT}`);
console.log('Ready for voice connections...\n');

server.on('connection', async (clientWs: WebSocket, req) => {
  // Get agent from query params
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const agentKey = url.searchParams.get('agent') || 'alpha';

  console.log(`📞 Client connected - Agent: ${AGENTS[agentKey]?.name || 'Alpha'}`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not set');
    clientWs.close();
    return;
  }

  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  // OpenAI connection opened
  openaiWs.on('open', () => {
    console.log(`✅ Connected to OpenAI Realtime API for ${AGENTS[agentKey]?.name}`);

    // Send session config with agent persona
    const sessionConfig = createSessionConfig(agentKey);
    openaiWs.send(JSON.stringify(sessionConfig));
    console.log(`🎭 Loaded ${AGENTS[agentKey]?.name} persona with voice: ${AGENTS[agentKey]?.voice}`);
  });

  // Relay messages from OpenAI to client
  openaiWs.on('message', (data: Buffer) => {
    try {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    } catch (error) {
      console.error('Error relaying to client:', error);
    }
  });

  // Relay messages from client to OpenAI
  clientWs.on('message', (data: Buffer) => {
    try {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(data);
      }
    } catch (error) {
      console.error('Error relaying to OpenAI:', error);
    }
  });

  // Handle disconnections
  clientWs.on('close', () => {
    console.log(`👋 Client disconnected from ${AGENTS[agentKey]?.name}`);
    openaiWs.close();
  });

  openaiWs.on('close', () => {
    console.log(`🔌 OpenAI connection closed for ${AGENTS[agentKey]?.name}`);
    clientWs.close();
  });

  openaiWs.on('error', (error) => {
    console.error('OpenAI WebSocket error:', error);
    clientWs.close();
  });

  clientWs.on('error', (error) => {
    console.error('Client WebSocket error:', error);
    openaiWs.close();
  });
});

server.on('error', (error) => {
  console.error('Server error:', error);
});
