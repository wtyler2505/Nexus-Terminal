import React, { useEffect, useRef, useState } from 'react';
import { AgentConfig, AgentRole, Message } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  agents: Record<AgentRole, AgentConfig>;
  onSendMessage: (content: string, targetRole: AgentRole | 'ALL') => void;
  isProcessing: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, agents, onSendMessage, isProcessing }) => {
  const [inputValue, setInputValue] = useState('');
  const [target, setTarget] = useState<AgentRole | 'ALL'>('ALL');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Refs for Speech Recognition
  const recognitionRef = useRef<any>(null);
  const textBeforeListening = useRef<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Initialize Speech Recognition on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript || interimTranscript) {
             const newContent = (finalTranscript + interimTranscript).trim();
             setInputValue(textBeforeListening.current + (textBeforeListening.current && newContent ? ' ' : '') + newContent);
          }
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      textBeforeListening.current = inputValue;
      recognitionRef.current.start();
    }
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue, target);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      
      {/* Header */}
      <div className="h-12 bg-slate-950/50 border-b border-slate-800 flex items-center px-4 justify-between">
        <span className="text-slate-400 font-mono text-xs font-bold uppercase tracking-wider">Communication Channel</span>
        <div className="flex gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-[10px] text-green-500 font-mono">UPLINK ACTIVE</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => {
          const isUser = msg.role === AgentRole.USER;
          const agent = isUser ? null : agents[msg.role];
          
          return (
            <div key={msg.id} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              
              {/* Avatar */}
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1
                ${isUser ? 'bg-indigo-600 text-white' : `bg-slate-800 text-${agent?.color}-400 border border-${agent?.color}-500/30`}
              `}>
                {isUser ? 'U' : agent?.avatar}
              </div>

              {/* Content */}
              <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-slate-500 mb-1 font-mono uppercase">
                  {isUser ? 'DIRECTOR' : agent?.name}
                </span>
                <div className={`
                  p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap
                  ${isUser 
                    ? 'bg-indigo-900/40 border border-indigo-500/30 text-indigo-100 rounded-tr-none' 
                    : 'bg-slate-800/50 border border-slate-700 text-slate-300 rounded-tl-none'}
                `}>
                  {msg.content}
                  
                  {/* Tool Call Feedback */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.toolCalls.map(tool => (
                        <div key={tool.id} className={`text-xs p-2 rounded border font-mono flex flex-col gap-2 ${
                          tool.status === 'failure' ? 'bg-red-950/20 border-red-900/50' : 
                          tool.status === 'success' ? 'bg-green-950/10 border-green-900/30' : 
                          'bg-slate-900/50 border-slate-800'
                        }`}>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <span className={`text-[10px] uppercase font-bold ${
                                   tool.status === 'failure' ? 'text-red-400' : 
                                   tool.status === 'success' ? 'text-green-400' : 
                                   'text-amber-400'
                                }`}>
                                   {tool.status === 'success' ? '✓' : tool.status === 'failure' ? '✕' : '➜'} {tool.name}
                                </span>
                             </div>
                             <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                               tool.status === 'success' ? 'bg-green-900/30 text-green-400' : 
                               tool.status === 'failure' ? 'bg-red-900/30 text-red-400' : 
                               'bg-amber-900/30 text-amber-400'
                             }`}>
                               {tool.status || 'PENDING'}
                             </span>
                          </div>
                          
                          {/* Arguments Preview */}
                          <div className="bg-slate-950/50 p-1.5 rounded text-[10px] text-slate-400 break-all font-mono">
                             <span className="opacity-50 select-none mr-2">$</span>
                             {JSON.stringify(tool.args)}
                          </div>

                          {/* Outcome / Error with clear styling */}
                          {(tool.outcome) && (
                            <div className={`p-1.5 rounded text-[10px] font-mono ${
                               tool.status === 'failure' ? 'bg-red-950/40 text-red-300 border border-red-900/20' : 
                               'bg-slate-900/30 text-slate-300 border border-slate-700/30'
                            }`}>
                               <span className="opacity-50 mr-2 uppercase tracking-wider text-[8px]">{tool.status === 'failure' ? 'ERROR_LOG:' : 'RETURN:'}</span>
                               {tool.outcome}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isProcessing && (
           <div className="flex gap-4">
              <div className="w-8 h-8 bg-slate-800 rounded-lg animate-pulse"></div>
              <div className="h-10 w-32 bg-slate-800 rounded-lg animate-pulse"></div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <div className="flex flex-col gap-3">
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs text-slate-500 font-mono mr-1">TARGET:</span>
            <button
              onClick={() => setTarget('ALL')}
              className={`text-xs px-2 py-1 rounded border font-mono transition-colors ${target === 'ALL' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
            >
              BROADCAST_ALL
            </button>
            {(Object.values(agents) as AgentConfig[]).map(agent => (
               <button
               key={agent.id}
               onClick={() => setTarget(agent.id)}
               className={`text-xs px-2 py-1 rounded border font-mono uppercase transition-colors ${target === agent.id ? `bg-${agent.color}-900/50 border-${agent.color}-500 text-${agent.color}-400` : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
             >
               @{agent.name}
             </button>
            ))}
          </div>

          <div className="flex gap-2 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening to audio uplink..." : `Message ${target === 'ALL' ? 'all nodes' : agents[target as AgentRole]?.name}...`}
              className={`
                flex-1 bg-slate-900 border rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-1 transition-all resize-none h-[50px] min-h-[50px]
                ${isListening ? 'border-red-500 focus:border-red-500 focus:ring-red-500 placeholder-red-400/50' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'}
              `}
            />

            {/* Mic Button */}
            {recognitionRef.current && (
               <button
                 onClick={toggleListening}
                 className={`
                   px-3 rounded-lg flex items-center justify-center transition-all duration-300 border
                   ${isListening 
                     ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse' 
                     : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}
                 `}
                 title="Toggle Voice Uplink"
               >
                 {isListening ? (
                    <div className="relative flex items-center justify-center w-5 h-5">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                    </div>
                 ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                 )}
               </button>
            )}

            <button
              onClick={handleSend}
              disabled={isProcessing || (!inputValue.trim() && !isListening)}
              className="px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;