# foreflow-debate

Wraps the `PeerCritiqueDebate` configuration (Prediction 2 in paper §3.5).

Two agents independently forecast, then exchange critiques, then produce a final
revised probability each. The final prediction is the average of revised estimates.

Expected Murphy signature: lower REL (debate should reduce overconfidence), similar RES.
Predicted to improve calibration vs. ensemble by reducing systematic overconfidence.

## Run

```bash
# Dry-run (default — no on-chain transactions)
ANTHROPIC_API_KEY=... FOREFLOW_DEBATE_AGENT_KEY=0x... node dist/agents/foreflow-debate/agent.js

# Live broadcast
node dist/agents/foreflow-debate/agent.js --live
```
