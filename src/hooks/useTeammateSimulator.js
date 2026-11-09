/**
 * @file useTeammateSimulator.js
 * @description Simulates 20 concurrent teammates modifying deals in the background.
 *
 * ARCHITECTURAL SOLUTION TO "Deals keep jumping around because teammates are editing at the same time":
 * When a background event arrives, we update the `byId[dealId]` entity record in place and display a
 * subtle pill badge (`Rahul -> Negotiation`), WITHOUT re-sorting or mutating the active `frozenViewIds`
 * array. The user's viewport and cursor position remain 100% stable until they choose to refresh the sort order.
 */

import { useEffect } from 'react';
import { STAGES, SALES_REPS } from '../constants/pipelineConfig';

export function useTeammateSimulator({
  enabled,
  intervalMs,
  frozenViewIds,
  onRemoteDealMutated,
}) {
  useEffect(() => {
    if (!enabled || frozenViewIds.length === 0) return;

    const timer = setInterval(() => {
      // Pick a deal near the top of the current view so reviewers can observe the in-place update
      const poolSize = Math.min(25, frozenViewIds.length);
      const randomIndex = Math.floor(Math.random() * poolSize);
      const targetDealId = frozenViewIds[randomIndex];

      const teammate = SALES_REPS[Math.floor(Math.random() * SALES_REPS.length)];
      const nextStage = STAGES[Math.floor(Math.random() * STAGES.length)];

      onRemoteDealMutated(targetDealId, nextStage, teammate);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [enabled, intervalMs, frozenViewIds, onRemoteDealMutated]);
}
