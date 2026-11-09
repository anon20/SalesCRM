/**
 * @file useKeyboardNavigation.js
 * @description Implements mouse-free keyboard control across the entire 50,000-deal table.
 *
 * REQUIREMENT COVERED:
 * "I can't use a mouse for long." -> "5. Work with the keyboard."
 *
 * HOTKEYS:
 * - `j` / `ArrowDown`: Move focus down 1 row (with automatic virtual scroll tracking)
 * - `k` / `ArrowUp`: Move focus up 1 row
 * - `x` / `Space`: Toggle selection on the focused deal
 * - `Shift + A`: Bulk-select all deals matching the current filter (even 10,000+ rows)
 * - `1` - `7`: Immediately move focused deal (or all selected deals) to Stage 1..7
 * - `Escape`: Clear active selection
 */

import { useEffect } from 'react';
import { STAGES } from '../constants/pipelineConfig';

export function useKeyboardNavigation({
  focusedIndex,
  setFocusedIndex,
  totalRows,
  ensureIndexVisible,
  onToggleSelectAtIndex,
  onSelectAllFiltered,
  onClearSelection,
  onTriggerStageMoveByHotkey,
  searchInputRef,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'select' || tag === 'textarea';

      if (isTyping) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.min(totalRows - 1, prev + 1);
          ensureIndexVisible(next);
          return next;
        });
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.max(0, prev - 1);
          ensureIndexVisible(next);
          return next;
        });
      } else if (e.key === 'x' || e.key === ' ') {
        e.preventDefault();
        onToggleSelectAtIndex(focusedIndex);
      } else if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        onSelectAllFiltered();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClearSelection();
      } else if (/^[1-7]$/.test(e.key)) {
        e.preventDefault();
        const stageIndex = parseInt(e.key, 10) - 1;
        const targetStage = STAGES[stageIndex];
        if (targetStage) {
          onTriggerStageMoveByHotkey(targetStage);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    focusedIndex,
    setFocusedIndex,
    totalRows,
    ensureIndexVisible,
    onToggleSelectAtIndex,
    onSelectAllFiltered,
    onClearSelection,
    onTriggerStageMoveByHotkey,
    searchInputRef,
  ]);
}
