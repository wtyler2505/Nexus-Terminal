# CLAUDE.md - AI Assistant Guide for Nexus Terminal

## Project Overview

**Nexus Terminal** is a local-first, AI-powered collaborative development environment ("War Room") where multiple AI personas (Architect, Engineer, Critic) share a single mutable state context to build software or solve complex problems.

**Core Innovation:** Solves the "context fragmentation" problem by forcing all agents to read from and write to a shared "Context Board" rather than relying solely on chat history.

**Key Characteristics:**
- Client-side only (no backend server)
- All data persists in browser localStorage
- Multi-agent sequential collaboration with priority-based execution
- Google Gemini API integration for AI capabilities

## Quick Reference

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

**Environment Setup:** Create `.env.local` in root with:
```
GEMINI_API_KEY=your_api_key_here
```

## Architecture

### Directory Structure

```
/home/user/Nexus-Terminal/
├── App.tsx                    # Main controller, state management, event loop
├── types.ts                   # TypeScript interfaces and enums
├── index.tsx                  # React application entry point
├── index.html                 # HTML template with Tailwind CDN
├── vite.config.ts             # Vite build configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies and scripts
├── components/
│   ├── AgentCard.tsx          # AI persona status display
│   ├── ChatInterface.tsx      # Message stream, voice input, send interface
│   ├── ContextBoard.tsx       # Shared state editor (objective, scratchpad, code)
│   └── SettingsModal.tsx      # Configuration dialog
├── services/
│   └── geminiService.ts       # Google GenAI SDK integration, tool definitions
└── docs/
    ├── README.md              # Feature overview
    ├── ARCHITECTURE.md        # System design deep dive
    ├── DEVELOPER_GUIDE.md     # UI component mapping, extending features
    └── AI_INTEGRATION.md      # Model strategy, prompt engineering
```

### Core Data Model

The application state centers on `ContextNodeState`:

```typescript
interface ContextNodeState {
  objective: string;       // High-level goal
  scratchpad: string;      // Shared memory/notes
  activeFile: string;      // Content of the file being worked on
  activeFileName: string;  // The filename
}
```

### Agent System

Four agent roles defined in `types.ts`:
- `ARCHITECT` - Uses `gemini-3-pro-preview` with thinking mode (2048 budget)
- `ENGINEER` - Uses `gemini-2.5-flash`
- `CRITIC` - Uses `gemini-2.5-flash`
- `USER` - Human operator

Agent priorities: `HIGH`, `NORMAL`, `LOW`

### Event Loop Flow

1. User sends message to target (ALL agents or specific agent)
2. Agents added to queue, sorted by priority (High → Low)
3. Sequential execution - each agent sees previous agent's output
4. Tool calls processed and results appended to history
5. Optional: Auto-synthesis by Gemini Core on significant changes

## Technology Stack

| Layer | Technology |
|-------|------------|
| UI Framework | React 19.2.0 |
| Language | TypeScript 5.8.2 |
| Build Tool | Vite 6.2.0 |
| Styling | Tailwind CSS 3 (via CDN) |
| AI | Google GenAI SDK (`@google/genai` v1.30.0) |
| State | React hooks + localStorage |

## Key Files Reference

| File | Purpose |
|------|---------|
| `App.tsx` | Main controller - state management, agent orchestration, event handling |
| `types.ts` | All TypeScript interfaces and enums |
| `services/geminiService.ts` | Gemini API client, tool definitions, error handling |
| `components/ChatInterface.tsx` | Message UI, voice input (Web Speech API), target selector |
| `components/ContextBoard.tsx` | Shared state editor, diff view, sync controls |
| `components/AgentCard.tsx` | Agent status, priority, mute controls |
| `vite.config.ts` | Dev server (port 3000), env variable injection |

## Code Conventions

### TypeScript Patterns

- Use string enums for type safety: `enum AgentRole { ARCHITECT = 'ARCHITECT' }`
- Props interfaces for all components
- Centralized types in `types.ts`
- Path aliases: `@/*` maps to root

### React Patterns

- Functional components with hooks
- `useState` for UI state, `useRef` for DOM/mutable refs
- `useEffect` for side effects (persistence, speech recognition)
- Debounced state saves (2s delay)

### Naming Conventions

- Components: PascalCase (`AgentCard.tsx`)
- Services: camelCase (`geminiService.ts`)
- Constants: UPPER_SNAKE_CASE (`TOOLS`, `AGENTS`)
- Interfaces: PascalCase (`ContextNodeState`)

### Styling

- Tailwind utility classes throughout
- Cyberpunk aesthetic: indigo, emerald, rose, slate, amber
- Consistent spacing patterns: `px-4`, `py-3`
- Animations: `animate-pulse`, `animate-ping`, `animate-spin`

## AI Tool System

Two tools available to agents (defined in `geminiService.ts`):

### `update_nexus_state`
Updates shared state - primary way agents "do work"
```typescript
{
  objective?: string,       // New objective
  scratchpad?: string,      // Updated notes
  activeFileName?: string,  // Rename file
  activeFileContent?: string // New file content
}
```

### `get_active_file`
Reads current file content and metadata (no parameters)

## Common Development Tasks

### Adding a New Tool

1. Define `FunctionDeclaration` in `services/geminiService.ts`
2. Add to `TOOLS` array
3. Handle execution in `App.tsx` inside `triggerAgent`
4. (Optional) Custom rendering in `ChatInterface.tsx`

### Adding a New Agent

1. Add role to `AgentRole` enum in `types.ts`
2. Add config to `AGENTS` object in `App.tsx`
3. Initialize state in `App.tsx` (`agentStatuses`, `agentPriorities`)

### Modifying AI Behavior

- System instructions: `AGENTS` config in `App.tsx`
- Model selection: `generateAgentResponse()` in `geminiService.ts`
- Context building: `buildContextPrompt()` in `geminiService.ts`

## Persistence

| localStorage Key | Content | Strategy |
|-----------------|---------|----------|
| `nexus_context_state` | ContextNodeState | Debounced auto-save (2s) |
| `nexus_user_name` | Display name | Save on change |
| `nexus_critical_errors` | Last 5 errors | Save on error |

## Error Handling

Custom `GeminiServiceError` class with types:
- `AUTH` - API key issues
- `RATE_LIMIT` - 429 errors
- `SERVER` - 5xx errors
- `INVALID_REQUEST` - Safety blocks
- `UNKNOWN` - Other errors

## Testing

**Current Status:** No test infrastructure exists.

Recommended additions:
- Unit tests: Vitest (integrates well with Vite)
- E2E tests: Playwright or Cypress
- Component tests: React Testing Library

## Important Algorithms

### LCS Diff Detection (`App.tsx`)
- Files <600 lines: Full LCS dynamic programming
- Files >600 lines: Line count heuristic
- Threshold: Triggers synthesis if >5 lines changed

## Common Pitfalls

1. **API Key**: Must be in `.env.local` as `GEMINI_API_KEY`
2. **Voice Input**: Requires browser permissions + HTTPS in production
3. **Model Names**: `gemini-3-pro-preview` and `gemini-2.5-flash` are specific versions
4. **State Mutations**: Always update via React setState, not direct mutation

## Working with This Codebase

When making changes:
1. Read existing code before modifying - especially `App.tsx` for state logic
2. Follow existing patterns for consistency
3. Test with the dev server (`npm run dev`)
4. Check browser console for Gemini API errors
5. Verify localStorage persistence after changes

When adding features:
1. Check `/docs` for architectural guidance
2. Add types to `types.ts` first
3. Follow the tool pattern for agent capabilities
4. Consider impact on sequential agent execution order
