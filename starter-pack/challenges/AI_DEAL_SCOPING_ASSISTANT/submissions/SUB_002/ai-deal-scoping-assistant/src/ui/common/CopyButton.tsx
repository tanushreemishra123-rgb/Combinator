/** Copies `value` to the clipboard and shows brief inline confirmation instead of a toast. */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from './Button';
import { CheckIcon, CopyIcon } from './icons';

export interface CopyButtonProps {
  value: string;
  label?: string;
}

const CONFIRMATION_TIMEOUT_MS = 2000;

export function CopyButton({ value, label = 'Copy' }: CopyButtonProps): ReactElement {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), CONFIRMATION_TIMEOUT_MS);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" icon={copied ? <CheckIcon /> : <CopyIcon />} onClick={() => void handleCopy()}>
      {copied ? 'Copied' : label}
    </Button>
  );
}
