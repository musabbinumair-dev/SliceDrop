import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { FileItem } from './FileList.tsx';

export interface RoomData {
  id: string;
  code: string;
  createdAt: number;
  lastActivityAt: number;
  expiresInSeconds: number;
  status: 'active' | 'ended' | 'expired';
  isCreator?: boolean;
  files: FileItem[];
}

export interface UploadQueueItem {
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
}

export interface StagedFile {
  id: string;
  file?: File;
  name: string;
  size: number;
}

interface RoomViewProps {
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
}

const DEFAULT_DEMO_STAGED: StagedFile[] = [
  {
    id: 'demo-staged-1',
    name: 'Project Proposal.pdf',
    size: 4.2 * 1024 * 1024,
  },
  {
    id: 'demo-staged-2',
    name: 'photoshoot.jpg',
    size: 6.8 * 1024 * 1024,
  },
  {
    id: 'demo-staged-3',
    name: 'resources.zip',
    size: 1.4 * 1024 * 1024,
  },
];

export const RoomView: React.FC<RoomViewProps> = ({
  room,
  creatorToken,
  shareUrl,
  maxFileSizeMb: _maxFileSizeMb,
  onLeaveRoom,
  onRoomEnded,
  onRefreshRoom,
  onFileUpload,
  onDownloadFile,
  isUploading: _isUploading,
  uploadQueue,
  onCreateNewRoom,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>(DEFAULT_DEMO_STAGED);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(room?.expiresInSeconds || 3600);
  const [isEnding, setIsEnding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

  // Proportional layout scaling for tablet view (code & files cards on the right) and desktop
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [isTabletOrDesktop, setIsTabletOrDesktop] = useState<boolean>(true);

  useEffect(() => {
    const updateLayout = () => {
      if (typeof window === 'undefined') return;
      const vw = window.innerWidth;
      // In Tablet view (e.g. 640px/768px - 1024px) and Desktop:
      // The code and files cards will be on the right (two-column row layout)
      const isRow = vw >= 640;
      setIsTabletOrDesktop(isRow);

      if (isRow) {
        // Design width is 1415px (572px left card + 28px gap + 815px right column)
        // With 32px padding (16px left + 16px right)
        const available = Math.max(320, vw - 32);
        const s = Math.min(1, available / 1415);
        setScale(s);
      } else {
        setScale(1);
      }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    if (!contentRef.current) return;
    const updateHeight = () => {
      if (contentRef.current) {
        setContentHeight(contentRef.current.offsetHeight);
      }
    };
    updateHeight();

    const ro = new ResizeObserver(() => {
      if (contentRef.current) {
        setContentHeight(contentRef.current.offsetHeight);
      }
    });
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, []);

  const isRealRoom = Boolean(room && room.id && !room.id.startsWith('demo-room-init'));
  const activeCode = room?.code || '482731';
  const effectiveShareUrl = shareUrl || `https://slicedrop.app/r/${activeCode}`;

  useEffect(() => {
    if (room?.expiresInSeconds) {
      setRemainingSeconds(room.expiresInSeconds);
    }
  }, [room?.expiresInSeconds]);

  useEffect(() => {
    if (!isRealRoom || room?.status !== 'active') return;

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRealRoom, room?.status, room?.lastActivityAt]);

  useEffect(() => {
    if (!isRealRoom || room?.status !== 'active') return;

    const interval = setInterval(async () => {
      await onRefreshRoom();
    }, 3500);

    return () => clearInterval(interval);
  }, [isRealRoom, room?.status, onRefreshRoom]);

  useEffect(() => {
    const targetUrl = effectiveShareUrl;
    if (targetUrl) {
      QRCode.toDataURL(targetUrl, {
        width: 240,
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
  }, [effectiveShareUrl]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuFileId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!effectiveShareUrl) return;
    navigator.clipboard.writeText(effectiveShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleEndRoom = async () => {
    const confirmed = confirm(
      'Are you sure you want to end this room? All uploaded files will be immediately erased from the server.'
    );
    if (!confirmed) return;

    if (!room || !creatorToken) {
      onRoomEnded();
      return;
    }

    setIsEnding(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/end`, {
        method: 'POST',
        headers: {
          'x-creator-token': creatorToken,
        },
      });
      if (res.ok) {
        onRoomEnded();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to end room.');
      }
    } catch {
      alert('Network error while ending room.');
    } finally {
      setIsEnding(false);
    }
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
        await onRefreshRoom();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete file.');
      }
    } catch {
      alert('Network error while deleting file.');
    }
  };

  const handleFilesPicked = (incoming: FileList | File[] | null) => {
    if (!incoming || incoming.length === 0) return;
    const list = Array.from(incoming);

    if (isRealRoom) {
      onFileUpload(list);
    } else {
      const newStaged: StagedFile[] = list.map(f => ({
        id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        name: f.name,
        size: f.size,
      }));
      setStagedFiles(prev => [...prev, ...newStaged]);
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

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderFileBadge = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return (
        <img
          src="/icon-pdf-room.webp"
          alt="PDF"
          className="w-9 h-9 sm:w-10 sm:h-10 object-contain flex-shrink-0"
        />
      );
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      return (
        <img
          src="/icon-image-purple.webp"
          alt="IMG"
          className="w-9 h-9 sm:w-10 sm:h-10 object-contain flex-shrink-0"
        />
      );
    }
    if (['zip', 'rar', 'tar', 'gz'].includes(ext)) {
      return (
        <img
          src="/icon-zip-green.webp"
          alt="ZIP"
          className="w-9 h-9 sm:w-10 sm:h-10 object-contain flex-shrink-0"
        />
      );
    }
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
      return (
        <img
          src="/icon-video-orange.webp"
          alt="VID"
          className="w-9 h-9 sm:w-10 sm:h-10 object-contain flex-shrink-0"
        />
      );
    }
    return (
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#111111] text-white font-heading font-extrabold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs">
        {ext.toUpperCase().slice(0, 4) || 'FILE'}
      </div>
    );
  };

  const renderFileTile = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return (
        <img
          src="/icon-pdf-room.webp"
          alt="PDF"
          className="w-[46px] h-[46px] rounded-[10px] object-contain flex-shrink-0"
        />
      );
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      return (
        <img
          src="/icon-image-purple.webp"
          alt="IMG"
          className="w-[46px] h-[46px] rounded-[10px] object-contain flex-shrink-0"
        />
      );
    }
    if (['zip', 'rar', 'tar', 'gz'].includes(ext)) {
      return (
        <img
          src="/icon-zip-green.webp"
          alt="ZIP"
          className="w-[46px] h-[46px] rounded-[10px] object-contain flex-shrink-0"
        />
      );
    }
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
      return (
        <img
          src="/icon-video-orange.webp"
          alt="VID"
          className="w-[46px] h-[46px] rounded-[10px] object-contain flex-shrink-0"
        />
      );
    }
    return (
      <div className="w-[46px] h-[46px] rounded-[10px] bg-[#111111] text-white font-bold text-[12px] flex items-center justify-center flex-shrink-0">
        {ext.toUpperCase().slice(0, 4) || 'FILE'}
      </div>
    );
  };

  const totalStagedBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);
  const roomFiles: FileItem[] = isRealRoom && room ? room.files : [];

  // If room was ended or expired
  if (isRealRoom && room && (room.status !== 'active' || remainingSeconds === 0)) {
    return (
      <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
        {/* Smooth CSS background shapes */}
        <div
          className="fixed -top-[160px] -left-[180px] w-[420px] h-[360px] rounded-full bg-[#FD3F77] pointer-events-none select-none z-0"
          aria-hidden="true"
        />
        <div
          className="fixed -bottom-[120px] -left-[150px] w-[300px] h-[300px] rounded-full bg-[#8562FC] pointer-events-none select-none z-0"
          aria-hidden="true"
        />
        <img
          src="/room-blob-yellow-top-right.webp"
          alt=""
          className="fixed top-0 right-0 w-64 sm:w-80 md:w-96 max-w-none pointer-events-none select-none z-0"
        />
        <div
          className="fixed -bottom-[100px] -right-[100px] w-[200px] h-[200px] rounded-full bg-[#FED228] border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] pointer-events-none select-none z-0"
          aria-hidden="true"
        />

        <div className="relative z-10 bg-white border-[3px] border-[#111111] rounded-[24px] shadow-[6px_6px_0_#111111] max-w-md w-full p-8 text-center">
          <img src="/mascot-pizza.webp" alt="" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h2 className="font-heading font-extrabold text-2xl text-[#111111] mb-2">
            {room.status === 'ended' ? 'Transfer Room Closed' : 'Room Expired'}
          </h2>
          <p className="font-body text-sm text-[#666666] mb-6">
            {room.status === 'ended'
              ? 'The room creator ended this transfer session. Stored files have been purged from temporary storage.'
              : 'This transfer room reached its inactivity timeout. All files have been securely removed.'}
          </p>
          <button
            onClick={onLeaveRoom}
            type="button"
            className="w-full py-3 px-6 rounded-[16px] bg-[#FED228] border-[3px] border-[#111111] font-heading font-extrabold text-sm text-[#111111] shadow-[3px_3px_0_#111111] btn-pressable cursor-pointer"
          >
            Return to SliceDrop Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-80px)] bg-[#FDF7ED]">
      {/* ================= BACKGROUND DECORATIONS (behind all cards, z-0) ================= */}
      {/* 9. Pure CSS smooth left shapes */}
      <div
        className="fixed -top-[160px] -left-[180px] w-[420px] h-[360px] rounded-full bg-[#FD3F77] pointer-events-none select-none z-0"
        aria-hidden="true"
      />
      <div
        className="fixed -bottom-[120px] -left-[150px] w-[300px] h-[300px] rounded-full bg-[#8562FC] pointer-events-none select-none z-0"
        aria-hidden="true"
      />

      {/* Top-right yellow blob behind header & settings */}
      <img
        src="/room-blob-yellow-top-right.webp"
        alt=""
        className="fixed top-0 right-0 w-64 sm:w-80 md:w-96 max-w-none pointer-events-none select-none z-0"
      />

      {/* 8. Bottom-right yellow circle: ~200px diameter anchored to corner, no pizza overlapping */}
      <div
        className="fixed -bottom-[100px] -right-[100px] w-[200px] h-[200px] rounded-full bg-[#FED228] border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] pointer-events-none select-none z-0"
        aria-hidden="true"
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => {
          handleFilesPicked(e.target.files);
          e.target.value = '';
        }}
        id="room-file-input"
      />

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="relative z-10 w-full max-w-[1487px] mx-auto px-4 sm:px-6 pt-2 pb-24">
        <div
          className="w-full flex justify-center"
          style={{
            height: isTabletOrDesktop && contentHeight ? `${contentHeight * scale}px` : 'auto',
          }}
        >
          <div
            ref={contentRef}
            style={
              isTabletOrDesktop
                ? {
                    width: '1415px',
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    flexShrink: 0,
                  }
                : undefined
            }
            className={
              isTabletOrDesktop
                ? 'flex flex-row items-start justify-center gap-[28px]'
                : 'flex flex-col items-center gap-6 w-full max-w-[572px] mx-auto'
            }
          >
            
            {/* ================= LEFT COLUMN ================= */}
            <div className="relative w-[572px] flex-shrink-0">
              {/* 7. BACKGROUND: Purple (#8562FC) shape peeking behind the card at bottom-left */}
              <div
                className="absolute -left-[20px] bottom-0 w-[240px] h-[160px] rounded-[60px] bg-[#8562FC] pointer-events-none select-none -z-10"
                aria-hidden="true"
              />

              {/* CARD: 572px wide, #FCF9F2, 3px solid #111, radius 22px, shadow 5px 5px 0 #111, px-32px py-24px */}
              <div className="w-[572px] bg-[#FCF9F2] border-[3px] border-[#111111] rounded-[22px] shadow-[5px_5px_0_#111111] px-[32px] py-[24px] flex flex-col relative z-0">
                
                {/* 1. BACK ROW (center at y=38 from card top: 24px top padding + 14px = 38px) */}
                <button
                type="button"
                onClick={onLeaveRoom}
                className="flex items-center gap-[12px] text-[17px] font-semibold text-[#111111] hover:opacity-75 transition-opacity cursor-pointer w-fit leading-none"
                aria-label="Back to home"
              >
                <img
                  src="/icon-arrow-left.webp"
                  alt=""
                  className="w-[18px] h-[18px] object-contain flex-shrink-0"
                />
                <span>Create a sharing room</span>
              </button>

              {/* 2. HEADLINE (top of text ~42px below the back row) */}
              <div className="mt-[42px]">
                <h1 className="font-['Plus_Jakarta_Sans',sans-serif] font-extrabold text-[52px] leading-[48px] tracking-[-0.02em] text-[#111111]">
                  <span className="inline-flex items-center">
                    <span>Add your files</span>
                    <img
                      src="/sparkle-pink-title.webp"
                      alt=""
                      className="w-[48px] h-[48px] object-contain ml-[12px] -translate-y-[6px] pointer-events-none select-none flex-shrink-0"
                    />
                  </span>
                  <br />
                  <span>and create a room.</span>
                </h1>
              </div>

              {/* 3. SUBTITLE (12px below headline, on one line about 455px wide) */}
              <p className="mt-[12px] text-[17px] font-medium text-[#5E6470] whitespace-nowrap leading-snug">
                Upload files, get a 6-digit code and share it anywhere.
              </p>

              {/* 4. DROPZONE (gap above: 28px, 508px wide x 246px high, 2px dashed #C9C9C9, radius 14px) */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    handleFilesPicked(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-[28px] w-full max-w-[508px] h-[246px] border-[2px] border-dashed border-[#C9C9C9] rounded-[14px] bg-transparent flex flex-col items-center justify-center cursor-pointer transition-colors relative ${
                  isDragging ? 'bg-[#FED228]/10 border-[#111111]' : 'hover:border-neutral-400'
                }`}
              >
                <div className="flex flex-col items-center justify-center">
                  <img
                    src="/dropzone-pizza-sparkles.webp"
                    alt="Drop files"
                    className="w-[148px] object-contain pointer-events-none select-none"
                  />
                  <p className="mt-[20px] text-[19px] font-bold text-[#111111] leading-none">
                    Drag & drop files here
                  </p>
                  <p className="mt-[6px] text-[15px] font-semibold text-[#111111] leading-none">
                    or <span className="cursor-pointer">click to browse</span>
                  </p>
                  <div className="mt-[12px] h-[25px] px-[14px] bg-[#EAEBED] rounded-full flex items-center justify-center text-[12.5px] font-medium text-[#555555] leading-none whitespace-nowrap select-none">
                    Max file size: 100 MB <span className="mx-[8px]">•</span> Multiple files allowed
                  </div>
                </div>
              </div>

              {/* 5. SELECTED FILES BOX (gap above: 20px, 508px wide, bg #FCFBF6, border 1px solid #E0DED8, radius 10px, padding 16px) */}
              <div className="mt-[20px] w-full max-w-[508px] bg-[#FCFBF6] border border-[#E0DED8] rounded-[10px] p-[16px] flex flex-col">
                <div className="flex items-center justify-between mb-[14px]">
                  <span className="text-[16px] font-bold text-[#111111] leading-none">
                    Selected files ({stagedFiles.length})
                  </span>
                  <span className="text-[13px] font-medium text-[#666666] leading-none">
                    Total: {formatBytes(totalStagedBytes)}
                  </span>
                </div>

                {stagedFiles.length === 0 ? (
                  <p className="text-[13px] font-medium text-[#888888] text-center py-4">
                    No files selected yet. Drop files above.
                  </p>
                ) : (
                  <div className="space-y-[8px]">
                    {stagedFiles.map(s => {
                      return (
                        <div
                          key={s.id}
                          className="w-full h-[66px] bg-[#FBFAF5] border border-[#D9D5CC] rounded-[8px] flex items-center justify-between pl-[10px] pr-[16px] relative"
                        >
                          <div className="flex items-center min-w-0 flex-1">
                            {renderFileTile(s.name)}
                            <div className="ml-[11px] min-w-0 flex-1 flex flex-col justify-center">
                              <p className="text-[16px] font-bold text-[#111111] leading-tight truncate">
                                {s.name}
                              </p>
                              <p className="text-[13px] font-medium text-[#666666] leading-none mt-[4px]">
                                {formatBytes(s.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={e => handleRemoveStagedFile(s.id, e)}
                            className="w-[18px] h-[18px] flex items-center justify-center cursor-pointer flex-shrink-0 hover:opacity-70 transition-opacity"
                            title="Remove"
                            aria-label={`Remove ${s.name}`}
                          >
                            <img
                              src="/icon-close-x.webp"
                              alt="Remove"
                              className="w-[18px] h-[18px] object-contain"
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 6. CREATE ROOM BUTTON (gap above: 28px, centered, 435x62px, #FED22E, 3px solid #111, radius 12px, shadow 5px 6px 0 #111) */}
              <div className="mt-[28px] relative flex items-center justify-center">
                {/* Black sparkle strokes: left at 34px from card's left edge near button top; right at 20px from card's right edge near button bottom */}
                <img
                  src="/sparkle-lines-btn-left.webp"
                  alt=""
                  className="absolute left-[2px] top-[4px] w-[24px] h-[24px] object-contain pointer-events-none select-none z-10"
                />

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={stagedFiles.length === 0}
                  className={`w-[435px] max-w-full h-[62px] rounded-[12px] border-[3px] border-[#111111] flex items-center justify-center gap-[12px] font-['Plus_Jakarta_Sans','Poppins',sans-serif] font-extrabold text-[22px] text-[#111111] select-none transition-all ${
                    stagedFiles.length === 0
                      ? 'bg-[#EDEBE6] shadow-none cursor-not-allowed text-[#888888] opacity-80'
                      : 'bg-[#FED22E] shadow-[5px_6px_0_#111111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_4px_0_#111111] cursor-pointer'
                  }`}
                >
                  <img
                    src="/mascot-pizza.webp"
                    alt=""
                    className="w-[36px] h-[36px] object-contain flex-shrink-0"
                  />
                  <span>Create Room</span>
                </button>

                <img
                  src="/sparkle-lines-btn-right.webp"
                  alt=""
                  className="absolute right-[0px] bottom-[4px] w-[24px] h-[24px] object-contain pointer-events-none select-none z-10"
                />
              </div>

            </div>
          </div>


          {/* ================= RIGHT COLUMN (TWO CARDS STACKED) ================= */}
          <div className="w-[815px] flex-shrink-0 flex flex-col gap-6">
            
            {/* CARD 1: Pale yellow card "Your room is ready!" (Width 815px, height ~377px, #FDEFBB, 3px solid #111, radius 22px, shadow 5px 5px 0 #111) */}
            <div className="w-[815px] min-h-[377px] bg-[#FDEFBB] border-[3px] border-[#111111] rounded-[22px] shadow-[5px_5px_0_#111111] pt-[16px] pb-[16px] px-[28px] flex flex-col justify-between">
              
              {/* TOP SECTION: 3 Columns (Heading & Code box, QR box with sparkle, Scan text) */}
              <div className="flex flex-row items-start">
                
                {/* Column 1: Heading row + Code box (313px wide) */}
                <div className="flex flex-col w-[313px] flex-shrink-0">
                  {/* 1. Heading row: pizza 50px at left, 14px gap, "Your room is ready!" 22px weight 800 #111 */}
                  <div className="h-[50px] flex items-center gap-[14px]">
                    <img
                      src="/mascot-pizza.webp"
                      alt=""
                      className="w-[50px] h-[50px] object-contain flex-shrink-0"
                    />
                    <h3 className="font-heading font-extrabold text-[22px] text-[#111111] leading-none">
                      Your room is ready!
                    </h3>
                  </div>

                  {/* 2. Code box: 11px gap below heading, 313x77px, white, 3px solid #111, radius 14px, shadow 4px 4px 0 #111 */}
                  <div className="mt-[11px] w-[313px] h-[77px] bg-white border-[3px] border-[#111111] rounded-[14px] shadow-[4px_4px_0_#111111] flex items-center justify-center flex-shrink-0">
                    <span className="font-heading font-extrabold text-[60px] tracking-[0.04em] text-[#111111] leading-none select-all">
                      {activeCode}
                    </span>
                  </div>
                </div>

                {/* Column 2: 3. QR box (181x169px, 50px gap from code box, top aligns with heading row, pink sparkle 25px right of top edge) */}
                <div className="relative w-[181px] h-[169px] bg-white border-[3px] border-[#111111] rounded-[18px] shadow-[4px_4px_0_#111111] flex items-center justify-center flex-shrink-0 ml-[50px]">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      className="w-[130px] h-[130px] object-contain"
                    />
                  ) : (
                    <div className="w-[130px] h-[130px] bg-neutral-100 rounded-lg flex items-center justify-center font-heading font-bold text-xs text-neutral-400">
                      QR Code
                    </div>
                  )}

                  {/* Pink sparkle: OUTSIDE the box, 25px to the right of its right edge, aligned with box's top */}
                  <img
                    src="/sparkle-pink-qr-room.webp"
                    alt=""
                    className="absolute top-0 w-[28px] h-[28px] object-contain pointer-events-none select-none block"
                    style={{ left: 'calc(100% + 25px)' }}
                  />
                </div>

                {/* Column 3: 4. Scan text (50px right of QR box, vertically centered with QR box) */}
                <div className="h-[169px] flex flex-col justify-center min-w-0 ml-[50px]">
                  <p className="font-heading font-extrabold text-[17px] text-[#111111] leading-tight whitespace-nowrap">
                    Scan the QR code
                  </p>
                  <p className="mt-[8px] text-[15px] font-medium text-[#4F6275] leading-[22px] whitespace-nowrap">
                    Open on any device<br />
                    to join the room.
                  </p>
                </div>

              </div>

              {/* 5. Link bar: 20px below QR box's bottom edge, full content width ~751px, height 58px, white, 3px solid #111, radius 12px, shadow 4px 4px 0 #111 */}
              <div className="mt-[20px] w-full max-w-[751px] h-[58px] bg-white border-[3px] border-[#111111] rounded-[12px] shadow-[4px_4px_0_#111111] flex items-center overflow-hidden">
                {/* Left cell: 72px wide with link icon (~28px) centered */}
                <div className="w-[72px] min-w-[72px] h-full flex items-center justify-center flex-shrink-0">
                  <img src="/icon-link.webp" alt="" className="w-[28px] h-[28px] object-contain" />
                </div>

                {/* Vertical divider: 1.5px #C8C8C8 */}
                <div className="w-[1.5px] h-full bg-[#C8C8C8] flex-shrink-0" />

                {/* URL text: starts 16px after divider, 16px, weight 500, #111, one line, ellipsis */}
                <div className="flex-1 min-w-0 h-full flex items-center pl-[16px] pr-[12px]">
                  <span className="font-sans text-[16px] font-medium text-[#111111] truncate select-all">
                    {effectiveShareUrl}
                  </span>
                </div>

                {/* Right cell: 122px wide, white, border-left 2px solid #111, copy icon (~22px), 8px gap, "Copy" 15px weight 700 #111 */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-[122px] min-w-[122px] h-full flex items-center justify-center gap-[8px] bg-white hover:bg-[#F5F5F5] transition-colors border-l-[2px] border-[#111111] flex-shrink-0 cursor-pointer"
                  title="Copy link"
                >
                  <img src="/icon-copy-dark.webp" alt="" className="w-[22px] h-[22px] object-contain flex-shrink-0" />
                  <span className="font-heading font-bold text-[15px] text-[#111111]">
                    {copiedLink ? 'Copied' : 'Copy'}
                  </span>
                </button>
              </div>

              {/* 6. Info strip: 20px below link bar, width ~760px (~4px wider than link bar on each side), height ~67px, bg #FFF9DD, no border, radius 12px, padding 0 16px */}
              <div className="mt-[20px] w-full max-w-[760px] -mx-[4px] min-h-[67px] bg-[#FFF9DD] rounded-[12px] px-[16px] py-[10px] flex items-center border-none">
                <img
                  src="/mascot-pizza.webp"
                  alt=""
                  className="w-[36px] h-[36px] object-contain flex-shrink-0"
                />
                <p className="ml-[16px] text-[15.5px] font-medium leading-[24px] text-[#1F2D3A]">
                  Share this code or link with anyone. They can upload and download files<br />
                  from any device, even on different networks.
                </p>
              </div>

            </div>


            {/* CARD 2: "Files in this room" card with mint "Good to know" banner inside at bottom */}
            {/* Width 815px, height ~501px, background #FDFAF5, border 3px solid #111, radius 22px, hard shadow 5px 5px 0 #111 (no blur). Padding 24px on all four sides. */}
            <div className="w-[815px] min-h-[501px] bg-[#FDFAF5] border-[3px] border-[#111111] rounded-[22px] shadow-[5px_5px_0_#111111] p-[24px] flex flex-col justify-between">
              
              <div className="flex flex-col">
                {/* 1. TITLE ROW: "Files in this room" 24px weight 800 #111 on left; white "Add more files" button 159x39px, border 2px solid #111, radius 10px, shadow 3px 3px 0 #111, plus icon (~16px) + 10px gap + "Add more files" 14px weight 700. Title & button vertically centered, first row starts 10px below button */}
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-extrabold text-[24px] text-[#111111] leading-none">
                    Files in this room
                  </h3>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-[159px] h-[39px] bg-white border-[2px] border-[#111111] rounded-[10px] shadow-[3px_3px_0_#111111] flex items-center justify-center gap-[10px] cursor-pointer hover:bg-neutral-50 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_#111111]"
                  >
                    <img
                      src="/icon-plus.webp"
                      alt=""
                      className="w-[16px] h-[16px] object-contain flex-shrink-0"
                    />
                    <span className="font-heading font-bold text-[14px] text-[#111111] leading-none">
                      Add more files
                    </span>
                  </button>
                </div>

                {/* 2. FILE ROWS: 4 rows, 6px gap between them; starts 10px below button */}
                <div className="mt-[10px] flex flex-col gap-[6px]">
                  {/* Real uploading queue items */}
                  {uploadQueue.map((item, idx) => (
                    <div
                      key={`uq-${idx}`}
                      className="relative w-full max-w-[759px] h-[74px] bg-[#FCFBF6] border border-[#E9E8E3] rounded-[12px] px-[18px] flex items-center justify-between"
                    >
                      <div className="flex items-center min-w-0">
                        {renderFileTile(item.name)}
                        <div className="ml-[22px] min-w-0 flex flex-col justify-center">
                          <p className="text-[16px] font-bold text-[#111111] leading-tight truncate max-w-[280px]">
                            {item.name}
                          </p>
                          <p className="mt-[4px] text-[13px] font-medium text-[#666666] leading-none">
                            {formatBytes(item.size)}
                          </p>
                        </div>
                      </div>

                      {/* Status Column at x=387px, 150px wide */}
                      <div className="absolute left-[387px] w-[150px] flex flex-col justify-center">
                        <div className="w-full h-[10px] bg-[#EBEAE6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0A78F5] rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="mt-[8px] text-[14px] font-semibold text-[#1F4E8C] leading-none">
                          Uploading... {item.progress}%
                        </span>
                      </div>

                      {/* Action buttons (right aligned) */}
                      <div className="flex items-center ml-auto flex-shrink-0">
                        <button
                          type="button"
                          disabled
                          className="w-[122px] h-[40px] bg-[#ECEBE6] border border-[#D6D5D0] rounded-[10px] flex items-center justify-center gap-[8px] cursor-not-allowed select-none"
                        >
                          <img
                            src="/icon-download-grey.webp"
                            alt=""
                            className="w-[18px] h-[18px] object-contain flex-shrink-0"
                          />
                          <span className="font-heading font-semibold text-[14px] text-[#8E8D88] leading-none">
                            Download
                          </span>
                        </button>
                        <button
                          type="button"
                          className="w-[34px] h-[34px] ml-[10px] rounded-[8px] bg-transparent hover:bg-neutral-200/50 flex items-center justify-center cursor-pointer transition-colors"
                          aria-label="More"
                        >
                          <img
                            src="/icon-dots.webp"
                            alt="More"
                            className="w-[18px] h-[18px] object-contain"
                          />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Real room files */}
                  {isRealRoom && roomFiles.map(file => (
                    <div
                      key={file.id}
                      className="relative w-full max-w-[759px] h-[74px] bg-[#FCFBF6] border border-[#E9E8E3] rounded-[12px] px-[18px] flex items-center justify-between"
                    >
                      <div className="flex items-center min-w-0">
                        {renderFileTile(file.originalFilename)}
                        <div className="ml-[22px] min-w-0 flex flex-col justify-center">
                          <p className="text-[16px] font-bold text-[#111111] leading-tight truncate max-w-[280px]">
                            {file.originalFilename}
                          </p>
                          <p className="mt-[4px] text-[13px] font-medium text-[#666666] leading-none">
                            {formatBytes(file.sizeBytes)}
                          </p>
                        </div>
                      </div>

                      {/* Status column at x=387px */}
                      <div className="absolute left-[387px] w-[150px] flex items-center gap-[8px]">
                        <img
                          src="/icon-check-green.webp"
                          alt=""
                          className="w-[17px] h-[17px] object-contain flex-shrink-0"
                        />
                        <span className="text-[15px] font-semibold text-[#1E7A4C] leading-none">
                          Uploaded
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center ml-auto flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => onDownloadFile(file)}
                          className="w-[122px] h-[40px] bg-[#FED22E] border-[2px] border-[#111111] rounded-[10px] shadow-[3px_3px_0_#111111] flex items-center justify-center gap-[8px] cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#111111] transition-all select-none"
                        >
                          <img
                            src="/icon-download-yellow-btn.webp"
                            alt=""
                            className="w-[18px] h-[18px] object-contain flex-shrink-0"
                          />
                          <span className="font-heading font-bold text-[14px] text-[#111111] leading-none">
                            Download
                          </span>
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setActiveMenuFileId(prev => (prev === file.id ? null : file.id));
                            }}
                            className="w-[34px] h-[34px] ml-[10px] rounded-[8px] bg-transparent hover:bg-neutral-200/50 flex items-center justify-center cursor-pointer transition-colors"
                            aria-label="More"
                          >
                            <img
                              src="/icon-dots.webp"
                              alt="More"
                              className="w-[18px] h-[18px] object-contain"
                            />
                          </button>
                          {activeMenuFileId === file.id && (
                            <div
                              onClick={e => e.stopPropagation()}
                              className="absolute right-0 top-[40px] z-30 w-[140px] bg-white border-[2px] border-[#111111] rounded-[10px] shadow-[3px_3px_0_#111111] py-1 px-1 flex flex-col text-[13px] font-heading font-bold"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  onDownloadFile(file);
                                  setActiveMenuFileId(null);
                                }}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-[#FED228]/20 rounded-md cursor-pointer"
                              >
                                Download
                              </button>
                              {room?.isCreator && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeleteFile(file.id);
                                    setActiveMenuFileId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-rose-50 text-rose-600 rounded-md cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Initial Demo State matching mockup (4 rows) */}
                  {!isRealRoom && (
                    <>
                      {/* Row 1: Project Proposal.pdf */}
                      <div className="relative w-full max-w-[759px] h-[74px] bg-[#FCFBF6] border border-[#E9E8E3] rounded-[12px] px-[18px] flex items-center justify-between">
                        <div className="flex items-center min-w-0">
                          {renderFileTile('Project Proposal.pdf')}
                          <div className="ml-[22px] min-w-0 flex flex-col justify-center">
                            <p className="text-[16px] font-bold text-[#111111] leading-tight truncate max-w-[280px]">
                              Project Proposal.pdf
                            </p>
                            <p className="mt-[4px] text-[13px] font-medium text-[#666666] leading-none">
                              4.2 MB
                            </p>
                          </div>
                        </div>

                        {/* Status Column at x=387px */}
                        <div className="absolute left-[387px] w-[150px] flex items-center gap-[8px]">
                          <img
                            src="/icon-check-green.webp"
                            alt=""
                            className="w-[17px] h-[17px] object-contain flex-shrink-0"
                          />
                          <span className="text-[15px] font-semibold text-[#1E7A4C] leading-none">
                            Uploaded
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center ml-auto flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const blob = new Blob(['Sample Project Proposal content'], { type: 'application/pdf' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = 'Project Proposal.pdf';
                              link.click();
                            }}
                            className="w-[122px] h-[40px] bg-[#FED22E] border-[2px] border-[#111111] rounded-[10px] shadow-[3px_3px_0_#111111] flex items-center justify-center gap-[8px] cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#111111] transition-all select-none"
                          >
                            <img
                              src="/icon-download-yellow-btn.webp"
                              alt=""
                              className="w-[18px] h-[18px] object-contain flex-shrink-0"
                            />
                            <span className="font-heading font-bold text-[14px] text-[#111111] leading-none">
                              Download
                            </span>
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setActiveMenuFileId(prev => (prev === 'demo-1' ? null : 'demo-1'));
                              }}
                              className="w-[34px] h-[34px] ml-[10px] rounded-[8px] bg-transparent hover:bg-neutral-200/50 flex items-center justify-center cursor-pointer transition-colors"
                              aria-label="More"
                            >
                              <img
                                src="/icon-dots.webp"
                                alt="More"
                                className="w-[18px] h-[18px] object-contain"
                              />
                            </button>
                            {activeMenuFileId === 'demo-1' && (
                              <div
                                onClick={e => e.stopPropagation()}
                                className="absolute right-0 top-[40px] z-30 w-[140px] bg-white border-[2px] border-[#111111] rounded-[10px] shadow-[3px_3px_0_#111111] py-1 px-1 flex flex-col text-[13px] font-heading font-bold"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const blob = new Blob(['Sample Project Proposal content'], { type: 'application/pdf' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = 'Project Proposal.pdf';
                                    link.click();
                                    setActiveMenuFileId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-[#FED228]/20 rounded-md cursor-pointer"
                                >
                                  Download
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 2: photoshoot.jpg */}
                      <div className="relative w-full max-w-[759px] h-[74px] bg-[#FCFBF6] border border-[#E9E8E3] rounded-[12px] px-[18px] flex items-center justify-between">
                        <div className="flex items-center min-w-0">
                          {renderFileTile('photoshoot.jpg')}
                          <div className="ml-[22px] min-w-0 flex flex-col justify-center">
                            <p className="text-[16px] font-bold text-[#111111] leading-tight truncate max-w-[280px]">
                              photoshoot.jpg
                            </p>
                            <p className="mt-[4px] text-[13px] font-medium text-[#666666] leading-none">
                              6.8 MB
                            </p>
                          </div>
                        </div>

                        {/* Status Column at x=387px */}
                        <div className="absolute left-[387px] w-[150px] flex items-center gap-[8px]">
                          <img
                            src="/icon-check-green.webp"
                            alt=""
                            className="w-[17px] h-[17px] object-contain flex-shrink-0"
                          />
                          <span className="text-[15px] font-semibold text-[#1E7A4C] leading-none">
                            Uploaded
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center ml-auto flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const blob = new Blob(['Sample photoshoot image'], { type: 'image/jpeg' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = 'photoshoot.jpg';
                              link.click();
                            }}
                            className="w-[122px] h-[40px] bg-[#FED22E] border-[2px] border-[#111111] rounded-[10px] shadow-[3px_3px_0_#111111] flex items-center justify-center gap-[8px] cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#111111] transition-all select-none"
                          >
                            <img
                              src="/icon-download-yellow-btn.webp"
                              alt=""
                              className="w-[18px] h-[18px] object-contain flex-shrink-0"
                            />
                            <span className="font-heading font-bold text-[14px] text-[#111111] leading-none">
                              Download
                            </span>
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setActiveMenuFileId(prev => (prev === 'demo-2' ? null : 'demo-2'));
                              }}
                              className="w-[34px] h-[34px] ml-[10px] rounded-[8px] bg-transparent hover:bg-neutral-200/50 flex items-center justify-center cursor-pointer transition-colors"
                              aria-label="More"
                            >
                              <img
                                src="/icon-dots.webp"
                                alt="More"
                                className="w-[18px] h-[18px] object-contain"
                              />
                            </button>
                            {activeMenuFileId === 'demo-2' && (
                              <div
                                onClick={e => e.stopPropagation()}
                                className="absolute right-0 top-[40px] z-30 w-[140px] bg-white border-[2px] border-[#111111] rounded-[10px] shadow-[3px_3px_0_#111111] py-1 px-1 flex flex-col text-[13px] font-heading font-bold"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const blob = new Blob(['Sample photoshoot image'], { type: 'image/jpeg' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = 'photoshoot.jpg';
                                    link.click();
                                    setActiveMenuFileId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-[#FED228]/20 rounded-md cursor-pointer"
                                >
                                  Download
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 3: resources.zip (Uploading... 68%) */}
                      <div className="relative w-full max-w-[759px] h-[74px] bg-[#FCFBF6] border border-[#E9E8E3] rounded-[12px] px-[18px] flex items-center justify-between">
                        <div className="flex items-center min-w-0">
                          {renderFileTile('resources.zip')}
                          <div className="ml-[22px] min-w-0 flex flex-col justify-center">
                            <p className="text-[16px] font-bold text-[#111111] leading-tight truncate max-w-[280px]">
                              resources.zip
                            </p>
                            <p className="mt-[4px] text-[13px] font-medium text-[#666666] leading-none">
                              1.4 MB
                            </p>
                          </div>
                        </div>

                        {/* Status Column at x=387px: 10px high progress bar, full width of 150px column, track #EBEAE6, fill #0A78F5, fully rounded ends, with "Uploading... 68%" 14px weight 600 color #1F4E8C, 8px below it */}
                        <div className="absolute left-[387px] w-[150px] flex flex-col justify-center">
                          <div className="w-full h-[10px] bg-[#EBEAE6] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0A78F5] rounded-full"
                              style={{ width: '68%' }}
                            />
                          </div>
                          <span className="mt-[8px] text-[14px] font-semibold text-[#1F4E8C] leading-none">
                            Uploading... 68%
                          </span>
                        </div>

                        {/* Action buttons: background #ECEBE6, border 1px solid #D6D5D0, no shadow, disabled cursor, grey download icon + 8px gap + "Download" 14px weight 600 color #8E8D88 */}
                        <div className="flex items-center ml-auto flex-shrink-0">
                          <button
                            type="button"
                            disabled
                            className="w-[122px] h-[40px] bg-[#ECEBE6] border border-[#D6D5D0] rounded-[10px] flex items-center justify-center gap-[8px] cursor-not-allowed select-none"
                          >
                            <img
                              src="/icon-download-grey.webp"
                              alt=""
                              className="w-[18px] h-[18px] object-contain flex-shrink-0"
                            />
                            <span className="font-heading font-semibold text-[14px] text-[#8E8D88] leading-none">
                              Download
                            </span>
                          </button>

                          <button
                            type="button"
                            className="w-[34px] h-[34px] ml-[10px] rounded-[8px] bg-transparent hover:bg-neutral-200/50 flex items-center justify-center cursor-pointer transition-colors"
                            aria-label="More"
                          >
                            <img
                              src="/icon-dots.webp"
                              alt="More"
                              className="w-[18px] h-[18px] object-contain"
                            />
                          </button>
                        </div>
                      </div>

                      {/* Row 4: demo-video.mp4 (Waiting...) */}
                      <div className="relative w-full max-w-[759px] h-[74px] bg-[#FCFBF6] border border-[#E9E8E3] rounded-[12px] px-[18px] flex items-center justify-between">
                        <div className="flex items-center min-w-0">
                          {renderFileTile('demo-video.mp4')}
                          <div className="ml-[22px] min-w-0 flex flex-col justify-center">
                            <p className="text-[16px] font-bold text-[#111111] leading-tight truncate max-w-[280px]">
                              demo-video.mp4
                            </p>
                            <p className="mt-[4px] text-[13px] font-medium text-[#666666] leading-none">
                              28.7 MB
                            </p>
                          </div>
                        </div>

                        {/* Status Column at x=387px: track #EBEAE6, fill #B2B1AC, with "Waiting..." 14px weight 600 color #7A7974, 8px below it */}
                        <div className="absolute left-[387px] w-[150px] flex flex-col justify-center">
                          <div className="w-full h-[10px] bg-[#EBEAE6] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#B2B1AC] rounded-full"
                              style={{ width: '0%' }}
                            />
                          </div>
                          <span className="mt-[8px] text-[14px] font-semibold text-[#7A7974] leading-none">
                            Waiting...
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center ml-auto flex-shrink-0">
                          <button
                            type="button"
                            disabled
                            className="w-[122px] h-[40px] bg-[#ECEBE6] border border-[#D6D5D0] rounded-[10px] flex items-center justify-center gap-[8px] cursor-not-allowed select-none"
                          >
                            <img
                              src="/icon-download-grey.webp"
                              alt=""
                              className="w-[18px] h-[18px] object-contain flex-shrink-0"
                            />
                            <span className="font-heading font-semibold text-[14px] text-[#8E8D88] leading-none">
                              Download
                            </span>
                          </button>

                          <button
                            type="button"
                            className="w-[34px] h-[34px] ml-[10px] rounded-[8px] bg-transparent hover:bg-neutral-200/50 flex items-center justify-center cursor-pointer transition-colors"
                            aria-label="More"
                          >
                            <img
                              src="/icon-dots.webp"
                              alt="More"
                              className="w-[18px] h-[18px] object-contain"
                            />
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {isRealRoom && roomFiles.length === 0 && uploadQueue.length === 0 && (
                    <p className="text-[14px] text-neutral-500 text-center py-6">
                      No files in room yet. Click &quot;Add more files&quot; above to upload.
                    </p>
                  )}
                </div>
              </div>

              {/* 3. GOOD TO KNOW BANNER: mint banner at card bottom */}
              <div className="mt-[16px] w-full max-w-[759px] min-h-[66px] bg-[#E6F9F0] rounded-[12px] px-[18px] py-[12px] flex items-center justify-between border-none">
                <div className="flex items-center gap-[14px] min-w-0">
                  <img
                    src="/mascot-pizza.webp"
                    alt=""
                    className="w-[34px] h-[34px] object-contain flex-shrink-0"
                  />
                  <div>
                    <h4 className="font-heading font-extrabold text-[15px] text-[#111111] leading-tight">
                      Good to know
                    </h4>
                    <p className="text-[13.5px] font-medium text-[#444444] leading-normal">
                      Files stay available for 1 hour of inactivity or up to 6 hours total.
                    </p>
                  </div>
                </div>

                {/* End room button: white, 2.5px red border, red text with trash icon, hard shadow */}
                <button
                  type="button"
                  onClick={handleEndRoom}
                  disabled={isEnding}
                  className="flex-shrink-0 flex items-center gap-[8px] px-[16px] h-[38px] bg-white border-[2.5px] border-[#FD3F77] text-[#FD3F77] rounded-[10px] shadow-[3px_3px_0_#111111] font-heading font-extrabold text-[13.5px] cursor-pointer hover:bg-rose-50 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_#111111] leading-none"
                >
                  <img
                    src="/icon-trash.webp"
                    alt=""
                    className="w-[16px] h-[16px] object-contain"
                  />
                  <span>{isEnding ? 'Ending...' : 'End room'}</span>
                </button>
              </div>

            </div>

          </div>

        </div>
        </div>
      </div>
    </div>
  );
};
