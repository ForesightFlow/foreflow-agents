# foreflow-ensemble

Wraps the `IndependentEnsemble` configuration (Prediction 1 in paper §3.5).

Three agents independently research and forecast each market; their probabilities
are averaged with equal weight. No inter-agent communication.

Expected Murphy signature: moderate UNC, moderate REL, moderate RES.
Predicted to be the baseline — neither the best nor worst on REL×RES.

## Run

```bash
# Dry-run (default — no on-chain transactions)
ANTHROPIC_API_KEY=... FOREFLOW_ENSEMBLE_AGENT_KEY=0x... node dist/agents/foreflow-ensemble/agent.js

# Live broadcast
node dist/agents/foreflow-ensemble/agent.js --live
```
