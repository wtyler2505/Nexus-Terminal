import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AgentConfig, AgentRole, ContextNodeState, Message } from './types';
import AgentCard, { AgentStatus } from './components/AgentCard';
import ContextBoard from './components/ContextBoard';
import ChatInterface from './components/ChatInterface';
import { generateAgentResponse, synthesizeNexusState, GeminiServiceError } from './services/geminiService';

// --- Configuration ---
const AGENTS: Record<AgentRole, AgentConfig> = {
  [AgentRole.ARCHITECT]: {
    id: AgentRole.ARCHITECT,
    name: 'Architect',
    avatar: 'A',
    color: 'sky',
    description: 'Structure, patterns, high-level design.',
    systemInstruction: `You are the ARCHITECT. 
    Your role: Analyze the user's request against the current Nexus objective. Focus on system architecture, data models, and high-level strategy.
    Constraints: Do not write implementation code unless asked for a schema.
    Tone: Professional, direct, authoritative but collaborative.`
  },
  [AgentRole.ENGINEER]: {
    id: AgentRole.ENGINEER,
    name: 'Engineer',
    avatar: 'E',
    color: 'amber',
    description: 'Implementation, syntax, concrete code.',
    systemInstruction: `You are the ENGINEER.
    Your role: Look at the ARCHITECT'S plan and the SHARED SCRATCHPAD, then generate concrete code or commands.
    Constraints: Be precise. Focus on syntax. Use the 'ACTIVE ARTIFACT' in the context node to read/write code.
    Tone: Technical, terse, practical.`
  },
  [AgentRole.CRITIC]: {
    id: AgentRole.CRITIC,
    name: 'Critic',
    avatar: 'C',
    color: 'rose',
    description: 'Security, edge cases, vulnerability scan.',
    systemInstruction: `You are the CRITIC.
    Your role: Review the objective and the code in the 'ACTIVE ARTIFACT'. Find bugs, security flaws, or logical inconsistencies.
    Constraints: Be critical. Don't be polite if the code is bad.
    Tone: Skeptical, sharp, protective.`
  },
  [AgentRole.USER]: {
    id: AgentRole.USER,
    name: 'Operator',
    avatar: 'U',
    color: 'indigo',
    description: 'User',
    systemInstruction: ''
  }
};

const INITIAL_STATE: ContextNodeState = {
  objective: 'Initialize Project Nexus. Define the core module structure.',
  scratchpad: '- Waiting for agent inputs...\n- Establish core data types.\n- Verify API capabilities.',
  activeFileName: 'schema.ts',
  activeFile: `// Active Artifact Context
// Paste code or data here for the swarm to analyze.`
};

// --- Helpers ---

// Calculate Longest Common Subsequence length for line arrays
// Uses O(min(m,n)) space optimization
const calculateLCSLength = (lines1: string[], lines2: string[]): number => {
  const m = lines1.length;
  const n = lines2.length;
  
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    // Swap references for next iteration
    [prev, curr] = [curr, prev];
  }
  return prev[n];
};

// Check if file content has changed significantly to warrant an AI interrupt
const isSignificantChange = (prev: string, current: string): boolean => {
  if (prev === current) return false;

  const prevLines = prev.split('\n').map(l => l.trim()).filter(Boolean);
  const currLines = current.split('\n').map(l => l.trim()).filter(Boolean);

  // Performance Guard: For very large files (> 600 lines), fallback to faster heuristics
  // Running LCS O(N*M) on large files can freeze the main thread.
  if (prevLines.length > 600 || currLines.length > 600) {
    // Fallback Heuristic 1: Line count change >= 5
    if (Math.abs(currLines.length - prevLines.length) >= 5) return true;

    // Fallback Heuristic 2: Unique new lines >= 5
    const prevSet = new Set(prevLines);
    let newUniqueCount = 0;
    for (const line of currLines) {
      if (!prevSet.has(line)) newUniqueCount++;
      if (newUniqueCount >= 5) return true;
    }
    return false;
  }

  // Accurate LCS Diffing for reasonable file sizes
  const lcsLength = calculateLCSLength(prevLines, currLines);
  
  // Calculate total edit distance (additions + deletions)
  // Lines Added = currLines.length - lcsLength
  // Lines Removed = prevLines.length - lcsLength
  const totalChanges = (currLines.length - lcsLength) + (prevLines.length - lcsLength);

  // Threshold: 5 significant line edits
  return totalChanges >= 5;
};

