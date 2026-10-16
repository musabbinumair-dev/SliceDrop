import React from 'react';
import { Logo } from './Logo.tsx';
import { Settings } from 'lucide-react';

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
}) => {
  return (
    <header className="w-full max-w-[1487px] mx-auto px-4 sm:px-6 mt-4 sm:mt-6 md:mt-8 mb-[24px] flex flex-col justify-center relative z-20">
      {/* Top Bar Row */}
      <div className="w-full flex items-center justify-between">
        {/* Left: Brand Logo with pizza mascot and tagline */}
        <div className="flex items-center flex-shrink-0">
          <Logo showTagline={false} onClick={onGoHome} />
        </div>

        {/* Center: Segmented Pill Tab Bar (desktop/tablet >= 640px) */}
        <div className="hidden min-[640px]:flex items-center justify-center">
          <div className="inline-flex items-center rounded-full border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] overflow-hidden bg-white select-none">
            <button
              type="button"
              onClick={() => onTabChange && onTabChange('send')}
              className={`flex items-center justify-center gap-2.5 px-6 sm:px-7 py-2.5 sm:py-3 font-heading font-extrabold text-sm sm:text-[15px] text-[#111111] border-r-[3px] border-[#111111] transition-colors cursor-pointer ${
                activeTab === 'send' ? 'bg-[#FED228]' : 'bg-white hover:bg-[#FDF7ED]'
              }`}
              aria-label="Send files tab"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111111"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px] shrink-0"
              >
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                <polyline points="7 9 12 4 17 9" />
                <line x1="12" y1="4" x2="12" y2="16" />
              </svg>
              <span>Send files</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange && onTabChange('receive')}
              className={`flex items-center justify-center gap-2.5 px-6 sm:px-7 py-2.5 sm:py-3 font-heading font-extrabold text-sm sm:text-[15px] text-[#111111] transition-colors cursor-pointer ${
                activeTab === 'receive' ? 'bg-[#FED228]' : 'bg-white hover:bg-[#FDF7ED]'
              }`}
              aria-label="Receive files tab"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111111"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px] shrink-0"
              >
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                <polyline points="7 11 12 16 17 11" />
                <line x1="12" y1="4" x2="12" y2="16" />
              </svg>
              <span>Receive files</span>
            </button>
          </div>
        </div>

        {/* Right: Square Settings Button (no sparkle, matching mockup) */}
        <div className="flex items-center flex-shrink-0">
          <button
            type="button"
            onClick={onOpenArchitecture}
            className="w-11 h-11 sm:w-12 sm:h-12 bg-white border-[3px] border-[#111111] rounded-[14px] flex items-center justify-center shadow-[4px_4px_0_#111111] btn-pressable cursor-pointer relative z-0 transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
            title="Architecture, specs & storage configuration"
            aria-label="Settings and Storage Specs"
          >
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-[#111111] stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Segmented Pill Tab Bar for Mobile (< 640px) */}
      <div className="flex min-[640px]:hidden items-center justify-center w-full mt-3.5">
        <div className="inline-flex items-center w-full max-w-[340px] rounded-full border-[3px] border-[#111111] shadow-[3.5px_3.5px_0_#111111] overflow-hidden bg-white select-none">
          <button
            type="button"
            onClick={() => onTabChange && onTabChange('send')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-heading font-extrabold text-xs sm:text-sm text-[#111111] border-r-[3px] border-[#111111] transition-colors cursor-pointer ${
              activeTab === 'send' ? 'bg-[#FED228]' : 'bg-white hover:bg-[#FDF7ED]'
            }`}
            aria-label="Send files tab"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#111111"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              <polyline points="7 9 12 4 17 9" />
              <line x1="12" y1="4" x2="12" y2="16" />
            </svg>
            <span>Send files</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange && onTabChange('receive')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-heading font-extrabold text-xs sm:text-sm text-[#111111] transition-colors cursor-pointer ${
              activeTab === 'receive' ? 'bg-[#FED228]' : 'bg-white hover:bg-[#FDF7ED]'
            }`}
            aria-label="Receive files tab"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#111111"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              <polyline points="7 11 12 16 17 11" />
              <line x1="12" y1="4" x2="12" y2="16" />
            </svg>
            <span>Receive files</span>
          </button>
        </div>
      </div>
    </header>
  );
};
