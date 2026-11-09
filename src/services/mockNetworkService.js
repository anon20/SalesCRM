/**
 * @file mockNetworkService.js
 * @description Simulates an unreliable, slow B2B backend API.
 *
 * REQUIREMENT COVERED:
 * "Handle a slow, unreliable network. Saves take 0.3–1.5 seconds, and about 1 in 10 fail.
 *  Let us adjust these while we test."
 */

/**
 * Simulates an asynchronous network mutation with configurable latency and random failure injection.
 * @param {Object} params
 * @param {number} params.minLatencyMs - Minimum delay in ms (default: 300ms)
 * @param {number} params.maxLatencyMs - Maximum delay in ms (default: 1500ms)
 * @param {number} params.failureRate - Probability of HTTP 500 failure from 0.0 to 1.0 (default: 0.10)
 * @returns {Promise<{ ok: boolean, latency: number }>}
 */
export async function simulateStageSaveRequest({ minLatencyMs, maxLatencyMs, failureRate }) {
  const span = Math.max(0, maxLatencyMs - minLatencyMs);
  const latency = Math.floor(minLatencyMs + Math.random() * span);

  await new Promise((resolve) => setTimeout(resolve, latency));

  const didFail = Math.random() < failureRate;
  if (didFail) {
    throw new Error(`HTTP 500: Network timeout after ${latency}ms`);
  }

  return { ok: true, latency };
}
