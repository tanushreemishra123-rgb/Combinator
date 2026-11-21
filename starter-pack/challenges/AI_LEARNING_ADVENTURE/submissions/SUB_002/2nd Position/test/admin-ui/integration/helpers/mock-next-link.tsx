import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useTestRouter } from './router.tsx';

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string | { pathname?: string; query?: Record<string, string | string[] | undefined> };
  children: ReactNode;
  replace?: boolean;
}

function hrefText(href: LinkProps['href']): string {
  if (typeof href === 'string') return href;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(href.query ?? {})) {
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else if (value !== undefined) params.set(key, value);
  }
  const query = params.toString();
  return `${href.pathname ?? '/'}${query.length > 0 ? `?${query}` : ''}`;
}

export default function Link({ href, replace = false, onClick, children, ...rest }: LinkProps) {
  const router = useTestRouter();
  const text = hrefText(href);
  return (
    <a
      href={text}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0) return;
        event.preventDefault();
        void (replace ? router.replace(href) : router.push(href));
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
