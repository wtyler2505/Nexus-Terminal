# Developer Guide

## UI Component Map

This section maps every visual element in the application to its component and purpose.

### 1. Main Application Shell (`App.tsx`)
- **Header**: Contains the "Nexus Terminal" branding and global controls.
  - **Gear Icon**: Opens `SettingsModal`.
  - **SYS_LOGS Button**: Toggles the `System Audit Trail` overlay.
  - **Agent List**: Horizontal scrollable list of `AgentCard`s.
- **Sidebar (Left/Hidden on Mobile)**:
  - **Recent Activity Feed**: Mini-version of the audit log showing last ~20 events.

### 2. Agent Card (`components/AgentCard.tsx`)
Represents a single AI persona.
- **Avatar Circle**: Displays agent initial (A, E, C).
  - *State: Green Border* = Active/Processing.
  - *State: Red Pulse* = Error.
  - *State: Cyan Dot* = Unread Message.
- **Name/Status Text**: Shows "Idle", "Processing", or "Unread".
- **Priority Button** (Top Right): Cycles Priority (LOW -> NORMAL -> HIGH).
- **Mute Toggle** (Top Right): Microphone icon. Grays out the agent and skips them in broadcast queues.

### 3. Chat Interface (`components/ChatInterface.tsx`)
The primary communication channel.
- **Target Selector** (Top of Input):
  - **BROADCAST_ALL**: Messages trigger all unmuted agents sequentially.
  - **@Agent**: Triggers only that specific agent.
- **Input Field**: Text area for commands.
- **Microphone Button**:
  - *Click*: Starts Web Speech API listener.
  - *State: Red Pulse*: Currently recording.
- **Send Button**: Submits the message.
- **Message Bubbles**:
  - **User**: Right-aligned, indigo.
  - **Agent**: Left-aligned, slate.
  - **Tool Call Cards**: Nested inside agent messages. Shows Status (Pending/Success/Fail) and Output.

### 4. Context Board (`components/ContextBoard.tsx`)
The mutable state editor.
- **Header**:
  - **EXECUTE SYNC Button**: Manually triggers `synthesizeNexusState`.
  - **Gemini Core Indicator**: Visual heartbeat.
- **Primary Directive**: Textarea for `nodeState.objective`.
- **Shared Memory Bank**: Textarea for `nodeState.scratchpad`.
- **Active Artifact**:
  - **Filename Input**: Renames the active file.
  - **Copy Button**: Copies content to clipboard.
  - **COMPARE/HIDE DIFF Button**: Toggles the Diff View overlay (Green highlights for new lines).
  - **Editor**: Main code editing textarea.

### 5. Settings Modal (`components/SettingsModal.tsx`)
- **Operator Identity**: Input to change your display name.
- **Factory Reset**: Red danger button that clears `localStorage` and reloads the page.

## Adding a New Feature

### How to add a new Tool
1. Define the `FunctionDeclaration` in `services/geminiService.ts`.
2. Add it to the `TOOLS` array.
3. Update `App.tsx` inside `triggerAgent` to handle the execution logic (e.g., `if (tool.name === 'my_new_tool') ...`).
4. (Optional) Update `ChatInterface.tsx` if you need custom rendering for the result.

### How to add a new Agent
1. Update `AgentRole` enum in `types.ts`.
2. Add configuration to `AGENTS` object in `App.tsx` (Name, Color, System Instruction).
3. Initialize their state in `App.tsx` (`agentStatuses`, `agentPriorities`, etc.).

## Troubleshooting

- **"API Key Missing"**: Check your `.env` file and ensure it is loaded.
- **"Microphone not working"**: Check browser permissions. The app requests permissions in `metadata.json`.
- **"Agents ignoring instructions"**: Check the `systemInstruction` in `App.tsx`. The Core 3.0 Pro model respects these strictly.