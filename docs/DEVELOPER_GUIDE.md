# Developer Guide

## File Structure

```
/
├── index.html          # Entry point
├── index.tsx           # React Root
├── App.tsx             # Main Logic & State
├── types.ts            # TypeScript Definitions
├── services/
│   └── geminiService.ts # API Layer
├── components/
│   ├── AgentCard.tsx
│   ├── ContextBoard.tsx
│   └── ChatInterface.tsx
└── docs/               # Documentation
```

## How to Add a New Agent

1.  **Update `types.ts`**:
    Add a new key to the `AgentRole` enum.
    ```typescript
    export enum AgentRole {
      // ...
      DESIGNER = 'DESIGNER'
    }
    ```

2.  **Update `App.tsx`**:
    Add the configuration to the `AGENTS` constant.
    ```typescript
    [AgentRole.DESIGNER]: {
      id: AgentRole.DESIGNER,
      name: 'Designer',
      avatar: 'D',
      color: 'pink', // Tailwind color name
      description: 'UI/UX specialist.',
      systemInstruction: 'You are the Designer. Focus on aesthetics...'
    }
    ```

## Styling Guidelines

*   **Theme**: Cyberpunk / Terminal.
*   **Colors**:
    *   Backgrounds: `slate-950`, `slate-900`.
    *   Accents: `indigo-500` (Core), `sky-500` (Architect), `amber-500` (Engineer), `rose-500` (Critic).
*   **Borders**: Use thin borders `border border-slate-800` to define panels.
*   **Fonts**: `font-sans` for UI, `font-mono` for headers, code, and logs.

## Working with Speech API

The speech logic lives in `ChatInterface.tsx` inside a `useEffect`.
*   It checks for `window.SpeechRecognition` or `window.webkitSpeechRecognition`.
*   It writes directly to the `inputValue` state.
*   *Note*: Permissions must be granted in the browser. The `metadata.json` requests this permission.
