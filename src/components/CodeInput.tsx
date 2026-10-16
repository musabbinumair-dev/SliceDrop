import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

interface CodeInputProps {
  onCodeSubmit: (code: string) => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export const CodeInput: React.FC<CodeInputProps> = ({
  onCodeSubmit,
  isLoading,
  errorMessage,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only accept numeric characters
    const cleanVal = value.replace(/\D/g, '');

    if (!cleanVal) {
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }

    // If user pasted or typed multiple digits
    if (cleanVal.length > 1) {
      handlePastedCode(cleanVal);
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanVal;
    setDigits(newDigits);

    // Auto-advance to next input
    if (index < 5 && cleanVal) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if code is now complete
    if (index === 5 && cleanVal) {
      const fullCode = newDigits.join('');
      if (fullCode.length === 6) {
        onCodeSubmit(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      const fullCode = digits.join('');
      if (fullCode.length === 6) {
        onCodeSubmit(fullCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    handlePastedCode(pasted);
  };

  const handlePastedCode = (text: string) => {
    const cleanNumbers = text.replace(/\D/g, '').slice(0, 6);
    if (!cleanNumbers) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < cleanNumbers.length; i++) {
      newDigits[i] = cleanNumbers[i];
    }
    setDigits(newDigits);

    if (cleanNumbers.length === 6) {
      inputRefs.current[5]?.focus();
      onCodeSubmit(cleanNumbers);
    } else {
      inputRefs.current[cleanNumbers.length]?.focus();
    }
  };

  const fullCode = digits.join('');
  const isComplete = fullCode.length === 6;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center gap-1.5 sm:gap-2 mb-3">
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
            onChange={e => handleChange(idx, e.target.value)}
            onKeyDown={e => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            disabled={isLoading}
            aria-label={`Digit ${idx + 1} of 6-digit room code`}
            className={`w-11 sm:w-13 h-14 text-center text-2xl font-bold rounded-xl border transition-all duration-150 focus:outline-none focus:ring-2 select-all ${
              digit
                ? 'border-blue-500 bg-blue-50/40 text-blue-900 shadow-sm'
                : 'border-slate-300 bg-white text-slate-800'
            } ${
              errorMessage
                ? 'border-rose-400 focus:ring-rose-400'
                : 'focus:border-blue-600 focus:ring-blue-500/20'
            } disabled:bg-slate-100 disabled:opacity-60`}
          />
        ))}
      </div>

      {errorMessage && (
        <div className="mb-3 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <button
        onClick={() => onCodeSubmit(fullCode)}
        disabled={!isComplete || isLoading}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Finding transfer room...</span>
          </>
        ) : (
          <>
            <span>Join Room & Download Files</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
};
