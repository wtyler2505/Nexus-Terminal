export enum AgentRole {
  ARCHITECT = 'ARCHITECT',
  ENGINEER = 'ENGINEER',
  CRITIC = 'CRITIC',
  USER = 'USER'
}

export enum AgentPriority {
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW'
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
  toolCalls?: ToolCall[];
}

export interface ContextNodeState {
  objective: string;
  scratchpad: string;
  activeFile: string;
  activeFileName: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: any;
  status?: 'pending' | 'success' | 'failure';
  outcome?: string;
}

export interface AgentResponse {
  text: string;
  toolCalls: ToolCall[];
}