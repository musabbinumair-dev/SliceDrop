import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { HomeLanding } from './components/HomeLanding.tsx';
import { RoomView, RoomData, UploadQueueItem } from './components/RoomView.tsx';
import { ReceiveModal } from './components/ReceiveModal.tsx';
import { ArchitectureModal } from './components/ArchitectureModal.tsx';
import { FileItem } from './components/FileList.tsx';

interface SystemInfo {
  maxFileSizeMb: number;
  inactivityTimeoutMinutes: number;
  maxLifetimeHours: number;
  storage: {
    name: string;
    isCloudStorage: boolean;
    bucket?: string;
    description: string;
  };
}

const initialDemoRoom: RoomData = {
  id: 'demo-room-init',
  code: '945165',
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
  expiresInSeconds: 3590,
  status: 'active',
  isCreator: true,
  files: [
    {
      id: 'demo-f-1',
      originalFilename: 'lecture-notes.pdf',
      sizeBytes: 2.4 * 1024 * 1024,
      mimeType: 'application/pdf',
      createdAt: Date.now() - 1000 * 60 * 5,
    },
    {
      id: 'demo-f-2',
      originalFilename: 'design-assets.zip',
      sizeBytes: 18.0 * 1024 * 1024,
      mimeType: 'application/zip',
      createdAt: Date.now() - 1000 * 60 * 12,
    },
  ],
};

