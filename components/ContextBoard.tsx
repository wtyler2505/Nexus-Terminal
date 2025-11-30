import React from 'react';
import { ContextNodeState } from '../types';

interface ContextBoardProps {
  state: ContextNodeState;
  onChange: (newState: ContextNodeState) => void;
  onAiSynthesize?: () => void;
  isSynthesizing?: boolean;
}

const ContextBoard: React.FC<ContextBoardProps> = ({ state, onChange, onAiSynthesize, isSynthesizing }) => {
  
  const handleChange = (field: keyof ContextNodeState, value: string) => {
    onChange({
      ...state,
      [field]: value
    });
  };

  return (
    <div className="h-full flex flex-col gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner overflow-y-auto relative">
      
      {/* Background Grid Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.5)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20"></div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 relative z-10">
        <div className="flex items-center gap-2">
           <div className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
            </div>
            <div className="flex flex-col">
                <span className="text-indigo-400 text-[10px] font-bold tracking-[0.2em] font-mono">GEMINI CORE</span>
                <span className="text-slate-500 text-[8px] font-mono uppercase">System Fabric Active</span>
            </div>
        </div>
        
        {/* AI Resolve Button */}
        {onAiSynthesize && (
          <button
            onClick={onAiSynthesize}
            disabled={isSynthesizing}
            className={`
              flex items-center gap-2 px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all border
              ${isSynthesizing 
                ? 'bg-indigo-900/50 text-indigo-300 cursor-wait border-indigo-500/30' 
                : 'bg-indigo-600/10 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/50 hover:border-indigo-400 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]'}
            `}
          >
            {isSynthesizing ? (
              <>
                <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                SYNCHRONIZING...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
                EXECUTE SYNC
              </>
            )}
          </button>
        )}
      </div>

      {/* Objective Section */}
      <div className="space-y-2 relative z-10">
        <label className="text-[10px] font-bold text-sky-400/80 font-mono flex items-center gap-2">
          PRIMARY_DIRECTIVE
          <span className="h-[1px] flex-1 bg-sky-900/30"></span>
        </label>
        <textarea
          value={state.objective}
          onChange={(e) => handleChange('objective', e.target.value)}
          placeholder="Define the primary goal for the swarm..."
          className="w-full h-24 bg-slate-900/30 border border-slate-700/50 rounded-sm p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/50 transition-colors resize-none font-medium backdrop-blur-sm"
        />
      </div>

      {/* Scratchpad Section */}
      <div className="flex-1 flex flex-col space-y-2 min-h-[200px] relative z-10">
        <label className="text-[10px] font-bold text-emerald-400/80 font-mono flex items-center justify-between">
          <span>SHARED_MEMORY_BANK</span>
          <span className="text-[8px] text-emerald-500/50 border border-emerald-900 px-1 py-0.5 rounded">READ/WRITE</span>
        </label>
        <textarea
          value={state.scratchpad}
          onChange={(e) => handleChange('scratchpad', e.target.value)}
          placeholder="Shared notes, pseudo-code, plan of action..."
          className="flex-1 w-full bg-slate-900/30 border border-slate-700/50 rounded-sm p-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/50 transition-colors resize-none font-mono leading-relaxed backdrop-blur-sm"
        />
      </div>

      {/* File Viewer Section */}
      <div className="flex-1 flex flex-col space-y-2 min-h-[200px] relative z-10">
        <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-amber-400/80 font-mono">ACTIVE_ARTIFACT</label>
            <input 
                type="text" 
                value={state.activeFileName}
                onChange={(e) => handleChange('activeFileName', e.target.value)}
                className="bg-slate-900/50 border border-slate-700/50 text-xs text-slate-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-amber-500/50 text-right font-mono"
            />
        </div>
        <textarea
          value={state.activeFile}
          onChange={(e) => handleChange('activeFile', e.target.value)}
          placeholder="// Code or content goes here..."
          className="flex-1 w-full bg-[#0d1117]/80 border border-slate-700/50 rounded-sm p-3 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 transition-colors resize-none font-mono whitespace-pre backdrop-blur-sm"
          spellCheck={false}
        />
      </div>

    </div>
  );
};

export default ContextBoard;