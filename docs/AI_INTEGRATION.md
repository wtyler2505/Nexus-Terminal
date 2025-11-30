# AI Integration Guide

Nexus Terminal is built on top of the **Google GenAI SDK** (`@google/genai`). This document details how we orchestrate the models.

## 1. Model Strategy

We use a "Right Model for the Right Job" approach to optimize for intelligence vs. speed.

| Role | Model ID | Config | Why? |
| :--- | :--- | :--- | :--- |
| **Architect** | `gemini-3-pro-preview` | `thinkingBudget: 2048` | Needs deep reasoning capabilities to break down abstract objectives into concrete technical plans. Thinking mode enables "Chain of Thought". |
| **Nexus Core** | `gemini-3-pro-preview` | `responseMimeType: "application/json"` | Needs massive context window to read full history + file, and strict JSON output for state patches. |
| **Engineer** | `gemini-2.5-flash` | Standard | Fast, efficient coding model. Good at following specific instructions. |
| **Critic** | `gemini-2.5-flash` | Standard | Fast pattern recognition for auditing and security checks. |

## 2. Prompt Engineering

### Context Injection
Every request to an agent is prefixed with the **Dynamic Context Block**. This overrides the model's internal training with the "Now".

```text
=== SHARED NEXUS STATE ===
CURRENT OBJECTIVE: [Dynamic content from State]
ACTIVE FILE (App.tsx):
```
[Dynamic content of the file]
```
SHARED SCRATCHPAD:
[Dynamic content from Scratchpad]
==========================
```

### System Instructions
Each agent has a rigid "Persona" defined in `App.tsx`:
- **Architect**: "You are the LEAD ARCHITECT... BREAK IT DOWN... Use 'update_nexus_state'..."
- **Engineer**: "You are the SENIOR ENGINEER... WRITE CODE... SAVE IT..."
- **Critic**: "You are SECURITY LEAD... AUDIT..."

## 3. Tool Definitions

The agents interact with the app via the `TOOLS` array defined in `services/geminiService.ts`.

### `update_nexus_state`
The primary "Effect" tool.
```typescript
{
  name: 'update_nexus_state',
  description: 'Update the shared Nexus state...',
  parameters: {
    objective: { type: STRING },
    scratchpad: { type: STRING },
    activeFileName: { type: STRING },
    activeFileContent: { type: STRING }
  }
}
```

### `get_active_file`
The primary "Sensor" tool.
```typescript
{
  name: 'get_active_file',
  description: 'Read the current content and metadata of the active file...',
  parameters: {}
}
```

## 4. Error Handling & Resilience

We use a custom `GeminiServiceError` class to handle API failures gracefully.

**Retry Logic:**
- **429 Rate Limit**: The UI suggests a 60s cooldown.
- **500 Server Error**: The UI suggests a retry.
- **Safety Block**: The UI warns the user that the prompt triggered safety filters.

**Visual Feedback:**
Errors are injected into the Chat Stream as system messages with a red distinct style:
`[SYSTEM ERROR] Rate limit exceeded...`