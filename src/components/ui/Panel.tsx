import React from 'react';

/** A bordered HUD section on a hard shadow. `tone` tints the border. */
export const Panel: React.FC<{
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'neon' | 'gold' | 'crimson';
}> = ({ children, className = '', tone = 'default' }) => {
  const border =
    tone === 'neon' ? 'border-neon/60' : tone === 'gold' ? 'border-gold/60' : tone === 'crimson' ? 'border-crimson/70' : 'border-line';
  return <section className={`bg-panel border ${border} shadow-hard p-2.5 flex flex-col gap-2 ${className}`}>{children}</section>;
};

/**
 * The one-line strip every tab opens with: icon block, title, a short subtitle, and an optional
 * right slot. Kept to 36px so the tab deck spends its height on content.
 */
export const PanelHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  tone?: 'neon' | 'gold' | 'crimson';
}> = ({ icon, title, subtitle, right, tone = 'neon' }) => {
  const accent = tone === 'gold' ? 'border-l-gold' : tone === 'crimson' ? 'border-l-crimson' : 'border-l-neon';
  return (
    <div className={`shrink-0 h-9 bg-panel2 border-b border-line border-l-4 ${accent} pl-2 pr-2.5 flex items-center justify-between gap-2`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 flex items-center justify-center" aria-hidden>
          {icon}
        </span>
        <h2 className="shrink-0 text-[13px] font-display font-bold text-ink uppercase leading-none">{title}</h2>
        {subtitle && <p className="min-w-0 text-[10px] font-tech text-dim leading-tight truncate">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
};

/** The scrolling body of a tab. Only this scrolls; the frame around it never moves. */
export const TabBody: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 flex flex-col gap-2 bg-void ${className}`}>{children}</div>
);
