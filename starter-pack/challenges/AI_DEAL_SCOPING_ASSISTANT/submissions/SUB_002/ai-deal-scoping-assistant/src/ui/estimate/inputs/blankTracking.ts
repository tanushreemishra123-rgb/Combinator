/**
 * Tracks which numeric fields a reviewer has left blank while editing (spec 5 constraint: "Missing
 * estimation inputs must reduce confidence or block the affected calculation rather than being
 * silently replaced with unsupported values"). The committed config always keeps its last valid
 * number - nothing is coerced to 0/1 - while the control itself still shows empty and the field can
 * be flagged "Required" until the reviewer supplies a value again.
 */
import { useState } from 'react';

export interface BlankTracking<Key> {
  /** The value to show in the control: null while the field is blank, otherwise the committed value. */
  displayValue(key: Key, committed: number): number | null;
  /** True while `key` is currently left blank, for rendering a "Required" hint next to the field. */
  isBlank(key: Key): boolean;
  /** Wires a control's onChange: a blank value is tracked and never committed; a real number is committed and clears the flag. */
  handleChange(key: Key, value: number | null, commit: (value: number) => void): void;
}

/** `Key` is typically a small string-literal union naming each tracked field. */
export function useBlankTracking<Key>(): BlankTracking<Key> {
  const [blankKeys, setBlankKeys] = useState<ReadonlySet<Key>>(new Set());

  function setBlank(key: Key, blank: boolean): void {
    setBlankKeys((previous) => {
      const next = new Set(previous);
      if (blank) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  return {
    displayValue: (key, committed) => (blankKeys.has(key) ? null : committed),
    isBlank: (key) => blankKeys.has(key),
    handleChange: (key, value, commit) => {
      if (value === null) {
        setBlank(key, true);
        return;
      }
      setBlank(key, false);
      commit(value);
    },
  };
}
