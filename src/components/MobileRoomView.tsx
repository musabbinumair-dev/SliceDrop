import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  Trash2,
  Copy,
  X,
  Loader2,
  Clock,
  Check,
} from 'lucide-react';
import { RoomData, UploadQueueItem } from './RoomView.tsx';
import { FileItem } from './FileList.tsx';
import { Logo } from './Logo.tsx';
import { StatusChip } from './StatusChip.tsx';
import { FileTypeIcon } from './FileTypeIcon.tsx';

interface MobileRoomViewProps {
  room: RoomData | null;
  creatorToken?: string;
  shareUrl: string;
  maxFileSizeMb: number;
  onLeaveRoom: () => void;
  onRoomEnded: () => void;
  onRefreshRoom: () => Promise<void>;
  onFileUpload: (files: FileList | File[]) => Promise<void>;
  onDownloadFile: (file: FileItem) => void;
  isUploading: boolean;
  uploadQueue: UploadQueueItem[];
  onCreateNewRoom: (stagedFiles?: File[]) => Promise<RoomData | null>;
  onOpenArchitecture?: () => void;
  onOpenReceive?: () => void;
}



export const MobileRoomView: React.FC<MobileRoomViewProps> = ({
  room,
  creatorToken,
  shareUrl,
  maxFileSizeMb,
  onLeaveRoom,
  onRoomEnded,
  onRefreshRoom,
  onFileUpload,
  onDownloadFile,
  isUploading: _isUploading,
  uploadQueue,
  onCreateNewRoom: _onCreateNewRoom,
  onOpenArchitecture: _onOpenArchitecture,
  onOpenReceive: _onOpenReceive,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Toggle state: Code | QR
  const [ticketTab, setTicketTab] = useState<'code' | 'qr'>('code');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [isGoodToKnowOpen, setIsGoodToKnowOpen] = useState(false);
  const [isEndRoomDialogOpen, setIsEndRoomDialogOpen] = useState(false);
  const [isEndingRoom, setIsEndingRoom] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [actionFile, setActionFile] = useState<FileItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drag handling for bottom sheet
  const touchStartY = useRef<number | null>(null);
  const touchDeltaY = useRef<number>(0);

  const activeCode = room?.code || '482731';
  const effectiveShareUrl =
    shareUrl || (typeof window !== 'undefined' ? `${window.location.origin}/?room=${activeCode}` : `https://slicedrop.app/?room=${activeCode}`);

  // Truncated URL with middle ellipsis (e.g. "https://sli...64492211301")
  const getTruncatedUrl = (url: string) => {
    if (!url) return 'https://sli...64492211301';
    try {
      const parsed = new URL(url);
      const code = parsed.searchParams.get('room') || activeCode;
      return `https://sli...${code}`;
    } catch {
      return `https://sli...${activeCode}`;
    }
  };

  // Generate QR code
  useEffect(() => {
    if (effectiveShareUrl) {
      QRCode.toDataURL(effectiveShareUrl, {
        width: 240,
        margin: 1,
        color: {
          dark: '#111111',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('Mobile QR generation error:', err));
    }
  }, [effectiveShareUrl]);

  // Periodic refresh when room is active
  useEffect(() => {
    if (!room || room.status !== 'active') return;
    const interval = setInterval(async () => {
      await onRefreshRoom();
    }, 3500);
    return () => clearInterval(interval);
  }, [room?.status, onRefreshRoom]);

  // Format file sizes
  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Pick files
  const handleFilesPicked = (incoming: FileList | File[] | null) => {
    if (!incoming || incoming.length === 0) return;
    const list = Array.from(incoming);
    const maxBytes = maxFileSizeMb * 1024 * 1024;
    for (const file of list) {
      if (file.size > maxBytes) {
        alert(`"${file.name}" exceeds the maximum limit of ${maxFileSizeMb} MB.`);
        return;
      }
    }
    onFileUpload(list);
  };

  // Copy code
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopiedCode(true);
      setToastMessage('Code copied to clipboard!');
      setTimeout(() => {
        setCopiedCode(false);
        setToastMessage(null);
      }, 2000);
    } catch {
      alert('Unable to copy code.');
    }
  };

  // Copy link
  const handleCopyLink = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(effectiveShareUrl);
      setCopiedLink(true);
      setToastMessage('Link copied!');
      setTimeout(() => {
        setCopiedLink(false);
        setToastMessage(null);
      }, 2000);
    } catch {
      alert('Unable to copy link.');
    }
  };

  // Share link (Web Share API with fallback)
  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SliceDrop - Fast File Sharing',
          text: `Join my SliceDrop room: ${activeCode}`,
          url: effectiveShareUrl,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }
    handleCopyLink();
  };

  // Delete file
  const handleDeleteFile = async (fileId: string) => {
    if (!room || !creatorToken) return;
    try {
      const res = await fetch(`/api/rooms/${room.id}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'x-creator-token': creatorToken,
        },
      });
      if (res.ok) {
        setActionFile(null);
        await onRefreshRoom();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove file.');
      }
    } catch {
      alert('Network error while removing file.');
    }
  };

  // End room
  const handleEndRoom = async () => {
    if (!room || !creatorToken) {
      setIsEndRoomDialogOpen(false);
      onRoomEnded();
      return;
    }

    setIsEndingRoom(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/end`, {
        method: 'POST',
        headers: {
          'x-creator-token': creatorToken,
        },
      });
      if (res.ok) {
        setIsEndRoomDialogOpen(false);
        onRoomEnded();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to end room.');
      }
    } catch {
      alert('Network error while ending room.');
    } finally {
      setIsEndingRoom(false);
    }
  };

  // Bottom sheet touch handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    touchDeltaY.current = currentY - touchStartY.current;

    if (touchDeltaY.current < -35 && !isSheetExpanded) {
      setIsSheetExpanded(true);
      touchStartY.current = null;
    } else if (touchDeltaY.current > 35 && isSheetExpanded) {
      setIsSheetExpanded(false);
      touchStartY.current = null;
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = null;
    touchDeltaY.current = 0;
  };

  const renderMobileFileTile = (filename: string) => {
    return (
      <FileTypeIcon
        filename={filename}
        size="mobile"
        className="w-[43px] h-[43px] rounded-[11px] object-contain select-none shrink-0"
      />
    );
  };

  // Determine files to display: real files only (no mock files)
  const displayFiles = room?.files || [];

  const DEMO_FALLBACK_FILES: Array<{
    id: string;
    originalFilename: string;
    sizeBytes: number;
    status: 'uploaded' | 'uploading' | 'waiting';
    progress?: number;
  }> = [];

  const hasRealItems = (uploadQueue && uploadQueue.length > 0) || (displayFiles && displayFiles.length > 0);
  const itemsToDisplay = hasRealItems
    ? [
        ...uploadQueue
          .filter(q => q.status !== 'completed' && !displayFiles.some(f => f.originalFilename === q.name))
          .map((q, idx) => ({
            id: `q-${q.name}-${idx}`,
            name: q.name,
            size: q.size,
            status: (q.status === 'uploading' ? 'uploading' : 'waiting') as 'uploaded' | 'uploading' | 'waiting',
            progress: q.progress ?? 68,
            realFile: undefined as FileItem | undefined,
          })),
        ...displayFiles.map(f => ({
          id: f.id,
          name: f.originalFilename,
          size: f.sizeBytes,
          status: 'uploaded' as const,
          progress: 100,
          realFile: f,
        })),
      ]
    : [];

  const codeDigits = activeCode.padEnd(6, '0').slice(0, 6).split('');

  return (
    <div className="h-screen bg-[#FBF6EC] text-[#111111] flex flex-col font-['DM_Sans',sans-serif] relative overflow-hidden selection:bg-[#FED232] selection:text-[#111111]">
      {/* Hidden native file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={e => {
          handleFilesPicked(e.target.files);
          e.target.value = '';
        }}
        multiple
        className="hidden"
        id="mobile-room-file-input"
      />

      {/* ================= 1. TOP BAR ================= */}
      <header className="w-full pt-4 h-[50px] px-[20px] flex items-center justify-between relative z-20 shrink-0">
        {/* Left: Brand Logo */}
        <Logo onClick={onLeaveRoom} />

        {/* Right: Top bar overflow menu using icon-dots-horizontal.webp (about 24px wide, 44px hit area) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsTopMenuOpen(prev => !prev)}
            className="w-[44px] h-[44px] flex items-center justify-end pr-1 cursor-pointer bg-transparent focus:outline-none"
            aria-label="Room actions"
          >
            <img
              src="/icon-dots-horizontal.webp"
              alt="Menu"
              width="24"
              height="6"
              className="w-[24px] h-auto object-contain select-none"
            />
          </button>


        </div>
      </header>

      {/* Overflow Menu (Moved out of header to ensure z-index overlay) */}
      {isTopMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsTopMenuOpen(false)}
          />
          <div className="fixed right-4 top-16 w-[220px] bg-white border-[3px] border-[#111111] rounded-[18px] shadow-[4px_4px_0_#111111] p-2 z-50 animate-in fade-in zoom-in-95 font-['DM_Sans',sans-serif]">
            <button
              type="button"
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsGoodToKnowOpen(true);
              }}
              className="w-full text-left px-3 py-3 rounded-[12px] hover:bg-[#FBF6EC] flex items-center gap-3 text-[#111111] font-bold text-[15px] cursor-pointer transition-colors"
            >
              <div className="w-8 h-8 rounded-[10px] bg-[#8562FC]/10 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-[#8562FC]" />
              </div>
              <span>Good to know</span>
            </button>

            <div className="h-[2px] bg-[#E6E0D4] my-1 mx-1" />

            <button
              type="button"
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsEndRoomDialogOpen(true);
              }}
              className="w-full text-left px-3 py-3 rounded-[12px] hover:bg-rose-50 flex items-center gap-3 text-[#FC3A76] font-bold text-[15px] cursor-pointer transition-colors"
            >
              <div className="w-8 h-8 rounded-[10px] bg-[#FC3A76]/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-[#FC3A76]" />
              </div>
              <span>End room</span>
            </button>
          </div>
        </>
      )}

      {/* ================= 2. TICKET CONTAINER ================= */}
      {/* 350px wide container, aspect-ratio 769 / 462, ticket-plain.webp as background */}
      <div className="w-full px-[20px] mt-[12px] shrink-0">
        <div
          className="w-full max-w-[350px] mx-auto aspect-[769/462] relative bg-no-repeat select-none"
          style={{
            backgroundImage: "url('/ticket-plain.webp')",
            backgroundSize: '100% 100%',
          }}
        >
          {/* Overlay Item 1: Code | QR toggle matching the mockup exactly */}
          <div className="absolute top-[8%] left-[8.5%] w-[83%] h-[42px] bg-white border-[3px] border-[#111111] rounded-full shadow-[2px_3px_0_#111111] flex relative z-20 select-none">
            {/* Sliding yellow pill with rounded border matching mockup */}
            <div
              className="absolute -top-[3px] -bottom-[3px] rounded-full bg-[#FED228] border-[3px] border-[#111111] pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
              style={{
                left: '-3px',
                width: 'calc(50% + 3px)',
                transform: ticketTab === 'code' ? 'translateX(0%)' : 'translateX(100%)',
              }}
            />

            {/* Code button */}
            <button
              type="button"
              onClick={() => setTicketTab('code')}
              className="w-1/2 h-full font-['Poppins',sans-serif] text-[17px] font-extrabold text-[#111111] flex items-center justify-center relative z-10 cursor-pointer select-none active:scale-[0.98] transition-transform"
            >
              Code
            </button>

            {/* QR button */}
            <button
              type="button"
              onClick={() => setTicketTab('qr')}
              className="w-1/2 h-full font-['Poppins',sans-serif] text-[17px] font-extrabold text-[#111111] flex items-center justify-center relative z-10 cursor-pointer select-none active:scale-[0.98] transition-transform"
            >
              QR
            </button>
          </div>

          {/* Code View (Digit Tiles + Link Pill) */}
          <div
            className={`absolute inset-0 z-10 transition-opacity duration-300 ease-in-out ${
              ticketTab === 'code'
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Overlay Item 2: Six Digit Tiles (left 7%, width 86%, top 33%, clickable to copy!) */}
            <div
              onClick={handleCopyCode}
              title="Click to copy code"
              className="absolute top-[33%] left-[7%] w-[86%] grid grid-cols-6 gap-[4px] cursor-pointer active:scale-[0.98] transition-transform select-none"
            >
              {codeDigits.map((digit, idx) => (
                <div
                  key={idx}
                  className="w-full aspect-[48/58] max-h-[58px] bg-white border-[3px] border-[#111111] rounded-[14px] flex items-center justify-center font-['Poppins',sans-serif] font-extrabold text-[38px] sm:text-[42px] text-[#111111] leading-none tracking-tight select-none hover:bg-[#FFFDF7] transition-colors"
                >
                  {digit}
                </div>
              ))}
            </div>

            {/* Overlay Item 3: Link Pill (left 7%, width 86%, top 68%, height 38px) */}
            <div
              onClick={handleCopyLink}
              title="Click to copy link"
              className="absolute top-[68%] left-[7%] w-[86%] h-[38px] bg-white border-[3px] border-[#111111] rounded-full px-3.5 flex items-center cursor-pointer active:scale-[0.99] hover:bg-[#FFFDF7] transition-all"
            >
              {/* Link Icon (icon-link-dark.webp at 22px) */}
              <img
                src="/icon-link-dark.webp"
                alt=""
                width="22"
                height="22"
                className="w-[22px] h-[22px] object-contain shrink-0 select-none mr-2"
              />

              {/* Truncated URL with middle ellipsis */}
              <span className="font-['DM_Sans',sans-serif] text-[15px] sm:text-[16px] font-bold text-[#111111] truncate select-all flex-1 leading-none">
                {copiedLink ? 'Copied to clipboard!' : getTruncatedUrl(effectiveShareUrl)}
              </span>
            </div>
          </div>

          {/* QR View: ONLY the QR code box, perfectly aligned inside the ticket element */}
          <div
            className={`absolute inset-0 z-10 transition-opacity duration-300 ease-in-out ${
              ticketTab === 'qr'
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="absolute top-[28%] bottom-[6%] inset-x-0 flex items-center justify-center pointer-events-none">
              <div
                onClick={handleCopyLink}
                title="Click to copy link"
                className="w-[126px] h-[126px] bg-white border-[3px] border-[#111111] rounded-[16px] shadow-[2px_3px_0_#111111] p-2 flex items-center justify-center pointer-events-auto cursor-pointer active:scale-95 transition-transform"
              >
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <Loader2 className="w-6 h-6 animate-spin text-[#111111]" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 3. INFO ROW ================= */}
      {/* 16px gap below ticket, 28px left padding */}
      <div className="w-full mt-[16px] pl-[28px] pr-[20px] flex items-start gap-[16px] shrink-0">
        {/* Lightbulb Icon using icon-lightbulb.webp at 30px */}
        <img
          src="/icon-lightbulb.webp"
          alt=""
          width="30"
          height="30"
          className="w-[30px] h-[30px] object-contain shrink-0 select-none mt-0.5"
        />

        {/* Gray Info Text (14px/500, line-height 18px, color #6B7B83, max-width ~215px) */}
        <p className="font-['DM_Sans',sans-serif] text-[14px] font-medium leading-[18px] text-[#6B7B83] max-w-[215px] select-none">
          Share this code or link with anyone to upload and download files instantly.
        </p>
      </div>

      {/* Spacer between info row and bottom sheet */}
      <div className="flex-1 min-h-[16px]" />

      {/* ================= 4. FILES BOTTOM SHEET ================= */}
      {/* Backdrop when sheet expanded */}
      {isSheetExpanded && (
        <div
          className="fixed inset-0 bg-black/30 z-30 transition-opacity"
          onClick={() => setIsSheetExpanded(false)}
        />
      )}

      <div
        className={`fixed left-0 right-0 bottom-0 bg-[#FEF6EB] border-t-[1.5px] border-x-[1.5px] border-[#111111] rounded-t-[28px] z-40 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] antialiased transition-all duration-300 ease-out ${
          isSheetExpanded ? 'h-[85vh]' : 'h-[402px]'
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle: 38px x 5px, #B9B9B9, centered, 12px below sheet's top edge */}
        <div
          className="absolute top-[12px] left-1/2 -translate-x-1/2 w-[38px] h-[5px] bg-[#B9B9B9] rounded-full cursor-grab active:cursor-grabbing"
          onClick={() => setIsSheetExpanded(prev => !prev)}
        />

        {/* Header row: starts 22px below top edge; left padding 19px, right padding 14px; title and button vertically centered with each other */}
        <div className="pt-[22px] pl-[19px] pr-[14px] flex items-center justify-between shrink-0">
          <h2
            onClick={() => setIsSheetExpanded(prev => !prev)}
            className="font-['Plus_Jakarta_Sans',sans-serif] font-[800] text-[24px] text-[#0A1020] tracking-[-0.01em] leading-none whitespace-nowrap cursor-pointer select-none"
          >
            Files in this room
          </h2>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-[144px] h-[36px] bg-white border-[1.5px] border-[#111111] rounded-[12px] shadow-[1.5px_2px_0_#111111] flex items-center justify-center gap-[10px] cursor-pointer hover:bg-neutral-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[0.5px_1px_0_#111111] transition-all select-none shrink-0"
          >
            <svg
              className="w-[14px] h-[14px] shrink-0 select-none"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M7 2.5V11.5M2.5 7H11.5"
                stroke="#111111"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-['Plus_Jakarta_Sans',sans-serif] font-[700] text-[14px] leading-none text-[#0A1020] whitespace-nowrap">
              Add more files
            </span>
          </button>
        </div>

        {/* Rows list starts 14px below the header row, with 14px side margins, 2px gap between rows */}
        <div className="flex-1 overflow-y-auto mt-[14px] mx-[14px] flex flex-col gap-[2px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {itemsToDisplay.map((item) => (
            <div
              key={item.id}
              className="w-full h-[61px] min-h-[61px] max-h-[61px] bg-[#FBF7EE] border border-[#E3E0D9] rounded-[13px] pl-[14px] relative flex items-center select-none shrink-0"
            >
              {/* Tile: 43px square, radius 11px, 14px from row's left edge */}
              <div className="absolute left-[14px] top-1/2 -translate-y-1/2 w-[43px] h-[43px] rounded-[11px] overflow-hidden shrink-0 flex items-center justify-center">
                {renderMobileFileTile(item.name)}
              </div>

              {/* Name & Size: starts 17px right of tile (57px + 17px = 74px), 14px bold #0A1020, 12px weight 500 #868A8E, 3px gap above */}
              <div
                className="absolute left-[74px] w-[145px] flex flex-col justify-center min-w-0"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              >
                <p
                  title={item.name}
                  className="font-['Plus_Jakarta_Sans',sans-serif] font-[700] text-[14px] text-[#0A1020] truncate leading-none"
                >
                  {item.name}
                </p>
                <p className="font-['Plus_Jakarta_Sans',sans-serif] font-[500] text-[12px] text-[#868A8E] leading-none mt-[3px]">
                  {formatBytes(item.size)}
                </p>
              </div>

              {/* STATUS COLUMN: fixed position starting 233px from screen left edge (233 - 14 = 219px from row left), 96px wide, white-space: nowrap */}
              <div
                className="absolute left-[219px] w-[96px] min-w-[96px] max-w-[96px] shrink-0 whitespace-nowrap"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              >
                {item.status === 'uploaded' && (
                  <div className="flex items-center gap-[8px] whitespace-nowrap">
                    <svg
                      className="w-[14px] h-[14px] shrink-0 select-none"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <circle cx="7" cy="7" r="7" fill="#1FAD56" />
                      <path
                        d="M4.2 7.2L6.1 9.1L9.8 4.9"
                        stroke="#FFFFFF"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[13px] text-[#1FAD56] leading-none whitespace-nowrap">
                      Uploaded
                    </span>
                  </div>
                )}

                {item.status === 'uploading' && (
                  <div className="w-[96px] flex flex-col justify-center whitespace-nowrap">
                    <div className="w-[96px] h-[8px] bg-[#E2E1DF] rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full bg-[#0093FD] rounded-full transition-all duration-200"
                        style={{ width: `${item.progress ?? 68}%` }}
                      />
                    </div>
                    <span className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[12.5px] text-[#1D91DB] leading-none mt-[6px] whitespace-nowrap">
                      Uploading... {item.progress ?? 68}%
                    </span>
                  </div>
                )}

                {item.status === 'waiting' && (
                  <div className="flex items-center gap-[8px] whitespace-nowrap">
                    <svg
                      className="w-[14px] h-[14px] shrink-0 select-none"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <circle cx="7" cy="7" r="7" fill="#C6C6C8" />
                      <path
                        d="M7 3.5V7H9.5"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[13px] text-[#8B8D91] leading-none whitespace-nowrap">
                      Waiting...
                    </span>
                  </div>
                )}
              </div>

              {/* Three-dot menu: 3 vertical dots of 4px, 6px apart, #111, centered 17px from row's right edge, 44px hit area */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.realFile) setActionFile(item.realFile);
                }}
                className="w-[44px] h-[44px] flex flex-col items-center justify-center gap-[6px] cursor-pointer shrink-0 absolute right-[-5px] top-1/2 -translate-y-1/2 select-none"
                aria-label={`Actions for ${item.name}`}
              >
                <span className="w-[4px] h-[4px] rounded-full bg-[#111111] shrink-0" />
                <span className="w-[4px] h-[4px] rounded-full bg-[#111111] shrink-0" />
                <span className="w-[4px] h-[4px] rounded-full bg-[#111111] shrink-0" />
              </button>
            </div>
          ))}
        </div>

        {/* Sticky "Share link" button using icon-link-on-yellow.webp at 22px */}
        <div className="mt-[18px] mx-[12px] pb-[max(14px,env(safe-area-inset-bottom))] shrink-0">
          <button
            type="button"
            onClick={handleShareLink}
            className="w-full h-[43px] rounded-[14px] bg-[#FED232] border-[2px] border-[#111111] shadow-[2px_3px_0_#111111] font-['Plus_Jakarta_Sans',sans-serif] font-[800] text-[18px] text-[#0A1020] flex items-center justify-center gap-[10px] cursor-pointer hover:brightness-95 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_2px_0_#111111] transition-all select-none"
          >
            {/* Link Icon (icon-link-on-yellow.webp at 22px) */}
            <img
              src="/icon-link-on-yellow.webp"
              alt=""
              width="22"
              height="22"
              className="w-[22px] h-[22px] object-contain shrink-0 select-none"
            />
            <span>Share link</span>
          </button>
        </div>
      </div>

      {/* ================= 5. SINGLE FILE ACTION SHEET ================= */}
      {actionFile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setActionFile(null)}
          />
          <div className="w-full max-w-md bg-[#FEF6EB] border-t-[1.5px] border-x-[1.5px] border-[#111111] rounded-t-[28px] p-5 z-10 animate-in slide-in-from-bottom font-['Plus_Jakarta_Sans',sans-serif] antialiased">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                {renderMobileFileTile(actionFile.originalFilename)}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[15px] text-[#0A1020] truncate">
                    {actionFile.originalFilename}
                  </p>
                  <p className="font-medium text-[13px] text-[#868A8E]">
                    {formatBytes(actionFile.sizeBytes)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionFile(null)}
                className="w-8 h-8 rounded-full border-[1.5px] border-[#111111] flex items-center justify-center cursor-pointer hover:bg-neutral-100"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-[#0A1020]" />
              </button>
            </div>

            {/* Actions: Download, Remove, Copy Link */}
            <div className="space-y-2 mt-4 font-['Plus_Jakarta_Sans',sans-serif]">
              <button
                type="button"
                onClick={() => {
                  onDownloadFile(actionFile);
                  setActionFile(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-[#FBF7EE] font-bold text-[15px] text-[#0A1020] cursor-pointer"
              >
                <div className="w-9 h-9 rounded-[10px] bg-[#FED232] border-2 border-[#111111] flex items-center justify-center shrink-0 shadow-[2px_2px_0_#111111]">
                  <Download className="w-4 h-4 text-[#111111] stroke-[2.5]" />
                </div>
                <span>Download file</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteFile(actionFile.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-rose-50 font-bold text-[15px] text-[#FC3A76] cursor-pointer"
              >
                <div className="w-9 h-9 rounded-[10px] bg-[#FC3A76] border-2 border-[#111111] flex items-center justify-center shrink-0 shadow-[2px_2px_0_#111111] text-white">
                  <Trash2 className="w-4 h-4 text-white stroke-[2.2]" />
                </div>
                <span>Remove from room</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/api/files/${actionFile.id}/download`
                  );
                  setToastMessage('File link copied!');
                  setTimeout(() => setToastMessage(null), 2000);
                  setActionFile(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-[#FBF7EE] font-bold text-[15px] text-[#0A1020] cursor-pointer"
              >
                <div className="w-9 h-9 rounded-[10px] bg-white border-2 border-[#111111] flex items-center justify-center shrink-0 shadow-[2px_2px_0_#111111]">
                  <Copy className="w-4 h-4 text-[#111111] stroke-[2.5]" />
                </div>
                <span>Copy download link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 6. GOOD TO KNOW MODAL ================= */}
      {isGoodToKnowOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-5 animate-in fade-in">
          <div className="w-full max-w-[340px] bg-[#FBF6EC] border-[3px] border-[#111111] rounded-[22px] shadow-[5px_5px_0_#111111] p-5 font-['DM_Sans',sans-serif]">
            <div className="flex items-center gap-2.5 mb-2">
              <Clock className="w-5 h-5 text-[#8562FC]" />
              <h3 className="font-['Poppins',sans-serif] font-extrabold text-[18px] text-[#111111]">
                Good to know
              </h3>
            </div>
            <p className="font-medium text-[14px] text-[#555555] leading-relaxed mb-5">
              Files stay available for 1 hour of inactivity or up to 6 hours total. When the room expires or is ended, all files are permanently deleted.
            </p>
            <button
              type="button"
              onClick={() => setIsGoodToKnowOpen(false)}
              className="w-full py-2.5 bg-[#FED232] border-[2.5px] border-[#111111] rounded-[12px] shadow-[2px_2px_0_#111111] font-bold text-[14px] text-[#111111] cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ================= 7. END ROOM CONFIRMATION DIALOG ================= */}
      {isEndRoomDialogOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-5 animate-in fade-in">
          <div className="w-full max-w-[340px] bg-[#FBF6EC] border-[3px] border-[#111111] rounded-[22px] shadow-[5px_5px_0_#111111] p-5 font-['DM_Sans',sans-serif] text-center">
            <img
              src="/mascot-pizza.webp"
              alt=""
              className="w-14 h-14 mx-auto mb-3 object-contain"
            />
            <h3 className="font-['Poppins',sans-serif] font-extrabold text-[20px] text-[#111111] mb-2 leading-tight">
              End Transfer Room?
            </h3>
            <p className="font-medium text-[14px] text-[#666666] leading-snug mb-5">
              All uploaded files will be immediately erased from the server and the room will be closed.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isEndingRoom}
                onClick={() => setIsEndRoomDialogOpen(false)}
                className="flex-1 py-2.5 bg-white border-[2.5px] border-[#111111] rounded-[12px] shadow-[2px_2px_0_#111111] font-bold text-[14px] text-[#111111] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isEndingRoom}
                onClick={handleEndRoom}
                className="flex-1 py-2.5 bg-[#FC3A76] border-[2.5px] border-[#111111] rounded-[12px] shadow-[2px_2px_0_#111111] font-extrabold text-[14px] text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isEndingRoom ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  'Yes, End Room'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 8. FLOATING TOAST NOTIFICATION ================= */}
      {toastMessage && (
        <div
          className="fixed top-14 left-1/2 bg-[#111111] text-white px-4 py-2 rounded-full font-['DM_Sans',sans-serif] font-bold text-[13px] shadow-[2px_3px_0_#FED232] z-50 flex items-center gap-2 animate-in fade-in pointer-events-none"
          style={{ transform: 'translateX(-50%)' }}
        >
          <Check className="w-4 h-4 text-[#FED232] stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
