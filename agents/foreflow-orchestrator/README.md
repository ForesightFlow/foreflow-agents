# foreflow-orchestrator

Wraps the `OrchestratorSpecialist` configuration (Prediction 3 in paper §3.5).

An orchestrator agent decomposes the question into sub-questions and dispatches
specialist agents for each. Specialists report sub-answers; orchestrator synthesizes
into a final probability.

Expected Murphy signature: higher RES (specialists improve discrimination), moderate REL.
Predicted to achieve the best Brier score on high-complexity markets.

## Run

```bash
# Dry-run (default — no on-chain transactions)
ANTHROPIC_API_KEY=... FOREFLOW_ORCHESTRATOR_AGENT_KEY=0x... node dist/agents/foreflow-orchestrator/agent.js

# Live broadcast
node dist/agents/foreflow-orchestrator/agent.js --live
```
