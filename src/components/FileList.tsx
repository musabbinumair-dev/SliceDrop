import React, { useState } from 'react';

export interface FileItem {
  id: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: number;
  sha256?: string;
}

interface FileListProps {
  files: FileItem[];
  isCreator?: boolean;
  onDeleteFile?: (fileId: string) => void;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  isCreator,
  onDeleteFile,
}) => {
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadAllProgress, setDownloadAllProgress] = useState(false);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = (file: FileItem) => {
    setDownloadingIds(prev => new Set(prev).add(file.id));

    const link = document.createElement('a');
    link.href = `/api/files/${file.id}/download`;
    link.setAttribute('download', file.originalFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }, 1500);
  };

  const handleDownloadAll = async () => {
    if (files.length === 0 || downloadAllProgress) return;
    setDownloadAllProgress(true);

    for (let i = 0; i < files.length; i++) {
      handleDownload(files[i]);
      await new Promise(r => setTimeout(r, 600));
    }

    setDownloadAllProgress(false);
  };

  const copyHash = (fileId: string, hash?: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHashId(fileId);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  if (files.length === 0) {
    return (
      <div>
        <h4>No files shared in this room yet</h4>
        <p>Files uploaded by either device will appear here in real time.</p>
      </div>
    );
  }

  return (
    <div>
      <div>
        <div>
          <h3>Files in Room ({files.length})</h3>
          <span>Total: {formatSize(files.reduce((acc, f) => acc + f.sizeBytes, 0))}</span>
        </div>

        {files.length > 1 && (
          <button
            onClick={handleDownloadAll}
            disabled={downloadAllProgress}
            type="button"
          >
            {downloadAllProgress ? 'Downloading...' : `Download All (${files.length})`}
          </button>
        )}
      </div>

      <div>
        {files.map(file => {
          const isDownloading = downloadingIds.has(file.id);

          return (
            <div key={file.id}>
              <div>
                <div>
                  <p title={file.originalFilename}>{file.originalFilename}</p>
                  <div>
                    <span>{formatSize(file.sizeBytes)}</span>
                    <span>•</span>
                    <span>
                      {new Date(file.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {file.sha256 && (
                      <>
                        <span>•</span>
                        <button
                          onClick={() => copyHash(file.id, file.sha256)}
                          title={`SHA-256: ${file.sha256}\nClick to copy hash`}
                          type="button"
                        >
                          <span>{copiedHashId === file.id ? 'Copied SHA' : 'Verified'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={() => handleDownload(file)}
                  disabled={isDownloading}
                  aria-label={`Download ${file.originalFilename}`}
                  type="button"
                >
                  {isDownloading ? 'Saved' : 'Download'}
                </button>

                {isCreator && onDeleteFile && (
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${file.originalFilename}" from this room?`)) {
                        onDeleteFile(file.id);
                      }
                    }}
                    title="Remove file"
                    aria-label={`Delete ${file.originalFilename}`}
                    type="button"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
