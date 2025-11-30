# System Architecture

Nexus Terminal operates on a **Client-Side Event-Driven Architecture**. It simulates a backend environment entirely within the browser using React State and LocalStorage.

## 1. Data Model (`ContextNodeState`)

The core of the application is the `ContextNodeState` object, which represents the "Mind" of the Nexus.

```typescript
interface ContextNodeState {
  objective: string;       // High-level goal (e.g., "Build a React App")
  scratchpad: string;      // Shared memory/todo list/notes
  activeFile: string;      // The actual content of the file being worked on
  activeFileName: string;  // The filename (e.g., "App.tsx")
}
```

## 2. The Event Loop & Priority Queue

The application does not use simple "Chat -> Reply" logic. It uses a **Sequential Priority Queue** to manage multi-agent collaboration.

**Flow:**
1. **User Input**: User types/speaks a message.
2. **Target Resolution**: The system determines which agents need to respond (`ALL` or specific Role).
3. **Queue Construction**: Agents are added to an execution queue.
   - If `ALL` is selected, agents are sorted by `AgentPriority` (High -> Low).
4. **Sequential Execution**:
   - **Agent A (High Priority)** executes first.
   - Agent A reads the *current* state + chat history.
   - Agent A generates a response + tool calls.
   - Agent A's output is appended to the local history.
   - **Agent B (Normal Priority)** executes next.
   - *Crucially*, Agent B sees Agent A's message in the history context, allowing for true collaboration.

## 3. Tool Execution System

Agents interact with the world via **Tools** defined in `geminiService.ts`.

| Tool Name | Purpose | Logic |
| :--- | :--- | :--- |
| `update_nexus_state` | Write access to Shared State | Updates `activeFile`, `objective`, or `scratchpad` in React State. |
| `get_active_file` | Read access to Active Artifact | Returns file name, size, and line count to the agent. |

**Feedback Loop:**
When an agent calls a tool:
1. The app detects the `functionCall` in the response.
2. The app executes the logic (e.g., `setNodeState`).
3. The app appends a "Tool Result" object to the message history.
4. The UI displays this result (Success/Failure) in the Chat Interface.

## 4. Automatic State Synthesis (The "Brain")

The **Gemini Core** acts as a supervisor background process.

**Trigger Conditions:**
1. **Manual**: User clicks "EXECUTE SYNC".
2. **Auto-Diff**: The `isSignificantChange` function detects changes in `activeFile`.

**The Diff Algorithm (LCS):**
To prevent spamming the API on every keystroke, we use a custom change detection algorithm:
- **Small Files (<600 lines)**: Uses **Longest Common Subsequence (LCS)** DP algorithm to calculate precise edit distance.
- **Large Files (>600 lines)**: Falls back to a heuristic (Line Count Diff).
- **Threshold**: Synthesis triggers only if edits > 5 lines.

**Synthesis Action:**
The Core reads the Chat History and Active File, then outputs a JSON Patch to update the `Objective` and `Scratchpad`, ensuring the "Plan" matches the "Reality".

## 5. Persistence Layer

All data is persisted to `localStorage` to ensure session continuity.

| Key | Content | Strategy |
| :--- | :--- | :--- |
| `nexus_context_state` | The `ContextNodeState` object. | Debounced Auto-Save (2s delay). |
| `nexus_user_name` | User's display name. | Saved on change. |
| `nexus_critical_errors`| Last 5 system crashes/errors. | Saved on error; Read on boot to notify user. |

## 6. Directory Structure

```
/src
├── App.tsx             # Main Controller (State, Effects, Routing)
├── types.ts            # Type Definitions (Interfaces, Enums)
├── services/
│   └── geminiService.ts # API Client, Tool Definitions, Error Handling
├── components/
│   ├── AgentCard.tsx   # Agent UI (Avatar, Status, Controls)
│   ├── ChatInterface.tsx # Message Stream, Input, Voice Logic
│   ├── ContextBoard.tsx # Editor, Diff View, Sync Controls
│   └── SettingsModal.tsx # Configuration Dialog
└── docs/               # You are here
```