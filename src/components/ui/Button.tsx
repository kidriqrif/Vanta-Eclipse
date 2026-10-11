import React from 'react';

type Variant = 'primary' | 'gold' | 'danger' | 'ghost' | 'solid';

/** The look of each variant lives in src/index.css (.hud-btn*): sharp, bordered, hard-shadowed. */
const VARIANTS: Record<Variant, string> = {
  primary: 'hud-btn',
  gold: 'hud-btn-gold',
  danger: 'hud-btn-alert',
  ghost: 'hud-btn-ghost',
  solid: 'hud-btn-solid',
};

const SIZES = {
  sm: 'px-2 py-1 text-[11px] min-h-[32px]',
  md: 'px-3 py-1.5 text-xs min-h-[40px]',
  lg: 'px-4 py-2.5 text-sm min-h-[48px]',
} as const;

/** The press: the button sinks half a step, shrinks a hair and lights its edge amber. */
const PRESS = 'active:translate-y-0.5 active:border-amber-500 active:scale-[0.98]';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  block?: boolean;
}

/** The game's button: a hard rectangle, never a pill. Touch targets stay at least 32px tall. Forwards its ref. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${VARIANTS[variant]} ${SIZES[size]} ${PRESS} ${block ? 'w-full' : ''} inline-flex items-center justify-center gap-1.5 select-none ${className}`}
      {...rest}
    />
  );
});
