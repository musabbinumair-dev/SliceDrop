import React, { useState } from 'react';
import { Settings, Volume2, VolumeX, Copy, Shield, HardDrive, Clock, Check, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageInfo?: {
    name: string;
    isCloudStorage: boolean;
    bucket?: string;
    description: string;
    maxFileSizeMb: number;
    inactivityTimeoutMinutes: number;
    maxLifetimeHours: number;
  } | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  storageInfo,
}) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('slicedrop_sound') !== 'false';
  });
  const [autoCopy, setAutoCopy] = useState<boolean>(() => {
    return localStorage.getItem('slicedrop_autocopy') === 'true';
  });
  const [toast, setToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('slicedrop_sound', String(next));
    setToast(next ? 'Sound notifications enabled' : 'Sound notifications muted');
    setTimeout(() => setToast(null), 2000);
  };

  const handleToggleAutoCopy = () => {
    const next = !autoCopy;
    setAutoCopy(next);
    localStorage.setItem('slicedrop_autocopy', String(next));
    setToast(next ? 'Auto-copy room link enabled' : 'Auto-copy disabled');
    setTimeout(() => setToast(null), 2000);
  };

  const handleClearSessions = () => {
    sessionStorage.removeItem('quickdrop_tokens');
    setToast('Local creator sessions cleared');
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-[#FDF7ED] border-[3px] border-[#111111] rounded-[24px] shadow-[6px_6px_0_#111111] max-w-lg w-full p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto font-sans [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 bg-white border-[2.5px] border-[#111111] rounded-xl flex items-center justify-center shadow-[2px_2px_0_#111111] btn-pressable-sm cursor-pointer"
          title="Close"
          type="button"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-[#111111]" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-[12px] bg-[#FED228] border-[2.5px] border-[#111111] flex items-center justify-center shadow-hard-xs">
            <Settings className="w-5 h-5 text-[#111111]" />
          </div>
          <h3 className="font-heading font-extrabold text-2xl text-[#111111]">
            SliceDrop Settings & Specs
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-[#71717A] mb-5">
          Customize transfer preferences, notification sounds, and inspect storage drivers.
        </p>

        {/* Toast Notification */}
        {toast && (
          <div className="mb-4 bg-[#111111] text-white text-xs px-3 py-2 rounded-xl flex items-center gap-2 shadow-hard-xs animate-in fade-in">
            <Check className="w-3.5 h-3.5 text-[#FED228]" />
            <span>{toast}</span>
          </div>
        )}

        {/* Section 1: Transfer & Notification Preferences */}
        <div className="bg-white border-[2.5px] border-[#111111] rounded-[18px] p-4 shadow-[3px_3px_0_#111111] mb-4 space-y-4">
          <h4 className="font-heading font-extrabold text-xs text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-[#8562FC]" />
            Transfer & Sound Preferences
          </h4>

          {/* Sound Toggle */}
          <div className="flex items-center justify-between py-1 border-b border-gray-100">
            <div>
              <p className="font-bold text-sm text-[#111111]">Transfer Audio Cues</p>
              <p className="text-xs text-[#71717A]">Play sound on upload & download completion</p>
            </div>
            <button
              type="button"
              onClick={handleToggleSound}
              className={`w-12 h-6 rounded-full border-2 border-[#111111] transition-colors relative cursor-pointer ${
                soundEnabled ? 'bg-[#FED228]' : 'bg-gray-200'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#111111] absolute top-0.5 transition-transform ${
                  soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Auto-copy Link Toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="font-bold text-sm text-[#111111]">Auto-copy Room Link</p>
              <p className="text-xs text-[#71717A]">Automatically copy share link upon room creation</p>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoCopy}
              className={`w-12 h-6 rounded-full border-2 border-[#111111] transition-colors relative cursor-pointer ${
                autoCopy ? 'bg-[#FED228]' : 'bg-gray-200'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#111111] absolute top-0.5 transition-transform ${
                  autoCopy ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Section 2: Storage Driver & Limits */}
        <div className="bg-white border-[2.5px] border-[#111111] rounded-[18px] p-4 shadow-[3px_3px_0_#111111] mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-xs text-[#71717A] uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-[#10B981]" />
              Storage Engine
            </span>
            <span className="font-heading font-extrabold text-xs px-2.5 py-1 bg-[#E6F9F0] border border-[#111111] rounded-full text-emerald-700">
              {storageInfo?.name || 'Server Disk (Encrypted Temp)'}
            </span>
          </div>

          <p className="text-xs text-[#555555]">
            {storageInfo?.description ||
              'Built-in container temporary disk active with automatic garbage collection.'}
          </p>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100 text-center">
            <div className="bg-[#FDF7ED] border border-[#111111]/30 rounded-xl p-2">
              <span className="block text-[10px] uppercase font-bold text-[#71717A]">Max File</span>
              <span className="font-heading font-extrabold text-sm text-[#111111]">{storageInfo?.maxFileSizeMb || 100} MB</span>
            </div>
            <div className="bg-[#FDF7ED] border border-[#111111]/30 rounded-xl p-2">
              <span className="block text-[10px] uppercase font-bold text-[#71717A]">Inactivity TTL</span>
              <span className="font-heading font-extrabold text-sm text-[#111111]">{storageInfo?.inactivityTimeoutMinutes || 60} min</span>
            </div>
            <div className="bg-[#FDF7ED] border border-[#111111]/30 rounded-xl p-2">
              <span className="block text-[10px] uppercase font-bold text-[#71717A]">Hard Limit</span>
              <span className="font-heading font-extrabold text-sm text-[#111111]">{storageInfo?.maxLifetimeHours || 6} hours</span>
            </div>
          </div>
        </div>

        {/* Section 3: Security & Session Management */}
        <div className="bg-[#FEF3C7] border-[2.5px] border-[#111111] rounded-[18px] p-4 shadow-[3px_3px_0_#111111] mb-5 space-y-3">
          <h4 className="font-heading font-extrabold text-xs text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#FD3F77]" />
            Security & Session Data
          </h4>
          <p className="text-xs text-[#444444] leading-relaxed">
            No user accounts or tracking. Files are automatically scrubbed from server storage after 60 minutes of inactivity or upon ending the room.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleClearSessions}
              className="px-3 py-2 bg-white hover:bg-red-50 border-2 border-[#111111] rounded-xl text-xs font-bold text-[#FD3F77] shadow-hard-xs cursor-pointer btn-pressable-sm"
            >
              Clear Local Creator Sessions
            </button>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          type="button"
          className="w-full py-3 px-6 rounded-[16px] bg-[#FED228] border-[2.5px] border-[#111111] font-heading font-extrabold text-sm text-[#111111] shadow-[3px_3px_0_#111111] btn-pressable cursor-pointer"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
};
