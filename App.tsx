import React, { useState, useRef, useEffect } from 'react';
import { AgentRole, AgentPriority, AgentConfig, Message, ContextNodeState } from './types';
import AgentCard, { AgentStatus } from './components/AgentCard';
import ContextBoard from './components/ContextBoard';
import ChatInterface from './components/ChatInterface';
import SettingsModal from './components/SettingsModal';
import { generateAgentResponse, synthesizeNexusState, GeminiServiceError } from './services/geminiService';

// --- LCS Algorithm for Diff Detection ---
const calculateLCSLength = (str1: string[], str2: string[]): number => {
  const m = str1.length;
  const n = str2.length;
  // Use two rows instead of full matrix to save space: O(min(m,n)) space
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
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

const AGENTS: Record<AgentRole, AgentConfig> = {
  [AgentRole.ARCHITECT]: {
    id: AgentRole.ARCHITECT,
    name: 'Architect',
    avatar: 'A',
    color: 'indigo',
    description: 'System Design & Strategy',
    systemInstruction: `You are the LEAD ARCHITECT. Your goal is to design a robust, scalable system based on the CURRENT OBJECTIVE.
PRIME DIRECTIVES:
1. Analyze the objective and the current state.
2. BREAK IT DOWN into a clear, numbered list of technical tasks.
3. You MUST use the 'update_nexus_state' tool to UPDATE the 'SCRATCHPAD' with this plan.
4. DECIDE on the filename for the next step and set 'activeFileName' using the tool.
5. DO NOT write the full implementation code yourself. Your job is to set the stage for the Engineer.
6. If the plan is already clear in the scratchpad, instruct the Engineer to execute the next step.`
  },
  [AgentRole.ENGINEER]: {
    id: AgentRole.ENGINEER,
    name: 'Engineer',
    avatar: 'E',
    color: 'emerald',
    description: 'Implementation & Code',
    systemInstruction: `You are the SENIOR SOFTWARE ENGINEER. Your specific job is to IMPLEMENT the tasks found in the SHARED SCRATCHPAD.
PRIME DIRECTIVES:
1. READ the Active File and Scratchpad tasks.
2. WRITE the complete, working code for the 'activeFileName'.
3. You MUST use the 'update_nexus_state' tool to SAVE your code to 'activeFileContent'.
4. Do not just provide code blocks in chat. If you wrote code, you must commit it to the file using the tool.
5. Follow the Architect's design patterns strictly.`
  },
  [AgentRole.CRITIC]: {
    id: AgentRole.CRITIC,
    name: 'Critic',
    avatar: 'C',
    color: 'rose',
    description: 'Review & Security',
    systemInstruction: `You are the SECURITY & QA LEAD.
PRIME DIRECTIVES:
1. AUDIT the 'activeFile' content strictly for bugs, security risks, or bad patterns.
2. Be harsh and concise. If you see a flaw, CALL IT OUT.
3. If the fix is small (typo, missing import), use 'update_nexus_state' to PATCH the 'activeFileContent' directly.
4. If the fix is large, REJECT the code and instruct the Engineer to fix it.
5. Ensure the code aligns with the OBJECTIVE.`
  },
  [AgentRole.USER]: {
    id: AgentRole.USER,
    name: 'User',
    avatar: 'U',
    color: 'slate',
    description: 'Human Operator',
    systemInstruction: ''
  }
};

const getPriorityValue = (p: AgentPriority) => {
  switch (p) {
    case AgentPriority.HIGH: return 3;
    case AgentPriority.NORMAL: return 2;
    case AgentPriority.LOW: return 1;
    default: return 0;
  }
};

const INITIAL_NODE_STATE: ContextNodeState = {
  objective: '',
  scratchpad: '',
  activeFile: '',
  activeFileName: 'nexus.ts'
};

const getSavedState = (): ContextNodeState => {
  try {
    const saved = localStorage.getItem('nexus_context_state');
    return saved ? JSON.parse(saved) : INITIAL_NODE_STATE;
  } catch (e) {
    console.warn("Failed to load state", e);
    return INITIAL_NODE_STATE;
  }
};

const getSavedUser = (): string => {
  return localStorage.getItem('nexus_user_name') || 'User';
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  // Initialize state from local storage
  const [nodeState, setNodeState] = useState<ContextNodeState>(getSavedState);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [userName, setUserName] = useState(getSavedUser);

  // Track last synthesized content for Diff View
  const lastSynthesizedContentRef = useRef<string>(nodeState.activeFile || '');
  
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentRole, AgentStatus>>({
    [AgentRole.ARCHITECT]: 'idle',
    [AgentRole.ENGINEER]: 'idle',
    [AgentRole.CRITIC]: 'idle',
    [AgentRole.USER]: 'idle'
  });
  
  const [agentPriorities, setAgentPriorities] = useState<Record<AgentRole, AgentPriority>>({
    [AgentRole.ARCHITECT]: AgentPriority.HIGH,
    [AgentRole.ENGINEER]: AgentPriority.NORMAL,
    [AgentRole.CRITIC]: AgentPriority.LOW,
    [AgentRole.USER]: AgentPriority.NORMAL
  });

  const [mutedAgents, setMutedAgents] = useState<Record<AgentRole, boolean>>({
    [AgentRole.ARCHITECT]: false,
    [AgentRole.ENGINEER]: false,
    [AgentRole.CRITIC]: false,
    [AgentRole.USER]: false
  });
  
  const [unreadAgents, setUnreadAgents] = useState<Record<AgentRole, boolean>>({
    [AgentRole.ARCHITECT]: false,
    [AgentRole.ENGINEER]: false,
    [AgentRole.CRITIC]: false,
    [AgentRole.USER]: false
  });
  
  const [failedAgents, setFailedAgents] = useState<Record<AgentRole, boolean>>({
     [AgentRole.ARCHITECT]: false,
     [AgentRole.ENGINEER]: false,
     [AgentRole.CRITIC]: false,
     [AgentRole.USER]: false
  });

  // System Audit Logs
  const [activityLog, setActivityLog] = useState<{id: string, timestamp: number, text: string, kind: 'INFO' | 'ERROR' | 'SUCCESS' | 'LOG'}[]>([]);
  const [showFullFeed, setShowFullFeed] = useState(false);
  const [feedFilter, setFeedFilter] = useState<AgentRole | 'ALL' | 'SYSTEM'>('ALL');

  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem('nexus_user_name', userName);
  }, [userName]);

  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('nexus_context_state', JSON.stringify(nodeState));
    }, 2000);
    return () => clearTimeout(handler);
  }, [nodeState]);

  useEffect(() => {
    // Check for critical errors on mount
    try {
      const savedErrors = localStorage.getItem('nexus_critical_errors');
      if (savedErrors) {
        const errors = JSON.parse(savedErrors);
        if (Array.isArray(errors) && errors.length > 0) {
           addSystemLog(`[SYSTEM RESTORE]: Recovered ${errors.length} critical error reports from previous session.`, 'ERROR');
           setMessages(prev => [...prev, {
             id: 'sys_restore',
             role: AgentRole.ARCHITECT, // Using Architect as system voice
             content: `**SYSTEM RESTORE REPORT**\nrecovered critical errors from previous session:\n${errors.map((e: any) => `- ${e.date}: ${e.message}`).join('\n')}`,
             timestamp: Date.now()
           }]);
           localStorage.removeItem('nexus_critical_errors');
        }
      }
    } catch(e) {}
  }, []);

  // --- Helper Functions ---
  const addSystemLog = (text: string, kind: 'INFO' | 'ERROR' | 'SUCCESS' | 'LOG' = 'LOG') => {
    setActivityLog(prev => [{
      id: Math.random().toString(36),
      timestamp: Date.now(),
      text,
      kind
    }, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  const markUnread = (exceptRole: AgentRole | 'NONE') => {
    setUnreadAgents(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        const role = k as AgentRole;
        if (role !== exceptRole && role !== AgentRole.USER) {
          next[role] = true;
        }
      });
      return next;
    });
  };

  const clearUnread = (role: AgentRole) => {
    setUnreadAgents(prev => ({ ...prev, [role]: false }));
  };

  const handleSystemError = (error: any, context: string) => {
    let message = "Unknown System Error";
    let suggestion = "";

    if (error instanceof GeminiServiceError) {
      message = `[${error.type}] ${error.message}`;
      suggestion = error.suggestion ? `\n\n> SUGGESTION: ${error.suggestion}` : "";
    } else if (error instanceof Error) {
      message = error.message;
    }

    addSystemLog(`FAILURE in ${context}: ${message}`, 'ERROR');
    
    // Persist critical errors
    try {
       const existing = JSON.parse(localStorage.getItem('nexus_critical_errors') || '[]');
       existing.push({ date: new Date().toISOString(), message, context });
       localStorage.setItem('nexus_critical_errors', JSON.stringify(existing.slice(-5)));
    } catch(e) {}

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: AgentRole.ARCHITECT, // System fallback
      content: `**SYSTEM ERROR** in ${context}\n\`${message}\`${suggestion}`,
      timestamp: Date.now()
    }]);
  };

  const getFullTimeline = () => {
    const logs = activityLog.map(l => ({ ...l, type: 'LOG' as const, agent: 'SYSTEM' }));
    const msgs = messages.map(m => ({ ...m, type: 'MSG' as const, agent: m.role === AgentRole.USER ? 'USER' : AGENTS[m.role]?.name, text: m.content }));
    return [...logs, ...msgs].sort((a, b) => b.timestamp - a.timestamp);
  };

  // --- Core Logic ---

  // Check for significant file changes to trigger Auto-Sync
  const isSignificantChange = (current: string, previous: string) => {
    if (current === previous) return false;
    
    // Performance guard: If file is huge, fall back to simple line count diff
    const currentLines = current.split('\n');
    const prevLines = previous.split('\n');
    
    if (currentLines.length > 600 || prevLines.length > 600) {
       // Simple heuristic for large files
       return Math.abs(currentLines.length - prevLines.length) >= 5;
    }

    // Precise check using LCS for smaller files
    // Calculate Length of LCS
    const lcsLen = calculateLCSLength(currentLines, prevLines);
    
    // Lines changed = (Total Lines in Both) - (2 * LCS)
    // Actually, Edit Distance (Insertions + Deletions) = (Len1 - LCS) + (Len2 - LCS)
    const edits = (currentLines.length - lcsLen) + (prevLines.length - lcsLen);
    
    return edits >= 5; // Threshold: 5 lines changed
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (nodeState.activeFile && isSignificantChange(nodeState.activeFile, lastSynthesizedContentRef.current)) {
         handleSynthesize('AUTO');
      }
    }, 3000); // 3s debounce

    return () => clearTimeout(timer);
  }, [nodeState.activeFile]);


  const handleSynthesize = async (triggerSource: 'MANUAL' | 'AUTO' = 'MANUAL') => {
    setIsSynthesizing(true);
    addSystemLog(`Initiating Nexus State Synthesis (${triggerSource})...`, 'INFO');

    try {
      const updates = await synthesizeNexusState(messages, nodeState);
      
      const hasObjectiveChanged = updates.objective && updates.objective !== nodeState.objective;
      const hasScratchpadChanged = updates.scratchpad && updates.scratchpad !== nodeState.scratchpad;

      if (hasObjectiveChanged || hasScratchpadChanged || triggerSource === 'MANUAL') {
        setNodeState(prev => ({ ...prev, ...updates }));
        
        // Only announce if significant or manual
        if (triggerSource === 'MANUAL' || hasObjectiveChanged) {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: AgentRole.ARCHITECT,
                content: `**NEXUS SYNTHESIS COMPLETE**\n${hasObjectiveChanged ? `\n► OBJECTIVE UPDATED: ${updates.objective}` : ''}${hasScratchpadChanged ? '\n► SCRATCHPAD REVISED' : ''}`,
                timestamp: Date.now()
             }]);
             addSystemLog('Nexus State successfully synchronized.', 'SUCCESS');
        } else {
             addSystemLog('Auto-sync complete (Silent update).', 'SUCCESS');
        }

        // Update the ref so we don't re-trigger immediately
        lastSynthesizedContentRef.current = nodeState.activeFile;
      } else {
        addSystemLog('Synthesis complete. No significant state divergence.', 'INFO');
      }

    } catch (error) {
      handleSystemError(error, 'State Synthesis');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const triggerAgent = async (role: AgentRole, history: Message[], contextState: ContextNodeState): Promise<Message | null> => {
    setAgentStatuses(prev => ({ ...prev, [role]: 'processing' }));
    setFailedAgents(prev => ({ ...prev, [role]: false }));
    addSystemLog(`Triggering agent: ${role}`, 'INFO');

    try {
      const response = await generateAgentResponse(
        role,
        history,
        contextState,
        AGENTS[role].systemInstruction
      );

      // Tool Execution
      let toolResults: any[] = [];
      let stateUpdates = {};
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        addSystemLog(`${role} attempting ${response.toolCalls.length} tool calls...`, 'INFO');
        
        toolResults = response.toolCalls.map(tool => {
          if (tool.name === 'update_nexus_state') {
             stateUpdates = { ...stateUpdates, ...tool.args };
             return { ...tool, status: 'success', outcome: 'Nexus State Updated' };
          }
          if (tool.name === 'get_active_file') {
             const fileInfo = `File: ${contextState.activeFileName}\nSize: ${contextState.activeFile.length} bytes\nLines: ${contextState.activeFile.split('\n').length}`;
             return { ...tool, status: 'success', outcome: fileInfo };
          }
          return { ...tool, status: 'failure', outcome: 'Unknown Tool' };
        });

        if (Object.keys(stateUpdates).length > 0) {
           setNodeState(prev => {
              const next = { ...prev, ...stateUpdates };
              // If tool updated active file, update ref to prevent double-diff trigger?
              // No, let diff trigger naturally if needed, or update ref if we trust the agent.
              // Let's rely on standard flow.
              return next;
           });
           addSystemLog(`Nexus State updated by ${role}.`, 'SUCCESS');
        }
      }

      const agentMsg: Message = {
        id: Date.now() + Math.random().toString(),
        role,
        content: response.text,
        timestamp: Date.now(),
        toolCalls: toolResults
      };

      setAgentStatuses(prev => ({ ...prev, [role]: 'idle' }));
      return agentMsg;

    } catch (error) {
      handleSystemError(error, `Agent ${AGENTS[role].name}`);
      setAgentStatuses(prev => ({ ...prev, [role]: 'error' }));
      setFailedAgents(prev => ({ ...prev, [role]: true }));
      return null;
    }
  };

  const handleSendMessage = async (content: string, target: AgentRole | 'ALL') => {
    // 1. Add User Message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: AgentRole.USER,
      content,
      timestamp: Date.now()
    };
    
    // We must maintain a local chain of history for the sequence to work
    let currentSequenceHistory = [...messages, userMessage];
    
    setMessages(currentSequenceHistory);
    markUnread('NONE');
    addSystemLog(`User Input: "${content.substring(0, 30)}..."`, 'LOG');

    // 2. Determine Execution Queue
    let executionQueue: AgentRole[] = [];

    if (target === 'ALL') {
       executionQueue = [AgentRole.ARCHITECT, AgentRole.ENGINEER, AgentRole.CRITIC]
         .filter(r => !mutedAgents[r])
         .sort((a, b) => getPriorityValue(agentPriorities[b]) - getPriorityValue(agentPriorities[a]));
    } else {
       executionQueue = [target];
    }

    if (executionQueue.length === 0) return;

    // 3. Sequential Execution
    for (const role of executionQueue) {
       // Check if previous agents in the chain updated the state?
       // Ideally we use the freshest state from React, but inside a loop that's hard.
       // We will assume `nodeState` doesn't drastically change MID-loop for reading, 
       // but `triggerAgent` handles writes via setNodeState.
       // For prompts, we might need the tool updates from previous agents?
       // For now, we pass `nodeState` as is (it will be slightly stale if previous agent updated it in this same loop).
       // To fix this properly requires refactoring to an async queue with state ref.
       // We'll pass `currentSequenceHistory` so at least chat context is shared.

       const msg = await triggerAgent(role, currentSequenceHistory, nodeState);
       
       if (msg) {
          clearUnread(role);
          currentSequenceHistory = [...currentSequenceHistory, msg];
          setMessages(currentSequenceHistory); // Update UI incrementally
       }
    }
  };

  const toggleMute = (role: AgentRole) => {
    setMutedAgents(prev => {
        const newVal = !prev[role];
        addSystemLog(`${AGENTS[role].name} ${newVal ? 'muted' : 'unmuted'}.`, 'INFO');
        return { ...prev, [role]: newVal };
    });
  };
  
  const cyclePriority = (role: AgentRole) => {
     const nextPriority = {
       [AgentPriority.LOW]: AgentPriority.NORMAL,
       [AgentPriority.NORMAL]: AgentPriority.HIGH,
       [AgentPriority.HIGH]: AgentPriority.LOW
     };
     setAgentPriorities(prev => ({ ...prev, [role]: nextPriority[prev[role]] }));
  };

  const handleFactoryReset = () => {
    localStorage.removeItem('nexus_context_state');
    localStorage.removeItem('nexus_critical_errors');
    localStorage.removeItem('nexus_user_name');
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans relative">
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        userName={userName}
        onUpdateUserName={setUserName}
        onFactoryReset={handleFactoryReset}
      />

      {/* --- SYSTEM AUDIT LOG OVERLAY --- */}
      {showFullFeed && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
           <div className="w-[600px] h-full bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
                 <h2 className="font-mono text-emerald-500 font-bold tracking-wider flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                    SYSTEM_AUDIT_TRAIL
                 </h2>
                 <button onClick={() => setShowFullFeed(false)} className="text-slate-500 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                 </button>
              </div>

              {/* Filter Bar */}
              <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-800 bg-slate-900/50 overflow-x-auto">
                <span className="text-[10px] text-slate-500 font-mono uppercase mr-2">FILTER:</span>
                {['ALL', 'SYSTEM', ...Object.values(AgentRole).filter(r => r !== 'USER')].map(f => (
                  <button
                    key={f}
                    onClick={() => setFeedFilter(f as any)}
                    className={`px-2 py-1 rounded text-[10px] font-mono uppercase border transition-colors
                      ${feedFilter === f 
                        ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300' 
                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}
                    `}
                  >
                    {f === 'ALL' ? 'ALL EVENTS' : f}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs">
                 {getFullTimeline()
                   .filter(item => {
                      if (feedFilter === 'ALL') return true;
                      if (feedFilter === 'SYSTEM') return item.kind === 'LOG' || item.kind === 'INFO' || item.kind === 'SUCCESS' || item.kind === 'ERROR';
                      // @ts-ignore
                      return item.agent === AGENTS[feedFilter as AgentRole]?.name;
                   })
                   .map((item: any) => (
                   <div key={item.id} className={`p-2 border-b border-slate-800/50 flex gap-3 hover:bg-white/5 ${item.kind === 'ERROR' ? 'bg-red-950/10' : ''}`}>
                      <span className="text-slate-600 w-20 flex-shrink-0">{new Date(item.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}</span>
                      <div className="flex-1 break-words">
                         {item.type === 'LOG' ? (
                            <span className={
                              item.kind === 'ERROR' ? 'text-red-400' : 
                              item.kind === 'SUCCESS' ? 'text-green-400' : 
                              item.kind === 'INFO' ? 'text-sky-400' : 'text-slate-400'
                            }>[SYS] {item.text}</span>
                         ) : (
                            <span>
                               <strong className={`text-${AGENTS[item.role as AgentRole]?.color || 'indigo'}-400 mr-2`}>
                                 @{item.role === AgentRole.USER ? 'USER' : AGENTS[item.role as AgentRole]?.name}:
                               </strong>
                               <span className="text-slate-300 opacity-80">{item.text.substring(0, 200)}{item.text.length > 200 ? '...' : ''}</span>
                            </span>
                         )}
                      </div>
                   </div>
                 ))}
                 {getFullTimeline().length === 0 && (
                   <div className="text-center text-slate-600 py-10 italic">No events recorded in this session.</div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/50 px-6 flex items-center justify-between z-10 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-indigo-400">
             <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-[10px] opacity-20 animate-pulse"></div>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/><path d="m19.07 4.93-14.14 14.14"/></svg>
             </div>
             <div className="flex flex-col">
                <span className="font-bold text-lg tracking-widest leading-none font-mono">NEXUS</span>
                <span className="text-[8px] text-indigo-500/80 font-mono tracking-[0.3em] uppercase">Terminal v1.0.4</span>
             </div>
          </div>
          
          <div className="h-8 w-[1px] bg-slate-800 mx-2"></div>

          {/* Agent Cards Horizontal List */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 mask-linear-fade">
            {[AgentRole.ARCHITECT, AgentRole.ENGINEER, AgentRole.CRITIC].map((role) => (
               <div key={role} className="w-56 flex-shrink-0">
                <AgentCard
                  config={AGENTS[role]}
                  isActive={agentStatuses[role] === 'processing'}
                  status={agentStatuses[role]}
                  priority={agentPriorities[role]}
                  isMuted={mutedAgents[role]}
                  hasUnread={unreadAgents[role]}
                  lastActive={
                    // Find last msg from this agent
                    messages.filter(m => m.role === role).pop()?.timestamp
                  }
                  onClick={() => clearUnread(role)}
                  onToggleMute={(e) => { e.stopPropagation(); toggleMute(role); }}
                  onChangePriority={(e) => { e.stopPropagation(); cyclePriority(role); }}
                />
               </div>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-3 pl-4 border-l border-slate-800/50 h-full">
            <button 
              onClick={() => setShowFullFeed(true)}
              className="text-[10px] font-mono font-bold text-slate-500 hover:text-emerald-400 transition-colors flex items-center gap-2 px-3 py-1.5 rounded border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/10"
            >
               <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
               SYS_LOGS
            </button>
            <button
               onClick={() => setShowSettings(true)}
               className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-all"
               title="Configure Nexus"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Sidebar Activity Feed (Mini) */}
        <div className="w-64 border-r border-slate-800 bg-slate-900/20 flex flex-col hidden xl:flex">
           <div className="p-3 border-b border-slate-800 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              RECENT_ACTIVITY
           </div>
           <div className="flex-1 overflow-y-auto p-0">
              {activityLog.slice(0, 20).map(log => (
                 <div key={log.id} className="p-3 border-b border-slate-800/50 hover:bg-white/5 transition-colors cursor-default group">
                    <div className="flex items-center justify-between mb-1">
                       <span className={`text-[9px] font-bold uppercase ${
                          log.kind === 'ERROR' ? 'text-red-500' :
                          log.kind === 'SUCCESS' ? 'text-green-500' :
                          'text-indigo-500'
                       }`}>{log.kind}</span>
                       <span className="text-[9px] text-slate-600 font-mono">
                          {Math.floor((Date.now() - log.timestamp) / 1000)}s ago
                       </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono leading-tight group-hover:text-slate-300">
                       {log.text}
                    </p>
                 </div>
              ))}
           </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex min-w-0">
          <div className="w-1/2 p-4 flex flex-col min-w-[400px] border-r border-slate-800/50">
            <ChatInterface 
              messages={messages}
              agents={AGENTS}
              onSendMessage={handleSendMessage}
              isProcessing={Object.values(agentStatuses).some(s => s === 'processing')}
            />
          </div>
          <div className="w-1/2 p-4 flex flex-col min-w-[400px]">
            <ContextBoard 
              state={nodeState}
              onChange={setNodeState}
              onAiSynthesize={() => handleSynthesize('MANUAL')}
              isSynthesizing={isSynthesizing}
              lastSynthesizedFileContent={lastSynthesizedContentRef.current}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;