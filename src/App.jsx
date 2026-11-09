/**
 * @file App.jsx
 * @description Root orchestrator combining Normalized State, O(1) Virtualized Table,
 * Optimistic UI Rollbacks, Batch Quarter-End Operations, and Stable Viewport Concurrency.
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Keyboard,
  Search,
  Sparkles,
  Layers,
  ArrowUpCircle,
} from 'lucide-react';
import { STAGES, STAGE_COLORS, SALES_REPS, VIRTUALIZATION_CONFIG } from './constants/pipelineConfig';
import { formatINR, formatDaysAgo } from './utils/formatters';
import { generateNormalizedDeals } from './utils/dealGenerator';
import { simulateStageSaveRequest } from './services/mockNetworkService';
import { useVirtualizer } from './hooks/useVirtualizer';
import { useTeammateSimulator } from './hooks/useTeammateSimulator';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { ChaosControlPanel } from './components/ChaosControlPanel';

export default function App() {
  // 1. Normalized 50,000 Deal Store
  const initialStore = useMemo(() => generateNormalizedDeals(50000), []);
  const [byId, setById] = useState(initialStore.byId);
  const [allIds] = useState(initialStore.allIds);

  // 2. Filter & Preset Workflow State ("I don't know which deals to work on today")
  const [workflowPreset, setWorkflowPreset] = useState('ALL'); // 'ALL' | 'TODAY_PRIORITY' | 'QUARTER_END_STALE'
  const [stageFilter, setStageFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 3. Stable Viewport Freeze Layer ("Deals keep jumping around because teammates are editing")
  const [frozenViewIds, setFrozenViewIds] = useState(initialStore.allIds);
  const [queuedTeammateCount, setQueuedTeammateCount] = useState(0);

  // 4. Selection & Keyboard Focus State
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);

  // 5. Network Chaos & Toast Rollback State
  const [chaosConfig, setChaosConfig] = useState({
    minLatencyMs: 300,
    maxLatencyMs: 1500,
    failureRate: 0.10,
    teammateIntervalMs: 2800,
    teammateSyncEnabled: true,
  });
  const [toasts, setToasts] = useState([]);

  const scrollContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Recompute filtered/sorted view ONLY when the user explicitly changes filters/presets
  const computeFilteredIds = useCallback(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = [];

    for (let i = 0; i < allIds.length; i++) {
      const id = allIds[i];
      const d = byId[id];
      if (!d) continue;

      if (workflowPreset === 'TODAY_PRIORITY') {
        if (d.owner !== 'Priya') continue;
        if (d.stage !== 'Negotiation' && d.stage !== 'Proposal Sent') continue;
      } else if (workflowPreset === 'QUARTER_END_STALE') {
        if (d.daysStale < 60 || d.stage === 'Won' || d.stage === 'Lost') continue;
      }

      if (stageFilter !== 'ALL' && d.stage !== stageFilter) continue;
      if (ownerFilter !== 'ALL' && d.owner !== ownerFilter) continue;
      if (q && !d.company.toLowerCase().includes(q) && !d.id.toLowerCase().includes(q)) continue;

      matched.push(id);
    }

    if (workflowPreset === 'TODAY_PRIORITY') {
      matched.sort((a, b) => byId[b].priorityScore - byId[a].priorityScore);
    }

    return matched;
  }, [allIds, byId, workflowPreset, stageFilter, ownerFilter, searchQuery]);

  // Apply filter changes initiated by the user
  useEffect(() => {
    const nextIds = computeFilteredIds();
    setFrozenViewIds(nextIds);
    setFocusedIndex(0);
    setQueuedTeammateCount(0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [workflowPreset, stageFilter, ownerFilter, searchQuery]);

  // Virtualizer Hook
  const {
    totalHeight,
    startIndex,
    endIndex,
    firstVisibleRow,
    lastVisibleRow,
    renderedDomNodes,
    onScroll,
    ensureIndexVisible,
  } = useVirtualizer(frozenViewIds.length, scrollContainerRef);

  const visibleSlice = useMemo(
    () => frozenViewIds.slice(startIndex, endIndex),
    [frozenViewIds, startIndex, endIndex]
  );

  // Background Teammate Simulator (Updates data in place without re-sorting rows)
  const handleRemoteDealMutated = useCallback((dealId, nextStage, teammateName) => {
    setById((prev) => {
      const existing = prev[dealId];
      if (!existing || existing.syncStatus === 'saving') return prev;
      return {
        ...prev,
        [dealId]: {
          ...existing,
          stage: nextStage,
          remoteTeammateNote: `${teammateName} → ${nextStage}`,
        },
      };
    });
    setQueuedTeammateCount((c) => c + 1);
  }, []);

  useTeammateSimulator({
    enabled: chaosConfig.teammateSyncEnabled,
    intervalMs: chaosConfig.teammateIntervalMs,
    frozenViewIds,
    onRemoteDealMutated: handleRemoteDealMutated,
  });

  // Optimistic Mutation & Automatic Rollback Engine
  const moveDealsOptimistically = useCallback(
    async (dealIds, targetStage) => {
      if (!dealIds || dealIds.length === 0) return;

      // 1. Capture Snapshot of Prior Stages for Atomic Rollback
      const previousStageSnapshot = {};
      setById((prev) => {
        const next = { ...prev };
        for (const id of dealIds) {
          if (next[id]) {
            previousStageSnapshot[id] = next[id].stage;
            next[id] = {
              ...next[id],
              stage: targetStage,
              syncStatus: 'saving',
              errorMessage: null,
            };
          }
        }
        return next;
      });

      // 2. Dispatch to Unreliable Network Simulator
      try {
        await simulateStageSaveRequest(chaosConfig);
        setById((prev) => {
          const next = { ...prev };
          for (const id of dealIds) {
            if (next[id]) {
              next[id] = { ...next[id], syncStatus: 'idle', errorMessage: null };
            }
          }
          return next;
        });
      } catch (err) {
        // 3. Rollback to Snapshot & Notify User with 1-Click Retry
        setById((prev) => {
          const next = { ...prev };
          for (const id of dealIds) {
            if (next[id] && previousStageSnapshot[id]) {
              next[id] = {
                ...next[id],
                stage: previousStageSnapshot[id],
                syncStatus: 'error',
                errorMessage: 'Save failed — reverted',
              };
            }
          }
          return next;
        });

        const toastId = `${Date.now()}-${Math.random()}`;
        const label =
          dealIds.length === 1
            ? `${byId[dealIds[0]]?.company || dealIds[0]} failed to move to "${targetStage}". Reverted.`
            : `Bulk move of ${dealIds.length.toLocaleString()} deals to "${targetStage}" failed. Reverted.`;

        setToasts((prev) => [
          { id: toastId, message: label, dealIds, targetStage },
          ...prev.slice(0, 3),
        ]);
      }
    },
    [chaosConfig, byId]
  );

  // Selection Handlers
  const toggleSelectDeal = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAtIndex = useCallback(
    (index) => {
      const targetId = frozenViewIds[index];
      if (targetId) toggleSelectDeal(targetId);
    },
    [frozenViewIds, toggleSelectDeal]
  );

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === frozenViewIds.length) return new Set();
      return new Set(frozenViewIds);
    });
  }, [frozenViewIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleTriggerStageMoveByHotkey = useCallback(
    (targetStage) => {
      if (selectedIds.size > 0) {
        moveDealsOptimistically(Array.from(selectedIds), targetStage);
      } else {
        const focusedId = frozenViewIds[focusedIndex];
        if (focusedId) moveDealsOptimistically([focusedId], targetStage);
      }
    },
    [selectedIds, frozenViewIds, focusedIndex, moveDealsOptimistically]
  );

  useKeyboardNavigation({
    focusedIndex,
    setFocusedIndex,
    totalRows: frozenViewIds.length,
    ensureIndexVisible,
    onToggleSelectAtIndex: handleToggleSelectAtIndex,
    onSelectAllFiltered: handleSelectAllFiltered,
    onClearSelection: handleClearSelection,
    onTriggerStageMoveByHotkey: handleTriggerStageMoveByHotkey,
    searchInputRef,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>Velocity Sales Pipeline</span>
            <span className="text-xs font-mono bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full">
              50,000 Deals • O(1) Normalized Store
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Keyboard-first virtualized grid with optimistic rollback & non-jumping teammate concurrency
          </p>
        </div>

        {/* Keyboard Hotkey Legend */}
        <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">
          <Keyboard className="w-4 h-4 text-indigo-400" />
          <span>Hotkeys:</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200 font-mono">j/k</kbd>
          <span>Navigate</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200 font-mono">x</kbd>
          <span>Select</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200 font-mono">Shift+A</kbd>
          <span>Select All</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200 font-mono">1-7</kbd>
          <span>Move Stage</span>
        </div>
      </header>

      {/* Chaos Simulator Controls */}
      <ChaosControlPanel chaosConfig={chaosConfig} setChaosConfig={setChaosConfig} />

      {/* Toast Notifications for Failed Saves */}
      {toasts.length > 0 && (
        <div className="mb-4 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between bg-rose-950/90 border border-rose-700 text-rose-100 px-4 py-2.5 rounded-lg text-xs shadow-lg"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{t.message}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setToasts((prev) => prev.filter((item) => item.id !== t.id));
                    moveDealsOptimistically(t.dealIds, t.targetStage);
                  }}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded cursor-pointer"
                >
                  Retry Now
                </button>
                <button
                  onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                  className="text-rose-300 hover:text-white px-2 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Workflow Presets ("I don't know which deals to work on today" & Quarter-End Bulk Cleanup) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setWorkflowPreset('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              workflowPreset === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            All Pipeline Deals (50,000)
          </button>
          <button
            onClick={() => setWorkflowPreset('TODAY_PRIORITY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition ${
              workflowPreset === 'TODAY_PRIORITY'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-emerald-300 border border-emerald-900/60 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Priya&apos;s Focus Today (High Priority)</span>
          </button>
          <button
            onClick={() => setWorkflowPreset('QUARTER_END_STALE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              workflowPreset === 'QUARTER_END_STALE'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-900 text-amber-300 border border-amber-900/60 hover:bg-slate-800'
            }`}
          >
            Quarter-End Stale (&gt;60d Old)
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company or DEAL-ID (/)"
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
          >
            <option value="ALL">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
          >
            <option value="ALL">All 20 Reps</option>
            {SALES_REPS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-950/90 border border-indigo-700 px-4 py-2.5 rounded-xl mb-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-indigo-200">
              {selectedIds.size.toLocaleString()} deals selected
            </span>
            {selectedIds.size < frozenViewIds.length && (
              <button
                onClick={handleSelectAllFiltered}
                className="underline text-indigo-300 hover:text-white cursor-pointer"
              >
                Select all {frozenViewIds.length.toLocaleString()} matching deals
              </button>
            )}
            <button
              onClick={handleClearSelection}
              className="text-slate-300 hover:text-white cursor-pointer"
            >
              Clear (Esc)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-indigo-200 mr-1">Bulk Move To:</span>
            {STAGES.map((st, idx) => (
              <button
                key={st}
                onClick={() => moveDealsOptimistically(Array.from(selectedIds), st)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-indigo-600 text-slate-100 rounded border border-indigo-700/60 cursor-pointer transition"
              >
                [{idx + 1}] {st}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Non-Disruptive Teammate Sync Banner */}
      {queuedTeammateCount > 0 && (
        <div className="flex items-center justify-between bg-violet-950/60 border border-violet-800/80 px-4 py-2 rounded-lg mb-3 text-xs text-violet-200">
          <span>
            <strong>{queuedTeammateCount} background updates</strong> applied in-place by teammates without shifting your scroll position.
          </span>
          <button
            onClick={() => {
              setFrozenViewIds(computeFilteredIds());
              setQueuedTeammateCount(0);
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-violet-700 hover:bg-violet-600 text-white rounded font-medium cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Re-Sort &amp; Refresh Order</span>
          </button>
        </div>
      )}

      {/* Virtualized Table Telemetry & Record Count Bar */}
      <div className="bg-slate-900 border border-b-0 border-slate-800 rounded-t-xl px-4 py-2 flex flex-wrap items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-4">
          <span>
            Total Records in Table:{' '}
            <strong className="text-white font-mono">
              {frozenViewIds.length.toLocaleString()}
            </strong>{' '}
            of <span className="font-mono">{allIds.length.toLocaleString()}</span>
          </span>
          <span className="text-slate-500">|</span>
          <span>
            Viewport Rows:{' '}
            <strong className="text-emerald-400 font-mono">
              #{firstVisibleRow.toLocaleString()} – #{lastVisibleRow.toLocaleString()}
            </strong>{' '}
            <span className="text-slate-400 font-mono">({renderedDomNodes} DOM rows mounted)</span>
          </span>
        </div>

        {firstVisibleRow > 1 && (
          <button
            onClick={() => {
              if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
              setFocusedIndex(0);
            }}
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 cursor-pointer"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            <span>Jump to Row #1</span>
          </button>
        )}
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-12 items-center bg-slate-900/95 border border-slate-800 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <div className="col-span-1 flex items-center gap-2">
          <button onClick={handleSelectAllFiltered} className="cursor-pointer">
            {selectedIds.size > 0 && selectedIds.size === frozenViewIds.length ? (
              <CheckSquare className="w-4 h-4 text-indigo-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-500" />
            )}
          </button>
          <span>Row #</span>
        </div>
        <div className="col-span-3">Company &amp; Deal ID</div>
        <div className="col-span-2">Owner &amp; Age</div>
        <div className="col-span-2 text-right pr-4">Value (INR)</div>
        <div className="col-span-2">Pipeline Stage (1-7)</div>
        <div className="col-span-2 text-right">Sync &amp; Activity</div>
      </div>

      {/* Virtualized Viewport Container */}
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        style={{ height: `${VIRTUALIZATION_CONFIG.VIEWPORT_HEIGHT}px` }}
        className="overflow-y-auto bg-slate-950 border border-t-0 border-slate-800 rounded-b-xl relative"
      >
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          {visibleSlice.map((id, localIdx) => {
            const absoluteRowIndex = startIndex + localIdx;
            const deal = byId[id];
            if (!deal) return null;

            const isSelected = selectedIds.has(id);
            const isFocused = absoluteRowIndex === focusedIndex;

            return (
              <div
                key={id}
                onClick={() => setFocusedIndex(absoluteRowIndex)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${VIRTUALIZATION_CONFIG.ROW_HEIGHT}px`,
                  transform: `translateY(${absoluteRowIndex * VIRTUALIZATION_CONFIG.ROW_HEIGHT}px)`,
                }}
                className={`grid grid-cols-12 items-center px-4 border-b border-slate-900 text-xs transition-colors ${
                  isFocused
                    ? 'bg-indigo-950/60 ring-1 ring-inset ring-indigo-500'
                    : isSelected
                    ? 'bg-indigo-950/30'
                    : 'hover:bg-slate-900/60'
                }`}
              >
                {/* Row # & Checkbox */}
                <div className="col-span-1 flex items-center gap-2 font-mono text-slate-400">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectDeal(id)}
                    className="rounded accent-indigo-500 cursor-pointer"
                  />
                  <span>#{(absoluteRowIndex + 1).toLocaleString()}</span>
                </div>

                {/* Company & ID */}
                <div className="col-span-3 truncate pr-2">
                  <div className="font-medium text-slate-100 truncate">{deal.company}</div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {deal.id} • {deal.licences} licences
                  </div>
                </div>

                {/* Owner & Stale Age */}
                <div className="col-span-2">
                  <span className="text-slate-200">{deal.owner}</span>
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">
                    {formatDaysAgo(deal.daysStale)}
                  </span>
                </div>

                {/* Deal Value */}
                <div className="col-span-2 text-right pr-4 font-mono font-semibold text-slate-100">
                  {formatINR(deal.value)}
                </div>

                {/* Stage Selector */}
                <div className="col-span-2">
                  <select
                    value={deal.stage}
                    onChange={(e) => moveDealsOptimistically([id], e.target.value)}
                    className={`text-xs px-2 py-1 rounded border font-medium cursor-pointer ${
                      STAGE_COLORS[deal.stage] || 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s} className="bg-slate-900 text-slate-100">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sync & Teammate Status */}
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  {deal.syncStatus === 'saving' && (
                    <span className="inline-flex items-center gap-1 text-amber-400 text-[11px]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </span>
                  )}
                  {deal.syncStatus === 'error' && (
                    <span className="inline-flex items-center gap-1 text-rose-400 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Reverted
                    </span>
                  )}
                  {deal.syncStatus === 'idle' && deal.remoteTeammateNote && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-950/90 border border-violet-700 text-violet-300 truncate max-w-[150px]">
                      {deal.remoteTeammateNote}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
