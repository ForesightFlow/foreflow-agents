# foreflow-pipeline

Wraps the `SequentialPipeline` configuration (Prediction 4 in paper §3.5).

A fixed sequence of roles processes the market in order: researcher gathers data,
analyst interprets it, forecaster emits a final probability. Each stage sees the
prior stage's output.

Expected Murphy signature: lower UNC (sequential refinement reduces uncertainty),
good REL (structured roles reduce overconfidence), high RES.
Predicted to achieve the best overall Brier score on Phase 0.5.

## Run

```bash
# Dry-run (default — no on-chain transactions)
ANTHROPIC_API_KEY=... FOREFLOW_PIPELINE_AGENT_KEY=0x... node dist/agents/foreflow-pipeline/agent.js

# Live broadcast
node dist/agents/foreflow-pipeline/agent.js --live
```
