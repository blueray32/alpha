# Orchestrator API

Minimal control plane for creating and commanding agents.

```
POST /agents            # body: { "type": "builder|validator|research", "name": "<string>", "profile": {} }
GET  /agents            # list agents
POST /agents/{id}/cmd   # body: { "slash": "/plan|/build|/validate|/observe", "payload": { ... } }
```
