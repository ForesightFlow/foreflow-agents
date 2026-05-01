# foreflow-consensus

Wraps the `ConsensusAlignment` configuration (Prediction 5 in paper §3.5).

Multiple agents iteratively share and update their probabilities until convergence
(within `convergenceTolerance`) or `maxInternalRounds` is reached. Final prediction
is the converged probability.

Expected Murphy signature: lowest REL (consensus suppresses overconfidence), but may
sacrifice RES (averaging toward consensus reduces discrimination).
Predicted to have the worst Brier score due to REL-RES trade-off — confirmed in Phase 0.5.

## Run

```bash
# Dry-run (default — no on-chain transactions)
ANTHROPIC_API_KEY=... FOREFLOW_CONSENSUS_AGENT_KEY=0x... node dist/agents/foreflow-consensus/agent.js

# Live broadcast
node dist/agents/foreflow-consensus/agent.js --live
```
