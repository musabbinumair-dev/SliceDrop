import React from 'react';

export type StatusChipVariant =
  | 'add'
  | 'added'
  | 'waiting'
  | 'uploaded'
  | 'declined'
  | 'failed'
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

  // Exact color definitions matching spec
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
    failed: {
      bg: '#FEF0EF',
      circleBg: '#DF6052',
      textColor: '#D45E52',
      defaultLabel: 'Failed',
    },
    uploading: {
      bg: '#007AFF',
      circleBg: 'transparent',
      textColor: '#FFFFFF',
      defaultLabel: 'Uploading',
    },
  }[variant];

  // Resolve display label (no percentage in label text)
  const displayLabel = label || config.defaultLabel;

  // Accessible aria-label
  const ariaLabel =
    variant === 'uploading'
      ? `Uploading ${progress ?? 0} percent`
      : displayLabel;

  // Render SVG icons for standard variants
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
      case 'failed':
        return (
          <svg
            viewBox="0 0 18 18"
            className="w-full h-full"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 6L12 12M12 6L6 12"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  const isClickable = Boolean(onClick);

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      title={title || ariaLabel}
      onClick={onClick}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full transition-all duration-150 select-none shrink-0 ${
        isClickable ? 'cursor-pointer hover:opacity-90 active:scale-95' : ''
      } ${
        isMobile
          ? 'w-[124px] h-[30px] px-2 gap-[6px] text-[13px] font-semibold'
          : 'w-[136px] h-[34px] px-2 gap-[6px] text-[14px] font-semibold'
      } ${className}`}
      style={{
        backgroundColor: config.bg,
        color: config.textColor,
        lineHeight: 1,
      }}
    >
      {/* In place of the loader icon: percentage for uploading, icon circle for other chips */}
      {variant === 'uploading' ? (
        <span className="font-semibold tabular-nums leading-none tracking-normal whitespace-nowrap shrink-0">
          {progress ?? 0}%
        </span>
      ) : (
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
      )}

      {/* Label text: centered, no wrap or truncate */}
      <span className="font-semibold leading-none tracking-normal whitespace-nowrap">
        {displayLabel}
      </span>
    </div>
  );
};
