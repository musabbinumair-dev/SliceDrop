import React, { useState, useRef, useEffect } from 'react';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (code: string) => Promise<void>;
  isLoading?: boolean;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({
  isOpen,
  onClose,
  onJoinRoom,
  isLoading = false,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setError(null);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, val: string) => {
    setError(null);
    const clean = val.replace(/\D/g, '');

    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    if (clean.length > 1) {
      const pasted = clean.slice(0, 6);
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setCodeDigits(next);
      if (pasted.length === 6) {
        onJoinRoom(pasted).catch(() => setError('Room not found or expired.'));
      }
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const full = next.join('');
    if (full.length === 6) {
      onJoinRoom(full).catch(() => setError('Room not found or expired.'));
    }
  };

  const setCodeDigits = (next: string[]) => {
    setDigits(next);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      const full = digits.join('');
      if (full.length === 6) {
        onJoinRoom(full).catch(() => setError('Room not found or expired.'));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const full = digits.join('');
    if (full.length === 6) {
      onJoinRoom(full).catch(() => setError('Room not found or expired.'));
    } else {
      setError('Please enter all 6 digits.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-[#FDF7ED] border-[3px] border-[#111111] rounded-[24px] shadow-hard max-w-md w-full p-6 sm:p-7 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 bg-white border-[2.5px] border-[#111111] rounded-xl flex items-center justify-center shadow-hard-xs btn-pressable-sm cursor-pointer"
          title="Close"
          type="button"
        >
          <img src="/icon-close-x.webp" alt="Close" className="w-3.5 h-3.5 object-contain" />
        </button>

        {/* Title with Mascot */}
        <div className="flex items-center gap-3 mb-2">
          <img src="/mascot-pizza.webp" alt="" className="w-8 h-8 object-contain" />
          <h2 className="font-heading font-extrabold text-2xl text-[#111111]">
            Receive files
          </h2>
        </div>

        <p className="text-xs sm:text-sm font-semibold text-[#71717A] mb-5">
          Enter the 6-digit room code shown on the sender's device to open the room and download files.
        </p>

        <form onSubmit={handleSubmit}>
          {/* 6 Digit Inputs */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={el => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                className="w-11 h-14 bg-white border-[3px] border-[#111111] rounded-[14px] shadow-hard-xs text-center font-heading font-extrabold text-2xl text-[#111111] focus:bg-[#FED228]/20 focus:outline-none transition-colors"
                aria-label={`Digit ${idx + 1}`}
              />
            ))}
          </div>

          {error && (
            <p className="text-xs font-heading font-bold text-[#FD3F77] text-center mb-4">
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || digits.join('').length < 6}
            className={`w-full py-3.5 px-6 rounded-[18px] border-[3px] border-[#111111] font-heading font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-hard-btn btn-pressable cursor-pointer ${
              digits.join('').length === 6 && !isLoading
                ? 'bg-[#FED228] text-[#111111]'
                : 'bg-[#E4E4E7] text-[#71717A] cursor-not-allowed opacity-75'
            }`}
          >
            <img src="/icon-download-yellow-btn.webp" alt="" className="w-5 h-5 object-contain" />
            <span>{isLoading ? 'Joining room...' : 'Join Room & Download Files'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
