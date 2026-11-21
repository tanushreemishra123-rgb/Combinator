/** Plain, controlled form inputs. Pair each with `Field` for the label, hint and error text. */
import type { ChangeEvent, ReactElement } from 'react';

interface BaseControlProps {
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export interface TextInputProps extends BaseControlProps {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'email' | 'search';
  autoComplete?: string;
  list?: string;
}

export function TextInput({ value, onChange, type = 'text', ...rest }: TextInputProps): ReactElement {
  return (
    <input
      {...rest}
      type={type}
      value={value}
      className="control"
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
    />
  );
}

export interface NumberInputProps extends BaseControlProps {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberInput({ value, onChange, ...rest }: NumberInputProps): ReactElement {
  return (
    <input
      {...rest}
      type="number"
      value={value ?? ''}
      className="control"
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value;
        onChange(raw === '' ? null : Number(raw));
      }}
    />
  );
}

export interface TextAreaProps extends BaseControlProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export function TextArea({ value, onChange, rows = 4, ...rest }: TextAreaProps): ReactElement {
  return (
    <textarea
      {...rest}
      rows={rows}
      value={value}
      className="control"
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends BaseControlProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}

export function Select({ value, onChange, options, ...rest }: SelectProps): ReactElement {
  return (
    <select {...rest} value={value} className="control" onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export interface CheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, disabled, id }: CheckboxProps): ReactElement {
  return (
    <label className="checkbox">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export interface ToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  'aria-describedby'?: string;
}

export function Toggle({ checked, onChange, label, disabled, id, ...rest }: ToggleProps): ReactElement {
  return (
    <label className="toggle">
      <input
        {...rest}
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}
