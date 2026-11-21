/**
 * Small inline-SVG stroke-icon set. Every icon is aria-hidden by default (decorative) - pair it
 * with visible text or an accessible name on the interactive element that hosts it (see
 * IconButton's required `label`).
 */
import type { ReactElement, ReactNode } from 'react';

export interface IconProps {
  size?: number;
  className?: string;
}

function IconBase({ size = 16, className, children }: IconProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function ChevronUpIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="m6 15 6-6 6 6" />
    </IconBase>
  );
}

export function ChevronLeftIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="m15 6-6 6 6 6" />
    </IconBase>
  );
}

export function ChevronRightIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="m9 6 6 6-6 6" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M5 12.5 9.5 17 19 7" />
    </IconBase>
  );
}

export function CheckCircleIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </IconBase>
  );
}

export function XIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </IconBase>
  );
}

export function AlertTriangleIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M12 4.5 21 19H3z" />
      <path d="M12 10v4M12 16.8v.1" />
    </IconBase>
  );
}

export function AlertCircleIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5M12 15.8v.1" />
    </IconBase>
  );
}

export function InfoIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2M12 7.8v.1" />
    </IconBase>
  );
}

export function CopyIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.6" />
      <path d="M15 8.5V6.6A1.6 1.6 0 0 0 13.4 5H6.6A1.6 1.6 0 0 0 5 6.6v6.8A1.6 1.6 0 0 0 6.6 15H8.5" />
    </IconBase>
  );
}

export function ExternalLinkIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M9 6H6.6A1.6 1.6 0 0 0 5 7.6v9.8A1.6 1.6 0 0 0 6.6 19h9.8A1.6 1.6 0 0 0 18 17.4V15" />
      <path d="M13.5 5H19v5.5M19 5l-8.5 8.5" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconBase>
  );
}

export function PlusIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  );
}

export function UploadIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" />
      <path d="M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </IconBase>
  );
}

export function DownloadIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M12 4.5v11M7.5 11l4.5 4.5L16.5 11" />
      <path d="M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9 6.3 6.3" />
    </IconBase>
  );
}

export function SparklesIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M11 4.5 12.4 9 17 10.3 12.4 11.6 11 16.1 9.6 11.6 5 10.3 9.6 9z" />
      <path d="M18 15v3.2M16.4 16.6h3.2" />
    </IconBase>
  );
}

export function ClockIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </IconBase>
  );
}

export function RefreshIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M19 12a7 7 0 0 1-12.3 4.5M5 12a7 7 0 0 1 12.3-4.5" />
      <path d="M19 7v4.5h-4.5M5 17v-4.5h4.5" />
    </IconBase>
  );
}

export function UserIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8.3" r="3.3" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </IconBase>
  );
}

export function HelpCircleIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 9.3a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2 1-1.2 2" />
      <path d="M12 16.8v.1" />
    </IconBase>
  );
}

export function LightbulbIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M9 18.5h6M9.7 21h4.6" />
      <path d="M8 14.8A5 5 0 1 1 16 14.8c-.8.9-1.5 1.6-1.5 2.7h-5c0-1.1-.7-1.8-1.5-2.7Z" />
    </IconBase>
  );
}

export function MinusCircleIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12h8" />
    </IconBase>
  );
}

export function CircleIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M5.5 7.5h13M9.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 6v1.5" />
      <path d="M7.5 7.5 8.2 19a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-11.5" />
    </IconBase>
  );
}

export function FileTextIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M8 4.5h6L18 8.5v11a1.4 1.4 0 0 1-1.4 1.4H8A1.4 1.4 0 0 1 6.6 19.5v-13.6A1.4 1.4 0 0 1 8 4.5Z" />
      <path d="M9 12h6M9 15.3h6" />
    </IconBase>
  );
}

export function FolderIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M4.5 7.3A1.3 1.3 0 0 1 5.8 6h3.6l1.7 2h7.1a1.3 1.3 0 0 1 1.3 1.3v8.4A1.3 1.3 0 0 1 18.2 19H5.8a1.3 1.3 0 0 1-1.3-1.3Z" />
    </IconBase>
  );
}

export function ArrowLeftIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </IconBase>
  );
}

export function ArrowRightIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </IconBase>
  );
}

export function ArrowUpIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </IconBase>
  );
}

export function ArrowDownIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M18 13l-6 6-6-6" />
    </IconBase>
  );
}

export function MinusIcon(props: IconProps): ReactElement {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
    </IconBase>
  );
}
