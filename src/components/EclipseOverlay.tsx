import React, { useState } from 'react';
import { useFx } from '../hooks/useGame';
import { formatNumber } from '../utils/numberFormat';

/** The collapse: a fade to black, a gold flash, and the crystals earned. Purely visual. */
export const EclipseOverlay: React.FC = () => {
  const [flash, setFlash] = useState<{ key: number; crystals: number } | null>(null);
  useFx((fx) => {
    if (fx.type === 'eclipse') setFlash({ key: Date.now(), crystals: fx.crystals });
  });
  if (!flash) return null;
  return (
    <div
      key={flash.key}
      className="anim-eclipse fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
      onAnimationEnd={() => setFlash(null)}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="font-display font-black text-2xl text-gold tracking-[0.2em]">ECLIPSE</span>
        <span className="font-mono-code text-sm text-ink">+{formatNumber(flash.crystals)} VOID CRYSTALS</span>
      </div>
    </div>
  );
};
