import { ConsensusAlignment } from 'coordination-experiment';
import { loadAgentAccount, DRY_RUN } from '../../shared/env.js';
import { runAgentLoop } from '../../shared/agent_loop.js';

const config = new ConsensusAlignment();
const account = loadAgentAccount('CONSENSUS');

if (DRY_RUN) console.log('[foreflow-consensus] dry-run mode — no on-chain transactions');

await runAgentLoop('foreflow-consensus', config, account);
