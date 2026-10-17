import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { FileItem } from './FileList.tsx';
import { StatusChip } from './StatusChip.tsx';
import { FileTypeIcon } from './FileTypeIcon.tsx';

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
  rejected?: boolean;
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

const getFileTileConfig = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') {
    return { bg: '#F73F75', type: 'pdf', icon: '/icon-pdf-room.webp', label: 'PDF' };
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif', 'svg', 'bmp'].includes(ext)) {
    return { bg: '#7152EB', type: 'image', icon: '/icon-image-purple.webp', label: 'IMG' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { bg: '#51A953', type: 'zip', icon: '/icon-zip-green.webp', label: 'ZIP' };
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return { bg: '#FC8828', type: 'video', icon: '/icon-video-orange.webp', label: 'VID' };
  }
  return { bg: '#6B7280', type: 'other', label: ext.toUpperCase().slice(0, 4) || 'FILE' };
};

const INITIAL_DEMO_STAGED: StagedFile[] = [];

export const RoomView: React.FC<RoomViewProps> = ({
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
  onCreateNewRoom,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>(INITIAL_DEMO_STAGED);
  const [isBtnHovered, setIsBtnHovered] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(room?.expiresInSeconds || 3600);
  const [isEnding, setIsEnding] = useState(false);
  const [showConfirmEndModal, setShowConfirmEndModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

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

  const handleFilesPicked = (incoming: FileList | File[] | null) => {
    if (!incoming || incoming.length === 0) return;
    const maxBytes = maxFileSizeMb * 1024 * 1024;

    if (isRealRoom) {
      onFileUpload(incoming);
      return;
    }

    const filesArray = Array.from(incoming);
    const newItems: StagedFile[] = filesArray.map(file => {
      const isOversized = file.size > maxBytes;
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        rejected: isOversized,
      };
    });

    setStagedFiles(prev => [...prev, ...newItems]);
  };

  const handleRemoveStagedFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleCreateRoom = async () => {
    const validFiles = stagedFiles
      .filter(s => !s.rejected)
      .map(s => {
        if (s.file) return s.file;
        return new File([new Blob(['Sample file content for demo transfer'])], s.name, {
          type: s.name.endsWith('.pdf')
            ? 'application/pdf'
            : s.name.endsWith('.jpg')
            ? 'image/jpeg'
            : 'application/zip',
        });
      });

    if (validFiles.length === 0) return;

    try {
      if (isRealRoom && onFileUpload) {
        await onFileUpload(validFiles);
      } else {
        await onCreateNewRoom(validFiles);
      }
      setStagedFiles([]);
    } catch (err) {
      console.error('Error creating room from staged files:', err);
    }
  };

  const handleEndRoom = async () => {
    if (!isRealRoom || !room) {
      onLeaveRoom();
      return;
    }
    setShowConfirmEndModal(true);
  };

  const confirmEndRoom = async () => {
    if (!room) return;
    try {
      setIsEnding(true);
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(creatorToken ? { 'x-creator-token': creatorToken } : {}),
        },
      });

      if (!res.ok) {
        throw new Error('Failed to end room');
      }

      setShowConfirmEndModal(false);
      onRoomEnded();
    } catch (err) {
      console.error('Failed to end room:', err);
      setShowConfirmEndModal(false);
      onRoomEnded();
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
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalStagedBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);
  const roomFiles: FileItem[] = room ? room.files : [];

  // If room was ended or expired
  if (isRealRoom && room && (room.status !== 'active' || remainingSeconds === 0)) {
    return (
      <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
        {/* Background shapes */}
        <div
          style={{
            position: 'fixed',
            top: '-16vw',
            left: '-14vw',
            width: '40vw',
            height: '40vw',
            borderRadius: '9999px',
            backgroundColor: '#FD3F77',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
          }}
          aria-hidden="true"
        />
        <div
          style={{
            position: 'fixed',
            bottom: '-10vw',
            left: '-8vw',
            width: '28vw',
            height: '28vw',
            borderRadius: '9999px',
            backgroundColor: '#8562FC',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
          }}
          aria-hidden="true"
        />
        <div
          style={{
            position: 'fixed',
            bottom: '-8vw',
            right: '-8vw',
            width: '24vw',
            height: '24vw',
            borderRadius: '9999px',
            backgroundColor: '#FED228',
            border: 'calc(3 * var(--u)) solid #111111',
            boxShadow: 'calc(4 * var(--u)) calc(4 * var(--u)) 0 #111111',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
          }}
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
    <div className="relative min-h-[calc(100vh-90px)] bg-[#FDF7ED] overflow-x-hidden">
      {/* ================= BACKGROUND DECORATIONS (z-0, never overlapping card content) ================= */}
      {/* Large pink circle (~40% viewport width) bleeding off top-left corner */}
      <div
        style={{
          position: 'fixed',
          top: '-16vw',
          left: '-14vw',
          width: '40vw',
          height: '40vw',
          borderRadius: '9999px',
          backgroundColor: '#FD3F77',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Purple circle bleeding off bottom-left corner */}
      <div
        style={{
          position: 'fixed',
          bottom: '-10vw',
          left: '-8vw',
          width: '28vw',
          height: '28vw',
          borderRadius: '9999px',
          backgroundColor: '#8562FC',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Yellow circle bleeding off bottom-right corner */}
      <div
        style={{
          position: 'fixed',
          bottom: '-8vw',
          right: '-8vw',
          width: '24vw',
          height: '24vw',
          borderRadius: '9999px',
          backgroundColor: '#FED228',
          border: 'calc(3 * var(--u)) solid #111111',
          boxShadow: 'calc(4 * var(--u)) calc(4 * var(--u)) 0 #111111',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
        }}
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

      {/* ================= MAIN TWO-COLUMN GRID LAYOUT ================= */}
      <div
        style={{
          width: '100%',
          maxWidth: 'calc(864 * var(--u))',
          paddingLeft: 'calc(15 * var(--u))',
          paddingRight: 'calc(15 * var(--u))',
          marginTop: 'calc(11 * var(--u))',
          paddingBottom: 'calc(40 * var(--u))',
        }}
        className="mx-auto relative z-10"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '338fr 480fr',
            gap: 'calc(17 * var(--u))',
            width: '100%',
            alignItems: 'stretch',
          }}
        >
          {/* ================= LEFT COLUMN: CREATE A SHARING ROOM CARD ================= */}
          <div
            style={
              {
                '--lu': 'clamp(0.5px, calc(100vw / 1487), 1px)',
                width: '100%',
                maxWidth: 'calc(572 * var(--lu))',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              } as React.CSSProperties
            }
          >
            {/* 7. BACKGROUND: Purple (#8562FC) shape peeking behind card at bottom-left corner */}
            <div
              style={{
                position: 'absolute',
                left: 'calc(-20 * var(--lu))',
                bottom: 0,
                width: 'calc(240 * var(--lu))',
                height: 'calc(160 * var(--lu))',
                borderRadius: 'calc(60 * var(--lu))',
                backgroundColor: '#8562FC',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 0,
              }}
              aria-hidden="true"
            />

            {/* CARD: Width 572px, bg #FCF9F2, border 3px solid #111, radius 22px, hard shadow 5px 5px 0 #111 (no blur). Inner padding: 32px left and right, 24px top and bottom */}
            <div
              style={{
                width: '100%',
                maxWidth: 'calc(572 * var(--lu))',
                backgroundColor: '#FCF9F2',
                border: 'calc(3 * var(--lu)) solid #111111',
                borderRadius: 'calc(22 * var(--lu))',
                boxShadow: 'calc(5 * var(--lu)) calc(5 * var(--lu)) 0 #111111',
                padding: 'calc(24 * var(--lu)) calc(32 * var(--lu))',
                position: 'relative',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1,
              }}
            >
              {/* 1. BACK ROW: center at y=38 from card top, gap: 12px */}
              <button
                type="button"
                onClick={onLeaveRoom}
                style={{
                  fontSize: 'calc(17 * var(--lu))',
                  fontWeight: 600,
                  color: '#111111',
                  gap: 'calc(12 * var(--lu))',
                  height: 'calc(28 * var(--lu))',
                  padding: 0,
                  background: 'none',
                  border: 'none',
                }}
                className="flex items-center hover:opacity-75 transition-opacity cursor-pointer w-fit leading-none whitespace-nowrap select-none"
                aria-label="Back to home"
              >
                <img
                  src="/icon-arrow-left.webp"
                  alt=""
                  style={{ width: 'calc(18 * var(--lu))', height: 'calc(18 * var(--lu))' }}
                  className="object-contain shrink-0"
                />
                <span>Create a sharing room</span>
              </button>

              {/* 2. HEADLINE: top ~42px below back row, line pitch 48px (font-size ~52px, line-height ~0.92), weight 800, color #111, letter-spacing -0.02em */}
              <div
                style={{
                  marginTop: 'calc(42 * var(--lu))',
                  fontFamily: "'Plus Jakarta Sans', 'Outfit', 'Poppins', sans-serif",
                  position: 'relative',
                }}
              >
                {/* Line 1: "Add your files" + Pink sparkle (~48px wide, placed after "files" at x=370 from card's left edge, 6px higher than text top) */}
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'calc(52 * var(--lu))',
                      lineHeight: 0.92,
                      fontWeight: 800,
                      color: '#111111',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Add your files
                  </span>
                  <img
                    src="/sparkle-pink-title.webp"
                    alt=""
                    style={{
                      position: 'absolute',
                      left: 'calc(338 * var(--lu))',
                      top: 'calc(-6 * var(--lu))',
                      width: 'calc(48 * var(--lu))',
                      height: 'calc(48 * var(--lu))',
                    }}
                    className="object-contain pointer-events-none select-none shrink-0"
                  />
                </div>
                {/* Line 2: "and create a room." */}
                <div
                  style={{
                    fontSize: 'calc(52 * var(--lu))',
                    lineHeight: 0.92,
                    fontWeight: 800,
                    color: '#111111',
                    letterSpacing: '-0.02em',
                    marginTop: 'calc(4 * var(--lu))',
                    width: 'fit-content',
                    maxWidth: 'calc(460 * var(--lu))',
                  }}
                  className="whitespace-nowrap"
                >
                  and create a room.
                </div>
              </div>

              {/* 3. SUBTITLE: 12px below headline, 17px, weight 500, slate gray #5E6470, one line (about 455px wide) */}
              <p
                style={{
                  fontSize: 'calc(17 * var(--lu))',
                  fontWeight: 500,
                  color: '#5E6470',
                  marginTop: 'calc(12 * var(--lu))',
                  maxWidth: 'calc(455 * var(--lu))',
                }}
                className="whitespace-nowrap leading-tight"
              >
                Upload files, get a 6-digit code and share it anywhere.
              </p>

              {/* 4. DROPZONE (gap above: 28px): 508px wide x 246px high, 2px DASHED border #C9C9C9, radius 14px, no fill */}
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
                style={{
                  width: '100%',
                  maxWidth: 'calc(508 * var(--lu))',
                  height: 'calc(246 * var(--lu))',
                  borderRadius: 'calc(14 * var(--lu))',
                  borderWidth: 'calc(2 * var(--lu))',
                  borderColor: isDragging ? '#111111' : '#C9C9C9',
                  borderStyle: 'dashed',
                  marginTop: 'calc(28 * var(--lu))',
                  backgroundColor: isDragging ? 'rgba(254, 210, 40, 0.08)' : 'transparent',
                  paddingTop: 'calc(24 * var(--lu))',
                  boxSizing: 'border-box',
                }}
                className="flex flex-col items-center cursor-pointer transition-colors select-none"
              >
                {/* Pizza illustration with sparkles ~148px wide */}
                <img
                  src="/dropzone-pizza-sparkles.webp"
                  alt="Drop files"
                  style={{ width: 'calc(148 * var(--lu))', height: 'auto' }}
                  className="object-contain pointer-events-none select-none"
                />

                {/* "Drag & drop files here" 19px, weight 700, black, ~22px below illustration */}
                <p
                  style={{
                    fontSize: 'calc(19 * var(--lu))',
                    fontWeight: 700,
                    color: '#111111',
                    marginTop: 'calc(22 * var(--lu))',
                  }}
                  className="font-heading leading-none whitespace-nowrap"
                >
                  Drag &amp; drop files here
                </p>

                {/* "or click to browse" 15px, weight 600, black, no underline, 6px below */}
                <p
                  style={{
                    fontSize: 'calc(15 * var(--lu))',
                    fontWeight: 600,
                    color: '#111111',
                    marginTop: 'calc(6 * var(--lu))',
                  }}
                  className="leading-none whitespace-nowrap"
                >
                  or click to browse
                </p>

                {/* Gray pill centered, 12px below: height 25px, radius 999px, bg #EAEBED, text 12.5px weight 500 #555 */}
                <div
                  style={{
                    marginTop: 'calc(12 * var(--lu))',
                    height: 'calc(25 * var(--lu))',
                    paddingLeft: 'calc(14 * var(--lu))',
                    paddingRight: 'calc(14 * var(--lu))',
                    borderRadius: '999px',
                    backgroundColor: '#EAEBED',
                    fontSize: 'calc(12.5 * var(--lu))',
                    fontWeight: 500,
                    color: '#555555',
                  }}
                  className="inline-flex items-center justify-center whitespace-nowrap leading-none"
                >
                  Max file size: 100 MB
                  <span style={{ margin: '0 calc(8 * var(--lu))' }}>•</span>
                  Multiple files allowed
                </div>
              </div>

              {/* 5. SELECTED FILES BOX (gap above: 20px): 508px wide, bg #FCFBF6, border 1px solid #E0DED8, radius 10px, padding 16px */}
              <div
                style={{
                  width: '100%',
                  maxWidth: 'calc(508 * var(--lu))',
                  backgroundColor: '#FCFBF6',
                  border: 'calc(1 * var(--lu)) solid #E0DED8',
                  borderRadius: 'calc(10 * var(--lu))',
                  padding: 'calc(16 * var(--lu))',
                  marginTop: 'calc(20 * var(--lu))',
                  boxSizing: 'border-box',
                }}
                className="flex flex-col"
              >
                {/* Header: "Selected files (N)" 16px weight 700 on left, "Total: X MB" 13px weight 500 #666 on right, 14px below it first row */}
                <div
                  style={{ marginBottom: 'calc(14 * var(--lu))' }}
                  className="flex items-center justify-between"
                >
                  <span
                    style={{
                      fontSize: 'calc(16 * var(--lu))',
                      fontWeight: 700,
                      color: '#111111',
                    }}
                    className="leading-none whitespace-nowrap"
                  >
                    Selected files ({stagedFiles.length})
                  </span>
                  <span
                    style={{
                      fontSize: 'calc(13 * var(--lu))',
                      fontWeight: 500,
                      color: '#666666',
                    }}
                    className="leading-none whitespace-nowrap"
                  >
                    Total: {formatBytes(totalStagedBytes)}
                  </span>
                </div>

                {stagedFiles.length === 0 ? (
                  <div
                    style={{
                      height: 'calc(50 * var(--lu))',
                      fontSize: 'calc(13 * var(--lu))',
                    }}
                    className="flex items-center justify-center text-[#888888] font-medium text-center"
                  >
                    No files selected yet. Drop files above.
                  </div>
                ) : (
                  <div
                    style={{
                      gap: 'calc(8 * var(--lu))',
                      maxHeight: 'calc(230 * var(--lu))',
                    }}
                    className="flex flex-col overflow-y-auto"
                  >
                    {stagedFiles.map(s => {
                      const tileConfig = getFileTileConfig(s.name);
                      return (
                        <div
                          key={s.id}
                          style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: 'calc(480 * var(--lu))',
                            height: 'calc(66 * var(--lu))',
                            backgroundColor: '#FBFAF5',
                            border: 'calc(1 * var(--lu)) solid #D9D5CC',
                            borderRadius: 'calc(8 * var(--lu))',
                            padding: '0 calc(16 * var(--lu)) 0 calc(10 * var(--lu))',
                            boxSizing: 'border-box',
                          }}
                          className="shrink-0"
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: 'calc(10 * var(--lu))',
                              top: 'calc(10 * var(--lu))',
                              width: 'calc(46 * var(--lu))',
                              height: 'calc(46 * var(--lu))',
                            }}
                            className="flex items-center justify-center shrink-0 select-none overflow-hidden rounded-[8px]"
                          >
                            <FileTypeIcon filename={s.name} size="desktop" className="w-full h-full object-contain" />
                          </div>

                          {/* File name: 16px weight 700 #111 at x=67px from the row's left, vertically 14px from the top; size: 13px weight 500 #666 below it, 4px gap. Long names truncate with ellipsis, never wrap. */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 'calc(67 * var(--lu))',
                              top: 'calc(14 * var(--lu))',
                              right: 'calc(48 * var(--lu))',
                            }}
                          >
                            <p
                              style={{
                                fontSize: 'calc(16 * var(--lu))',
                                fontWeight: 700,
                                color: '#111111',
                                lineHeight: 1.15,
                              }}
                              className="truncate whitespace-nowrap overflow-hidden"
                            >
                              {s.name}
                            </p>
                            <p
                              style={{
                                fontSize: 'calc(13 * var(--lu))',
                                fontWeight: 500,
                                color: '#666666',
                                marginTop: 'calc(4 * var(--lu))',
                                lineHeight: 1,
                              }}
                              className="whitespace-nowrap"
                            >
                              {formatBytes(s.size)}
                            </p>
                          </div>

                          {/* Remove icon: X (icon-close-x.webp ~18px, 2px black stroke) vertically centered, 20px from row's right edge */}
                          <button
                            type="button"
                            onClick={e => handleRemoveStagedFile(s.id, e)}
                            style={{
                              position: 'absolute',
                              right: 'calc(20 * var(--lu))',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 'calc(18 * var(--lu))',
                              height: 'calc(18 * var(--lu))',
                              padding: 0,
                              background: 'none',
                              border: 'none',
                            }}
                            className="flex items-center justify-center cursor-pointer shrink-0 hover:opacity-70 transition-opacity"
                            title="Remove"
                            aria-label={`Remove ${s.name}`}
                          >
                            <img
                              src="/icon-close-x.webp"
                              alt="Remove"
                              style={{
                                width: 'calc(18 * var(--lu))',
                                height: 'calc(18 * var(--lu))',
                              }}
                              className="object-contain"
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 6. CREATE ROOM BUTTON (gap above: 28px): Centered, 435px wide x 62px high, bg #FED22E, border 3px solid #111, radius 12px, hard shadow 5px 6px 0 #111 */}
              <div
                style={{
                  marginTop: 'calc(28 * var(--lu))',
                  position: 'relative',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="shrink-0"
              >
                {/* Left sparkle: ~24px wide at 34px from card's left edge near button's top (34 - 32 = 2px) */}
                <img
                  src="/sparkle-lines-btn-left.webp"
                  alt=""
                  style={{
                    position: 'absolute',
                    left: 'calc(2px * var(--lu))',
                    top: 'calc(4 * var(--lu))',
                    width: 'calc(24 * var(--lu))',
                    height: 'calc(24 * var(--lu))',
                  }}
                  className="object-contain pointer-events-none select-none"
                />

                <button
                  type="button"
                  onClick={() => {
                    handleCreateRoom();
                  }}
                  onMouseEnter={() => setIsBtnHovered(true)}
                  onMouseLeave={() => setIsBtnHovered(false)}
                  disabled={stagedFiles.length === 0 || stagedFiles.every(s => s.rejected)}
                  style={{
                    width: 'calc(435 * var(--lu))',
                    height: 'calc(62 * var(--lu))',
                    borderRadius: 'calc(12 * var(--lu))',
                    border: 'calc(3 * var(--lu)) solid #111111',
                    gap: 'calc(12 * var(--lu))',
                    backgroundColor:
                      stagedFiles.length === 0 || stagedFiles.every(s => s.rejected)
                        ? '#EDEBE6'
                        : '#FED22E',
                    boxShadow:
                      stagedFiles.length === 0 || stagedFiles.every(s => s.rejected)
                        ? 'none'
                        : isBtnHovered
                        ? 'calc(3 * var(--lu)) calc(3 * var(--lu)) 0 #111111'
                        : 'calc(5 * var(--lu)) calc(6 * var(--lu)) 0 #111111',
                    transform:
                      !(stagedFiles.length === 0 || stagedFiles.every(s => s.rejected)) && isBtnHovered
                        ? 'translate(calc(2 * var(--lu)), calc(2 * var(--lu)))'
                        : 'none',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    color:
                      stagedFiles.length === 0 || stagedFiles.every(s => s.rejected)
                        ? '#8E8D88'
                        : '#111111',
                    cursor:
                      stagedFiles.length === 0 || stagedFiles.every(s => s.rejected)
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                  className="flex items-center justify-center font-heading font-extrabold select-none"
                >
                  <img
                    src="/mascot-pizza.webp"
                    alt=""
                    style={{
                      width: 'calc(36 * var(--lu))',
                      height: 'calc(36 * var(--lu))',
                    }}
                    className="object-contain shrink-0"
                  />
                  <span
                    style={{ fontSize: 'calc(22 * var(--lu))', fontWeight: 800 }}
                    className="font-heading leading-none whitespace-nowrap"
                  >
                    Create Room
                  </span>
                </button>

                {/* Right sparkle: ~24px wide at 20px from card's right edge near button's bottom (20 - 32 = -12px) */}
                <img
                  src="/sparkle-lines-btn-right.webp"
                  alt=""
                  style={{
                    position: 'absolute',
                    right: 'calc(-12px * var(--lu))',
                    bottom: 'calc(4 * var(--lu))',
                    width: 'calc(24 * var(--lu))',
                    height: 'calc(24 * var(--lu))',
                  }}
                  className="object-contain pointer-events-none select-none"
                />
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN: CODE AND FILES CARDS (480px wide) ================= */}
          <div
            style={{
              width: '100%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'calc(17 * var(--u))',
              overflow: 'hidden',
            }}
          >
            {/* ================= 2. YOUR ROOM IS READY! CARD ================= */}
            <div
              style={
                {
                  '--ru': 'clamp(0.5px, calc(100vw / 1487), 1.15px)',
                  width: '100%',
                  maxWidth: 'calc(815 * var(--ru))',
                  minWidth: 0,
                  height: 'calc(377 * var(--ru))',
                  backgroundColor: '#FDEFBB',
                  border: 'calc(3 * var(--ru)) solid #111111',
                  borderRadius: 'calc(22 * var(--ru))',
                  boxShadow: 'calc(5 * var(--ru)) calc(5 * var(--ru)) 0 #111111',
                  padding: 'calc(16 * var(--ru)) calc(28 * var(--ru))',
                  boxSizing: 'border-box',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                } as React.CSSProperties
              }
            >
              {/* TOP ROW: Heading + Code Box (Col 1), QR Box (Col 2), Scan Text (Col 3) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  position: 'relative',
                  width: '100%',
                  height: 'calc(169 * var(--ru))',
                  flexShrink: 0,
                }}
              >
                {/* COLUMN 1: Heading row + Code box */}
                <div style={{ width: 'calc(313 * var(--ru))', flexShrink: 0 }}>
                  {/* 1. Heading row: Small pizza (50px) at left, 14px gap, "Your room is ready!" 22px/800 #111 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'calc(14 * var(--ru))',
                      height: 'calc(50 * var(--ru))',
                    }}
                  >
                    <img
                      src="/mascot-pizza.webp"
                      alt=""
                      style={{
                        width: 'calc(50 * var(--ru))',
                        height: 'calc(50 * var(--ru))',
                      }}
                      className="object-contain shrink-0"
                    />
                    <h3
                      style={{
                        fontSize: 'calc(22 * var(--ru))',
                        fontWeight: 800,
                        color: '#111111',
                      }}
                      className="font-heading leading-none whitespace-nowrap"
                    >
                      Your room is ready!
                    </h3>
                  </div>

                  {/* 2. Code box: 11px gap below heading, 313x77px, white, border 3px solid #111, radius 14px, shadow 4px 4px 0 #111 */}
                  <div
                    style={{
                      marginTop: 'calc(11 * var(--ru))',
                      width: 'calc(313 * var(--ru))',
                      height: 'calc(77 * var(--ru))',
                      backgroundColor: '#ffffff',
                      border: 'calc(3 * var(--ru)) solid #111111',
                      borderRadius: 'calc(14 * var(--ru))',
                      boxShadow: 'calc(4 * var(--ru)) calc(4 * var(--ru)) 0 #111111',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'calc(60 * var(--ru))',
                        fontWeight: 800,
                        color: '#111111',
                        letterSpacing: '0.04em',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                      className="leading-none whitespace-nowrap select-all"
                    >
                      {activeCode}
                    </span>
                  </div>
                </div>

                {/* COLUMN 2: QR box (50px gap from code box, 181x169px, radius 18px, border 3px solid #111, shadow 4px 4px 0 #111) */}
                <div
                  style={{
                    marginLeft: 'calc(50 * var(--ru))',
                    position: 'relative',
                    width: 'calc(181 * var(--ru))',
                    height: 'calc(169 * var(--ru))',
                    backgroundColor: '#ffffff',
                    border: 'calc(3 * var(--ru)) solid #111111',
                    borderRadius: 'calc(18 * var(--ru))',
                    boxShadow: 'calc(4 * var(--ru)) calc(4 * var(--ru)) 0 #111111',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      style={{
                        width: 'calc(130 * var(--ru))',
                        height: 'calc(130 * var(--ru))',
                      }}
                      className="object-contain select-none pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-neutral-400">
                      QR
                    </div>
                  )}

                  {/* Pink sparkle ~28px wide, OUTSIDE the box, 25px to right of its right edge, aligned with box's top */}
                  <img
                    src="/sparkle-pink-qr-room.webp"
                    alt=""
                    style={{
                      position: 'absolute',
                      left: 'calc(100% + 25 * var(--ru))',
                      top: 0,
                      width: 'calc(28 * var(--ru))',
                      height: 'calc(28 * var(--ru))',
                    }}
                    className="object-contain pointer-events-none select-none z-10"
                  />
                </div>

                {/* COLUMN 3: Scan text (third column, 50px right of QR box, vertically centered with QR box) */}
                <div
                  style={{
                    marginLeft: 'calc(50 * var(--ru))',
                    height: 'calc(169 * var(--ru))',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <p
                    style={{
                      fontSize: 'calc(17 * var(--ru))',
                      fontWeight: 800,
                      color: '#111111',
                    }}
                    className="font-heading leading-tight whitespace-nowrap"
                  >
                    Scan the QR code
                  </p>
                  <p
                    style={{
                      fontSize: 'calc(15 * var(--ru))',
                      fontWeight: 500,
                      color: '#4F6275',
                      lineHeight: 'calc(22 * var(--ru))',
                      marginTop: 'calc(8 * var(--ru))',
                    }}
                    className="whitespace-nowrap"
                  >
                    Open on any device<br />to join the room.
                  </p>
                </div>
              </div>

              {/* 5. LINK BAR: 20px below QR box's bottom edge, height 58px, white, border 3px solid #111, radius 12px, shadow 4px 4px 0 #111 */}
              <div
                style={{
                  marginTop: 'calc(20 * var(--ru))',
                  width: '100%',
                  height: 'calc(58 * var(--ru))',
                  backgroundColor: '#ffffff',
                  border: 'calc(3 * var(--ru)) solid #111111',
                  borderRadius: 'calc(12 * var(--ru))',
                  boxShadow: 'calc(4 * var(--ru)) calc(4 * var(--ru)) 0 #111111',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {/* Left cell 72px wide with link icon (~28px) centered */}
                <div
                  style={{
                    width: 'calc(72 * var(--ru))',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src="/icon-link.webp"
                    alt=""
                    style={{
                      width: 'calc(28 * var(--ru))',
                      height: 'calc(28 * var(--ru))',
                    }}
                    className="object-contain"
                  />
                </div>

                {/* 1.5px #C8C8C8 vertical divider */}
                <div
                  style={{
                    width: 'calc(1.5 * var(--ru))',
                    height: '100%',
                    backgroundColor: '#C8C8C8',
                    flexShrink: 0,
                  }}
                />

                {/* URL text starts 16px after divider, 16px, weight 500, #111, one line, ellipsis if too long */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 'calc(16 * var(--ru))',
                    paddingRight: 'calc(16 * var(--ru))',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'calc(16 * var(--ru))',
                      fontWeight: 500,
                      color: '#111111',
                    }}
                    className="font-sans truncate select-all block w-full leading-none whitespace-nowrap"
                  >
                    {effectiveShareUrl}
                  </span>
                </div>

                {/* Right cell 122px wide, white, border-left 2px solid #111, copy icon (~22px), 8px gap and "Copy" 15px weight 700 #111. Hover: #F5F5F5 */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    width: 'calc(122 * var(--ru))',
                    height: '100%',
                    backgroundColor: '#ffffff',
                    borderLeft: 'calc(2 * var(--ru)) solid #111111',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'calc(8 * var(--ru))',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  className="hover:bg-[#F5F5F5] transition-colors"
                  title="Copy link"
                >
                  <img
                    src={copiedLink ? '/icon-check-green.webp' : '/icon-copy-dark.webp'}
                    alt=""
                    style={{
                      width: 'calc(22 * var(--ru))',
                      height: 'calc(22 * var(--ru))',
                    }}
                    className="object-contain shrink-0"
                  />
                  <span
                    style={{
                      fontSize: 'calc(15 * var(--ru))',
                      fontWeight: 700,
                      color: '#111111',
                    }}
                    className="font-heading whitespace-nowrap"
                  >
                    {copiedLink ? 'Copied' : 'Copy'}
                  </span>
                </button>
              </div>

              {/* 6. INFO STRIP (20px below link bar, ~760px wide, 4px wider than link bar on each side, height 67px, bg #FFF9DD, radius 12px, padding 0 16px) */}
              <div
                style={{
                  marginTop: 'calc(20 * var(--ru))',
                  width: 'calc(100% + 8 * var(--ru))',
                  marginLeft: 'calc(-4 * var(--ru))',
                  marginRight: 'calc(-4 * var(--ru))',
                  height: 'calc(67 * var(--ru))',
                  backgroundColor: '#FFF9DD',
                  borderRadius: 'calc(12 * var(--ru))',
                  paddingLeft: 'calc(16 * var(--ru))',
                  paddingRight: 'calc(16 * var(--ru))',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src="/mascot-pizza.webp"
                  alt=""
                  style={{
                    width: 'calc(36 * var(--ru))',
                    height: 'calc(36 * var(--ru))',
                  }}
                  className="object-contain shrink-0"
                />
                <p
                  style={{
                    fontSize: 'calc(15.5 * var(--ru))',
                    fontWeight: 500,
                    lineHeight: 'calc(24 * var(--ru))',
                    color: '#1F2D3A',
                    marginLeft: 'calc(16 * var(--ru))',
                  }}
                  className="whitespace-nowrap"
                >
                  Share this code or link with anyone. They can upload and download files<br />
                  from any device, even on different networks.
                </p>
              </div>
            </div>

            {/* ================= 3. FILES IN THIS ROOM CARD (~501px tall) ================= */}
            <div
              style={
                {
                  '--ru': 'clamp(0.5px, calc(100vw / 1487), 1.15px)',
                  width: 'calc(815 * var(--ru))',
                  height: 'calc(501 * var(--ru))',
                  borderRadius: 'calc(22 * var(--ru))',
                  border: 'calc(3 * var(--ru)) solid #111111',
                  backgroundColor: '#FDFAF5',
                  boxShadow: 'calc(5 * var(--ru)) calc(5 * var(--ru)) 0 #111111',
                  padding: 'calc(24 * var(--ru))',
                  display: 'flex',
                  flexDirection: 'column',
                  flexShrink: 0,
                  position: 'relative',
                  boxSizing: 'border-box',
                } as React.CSSProperties
              }
            >
              {/* 1. TITLE ROW: "Files in this room" 24px/800 on left, white "Add more files" button 159x39px on right */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                  minWidth: 0,
                }}
              >
                <h3
                  style={{
                    fontSize: 'calc(24 * var(--ru))',
                    fontWeight: 800,
                    color: '#111111',
                    lineHeight: 1,
                  }}
                  className="font-heading whitespace-nowrap truncate select-none"
                >
                  Files in this room
                </h3>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 'calc(159 * var(--ru))',
                    height: 'calc(39 * var(--ru))',
                    borderRadius: 'calc(10 * var(--ru))',
                    border: 'calc(2 * var(--ru)) solid #111111',
                    backgroundColor: '#ffffff',
                    boxShadow: 'calc(3 * var(--ru)) calc(3 * var(--ru)) 0 #111111',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'calc(10 * var(--ru))',
                    cursor: 'pointer',
                  }}
                  className="hover:bg-neutral-50 active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all select-none shrink-0"
                  title="Add more files"
                >
                  <img
                    src="/icon-plus.webp"
                    alt=""
                    style={{
                      width: 'calc(16 * var(--ru))',
                      height: 'calc(16 * var(--ru))',
                    }}
                    className="object-contain shrink-0"
                  />
                  <span
                    style={{
                      fontSize: 'calc(14 * var(--ru))',
                      fontWeight: 700,
                      color: '#111111',
                    }}
                    className="font-heading leading-none whitespace-nowrap"
                  >
                    Add more files
                  </span>
                </button>
              </div>

              {/* 2. FILE ROWS (starts 10px below the button, 6px gap between rows) */}
              <div
                style={{
                  marginTop: 'calc(10 * var(--ru))',
                  marginBottom: 'calc(12 * var(--ru))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'calc(6 * var(--ru))',
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                }}
              >
                {/* Upload queue items */}
                {uploadQueue
                  .filter(item => item.status !== 'completed' && !roomFiles.some(f => f.originalFilename === item.name))
                  .map((item, idx) => {
                    const isUploading = item.status === 'uploading';
                    const isWaiting = (item.status as string) === 'waiting';
                    const isCompleted = item.status === 'completed';
                    const isError = item.status === 'error';

                    return (
                      <div
                        key={`uq-${idx}`}
                        style={{
                          width: '100%',
                          height: 'calc(74 * var(--ru))',
                          backgroundColor: '#FCFBF6',
                          border: 'calc(1 * var(--ru)) solid #E9E8E3',
                          borderRadius: 'calc(12 * var(--ru))',
                          paddingLeft: 'calc(18 * var(--ru))',
                          paddingRight: 'calc(18 * var(--ru))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexShrink: 0,
                          boxSizing: 'border-box',
                        }}
                      >
                        {/* Left side: File tile + File name & size */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            minWidth: 0,
                          }}
                        >
                          {/* File tile: 46x46px, radius 10px */}
                          <div
                            style={{
                              width: 'calc(46 * var(--ru))',
                              height: 'calc(46 * var(--ru))',
                              borderRadius: 'calc(10 * var(--ru))',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FileTypeIcon filename={item.name} size="desktop" className="w-full h-full object-contain" />
                          </div>

                        {/* File name (starts 22px right of tile, 16px/700) + size (13px/500 #666, 4px gap) */}
                        <div
                          style={{
                            marginLeft: 'calc(22 * var(--ru))',
                            maxWidth: 'calc(285 * var(--ru))',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <p
                            style={{
                              fontSize: 'calc(16 * var(--ru))',
                              fontWeight: 700,
                              color: '#111111',
                              lineHeight: 1.2,
                            }}
                            className="font-heading truncate whitespace-nowrap"
                            title={item.name}
                          >
                            {item.name}
                          </p>
                          <p
                            style={{
                              fontSize: 'calc(13 * var(--ru))',
                              fontWeight: 500,
                              color: '#666666',
                              marginTop: 'calc(4 * var(--ru))',
                              lineHeight: 1,
                            }}
                            className="whitespace-nowrap"
                          >
                            {formatBytes(item.size)}
                          </p>
                        </div>
                      </div>

                      {/* STATUS COLUMN starts at fixed x=387px, 150px wide */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 'calc(387 * var(--ru))',
                          width: 'calc(150 * var(--ru))',
                          top: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {isUploading ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              width: '100%',
                              justifyContent: 'center',
                            }}
                          >
                            <div
                              style={{
                                width: '100%',
                                height: 'calc(10 * var(--ru))',
                                backgroundColor: '#EBEAE6',
                                borderRadius: '9999px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, Math.max(5, item.progress))}%`,
                                  backgroundColor: '#0A78F5',
                                  borderRadius: '9999px',
                                  transition: 'width 0.2s ease',
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 'calc(14 * var(--ru))',
                                fontWeight: 600,
                                color: '#1F4E8C',
                                marginTop: 'calc(8 * var(--ru))',
                                lineHeight: 1,
                              }}
                              className="font-heading whitespace-nowrap"
                            >
                              Uploading... {item.progress || 68}%
                            </span>
                          </div>
                        ) : isWaiting ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              width: '100%',
                              justifyContent: 'center',
                            }}
                          >
                            <div
                              style={{
                                width: '100%',
                                height: 'calc(10 * var(--ru))',
                                backgroundColor: '#EDEBEC',
                                borderRadius: '9999px',
                              }}
                            />
                            <span
                              style={{
                                fontSize: 'calc(14 * var(--ru))',
                                fontWeight: 500,
                                color: '#8A8A8A',
                                marginTop: 'calc(8 * var(--ru))',
                                lineHeight: 1,
                              }}
                              className="font-heading whitespace-nowrap"
                            >
                              Waiting...
                            </span>
                          </div>
                        ) : isError ? (
                          <span
                            style={{
                              fontSize: 'calc(14 * var(--ru))',
                              fontWeight: 600,
                              color: '#DC2626',
                            }}
                            className="font-heading whitespace-nowrap cursor-pointer hover:underline"
                            onClick={() => onFileUpload([new File([], item.name)])}
                            title="Click to retry"
                          >
                            Failed (retry)
                          </span>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'calc(8 * var(--ru))',
                            }}
                          >
                            <img
                              src="/icon-check-green.webp"
                              alt=""
                              style={{
                                width: 'calc(17 * var(--ru))',
                                height: 'calc(17 * var(--ru))',
                              }}
                              className="object-contain shrink-0"
                            />
                            <span
                              style={{
                                fontSize: 'calc(15 * var(--ru))',
                                fontWeight: 600,
                                color: '#1E7A4C',
                              }}
                              className="font-heading whitespace-nowrap"
                            >
                              Uploaded
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right side: DOWNLOAD BUTTON + THREE-DOT ICON */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          marginLeft: 'auto',
                          flexShrink: 0,
                        }}
                      >
                        {isCompleted ? (
                          <button
                            type="button"
                            onClick={() => onDownloadFile({ id: `uq-${idx}`, originalFilename: item.name, sizeBytes: item.size, mimeType: '', createdAt: Date.now() })}
                            style={{
                              width: 'calc(130 * var(--ru))',
                              height: 'calc(43 * var(--ru))',
                              backgroundColor: '#FED22E',
                              border: 'calc(3 * var(--ru)) solid #111111',
                              borderRadius: 'calc(10 * var(--ru))',
                              boxShadow: 'calc(3 * var(--ru)) calc(3 * var(--ru)) 0 #111111',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 'calc(8 * var(--ru))',
                              cursor: 'pointer',
                            }}
                            className="hover:translate-x-[0.5px] hover:translate-y-[0.5px] active:shadow-none transition-all select-none"
                          >
                            <img
                              src="/icon-download-yellow-btn.webp"
                              alt=""
                              style={{
                                width: 'calc(18 * var(--ru))',
                                height: 'calc(18 * var(--ru))',
                              }}
                              className="object-contain shrink-0"
                            />
                            <span
                              style={{
                                fontSize: 'calc(15 * var(--ru))',
                                fontWeight: 700,
                                color: '#111111',
                              }}
                              className="font-heading leading-none whitespace-nowrap"
                            >
                              Download
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            style={{
                              width: 'calc(130 * var(--ru))',
                              height: 'calc(43 * var(--ru))',
                              backgroundColor: '#E4E5E8',
                              border: 'calc(2 * var(--ru)) solid #D5D6D8',
                              borderRadius: 'calc(10 * var(--ru))',
                              boxShadow: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 'calc(8 * var(--ru))',
                              cursor: 'not-allowed',
                            }}
                            className="select-none"
                          >
                            <img
                              src="/icon-download-grey.webp"
                              alt=""
                              style={{
                                width: 'calc(18 * var(--ru))',
                                height: 'calc(18 * var(--ru))',
                              }}
                              className="object-contain shrink-0"
                            />
                            <span
                              style={{
                                fontSize: 'calc(15 * var(--ru))',
                                fontWeight: 700,
                                color: '#888A90',
                              }}
                              className="font-heading leading-none whitespace-nowrap"
                            >
                              Download
                            </span>
                          </button>
                        )}

                        <div
                          style={{
                            marginLeft: 'calc(40 * var(--ru))',
                            width: 'calc(24 * var(--ru))',
                            height: 'calc(24 * var(--ru))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.35,
                            cursor: 'not-allowed',
                          }}
                        >
                          <img
                            src="/icon-dots-vertical.webp"
                            alt="More"
                            style={{
                              width: 'calc(18 * var(--ru))',
                              height: 'calc(18 * var(--ru))',
                            }}
                            className="object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Real room files */}
                {roomFiles.map(file => {
                  const tileConfig = getFileTileConfig(file.originalFilename);

                  return (
                    <div
                      key={file.id}
                      style={{
                        width: '100%',
                        height: 'calc(74 * var(--ru))',
                        minHeight: 'calc(74 * var(--ru))',
                        maxHeight: 'calc(74 * var(--ru))',
                        backgroundColor: '#FCFBF6',
                        border: 'calc(1 * var(--ru)) solid #E9E8E3',
                        borderRadius: 'calc(12 * var(--ru))',
                        paddingLeft: 'calc(18 * var(--ru))',
                        paddingRight: 'calc(18 * var(--ru))',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Left side: File tile + File name & size */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 'calc(46 * var(--ru))',
                            height: 'calc(46 * var(--ru))',
                            borderRadius: 'calc(10 * var(--ru))',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <FileTypeIcon filename={file.originalFilename} size="desktop" className="w-full h-full object-contain" />
                        </div>

                        {/* File name (starts 22px right of tile, 16px/700) + size (13px/500 #666, 4px gap) */}
                        <div
                          style={{
                            marginLeft: 'calc(22 * var(--ru))',
                            maxWidth: 'calc(285 * var(--ru))',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <p
                            style={{
                              fontSize: 'calc(16 * var(--ru))',
                              fontWeight: 700,
                              color: '#111111',
                              lineHeight: 1.2,
                            }}
                            className="font-heading truncate whitespace-nowrap"
                            title={file.originalFilename}
                          >
                            {file.originalFilename}
                          </p>
                          <p
                            style={{
                              fontSize: 'calc(13 * var(--ru))',
                              fontWeight: 500,
                              color: '#666666',
                              marginTop: 'calc(4 * var(--ru))',
                              lineHeight: 1,
                            }}
                            className="whitespace-nowrap"
                          >
                            {formatBytes(file.sizeBytes)}
                          </p>
                        </div>
                      </div>

                      {/* STATUS COLUMN starts at fixed x=387px, 150px wide */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 'calc(387 * var(--ru))',
                          width: 'calc(150 * var(--ru))',
                          top: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'calc(8 * var(--ru))',
                          }}
                        >
                          <img
                            src="/icon-check-green.webp"
                            alt=""
                            style={{
                              width: 'calc(17 * var(--ru))',
                              height: 'calc(17 * var(--ru))',
                            }}
                            className="object-contain shrink-0"
                          />
                          <span
                            style={{
                              fontSize: 'calc(15 * var(--ru))',
                              fontWeight: 600,
                              color: '#1E7A4C',
                            }}
                            className="font-heading whitespace-nowrap"
                          >
                            Uploaded
                          </span>
                        </div>
                      </div>

                      {/* Right side: DOWNLOAD BUTTON + THREE-DOT ICON */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          marginLeft: 'auto',
                          flexShrink: 0,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onDownloadFile(file)}
                          style={{
                            width: 'calc(130 * var(--ru))',
                            height: 'calc(43 * var(--ru))',
                            backgroundColor: '#FED22E',
                            border: 'calc(3 * var(--ru)) solid #111111',
                            borderRadius: 'calc(10 * var(--ru))',
                            boxShadow: 'calc(3 * var(--ru)) calc(3 * var(--ru)) 0 #111111',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'calc(8 * var(--ru))',
                            cursor: 'pointer',
                          }}
                          className="hover:translate-x-[0.5px] hover:translate-y-[0.5px] active:shadow-none transition-all select-none"
                          title="Download file"
                        >
                          <img
                            src="/icon-download-yellow-btn.webp"
                            alt=""
                            style={{
                              width: 'calc(18 * var(--ru))',
                              height: 'calc(18 * var(--ru))',
                            }}
                            className="object-contain shrink-0"
                          />
                          <span
                            style={{
                              fontSize: 'calc(15 * var(--ru))',
                              fontWeight: 700,
                              color: '#111111',
                            }}
                            className="font-heading leading-none whitespace-nowrap"
                          >
                            Download
                          </span>
                        </button>

                        {/* THREE-DOT ICON (menu trigger): 40px to the right of download button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setActiveMenuFileId(prev => (prev === file.id ? null : file.id));
                            }}
                            style={{
                              marginLeft: 'calc(40 * var(--ru))',
                              width: 'calc(24 * var(--ru))',
                              height: 'calc(24 * var(--ru))',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                            }}
                            aria-label="More"
                          >
                            <img
                              src="/icon-dots-vertical.webp"
                              alt="More"
                              style={{
                                width: 'calc(18 * var(--ru))',
                                height: 'calc(18 * var(--ru))',
                              }}
                              className="object-contain"
                            />
                          </button>

                          {activeMenuFileId === file.id && (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: 'calc(34 * var(--ru))',
                                width: 'calc(120 * var(--ru))',
                                borderRadius: 'calc(8 * var(--ru))',
                                border: 'calc(2 * var(--ru)) solid #111111',
                                backgroundColor: '#ffffff',
                                boxShadow: 'calc(3 * var(--ru)) calc(3 * var(--ru)) 0 #111111',
                                padding: 'calc(4 * var(--ru))',
                                zIndex: 50,
                              }}
                              className="flex flex-col font-heading font-bold"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  onDownloadFile(file);
                                  setActiveMenuFileId(null);
                                }}
                                style={{
                                  fontSize: 'calc(13 * var(--ru))',
                                  padding: 'calc(6 * var(--ru)) calc(10 * var(--ru))',
                                  textAlign: 'left',
                                }}
                                className="w-full hover:bg-[#FED228]/20 rounded cursor-pointer whitespace-nowrap"
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
                                  style={{
                                    fontSize: 'calc(13 * var(--ru))',
                                    padding: 'calc(6 * var(--ru)) calc(10 * var(--ru))',
                                    textAlign: 'left',
                                  }}
                                  className="w-full hover:bg-rose-50 text-rose-600 rounded cursor-pointer whitespace-nowrap"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Empty state: only when room has no files and no upload queue */}
                {roomFiles.length === 0 && uploadQueue.length === 0 && (
                  <div
                    style={{
                      height: 'calc(260 * var(--ru))',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <p
                      style={{
                        fontSize: 'calc(18 * var(--ru))',
                        fontWeight: 800,
                        color: '#111111',
                      }}
                      className="font-heading"
                    >
                      No files in this room yet.
                    </p>
                    <p
                      style={{
                        fontSize: 'calc(14 * var(--ru))',
                        color: '#71717A',
                        marginTop: 'calc(6 * var(--ru))',
                      }}
                      className="font-sans"
                    >
                      Click "+ Add more files" above or drop files to upload.
                    </p>
                  </div>
                )}
              </div>

              {/* 3. "GOOD TO KNOW" BANNER (20px below the last row, inside the card) */}
              <div
                style={{
                  marginTop: 'calc(20 * var(--ru))',
                  width: 'calc(759 * var(--ru))',
                  height: 'calc(79 * var(--ru))',
                  borderRadius: 'calc(12 * var(--ru))',
                  border: 'calc(2 * var(--ru)) solid #5FA599',
                  backgroundColor: '#E4FAEE',
                  paddingLeft: 'calc(16 * var(--ru))',
                  paddingRight: 'calc(16 * var(--ru))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'calc(12 * var(--ru))',
                    minWidth: 0,
                  }}
                >
                  <img
                    src="/mascot-pizza.webp"
                    alt=""
                    style={{
                      width: 'calc(32 * var(--ru))',
                      height: 'calc(32 * var(--ru))',
                    }}
                    className="object-contain shrink-0"
                  />
                  <div style={{ minWidth: 0 }}>
                    <h4
                      style={{
                        fontSize: 'calc(15 * var(--ru))',
                        fontWeight: 800,
                        color: '#111111',
                        lineHeight: 1.2,
                      }}
                      className="font-heading whitespace-nowrap"
                    >
                      Good to know
                    </h4>
                    <p
                      style={{
                        fontSize: 'calc(13 * var(--ru))',
                        fontWeight: 500,
                        color: '#3B4E43',
                        marginTop: 'calc(2 * var(--ru))',
                        lineHeight: 1.2,
                      }}
                      className="whitespace-nowrap"
                    >
                      Files stay available for 1 hour of inactivity or up to 6 hours total.
                    </p>
                  </div>
                </div>

                {/* End room button */}
                <button
                  type="button"
                  onClick={handleEndRoom}
                  disabled={isEnding}
                  style={{
                    width: 'calc(136 * var(--ru))',
                    height: 'calc(46 * var(--ru))',
                    borderRadius: 'calc(10 * var(--ru))',
                    border: 'calc(2.5 * var(--ru)) solid #C8174D',
                    backgroundColor: '#ffffff',
                    boxShadow: 'calc(3 * var(--ru)) calc(3 * var(--ru)) 0 #D9506F',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'calc(8 * var(--ru))',
                    cursor: isEnding ? 'wait' : 'pointer',
                  }}
                  className="hover:bg-[#FFF0F4] whitespace-nowrap shrink-0 transition-all active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none select-none"
                >
                  <img
                    src="/icon-trash.webp"
                    alt=""
                    style={{
                      width: 'calc(18 * var(--ru))',
                      height: 'calc(18 * var(--ru))',
                    }}
                    className="object-contain shrink-0"
                  />
                  <span
                    style={{
                      fontSize: 'calc(15 * var(--ru))',
                      fontWeight: 700,
                      color: '#C8174D',
                    }}
                    className="font-heading leading-none whitespace-nowrap"
                  >
                    End room
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* End Room Confirmation Modal */}
      {showConfirmEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FDF7ED] border-[3px] border-[#111111] rounded-[24px] shadow-[6px_6px_0_#111111] max-w-md w-full p-6 sm:p-7 relative font-sans text-center">
            <img src="/mascot-pizza.webp" alt="" className="w-16 h-16 mx-auto mb-4 object-contain" />
            <h3 className="font-heading font-extrabold text-2xl text-[#111111] mb-2">
              End Transfer Room?
            </h3>
            <p className="font-body text-sm text-[#666666] mb-6">
              All uploaded files will be immediately erased from the server and the room will be closed. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmEndModal(false)}
                className="flex-1 py-3 px-4 rounded-[14px] bg-white border-[2.5px] border-[#111111] font-heading font-bold text-sm text-[#111111] shadow-[3px_3px_0_#111111] btn-pressable-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEndRoom}
                disabled={isEnding}
                className="flex-1 py-3 px-4 rounded-[14px] bg-[#FD3F77] hover:bg-[#FD3F77]/90 border-[2.5px] border-[#111111] font-heading font-extrabold text-sm text-white shadow-[3px_3px_0_#111111] btn-pressable cursor-pointer"
              >
                {isEnding ? 'Ending...' : 'Yes, End Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
