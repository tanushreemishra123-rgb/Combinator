/**
 * Labelled form-field wrapper. Generates a unique id and wires it, plus hint/error text, to the
 * control through a render-prop so every control stays a plain, reusable input component.
 */
import { useId } from 'react';
import type { ReactElement, ReactNode } from 'react';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (controlProps: FieldControlProps) => ReactNode;
}

export function Field({ label, hint, error, required = false, children }: FieldProps): ReactElement {
  const inputId = useId();
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter((value): value is string => value !== undefined).join(' ') || undefined;

  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={inputId} className="field-label">
        {label}
        {required ? (
          <span className="field-required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children({ id: inputId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint ? (
        <p id={hintId} className="field-hint text-subtle text-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
