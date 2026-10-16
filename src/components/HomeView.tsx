import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Loader2 } from 'lucide-react';
import { FileItem } from './FileList.tsx';

interface HomeViewProps {
  roomCode: string;
  shareUrl: string;
  files: FileItem[];
  isDragging: boolean;
  isUploading: boolean;
  uploadQueue: { name: string; size: number; progress: number; status: string }[];
  onFileSelect: (files: FileList | null) => void;
  onCodeChange: (code: string) => void;
  onJoinRoom: (code: string) => void;
  onDownloadFile: (file: FileItem) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  maxFileSizeMb: number;
}

export const HomeView: React.FC<HomeViewProps> = ({
  roomCode,
  shareUrl,
  files,
  isDragging,
  isUploading,
  uploadQueue,
  onFileSelect,
  onCodeChange,
  onJoinRoom,
  onDownloadFile,
  onDragEnter,
  onDragLeave,
  onDrop,
  maxFileSizeMb,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Update digit boxes when roomCode changes
  useEffect(() => {
    if (roomCode && roomCode.length === 6) {
      setCodeDigits(roomCode.split(''));
    }
  }, [roomCode]);

  // Generate QR code for the room URL
  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#111111',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then(data => setQrCodeUrl(data))
        .catch(err => console.error('QR code generation error:', err));
    }
  }, [shareUrl]);

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      const next = [...codeDigits];
      next[index] = '';
      setCodeDigits(next);
      return;
    }

    if (clean.length > 1) {
      const pasted = clean.slice(0, 6);
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setCodeDigits(next);
      if (pasted.length === 6) {
        onCodeChange(pasted);
        onJoinRoom(pasted);
      }
      return;
    }

    const next = [...codeDigits];
    next[index] = clean;
    setCodeDigits(next);

    if (index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }

    const full = next.join('');
    if (full.length === 6) {
      onCodeChange(full);
      onJoinRoom(full);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      const full = codeDigits.join('');
      if (full.length === 6) {
        onJoinRoom(full);
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <img src="/icon-pdf.webp" alt="PDF" className="w-10 h-10 sm:w-11 sm:h-11 object-contain" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
      return <img src="/icon-zip.webp" alt="ZIP" className="w-10 h-10 sm:w-11 sm:h-11 object-contain" />;
    }
    return <img src="/icon-pdf.webp" alt="File" className="w-10 h-10 sm:w-11 sm:h-11 object-contain" />;
  };

  // Default demo items matching mockup if no files uploaded yet in session
  const displayFiles: FileItem[] =
    files.length > 0
      ? files
      : [
          {
            id: 'demo-1',
            originalFilename: 'lecture-notes.pdf',
            sizeBytes: 2.4 * 1024 * 1024,
            mimeType: 'application/pdf',
            createdAt: Date.now() - 1000 * 60 * 5,
          },
          {
            id: 'demo-2',
            originalFilename: 'design-assets.zip',
            sizeBytes: 18 * 1024 * 1024,
            mimeType: 'application/zip',
            createdAt: Date.now() - 1000 * 60 * 12,
          },
        ];

  const displayUrl = shareUrl
    ? shareUrl.replace(/^https?:\/\//, '')
    : `slicedrop.app/r/${roomCode || '482731'}`;

  return (
    <div className="w-full relative min-h-screen">
      {/* Background Shapes (Behind everything, z-0, pointer-events: none) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
        {/* Left Blobs */}
        <img
          src="/bg-left-blobs.webp"
          alt=""
          className="absolute left-0 top-[20px] sm:top-[30px] h-[88vh] max-h-[820px] w-auto object-contain opacity-95 hidden sm:block"
        />

        {/* Right Blobs */}
        <img
          src="/bg-right-blobs.webp"
          alt=""
          className="absolute right-0 top-[20px] sm:top-[30px] h-[88vh] max-h-[820px] w-auto object-contain opacity-95 hidden sm:block"
        />

        {/* Mascot Pizza: sitting on pink left blob, left of headline */}
        <img
          src="/mascot-pizza.webp"
          alt="SliceDrop Mascot"
          className="absolute left-[1.5%] lg:left-[3.5%] xl:left-[5.5%] top-[85px] w-[180px] lg:w-[210px] xl:w-[230px] -rotate-12 hidden md:block z-10"
        />

        {/* Scribble Loop: hanging down from top-right purple blob */}
        <img
          src="/scribble-loop.webp"
          alt=""
          className="absolute right-[3%] lg:right-[5%] xl:right-[7%] top-[80px] w-[85px] lg:w-[100px] hidden md:block z-10"
        />

        {/* Yellow Blob Ring (far left mid-page) */}
        <img
          src="/blob-ring-yellow.webp"
          alt=""
          className="absolute left-[1%] top-[450px] w-[42px] hidden lg:block z-10"
        />

        {/* Right Blob Ring & Pink Triangle */}
        <img
          src="/blob-ring-right.webp"
          alt=""
          className="absolute right-[2%] top-[340px] w-[38px] hidden lg:block z-10"
        />
        <img
          src="/shape-pink-triangle.webp"
          alt=""
          className="absolute right-[2.5%] top-[430px] w-[44px] hidden lg:block z-10"
        />
      </div>

      {/* Main Container */}
      <div className="relative z-10 max-w-[1080px] mx-auto px-4 sm:px-6 pt-0 pb-6">
        {/* 1. Hero Headline */}
        <div className="text-center max-w-2xl mx-auto mt-0 mb-3 sm:mb-4 relative">
          {/* Sparkles Upper Left and Upper Right of Headline */}
          <img
            src="/sparkle-lines-left.webp"
            alt=""
            className="absolute left-[12%] sm:left-[8%] md:left-[4%] -top-2 w-7 sm:w-8 h-7 sm:h-8 object-contain select-none pointer-events-none"
          />
          <img
            src="/sparkle-lines-right.webp"
            alt=""
            className="absolute right-[12%] sm:right-[8%] md:right-[4%] -top-2 w-7 sm:w-8 h-7 sm:h-8 object-contain select-none pointer-events-none"
          />

          <h1 className="font-heading font-extrabold text-[42px] sm:text-[56px] md:text-[68px] lg:text-[76px] leading-[0.92] tracking-tight text-[#111111] select-none">
            <div>Send a slice.</div>
            <div className="inline-flex items-center justify-center">
              <span>Share a file.</span>
              <img
                src="/sparkle-pink-dashes.webp"
                alt=""
                className="w-7 sm:w-9 md:w-10 ml-2 inline-block object-contain"
              />
            </div>
          </h1>

          <p className="mt-1.5 text-[#71717A] font-semibold text-xs sm:text-sm max-w-lg mx-auto">
            Drop files, grab your code, and pick them up anywhere.
          </p>
        </div>

        {/* Hidden Native File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={e => onFileSelect(e.target.files)}
          className="hidden"
          id="slicedrop-native-picker"
        />

        {/* 2. Upload Card (Wide white card, 2 columns split by thin vertical divider) */}
        <div className="bg-white border-[3px] border-[#111111] rounded-[24px] shadow-hard p-3.5 sm:p-4 mb-3 sm:mb-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_220px] gap-3 sm:gap-4 items-stretch">
            {/* Left Column: Dashed Dropzone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                onDragEnter(e);
              }}
              onDragLeave={e => {
                e.preventDefault();
                onDragLeave(e);
              }}
              onDrop={e => {
                e.preventDefault();
                onDrop(e);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[20px] p-4 sm:p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'bg-[#FED228]/20 border-[#111111]'
                  : 'border-[#D4D4D8] hover:border-[#111111] bg-white'
              }`}
            >
              <div className="relative inline-block mb-1">
                <img
                  src="/icon-cloud-upload.webp"
                  alt="Upload cloud"
                  className="w-11 h-11 sm:w-13 sm:h-13 object-contain"
                />
                <img
                  src="/sparkle-pink-small-cloud.webp"
                  alt=""
                  className="absolute -top-1 -right-2 w-4 h-4 object-contain"
                />
              </div>

              <span className="font-heading font-extrabold text-[19px] sm:text-[21px] text-[#111111] leading-tight">
                Drop your files here
              </span>
              <span className="text-xs sm:text-[13px] font-semibold text-[#71717A] mt-0.5">
                or <span className="text-[#8562FC] font-extrabold underline cursor-pointer">browse</span> your device
              </span>

              <span className="mt-2 px-3 py-0.5 rounded-full bg-[#F4F4F5] text-[10px] sm:text-[11px] font-bold text-[#71717A]">
                Up to {maxFileSizeMb} MB per file
              </span>
            </div>

            {/* Thin vertical divider (Desktop) */}
            <div className="hidden md:block w-[1px] bg-[#E4E4E7] self-stretch" />

            {/* Right Column: Big Yellow Choose Files Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#FED228] border-[3px] border-[#111111] rounded-[18px] shadow-hard-btn btn-pressable flex flex-col items-center justify-center gap-1.5 p-4 cursor-pointer group select-none min-h-[110px] md:min-h-[145px]"
            >
              <img
                src="/icon-file-plus.webp"
                alt="File plus icon"
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain group-hover:scale-105 transition-transform"
              />
              <span className="font-heading font-extrabold text-base sm:text-lg text-[#111111]">
                Choose files
              </span>
            </button>
          </div>

          {/* Upload Progress Queue if files are actively uploading */}
          {uploadQueue.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#E4E4E7] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#111111]">
                <span>Uploading files ({uploadQueue.filter(q => q.status === 'completed').length}/{uploadQueue.length})</span>
                {isUploading && (
                  <span className="flex items-center gap-1.5 text-[#8562FC]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing slice...</span>
                  </span>
                )}
              </div>
              {uploadQueue.slice(-3).map((item, idx) => (
                <div key={idx} className="bg-[#FDF7ED] border-2 border-[#111111] rounded-xl p-2 text-xs">
                  <div className="flex items-center justify-between mb-1 font-bold">
                    <span className="truncate max-w-xs">{item.name}</span>
                    <span>{item.progress}%</span>
                  </div>
                  <div className="w-full bg-white border border-[#111111] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#22C55E] h-full transition-all duration-150"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Sharing Room Card (3 columns, vertical dividers) */}
        <div className="bg-white border-[3px] border-[#111111] rounded-[24px] shadow-hard p-4 sm:p-5 mb-4 sm:mb-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-6 items-center">
            {/* Left Section: Your sharing room + 6 digit boxes + yellow copy button */}
            <div>
              <h3 className="font-heading font-extrabold text-lg sm:text-xl text-[#111111] mb-2.5">
                Your sharing room
              </h3>

              {/* 6-Digit boxes + Yellow Copy Button */}
              <div className="flex items-center gap-1.5 sm:gap-2 justify-start overflow-x-auto pb-1">
                {codeDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => {
                      digitInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    aria-label={`Digit ${idx + 1} of 6-digit room code`}
                    className="w-10 sm:w-11 md:w-12 h-12 sm:h-13 md:h-14 bg-white border-[3px] border-[#111111] rounded-[12px] sm:rounded-[14px] shadow-hard-sm text-center font-heading font-extrabold text-xl sm:text-2xl md:text-[30px] text-[#111111] focus:outline-none focus:bg-[#FED228]/15 select-all shrink-0"
                  />
                ))}

                {/* Yellow Copy Button */}
                <button
                  onClick={handleCopyCode}
                  className="w-11 sm:w-12 md:w-13 h-12 sm:h-13 md:h-14 bg-[#FED228] border-[3px] border-[#111111] rounded-[12px] sm:rounded-[14px] shadow-hard-sm btn-pressable flex items-center justify-center shrink-0 cursor-pointer ml-0.5"
                  title="Copy 6-digit room code"
                  aria-label="Copy 6-digit room code"
                >
                  {copiedCode ? (
                    <Check className="w-5 h-5 text-[#111111] stroke-[3]" />
                  ) : (
                    <img
                      src="/icon-copy-gold.webp"
                      alt="Copy"
                      className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                    />
                  )}
                </button>
              </div>

              {/* Ready to share status */}
              <div className="flex items-center gap-2 mt-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                <span className="font-bold text-xs sm:text-sm text-[#111111]">
                  Ready to share
                </span>
              </div>
            </div>

            {/* Thin vertical divider (Desktop) */}
            <div className="hidden md:block w-[1px] bg-[#E4E4E7] self-stretch" />

            {/* Right Section: QR box + Scan to join + Link pill */}
            <div className="flex items-center gap-3.5 sm:gap-4">
              {/* White rounded QR box with sparkles */}
              <div className="relative shrink-0">
                <img
                  src="/sparkle-pink-room.webp"
                  alt=""
                  className="absolute -top-3 -right-3 w-5 h-5 object-contain z-10 pointer-events-none"
                />
                <img
                  src="/sparkle-pink-qr.webp"
                  alt=""
                  className="absolute -bottom-2.5 -left-3 w-5 h-5 object-contain z-10 pointer-events-none"
                />

                <div className="w-[84px] sm:w-[92px] h-[84px] sm:h-[92px] bg-white border-[3px] border-[#111111] rounded-[16px] shadow-hard-btn p-1.5 flex items-center justify-center">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt={`Room QR Code for ${roomCode}`}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#F4F4F5] rounded-lg animate-pulse" />
                  )}
                </div>
              </div>

              {/* Scan to join + Link pill */}
              <div className="flex-1 min-w-0">
                <span className="font-heading font-extrabold text-base sm:text-lg text-[#111111] block mb-1.5 leading-none">
                  Scan to join
                </span>

                <div className="bg-white border-2 border-[#111111] rounded-full px-3.5 py-1.5 sm:py-2 flex items-center justify-between gap-2 shadow-hard-xs max-w-xs">
                  <span className="text-xs sm:text-sm font-bold text-[#111111] truncate select-all">
                    {displayUrl}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="p-1 hover:opacity-75 transition-opacity shrink-0 cursor-pointer"
                    title="Copy direct room link"
                    aria-label="Copy direct room link"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-[#22C55E] stroke-[3]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#111111] stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. How It Works Row (Three items connected by light dotted arrows) */}
        <div className="max-w-[980px] mx-auto py-3 sm:py-4 mb-3 sm:mb-4 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-2">
          {/* Step 1 */}
          <div className="flex items-center gap-3">
            <img
              src="/step-1-pizza.webp"
              alt="Step 1"
              className="w-10 h-10 sm:w-11 sm:h-11 object-contain shrink-0"
            />
            <div>
              <h4 className="font-heading font-extrabold text-sm sm:text-base text-[#111111] leading-tight">
                1. Drop files
              </h4>
              <p className="text-[11px] sm:text-xs font-medium text-[#71717A] mt-0.5">
                Upload your files in seconds.
              </p>
            </div>
          </div>

          {/* Dotted Arrow 1 */}
          <div className="hidden md:flex items-center text-[#D4D4D8] font-bold tracking-[3px] select-none text-xs">
            ······&gt;
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-3">
            <img
              src="/step-2-pizzabox.webp"
              alt="Step 2"
              className="w-10 h-10 sm:w-11 sm:h-11 object-contain shrink-0"
            />
            <div>
              <h4 className="font-heading font-extrabold text-sm sm:text-base text-[#111111] leading-tight">
                2. Share your code
              </h4>
              <p className="text-[11px] sm:text-xs font-medium text-[#71717A] mt-0.5">
                Get a code, link or QR code.
              </p>
            </div>
          </div>

          {/* Dotted Arrow 2 */}
          <div className="hidden md:flex items-center text-[#D4D4D8] font-bold tracking-[3px] select-none text-xs">
            ······&gt;
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-3">
            <img
              src="/step-3-globe.webp"
              alt="Step 3"
              className="w-10 h-10 sm:w-11 sm:h-11 object-contain shrink-0"
            />
            <div>
              <h4 className="font-heading font-extrabold text-sm sm:text-base text-[#111111] leading-tight">
                3. Pick up anywhere
              </h4>
              <p className="text-[11px] sm:text-xs font-medium text-[#71717A] mt-0.5">
                Open on any device and download.
              </p>
            </div>
          </div>
        </div>

        {/* 5. Recent Files Section */}
        <div className="mt-1">
          {/* Heading + View all button */}
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-[#111111] tracking-tight">
              Recent files
            </h3>

            <button
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              className="px-3 py-1 bg-white border-2 border-[#111111] rounded-xl font-heading font-extrabold text-xs text-[#111111] shadow-hard-xs btn-pressable-sm cursor-pointer"
            >
              View all &gt;
            </button>
          </div>

          {/* 2-Column Grid of Recent Files Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {displayFiles.slice(0, 4).map(file => (
              <div
                key={file.id}
                className="bg-white border-[3px] border-[#111111] rounded-[20px] shadow-hard p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-transform hover:-translate-y-0.5"
              >
                {/* File Icon & Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">{getFileIcon(file.originalFilename)}</div>
                  <div className="min-w-0">
                    <h5
                      className="font-heading font-extrabold text-sm sm:text-base text-[#111111] truncate"
                      title={file.originalFilename}
                    >
                      {file.originalFilename}
                    </h5>
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-[#71717A] mt-0.5">
                      <span>{formatSize(file.sizeBytes)}</span>
                      <span>•</span>
                      <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                      <span className="text-[#111111]">Ready</span>
                    </div>
                  </div>
                </div>

                {/* Download Button with icon-download.webp */}
                <button
                  onClick={() => onDownloadFile(file)}
                  className="w-10 h-10 sm:w-11 sm:h-11 bg-white border-[3px] border-[#111111] rounded-[12px] sm:rounded-[14px] shadow-hard-sm btn-pressable flex items-center justify-center shrink-0 cursor-pointer"
                  aria-label={`Download ${file.originalFilename}`}
                  title={`Download ${file.originalFilename}`}
                >
                  <img
                    src="/icon-download.webp"
                    alt="Download"
                    className="w-5 h-5 object-contain"
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