export default function App() {
  const [currentView, setCurrentView] = useState<'room' | 'home'>('home');
  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [creatorTokens, setCreatorTokens] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem('quickdrop_tokens');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isJoiningCode, setIsJoiningCode] = useState(false);

  // Fetch system & storage configuration
  useEffect(() => {
    fetch('/api/system/info')
      .then(res => res.json())
      .then(data => setSystemInfo(data))
      .catch(err => console.error('Failed to load system info:', err));
  }, []);

  const saveCreatorToken = (roomId: string, token: string) => {
    setCreatorTokens(prev => {
      const next = { ...prev, [roomId]: token };
      try {
        sessionStorage.setItem('quickdrop_tokens', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Create a new real backend room, optionally uploading pre-staged files
  const createNewRoom = useCallback(async (stagedFiles?: File[]): Promise<RoomData | null> => {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        saveCreatorToken(data.room.id, data.creatorToken);
        data.room.isCreator = true;
        setCurrentRoom(data.room);

        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.set('room', data.room.code);
        window.history.pushState({}, '', url.toString());

        // If there are staged files, upload them now
        if (stagedFiles && stagedFiles.length > 0) {
          await uploadFilesToRoom(data.room, stagedFiles, data.creatorToken);
        }

        return data.room;
      }
    } catch (err) {
      console.error('Failed to create room:', err);
    }
    return null;
  }, [creatorTokens]);

  const uploadFilesToRoom = async (targetRoom: RoomData, fileList: File[], token?: string) => {
    const maxBytes = (systemInfo?.maxFileSizeMb || 100) * 1024 * 1024;
    for (const f of fileList) {
      if (f.size > maxBytes) {
        alert(
          `"${f.name}" is ${Math.round(f.size / (1024 * 1024))} MB. Maximum allowed size is ${
            systemInfo?.maxFileSizeMb || 100
          } MB.`
        );
        return;
      }
    }

    setIsUploading(true);
    setCurrentView('room');

    const newQueueItems: UploadQueueItem[] = fileList.map(f => ({
      name: f.name,
      size: f.size,
      progress: 0,
      status: 'uploading',
    }));

    setUploadQueue(prev => [...prev, ...newQueueItems]);

    const activeToken = token || creatorTokens[targetRoom.id];

    for (const file of fileList) {
      await new Promise<void>(resolve => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.open('POST', `/api/rooms/${targetRoom.id}/upload`);
        if (activeToken) {
          xhr.setRequestHeader('x-creator-token', activeToken);
        }

        xhr.upload.onprogress = event => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setUploadQueue(prev =>
              prev.map(q => (q.name === file.name ? { ...q, progress: pct } : q))
            );
          }
        };

        xhr.onload = () => {
          setUploadQueue(prev =>
            prev.map(q => (q.name === file.name ? { ...q, progress: 100, status: 'completed' } : q))
          );
          resolve();
        };

        xhr.onerror = () => {
          setUploadQueue(prev =>
            prev.map(q => (q.name === file.name ? { ...q, status: 'error' } : q))
          );
          resolve();
        };

        xhr.send(formData);
      });
    }

    // Refresh files in target room
    try {
      const res = await fetch(`/api/rooms/${targetRoom.id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentRoom(data.room);
      }
    } catch {}

    setIsUploading(false);
  };

  // Join a room by 6-digit code
  const handleJoinByCode = useCallback(async (code: string) => {
    if (!/^\d{6}$/.test(code)) return;
    setIsJoiningCode(true);

    try {
      const res = await fetch(`/api/rooms/by-code/${code}`);
      const data = await res.json();

      if (res.ok) {
        const savedToken = creatorTokens[data.room.id];
        if (savedToken) {
          data.room.isCreator = true;
        }
        setCurrentRoom(data.room);
        setCurrentView('room');
        setIsReceiveModalOpen(false);

        const url = new URL(window.location.href);
        url.searchParams.set('room', data.room.code);
        window.history.pushState({}, '', url.toString());
      } else {
        alert(data.error || 'Could not find that room.');
      }
    } catch (err) {
      console.error('Join room error:', err);
      alert('Network error while joining room.');
    } finally {
      setIsJoiningCode(false);
    }
  }, [creatorTokens]);

  // Handle URL query parameters on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const viewParam = params.get('view');

    if (roomParam && /^\d{6}$/.test(roomParam)) {
      handleJoinByCode(roomParam);
    } else if (viewParam === 'room') {
      setCurrentView('room');
      if (!currentRoom) {
        createNewRoom();
      }
    }
  }, [handleJoinByCode, createNewRoom]);

  // Refresh room periodically (every 3.5s) to get newly uploaded files
  const refreshRoom = useCallback(async () => {
    if (!currentRoom || currentRoom.id.startsWith('demo-room-init')) return;
    try {
      const token = creatorTokens[currentRoom.id];
      const res = await fetch(`/api/rooms/${currentRoom.id}`, {
        headers: token ? { 'x-creator-token': token } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentRoom(prev => (prev ? { ...prev, files: data.room.files } : null));
      }
    } catch (err) {
      console.warn('Background refresh error:', err);
    }
  }, [currentRoom?.id, creatorTokens]);

  useEffect(() => {
    if (!currentRoom || currentRoom.id.startsWith('demo-room-init')) return;
    const interval = setInterval(refreshRoom, 3500);
    return () => clearInterval(interval);
  }, [currentRoom?.id, refreshRoom]);

  // Handle file uploads when room already exists
  const handleFileUpload = async (files: FileList | File[]) => {
    const fileList = Array.isArray(files) ? files : Array.from(files);
    if (fileList.length === 0) return;

    let targetRoom = currentRoom;
    if (!targetRoom || targetRoom.id.startsWith('demo-room-init')) {
      targetRoom = await createNewRoom(fileList);
      return;
    }

    await uploadFilesToRoom(targetRoom, fileList);
  };

  // Download a file
  const handleDownloadFile = (file: FileItem) => {
    if (file.id.startsWith('demo-')) {
      const blob = new Blob([`Sample content for ${file.originalFilename} via SliceDrop`], {
        type: file.mimeType || 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.originalFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    const link = document.createElement('a');
    link.href = `/api/files/${file.id}/download`;
    link.setAttribute('download', file.originalFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGoHome = () => {
    setCurrentView('home');
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('view');
    window.history.pushState({}, '', url.toString());
  };

  const activeRoomData = currentRoom || initialDemoRoom;

  const getShareUrl = () => {
    return `${window.location.origin}/?room=${activeRoomData.code}`;
  };

  return (
    <div className="min-h-screen bg-[#FDF7ED] text-[#111111] flex flex-col font-sans selection:bg-[#FED228] selection:text-[#111111] relative overflow-x-clip">
      {/* Universal Header (shown in room / transfer mode) */}
      {currentView === 'room' && (
        <Header
          activeTab="send"
          onTabChange={tab => {
            if (tab === 'receive') {
              setIsReceiveModalOpen(true);
            } else {
              setCurrentView('room');
            }
          }}
          onGoHome={handleGoHome}
          onOpenArchitecture={() => setIsArchitectureOpen(true)}
        />
      )}

      {/* Main View Router: Room View or Home Landing Page */}
      <main className="flex-1">
        {currentView === 'room' ? (
          <RoomView
            room={currentRoom}
            creatorToken={currentRoom ? creatorTokens[currentRoom.id] : undefined}
            shareUrl={getShareUrl()}
            maxFileSizeMb={systemInfo?.maxFileSizeMb || 100}
            onLeaveRoom={handleGoHome}
            onRoomEnded={() => {
              setCurrentRoom(null);
            }}
            onRefreshRoom={refreshRoom}
            onFileUpload={handleFileUpload}
            onDownloadFile={handleDownloadFile}
            isUploading={isUploading}
            uploadQueue={uploadQueue}
            onCreateNewRoom={async (stagedFiles?: File[]) => {
              const room = await createNewRoom(stagedFiles);
              return room;
            }}
          />
        ) : (
          <HomeLanding
            onStartSharing={() => {
              setCurrentView('room');
            }}
            onReceiveFiles={() => setIsReceiveModalOpen(true)}
            onJoinRoom={handleJoinByCode}
            onFileSelect={async (files) => {
              if (files) {
                setCurrentView('room');
                await handleFileUpload(files);
              }
            }}
            maxFileSizeMb={systemInfo?.maxFileSizeMb || 100}
          />
        )}
      </main>

      {/* Receive Files Modal */}
      <ReceiveModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        onJoinRoom={handleJoinByCode}
        isLoading={isJoiningCode}
      />

      {/* Architecture & Specs Modal */}
      <ArchitectureModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
        storageInfo={
          systemInfo
            ? {
                name: systemInfo.storage.name,
                isCloudStorage: systemInfo.storage.isCloudStorage,
                bucket: systemInfo.storage.bucket,
                description: systemInfo.storage.description,
                maxFileSizeMb: systemInfo.maxFileSizeMb,
                inactivityTimeoutMinutes: systemInfo.inactivityTimeoutMinutes,
                maxLifetimeHours: systemInfo.maxLifetimeHours,
              }
            : null
        }
      />
    </div>
  );
}
