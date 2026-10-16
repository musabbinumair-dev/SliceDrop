import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Smartphone, ExternalLink } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  code: string;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  url,
  code,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (url && isOpen) {
      QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then(data => setQrDataUrl(data))
        .catch(err => console.error('QR generation error:', err));
    }
  }, [url, isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          aria-label="Close QR Modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-2">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Scan to Open Room</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Point your mobile camera at this QR code to join this room instantly.
          </p>

          {/* QR Code Container */}
          <div className="my-5 p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QuickDrop QR code for room ${code}`}
                className="w-56 h-56 mx-auto rounded-lg"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                Generating QR code...
              </div>
            )}
          </div>

          {/* Room Code Badge */}
          <div className="bg-slate-100 rounded-xl p-3 mb-4 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                6-Digit Room Code
              </span>
              <span className="text-xl font-mono font-bold tracking-widest text-slate-900">
                {code}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Copy Direct Link */}
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Direct Room Link'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
