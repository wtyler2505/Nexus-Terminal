# System Architecture

Nexus Terminal operates on a **Client-Side Event-Driven Architecture**. There is no backend server for application logic; all "backend" operations are calls to the Gemini API via a service layer.

## High-Level Data Flow

1.  **User Input** (Text or Voice) -> Updates Chat History.
2.  **Agent Trigger** (Manual or Broadcast) -> `geminiService` called.
3.  **Prompt Construction**:
    *   Retrieves `ContextNodeState` (Objective, File, Scratchpad).
    *   Injects current Chat History.
    *   Injects Agent System Instruction.
4.  **AI Response** -> Updates Chat History.
5.  **Synthesis Loop**:
    *   If `activeFile` changes significantly (detected via LCS Diff), or if manually triggered:
    *   **Gemini Core** reads the entire state.
    *   **Gemini Core** returns a JSON patch to update `Objective` or `Scratchpad`.

## State Management (`App.tsx`)

The application state is centralized in `App.tsx` but persisted to `localStorage`.

### `ContextNodeState`
This is the single source of truth for the AI agents.
```typescript
interface ContextNodeState {
  objective: string;      // The current high-level goal
  scratchpad: string;     // Shared memory/notes between agents
  activeFile: string;     // The code/text artifact currently being worked on
  activeFileName: string; // Name of the artifact
}
```

### Persistence Strategy
*   **Auto-Save**: `nodeState` is saved to `localStorage` ('nexus_context_state') on a 2-second debounce.
*   **Error Logs**: Critical system errors are saved to `localStorage` ('nexus_critical_errors') to survive refreshes.

## File Change Detection
To prevent spamming the AI with minor keystrokes, the app uses a custom Diffing Engine:
1.  **Debounce**: Waits 3 seconds after typing stops.
2.  **Heuristic Check**: If file > 600 lines, uses fast line-count checks.
3.  **Precision Check**: Uses **Longest Common Subsequence (LCS)** algorithm to calculate exact edit distance.
4.  **Trigger**: If edits >= 5 lines, `handleAiSynthesize('AUTO')` is called.

## Component Hierarchy

```text
App (Main State Container)
├── Header (Status Indicators, Gemini Core heartbeat)
└── Main Grid
    ├── Sidebar
    │   ├── AgentList (AgentCard components)
    │   └── ActivityFeed (Chronological system logs)
    ├── ContextBoard (The mutable shared state UI)
    └── ChatInterface (The communication stream)
```
