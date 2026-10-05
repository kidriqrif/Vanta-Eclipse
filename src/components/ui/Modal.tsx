import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useBackHandler } from '../../hooks/useBackHandler';

/**
 * A centered dialog over the game. The Android back button and the ✕ both close it when
 * `onClose` is given; omit `onClose` for dialogs that must be answered.
 */
export const Modal: React.FC<{
  open: boolean;
  onClose?: () => void;
  title: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'neon' | 'gold' | 'crimson';
  children: React.ReactNode;
  className?: string;
}> = ({ open, onClose, title, icon, tone = 'neon', children, className = '' }) => {
  useBackHandler(open && !!onClose, () => onClose?.());
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);
  if (!open) return null;
  const border = tone === 'gold' ? 'border-gold' : tone === 'crimson' ? 'border-crimson' : 'border-neon';
  return (
    <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4 animate-fade-in" role="presentation">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`bg-panel border-2 ${border} w-full max-w-sm max-h-[88vh] flex flex-col outline-none shadow-[0_0_30px_rgba(0,0,0,0.8)] ${className}`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-panel2 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <h2 className="text-xs font-display font-bold text-ink uppercase tracking-wider truncate">{title}</h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 shrink-0 flex items-center justify-center border border-line text-dim hover:text-ink hover:border-neon"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="p-3 overflow-y-auto flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
};
