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


  // Determine files to display: real files first, mock fallback if empty
  const displayFiles = room?.files || [];

  const codeDigits = activeCode.padEnd(6, '0').slice(0, 6).split('');

  return (
    <div className="min-h-screen bg-[#FBF6EC] text-[#111111] flex flex-col font-['DM_Sans',sans-serif] relative overflow-x-hidden pb-[380px] selection:bg-[#FED232] selection:text-[#111111]">
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
      <header className="w-full h-[50px] px-[20px] flex items-center justify-between relative z-20 shrink-0">
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

          {/* Overflow Menu */}
          {isTopMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsTopMenuOpen(false)}
              />
              <div className="absolute right-0 top-[48px] w-[220px] bg-white border-[3px] border-[#111111] rounded-[18px] shadow-[4px_4px_0_#111111] p-3 z-40 animate-in fade-in zoom-in-95 font-['DM_Sans',sans-serif]">
                <button
                  type="button"
                  onClick={() => {
                    setIsTopMenuOpen(false);
                    setIsGoodToKnowOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-[10px] hover:bg-[#FBF6EC] flex items-center gap-2 text-[#111111] font-bold text-[14px] cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-[#8562FC]" />
                  <span>Good to know</span>
                </button>

                <div className="h-[2px] bg-[#E6E0D4] my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setIsTopMenuOpen(false);
                    setIsEndRoomDialogOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-[10px] hover:bg-rose-50 flex items-center gap-2 text-[#FC3A76] font-bold text-[14px] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-[#FC3A76]" />
                  <span>End room</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

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
        className={`fixed left-0 right-0 bottom-0 bg-[#FBF6EC] border-t-[3px] border-x-[3px] border-[#111111] rounded-t-[22px] z-40 flex flex-col transition-all duration-300 ease-out shadow-[0_-4px_0_#111111] ${
          isSheetExpanded ? 'h-[85vh]' : 'h-[370px]'
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle (38px x 5px, #B8B8B8, 6px below top) */}
        <div
          className="w-full pt-[6px] pb-[8px] flex justify-center cursor-grab active:cursor-grabbing shrink-0"
          onClick={() => setIsSheetExpanded(prev => !prev)}
        >
          <div className="w-[38px] h-[5px] bg-[#B8B8B8] rounded-full" />
        </div>

        {/* Header: "Files in this room" (20px/800) + "+ Add more files" (144px x 36px) */}
        <div className="px-[14px] pb-[10px] flex items-center justify-between shrink-0">
          <h2
            onClick={() => setIsSheetExpanded(prev => !prev)}
            className="font-['Poppins',sans-serif] font-extrabold text-[20px] text-[#111111] tracking-tight leading-none cursor-pointer"
          >
            Files in this room
          </h2>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-[144px] h-[36px] bg-white border-[3px] border-[#111111] rounded-[12px] shadow-[2px_3px_0_#111111] flex items-center justify-center gap-[6px] cursor-pointer hover:bg-neutral-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_2px_0_#111111] transition-all select-none"
          >
            {/* icon-plus.webp at 14px */}
            <img
              src="/icon-plus.webp"
              alt=""
              width="14"
              height="14"
              className="w-[14px] h-[14px] object-contain select-none"
            />
            <span className="font-['DM_Sans',sans-serif] font-bold text-[15px] leading-none text-[#111111]">
              Add more files
            </span>
          </button>
        </div>

        {/* File Rows List (padding 0 14px, 3px gap) */}
        <div className="flex-1 overflow-y-auto px-[14px] space-y-[3px] pb-2">
          {displayFiles.length === 0 && uploadQueue.length === 0 && (
            <div className="py-12 px-4 text-center">
              <p className="font-['DM_Sans',sans-serif] font-bold text-[16px] text-[#111111]">No files in this room yet.</p>
              <p className="font-['DM_Sans',sans-serif] text-[13.5px] text-[#7B7B7B] mt-1">
                Tap "+ Add more files" above to upload files.
              </p>
            </div>
          )}

          {/* Real ongoing uploads from queue */}
          {uploadQueue
            .filter(q => q.status === 'uploading')
            .map((qItem, i) => (
              <div
                key={`uq-${i}`}
                className="w-full h-[62px] min-h-[62px] max-h-[62px] bg-[#FBF6EC] border-[1.5px] border-[#E6E0D4] rounded-[16px] pl-[14px] pr-[12px] flex items-center justify-between relative"
              >
                {/* 42px FileTypeIcon + Info (truncates with at least 12px gap to status chip) */}
                <div className="flex items-center min-w-0 flex-1 mr-[12px]">
                  <FileTypeIcon filename={qItem.name} size="mobile" />
                  <div className="ml-[17px] min-w-0 flex-1">
                    <p className="font-['DM_Sans',sans-serif] font-bold text-[15px] text-[#111111] leading-tight truncate">
                      {qItem.name}
                    </p>
                    <p className="font-['DM_Sans',sans-serif] font-medium text-[13px] text-[#7B7B7B] leading-none mt-[2px]">
                      {formatBytes(qItem.size)}
                    </p>
                  </div>
                </div>

                {/* Status Column: fixed width 124px aligned across all rows */}
                <div className="w-[124px] shrink-0 flex items-center justify-center">
                  <StatusChip
                    variant="uploading"
                    progress={qItem.progress}
                    size="mobile"
                  />
                </div>

                {/* Three-dot row menu using icon-dots-vertical.webp (about 4px wide x 16px tall) */}
                <button
                  type="button"
                  disabled
                  className="w-[44px] h-[44px] flex items-center justify-center cursor-default shrink-0 opacity-40 ml-1"
                >
                  <img
                    src="/icon-dots-vertical.webp"
                    alt=""
                    width="4"
                    height="16"
                    className="w-[4px] h-[16px] object-contain select-none"
                  />
                </button>
              </div>
            ))}

          {/* Render real room files */}
          {displayFiles.map((file) => {
            return (
              <div
                key={file.id}
                className="w-full h-[62px] min-h-[62px] max-h-[62px] bg-[#FBF6EC] border-[1.5px] border-[#E6E0D4] rounded-[16px] pl-[14px] pr-[12px] flex items-center justify-between relative"
              >
                {/* 42px FileTypeIcon + Name & Size (truncates with at least 12px gap to status chip) */}
                <div className="flex items-center min-w-0 flex-1 mr-[12px]">
                  <FileTypeIcon filename={file.originalFilename} size="mobile" />
                  <div className="ml-[17px] min-w-0 flex-1">
                    <p className="font-['DM_Sans',sans-serif] font-bold text-[15px] text-[#111111] leading-tight truncate">
                      {file.originalFilename}
                    </p>
                    <p className="font-['DM_Sans',sans-serif] font-medium text-[13px] text-[#7B7B7B] leading-none mt-[2px]">
                      {formatBytes(file.sizeBytes)}
                    </p>
                  </div>
                </div>

                {/* Status Column: fixed width 124px aligned across all rows */}
                <div className="w-[124px] shrink-0 flex items-center justify-center">
                  <StatusChip variant="uploaded" label="Uploaded" size="mobile" />
                </div>

                {/* Three-dot row menu: icon-dots-vertical.webp (about 4px wide x 16px tall, 44px hit area) */}
                <button
                  type="button"
                  onClick={() => setActionFile(file)}
                  className="w-[44px] h-[44px] flex items-center justify-center cursor-pointer shrink-0 ml-1"
                  aria-label={`Actions for ${file.originalFilename}`}
                >
                  <img
                    src="/icon-dots-vertical.webp"
                    alt="Actions"
                    width="4"
                    height="16"
                    className="w-[4px] h-[16px] object-contain select-none"
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Sticky "Share link" button using icon-link-on-yellow.webp at 22px */}
        <div className="px-[12px] pt-[8px] pb-[max(12px,env(safe-area-inset-bottom))] bg-[#FBF6EC] shrink-0">
          <button
            type="button"
            onClick={handleShareLink}
            className="w-full h-[44px] rounded-[14px] bg-[#FED232] border-[3px] border-[#111111] shadow-[3px_4px_0_#111111] font-['Poppins',sans-serif] font-extrabold text-[18px] text-[#111111] flex items-center justify-center gap-[10px] cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_2px_0_#111111] transition-all select-none"
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
          <div className="w-full max-w-md bg-white border-t-[3px] border-x-[3px] border-[#111111] rounded-t-[22px] shadow-[0_-4px_0_#111111] p-5 z-10 animate-in slide-in-from-bottom font-['DM_Sans',sans-serif]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                <FileTypeIcon filename={actionFile.originalFilename} size="mobile" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[15px] text-[#111111] truncate">
                    {actionFile.originalFilename}
                  </p>
                  <p className="text-[13px] text-[#7B7B7B]">
                    {formatBytes(actionFile.sizeBytes)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionFile(null)}
                className="w-8 h-8 rounded-full border-2 border-[#111111] flex items-center justify-center cursor-pointer hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-[#111111]" />
              </button>
            </div>

            {/* Actions: Download, Remove, Copy Link */}
            <div className="space-y-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  onDownloadFile(actionFile);
                  setActionFile(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-[#FBF6EC] font-bold text-[15px] text-[#111111] cursor-pointer"
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
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-[#FBF6EC] font-bold text-[15px] text-[#111111] cursor-pointer"
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