// State Loader Helper
const getSavedState = (): ContextNodeState => {
  try {
    const saved = localStorage.getItem('nexus_context_state');
    if (saved) {
      return { ...INITIAL_STATE, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to load state", e);
  }
  return INITIAL_STATE;
};

interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error';
}

const App: React.FC = () => {
  // Use lazy initialization for state
  const [nodeState, setNodeState] = useState<ContextNodeState>(getSavedState);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: AgentRole.ARCHITECT,
      content: 'Nexus Uplink Established. Standing by for project parameters.',
      timestamp: Date.now()
    }
  ]);
  const [processingAgents, setProcessingAgents] = useState<Set<AgentRole>>(new Set());
  const [failedAgents, setFailedAgents] = useState<Set<AgentRole>>(new Set());
  const [mutedAgents, setMutedAgents] = useState<Set<AgentRole>>(new Set());
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
  
  const fileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track the version of the file that was last synthesized by the AI.
  const lastSynthesizedContentRef = useRef<string>(nodeState.activeFile);

  // --- Helper: Logging ---
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setActivityLog(prev => [{
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      message,
      type
    }, ...prev].slice(0, 30)); // Keep last 30 logs
  }, []);

  // --- Effects ---

  // Check for persisted errors on mount
  useEffect(() => {
    try {
      const storedErrorsRaw = localStorage.getItem('nexus_critical_errors');
      if (storedErrorsRaw) {
        const storedErrors = JSON.parse(storedErrorsRaw);
        if (Array.isArray(storedErrors) && storedErrors.length > 0) {
          const errorReport = storedErrors.map((e: any) =>
            `> [${new Date(e.timestamp).toLocaleTimeString()}] **${e.context}**: ${e.message}`
          ).join('\n');

          setMessages(prev => [...prev, {
            id: `sys-err-${Date.now()}`,
            role: AgentRole.ARCHITECT,
            content: `**[SYSTEM RESTORE]**: Recovered critical error logs from previous session:\n${errorReport}\n\n*Logs cleared from persistent storage.*`,
            timestamp: Date.now()
          }]);
          
          addLog("System logs recovered from storage", 'info');
          localStorage.removeItem('nexus_critical_errors');
        }
      }
    } catch (e) {
      console.error("Failed to recover error logs", e);
    }
  }, [addLog]);

  // Auto-save State to LocalStorage with debounce
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      try {
        localStorage.setItem('nexus_context_state', JSON.stringify(nodeState));
      } catch (e) {
        console.error("Failed to auto-save state:", e);
      }
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [nodeState]);

  // --- Logic ---

  const handleSystemError = (context: string, error: any) => {
    console.error(`Error in ${context}:`, error);
    const errorMessage = error.message || 'Unknown system failure.';
    let suggestion = '';

    if (error instanceof GeminiServiceError && error.suggestion) {
       suggestion = `\n> **SUGGESTION**: ${error.suggestion}`;
    }
    
    // Log to activity feed
    addLog(`Error in ${context}: ${errorMessage}`, 'error');

    // Persist to LocalStorage
    try {
      const existingErrors = JSON.parse(localStorage.getItem('nexus_critical_errors') || '[]');
      const newError = {
        context,
        message: errorMessage,
        timestamp: Date.now()
      };
      const updatedErrors = [...existingErrors, newError].slice(-5);
      localStorage.setItem('nexus_critical_errors', JSON.stringify(updatedErrors));
    } catch (storageError) {
      console.error("Failed to persist error:", storageError);
    }

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: AgentRole.ARCHITECT, // Visually System/Architect
      content: `**[SYSTEM ALERT]**: Critical failure in ${context}.\n> ERROR: ${errorMessage}${suggestion}`,
      timestamp: Date.now()
    }]);
  };

  const toggleMute = (role: AgentRole) => {
    setMutedAgents(prev => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
        addLog(`${AGENTS[role].name} re-activated`, 'info');
      } else {
        next.add(role);
        addLog(`${AGENTS[role].name} muted`, 'info');
      }
      return next;
    });
  };

  const triggerAgent = useCallback(async (role: AgentRole, currentHistory: Message[]) => {
    if (mutedAgents.has(role)) return;

    setFailedAgents(prev => {
        const next = new Set(prev);
        next.delete(role);
        return next;
    });
    setProcessingAgents(prev => new Set(prev).add(role));
    
    // addLog(`${AGENTS[role].name} processing...`, 'info');
    
    try {
      const responseText = await generateAgentResponse(
        role, 
        currentHistory, 
        nodeState, 
        AGENTS[role].systemInstruction
      );

      const newMessage: Message = {
        id: Date.now().toString() + Math.random().toString(),
        role: role,
        content: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, newMessage]);
      addLog(`${AGENTS[role].name} responded`, 'success');

    } catch (e) {
      setFailedAgents(prev => new Set(prev).add(role));
      handleSystemError(`Node Connection (${role})`, e);
    } finally {
      setProcessingAgents(prev => {
        const next = new Set(prev);
        next.delete(role);
        return next;
      });
    }
  }, [nodeState, mutedAgents, addLog]);

  const handleSendMessage = useCallback(async (content: string, target: AgentRole | 'ALL') => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: AgentRole.USER,
      content: content,
      timestamp: Date.now()
    };
    
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    addLog(`Operator command sent`, 'info');

    if (target === 'ALL') {
      [AgentRole.ARCHITECT, AgentRole.ENGINEER, AgentRole.CRITIC].forEach(role => {
        if (!mutedAgents.has(role)) {
           triggerAgent(role, updatedHistory);
        }
      });
    } else {
      triggerAgent(target, updatedHistory);
    }

  }, [messages, triggerAgent, mutedAgents, addLog]);

  const handleAiSynthesize = useCallback(async (source: 'MANUAL' | 'AUTO' = 'MANUAL') => {
    setIsSynthesizing(true);
    if (source === 'MANUAL') addLog("Manual synthesis initiated...", 'info');
    
    lastSynthesizedContentRef.current = nodeState.activeFile;

    try {
      const updates = await synthesizeNexusState(messages, nodeState);
      
      const hasObjectiveChanged = updates.objective && updates.objective !== nodeState.objective;
      const hasScratchpadChanged = updates.scratchpad && updates.scratchpad !== nodeState.scratchpad;

      if (hasObjectiveChanged || hasScratchpadChanged) {
        setNodeState(prev => ({
          ...prev,
          objective: updates.objective || prev.objective,
          scratchpad: updates.scratchpad || prev.scratchpad
        }));

        if (source === 'MANUAL' || hasObjectiveChanged) {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: AgentRole.ARCHITECT, 
              content: `**[GEMINI 3.0 CORE]**: SYNTHESIS COMPLETE (${source}).\n*Updated Objective:* ${updates.objective}`,
              timestamp: Date.now()
            }]);
            addLog(`Nexus State Updated (${source})`, 'success');
        } else {
            addLog(`Nexus State Updated (Auto-Silent)`, 'info');
        }
      } else {
        if (source === 'MANUAL') addLog("Nexus State Stable (No Changes)", 'info');
      }
    } catch (e) {
      if (source === 'MANUAL') {
        handleSystemError('Nexus Synthesis', e);
      } else {
        console.warn('Auto-synthesis failed silently:', e);
        addLog("Auto-synthesis failed", 'error');
      }
    } finally {
      setIsSynthesizing(false);
    }
  }, [messages, nodeState, addLog]);

  // File Watcher
  useEffect(() => {
    if (nodeState.activeFile === lastSynthesizedContentRef.current) return;

    if (fileDebounceRef.current) clearTimeout(fileDebounceRef.current);

    fileDebounceRef.current = setTimeout(() => {
        const currentContent = nodeState.activeFile;
        const lastContent = lastSynthesizedContentRef.current;

        if (isSignificantChange(lastContent, currentContent)) {
             addLog("Detected significant file change", 'info');
             handleAiSynthesize('AUTO');
        }
    }, 3000);

    return () => {
        if (fileDebounceRef.current) clearTimeout(fileDebounceRef.current);
    };
  }, [nodeState.activeFile, handleAiSynthesize, addLog]);

  const lastActiveMap = messages.reduce((acc, msg) => {
    acc[msg.role] = msg.timestamp;
    return acc;
  }, {} as Record<AgentRole, number>);

  return (
    <div className="h-screen w-full bg-[#020617] text-slate-200 flex flex-col overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* Top Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950 flex items-center px-6 justify-between flex-shrink-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-lg tracking-tight text-slate-100 leading-none">NEXUS</h1>
            <span className="text-[9px] font-mono text-indigo-400 tracking-widest uppercase">Powered by Gemini 3.0 Pro</span>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">
             <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
             CORE_ONLINE
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Left Sidebar: Agents & Logs */}
        <div className="w-72 border-r border-slate-800 bg-[#050b1d] flex flex-col hidden md:flex z-20">
          
          {/* Agents List */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Connected Nodes</div>
            {Object.values(AGENTS).filter(a => a.id !== AgentRole.USER).map(agent => {
              let status: AgentStatus = 'idle';
              if (processingAgents.has(agent.id)) status = 'processing';
              else if (failedAgents.has(agent.id)) status = 'error';

              return (
                <AgentCard
                  key={agent.id}
                  config={agent}
                  isActive={true} 
                  status={status}
                  lastActive={lastActiveMap[agent.id]}
                  onClick={() => {}} 
                  isMuted={mutedAgents.has(agent.id)}
                  onToggleMute={() => toggleMute(agent.id)}
                />
              );
            })}
          </div>

          {/* Activity Feed Log */}
          <div className="h-1/3 border-t border-slate-800 bg-slate-950/50 flex flex-col min-h-[150px]">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">System Feed</span>
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-1">
              {activityLog.length === 0 && (
                <div className="text-slate-600 text-center italic mt-4">Initializing log...</div>
              )}
              {activityLog.map(log => (
                <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-200">
                  <span className="text-slate-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                  <span className={`
                    ${log.type === 'error' ? 'text-red-400' : 
                      log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}
                  `}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Center: Context Board */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col min-w-[300px] z-10">
          <ContextBoard 
            state={nodeState} 
            onChange={setNodeState}
            onAiSynthesize={() => handleAiSynthesize('MANUAL')}
            isSynthesizing={isSynthesizing}
          />
        </div>

        {/* Right: Chat Stream */}
        <div className="w-[450px] border-l border-slate-800 bg-[#030712] flex flex-col shadow-2xl z-20">
          <ChatInterface 
            messages={messages} 
            agents={AGENTS} 
            onSendMessage={handleSendMessage}
            isProcessing={processingAgents.size > 0}
          />
        </div>

      </main>
    </div>
  );
};

export default App;