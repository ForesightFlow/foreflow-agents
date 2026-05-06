import { OrchestratorSpecialist } from 'coordination-experiment';
import { loadAgentAccount, DRY_RUN } from '../../shared/env.js';
import { runAgentLoop } from '../../shared/agent_loop.js';

const config = new OrchestratorSpecialist();
const account = loadAgentAccount('ORCHESTRATOR');

if (DRY_RUN) console.log('[foreflow-orchestrator] dry-run mode — no on-chain transactions');

await runAgentLoop('foreflow-orchestrator', config, account);
