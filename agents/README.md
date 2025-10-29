# Alpha Conversational Agents

Chat naturally with Alpha and its three specialist agents using the CLI interface.

## Alpha - The Master Orchestrator

### 🎯 **Alpha** - Project Manager
- **Role**: Master orchestrator and coordinator
- **Personality**: Strategic, decisive, quality-focused
- **Coordinates**: Forge, Blink, and QA-Lens
- **Purpose**: Breaks down features, delegates tasks, ensures P→I→V loop

**When to use Alpha:**
- Building complete features (backend + frontend + testing)
- You want someone to coordinate everything
- You're not sure which agent to talk to
- You want the full P→I→V loop automated

**Example**: "Alpha, build user authentication" → Alpha coordinates all three agents

---

## The Three Specialist Agents

### 🔧 Forge - Backend Builder
- **Role**: Backend development specialist
- **Personality**: Technical, precise, security-conscious
- **Builds**: API endpoints, database schemas, server logic
- **Owns**: `/api/**`, `/infra/**`

### 🎨 Blink - Frontend Developer
- **Role**: UI/UX specialist
- **Personality**: Creative, user-focused, design-oriented
- **Builds**: UI components, pages, styles, interactions
- **Owns**: `/ui/**`, `/assets/**`

### 🔍 QA-Lens - Quality Assurance
- **Role**: Testing and validation specialist
- **Personality**: Thorough, detail-oriented, skeptical
- **Builds**: Test flows, validation suites, bug reports
- **Owns**: `/checks/**`

## Quick Start

```bash
# Start the chat interface
npm run chat

# Select an agent (Forge, Blink, or QA-Lens)
# Then chat naturally!
```

## Example Conversations

### With Alpha (Orchestrator)
```
You: Alpha, build user authentication
Alpha: I'll coordinate building a complete auth system. Here's my plan:

       📋 Planning:

       **Forge** (Backend):
       - POST /api/auth/login endpoint with JWT
       - POST /api/auth/register endpoint
       - Auth middleware for protected routes
       - Password hashing with bcrypt

       **Blink** (Frontend):
       - /ui/login.html form with validation
       - /ui/register.html signup form
       - Redirect logic after login

       **QA-Lens** (Testing):
       - Login flow validation
       - Registration flow validation
       - Auth protection testing

       🔄 Execution Order:
       1. Forge builds the API first
       2. Blink creates the UI
       3. QA-Lens validates everything

       Should I proceed and coordinate the team?

You: Yes
Alpha: ✅ Forge completed the auth API
       🔄 Blink is creating the login/register forms...
       ⏳ QA-Lens will validate when ready

       [5 minutes later]

       ✅ Feature complete!
       Validation: ✅ 22/22 steps passed
       Ready to merge!
```

### With Forge (Backend)
```
You: Forge, add a user authentication endpoint
Forge: I'll create a login endpoint at /api/auth/login.ts. This will:
       - Accept POST requests with email/password
       - Validate credentials against the database
       - Return a JWT token on success
       - Rate limit to prevent brute force attacks

       Should I also add password hashing with bcrypt?

You: Yes please
Forge: Creating the endpoint now with bcrypt hashing...
```

### With Blink (Frontend)
```
You: Blink, make the login page beautiful
Blink: I'll create a stunning login page at /ui/login.html! Here's what I'm thinking:
       - Clean, centered card design
       - Smooth transitions and focus states
       - Mobile-responsive layout
       - Purple theme matching TinyLink

       Creating now...
```

### With QA-Lens (Testing)
```
You: QA-Lens, test the login flow
QA-Lens: I'll test the complete login flow. Here's my test plan:
         1. Happy path: Valid credentials → successful login
         2. Invalid credentials → error message
         3. Empty fields → validation errors
         4. Mobile responsiveness
         5. Accessibility testing

         Creating flow at /checks/flows/auth_login.yaml... Running now...
```

## Modes

### Demo Mode (Default)
- No API key required
- Simulated responses based on agent personas
- Great for understanding how agents think

### AI Mode (with API Key)
- Set `ANTHROPIC_API_KEY` environment variable
- Full Claude AI responses
- Context-aware, intelligent conversations

```bash
export ANTHROPIC_API_KEY=your_key_here
npm run chat
```

## Agent Personas

Each agent has a detailed persona definition in `agents/personas/`:
- `forge.md` - Backend builder persona
- `blink.md` - Frontend developer persona
- `qa-lens.md` - QA engineer persona

These define:
- Role and responsibilities
- Personality and communication style
- Directory scopes and contracts
- Example conversations
- Tools and capabilities

## Architecture

```
User Input
    ↓
CLI Interface (inquirer)
    ↓
ConversationalAgent
    ↓
Claude AI (or Demo Mode)
    ↓
Agent Response
    ↓
[Optional] Execute via Alpha API
```

## Commands

- `exit` - Quit the chat
- `clear` - Reset conversation history
- Any natural language request - Chat with the agent!

## Integration with Alpha

Agents can:
- Execute `/build` commands through Alpha API
- Run `/validate` flows via QA-Lens
- Read specs from `/specs/**`
- Respect directory contracts
- Coordinate with other agents

## Next Steps

1. **Try it**: `npm run chat`
2. **Add API key**: For full AI responses
3. **Build something**: Ask agents to create features
4. **Iterate**: Agents can improve based on feedback

## Tips

- Be specific about what you want
- Ask follow-up questions
- Request clarifications
- Agents respect directory boundaries
- They can suggest improvements

## Future Enhancements

- [ ] Web UI with chat bubbles
- [ ] Slack/Discord integration
- [ ] Voice interface
- [ ] Multi-agent collaboration
- [ ] Memory and context persistence
- [ ] Tool use (direct file editing)
