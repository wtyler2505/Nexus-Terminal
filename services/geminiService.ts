import { GoogleGenAI, Type, FunctionDeclaration, Tool } from "@google/genai";
import { AgentRole, ContextNodeState, Message, AgentResponse, ToolCall } from "../types";

// Helper to get the API key safely
const getApiKey = (): string => {
  return process.env.API_KEY || '';
};

// Tool Definitions
const updateNexusStateTool: FunctionDeclaration = {
  name: 'update_nexus_state',
  description: 'Update the shared Nexus state. Use this to change the Objective, add to the Scratchpad, or overwrite the Active File content. This is your primary way to "do work" on the project.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      objective: { type: Type.STRING, description: 'New objective statement.' },
      scratchpad: { type: Type.STRING, description: 'Appended notes or updated plan.' },
      activeFileName: { type: Type.STRING, description: 'Rename the active file.' },
      activeFileContent: { type: Type.STRING, description: 'The new content for the active file.' }
    }
  }
};

const getActiveFileTool: FunctionDeclaration = {
  name: 'get_active_file',
  description: 'Read the current content and metadata of the active file. Useful to verify the state of the artifact before or after edits.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const TOOLS: Tool[] = [{
  functionDeclarations: [updateNexusStateTool, getActiveFileTool]
}];

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
You have access to tools to update this state directly.
If you generate code in text, output it in standard markdown code blocks.
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
  
  // Attempt to extract Request ID or status details
  const requestId = error.requestId || error.response?.headers?.get('x-goog-request-id') || 'N/A';
  const status = error.status || error.response?.status || 'N/A';

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
  
  const detailedMsg = `${msg} (Status: ${status}, RequestID: ${requestId})`;
  throw new GeminiServiceError(detailedMsg, type, suggestion, { ...error, requestId, status });
};

export const generateAgentResponse = async (
  agentRole: AgentRole,
  history: Message[],
  nodeState: ContextNodeState,
  systemInstruction: string
): Promise<AgentResponse> => {
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
        tools: TOOLS
      }
    });

    if (!response.candidates?.[0]) {
        throw new Error("Empty response candidates from model.");
    }

    const candidate = response.candidates[0];
    let text = "";
    const toolCalls: ToolCall[] = [];

    // Parse parts for text and function calls
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          text += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: 'call_' + Math.random().toString(36).substr(2, 9),
            name: part.functionCall.name,
            args: part.functionCall.args,
            status: 'pending' // Initial status
          });
        }
      }
    }

    return { text, toolCalls };
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