import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  content: string;
  label?: string;
  className?: string;
  align?: 'left' | 'right';
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  label = 'More information',
  className = '',
  align = 'left'
}) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const visible = open || hovered;

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth || (window.innerWidth >= 640 ? 240 : 208);
    const tooltipHeight = tooltipRef.current?.offsetHeight || 80;
    const viewportPadding = 8;

    let left = rect.left;
    if (align === 'right' && window.innerWidth >= 640) {
      left = rect.right - tooltipWidth;
    } else if (window.innerWidth < 640) {
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    }

    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipWidth - viewportPadding));

    let top = rect.bottom + 8;
    if (top + tooltipHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - tooltipHeight - 8);
    }

    setPosition({ top, left });
  }, [align]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const rafId = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible, updatePosition]);

  return (
    <span className={`relative inline-flex items-center ${className}`} ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:text-amber-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        aria-label={label}
        aria-expanded={visible}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {visible && typeof document !== 'undefined' && createPortal(
        <span
          ref={tooltipRef}
          role="tooltip"
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
          className="pointer-events-none fixed z-[9999] w-52 sm:w-60 rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-[10px] font-bold normal-case tracking-normal leading-relaxed text-slate-300 shadow-2xl backdrop-blur animate-in fade-in zoom-in-95 duration-150"
        >
          {content}
        </span>,
        document.body
      )}
    </span>
  );
};

export default InfoTooltip;
