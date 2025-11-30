export enum AgentRole {
  ARCHITECT = 'ARCHITECT',
  ENGINEER = 'ENGINEER',
  CRITIC = 'CRITIC',
  USER = 'USER'
}

export interface AgentConfig {
  id: AgentRole;
  name: string;
  avatar: string;
  color: string;
  systemInstruction: string;
  description: string;
}

export interface Message {
  id: string;
  role: AgentRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface ContextNodeState {
  objective: string;
  scratchpad: string;
  activeFile: string;
  activeFileName: string;
}

export interface ToolCall {
  tool: string;
  args: any;
}