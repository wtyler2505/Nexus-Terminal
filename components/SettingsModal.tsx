import React, { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onUpdateUserName: (name: string) => void;
  onFactoryReset: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  userName, 
  onUpdateUserName,
  onFactoryReset
}) => {
  const [nameInput, setNameInput] = useState(userName);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateUserName(nameInput);
    onClose();
  };

  const handleResetClick = () => {
    if (confirmReset) {
      onFactoryReset();
      setConfirmReset(false);
      onClose();
    } else {
      setConfirmReset(true);
    }
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[500px] bg-slate-950 border border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
            <span className="font-mono font-bold tracking-wider uppercase">System Configuration</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          
          {/* Section: Identity */}
          <div className="space-y-3">
            <label className="text-xs font-mono font-bold text-slate-400 uppercase">Operator Identity</label>
            <div className="flex gap-2">
              <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                {nameInput.charAt(0).toUpperCase()}
              </div>
              <input 
                type="text" 
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 text-sm text-white focus:border-indigo-500 focus:outline-none font-medium"
                placeholder="Enter your name..."
              />
            </div>
            <p className="text-[10px] text-slate-500">This identity will be used when addressing the Nexus Agents.</p>
          </div>

          <hr className="border-slate-800" />

          {/* Section: System Maintenance */}
          <div className="space-y-3">
            <label className="text-xs font-mono font-bold text-red-400 uppercase">Danger Zone</label>
            <div className="bg-red-950/10 border border-red-900/30 rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                 <h4 className="text-sm font-medium text-red-300">Factory Reset Node</h4>
                 <p className="text-xs text-red-400/60 leading-relaxed">
                   Irreversibly clears all local memory, including Chat History, Shared Context, and Scratchpad. The environment will reboot.
                 </p>
              </div>
              <button
                onClick={handleResetClick}
                className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider border transition-all ${
                  confirmReset 
                    ? 'bg-red-600 text-white border-red-500 hover:bg-red-700' 
                    : 'bg-transparent text-red-500 border-red-900 hover:border-red-500 hover:bg-red-950/30'
                }`}
              >
                {confirmReset ? 'Confirm Wipe?' : 'Reset System'}
              </button>
            </div>
          </div>
          
          {/* Info Footer */}
          <div className="text-[10px] text-slate-600 font-mono text-center pt-2">
            NEXUS TERMINAL v1.0.4 • SECURE UPLINK ESTABLISHED
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/30 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
          >
            Save Configuration
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;