import React from 'react';

export type StatusChipVariant =
  | 'add'
  | 'added'
  | 'waiting'
  | 'uploaded'
  | 'declined'
  | 'uploading';

export interface StatusChipProps {
  variant: StatusChipVariant;
  label?: string;
  progress?: number;
  size?: 'desktop' | 'mobile';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  variant,
  label,
  progress,
  size = 'desktop',
  className = '',
  onClick,
  title,
}) => {
  const isMobile = size === 'mobile';

  // Exact color definitions matching spec & mockup image
  const config = {
    add: {
      bg: '#F2F2F2',
      circleBg: '#AEAEAE',
      textColor: '#393939',
      defaultLabel: 'Add',
    },
    added: {
      bg: '#007AFF',
      circleBg: '#FFFFFF',
      textColor: '#FFFFFF',
      defaultLabel: 'Added',
    },
    waiting: {
      bg: '#FFF4EE',
      circleBg: '#FB994C',
      textColor: '#F28F3E',
      defaultLabel: 'Waiting',
    },
    uploaded: {
      bg: '#EEF9F1',
      circleBg: '#49BD68',
      textColor: '#46B066',
      defaultLabel: 'Uploaded',
    },
    declined: {
      bg: '#FEF0EF',
      circleBg: '#DF6052',
      textColor: '#D45E52',
      defaultLabel: 'Declined',
    },
    uploading: {
      bg: '#007AFF',
      circleBg: 'transparent',
      textColor: '#FFFFFF',
      defaultLabel: `Uploading ${progress ?? 0}%`,
    },
  }[variant];

  // Resolve display label
  let displayLabel = label;
  if (!displayLabel) {
    if (variant === 'uploading') {
      displayLabel = `Uploading ${progress ?? 0}%`;
    } else {
      displayLabel = config.defaultLabel;
    }
  }

  // Accessible aria-label
  const ariaLabel =
    variant === 'uploading'
      ? `Uploading ${progress ?? 0} percent`
      : displayLabel;

  // Render SVG icons with 2.2px rounded stroke & generous padding (~50% glyph size)
  const renderIcon = () => {
    switch (variant) {
      case 'add':
        return (
          <svg
            viewBox="0 0 18 18"
            className="w-full h-full"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 5V13M5 9H13"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'added':
        return (
          <svg
            viewBox="0 0 18 18"
            className="w-full h-full"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5.5 9.5L7.8 11.8L12.5 6.8"
              stroke="#007AFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'waiting':
        return (
          <svg
            viewBox="0 0 18 18"
            className="w-full h-full"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 5.5V9H12.2"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'uploaded':
        return (
          <svg
            viewBox="0 0 18 18"
            className="w-full h-full"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5.5 9.5L7.8 11.8L12.5 6.8"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'declined':
        return (
          <svg
            viewBox="0 0 18 18"
            className="w-full h-full"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6.2 6.2L11.8 11.8M11.8 6.2L6.2 11.8"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'uploading':
        return (
          <svg
            viewBox="0 0 18 18"
            className="w-full h-full animate-[spin_0.9s_linear_infinite] motion-reduce:animate-none"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="9"
              cy="9"
              r="5.5"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray="24 10"
            />
          </svg>
        );
    }
  };

  const isClickable = Boolean(onClick);

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      title={title || ariaLabel}
      onClick={onClick}
      className={`inline-flex items-center whitespace-nowrap rounded-full transition-all duration-150 select-none ${
        isClickable ? 'cursor-pointer hover:opacity-90 active:scale-95' : ''
      } ${
        isMobile
          ? 'h-[30px] pl-[7px] pr-[10px] gap-[6px] text-[13px]'
          : 'h-[34px] pl-[8px] pr-[12px] gap-[7px] text-[14px]'
      } ${className}`}
      style={{
        backgroundColor: config.bg,
        color: config.textColor,
        lineHeight: 1,
      }}
    >
      {/* Icon circle */}
      <div
        className={`rounded-full flex items-center justify-center shrink-0 ${
          isMobile ? 'w-[16px] h-[16px]' : 'w-[18px] h-[18px]'
        }`}
        style={{
          backgroundColor: config.circleBg,
        }}
      >
        {renderIcon()}
      </div>

      {/* Label text */}
      <span className="font-semibold tabular-nums leading-none tracking-normal">
        {displayLabel}
      </span>
    </div>
  );
};
