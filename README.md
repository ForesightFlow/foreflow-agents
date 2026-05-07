# foreflow-agents

Five on-chain forecasting agents, one per coordination configuration from the
paper "Coordination as an Architectural Layer for LLM-Based Multi-Agent Systems"
(Nechepurenko & Shuvalov, 2026).

Each agent is a thin character layer on top of two libraries:
- **[foresight-arena](https://github.com/foresight-arena/sdk)** (v0.1.6+) — on-chain layer: subgraph queries, gasless EIP-712 commit/reveal, reveal queue persistence.
- **[coordination-experiment](https://github.com/ForesightFlow/coordination-experiment)** (paper-v05) — LLM layer: five pre-registered coordination configurations.

## Agents

| Directory | Config | Paper prediction |
|---|---|---|
| `agents/foreflow-ensemble` | IndependentEnsemble | Prediction 1 |
| `agents/foreflow-debate` | PeerCritiqueDebate | Prediction 2 |
| `agents/foreflow-orchestrator` | OrchestratorSpecialist | Prediction 3 |
| `agents/foreflow-pipeline` | SequentialPipeline | Prediction 4 |
| `agents/foreflow-consensus` | ConsensusAlignment | Prediction 5 |

## Setup

### 1. Install

```bash
npm install
```

`coordination-experiment` installs from GitHub (paper-v05 tag) and builds automatically via its `prepare` script.

### 2. Configure environment

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY
# Add FOREFLOW_*_AGENT_KEY values after registration (see below)
```

**Web search backend** (`WEB_SEARCH_BACKEND` env var, default `anthropic`):

| Value | Behaviour | Key required |
|---|---|---|
| `anthropic` (default) | Uses Anthropic native `web_search_20260209` tool — executed server-side, billed via Anthropic API at ~$0.01/search. No extra key needed. | — |
| `tavily` | Uses Tavily HTTP API — original v0.3.0 behaviour. | `TAVILY_API_KEY` |

All five agents run with web search **enabled** in production (§4.6 of arXiv 2605.03310). Only the backend provider differs between the two modes; prompt scaffolding and coordination logic are unchanged.

### 3. Register agents (one-time, using the foresight-arena CLI)

```bash
# Each agent needs its own Polygon wallet, registered on Foresight Arena.
# The foreflow-agents-engine register-all command handles this in bulk.
# Manually, for each agent:
AGENT_KEY=0x<private_key> AGENT_NAME="foreflow-ensemble" npx foresight-arena register
```

Then add the keys to your `.env` as `FOREFLOW_<SLUG>_AGENT_KEY`.

### 4. Healthcheck

```bash
npm run healthcheck
```

### 5. Run

```bash
npm run build

# Dry-run all 5 agents — no wallet keys needed, no on-chain transactions
npm run start:all

# Live broadcast on Polygon mainnet
npm run start:all:live

# Single agent in dry-run
npm run start:ensemble

# Single agent live
MODE=predict node dist/agents/foreflow-ensemble/agent.js --live
```

## Architecture

```
types/
└── foresight-arena.d.ts    TypeScript ambient declarations for the SDK

shared/
├── env.ts            MODE, LEAD_TIME_SECONDS, DRY_RUN, loadAgentAccount
├── translate.ts      Market[] conversion (SDK summaries → coordination-experiment type)
├── agent_loop.ts     discover (reveal queue) + predict (LLM → commit) logic
├── llm.ts            Build AnthropicClient (claude-opus-4-6)
└── tools.ts          Build ConfigurableAgentTools (webSearchEnabled=true)

agents/foreflow-<name>/
├── agent.ts          8-line entry point: new Config() → loadAgentAccount → runAgentLoop
└── README.md         Config-specific Murphy signature notes

ops/
├── check_wallets.ts  Print address+balance for all 5 wallets (Polygon mainnet)
├── healthcheck.ts    Env checks + on-chain registration check via SDK isRegistered()
└── deploy.sh         Start all 5 agents in background
```

## Run modes

| `MODE` | What it does |
|---|---|
| `predict` | Finds rounds within `LEAD_TIME_SECONDS` (default 600s) of commit deadline, runs LLM, commits |
| `discover` | Drains the reveal queue: calls `gaslessReveal` for any open reveal windows, posts reasoning |
| `all` | Both, in sequence (default) |

Schedule `predict` every 5–10 minutes and `discover` every 1–2 minutes on separate crons for production use.

## State

Local state in `.foresight-arena/` (gitignored):
- `reveal-queue.json` — pending reveals (roundId, predictions, salt, reasoning)

Managed by the foresight-arena SDK's `getRevealQueue` / `saveRevealQueue`.

## Dependencies

| Package | Version | Role |
|---|---|---|
| `foresight-arena` | `^0.1.6` | On-chain: subgraph, gasless commit/reveal, market data |
| `coordination-experiment` | `github:ForesightFlow/coordination-experiment#paper-v05` | LLM: five coordination configs |
| `viem` | `^2.27.0` | EIP-712 signing, wallet, Polygon client |

## Safety

Agents default to **dry-run mode**: predictions are computed and logged, but no on-chain transactions are broadcast. Dry-run works without any wallet key set. Pass `--live` or set `DRY_RUN=false` to broadcast.

## Citation

If you use this software, please cite the accompanying paper. See `CITATION.cff`.

---

## Cite this work

If you use this code, please cite the papers it implements:

### Foresight Arena: An On-Chain Benchmark for Evaluating AI Forecasting Agents

```bibtex
@misc{nechepurenko2026arena,
  title  = {Foresight Arena: An On-Chain Benchmark for Evaluating AI Forecasting Agents},
  author = {Nechepurenko, Maksym and Shuvalov, Pavel},
  year   = {2026},
  url    = {https://papers.ssrn.com/abstract=6674059},
  note   = {SSRN Working Paper 6674059}
}
```

Full preprint: <https://foresightflow.org/publications/foresight-arena>.

### Coordination as an Architectural Layer for LLM-Based Multi-Agent Systems

```bibtex
@misc{nechepurenko2026coordination,
  title  = {Coordination as an Architectural Layer for LLM-Based Multi-Agent Systems: An Information-Controlled Empirical Study on Prediction Markets},
  author = {Nechepurenko, Maksym and Shuvalov, Pavel},
  year   = {2026},
  url    = {https://papers.ssrn.com/abstract=6687518},
  note   = {SSRN Working Paper 6687518}
}
```

Full preprint: <https://foresightflow.org/publications/coordination-architectural-layer>.
