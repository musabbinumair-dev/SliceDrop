import React from 'react';

// Single constant for custom logo path. If empty, the neutral placeholder is displayed.
export const LOGO_SRC = "/assets/illustrations/new-brand-logo.png";

interface LogoProps {
  showTagline?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({
  showTagline = false,
  className = "",
  onClick,
}) => {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      aria-label="SliceDrop logo"
      className={`inline-flex items-center select-none text-left focus:outline-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      {LOGO_SRC ? (
        <div className="flex flex-col">
          <img
            src={LOGO_SRC}
            alt="SliceDrop Logo"
            className="h-13 sm:h-15 md:h-17 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform"
          />
          {showTagline && (
            <span className="text-[11px] sm:text-[13px] font-semibold text-[#71717A] tracking-normal mt-0.5">
              Fast file sharing
            </span>
          )}
        </div>
      ) : (
        /* Neutral Placeholder: rounded square (~48px), 3px black border, cream fill, dashed inner outline and small bold text "LOGO" */
        <div className="inline-flex items-center gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-[14px] bg-[#FDF7ED] border-[3px] border-[#111111] flex items-center justify-center p-1 shrink-0 shadow-hard-xs">
            <div className="w-full h-full border-2 border-dashed border-[#111111] rounded-[8px] flex items-center justify-center">
              <span className="font-heading font-extrabold text-[11px] tracking-wider text-[#111111]">
                LOGO
              </span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-heading font-extrabold text-[30px] sm:text-[34px] md:text-[38px] leading-none text-[#111111] tracking-tight">
              SliceDrop
            </span>
            {showTagline && (
              <span className="text-[11px] sm:text-[13px] font-semibold text-[#71717A] tracking-normal mt-0.5">
                Fast file sharing
              </span>
            )}
          </div>
        </div>
      )}
    </Component>
  );
};
