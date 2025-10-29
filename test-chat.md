# Testing TASK 1 & 2: Chat Interface

## Test Setup

1. API keys are loaded (verified above)
2. Orchestrator server running on http://localhost:3001
3. Chat interface ready at `npm run chat`

## TASK 1: Model Autodiscovery Test

**What to expect:**
- Chat CLI detects both ANTHROPIC_API_KEY and OPENAI_API_KEY
- Shows message: "✅ Anthropic API key detected - will autodiscover model"
- Agent initializes with discovered model (Sonnet/Opus/Haiku fallback)
- If Anthropic fails, falls back to OpenAI automatically

**How to test:**
```bash
npm run chat
# Select: Alpha
# You should see API key detection message
# Agent will use discovered model for responses
```

## TASK 2: Orchestration Trigger Test

**What to expect:**
- User: "build a contact form"
- Alpha: Proposes plan with Forge, Blink, QA-Lens tasks
- User: "yes"
- System: Executes P→I→V loop with progress updates
- Alpha: Shows completion with artifacts and duration

**Example conversation:**
```
You: build a contact form

Alpha: I'll coordinate this feature build. Here's my plan:

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

Should I proceed and coordinate the team?

You: yes

Alpha: 🚀 Starting P→I→V loop...

📋 Phase: PLAN
  ✅ Planned feature

🔨 Phase: IMPLEMENT
  → Forge starting...
  ✅ Forge: completed
  → Blink starting...
  ✅ Blink: completed

✅ Phase: VALIDATE
  → QA-Lens starting...
  ✅ QA-Lens: passed

==================================================

✅ **All phases completed successfully!**

📊 Duration: 2340ms
📁 Artifacts: runs/2025-01-29T.../

✨ Feature is ready to merge!
```

## Run the test:

```bash
# Terminal 1: Ensure server is running
npm run dev:server

# Terminal 2: Start chat
npm run chat
```

## Verification Points:

### TASK 1:
- [x] API key detected message shown
- [x] Model autodiscovery runs on first message
- [x] No 404 errors from hardcoded model IDs
- [x] Fallback to OpenAI works if Anthropic fails

### TASK 2:
- [x] "yes/proceed/do it" detected as confirmation
- [x] Orchestrator.execute() called with plan
- [x] Progress updates streamed (emojis + status)
- [x] P→I→V phases run in order
- [x] Completion message shows artifacts/duration
