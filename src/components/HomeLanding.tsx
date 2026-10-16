import React, { useState, useRef } from 'react';
import { Logo } from './Logo.tsx';

interface HomeLandingProps {
  onStartSharing: () => void;
  onReceiveFiles: () => void;
  onJoinRoom: (code: string) => void;
  onFileSelect: (files: FileList | null) => void;
  maxFileSizeMb?: number;
}

export const HomeLanding: React.FC<HomeLandingProps> = ({
  onStartSharing,
  onReceiveFiles,
  onJoinRoom,
  onFileSelect,
  maxFileSizeMb = 100,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      const next = [...codeDigits];
      next[index] = '';
      setCodeDigits(next);
      return;
    }

    if (clean.length > 1) {
      const pasted = clean.slice(0, 6);
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setCodeDigits(next);
      if (pasted.length === 6) {
        onJoinRoom(pasted);
      }
      return;
    }

    const next = [...codeDigits];
    next[index] = clean;
    setCodeDigits(next);

    if (index < 5 && clean) {
      digitInputRefs.current[index + 1]?.focus();
    }

    const full = next.join('');
    if (full.length === 6) {
      onJoinRoom(full);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      const full = codeDigits.join('');
      if (full.length === 6) {
        onJoinRoom(full);
      }
    }
  };

  const handleJoinClick = () => {
    const full = codeDigits.join('');
    if (full.length === 6) {
      onJoinRoom(full);
    } else {
      const emptyIdx = codeDigits.findIndex(d => !d);
      if (emptyIdx !== -1) {
        digitInputRefs.current[emptyIdx]?.focus();
      }
    }
  };

  const scrollToCode = () => {
    const firstEmpty = codeDigits.findIndex(d => !d);
    digitInputRefs.current[firstEmpty !== -1 ? firstEmpty : 0]?.focus();
  };

  return (
    <div className="w-full relative min-h-screen bg-[#FDF7ED] text-[#111111] overflow-x-hidden selection:bg-[#FED228] selection:text-[#111111] flex flex-col justify-between">
      {/* Corner Bleed Blobs (matches mockup exactly) */}
      <img
        src="/blob-yellow-top-right.webp"
        alt=""
        className="absolute top-0 right-0 w-[200px] sm:w-[260px] md:w-[320px] lg:w-[360px] pointer-events-none select-none z-0 object-contain"
      />
      <img
        src="/blob-pink-bottom-left.webp"
        alt=""
        className="absolute bottom-0 left-0 w-[180px] sm:w-[240px] md:w-[290px] lg:w-[330px] pointer-events-none select-none z-0 object-contain"
      />

      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={e => onFileSelect(e.target.files)}
        className="hidden"
        id="landing-native-picker"
        data-testid="landing-native-picker"
      />

      {/* Main Max-Width Container */}
      <div className="relative z-10 w-full max-w-[1120px] mx-auto px-4 sm:px-6 md:px-8 flex-1 flex flex-col justify-between">
        {/* ================= 1. NAVBAR ================= */}
        <header className="w-full pt-4 sm:pt-6 md:pt-8 pb-3 sm:pb-4 flex items-center justify-between">
          {/* Left: Reusable Logo component */}
          <Logo onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />



          {/* Right: "Start sharing" yellow button */}
          <button
            onClick={onStartSharing}
            className="bg-[#FED228] text-[#111111] border-[3px] border-[#111111] rounded-[16px] px-5 sm:px-6 md:px-7 py-2 sm:py-2.5 font-heading font-extrabold text-sm sm:text-base md:text-lg shadow-hard-btn btn-pressable cursor-pointer select-none"
          >
            Start sharing
          </button>
        </header>

        {/* ================= 2. HERO SECTION ================= */}
        <section className="pt-3 sm:pt-6 md:pt-8 pb-6 sm:pb-8 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-4 lg:gap-6 items-center">
          {/* Left Block */}
          <div className="md:col-span-7 flex flex-col items-start text-left">
            {/* Pill "No account needed" */}
            <div className="inline-block bg-[#FED228] border-[3px] border-[#111111] rounded-full px-4 sm:px-5 py-1 sm:py-1.5 shadow-[3.5px_3.5px_0_#111111] mb-3 sm:mb-4 select-none">
              <span className="font-heading font-extrabold text-xs sm:text-sm text-[#111111]">
                No account needed
              </span>
            </div>

            {/* Two-Line Headline */}
            <h1 className="font-heading font-extrabold text-[44px] sm:text-[56px] md:text-[66px] lg:text-[78px] xl:text-[84px] text-[#111111] leading-[0.95] tracking-tight select-none">
              <span className="inline-flex items-center whitespace-nowrap">
                <span>Send a slice.</span>
                <img
                  src="/sparkle-pink-dashes.webp"
                  alt=""
                  className="w-6 sm:w-8 md:w-10 lg:w-11 ml-2 sm:ml-2.5 inline-block object-contain"
                />
              </span>
              <br />
              <span>Share a file.</span>
            </h1>

            {/* Gray Subtitle */}
            <p className="mt-2.5 sm:mt-3 text-[#555555] font-semibold text-sm sm:text-base md:text-lg max-w-lg leading-snug">
              Drop files, grab a 6-digit code, and pick them up on any device.
            </p>

            {/* Two Buttons: Send files & Receive files */}
            <div className="mt-5 sm:mt-6 flex flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  } else {
                    onStartSharing();
                  }
                }}
                className="flex-1 sm:flex-initial bg-[#FED228] text-[#111111] border-[3px] border-[#111111] rounded-[16px] px-5 sm:px-7 md:px-8 lg:px-9 py-3 sm:py-3.5 font-heading font-extrabold text-base sm:text-lg md:text-xl shadow-[5px_5px_0_#111111] btn-pressable cursor-pointer select-none text-center whitespace-nowrap"
              >
                Send files
              </button>

              <button
                type="button"
                onClick={() => {
                  scrollToCode();
                  onReceiveFiles();
                }}
                className="flex-1 sm:flex-initial bg-white text-[#111111] border-[3px] border-[#111111] rounded-[16px] px-5 sm:px-7 md:px-8 lg:px-9 py-3 sm:py-3.5 font-heading font-extrabold text-base sm:text-lg md:text-xl shadow-[5px_5px_0_#111111] btn-pressable cursor-pointer select-none text-center whitespace-nowrap"
              >
                Receive files
              </button>
            </div>

            {/* Sub-button text */}
            <div className="mt-2.5 text-xs sm:text-sm font-semibold text-[#555555] w-full text-center sm:text-left select-none">
              Free - up to {maxFileSizeMb} MB per file - auto-deletes in 1 hour
            </div>
          </div>

          {/* Right Block: Mascot sitting on pink blob */}
          <div className="md:col-span-5 flex items-center justify-center relative select-none">
            <div className="relative w-[260px] sm:w-[290px] md:w-[320px] lg:w-[350px] h-[260px] sm:h-[290px] md:h-[320px] lg:h-[350px] flex items-center justify-center">
              {/* hero-blob-pink.webp */}
              <img
                src="/hero-blob-pink.webp"
                alt=""
                className="w-[250px] sm:w-[280px] md:w-[305px] lg:w-[330px] h-auto object-contain absolute z-10"
              />

              {/* mascot-pizza.webp on top */}
              <img
                src="/mascot-pizza.webp"
                alt="SliceDrop Smiling Mascot"
                className="w-[230px] sm:w-[260px] md:w-[285px] lg:w-[310px] h-auto object-contain absolute z-20 top-[22px] sm:top-[28px] md:top-[32px]"
              />

              {/* sparkle-black-rays.webp at top-right of mascot */}
              <img
                src="/sparkle-black-rays.webp"
                alt=""
                className="w-8 sm:w-10 md:w-11 h-auto object-contain absolute z-30 -top-1 right-3 sm:top-1 sm:right-4 pointer-events-none"
              />
            </div>
          </div>
        </section>

        {/* ================= 3. HAVE A CODE? CARD ================= */}
        <section className="mb-6 sm:mb-8 md:mb-10">
          <div className="bg-white border-[3px] border-[#111111] rounded-[20px] p-3 sm:p-4 lg:p-6 shadow-[6px_6px_0_#111111] flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-3 lg:gap-6">
            {/* Left title */}
            <h2 className="font-heading font-extrabold text-lg sm:text-xl md:text-2xl lg:text-3xl text-[#111111] tracking-tight shrink-0 select-none">
              Have a code?
            </h2>

            {/* Center: Six code boxes in one row (stays 1 row on tablet and desktop) */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2 lg:gap-3 shrink-0">
              {codeDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => {
                    digitInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigitChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  aria-label={`Digit ${idx + 1}`}
                  className="w-7 sm:w-8 md:w-9 lg:w-12 h-9 sm:h-10 md:h-11 lg:h-14 bg-white border-[2.5px] lg:border-[3px] border-[#111111] rounded-[8px] sm:rounded-[10px] lg:rounded-[14px] text-center font-heading font-extrabold text-base sm:text-lg md:text-xl lg:text-3xl text-[#111111] focus:outline-none focus:bg-[#FED228]/20 select-all shrink-0"
                />
              ))}
            </div>

            {/* Right: Join room button */}
            <button
              onClick={handleJoinClick}
              className="w-full md:w-auto bg-[#FED228] text-[#111111] border-[2.5px] lg:border-[3px] border-[#111111] rounded-[12px] lg:rounded-[14px] px-4 sm:px-5 md:px-5 lg:px-8 py-2 sm:py-2.5 lg:py-3 font-heading font-extrabold text-xs sm:text-sm md:text-base lg:text-xl shadow-[3.5px_3.5px_0_#111111] lg:shadow-[4px_4px_0_#111111] btn-pressable cursor-pointer select-none text-center shrink-0 whitespace-nowrap"
            >
              Join room
            </button>
          </div>
        </section>

        {/* ================= 4. HOW IT WORKS SECTION ================= */}
        <section id="how-it-works" className="mb-8 sm:mb-10 md:mb-12">
          {/* Left-aligned title matching mockup */}
          <h2 className="font-heading font-extrabold text-[32px] sm:text-[38px] md:text-[42px] text-[#111111] tracking-tight mb-6 sm:mb-8 select-none">
            How it works
          </h2>

          {/* Three steps row with plain CSS dotted arrows */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-6 md:gap-3 lg:gap-4 items-center">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <img
                src="/step-1-slice.webp"
                alt="1. Drop files"
                className="w-[100px] sm:w-[115px] md:w-[125px] h-[100px] sm:h-[115px] md:h-[125px] object-contain select-none"
              />
              <h3 className="font-heading font-extrabold text-lg sm:text-xl md:text-2xl text-[#111111] mt-3 sm:mt-4">
                1. Drop files
              </h3>
              <p className="mt-1 text-xs sm:text-sm md:text-base font-medium text-[#555555]">
                Upload your files in seconds.
              </p>
            </div>

            {/* Dotted Arrow 1 */}
            <div className="hidden md:flex items-center text-[#555555] font-extrabold tracking-[4px] md:tracking-[5px] text-lg md:text-xl select-none px-1 md:px-2">
              ······&gt;
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <img
                src="/step-2-box.webp"
                alt="2. Share your code"
                className="w-[100px] sm:w-[115px] md:w-[125px] h-[100px] sm:h-[115px] md:h-[125px] object-contain select-none"
              />
              <h3 className="font-heading font-extrabold text-lg sm:text-xl md:text-2xl text-[#111111] mt-3 sm:mt-4">
                2. Share your code
              </h3>
              <p className="mt-1 text-xs sm:text-sm md:text-base font-medium text-[#555555]">
                Get a code, link or QR code.
              </p>
            </div>

            {/* Dotted Arrow 2 */}
            <div className="hidden md:flex items-center text-[#555555] font-extrabold tracking-[4px] md:tracking-[5px] text-lg md:text-xl select-none px-1 md:px-2">
              ······&gt;
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <img
                src="/step-3-globe.webp"
                alt="3. Pick up anywhere"
                className="w-[100px] sm:w-[115px] md:w-[125px] h-[100px] sm:h-[115px] md:h-[125px] object-contain select-none"
              />
              <h3 className="font-heading font-extrabold text-lg sm:text-xl md:text-2xl text-[#111111] mt-3 sm:mt-4">
                3. Pick up anywhere
              </h3>
              <p className="mt-1 text-xs sm:text-sm md:text-base font-medium text-[#555555]">
                Open on any device and download.
              </p>
            </div>
          </div>
        </section>

        {/* Divider line before footer */}
        <div className="w-full h-[1px] bg-[#D4D4D8] mb-4 sm:mb-6" />

        {/* ================= 5. FOOTER ================= */}
        <footer className="pb-6 sm:pb-8 flex items-center justify-between gap-4">
          {/* Left: Logo */}
          <Logo onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

          {/* Right: Made with 💗 by Musab.dev */}
          <div className="text-xs sm:text-sm md:text-base font-bold text-[#111111] select-none">
            Made with 💗 by Musab.dev
          </div>
        </footer>
      </div>
    </div>
  );
};
