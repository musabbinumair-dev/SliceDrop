import React from 'react';
import { Settings } from 'lucide-react';
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
}) => {
  return (
    <header
      style={{
        width: '100%',
        maxWidth: 'calc(864 * var(--u))',
        paddingLeft: 'calc(15 * var(--u))',
        paddingRight: 'calc(15 * var(--u))',
        height: 'calc(90 * var(--u))',
      }}
      className="mx-auto flex items-center justify-between relative z-20 shrink-0 select-none"
    >
      {/* Left: Brand Logo */}
      <div className="flex items-center shrink-0">
        <Logo onClick={onGoHome} />
      </div>

      {/* Center: Segmented Pill Tab Bar (309px x 44px) */}
      <div className="flex items-center justify-center shrink-0">
        <div
          style={{
            width: 'calc(309 * var(--u))',
            height: 'calc(44 * var(--u))',
            borderRadius: '9999px',
            borderWidth: 'calc(2.5 * var(--u))',
            borderColor: '#111111',
          }}
          className="inline-flex items-center border-solid shadow-[calc(3.5 * var(--u))_calc(3.5 * var(--u))_0_#111111] overflow-hidden bg-white select-none shrink-0"
        >
          <button
            type="button"
            onClick={() => onTabChange && onTabChange('send')}
            style={{
              borderRightWidth: 'calc(2.5 * var(--u))',
              borderRightColor: '#111111',
              fontSize: 'calc(13.5 * var(--u))',
              gap: 'calc(6 * var(--u))',
            }}
            className={`flex-1 h-full flex items-center justify-center font-heading font-extrabold text-[#111111] border-r-solid transition-colors cursor-pointer ${
              activeTab === 'send' ? 'bg-[#FED228]' : 'bg-white hover:bg-[#FDF7ED]'
            }`}
            aria-label="Send files tab"
          >
            <svg
              style={{ width: 'calc(18 * var(--u))', height: 'calc(18 * var(--u))' }}
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
            <span className="whitespace-nowrap">Send files</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange && onTabChange('receive')}
            style={{
              fontSize: 'calc(13.5 * var(--u))',
              gap: 'calc(6 * var(--u))',
            }}
            className={`flex-1 h-full flex items-center justify-center font-heading font-extrabold text-[#111111] transition-colors cursor-pointer ${
              activeTab === 'receive' ? 'bg-[#FED228]' : 'bg-white hover:bg-[#FDF7ED]'
            }`}
            aria-label="Receive files tab"
          >
            <svg
              style={{ width: 'calc(18 * var(--u))', height: 'calc(18 * var(--u))' }}
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
            <span className="whitespace-nowrap">Receive files</span>
          </button>
        </div>
      </div>

      {/* Right: Square Settings Button (40px x 40px) */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenArchitecture}
          style={{
            width: 'calc(40 * var(--u))',
            height: 'calc(40 * var(--u))',
            borderRadius: 'calc(10 * var(--u))',
            borderWidth: 'calc(2.5 * var(--u))',
            borderColor: '#111111',
          }}
          className="bg-white border-solid flex items-center justify-center shadow-[calc(3 * var(--u))_calc(3 * var(--u))_0_#111111] cursor-pointer hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-transform shrink-0"
          title="Architecture, specs & storage configuration"
          aria-label="Settings and Storage Specs"
        >
          <Settings
            style={{ width: 'calc(20 * var(--u))', height: 'calc(20 * var(--u))', strokeWidth: 2.5 }}
            className="text-[#111111]"
          />
        </button>
      </div>
    </header>
  );
};
