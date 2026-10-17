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
  const mobileFileInputRef = useRef<HTMLInputElement | null>(null);
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const mobileDigitInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const mobileCodeCardRef = useRef<HTMLDivElement | null>(null);
  const [activeBoxIndex, setActiveBoxIndex] = useState<number | null>(null);

  const handleDigitChange = (index: number, val: string, isMobileMode: boolean = false) => {
    const clean = val.replace(/\D/g, '');
    const refs = isMobileMode ? mobileDigitInputRefs : digitInputRefs;

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
      refs.current[index + 1]?.focus();
    }

    const full = next.join('');
    if (full.length === 6) {
      onJoinRoom(full);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, isMobileMode: boolean = false) => {
    const refs = isMobileMode ? mobileDigitInputRefs : digitInputRefs;
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      refs.current[index - 1]?.focus();
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

  const handleMobileJoinClick = () => {
    const full = codeDigits.join('');
    if (full.length === 6) {
      onJoinRoom(full);
    } else {
      const emptyIdx = codeDigits.findIndex(d => !d);
      if (emptyIdx !== -1) {
        mobileDigitInputRefs.current[emptyIdx]?.focus();
      }
    }
  };

  const scrollToCode = () => {
    const firstEmpty = codeDigits.findIndex(d => !d);
    digitInputRefs.current[firstEmpty !== -1 ? firstEmpty : 0]?.focus();
  };

  const scrollToMobileCode = () => {
    mobileCodeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const firstEmpty = codeDigits.findIndex(d => !d);
    const targetIdx = firstEmpty !== -1 ? firstEmpty : 0;
    setTimeout(() => {
      mobileDigitInputRefs.current[targetIdx]?.focus();
    }, 250);
  };

  const handleMobileSendFiles = () => {
    if (mobileFileInputRef.current) {
      mobileFileInputRef.current.click();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      onStartSharing();
    }
  };

  return (
    <>
      {/* ========================================================
          MOBILE HOMEPAGE (Render below 768px only)
          Exact clone of the two target images (Image 1 top, Image 2 bottom)
      ======================================================== */}
      <div className="block md:hidden w-full min-h-screen bg-[#FDF7ED] text-[#0A1020] relative overflow-x-hidden selection:bg-[#FED228] selection:text-[#111111]">
        {/* Yellow blob pinned to top-right corner, ~190px wide, bleeding off top and right edges, behind top bar */}
        <img
          src="/blob-yellow-top-right.webp"
          alt=""
          width="190"
          height="190"
          className="absolute -top-[10px] -right-[15px] w-[190px] pointer-events-none select-none z-0 object-contain"
        />

        {/* Pink blob pinned to bottom-left corner of the page end, ~110px wide, bleeding off left and bottom edges, behind footer */}
        <img
          src="/blob-pink-bottom-left.webp"
          alt=""
          width="110"
          height="110"
          className="absolute bottom-0 -left-[10px] w-[110px] pointer-events-none select-none z-0 object-contain"
        />

        {/* Hidden Native File Input for Mobile */}
        <input
          ref={mobileFileInputRef}
          type="file"
          multiple
          onChange={e => onFileSelect(e.target.files)}
          className="hidden"
          id="mobile-landing-native-picker"
          data-testid="mobile-landing-native-picker"
        />

        {/* 1. TOP BAR (height ~72px, 20px edge margins) */}
        <header className="w-full h-[72px] px-[20px] flex items-center justify-between relative z-20 shrink-0">
          {/* Logo on the left at 20px: icon ~43px wide, wordmark ~135px wide (27px high) */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="cursor-pointer focus:outline-none flex items-center shrink-0"
            aria-label="SliceDrop logo"
          >
            <img
              src="/new-brand-logo.png"
              alt="SliceDrop"
              className="h-[38px] w-auto object-contain select-none"
            />
          </button>

          {/* Yellow "Start sharing" button on the right at 20px: 107px x 35px, border 2px #111, radius 12px, shadow 2px 3px 0 #111, text 14px/800 */}
          <button
            type="button"
            onClick={onStartSharing}
            className="w-[107px] h-[35px] bg-[#FED228] border-[2px] border-[#111111] rounded-[12px] shadow-[2px_3px_0_#111111] font-['Poppins',sans-serif] font-[800] text-[14px] text-[#0A1020] flex items-center justify-center leading-none cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_2px_0_#111111] transition-all select-none shrink-0"
          >
            Start sharing
          </button>
        </header>

        {/* Main Content Container: 24px side margins everywhere on a 390px viewport (342px content width) */}
        <div className="w-full max-w-[430px] mx-auto px-[24px] relative z-10 flex flex-col items-start text-left">
          {/* 2. HERO (left-aligned, 24px margins) */}
          {/* 20px under the top bar: yellow pill "No account needed", 163px x 35px, border 2px, fully rounded, shadow 2px 3px 0 #111, text 14px/800 */}
          <div className="mt-[20px] w-[163px] h-[35px] bg-[#FED228] border-[2px] border-[#111111] rounded-full shadow-[2px_3px_0_#111111] flex items-center justify-center select-none">
            <span className="font-['Poppins',sans-serif] font-[800] text-[14px] text-[#0A1020] leading-none whitespace-nowrap">
              No account needed
            </span>
          </div>

          {/* 26px below the pill: headline in two lines "Send a slice." / "Share a file.", 44px, weight 800, line-height 1.17, letter-spacing -0.045em, color #0A1020 */}
          <h1 className="mt-[26px] font-['Poppins',sans-serif] font-[800] text-[44px] leading-[1.17] tracking-[-0.045em] text-[#0A1020] select-none text-left">
            <span className="inline-flex items-start whitespace-nowrap">
              <span>Send a slice.</span>
              {/* Pink sparkle dashes (sparkle-pink-dashes.webp ~30px wide), 10px gap, aligned to top of line */}
              <img
                src="/sparkle-pink-dashes.webp"
                alt=""
                width="30"
                height="38"
                className="w-[30px] h-auto object-contain ml-[10px] select-none pointer-events-none self-start inline-block"
              />
            </span>
            <br />
            <span className="whitespace-nowrap">Share a file.</span>
          </h1>

          {/* 14px below the headline: subtitle 16px, line-height 1.3, #55657A, wrapping as specified */}
          <p className="mt-[14px] font-['Plus_Jakarta_Sans',sans-serif] font-[500] text-[16px] leading-[1.3] text-[#55657A] text-left select-none">
            Drop files, grab a 6-digit code, and pick them up<br />
            on any device.
          </p>

          {/* 3. BUTTONS (24px below subtitle, full width 342px, stacked, 14px gap) */}
          <div className="mt-[24px] w-full flex flex-col gap-[14px]">
            {/* "Send files": yellow, 50px high, border 2px #111, radius 14px, shadow 3px 4px 0 #111, upload icon + 12px gap + "Send files" 17px/800 */}
            <button
              type="button"
              onClick={handleMobileSendFiles}
              className="w-full h-[50px] bg-[#FED228] border-[2px] border-[#111111] rounded-[14px] shadow-[3px_4px_0_#111111] flex items-center justify-center gap-[12px] font-['Poppins',sans-serif] font-[800] text-[17px] text-[#0A1020] cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_3px_0_#111111] transition-all select-none"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111111"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[24px] h-[24px] shrink-0"
              >
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                <polyline points="16 7 12 3 8 7" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Send files</span>
            </button>

            {/* "Receive files": white, same size and style, download icon + "Receive files". Scrolls to "Have a code?" and focuses box 1 */}
            <button
              type="button"
              onClick={scrollToMobileCode}
              className="w-full h-[50px] bg-white border-[2px] border-[#111111] rounded-[14px] shadow-[3px_4px_0_#111111] flex items-center justify-center gap-[12px] font-['Poppins',sans-serif] font-[800] text-[17px] text-[#0A1020] cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_3px_0_#111111] transition-all select-none"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111111"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[24px] h-[24px] shrink-0"
              >
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                <polyline points="8 11 12 15 16 11" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Receive files</span>
            </button>
          </div>

          {/* 14px below: centered gray line "Free - up to 100 MB per file - auto-deletes in 1 hour", 13px, weight 500, #55657A, one line */}
          <div className="mt-[14px] w-full text-center">
            <span className="font-['Plus_Jakarta_Sans',sans-serif] font-[500] text-[13px] text-[#55657A] select-none whitespace-nowrap leading-none">
              Free - up to {maxFileSizeMb} MB per file - auto-deletes in 1 hour
            </span>
          </div>

          {/* 4. "HAVE A CODE?" CARD (24px below gray line, 342px wide, ~191px high) */}
          <div
            ref={mobileCodeCardRef}
            className="mt-[24px] w-full bg-white border-[2px] border-[#111111] rounded-[18px] shadow-[4px_5px_0_#111111] p-[16px] flex flex-col"
          >
            {/* Title "Have a code?" 24px/800 at the top left */}
            <h2 className="font-['Poppins',sans-serif] font-[800] text-[24px] text-[#0A1020] tracking-tight leading-none text-left select-none">
              Have a code?
            </h2>

            {/* Row of six digit boxes: 14px below title; 44px wide x 48px high, 9px gaps (total 309px), active box has 3px border */}
            <div className="mt-[14px] flex items-center justify-between gap-[9px] w-full">
              {codeDigits.map((digit, idx) => {
                const isActive = activeBoxIndex === idx;
                return (
                  <input
                    key={idx}
                    ref={el => {
                      mobileDigitInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onFocus={() => setActiveBoxIndex(idx)}
                    onBlur={() => setActiveBoxIndex(null)}
                    onChange={e => handleDigitChange(idx, e.target.value, true)}
                    onKeyDown={e => handleKeyDown(idx, e, true)}
                    aria-label={`Digit ${idx + 1}`}
                    className={`w-[44px] h-[48px] bg-white rounded-[10px] text-center font-['Poppins',sans-serif] font-[800] text-[24px] text-[#0A1020] leading-none select-all shrink-0 focus:outline-none transition-colors ${
                      isActive
                        ? 'border-[3px] border-[#111111]'
                        : 'border-[2px] border-[#111111]'
                    }`}
                  />
                );
              })}
            </div>

            {/* Under the boxes, 14px gap: "Join room" button, full inner width (309px) x 44px, yellow, border 2px, radius 12px, shadow 3px 4px 0 #111, text 17px/800 */}
            <button
              type="button"
              onClick={handleMobileJoinClick}
              className="mt-[14px] w-full h-[44px] bg-[#FED228] border-[2px] border-[#111111] rounded-[12px] shadow-[3px_4px_0_#111111] font-['Poppins',sans-serif] font-[800] text-[17px] text-[#0A1020] flex items-center justify-center cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_3px_0_#111111] transition-all select-none"
            >
              Join room
            </button>
          </div>

          {/* 5. "HOW IT WORKS" (36px below the card) */}
          <div className="mt-[36px] w-full">
            {/* Heading "How it works" 38px/800, tight tracking, about 290px wide, left aligned */}
            <h2 className="font-['Poppins',sans-serif] font-[800] text-[38px] text-[#0A1020] tracking-[-0.03em] leading-none text-left select-none max-w-[290px]">
              How it works
            </h2>

            {/* 27px under it, three steps in a vertical timeline */}
            <div className="mt-[27px] flex flex-col">
              {/* Step 1: 80px circle icon at left, 20px gap, title 20px/800, 6px below caption 16px/500 #55657A */}
              <div className="flex items-center gap-[20px]">
                <img
                  src="/step-1-slice.webp"
                  alt="1. Drop files"
                  width="80"
                  height="80"
                  className="w-[80px] h-[80px] object-contain shrink-0 select-none"
                />
                <div className="flex flex-col text-left">
                  <h3 className="font-['Poppins',sans-serif] font-[800] text-[20px] text-[#0A1020] leading-none select-none">
                    1. Drop files
                  </h3>
                  <p className="mt-[6px] font-['Plus_Jakarta_Sans',sans-serif] font-[500] text-[16px] text-[#55657A] leading-tight select-none">
                    Upload your files in seconds.
                  </p>
                </div>
              </div>

              {/* Between circles: three black dots (4px, 10px apart, vertical), centered under the circle, with 46px between circles (step pitch 124px) */}
              <div className="w-[80px] h-[46px] flex flex-col items-center justify-center gap-[10px]">
                <span className="w-[4px] h-[4px] rounded-full bg-[#111111] shrink-0" />
                <span className="w-[4px] h-[4px] rounded-full bg-[#111111] shrink-0" />
                <span className="w-[4px] h-[4px] rounded-full bg-[#111111] shrink-0" />
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-[20px]">
                <img
                  src="/step-2-box.webp"
                  alt="2. Share your code"
                  width="80"
                  height="80"
                  className="w-[80px] h-[80px] object-contain shrink-0 select-none"
                />
                <div className="flex flex-col text-left">
                  <h3 className="font-['Poppins',sans-serif] font-[800] text-[20px] text-[#0A1020] leading-none select-none">
                    2. Share your code
                  </h3>
                  <p className="mt-[6px] font-['Plus_Jakarta_Sans',sans-serif] font-[500] text-[16px] text-[#55657A] leading-tight select-none">
                    Get a code, link or QR code.
                  </p>
                </div>
              </div>

              {/* Between circles: three black dots (4px, 10px apart, vertical) */}
              <div className="w-[80px] h-[46px] flex flex-col items-center justify-center gap-[10px]">
                <span className="w-[4px] h-[4px] rounded-full bg-[#111111] shrink-0" />
                <span className="w-[4px] h-[4px] rounded-full bg-[#111111] shrink-0" />
                <span className="w-[4px] h-[4px] rounded-full bg-[#111111] shrink-0" />
              </div>

              {/* Step 3 */}
              <div className="flex items-center gap-[20px]">
                <img
                  src="/step-3-globe.webp"
                  alt="3. Pick up anywhere"
                  width="80"
                  height="80"
                  className="w-[80px] h-[80px] object-contain shrink-0 select-none"
                />
                <div className="flex flex-col text-left">
                  <h3 className="font-['Poppins',sans-serif] font-[800] text-[20px] text-[#0A1020] leading-none select-none">
                    3. Pick up anywhere
                  </h3>
                  <p className="mt-[6px] font-['Plus_Jakarta_Sans',sans-serif] font-[500] text-[16px] text-[#55657A] leading-tight select-none">
                    Open on any device and download.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 6. FOOTER (24px below last step) */}
          <footer className="mt-[24px] w-full relative z-10 pb-[24px]">
            {/* 1px line #D8D2C4 across content width */}
            <div className="w-full h-[1px] bg-[#D8D2C4]" />

            {/* 16px below it a row: Logo scaled to ~70% on left, and footer text on right */}
            <div className="mt-[16px] flex items-center justify-between gap-[12px]">
              {/* Left: Logo component scaled to about 70% (icon 39px, wordmark ~95px) */}
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="cursor-pointer focus:outline-none shrink-0"
                aria-label="SliceDrop logo"
              >
                <img
                  src="/new-brand-logo.png"
                  alt="SliceDrop"
                  className="h-[28px] w-auto object-contain select-none"
                />
              </button>

              {/* Right: existing footer text ("Made with a ❤️ by Musab") at 12px, weight 500, right aligned */}
              <div className="font-['Plus_Jakarta_Sans',sans-serif] font-[500] text-[12px] text-[#0A1020] text-right whitespace-nowrap select-none">
                Made with a <span className="text-[#FF2A6D] inline-block">❤️</span> by Musab
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* ========================================================
          DESKTOP / TABLET HOMEPAGE (768px and wider)
          COMPLETELY UNCHANGED
      ======================================================== */}
      <div className="hidden md:flex w-full relative min-h-screen bg-[#FDF7ED] text-[#111111] overflow-x-hidden selection:bg-[#FED228] selection:text-[#111111] flex-col justify-between">
        {/* Corner Bleed Blobs (matches desktop mockup) */}
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

        {/* Hidden Native File Input for Desktop */}
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

              {/* Center: Six code boxes in one row */}
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

            {/* Right: Made with 💗 by Musab */}
            <div className="text-xs sm:text-sm md:text-base font-bold text-[#111111] select-none">
              Made with 💗 by Musab
            </div>
          </footer>
        </div>
      </div>
    </>
  );
};
