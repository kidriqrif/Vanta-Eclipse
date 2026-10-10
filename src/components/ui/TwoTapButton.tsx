import React, { useEffect, useState } from 'react';
import { Button, type ButtonProps } from './Button';

/**
 * The Two-Tap Arm pattern: the first tap arms the button
 * and states the consequence; a second tap within `armMs` commits. It disarms on its own.
 */
export const TwoTapButton: React.FC<
  Omit<ButtonProps, 'onClick' | 'children'> & {
    label: React.ReactNode;
    armedLabel: React.ReactNode;
    onConfirm: () => void;
    armMs?: number;
    armedVariant?: ButtonProps['variant'];
  }
> = ({ label, armedLabel, onConfirm, armMs = 3000, variant = 'primary', armedVariant = 'danger', disabled, ...rest }) => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), armMs);
    return () => clearTimeout(t);
  }, [armed, armMs]);
  useEffect(() => {
    if (disabled) setArmed(false);
  }, [disabled]);
  return (
    <Button
      {...rest}
      disabled={disabled}
      variant={armed ? armedVariant : variant}
      aria-live="polite"
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? armedLabel : label}
    </Button>
  );
};
