# Alpha

A composable, closed-loop, multi-agent application scaffold implementing the **P→I→V loop** (Plan → Implement → Validate).

## Features

- **Orchestrator API**: RESTful service to manage agents and execute commands
- **Contract Guard**: Enforces directory scopes to prevent agents from writing outside their boundaries
- **Validation Runner**: Browser-based testing using Playwright with YAML flow definitions
- **Tower**: Live observability dashboard showing real-time command execution
- **Run Artifacts**: Every command execution creates timestamped artifacts with full traceability

## Structure

```
alpha/
├── api/          # Backend code (owned by Forge)
├── infra/        # Infrastructure config (owned by Forge)
├── ui/           # Frontend code (owned by Blink)
├── assets/       # Static assets (owned by Blink)
├── checks/       # Validation flows (owned by QA-Lens)
├── runs/         # Execution artifacts (written by Orchestrator)
├── specs/        # Feature specifications
├── contracts/    # Directory scopes and pre-merge rules
├── slash/        # Command schemas (/plan, /build, /validate)
├── src/          # Orchestrator source code
└── tower/        # Tower UI (Next.js)
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
cd tower && npm install && cd ..
```

### 2. Start the Orchestrator

```bash
npm run dev:server
```

The orchestrator will start on `http://localhost:3001`.

### 3. Start Tower (optional)

In a separate terminal:

```bash
npm run dev:tower
```

Tower will be available at `http://localhost:4000`.

### 4. Create Agents

Create the baseline agents:

```bash
# Create Forge (builder agent for backend)
curl -X POST http://localhost:3001/agents \
  -H 'Content-Type: application/json' \
  -d '{"name":"Forge","type":"builder"}'

# Create Blink (builder agent for frontend)
curl -X POST http://localhost:3001/agents \
  -H 'Content-Type: application/json' \
  -d '{"name":"Blink","type":"builder"}'

# Create QA-Lens (validation agent)
curl -X POST http://localhost:3001/agents \
  -H 'Content-Type: application/json' \
  -d '{"name":"QA-Lens","type":"validator"}'
```

### 5. List Agents

```bash
curl http://localhost:3001/agents | jq
```

### 6. Run a Validation Flow

```bash
# Run the smoke test validation flow
curl -X POST http://localhost:3001/agents/a_3/cmd \
  -H 'Content-Type: application/json' \
  -d '{
    "slash": "/validate",
    "payload": {
      "flow": "smoke/ui_submit_and_render",
      "env": {
        "baseUrl": "http://localhost:3000"
      }
    }
  }' | jq
```

Note: Replace `a_3` with the actual agent ID from step 4. The validation will create artifacts in `runs/`.

## API Reference

### Create Agent

```http
POST /agents
Content-Type: application/json

{
  "name": "AgentName",
  "type": "builder|validator|research",
  "profile": {}  // optional
}
```

### List Agents

```http
GET /agents
```

### Execute Command

```http
POST /agents/{id}/cmd
Content-Type: application/json

{
  "slash": "/plan|/build|/validate|/observe",
  "payload": { ... }  // command-specific payload
}
```

### Event Stream (for Tower)

```http
GET /events
Accept: text/event-stream
```

## Commands

### /validate

Run a Playwright validation flow:

```json
{
  "slash": "/validate",
  "payload": {
    "flow": "smoke/ui_submit_and_render",
    "env": {
      "baseUrl": "http://localhost:3000"
    }
  }
}
```

### /build

Execute build tasks (enforces contract scopes):

```json
{
  "slash": "/build",
  "payload": {
    "files": ["/api/server.ts", "/api/routes.ts"]
  }
}
```

### /plan

Load or create a feature plan:

```json
{
  "slash": "/plan",
  "payload": {
    "spec": "feature-example"
  }
}
```

## Directory Contracts

Agents have strict write permissions enforced by the Contract Guard:

- **Forge**: Can write to `/api/**`, `/infra/**`; can read `/ui/**`
- **Blink**: Can write to `/ui/**`, `/assets/**`; can read `/api/**`
- **QA-Lens**: Can write to `/checks/**`; can read everything

Any attempt to write outside allowed scopes will be blocked with a clear error.

## Validation Flows

Create YAML flow files in `checks/flows/` with these supported steps:

```yaml
name: my_flow
steps:
  - open: "${baseUrl}/"
  - assert: "#element-id"
  - type:
      selector: "#input"
      text: "Hello"
  - click: "#submit"
  - wait_for: "#result"
  - screenshot: "checks/run-${run_id}/result.png"
```

Run a flow:

```bash
npm run validate -- --flow checks/flows/my_flow.yaml --env baseUrl=http://localhost:3000
```

## Testing

Run contract guard tests:

```bash
npm test
```

## Development

- `npm run dev:server` - Start orchestrator with hot reload
- `npm run dev:tower` - Start Tower UI
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code

## Architecture

### P→I→V Loop

1. **Plan** (`/plan`): Load feature specs from `/specs/**`
2. **Implement** (`/build`): Execute within directory contracts
3. **Validate** (`/validate`): Run browser checks and gate merges

### Run Artifacts

Every command execution creates a timestamped directory in `runs/`:

```
runs/
└── 2024-01-15T10-30-00-000Z/
    └── QA-Lens/
        └── validate/
            ├── request.json
            ├── response.json
            ├── metadata.json
            └── screenshot.png
```

### Observability

Connect to `http://localhost:3001/events` to stream real-time events:

```javascript
const evtSource = new EventSource('http://localhost:3001/events');
evtSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

## Contributing

This scaffold follows strict directory contracts. Before making changes:

1. Identify which agent owns the directory you want to modify
2. Ensure your changes respect the contract scopes
3. Run validation flows before committing

## License

MIT
