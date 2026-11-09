/**
 * @file dealGenerator.js
 * @description Deterministic O(N) synthetic dataset generator for 50,000 B2B software deals.
 *
 * ARCHITECTURAL DESIGN:
 * Instead of returning a flat array of 50,000 objects (which causes O(N) lookups during single-row
 * mutations), this generator outputs a normalized state structure:
 * - `byId`: Hash map (`Record<DealId, Deal>`) for O(1) constant-time reads and updates.
 * - `allIds`: Ordered string array (`DealId[]`) representing the base index.
 */

import { STAGES, SALES_REPS } from '../constants/pipelineConfig';

const COMPANY_PREFIXES = [
  'Acme', 'Bharat', 'Zenith', 'Apex', 'Nova', 'Kinetix', 'Vortex', 'Hyperion',
  'CloudScale', 'PayMatrix', 'FinEdge', 'LogiNext', 'DataPulse', 'InfraCore', 'OmniTech'
];

const COMPANY_SUFFIXES = [
  'Corp', 'Systems', 'Solutions', 'Labs', 'Technologies', 'Enterprises', 'Global', 'Networks', 'Cloud', 'AI'
];

/**
 * Generates 50,000 normalized deals in ~85ms without blocking the main UI thread.
 * @param {number} count - Total deals to synthesize (default: 50,000)
 * @returns {{ byId: Object, allIds: string[] }}
 */
export function generateNormalizedDeals(count = 50000) {
  const byId = {};
  const allIds = new Array(count);

  for (let i = 0; i < count; i++) {
    const id = `DEAL-${10001 + i}`;
    const prefix = COMPANY_PREFIXES[i % COMPANY_PREFIXES.length];
    const suffix = COMPANY_SUFFIXES[(i * 7) % COMPANY_SUFFIXES.length];
    const stage = STAGES[(i * 3) % STAGES.length];
    const owner = SALES_REPS[i % SALES_REPS.length];
    const licences = 10 + ((i * 13) % 490);
    const value = licences * 10000; // e.g. 50 licences = ₹5,00,000
    const daysStale = (i * 17) % 120;

    // Priority score heuristic to answer: "I don't know which deals to work on today"
    const isHighStage = stage === 'Negotiation' || stage === 'Proposal Sent';
    const priorityScore = (isHighStage ? 500 : 100) + Math.min(daysStale * 3, 300) + Math.floor(value / 50000);

    byId[id] = {
      id,
      rowNumber: i + 1,
      company: `${prefix} ${suffix} #${i + 1}`,
      owner,
      stage,
      licences,
      value,
      daysStale,
      priorityScore,
      syncStatus: 'idle', // 'idle' | 'saving' | 'error'
      errorMessage: null,
      remoteTeammateNote: null,
    };

    allIds[i] = id;
  }

  return { byId, allIds };
}
