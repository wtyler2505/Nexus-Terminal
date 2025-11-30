# AI Integration Guide

Nexus Terminal heavily relies on the Google Gemini API. All interactions are handled in `services/geminiService.ts`.

## Model Configuration

We use a tiered model strategy to balance cost/speed with intelligence.

| Role | Model | Reason |
| :--- | :--- | :--- |
| **Architect** | `gemini-3-pro-preview` | Requires high reasoning capability for planning. |
| **Nexus Core** | `gemini-3-pro-preview` | The "Brain" requires the best context window and reasoning to synthesize state. |
| **Engineer** | `gemini-2.5-flash` | Optimized for speed and syntax correctness. |
| **Critic** | `gemini-2.5-flash` | Optimized for fast scanning and pattern recognition. |

### Thinking Mode
The **Architect** role utilizes the `thinkingConfig` (budget: 2048 tokens). This allows the model to output a hidden internal monologue before generating the final response, improving logical consistency for complex architectural plans.

## The "Nexus State" Prompt Pattern

Every agent request injects the **Shared Nexus State** at the very top of the prompt. This forces the model to ignore its latent training data in favor of the current project context.

```text
=== SHARED NEXUS STATE ===
CURRENT OBJECTIVE: {objective}
ACTIVE FILE ({filename}):
{file_content}
SHARED SCRATCHPAD:
{scratchpad}
==========================
```

## Gemini Core Synthesis

The `synthesizeNexusState` function is unique. It does not act as a chatbot.
1.  **Input**: Chat History + Full Context State.
2.  **Instruction**: "Act as the central intelligence fabric... Monitor inconsistencies... Update the Objective."
3.  **Output**: Strictly **JSON**.
4.  **Schema**:
    ```json
    {
      "objective": "Updated string...",
      "scratchpad": "Updated notes...",
      "reasoning": "Why I made this change..."
    }
    ```

## Error Handling

We implement a custom `GeminiServiceError` class to handle API-specific failure modes:
*   **429 (Rate Limit)**: Suggests a 60s cooldown.
*   **503 (Overloaded)**: Suggests a retry.
*   **Safety Filters**: Notifies the user to rephrase.

These errors are caught in `App.tsx` and displayed as red system messages in the chat stream.
