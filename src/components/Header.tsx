import React from 'react';
import { Logo } from './Logo.tsx';

interface HeaderProps {
  activeTab?: 'send' | 'receive';
  onTabChange?: (tab: 'send' | 'receive') => void;
  onGoHome: () => void;
  onOpenArchitecture: () => void;
  showBackArrow?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'send',
  onTabChange,
  onGoHome,
  onOpenArchitecture,
  showBackArrow = true,
}) => {
  return (
    <header className="w-full max-w-[1240px] mx-auto pt-4 sm:pt-6 pb-3 px-4 sm:px-6 flex items-center justify-between relative z-20">
      {/* Left: Back button + Reusable Brand Logo + Tagline */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {showBackArrow && (
          <button
            type="button"
            onClick={onGoHome}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-white border-[3px] border-[#111111] rounded-full flex items-center justify-center shadow-[3.5px_3.5px_0_#111111] btn-pressable cursor-pointer"
            aria-label="Back to home"
          >
            <img
              src="/icon-arrow-left.webp"
              alt="Back"
              className="w-4 h-4 sm:w-5 sm:h-5 object-contain"
            />
          </button>
        )}
        <Logo showTagline={true} onClick={onGoHome} />
      </div>

      {/* Center: Two Tabs (Send & Receive) */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => onTabChange && onTabChange('send')}
          className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-heading font-extrabold text-xs sm:text-sm text-[#111111] border-[3px] border-[#111111] shadow-[3.5px_3.5px_0_#111111] btn-pressable cursor-pointer transition-colors ${
            activeTab === 'send' ? 'bg-[#FED228]' : 'bg-white hover:bg-neutral-50'
          }`}
          aria-label="Send files tab"
        >
          <img
            src="/icon-cloud-upload-small.webp"
            alt=""
            className="w-4 h-4 object-contain"
          />
          <span>Send</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange && onTabChange('receive')}
          className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-heading font-extrabold text-xs sm:text-sm text-[#111111] border-[3px] border-[#111111] shadow-[3.5px_3.5px_0_#111111] btn-pressable cursor-pointer transition-colors ${
            activeTab === 'receive' ? 'bg-[#FED228]' : 'bg-white hover:bg-neutral-50'
          }`}
          aria-label="Receive files tab"
        >
          <img
            src="/icon-download-small.webp"
            alt=""
            className="w-4 h-4 object-contain"
          />
          <span>Receive</span>
        </button>
      </div>

      {/* Right: Settings button with sparkle-black-top-right decoration */}
      <div className="relative flex items-center">
        <img
          src="/sparkle-black-top-right.webp"
          alt=""
          className="absolute -top-3.5 -right-2.5 w-6 h-6 object-contain pointer-events-none select-none z-10"
        />
        <button
          type="button"
          onClick={onOpenArchitecture}
          className="w-10 h-10 sm:w-11 sm:h-11 bg-white border-[3px] border-[#111111] rounded-[14px] flex items-center justify-center shadow-[3.5px_3.5px_0_#111111] btn-pressable cursor-pointer relative z-0"
          title="Architecture, specs & storage configuration"
          aria-label="Settings and Storage Specs"
        >
          <img
            src="/icon-gear.webp"
            alt="Settings"
            className="w-5 h-5 object-contain"
          />
        </button>
      </div>
    </header>
  );
};
