import React from 'react';

interface ArchitectureModalProps {
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

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({
  isOpen,
  onClose,
  storageInfo,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-[#FDF7ED] border-[3px] border-[#111111] rounded-[24px] shadow-[6px_6px_0_#111111] max-w-lg w-full p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 bg-white border-[2.5px] border-[#111111] rounded-xl flex items-center justify-center shadow-[2px_2px_0_#111111] btn-pressable-sm cursor-pointer"
          title="Close"
          type="button"
          aria-label="Close"
        >
          <img src="/icon-close-x.webp" alt="Close" className="w-3.5 h-3.5 object-contain" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <img src="/mascot-pizza.webp" alt="" className="w-8 h-8 object-contain" />
          <h3 className="font-heading font-extrabold text-2xl text-[#111111]">
            SliceDrop Architecture & Specs
          </h3>
        </div>
        <p className="text-xs sm:text-sm font-semibold text-[#71717A] mb-5">
          Real, secure cross-network file transfer without accounts or persistent logs.
        </p>

        <div className="bg-white border-[2.5px] border-[#111111] rounded-[18px] p-4 shadow-[3px_3px_0_#111111] mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-xs text-[#71717A] uppercase tracking-wider">Active Storage Driver</span>
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

        <div className="bg-[#FEF3C7] border-[2.5px] border-[#111111] rounded-[18px] p-4 shadow-[3px_3px_0_#111111] mb-5 space-y-2">
          <h4 className="font-heading font-extrabold text-xs text-[#111111] uppercase tracking-wider">Security & Ephemeral Lifecycle</h4>
          <ul className="text-xs text-[#444444] space-y-1.5 list-disc list-inside">
            <li>Zero-Login Access: No accounts, software installation, or common Wi-Fi needed.</li>
            <li>Brute-Force Guard: 6-digit room code lookups are rate-limited.</li>
            <li>Automatic Purge: Uploaded files are erased when room ends or 60 min inactivity elapses.</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          type="button"
          className="w-full py-3 px-6 rounded-[16px] bg-[#FED228] border-[2.5px] border-[#111111] font-heading font-extrabold text-sm text-[#111111] shadow-[3px_3px_0_#111111] btn-pressable cursor-pointer"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};
