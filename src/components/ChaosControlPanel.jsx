/**
 * @file ChaosControlPanel.jsx
 * @description Interactive simulator bar allowing evaluators to tune network latency,
 * failure probability, and background teammate edit frequency in real time.
 */

import React from 'react';
import { Sliders, WifiOff, Users, Activity } from 'lucide-react';

export function ChaosControlPanel({ chaosConfig, setChaosConfig }) {
  return (
    <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 mb-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
          <Sliders className="w-4 h-4" />
          <span>Evaluator Network & Concurrency Simulator</span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs">
          {/* Failure Rate Slider */}
          <label className="flex items-center gap-2 text-slate-300">
            <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            <span>Save Failure Rate:</span>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={Math.round(chaosConfig.failureRate * 100)}
              onChange={(e) =>
                setChaosConfig((c) => ({ ...c, failureRate: Number(e.target.value) / 100 }))
              }
              className="w-24 accent-rose-500 cursor-pointer"
            />
            <span className="font-mono font-bold text-rose-400 w-9">
              {Math.round(chaosConfig.failureRate * 100)}%
            </span>
          </label>

          {/* Latency Slider */}
          <label className="flex items-center gap-2 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Max Network Delay:</span>
            <input
              type="range"
              min="300"
              max="2500"
              step="100"
              value={chaosConfig.maxLatencyMs}
              onChange={(e) =>
                setChaosConfig((c) => ({ ...c, maxLatencyMs: Number(e.target.value) }))
              }
              className="w-24 accent-indigo-500 cursor-pointer"
            />
            <span className="font-mono text-indigo-300">
              {chaosConfig.minLatencyMs}–{chaosConfig.maxLatencyMs}ms
            </span>
          </label>

          {/* Teammate Concurrency Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={chaosConfig.teammateSyncEnabled}
              onChange={(e) =>
                setChaosConfig((c) => ({ ...c, teammateSyncEnabled: e.target.checked }))
              }
              className="rounded accent-emerald-500"
            />
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">
              Simulate 20 Teammates Editing ({chaosConfig.teammateIntervalMs / 1000}s)
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
