# Velocity — High-Scale 50,000 Deal Sales Pipeline

A keyboard-first, virtualized B2B sales pipeline application engineered to stay locked at **60 FPS with 50,000 deals**, handle **slow/unreliable networks (300–1500ms latency, 10% failure rate)** via atomic optimistic rollbacks, and absorb **live updates from 20 concurrent teammates** without shifting the user's scroll viewport.

---

## 1. Quick Start (Runs with One Command)

```bash
npm install && npm run dev
```

---

## 2. Modular Directory Structure

```text
velocity-sales-pipeline/
├── README.md                          # Complete System Design, UX Write-Up & Interview Guide
├── package.json
├── vite.config.js
└── src/
    ├── constants/
    │   └── pipelineConfig.js          # Pipeline stages, 20 sales reps, virtualization constants
    ├── utils/
    │   ├── dealGenerator.js           # O(N) normalized 50,000-deal generator (byId + allIds)
    │   └── formatters.js              # Indian Rupee (₹5,00,000) & relative age formatters
    ├── services/
    │   └── mockNetworkService.js      # Configurable latency (300-1500ms) & HTTP 500 chaos API
    ├── hooks/
    │   ├── useVirtualizer.js          # Custom O(1) viewport windowing math (mounts ~16 DOM rows)
    │   ├── useTeammateSimulator.js    # Background teammate mutation engine (in-place updates)
    │   └── useKeyboardNavigation.js   # Full keyboard control (j/k, x, Shift+A, 1-7 stage hotkeys)
    ├── components/
    │   └── ChaosControlPanel.jsx      # Real-time evaluator sliders for failure rate & delay
    └── App.jsx                        # Root state orchestrator & optimistic rollback engine
```

---

## 3. Product & UX Write-Up (Addressing the 5 User Pain Points)

### Why a Virtualized Data Grid Was Chosen Over a Trello/Kanban Board
A multi-column Kanban board was evaluated first and deliberately rejected for three reasons:
1. **Scale Breakdown at 10,000 Cards per Column:** Dragging cards horizontally across columns when a single stage holds 10,000 deals creates severe scroll fatigue and accidental drops.
2. **Quarter-End Bulk Operations:** Moving 3,000+ stale deals to `Lost` at quarter-end via drag-and-drop is impossible. A table view supports `Shift+A` bulk selection and single-keystroke batch transitions.
3. **Mouse-Free Ergonomics:** Sales reps who cannot use a mouse for long periods can navigate a 1D vertical table deterministically using `j`/`k` and number keys `1`–`7`.

### How Each User Quote Is Solved

| User Pain Point | Architectural & UX Solution |
| :--- | :--- |
| **"I don't know which deals to work on today."** | Added the **Priya's Focus Today** preset tab (`workflowPreset = 'TODAY_PRIORITY'`), which filters to high-intent stages (`Negotiation`, `Proposal Sent`) and sorts by a composite `priorityScore` (deal value + staleness). |
| **"I moved a deal, but it didn't save, and nobody told me."** | Implemented **Optimistic UI with Snapshot Rollback** in `moveDealsOptimistically()`. Before firing the network call, the prior stage of every affected deal is snapshotted (`previousStageSnapshot[id]`). If the request fails, the deal reverts to its original stage, displays a red `Reverted` badge, and surfaces an actionable toast with a **Retry Now** button. |
| **"Deals keep jumping around because teammates are editing at the same time."** | Decoupled the **Entity Data Store (`byId`)** from the **Active Viewport Order (`frozenViewIds`)**. When `useTeammateSimulator` mutates a deal, it updates `byId[id]` in place and attaches a badge (`Rahul → Negotiation`), while holding `frozenViewIds` fixed until the user clicks **Re-Sort & Refresh Order**. |
| **"At quarter end I need to move thousands of old deals to Lost..."** | Added the **Quarter-End Stale (>60d Old)** filter preset + `Shift+A` ("Select all X matching deals") + 1-click batch stage transition. |
| **"I can't use a mouse for long."** | `useKeyboardNavigation.js` provides full roving focus (`j`/`k` or `ArrowUp`/`ArrowDown`), selection (`x`/`Space`), select-all (`Shift+A`), and instant stage moves (`1`–`7`). |

---

## 4. What I Would Build With More Time

1. **Persistent Offline Outbox Queue (IndexedDB):** Queue failed or offline stage mutations in IndexedDB and replay them automatically when `window.ononline` fires.
2. **Web Worker Fuzzy Search & Multi-Column Sorting:** Offload full-text filtering and multi-key sorting of 50,000 records to a dedicated Web Worker thread.
3. **Optimistic Version Vectors (`version` field):** Detect true write-write collisions when a user and a remote teammate edit the exact same deal within the same 500ms window, presenting an inline conflict resolution prompt.
