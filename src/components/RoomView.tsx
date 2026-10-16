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
  file: File;
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
  maxFileSizeMb,
  onLeaveRoom,
  onRoomEnded,
  onRefreshRoom,
  onFileUpload,
  onDownloadFile,
  isUploading,
  uploadQueue,
  onCreateNewRoom,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(room?.expiresInSeconds || 3600);
  const [isEnding, setIsEnding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);

  const isRealRoom = Boolean(room && room.id && !room.id.startsWith('demo-room-init'));

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
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 200,
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

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuFileId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleEndRoom = async () => {
    if (!room || !creatorToken) return;
    const confirmed = confirm(
      'Are you sure you want to end this room? All uploaded files will be immediately erased from the server.'
    );
    if (!confirmed) return;

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
    const rawFiles = stagedFiles.map(s => s.file);
    setStagedFiles([]);
    await onCreateNewRoom(rawFiles);
  };

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileBadgeColor = (filename: string): { bg: string; text: string } => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return { bg: 'bg-[#FD3F77]', text: 'PDF' };
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { bg: 'bg-[#8562FC]', text: 'IMG' };
    if (['zip', 'rar', 'tar'].includes(ext)) return { bg: 'bg-[#22C55E]', text: 'ZIP' };
    if (['mp4', 'mov', 'avi'].includes(ext)) return { bg: 'bg-[#FC8828]', text: 'VID' };
    return { bg: 'bg-[#111111]', text: ext.toUpperCase() || 'FILE' };
  };

  const totalStagedBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  const roomFiles: FileItem[] = isRealRoom && room ? room.files : [];

  // If room was ended or expired
  if (isRealRoom && room && (room.status !== 'active' || remainingSeconds === 0)) {
    return (
      <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
        <img
          src="/room-blob-pink-top-left.webp"
          alt=""
          className="fixed top-0 left-0 w-48 sm:w-64 md:w-80 max-w-none pointer-events-none select-none z-0"
        />
        <img
          src="/room-blob-yellow-top-right.webp"
          alt=""
          className="fixed top-0 right-0 w-64 sm:w-80 md:w-96 max-w-none pointer-events-none select-none z-0"
        />
        <img
          src="/room-blob-purple-bottom-left.webp"
          alt=""
          className="fixed bottom-0 left-0 w-44 sm:w-56 md:w-72 max-w-none pointer-events-none select-none z-0"
        />
        <div className="fixed -bottom-16 -right-16 sm:-bottom-20 sm:-right-20 w-48 h-48 sm:w-60 sm:h-60 rounded-full bg-[#FED228] border-[3.5px] border-[#111111] shadow-[4px_4px_0_#111111] pointer-events-none select-none z-0 overflow-hidden flex items-center justify-center">
          <img
            src="/mascot-pizza.webp"
            alt=""
            className="w-28 h-28 sm:w-36 sm:h-36 object-contain transform -rotate-12 translate-x-3 -translate-y-3"
          />
        </div>

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
    <div className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-[#FDF7ED]">
      {/* BACKGROUND DECORATIONS (behind content) */}
      <img
        src="/room-blob-pink-top-left.webp"
        alt=""
        className="fixed top-0 left-0 w-48 sm:w-64 md:w-80 max-w-none pointer-events-none select-none z-0"
      />
      <img
        src="/room-blob-yellow-top-right.webp"
        alt=""
        className="fixed top-0 right-0 w-64 sm:w-80 md:w-96 max-w-none pointer-events-none select-none z-0"
      />
      <img
        src="/room-blob-purple-bottom-left.webp"
        alt=""
        className="fixed bottom-0 left-0 w-44 sm:w-56 md:w-72 max-w-none pointer-events-none select-none z-0"
      />

      {/* Bottom-right yellow circle with rotated mascot */}
      <div className="fixed -bottom-16 -right-16 sm:-bottom-20 sm:-right-20 w-48 h-48 sm:w-60 sm:h-60 rounded-full bg-[#FED228] border-[3.5px] border-[#111111] shadow-[4px_4px_0_#111111] pointer-events-none select-none z-0 overflow-hidden flex items-center justify-center">
        <img
          src="/mascot-pizza.webp"
          alt=""
          className="w-28 h-28 sm:w-36 sm:h-36 object-contain transform -rotate-12 translate-x-3 -translate-y-3"
        />
      </div>

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
      <div className="relative z-10 w-full max-w-[1240px] mx-auto px-4 sm:px-6 pt-3 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* ================= LEFT COLUMN ================= */}
          <div className="md:col-span-6 lg:col-span-5 bg-[#FDF7ED] border-[3px] border-[#111111] rounded-[24px] shadow-[6px_6px_0_#111111] p-5 sm:p-6 flex flex-col gap-4">
            
            {/* 1. Back row: arrow icon + "Create a sharing room" */}
            <div className="flex items-center gap-2 text-sm font-heading font-extrabold text-[#111111]">
              <button
                type="button"
                onClick={onLeaveRoom}
                className="w-7 h-7 bg-white border-[2px] border-[#111111] rounded-lg flex items-center justify-center shadow-[2px_2px_0_#111111] btn-pressable-sm cursor-pointer"
                aria-label="Back"
              >
                <img src="/icon-arrow-left.webp" alt="Back" className="w-3.5 h-3.5 object-contain" />
              </button>
              <span>Create a sharing room</span>
            </div>

            {/* 2. Headline on two lines with pink sparkle after files */}
            <div>
              <h1 className="font-heading font-extrabold text-3xl sm:text-[34px] leading-tight text-[#111111]">
                Add your files{' '}
                <span className="inline-block relative">
                  <img
                    src="/sparkle-pink-title.webp"
                    alt=""
                    className="inline-block w-6 h-6 object-contain ml-0.5 -translate-y-1 pointer-events-none select-none"
                  />
                </span>
                <br />
                and create a room.
              </h1>
            </div>

            {/* 3. Gray subtitle */}
            <p className="font-body text-xs sm:text-sm font-semibold text-[#555555]">
              Upload files, get a 6-digit code and share it anywhere.
            </p>

            {/* 4. Dropzone: light dashed GRAY border (not black, no white fill), big pizza with sparkles */}
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
              className={`border-[2.5px] dashed border-neutral-400 rounded-[20px] p-6 text-center cursor-pointer transition-colors bg-transparent ${
                isDragging ? 'bg-[#FED228]/10 border-[#111111]' : 'hover:border-neutral-500'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <img
                  src="/dropzone-pizza-sparkles.webp"
                  alt="Drop files"
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain mb-1"
                />
                <p className="font-heading font-extrabold text-base sm:text-lg text-[#111111]">
                  Drag & drop files here
                </p>
                <p className="font-body text-xs font-semibold text-[#555555]">
                  or <span className="underline cursor-pointer">click to browse</span>
                </p>
                <div className="mt-2 bg-[#E4E4E7]/70 border border-neutral-300 rounded-full px-3 py-1 text-[11px] font-semibold text-[#555555]">
                  Max file size: 100 MB • Multiple files allowed
                </div>
              </div>
            </div>

            {/* 5. Selected files box */}
            <div className="bg-white border-[2.5px] border-[#111111] rounded-[18px] shadow-[3.5px_3.5px_0_#111111] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <span className="font-heading font-extrabold text-sm text-[#111111]">
                  Selected files ({stagedFiles.length})
                </span>
                <span className="font-body text-xs font-semibold text-[#666666]">
                  Total: {formatBytes(totalStagedBytes)}
                </span>
              </div>

              {stagedFiles.length === 0 ? (
                <p className="font-body text-xs text-[#777777] text-center py-2">
                  No files selected yet. Drop files above.
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {stagedFiles.map(s => {
                    const badge = getFileBadgeColor(s.name);
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-neutral-50 border border-neutral-200"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-lg ${badge.bg} text-white font-heading font-extrabold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs`}>
                            {badge.text}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-heading font-bold text-xs text-[#111111] truncate">
                              {s.name}
                            </p>
                            <p className="font-body text-[11px] text-[#666666]">
                              {formatBytes(s.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={e => handleRemoveStagedFile(s.id, e)}
                          className="w-6 h-6 hover:bg-neutral-200 rounded-md flex items-center justify-center cursor-pointer text-[#666666]"
                          title="Remove"
                          aria-label={`Remove ${s.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 6. Big full-width yellow "Create Room" button with small pizza icon and sparkle strokes */}
            <div className="relative pt-1">
              <img
                src="/sparkle-lines-btn-left.webp"
                alt=""
                className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 object-contain pointer-events-none select-none z-10"
              />
              <button
                type="button"
                onClick={handleCreateRoom}
                className="w-full py-3.5 px-6 rounded-[18px] bg-[#FED228] border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] font-heading font-extrabold text-base text-[#111111] flex items-center justify-center gap-2.5 btn-pressable cursor-pointer relative z-0"
              >
                <img src="/mascot-pizza.webp" alt="" className="w-6 h-6 object-contain" />
                <span>Create Room</span>
              </button>
              <img
                src="/sparkle-lines-btn-right.webp"
                alt=""
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 object-contain pointer-events-none select-none z-10"
              />
            </div>

          </div>


          {/* ================= RIGHT COLUMN (THREE CARDS STACKED) ================= */}
          <div className="md:col-span-6 lg:col-span-7 flex flex-col gap-6">
            
            {/* CARD 1: Pale yellow card */}
            <div className="bg-[#FFF6D6] border-[3px] border-[#111111] rounded-[24px] shadow-[6px_6px_0_#111111] p-5 sm:p-6 flex flex-col gap-4">
              
              {/* Top row: small pizza + "Your room is ready!" */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img src="/mascot-pizza.webp" alt="" className="w-7 h-7 object-contain" />
                  <h3 className="font-heading font-extrabold text-xl text-[#111111]">
                    Your room is ready!
                  </h3>
                </div>
              </div>

              {/* Code box & QR layout matching mockup */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                {/* Code box */}
                <div className="sm:col-span-7 bg-white border-[3px] border-[#111111] rounded-[20px] shadow-[4px_4px_0_#111111] py-4 px-5 text-center">
                  <span className="font-heading font-extrabold text-3xl sm:text-4xl text-[#111111] tracking-[0.2em]">
                    {isRealRoom ? room?.code : '482731'}
                  </span>
                </div>

                {/* QR box and Scan text */}
                <div className="sm:col-span-5 flex items-center gap-3 bg-white border-[2.5px] border-[#111111] rounded-[18px] p-3 shadow-[3px_3px_0_#111111] relative">
                  <img
                    src="/sparkle-pink-qr-room.webp"
                    alt=""
                    className="absolute -top-3 -right-3 w-6 h-6 object-contain pointer-events-none select-none"
                  />
                  <div className="w-16 h-16 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[10px] font-bold text-neutral-400">QR</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-extrabold text-xs text-[#111111] leading-tight">
                      Scan the QR code
                    </p>
                    <p className="font-body text-[10px] text-[#666666] mt-0.5 leading-tight">
                      Open on any device to join the room.
                    </p>
                  </div>
                </div>
              </div>

              {/* Link bar */}
              <div className="bg-white border-[2.5px] border-[#111111] rounded-[16px] p-2 pl-3 flex items-center justify-between gap-2 shadow-[3px_3px_0_#111111]">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <img src="/icon-link.webp" alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                  <span className="font-mono text-xs text-[#111111] truncate font-medium">
                    {shareUrl}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FED228] border-[2px] border-[#111111] rounded-[10px] shadow-[2px_2px_0_#111111] font-heading font-extrabold text-xs text-[#111111] btn-pressable cursor-pointer"
                >
                  <img src="/icon-copy-dark.webp" alt="" className="w-3.5 h-3.5 object-contain" />
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Light yellow info strip */}
              <div className="flex items-start gap-2.5 bg-[#FEF9E7] border border-[#111111]/30 rounded-[14px] p-3">
                <img src="/mascot-pizza.webp" alt="" className="w-5 h-5 object-contain flex-shrink-0 mt-0.5" />
                <p className="font-body text-xs text-[#444444] leading-relaxed">
                  Share this code or link with anyone. They can upload and download files from any device, even on different networks.
                </p>
              </div>

            </div>


            {/* CARD 2: White card "Files in this room" */}
            <div className="bg-white border-[3px] border-[#111111] rounded-[24px] shadow-[6px_6px_0_#111111] p-5 sm:p-6 flex flex-col gap-4">
              
              <div className="flex items-center justify-between pb-2 border-b-2 border-neutral-100">
                <h3 className="font-heading font-extrabold text-xl text-[#111111]">
                  Files in this room
                </h3>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border-[2.5px] border-[#111111] rounded-[14px] shadow-[3px_3px_0_#111111] font-heading font-extrabold text-xs text-[#111111] btn-pressable cursor-pointer"
                >
                  <span>+ Add more files</span>
                </button>
              </div>

              {/* Upload queue & actual room files list */}
              <div className="flex flex-col gap-3">
                {uploadQueue.map((item, idx) => (
                  <div key={`uq-${idx}`} className="flex items-center justify-between gap-3 p-3 rounded-[16px] bg-neutral-50 border border-neutral-200">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-[#FC8828] text-white font-heading font-extrabold text-[10px] flex items-center justify-center flex-shrink-0">
                        VID
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold text-xs sm:text-sm text-[#111111] truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 max-w-[160px] h-2 bg-neutral-200 rounded-full overflow-hidden">
                            <div className="h-full bg-[#3B82F6]" style={{ width: `${item.progress}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-[#3B82F6]">
                            Uploading... {item.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="px-3.5 py-1.5 bg-neutral-200 border border-neutral-300 rounded-[10px] text-neutral-400 font-heading font-bold text-xs cursor-not-allowed"
                    >
                      Download
                    </button>
                  </div>
                ))}

                {!isRealRoom && stagedFiles.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-[16px] bg-neutral-50 border border-neutral-200">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-[#8562FC] text-white font-heading font-extrabold text-[10px] flex items-center justify-center flex-shrink-0">
                        FILE
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-xs sm:text-sm text-[#111111] truncate">
                          {s.name}
                        </p>
                        <p className="font-body text-xs text-[#666666]">
                          {formatBytes(s.size)} • Waiting...
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="px-3.5 py-1.5 bg-neutral-200 border border-neutral-300 rounded-[10px] text-neutral-400 font-heading font-bold text-xs cursor-not-allowed"
                    >
                      Download
                    </button>
                  </div>
                ))}

                {isRealRoom && roomFiles.map(file => {
                  const badge = getFileBadgeColor(file.originalFilename);
                  return (
                    <div key={file.id} className="flex items-center justify-between gap-3 p-3 rounded-[16px] bg-neutral-50 border border-neutral-200 relative">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-xl ${badge.bg} text-white font-heading font-extrabold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs`}>
                          {badge.text}
                        </div>
                        <div className="min-w-0">
                          <p className="font-heading font-bold text-xs sm:text-sm text-[#111111] truncate">
                            {file.originalFilename}
                          </p>
                          <p className="font-body text-xs text-[#666666] flex items-center gap-2">
                            <span>{formatBytes(file.sizeBytes)}</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              ✓ Uploaded
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onDownloadFile(file)}
                          className="px-3.5 py-1.5 bg-[#FED228] border-[2px] border-[#111111] rounded-[10px] shadow-[2px_2px_0_#111111] font-heading font-extrabold text-xs text-[#111111] btn-pressable cursor-pointer"
                        >
                          Download
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setActiveMenuFileId(prev => (prev === file.id ? null : file.id));
                            }}
                            className="w-8 h-8 hover:bg-neutral-200 rounded-lg flex items-center justify-center cursor-pointer"
                            aria-label="More"
                          >
                            ⋮
                          </button>
                          {activeMenuFileId === file.id && (
                            <div
                              onClick={e => e.stopPropagation()}
                              className="absolute right-0 top-9 z-30 w-40 bg-white border-[2.5px] border-[#111111] rounded-[12px] shadow-[3px_3px_0_#111111] py-1 px-1 flex flex-col text-xs font-heading font-bold"
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
                  );
                })}

                {isRealRoom && roomFiles.length === 0 && uploadQueue.length === 0 && (
                  <p className="text-xs text-neutral-500 text-center py-4">
                    No files in room yet.
                  </p>
                )}
              </div>

            </div>


            {/* CARD 3: Mint card "Good to know" */}
            <div className="bg-[#E6F9F0] border-[3px] border-[#111111] rounded-[24px] shadow-[6px_6px_0_#111111] p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/mascot-pizza.webp" alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                <div>
                  <h4 className="font-heading font-extrabold text-sm sm:text-base text-[#111111]">
                    Good to know
                  </h4>
                  <p className="font-body text-xs text-[#444444]">
                    Files stay available for 1 hour of inactivity or up to 6 hours total.
                  </p>
                </div>
              </div>

              {room?.isCreator && (
                <button
                  type="button"
                  onClick={handleEndRoom}
                  disabled={isEnding}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-white border-[2px] border-[#FD3F77] text-[#FD3F77] rounded-[14px] shadow-[2px_2px_0_#FD3F77] font-heading font-extrabold text-xs btn-pressable-sm cursor-pointer"
                >
                  <img src="/icon-trash.webp" alt="" className="w-3.5 h-3.5 object-contain" />
                  <span>{isEnding ? 'Ending...' : 'End room'}</span>
                </button>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
