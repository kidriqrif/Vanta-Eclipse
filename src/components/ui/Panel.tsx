import React from 'react';

/** A bordered HUD section. `tone` tints the border. */
export const Panel: React.FC<{
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'neon' | 'gold' | 'crimson';
}> = ({ children, className = '', tone = 'default' }) => {
  const border =
    tone === 'neon' ? 'border-neon/50' : tone === 'gold' ? 'border-gold/50' : tone === 'crimson' ? 'border-crimson/60' : 'border-line';
  return <section className={`bg-panel border ${border} p-2.5 flex flex-col gap-2 ${className}`}>{children}</section>;
};

/** The header strip every tab opens with: icon, title, one-line subtitle, optional right slot. */
export const PanelHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  tone?: 'neon' | 'gold' | 'crimson';
}> = ({ icon, title, subtitle, right, tone = 'neon' }) => {
  const color = tone === 'gold' ? 'text-gold border-gold' : tone === 'crimson' ? 'text-crimson border-crimson' : 'text-neon border-neon';
  return (
    <div className="bg-panel border border-line border-l-4 border-l-neon/80 p-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-8 h-8 shrink-0 border ${color} bg-void flex items-center justify-center`}>{icon}</div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-display font-bold text-ink uppercase tracking-wider leading-tight truncate">{title}</h2>
          {subtitle && <p className="text-[10px] font-tech text-dim leading-tight truncate">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
};

/** The scrolling body of a tab. */
export const TabBody: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-2 bg-void ${className}`}>{children}</div>
);
