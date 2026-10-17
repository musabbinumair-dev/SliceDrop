import React from 'react';

/**
 * Single editable configuration table for file types.
 * Maps lowercase extensions to body color and uppercase label (or code glyph).
 */
export const FILE_TYPE_TABLE: Record<
  string,
  { color: string; label?: string; codeGlyph?: boolean }
> = {
  // Documents
  pdf: { color: '#E5252A', label: 'PDF' },
  doc: { color: '#0263D1', label: 'DOC' },
  docx: { color: '#0263D1', label: 'DOCX' },
  odt: { color: '#1F6FB2', label: 'ODT' },
  rtf: { color: '#3B6FB6', label: 'RTF' },
  pages: { color: '#E8590C', label: 'PAGES' },
  txt: { color: '#251D36', label: 'TXT' },
  log: { color: '#4B5563', label: 'LOG' },
  md: { color: '#374151', label: 'MD' },

  // Spreadsheets
  xls: { color: '#00733B', label: 'XLS' },
  xlsx: { color: '#00733B', label: 'XLSX' },
  csv: { color: '#0E9F6E', label: 'CSV' },
  ods: { color: '#2F9E44', label: 'ODS' },
  numbers: { color: '#1E8E3E', label: 'NUM' },

  // Presentations
  ppt: { color: '#D24726', label: 'PPT' },
  pptx: { color: '#D24726', label: 'PPTX' },
  key: { color: '#0A84FF', label: 'KEY' },
  odp: { color: '#E8590C', label: 'ODP' },

  // Images
  jpg: { color: '#FF6F01', label: 'JPG' },
  jpeg: { color: '#FF6F01', label: 'JPEG' },
  png: { color: '#F97316', label: 'PNG' },
  webp: { color: '#FF9F1C', label: 'WEBP' },
  heic: { color: '#FB8C3C', label: 'HEIC' },
  avif: { color: '#F59E0B', label: 'AVIF' },
  bmp: { color: '#D97706', label: 'BMP' },
  svg: { color: '#EAB308', label: 'SVG' },
  gif: { color: '#E24F4B', label: 'GIF' },

  // Video
  mp4: { color: '#1CA626', label: 'MP4' },
  mov: { color: '#17913A', label: 'MOV' },
  avi: { color: '#15803D', label: 'AVI' },
  mkv: { color: '#0F766E', label: 'MKV' },
  webm: { color: '#0D9488', label: 'WEBM' },

  // Audio
  mp3: { color: '#C2188A', label: 'MP3' },
  wav: { color: '#A21CAF', label: 'WAV' },
  m4a: { color: '#B91C7B', label: 'M4A' },
  aac: { color: '#9D174D', label: 'AAC' },
  flac: { color: '#BE185D', label: 'FLAC' },
  ogg: { color: '#86198F', label: 'OGG' },

  // Archives
  zip: { color: '#FF712F', label: 'ZIP' },
  rar: { color: '#610353', label: 'RAR' },
  '7z': { color: '#6B2D5C', label: '7Z' },
  tar: { color: '#A16207', label: 'TAR' },
  gz: { color: '#B45309', label: 'GZ' },

  // Apps
  apk: { color: '#092F41', label: 'APK' },
  exe: { color: '#1F2937', label: 'EXE' },
  dmg: { color: '#374151', label: 'DMG' },
  ipa: { color: '#0F172A', label: 'IPA' },

  // Code
  html: { color: '#6000C7', codeGlyph: true },
  xml: { color: '#6000C7', codeGlyph: true },
  css: { color: '#264DE4', label: 'CSS' },
  js: { color: '#CA8A04', label: 'JS' },
  ts: { color: '#3178C6', label: 'TS' },
  json: { color: '#475569', label: 'JSON' },
  py: { color: '#3776AB', label: 'PY' },
  java: { color: '#B45309', label: 'JAVA' },
  kt: { color: '#7F52FF', label: 'KT' },
  c: { color: '#00599C', label: 'C' },
  cpp: { color: '#00599C', label: 'CPP' },
};

/**
 * Mix a hex color 30% toward white (#FFFFFF)
 */
export function mix30TowardWhite(hex: string): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const rMix = Math.round(r + (255 - r) * 0.3);
  const gMix = Math.round(g + (255 - g) * 0.3);
  const bMix = Math.round(b + (255 - b) * 0.3);

  return `#${((1 << 24) + (rMix << 16) + (gMix << 8) + bMix).toString(16).slice(1).toUpperCase()}`;
}

export interface FileTypeIconProps {
  filename: string;
  size?: 'desktop' | 'mobile';
  className?: string;
}

export const FileTypeIcon: React.FC<FileTypeIconProps> = ({
  filename,
  size,
  className = '',
}) => {
  // Extract extension: lowercase, strip dot
  const parts = (filename || '').split('.');
  const rawExt = parts.length > 1 ? parts.pop() || '' : '';
  const ext = rawExt.toLowerCase().replace(/^\./, '').trim();

  const entry = ext ? FILE_TYPE_TABLE[ext] : undefined;

  const bodyColor = entry ? entry.color : '#6B7280';
  const foldColor = mix30TowardWhite(bodyColor);
  const isCodeGlyph = Boolean(entry?.codeGlyph);

  // Label: defined entry label, or extension in uppercase truncated to 4 chars; 'FILE' if missing
  const label =
    entry && entry.label
      ? entry.label
      : ext
      ? ext.toUpperCase().slice(0, 4)
      : 'FILE';

  // Font size by label length: 1-3 chars -> 124, 4 chars -> 98, 5 chars -> 80
  const fontSize = label.length <= 3 ? 124 : label.length === 4 ? 98 : 80;

  // Box sizing: 46px desktop, 42px mobile
  const heightClass =
    size === 'mobile'
      ? 'h-[42px]'
      : size === 'desktop'
      ? 'h-[46px]'
      : 'h-[42px] sm:h-[46px]';

  return (
    <svg
      viewBox="65 0 382 512"
      fill="none"
      aria-hidden="true"
      className={`${heightClass} w-auto shrink-0 select-none ${className}`}
      style={{ overflow: 'visible' }}
    >
      <title>{filename}</title>
      {/* Body path */}
      <path
        d="M123 0H302L446 144V453A58 58 0 0 1 388 511H123A58 58 0 0 1 65 453V58A58 58 0 0 1 123 0Z"
        fill={bodyColor}
      />

      {/* Folded corner path */}
      <path d="M302 0L446 144V149H302Z" fill={foldColor} />

      {/* Code glyph variant or Extension text label */}
      {isCodeGlyph ? (
        <g
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="200,262 150,320 200,378" />
          <polyline points="309,262 359,320 309,378" />
          <line x1="281" y1="252" x2="237" y2="388" />
        </g>
      ) : (
        <text
          x="255.5"
          y="370"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize={fontSize}
          fontWeight="900"
          style={{
            fontFamily: "'Roboto', 'Inter', system-ui, sans-serif",
            letterSpacing: 0,
          }}
        >
          {label}
        </text>
      )}
    </svg>
  );
};
