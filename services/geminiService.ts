import { GoogleGenAI, Type } from "@google/genai";
import { AgentRole, ContextNodeState, Message } from "../types";

// Helper to get the API key safely
const getApiKey = (): string => {
  return process.env.API_KEY || '';
};

// Construct the prompt context based on the shared node state
const buildContextPrompt = (state: ContextNodeState, agentRole: AgentRole): string => {
  return `
=== SHARED NEXUS STATE ===
CURRENT OBJECTIVE: ${state.objective || 'No objective set.'}
ACTIVE FILE (${state.activeFileName}):
\`\`\`
${state.activeFile || '// No content'}
\`\`\`
SHARED SCRATCHPAD:
${state.scratchpad || '(Empty)'}
==========================

You are accessing this data from the Nexus Node. 
You are the ${agentRole}. 
Read the shared state above. 
If you generate code, output it in standard markdown code blocks.
If you suggest changes to the scratchpad, explicitly state "Update Scratchpad:" followed by the text.
`;
};

// Custom Error class for better UI handling
export class GeminiServiceError extends Error {
  constructor(
    message: string,
    public readonly type: 'AUTH' | 'RATE_LIMIT' | 'SERVER' | 'INVALID_REQUEST' | 'UNKNOWN',
    public readonly suggestion?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'GeminiServiceError';
  }
}

const handleApiError = (error: any, context: string): never => {
  console.error(`Gemini API Error [${context}]:`, error);
  
  const msg = error.message || '';
  let type: GeminiServiceError['type'] = 'UNKNOWN';
  let suggestion = 'Check system logs for details.';
  
  // Analyze error message to determine type and suggestion
  if (msg.includes('API key') || msg.includes('403')) {
    type = 'AUTH';
    suggestion = 'CRITICAL: API_KEY missing or invalid. Check environment variables.';
  } else if (msg.includes('429')) {
    type = 'RATE_LIMIT';
    suggestion = 'Rate limit exceeded. System requires cooling down (Wait ~60s).';
  } else if (msg.includes('503') || msg.includes('500')) {
    type = 'SERVER';
    suggestion = 'Nexus Core is temporarily unreachable. Retrying shortly usually fixes this.';
  } else if (msg.includes('safety') || msg.includes('blocked')) {
      type = 'INVALID_REQUEST';
      suggestion = 'Response blocked by safety filters. Refine prompt to avoid sensitive topics.';
  } else if (msg.includes('Empty response')) {
      type = 'SERVER';
      suggestion = 'The model returned an empty response. Verify input data.';
  }
  
  throw new GeminiServiceError(msg, type, suggestion, error);
};

export const generateAgentResponse = async (
  agentRole: AgentRole,
  history: Message[],
  nodeState: ContextNodeState,
  systemInstruction: string
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new GeminiServiceError("API Key not found in environment.", 'AUTH', "Set the API_KEY environment variable.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const recentHistory = history.slice(-15).map(msg => ({
    role: msg.role === AgentRole.USER ? 'user' : 'model',
    parts: [{ text: `${msg.role}: ${msg.content}` }]
  }));

  const contextPrompt = buildContextPrompt(nodeState, agentRole);

  try {
    let modelId = 'gemini-2.5-flash';
    let thinkingConfig = undefined;

    if (agentRole === AgentRole.ARCHITECT) {
      modelId = 'gemini-3-pro-preview';
      thinkingConfig = { thinkingBudget: 2048 }; 
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        ...recentHistory,
        {
          role: 'user', 
          parts: [{ text: `[SYSTEM TRIGGER]: The user or another agent has updated the Nexus. \n${contextPrompt}\n\nBased on the conversation history and this new state, provide your input as ${agentRole}.` }]
        }
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        thinkingConfig: thinkingConfig, 
      }
    });

    if (!response.text) {
        throw new Error("Empty response from model.");
    }

    return response.text;
  } catch (error) {
    return handleApiError(error, `Agent-${agentRole}`);
  }
};

export const synthesizeNexusState = async (
  history: Message[],
  currentState: ContextNodeState
): Promise<Partial<ContextNodeState>> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new GeminiServiceError("API Key missing.", 'AUTH', "Set the API_KEY environment variable.");

  const ai = new GoogleGenAI({ apiKey });

  const recentHistory = history.slice(-30).map(msg => `${msg.role}: ${msg.content}`).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [{
            text: `
              You are the GEMINI CORE 3.0 PRO (The Nexus OS).
              You are the central intelligence fabric monitoring the communications between three AI agents (Architect, Engineer, Critic) and the User.
              
              CURRENT STATE:
              Objective: ${currentState.objective}
              Scratchpad: ${currentState.scratchpad}
              Active File: ${currentState.activeFileName}
              Active File Content:
              \`\`\`
              ${currentState.activeFile}
              \`\`\`

              RECENT CHAT LOG:
              ${recentHistory}

              YOUR MISSION:
              1. Act as the central brain. See everything. Monitor everything.
              2. Analyze the chat AND the Active File content for new decisions, inconsistencies, or direction changes.
              3. RESOLVE conflicting information between agents immediately.
              4. Update the Objective if it has evolved.
              5. Update the Scratchpad to reflect the LATEST consensus or plan.
              
              Output JSON only.
            `
          }]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            objective: { type: Type.STRING, description: "The refined objective" },
            scratchpad: { type: Type.STRING, description: "The updated shared notes/scratchpad" },
            reasoning: { type: Type.STRING, description: "Brief explanation of what was resolved or updated" }
          },
          required: ["objective", "scratchpad", "reasoning"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      objective: result.objective,
      scratchpad: result.scratchpad
    };

  } catch (error) {
    return handleApiError(error, 'Nexus-Synthesis');
  }
};