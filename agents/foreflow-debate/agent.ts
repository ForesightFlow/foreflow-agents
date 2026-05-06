import { PeerCritiqueDebate } from 'coordination-experiment';
import { loadAgentAccount, DRY_RUN } from '../../shared/env.js';
import { runAgentLoop } from '../../shared/agent_loop.js';

const config = new PeerCritiqueDebate();
const account = loadAgentAccount('DEBATE');

if (DRY_RUN) console.log('[foreflow-debate] dry-run mode — no on-chain transactions');

await runAgentLoop('foreflow-debate', config, account);
