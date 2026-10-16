import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Upload,
  Download,
  Link as LinkIcon,
  Copy,
  Check,
  MoreHorizontal,
  X,
  Trash2,
  PlusCircle,
  Lightbulb,
  ImageIcon,
  FileArchive,
  Video,
  FileText,
  CheckCircle2,
  Clock,
  Loader2,
  Share2,
  Settings,
} from 'lucide-react';
import { RoomData, UploadQueueItem, StagedFile } from './RoomView.tsx';
import { FileItem } from './FileList.tsx';
import { Logo } from './Logo.tsx';

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
  onOpenArchitecture: () => void;
  onOpenReceive: () => void;
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
  isUploading,
  uploadQueue,
  onCreateNewRoom,
  onOpenArchitecture,
  onOpenReceive,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Staged files when user selects files before room creation
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [ticketTab, setTicketTab] = useState<'code' | 'qr'>('code');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [isEndRoomDialogOpen, setIsEndRoomDialogOpen] = useState(false);
  const [isEndingRoom, setIsEndingRoom] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [actionFile, setActionFile] = useState<FileItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drag handling for bottom sheet
  const touchStartY = useRef<number | null>(null);

  const isRealRoom = Boolean(room && room.id && !room.id.startsWith('demo-room-init'));
  const activeCode = room?.code || '482731';
  const effectiveShareUrl = shareUrl || `${window.location.origin}/?room=${activeCode}`;

  // Truncate URL helper for display in link pill (e.g. "https://sli...64492211301")
  const getTruncatedUrl = (url: string) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const host = parsed.host;
      const code = parsed.searchParams.get('room') || activeCode;
      if (host.length > 14) {
        return `${url.slice(0, 16)}...${url.slice(-11)}`;
      }
      return `${host}/?room=${code}`;
    } catch {
      return url.length > 25 ? `${url.slice(0, 15)}...${url.slice(-10)}` : url;
    }
  };

  // Generate QR code for effectiveShareUrl
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
        .catch(err => console.error('Mobile QR Code generation failed:', err));
    }
  }, [effectiveShareUrl]);

  // Periodic room refresh when room is active
  useEffect(() => {
    if (!isRealRoom || room?.status !== 'active') return;
    const interval = setInterval(async () => {
      await onRefreshRoom();
    }, 3500);
    return () => clearInterval(interval);
  }, [isRealRoom, room?.status, onRefreshRoom]);

  // File size formatter
  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // File type classifier
  const getFileType = (filename: string): 'pdf' | 'image' | 'zip' | 'video' | 'other' => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return 'zip';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
    return 'other';
  };

  // Render 44px neo-brutalist file tile matching mockup
  const renderFileTile = (filename: string) => {
    const type = getFileType(filename);
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (type === 'pdf') {
      return (
        <div className="w-11 h-11 rounded-[10px] bg-[#FD3F77] text-white flex items-center justify-center font-heading font-extrabold text-[12px] shrink-0 border-[1.5px] border-[#111111]/20 shadow-hard-xs">
          PDF
        </div>
      );
    }
    if (type === 'image') {
      return (
        <div className="w-11 h-11 rounded-[10px] bg-[#8562FC] text-white flex items-center justify-center shrink-0 border-[1.5px] border-[#111111]/20 shadow-hard-xs">
          <ImageIcon className="w-5 h-5 text-white" />
        </div>
      );
    }
    if (type === 'zip') {
      return (
        <div className="w-11 h-11 rounded-[10px] bg-[#10B981] text-white flex items-center justify-center shrink-0 border-[1.5px] border-[#111111]/20 shadow-hard-xs">
          <FileArchive className="w-5 h-5 text-white" />
        </div>
      );
    }
    if (type === 'video') {
      return (
        <div className="w-11 h-11 rounded-[10px] bg-[#FC8828] text-white flex items-center justify-center shrink-0 border-[1.5px] border-[#111111]/20 shadow-hard-xs">
          <Video className="w-5 h-5 text-white" />
        </div>
      );
    }
    return (
      <div className="w-11 h-11 rounded-[10px] bg-[#111111] text-white flex items-center justify-center font-heading font-extrabold text-[11px] shrink-0 border-[1.5px] border-[#111111] shadow-hard-xs">
        {ext.toUpperCase().slice(0, 4) || 'FILE'}
      </div>
    );
  };

  // Handle files picked from input
  const handleFilesPicked = (incoming: FileList | File[] | null) => {
    if (!incoming || incoming.length === 0) return;
    const list = Array.from(incoming);

    // Size limit check
    const maxBytes = maxFileSizeMb * 1024 * 1024;
    for (const file of list) {
      if (file.size > maxBytes) {
        alert(`"${file.name}" exceeds the maximum limit of ${maxFileSizeMb} MB.`);
        return;
      }
    }

    if (isRealRoom) {
      // Room already exists: upload directly to room
      onFileUpload(list);
    } else {
      // Pre-room stage: add to staged files
      const newItems: StagedFile[] = list.map(f => ({
        id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        name: f.name,
        size: f.size,
      }));
      setStagedFiles(prev => [...prev, ...newItems]);
    }
  };

  const handleRemoveStagedFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleCreateRoom = async () => {
    if (isRealRoom) return;
    const rawFiles = stagedFiles
      .map(s => s.file)
      .filter((f): f is File => Boolean(f));
    setStagedFiles([]);
    await onCreateNewRoom(rawFiles.length > 0 ? rawFiles : undefined);
  };

  const handleCopyLink = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(effectiveShareUrl);
      setCopiedLink(true);
      setToastMessage('Link copied to clipboard!');
      setTimeout(() => {
        setCopiedLink(false);
        setToastMessage(null);
      }, 2000);
    } catch {
      alert('Unable to copy link.');
    }
  };

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
    // Fallback to clipboard
    handleCopyLink();
  };

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

  const handleEndRoom = async () => {
    if (!room || !creatorToken) {
      onRoomEnded();
      setIsEndRoomDialogOpen(false);
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

  // Touch gesture handling for bottom sheet
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Swipe up expands
    if (deltaY < -40 && !isSheetExpanded) {
      setIsSheetExpanded(true);
      touchStartY.current = null;
    }
    // Swipe down collapses
    else if (deltaY > 40 && isSheetExpanded) {
      setIsSheetExpanded(false);
      touchStartY.current = null;
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = null;
  };

  const totalStagedBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  // Files in room to display: real uploaded files + any demo files if demo room
  const displayFiles: FileItem[] = (room && room.files) || [];

  return (
    <div className="min-h-screen bg-[#FDF7ED] text-[#111111] flex flex-col font-sans relative overflow-x-hidden selection:bg-[#FED228] selection:text-[#111111]">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={e => {
          handleFilesPicked(e.target.files);
          e.target.value = '';
        }}
        multiple
        className="hidden"
      />

      {/* ================= BACKGROUND DECORATION ================= */}
      {/* ONE pink blob in top-left corner behind top bar on Send screens, smooth, bleeding off edges */}
      {!isRealRoom && (
        <div
          className="fixed -top-16 -left-16 w-44 h-44 rounded-full bg-[#FD3F77] pointer-events-none select-none z-0"
          aria-hidden="true"
        />
      )}

      {/* ================= COMMON TOP BAR ================= */}
      <header className="w-full px-5 pt-4 pb-3 flex items-center justify-between relative z-20">
        {/* Left: Brand Logo component */}
        <Logo onClick={onLeaveRoom} />

        {/* Right: Settings Gear (pre-room) or Three-Dot Overflow Menu (room screens) */}
        {!isRealRoom ? (
          <button
            type="button"
            onClick={onOpenArchitecture}
            className="w-11 h-11 bg-white border-[3px] border-[#111111] rounded-[14px] flex items-center justify-center shadow-hard-sm btn-pressable cursor-pointer"
            aria-label="Settings and Architecture Specs"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-[#111111] stroke-[2.5]" />
          </button>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTopMenuOpen(prev => !prev)}
              className="w-11 h-11 bg-white border-[3px] border-[#111111] rounded-[14px] flex items-center justify-center shadow-hard-sm btn-pressable cursor-pointer"
              aria-label="Room actions"
            >
              <MoreHorizontal className="w-6 h-6 text-[#111111]" />
            </button>

            {/* Overflow Dropdown Menu */}
            {isTopMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsTopMenuOpen(false)}
                />
                <div className="absolute right-0 top-13 w-64 bg-white border-[3px] border-[#111111] rounded-[18px] shadow-hard p-3 z-40 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1.5 mb-2">
                    <p className="font-heading font-bold text-[14px] text-[#111111] flex items-center gap-1.5 mb-1">
                      <Clock className="w-4 h-4 text-[#8562FC]" />
                      Good to know
                    </p>
                    <p className="font-dmsans text-[13px] text-[#555555] leading-snug">
                      Files stay available for 1 hour of inactivity or up to 6 hours total.
                    </p>
                  </div>

                  <div className="h-[2px] bg-[#E4E4E7] my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsTopMenuOpen(false);
                      setActionFile(null); // Ensure action sheet is closed when dialog opens
                      setIsEndRoomDialogOpen(true);
                    }}
                    className="w-full text-left px-2 py-2 rounded-[10px] hover:bg-[#FDF7ED] flex items-center gap-2 text-[#FD3F77] font-dmsans font-bold text-[14px] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-[#FD3F77]" />
                    End room
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* ================= SCREENS 1 & 2: PRE-ROOM (SEND MODE) ================= */}
      {!isRealRoom && (
        <div className="flex-1 flex flex-col px-5 relative z-10">
          {/* Segmented Control: 52px high, connected pill, black border, hard shadow */}
          <div className="w-full h-[52px] bg-white border-[3px] border-[#111111] rounded-[16px] shadow-hard-sm flex overflow-hidden mb-4 select-none shrink-0">
            <button
              type="button"
              className="flex-1 bg-[#FED228] border-r-[3px] border-[#111111] flex items-center justify-center gap-2 font-dmsans font-bold text-[15px] text-[#111111] cursor-pointer"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              Send
            </button>
            <button
              type="button"
              onClick={onOpenReceive}
              className="flex-1 bg-white hover:bg-[#FDF7ED] flex items-center justify-center gap-2 font-dmsans font-bold text-[15px] text-[#111111] cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              Receive
            </button>
          </div>

          {/* SCREEN 1: SEND, EMPTY */}
          {stagedFiles.length === 0 ? (
            <div className="flex-1 flex flex-col justify-between pb-24">
              {/* Big Dashed Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  handleFilesPicked(e.dataTransfer.files);
                }}
                className="w-full flex-1 min-h-[380px] my-2 border-2 border-dashed border-[#C9C9C9] rounded-[18px] bg-transparent flex flex-col items-center justify-center text-center p-6 cursor-pointer select-none active:bg-white/40 transition-colors"
              >
                <img
                  src="/dropzone-pizza-sparkles.webp"
                  alt="Dropzone Pizza"
                  className="w-[170px] h-auto object-contain mb-4 pointer-events-none"
                />
                <h1 className="font-heading font-extrabold text-[28px] leading-tight text-[#111111] tracking-tight mb-2">
                  Tap to add<br />files
                </h1>
                <p className="font-dmsans text-[15px] text-[#71717A]">
                  Up to {maxFileSizeMb} MB per file
                </p>
              </div>

              {/* Sticky Bottom Bar (Disabled Style) */}
              <div className="fixed bottom-0 left-0 right-0 p-5 bg-[#FDF7ED]/95 backdrop-blur-xs z-20">
                <button
                  type="button"
                  disabled
                  className="w-full h-14 rounded-[16px] bg-[#E4E4E7] text-[#8E8E93] border-0 font-dmsans font-bold text-[16px] flex items-center justify-center gap-2 cursor-not-allowed select-none"
                >
                  <FileText className="w-5 h-5 text-[#8E8E93]" />
                  Create Room
                </button>
              </div>
            </div>
          ) : (
            /* SCREEN 2: SEND, FILES SELECTED */
            <div className="flex-1 flex flex-col justify-between pb-24">
              <div>
                {/* Compact "+ Add more" tile (64px high) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-16 border-2 border-dashed border-[#C9C9C9] rounded-[16px] bg-white/60 hover:bg-white flex items-center justify-center gap-2 cursor-pointer font-dmsans font-bold text-[15px] text-[#111111] mb-5 select-none active:scale-[0.99] transition-transform"
                >
                  <PlusCircle className="w-5 h-5 text-[#111111] stroke-[2.2]" />
                  Add more
                </button>

                {/* Header Row: "Selected files (N)" and "Total: X MB" */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="font-dmsans font-bold text-[17px] text-[#111111]">
                    Selected files ({stagedFiles.length})
                  </span>
                  <span className="font-dmsans text-[13px] text-[#71717A]">
                    Total: {formatBytes(totalStagedBytes)}
                  </span>
                </div>

                {/* Horizontal Scrolling Strip of Chips */}
                <div className="flex gap-2 overflow-x-auto pb-3 snap-x snap-mandatory -mx-5 px-5 scroll-smooth no-scrollbar">
                  {stagedFiles.map(file => (
                    <div
                      key={file.id}
                      className="w-[120px] h-[112px] shrink-0 snap-start bg-white border-[1.5px] border-[#D9D5CC] rounded-[16px] p-2.5 relative flex flex-col items-center justify-between shadow-xs select-none"
                    >
                      {/* Close 'x' button on top-right */}
                      <button
                        type="button"
                        onClick={e => handleRemoveStagedFile(file.id, e)}
                        className="absolute top-1 right-1 w-8 h-8 flex items-center justify-center text-[#71717A] hover:text-[#111111] cursor-pointer"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-4 h-4 stroke-[2.5]" />
                      </button>

                      {/* 44px File Tile */}
                      <div className="mt-1">
                        {renderFileTile(file.name)}
                      </div>

                      {/* Name & Size */}
                      <div className="w-full text-center px-0.5">
                        <p className="font-dmsans font-bold text-[13px] text-[#111111] truncate leading-tight">
                          {file.name}
                        </p>
                        <p className="font-dmsans text-[12px] text-[#71717A] leading-tight">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sticky Bottom Bar (Enabled Yellow Button) */}
              <div className="fixed bottom-0 left-0 right-0 p-5 bg-[#FDF7ED]/95 backdrop-blur-xs z-20">
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  className="w-full h-14 rounded-[16px] bg-[#FED228] border-[3px] border-[#111111] shadow-hard-btn font-dmsans font-bold text-[16px] text-[#111111] flex items-center justify-center gap-2 cursor-pointer btn-pressable select-none"
                >
                  <LinkIcon className="w-5 h-5 stroke-[2.5]" />
                  Create Room
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= SCREENS 3 & 4: ROOM READY ================= */}
      {isRealRoom && (
        <div className="flex-1 flex flex-col px-5 relative z-10 pb-28">
          {/* Room Ticket Panel */}
          <div className="relative bg-[#FDEFBB] border-[3px] border-[#111111] rounded-[20px] shadow-hard-sm p-4 sm:p-5 mb-3">
            {/* Left and Right Notched Cutouts */}
            <div
              className="absolute -left-[14px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#FDF7ED] border-[3px] border-[#111111] z-10"
              aria-hidden="true"
            />
            <div
              className="absolute -right-[14px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#FDF7ED] border-[3px] border-[#111111] z-10"
              aria-hidden="true"
            />

            {/* Ticket Segmented Toggle: Code | QR */}
            <div className="w-[180px] h-[38px] bg-white border-[3px] border-[#111111] rounded-[12px] mx-auto flex overflow-hidden mb-4 select-none">
              <button
                type="button"
                onClick={() => setTicketTab('code')}
                className={`flex-1 font-heading font-extrabold text-[13px] text-[#111111] transition-colors cursor-pointer ${
                  ticketTab === 'code' ? 'bg-[#FED228]' : 'bg-white hover:bg-[#FDF7ED]'
                }`}
              >
                Code
              </button>
              <button
                type="button"
                onClick={() => setTicketTab('qr')}
                className={`flex-1 font-heading font-extrabold text-[13px] text-[#111111] transition-colors border-l-[3px] border-[#111111] cursor-pointer ${
                  ticketTab === 'qr' ? 'bg-[#FED228]' : 'bg-white hover:bg-[#FDF7ED]'
                }`}
              >
                QR
              </button>
            </div>

            {/* Code View */}
            {ticketTab === 'code' ? (
              <div className="flex flex-col items-center">
                {/* 6 Digit Tiles */}
                <div className="flex items-center justify-center gap-2 mb-4 w-full px-2">
                  {activeCode
                    .slice(0, 6)
                    .split('')
                    .map((digit, idx) => (
                      <div
                        key={idx}
                        className="w-[44px] h-[52px] sm:w-[48px] bg-white border-[3px] border-[#111111] rounded-[10px] flex items-center justify-center font-heading font-extrabold text-[28px] text-[#111111] tracking-tight shadow-hard-xs select-all"
                      >
                        {digit}
                      </div>
                    ))}
                </div>

                {/* Link Pill with Copy Button inside (no copy on code) */}
                <div className="w-full bg-white border-[3px] border-[#111111] rounded-full py-1.5 px-3 flex items-center justify-between gap-2 shadow-hard-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <LinkIcon className="w-4 h-4 text-[#111111] shrink-0 stroke-[2.5]" />
                    <span className="font-dmsans text-[13px] text-[#111111] truncate select-all">
                      {getTruncatedUrl(effectiveShareUrl)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 px-3 py-1 bg-[#FDF7ED] hover:bg-[#FED228] border-[2px] border-[#111111] rounded-full font-dmsans font-bold text-[12px] text-[#111111] shadow-hard-xs btn-pressable cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#16A34A] stroke-[3]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#111111]" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* QR View (same panel size) */
              <div className="flex flex-col items-center justify-center py-1">
                <div className="w-[190px] h-[190px] bg-white border-[3px] border-[#111111] rounded-[14px] p-2 flex items-center justify-center shadow-hard-xs mb-2">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="Room QR Code"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <Loader2 className="w-6 h-6 animate-spin text-[#8562FC]" />
                    </div>
                  )}
                </div>
                <p className="font-dmsans text-[13px] text-[#111111] text-center">
                  Open on any device to join the room.
                </p>
              </div>
            )}
          </div>

          {/* Info text under the ticket */}
          <div className="flex items-start gap-2.5 px-1 mb-4">
            <div className="w-5 h-5 rounded-full bg-[#FED228] border-[1.5px] border-[#111111] flex items-center justify-center shrink-0 mt-0.5 shadow-hard-xs">
              <Lightbulb className="w-3 h-3 text-[#111111] stroke-[2.5]" />
            </div>
            <p className="font-dmsans text-[13px] text-[#444444] leading-snug">
              Share this code or link with anyone. They can upload and download files from any device, even on different networks.
            </p>
          </div>

          {/* ================= BOTTOM SHEET: "Files in this room" ================= */}
          {/* Backdrop when sheet expanded */}
          {isSheetExpanded && (
            <div
              className="fixed inset-0 bg-black/30 z-30 transition-opacity"
              onClick={() => setIsSheetExpanded(false)}
            />
          )}

          <div
            className={`fixed left-0 right-0 bottom-0 bg-white border-t-[3px] border-x-[3px] border-[#111111] rounded-t-[24px] z-40 flex flex-col transition-all duration-300 ease-out shadow-[0_-4px_0_#111111] ${
              isSheetExpanded ? 'h-[85vh]' : 'h-[250px]'
            }`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Drag Handle Bar */}
            <div
              className="w-full pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing"
              onClick={() => setIsSheetExpanded(prev => !prev)}
            >
              <div className="w-10 h-1.5 bg-[#D4D4D8] rounded-full" />
            </div>

            {/* Sheet Header */}
            <div className="px-5 py-2.5 flex items-center justify-between border-b border-[#F4F4F5] shrink-0">
              <h2
                onClick={() => setIsSheetExpanded(prev => !prev)}
                className="font-heading font-bold text-[20px] text-[#111111] cursor-pointer"
              >
                Files in this room
              </h2>

              {/* Fix: Add-more files lives in the sheet header; no floating '+' button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-white hover:bg-[#FED228] border-[2px] border-[#111111] rounded-full font-dmsans font-bold text-[13px] text-[#111111] shadow-hard-xs btn-pressable cursor-pointer flex items-center gap-1 transition-colors"
              >
                <PlusCircle className="w-4 h-4 stroke-[2.2]" />
                <span>Add more files</span>
              </button>
            </div>

            {/* File Rows List */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
              {/* Ongoing Uploads from Queue */}
              {uploadQueue
                .filter(q => q.status === 'uploading')
                .map((qItem, i) => (
                  <div
                    key={`uploading-${i}`}
                    className="flex items-center justify-between p-2.5 bg-[#FDF7ED] border-[1.5px] border-[#111111] rounded-[14px]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {renderFileTile(qItem.name)}
                      <div className="min-w-0 flex-1">
                        <p className="font-dmsans font-bold text-[15px] text-[#111111] truncate leading-tight">
                          {qItem.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-dmsans text-[13px] text-[#71717A]">
                            {formatBytes(qItem.size)}
                          </span>
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden border border-black/20">
                            <div
                              className="h-full bg-[#2563EB] transition-all"
                              style={{ width: `${qItem.progress}%` }}
                            />
                          </div>
                          <span className="font-dmsans font-bold text-[12px] text-[#2563EB]">
                            {qItem.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

              {/* Uploaded Files in Room */}
              {displayFiles.length === 0 && uploadQueue.length === 0 ? (
                <div className="py-8 text-center text-[#71717A]">
                  <p className="font-dmsans text-[15px]">No files in this room yet.</p>
                  <p className="font-dmsans text-[13px] text-[#A1A1AA] mt-1">
                    Tap "+ Add more files" above to upload a slice!
                  </p>
                </div>
              ) : (
                displayFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                  >
                    {/* Left: 44px Tile + File Details */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      {renderFileTile(file.originalFilename)}
                      <div className="min-w-0 flex-1">
                        <p className="font-dmsans font-bold text-[15px] text-[#111111] truncate leading-tight">
                          {file.originalFilename}
                        </p>
                        <div className="flex items-center gap-2.5 mt-0.5">
                          <span className="font-dmsans text-[13px] text-[#71717A]">
                            {formatBytes(file.sizeBytes)}
                          </span>
                          <span className="font-dmsans font-bold text-[13px] text-[#16A34A] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                            Uploaded
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Three-dot overflow menu icon (uncovered hit area >= 44px) */}
                    <button
                      type="button"
                      onClick={() => setActionFile(file)}
                      className="w-11 h-11 flex items-center justify-center text-[#111111] hover:bg-gray-100 rounded-full cursor-pointer shrink-0"
                      aria-label={`Actions for ${file.originalFilename}`}
                    >
                      <MoreHorizontal className="w-5 h-5 text-[#111111]" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* SCREEN 4: Single File Action Sheet (when file's three dots is tapped) */}
            {actionFile && (
              <div className="p-4 bg-white border-t-[3px] border-[#111111] shadow-hard z-50 animate-in slide-in-from-bottom-6">
                {/* Action Card Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    {renderFileTile(actionFile.originalFilename)}
                    <div className="min-w-0 flex-1">
                      <p className="font-dmsans font-bold text-[15px] text-[#111111] truncate">
                        {actionFile.originalFilename}
                      </p>
                      <p className="font-dmsans text-[13px] text-[#71717A]">
                        {formatBytes(actionFile.sizeBytes)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionFile(null)}
                    className="w-8 h-8 rounded-full border-2 border-[#111111] flex items-center justify-center cursor-pointer hover:bg-gray-100"
                    aria-label="Close action sheet"
                  >
                    <X className="w-4 h-4 text-[#111111]" />
                  </button>
                </div>

                {/* Actions: Download, Remove, Copy link */}
                <div className="space-y-2">
                  {/* Download Action */}
                  <button
                    type="button"
                    onClick={() => {
                      onDownloadFile(actionFile);
                      setActionFile(null);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-[#FDF7ED] font-dmsans font-bold text-[15px] text-[#111111] cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-[10px] bg-[#FED228] border-2 border-[#111111] flex items-center justify-center shrink-0 shadow-hard-xs">
                      <Download className="w-4 h-4 text-[#111111] stroke-[2.5]" />
                    </div>
                    <span>Download</span>
                  </button>

                  {/* Remove Action */}
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(actionFile.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-[#FDF7ED] font-dmsans font-bold text-[15px] text-[#111111] cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-[10px] bg-[#FD3F77] border-2 border-[#111111] flex items-center justify-center shrink-0 shadow-hard-xs text-white">
                      <Trash2 className="w-4 h-4 text-white stroke-[2.2]" />
                    </div>
                    <span>Remove</span>
                  </button>

                  {/* Copy Link Action */}
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-[#FDF7ED] font-dmsans font-bold text-[15px] text-[#111111] cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-[10px] bg-white border-2 border-[#111111] flex items-center justify-center shrink-0 shadow-hard-xs">
                      <LinkIcon className="w-4 h-4 text-[#111111] stroke-[2.5]" />
                    </div>
                    <span>Copy link</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sticky Bottom Bar Below the Sheet */}
            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={handleShareLink}
                className="w-full h-14 rounded-[16px] bg-[#FED228] border-[3px] border-[#111111] shadow-hard-btn font-dmsans font-bold text-[16px] text-[#111111] flex items-center justify-center gap-2 cursor-pointer btn-pressable select-none"
              >
                <LinkIcon className="w-5 h-5 stroke-[2.5]" />
                Share link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SCREEN 4: "END ROOM?" CONFIRM DIALOG ================= */}
      {isEndRoomDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-5 animate-in fade-in">
          <div className="w-full max-w-[340px] bg-white border-[3px] border-[#111111] rounded-[20px] shadow-hard p-5">
            <h3 className="font-heading font-extrabold text-[20px] text-[#111111] mb-2">
              End room?
            </h3>
            <p className="font-dmsans text-[14px] text-[#444444] leading-snug mb-5">
              This will permanently close the room and stop file sharing.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isEndingRoom}
                onClick={() => setIsEndRoomDialogOpen(false)}
                className="flex-1 py-3 bg-white border-[3px] border-[#111111] rounded-[14px] shadow-hard-xs font-dmsans font-bold text-[15px] text-[#111111] btn-pressable cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isEndingRoom}
                onClick={handleEndRoom}
                className="flex-1 py-3 bg-[#FD3F77] border-[3px] border-[#111111] rounded-[14px] shadow-hard-xs font-dmsans font-bold text-[15px] text-white btn-pressable cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                {isEndingRoom ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  'End room'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= FLOATING TOAST NOTIFICATION ================= */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 bg-[#111111] text-white px-4 py-2 rounded-full font-dmsans font-bold text-[13px] shadow-hard-sm z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-[#FED228]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
