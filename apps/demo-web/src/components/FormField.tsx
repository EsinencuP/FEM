import type { ReactNode } from 'react';

interface FormFieldProps {
  readonly label: string;
  readonly htmlFor: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: ReactNode;
}

export function FormField({ label, htmlFor, hint, error, children }: FormFieldProps): ReactNode {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="form-field__error">{error}</p> : null}
      {!error && hint ? <p className="form-field__hint">{hint}</p> : null}
    </div>
  );
}
