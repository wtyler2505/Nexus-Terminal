import React, { useEffect, useState } from 'react';
import { AgentConfig, AgentPriority } from '../types';

export type AgentStatus = 'idle' | 'processing' | 'error';

interface AgentCardProps {
  config: AgentConfig;
  isActive: boolean;
  onClick: () => void;
  status: AgentStatus;
  lastActive?: number;
  isMuted?: boolean;
  hasUnread?: boolean;
  priority: AgentPriority;
  onToggleMute?: (e: React.MouseEvent) => void;
  onChangePriority?: (e: React.MouseEvent) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ 
  config, 
  isActive, 
  onClick, 
  status, 
  lastActive, 
  isMuted, 
  hasUnread,
  priority,
  onToggleMute,
  onChangePriority
}) => {
  const [timeAgo, setTimeAgo] = useState<string>('');

  // Auto-update time ago text
  useEffect(() => {
    if (!lastActive) {
      setTimeAgo('');
      return;
    }

    const updateTime = () => {
      const diff = Date.now() - lastActive;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (seconds < 60) setTimeAgo('Just now');
      else if (minutes < 60) setTimeAgo(`${minutes}m ago`);
      else if (hours < 24) setTimeAgo(`${hours}h ago`);
      else setTimeAgo('Long ago');
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [lastActive]);

  let containerClasses = 'bg-slate-900/50 border-slate-700 hover:border-slate-500 hover:bg-slate-800';
  let opacityClass = 'opacity-100';

  if (isMuted) {
    containerClasses = 'bg-slate-950 border-slate-800 grayscale';
    opacityClass = 'opacity-50';
  } else if (status === 'error') {
    containerClasses = 'bg-red-950/20 border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
  } else if (isActive) {
    containerClasses = `bg-slate-800/80 border-${config.color}-500 shadow-[0_0_15px_rgba(0,0,0,0.3)]`;
  }

  const priorityColors = {
    [AgentPriority.HIGH]: 'text-red-400 border-red-900 bg-red-950/30',
    [AgentPriority.NORMAL]: 'text-sky-400 border-sky-900 bg-sky-950/30',
    [AgentPriority.LOW]: 'text-slate-400 border-slate-700 bg-slate-800/50'
  };

  const isRecent = timeAgo === 'Just now';

  return (
    <div 
      onClick={onClick}
      className={`
        relative p-4 rounded-xl border cursor-pointer transition-all duration-200 group
        ${containerClasses}
        ${opacityClass}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Avatar / Icon Status */}
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-colors relative
          ${status === 'error' && !isMuted
            ? 'bg-red-500/20 text-red-500 border-red-500/50' 
            : isActive && !isMuted
              ? `bg-${config.color}-500/20 text-${config.color}-400 border-white/5` 
              : 'bg-slate-800 text-slate-500 border-white/5'}
          border
        `}>
          {status === 'error' && !isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          ) : (
            config.avatar
          )}
          
          {/* Unread Indicator */}
          {hasUnread && !isMuted && !isActive && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 border-2 border-slate-900"></span>
            </span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`text-sm font-semibold truncate flex items-center gap-1 ${isActive || status === 'error' ? 'text-white' : 'text-slate-400'}`}>
              {config.name}
              {status === 'processing' && !isMuted && (
                <span className="w-1.5 h-4 bg-white animate-pulse inline-block ml-1 align-middle opacity-70"></span>
              )}
            </h3>
            
            <div className="flex items-center gap-2">
               {onChangePriority && !isMuted && (
                 <button
                   onClick={(e) => { e.stopPropagation(); onChangePriority(e); }}
                   className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase transition-colors hover:opacity-80 ${priorityColors[priority]}`}
                   title="Cycle Priority"
                 >
                   {priority}
                 </button>
               )}

               {onToggleMute && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleMute(e); }}
                  className={`p-1 rounded hover:bg-slate-700 transition-colors ${isMuted ? 'text-slate-600' : 'text-slate-400'}`}
                  title={isMuted ? "Unmute Agent" : "Mute Agent"}
                >
                  {isMuted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  )}
                </button>
               )}
            </div>
          </div>
          <p className={`text-xs truncate ${status === 'error' && !isMuted ? 'text-red-400 font-medium' : hasUnread ? 'text-cyan-300 font-medium' : 'text-slate-500'}`}>
             {isMuted ? 'Dormant' : (status === 'error' ? 'Connection Lost' : hasUnread ? 'Unread Message' : (lastActive && isRecent && status === 'idle' ? 'Online' : config.description))}
          </p>
        </div>
      </div>
      
      {isActive && status !== 'error' && !isMuted && (
        <div className={`absolute bottom-0 left-4 right-4 h-[2px] bg-${config.color}-500 shadow-[0_0_8px_currentColor] rounded-full`} />
      )}
      {status === 'error' && !isMuted && (
        <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] rounded-full animate-pulse" />
      )}
    </div>
  );
};

export default AgentCard;