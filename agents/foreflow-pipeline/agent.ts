import { SequentialPipeline } from 'coordination-experiment';
import { loadAgentAccount, DRY_RUN } from '../../shared/env.js';
import { runAgentLoop } from '../../shared/agent_loop.js';

const config = new SequentialPipeline();
const account = loadAgentAccount('PIPELINE');

if (DRY_RUN) console.log('[foreflow-pipeline] dry-run mode — no on-chain transactions');

await runAgentLoop(config, account);
