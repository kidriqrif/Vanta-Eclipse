import React from 'react';

type Variant = 'primary' | 'gold' | 'danger' | 'ghost' | 'solid';

const VARIANTS: Record<Variant, string> = {
  primary: 'hud-btn',
  gold: 'hud-btn-gold',
  danger: 'hud-btn-alert',
  ghost:
    'bg-panel border border-line text-ink font-display font-bold uppercase hover:border-neon hover:text-neon-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
  solid:
    'bg-neon text-void border border-neon font-display font-black uppercase hover:bg-neon-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
};

const SIZES = {
  sm: 'px-2 py-1 text-[10px] min-h-[32px]',
  md: 'px-3 py-1.5 text-xs min-h-[40px]',
  lg: 'px-4 py-2.5 text-sm min-h-[48px]',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  block?: boolean;
}

/** The game's button. Touch targets stay at least 32px tall. */
export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', block, className = '', type = 'button', ...rest }) => (
  <button
    type={type}
    className={`${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} inline-flex items-center justify-center gap-1.5 select-none ${className}`}
    {...rest}
  />
);
