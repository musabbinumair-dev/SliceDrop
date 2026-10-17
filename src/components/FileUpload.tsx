import React, { useState, useRef } from 'react';
import { UploadCloud, File, Loader2, Plus } from 'lucide-react';
import { StatusChip } from './StatusChip.tsx';
import { FileTypeIcon } from './FileTypeIcon.tsx';

interface FileUploadProps {
  roomId: string;
  creatorToken?: string;
  maxFileSizeMb: number;
  onUploadSuccess: () => void;
}

interface UploadProgressItem {
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  roomId,
  creatorToken,
  maxFileSizeMb,
  onUploadSuccess,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadProgressItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const maxBytes = maxFileSizeMb * 1024 * 1024;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);

    // Initial validation
    for (const file of fileList) {
      if (file.size > maxBytes) {
        alert(
          `"${file.name}" is ${Math.round(file.size / (1024 * 1024))} MB. Maximum allowed size is ${maxFileSizeMb} MB.`
        );
        return;
      }
    }

    setIsProcessing(true);

    // Add files to progress queue
    const newItems: UploadProgressItem[] = fileList.map(f => ({
      name: f.name,
      size: f.size,
      progress: 0,
      status: 'uploading',
    }));

    setUploadQueue(prev => [...prev, ...newItems]);

    // Process files sequentially to ensure smooth progress and network reliability
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      await uploadSingleFile(file);
    }

    setIsProcessing(false);
    onUploadSuccess();

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadSingleFile = (file: File): Promise<void> => {
    return new Promise(resolve => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', `/api/rooms/${roomId}/upload`);

      if (creatorToken) {
        xhr.setRequestHeader('x-creator-token', creatorToken);
      }

      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          updateQueueItem(file.name, {
            progress: percentComplete,
            status: 'uploading',
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          updateQueueItem(file.name, {
            progress: 100,
            status: 'completed',
          });
          resolve();
        } else {
          let errorMsg = 'Upload failed';
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.error) errorMsg = res.error;
          } catch {}
          updateQueueItem(file.name, {
            status: 'error',
            errorMessage: errorMsg,
          });
          resolve();
        }
      };

      xhr.onerror = () => {
        updateQueueItem(file.name, {
          status: 'error',
          errorMessage: 'Network error during upload',
        });
        resolve();
      };

      xhr.send(formData);
    });
  };

  const updateQueueItem = (fileName: string, updates: Partial<UploadProgressItem>) => {
    setUploadQueue(prev =>
      prev.map(item => (item.name === fileName ? { ...item, ...updates } : item))
    );
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={e => handleFiles(e.target.files)}
        className="hidden"
        id="quickdrop-file-picker"
      />

      {/* Drag & Drop Zone */}
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
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-800 text-base mb-1">
          Drop files here or click to browse
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mb-3">
          Supports any file type (PDF, ZIP, photos, video, audio) up to {maxFileSizeMb} MB per file
        </p>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-medium text-xs rounded-xl shadow-xs transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Choose Files from Device
        </button>
      </div>

      {/* Active Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
            <span>Upload Queue ({uploadQueue.filter(q => q.status === 'completed').length}/{uploadQueue.length} finished)</span>
            {isProcessing && (
              <span className="flex items-center gap-1 text-blue-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                Transferring...
              </span>
            )}
          </div>

          {uploadQueue.slice(-4).map((item, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-[12px]">
                  <FileTypeIcon filename={item.name} size="mobile" />
                  <span className="font-medium text-slate-800 truncate">{item.name}</span>
                  <span className="text-slate-400 shrink-0">({formatSize(item.size)})</span>
                </div>

                <div className="w-[124px] shrink-0 flex items-center justify-center">
                  {item.status === 'completed' && (
                    <StatusChip variant="uploaded" label="Uploaded" size="mobile" />
                  )}
                  {item.status === 'uploading' && (
                    <StatusChip variant="uploading" progress={item.progress} size="mobile" />
                  )}
                  {item.status === 'error' && (
                    <StatusChip variant="declined" label="Failed" size="mobile" title={item.errorMessage} />
                  )}
                </div>
              </div>

              {item.errorMessage && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{item.errorMessage}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
