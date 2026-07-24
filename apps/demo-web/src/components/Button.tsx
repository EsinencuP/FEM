import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'quiet';
type ButtonTone = 'default' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly tone?: ButtonTone;
  readonly busy?: boolean;
  readonly children: ReactNode;
}

export function Button({
  variant = 'primary',
  tone = 'default',
  busy = false,
  children,
  disabled,
  ...props
}: ButtonProps): ReactNode {
  return (
    <button
      className={`button button--${variant} button--${tone}`}
      disabled={disabled || busy}
      {...props}
    >
      {busy ? 'Сохраняем…' : children}
    </button>
  );
}
