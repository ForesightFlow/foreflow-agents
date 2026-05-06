import { IndependentEnsemble } from 'coordination-experiment';
import { loadAgentAccount, DRY_RUN } from '../../shared/env.js';
import { runAgentLoop } from '../../shared/agent_loop.js';

const config = new IndependentEnsemble();
const account = loadAgentAccount('ENSEMBLE');

if (DRY_RUN) console.log('[foreflow-ensemble] dry-run mode — no on-chain transactions');

await runAgentLoop('foreflow-ensemble', config, account);
