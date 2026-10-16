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
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(room?.expiresInSeconds || 3600);
  const [isEnding, setIsEnding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

  // Proportional layout scaling for desktop (two-column row layout)
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

  useEffect(() => {
    const updateLayout = () => {
      if (typeof window === 'undefined') return;
      const vw = window.innerWidth;
      const desktop = vw >= 1024;
      setIsDesktop(desktop);

      if (desktop && vw < 1447) {
        const available = Math.max(992, vw - 32);
        setScale(Math.min(1, available / 1415));
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
  const codeDigits = activeCode.padEnd(6, '0').slice(0, 6).split('');
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

  const handleCopyCode = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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

      {/* MAIN LAYOUT (Two-column on Desktop >=1024px, Single-column on Mobile/Tablet <1024px) */}
      <div className="relative z-10 w-full max-w-[1487px] mx-auto px-4 sm:px-6 pt-2 pb-24">
        <div className="w-full flex justify-center">
          <div
            ref={contentRef}
            style={
              isDesktop && scale < 1
                ? {
                    width: '1415px',
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    flexShrink: 0,
                  }
                : undefined
            }
            className="w-full grid grid-cols-1 lg:grid-cols-[572px_815px] lg:justify-center gap-6 lg:gap-[28px] max-w-[640px] md:max-w-[768px] lg:max-w-none mx-auto"
          >
            
            {/* ================= 1. CREATE A SHARING ROOM ================= */}
            <div className="relative w-full lg:w-[572px] flex-shrink-0 lg:row-span-2">
              {/* Purple background shape peeking behind card at bottom-left */}
              <div
                className="absolute -left-[20px] bottom-0 w-[240px] h-[160px] rounded-[60px] bg-[#8562FC] pointer-events-none select-none -z-10"
                aria-hidden="true"
              />

              {/* CARD: #FCF9F2, 3px solid #111, radius 22px, shadow 5px 5px 0 #111 */}
              <div className="w-full lg:w-[572px] bg-[#FCF9F2] border-[3px] border-[#111111] rounded-[22px] shadow-[5px_5px_0_#111111] px-4 sm:px-[32px] py-[24px] flex flex-col relative z-0">
                
                {/* 1. BACK ROW */}
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="flex items-center gap-[12px] text-[16px] sm:text-[17px] font-semibold text-[#111111] hover:opacity-75 transition-opacity cursor-pointer w-fit leading-none"
                  aria-label="Back to home"
                >
                  <img
                    src="/icon-arrow-left.webp"
                    alt=""
                    className="w-[18px] h-[18px] object-contain flex-shrink-0"
                  />
                  <span>Create a sharing room</span>
                </button>

                {/* 2. HEADLINE */}
                <div className="mt-[32px] sm:mt-[42px]">
                  <h1 className="font-['Plus_Jakarta_Sans',sans-serif] font-extrabold text-[32px] sm:text-[42px] lg:text-[52px] leading-[36px] sm:leading-[44px] lg:leading-[48px] tracking-[-0.02em] text-[#111111]">
                    <span className="inline-flex items-center flex-wrap">
                      <span>Add your files</span>
                      <img
                        src="/sparkle-pink-title.webp"
                        alt=""
                        className="w-[36px] h-[36px] sm:w-[48px] sm:h-[48px] object-contain ml-[10px] sm:ml-[12px] -translate-y-[4px] sm:-translate-y-[6px] pointer-events-none select-none flex-shrink-0"
                      />
                    </span>
                    <br />
                    <span>and create a room.</span>
                  </h1>
                </div>

                {/* 3. SUBTITLE */}
                <p className="mt-[12px] text-[15px] sm:text-[17px] font-medium text-[#5E6470] leading-snug">
                  Upload files, get a 6-digit code and share it anywhere.
                </p>

                {/* 4. DROPZONE (Full-width on mobile, pizza illustration centered) */}
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
                  className={`mt-[24px] sm:mt-[28px] w-full lg:max-w-[508px] min-h-[220px] sm:h-[246px] border-[2px] border-dashed border-[#C9C9C9] rounded-[14px] bg-transparent flex flex-col items-center justify-center cursor-pointer transition-colors p-4 relative ${
                    isDragging ? 'bg-[#FED228]/10 border-[#111111]' : 'hover:border-neutral-400'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center text-center">
                    <img
                      src="/dropzone-pizza-sparkles.webp"
                      alt="Drop files"
                      className="w-[120px] sm:w-[148px] object-contain pointer-events-none select-none"
                    />
                    <p className="mt-[16px] sm:mt-[20px] text-[18px] sm:text-[19px] font-bold text-[#111111] leading-none">
                      Drag &amp; drop files here
                    </p>
                    <p className="mt-[6px] text-[14px] sm:text-[15px] font-semibold text-[#111111] leading-none">
                      or <span className="cursor-pointer underline sm:no-underline">click to browse</span>
                    </p>
                    <div className="mt-[12px] min-h-[25px] py-1 px-[12px] sm:px-[14px] bg-[#EAEBED] rounded-full flex items-center justify-center text-[11px] sm:text-[12.5px] font-medium text-[#555555] leading-tight text-center select-none">
                      Max file size: 100 MB <span className="mx-[8px]">•</span> Multiple files allowed
                    </div>
                  </div>
                </div>

                {/* 5. SELECTED FILES BOX (Full-width on mobile, filenames protected from overflow) */}
                <div className="mt-[20px] w-full lg:max-w-[508px] bg-[#FCFBF6] border border-[#E0DED8] rounded-[10px] p-[14px] sm:p-[16px] flex flex-col">
                  <div className="flex items-center justify-between mb-[14px]">
                    <span className="text-[15px] sm:text-[16px] font-bold text-[#111111] leading-none">
                      Selected files ({stagedFiles.length})
                    </span>
                    <span className="text-[12px] sm:text-[13px] font-medium text-[#666666] leading-none">
                      Total: {formatBytes(totalStagedBytes)}
                    </span>
                  </div>

                  {stagedFiles.length === 0 ? (
                    <p className="text-[13px] font-medium text-[#888888] text-center py-4">
                      No files selected yet. Drop files above.
                    </p>
                  ) : (
                    <div className="space-y-[8px]">
                      {stagedFiles.map(s => (
                        <div
                          key={s.id}
                          className="w-full min-h-[66px] bg-[#FBFAF5] border border-[#D9D5CC] rounded-[8px] flex items-center justify-between pl-[10px] pr-[12px] sm:pr-[16px] py-2 gap-2 relative"
                        >
                          <div className="flex items-center min-w-0 flex-1">
                            {renderFileTile(s.name)}
                            <div className="ml-[10px] sm:ml-[11px] min-w-0 flex-1 flex flex-col justify-center">
                              <p className="text-[15px] sm:text-[16px] font-bold text-[#111111] leading-tight truncate">
                                {s.name}
                              </p>
                              <p className="text-[12px] sm:text-[13px] font-medium text-[#666666] leading-none mt-[4px]">
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
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. CREATE ROOM BUTTON (Full-width on mobile) */}
                <div className="mt-[24px] sm:mt-[28px] relative flex items-center justify-center w-full">
                  <img
                    src="/sparkle-lines-btn-left.webp"
                    alt=""
                    className="hidden sm:block absolute left-[2px] top-[4px] w-[24px] h-[24px] object-contain pointer-events-none select-none z-10"
                  />

                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    disabled={stagedFiles.length === 0}
                    className={`w-full lg:w-[435px] max-w-full h-[58px] sm:h-[62px] rounded-[12px] border-[3px] border-[#111111] flex items-center justify-center gap-[12px] font-['Plus_Jakarta_Sans','Poppins',sans-serif] font-extrabold text-[20px] sm:text-[22px] text-[#111111] select-none transition-all ${
                      stagedFiles.length === 0
                        ? 'bg-[#EDEBE6] shadow-none cursor-not-allowed text-[#888888] opacity-80'
                        : 'bg-[#FED22E] shadow-[5px_6px_0_#111111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_4px_0_#111111] cursor-pointer'
                    }`}
                  >
                    <img
                      src="/mascot-pizza.webp"
                      alt=""
                      className="w-[32px] h-[32px] sm:w-[36px] sm:h-[36px] object-contain flex-shrink-0"
                    />
                    <span>Create Room</span>
                  </button>

                  <img
                    src="/sparkle-lines-btn-right.webp"
                    alt=""
                    className="hidden sm:block absolute right-[0px] bottom-[4px] w-[24px] h-[24px] object-contain pointer-events-none select-none z-10"
                  />
                </div>

              </div>
            </div>


            {/* ================= 2. YOUR ROOM IS READY ================= */}
            <div className="w-full lg:w-[815px] lg:col-start-2 lg:row-start-1 min-h-[340px] lg:min-h-[377px] bg-[#FDEFBB] border-[3px] border-[#111111] rounded-[22px] shadow-[5px_5px_0_#111111] p-4 sm:p-5 lg:pt-[16px] lg:pb-[16px] lg:px-[28px] flex flex-col justify-between">
              
              {/* DESKTOP TOP SECTION (>= 1024px): 3 Columns */}
              <div className="hidden lg:flex flex-row items-start">
                
                {/* Column 1: Heading row + Code box & Copy button */}
                <div className="flex flex-col w-[313px] flex-shrink-0">
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

                  <div className="mt-[8px]">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5E6470] block">
                      ROOM CODE (ENTER ON RECEIVER)
                    </span>
                    <div className="mt-[5px] flex items-center gap-1.5">
                      {codeDigits.map((digit, idx) => (
                        <div
                          key={idx}
                          className="w-[38px] h-[64px] bg-white border-[3px] border-[#111111] rounded-[11px] shadow-[3px_3px_0_#111111] flex items-center justify-center font-heading font-extrabold text-[28px] text-[#111111] select-all"
                        >
                          {digit}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="w-[46px] h-[64px] bg-[#FED228] hover:bg-[#FED228]/90 border-[3px] border-[#111111] rounded-[11px] shadow-[3px_3px_0_#111111] flex items-center justify-center cursor-pointer transition-colors shrink-0 ml-1"
                        title="Copy 6-digit room code"
                        aria-label="Copy 6-digit room code"
                      >
                        {copiedCode ? (
                          <img src="/icon-check-green.webp" alt="Copied" className="w-5 h-5 object-contain" />
                        ) : (
                          <img src="/icon-copy-dark.webp" alt="Copy" className="w-5 h-5 object-contain" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Column 2: QR box */}
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

                  <img
                    src="/sparkle-pink-qr-room.webp"
                    alt=""
                    className="absolute top-0 w-[28px] h-[28px] object-contain pointer-events-none select-none block"
                    style={{ left: 'calc(100% + 25px)' }}
                  />
                </div>

                {/* Column 3: Scan text */}
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

              {/* MOBILE / TABLET CONTENT (< 1024px):
                  Arranged in exact order:
                  1. Section heading
                  2. Six-digit room code and copy button together
                  3. QR code with its existing scan instructions
              */}
              <div className="flex lg:hidden flex-col gap-4">
                {/* 1. Section heading */}
                <div className="flex items-center gap-[12px] sm:gap-[14px]">
                  <img
                    src="/mascot-pizza.webp"
                    alt=""
                    className="w-[42px] h-[42px] sm:w-[50px] sm:h-[50px] object-contain flex-shrink-0"
                  />
                  <h3 className="font-heading font-extrabold text-[20px] sm:text-[22px] text-[#111111] leading-none">
                    Your room is ready!
                  </h3>
                </div>

                {/* 2. Six-digit room code and copy button together */}
                <div className="w-full">
                  <span className="text-[11px] sm:text-[12px] font-extrabold uppercase tracking-wider text-[#5E6470] mb-1.5 block">
                    ROOM CODE (ENTER ON RECEIVER)
                  </span>
                  <div className="flex items-center gap-1 sm:gap-2 w-full max-w-[360px]">
                    {codeDigits.map((digit, idx) => (
                      <div
                        key={idx}
                        className="flex-1 min-w-0 h-[52px] sm:h-[60px] bg-white border-[2.5px] sm:border-[3px] border-[#111111] rounded-[9px] sm:rounded-[11px] shadow-[2.5px_2.5px_0_#111111] sm:shadow-[3px_3px_0_#111111] flex items-center justify-center font-heading font-extrabold text-[22px] sm:text-[26px] text-[#111111] select-all"
                      >
                        {digit}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="w-[44px] sm:w-[52px] h-[52px] sm:h-[60px] bg-[#FED228] hover:bg-[#FED228]/90 border-[2.5px] sm:border-[3px] border-[#111111] rounded-[9px] sm:rounded-[11px] shadow-[2.5px_2.5px_0_#111111] sm:shadow-[3px_3px_0_#111111] flex items-center justify-center cursor-pointer transition-colors shrink-0 ml-1"
                      title="Copy 6-digit room code"
                      aria-label="Copy 6-digit room code"
                    >
                      {copiedCode ? (
                        <img src="/icon-check-green.webp" alt="Copied" className="w-5 h-5 object-contain" />
                      ) : (
                        <img src="/icon-copy-dark.webp" alt="Copy" className="w-5 h-5 object-contain" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 3. QR code with its existing scan instructions */}
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3.5 sm:gap-6 mt-1">
                  <div className="relative w-[150px] h-[150px] sm:w-[165px] sm:h-[165px] bg-white border-[3px] border-[#111111] rounded-[18px] shadow-[4px_4px_0_#111111] flex items-center justify-center shrink-0">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="QR Code"
                        className="w-[120px] h-[120px] sm:w-[130px] sm:h-[130px] object-contain"
                      />
                    ) : (
                      <div className="w-[120px] h-[120px] bg-neutral-100 rounded-lg flex items-center justify-center font-heading font-bold text-xs text-neutral-400">
                        QR Code
                      </div>
                    )}
                    <img
                      src="/sparkle-pink-qr-room.webp"
                      alt=""
                      className="absolute -top-2.5 -right-2.5 w-[24px] h-[24px] object-contain pointer-events-none select-none block"
                    />
                  </div>

                  <div className="flex flex-col justify-center text-center sm:text-left">
                    <p className="font-heading font-extrabold text-[16px] sm:text-[17px] text-[#111111] leading-tight">
                      Scan the QR code
                    </p>
                    <p className="mt-[6px] text-[13.5px] sm:text-[15px] font-medium text-[#4F6275] leading-[20px] sm:leading-[22px]">
                      Open on any device<br className="hidden sm:inline" /> to join the room.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Shareable link with copy button */}
              <div className="mt-[16px] sm:mt-[20px] w-full max-w-[751px] min-h-[52px] sm:h-[58px] bg-white border-[3px] border-[#111111] rounded-[12px] shadow-[4px_4px_0_#111111] flex items-center overflow-hidden">
                <div className="w-[44px] sm:w-[72px] min-w-[44px] sm:min-w-[72px] h-full flex items-center justify-center flex-shrink-0">
                  <img src="/icon-link.webp" alt="" className="w-[20px] h-[20px] sm:w-[28px] sm:h-[28px] object-contain" />
                </div>

                <div className="w-[1.5px] h-full bg-[#C8C8C8] flex-shrink-0" />

                <div className="flex-1 min-w-0 h-full flex items-center px-3 sm:pl-[16px] sm:pr-[12px]">
                  <span className="font-sans text-[13px] sm:text-[16px] font-medium text-[#111111] truncate select-all">
                    {effectiveShareUrl}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-[84px] sm:w-[122px] min-w-[84px] sm:min-w-[122px] h-full flex items-center justify-center gap-[6px] sm:gap-[8px] bg-white hover:bg-[#F5F5F5] transition-colors border-l-[2px] border-[#111111] flex-shrink-0 cursor-pointer"
                  title="Copy link"
                >
                  <img src="/icon-copy-dark.webp" alt="" className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] object-contain flex-shrink-0" />
                  <span className="font-heading font-bold text-[13px] sm:text-[15px] text-[#111111]">
                    {copiedLink ? 'Copied' : 'Copy'}
                  </span>
                </button>
              </div>

              {/* 5. Existing informational banner */}
              <div className="mt-[14px] sm:mt-[20px] w-full max-w-[760px] lg:-mx-[4px] min-h-[64px] bg-[#FFF9DD] rounded-[12px] px-[14px] sm:px-[16px] py-[10px] sm:py-[12px] flex items-center border-none">
                <img
                  src="/mascot-pizza.webp"
                  alt=""
                  className="w-[32px] h-[32px] sm:w-[36px] sm:h-[36px] object-contain flex-shrink-0 self-start sm:self-center mt-0.5 sm:mt-0"
                />
                <p className="ml-[12px] sm:ml-[16px] text-[13px] sm:text-[15.5px] font-medium leading-[20px] sm:leading-[24px] text-[#1F2D3A]">
                  Share this code or link with anyone. They can upload and download files<br className="hidden sm:inline" />
                  from any device, even on different networks.
                </p>
              </div>

            </div>


            {/* ================= 3. FILES IN THIS ROOM ================= */}
            <div className="w-full lg:w-[815px] lg:col-start-2 lg:row-start-2 min-h-[460px] lg:min-h-[501px] bg-[#FDFAF5] border-[3px] border-[#111111] rounded-[22px] shadow-[5px_5px_0_#111111] p-4 sm:p-5 lg:p-[24px] flex flex-col justify-between">
              
              <div className="flex flex-col">
                {/* 1. TITLE ROW: Heading and Add more files button aligned without overlap */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="font-heading font-extrabold text-[20px] sm:text-[24px] text-[#111111] leading-none">
                    Files in this room
                  </h3>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-[159px] h-[39px] bg-white border-[2px] border-[#111111] rounded-[10px] shadow-[3px_3px_0_#111111] flex items-center justify-center gap-[10px] cursor-pointer hover:bg-neutral-50 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_#111111]"
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

                {/* 2. FILE ROWS: Stack or reflow cleanly */}
                <div className="mt-[12px] sm:mt-[10px] flex flex-col gap-[8px] sm:gap-[6px]">
                  {/* Real uploading queue items */}
                  {uploadQueue.map((item, idx) => (
                    <div
                      key={`uq-${idx}`}
                      className="relative w-full max-w-[759px] min-h-[74px] bg-[#FCFBF6] border border-[#E9E8E3] rounded-[12px] p-3 sm:px-[18px] sm:py-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4"
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        {renderFileTile(item.name)}
                        <div className="ml-3 sm:ml-[22px] min-w-0 flex-1 flex flex-col justify-center">
                          <p className="text-[15px] sm:text-[16px] font-bold text-[#111111] leading-tight truncate sm:max-w-[240px] md:max-w-[280px]">
                            {item.name}
                          </p>
                          <p className="mt-[4px] text-[12px] sm:text-[13px] font-medium text-[#666666] leading-none">
                            {formatBytes(item.size)}
                          </p>
                        </div>
                      </div>

                      {/* Status Column */}
                      <div className="w-full sm:w-[150px] lg:absolute lg:left-[387px] flex flex-col justify-center">
                        <div className="w-full h-[8px] sm:h-[10px] bg-[#EBEAE6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0A78F5] rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="mt-[6px] sm:mt-[8px] text-[12px] sm:text-[14px] font-semibold text-[#1F4E8C] leading-none">
                          Uploading... {item.progress}%
                        </span>
                      </div>

                      {/* Action buttons (right aligned) */}
                      <div className="flex items-center justify-end sm:ml-auto flex-shrink-0">
                        <button
                          type="button"
                          disabled
                          className="w-[105px] sm:w-[122px] h-[36px] sm:h-[40px] bg-[#ECEBE6] border border-[#D6D5D0] rounded-[10px] flex items-center justify-center gap-[8px] cursor-not-allowed select-none"
                        >
                          <img
                            src="/icon-download-grey.webp"
                            alt=""
                            className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] object-contain flex-shrink-0"
                          />
                          <span className="font-heading font-semibold text-[13px] sm:text-[14px] text-[#8E8D88] leading-none">
                            Download
                          </span>
                        </button>
                        <button
                          type="button"
                          className="w-[34px] h-[34px] ml-[8px] sm:ml-[10px] rounded-[8px] bg-transparent hover:bg-neutral-200/50 flex items-center justify-center cursor-pointer transition-colors"
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
                      className="relative w-full max-w-[759px] min-h-[74px] bg-[#FCFBF6] border border-[#E9E8E3] rounded-[12px] p-3 sm:px-[18px] sm:py-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4"
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        {renderFileTile(file.originalFilename)}
                        <div className="ml-3 sm:ml-[22px] min-w-0 flex-1 flex flex-col justify-center">
                          <p className="text-[15px] sm:text-[16px] font-bold text-[#111111] leading-tight truncate sm:max-w-[240px] md:max-w-[280px]">
                            {file.originalFilename}
                          </p>
                          <p className="mt-[4px] text-[12px] sm:text-[13px] font-medium text-[#666666] leading-none">
                            {formatBytes(file.sizeBytes)}
                          </p>
                        </div>
                      </div>

                      {/* Status column */}
                      <div className="flex items-center gap-[6px] sm:gap-[8px] lg:absolute lg:left-[387px] lg:w-[150px]">
                        <img
                          src="/icon-check-green.webp"
                          alt=""
                          className="w-[15px] h-[15px] sm:w-[17px] sm:h-[17px] object-contain flex-shrink-0"
                        />
                        <span className="text-[13px] sm:text-[15px] font-semibold text-[#1E7A4C] leading-none">
                          Uploaded
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end sm:ml-auto flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => onDownloadFile(file)}
                          className="w-[105px] sm:w-[122px] h-[36px] sm:h-[40px] bg-[#FED22E] border-[2px] border-[#111111] rounded-[10px] shadow-[3px_3px_0_#111111] flex items-center justify-center gap-[8px] cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#111111] transition-all select-none"
                        >
                          <img
                            src="/icon-download-yellow-btn.webp"
                            alt=""
                            className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] object-contain flex-shrink-0"
                          />
                          <span className="font-heading font-bold text-[13px] sm:text-[14px] text-[#111111] leading-none">
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
                            className="w-[34px] h-[34px] ml-[8px] sm:ml-[10px] rounded-[8px] bg-transparent hover:bg-neutral-200/50 flex items-center justify-center cursor-pointer transition-colors"
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

                  {roomFiles.length === 0 && uploadQueue.length === 0 && (
                    <div className="py-10 text-center text-[#71717A]">
                      <p className="font-heading font-bold text-[16px] text-[#111111]">No files in this room yet.</p>
                      <p className="font-sans text-[14px] text-[#71717A] mt-1">
                        Click "+ Add more files" above or drop files to upload.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. GOOD TO KNOW BANNER: mint banner at card bottom */}
              <div className="mt-[16px] w-full max-w-[759px] min-h-[66px] bg-[#E6F9F0] rounded-[12px] px-[14px] sm:px-[18px] py-[12px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-none">
                <div className="flex items-center gap-[12px] sm:gap-[14px] min-w-0">
                  <img
                    src="/mascot-pizza.webp"
                    alt=""
                    className="w-[30px] h-[30px] sm:w-[34px] sm:h-[34px] object-contain flex-shrink-0"
                  />
                  <div>
                    <h4 className="font-heading font-extrabold text-[14px] sm:text-[15px] text-[#111111] leading-tight">
                      Good to know
                    </h4>
                    <p className="text-[12.5px] sm:text-[13.5px] font-medium text-[#444444] leading-normal">
                      Files stay available for 1 hour of inactivity or up to 6 hours total.
                    </p>
                  </div>
                </div>

                {/* End room button */}
                <button
                  type="button"
                  onClick={handleEndRoom}
                  disabled={isEnding}
                  className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-[8px] px-[16px] h-[38px] bg-white border-[2.5px] border-[#FD3F77] text-[#FD3F77] rounded-[10px] shadow-[3px_3px_0_#111111] font-heading font-extrabold text-[13.5px] cursor-pointer hover:bg-rose-50 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_#111111] leading-none"
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
  );
};
