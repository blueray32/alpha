# Alpha

A composable, closed-loop, multi-agent application scaffold.

## Structure
- `agents/` — orchestrator and agent definitions
- `slash/` — reusable command templates (/plan, /build, /validate, /observe)
- `skills/` — autonomous workflows
- `specs/` — machine-readable plans (source of truth)
- `runs/` — logs and artifacts from executions
- `checks/` — validation flows, assertions, screenshots
- `observability/` — dashboards, hooks, SLOs
- `contracts/` — directory scopes and pre-merge rules

## Quick start
1. Define a feature in `specs/feature-example.yaml`.
2. Run `/plan` to break the work into tasks and acceptance criteria.
3. Run `/build` to implement within directory scopes.
4. Run `/validate` to execute `checks/flows` and gate merges.
