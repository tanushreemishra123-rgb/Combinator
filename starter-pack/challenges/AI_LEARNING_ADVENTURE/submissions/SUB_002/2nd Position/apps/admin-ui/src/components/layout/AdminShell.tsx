import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { cx } from '@/components/ui';
import styles from './AdminShell.module.scss';

interface NavItem {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/missions', label: 'Missions', match: (path) => path.startsWith('/missions') },
  { href: '/questions', label: 'Questions', match: (path) => path.startsWith('/questions') },
  { href: '/flashcards', label: 'Flashcards', match: (path) => path.startsWith('/flashcards') },
  { href: '/badges', label: 'Badges', match: (path) => path.startsWith('/badges') },
  { href: '/curriculum', label: 'Curriculum', match: (path) => path.startsWith('/curriculum') },
  { href: '/settings', label: 'Settings', match: (path) => path.startsWith('/settings') },
];

export interface AdminShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminShell({ title, description, actions, children }: AdminShellProps) {
  const router = useRouter();
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/missions" className={styles.brand}>
          AI Quest Admin
        </Link>
        <nav className={styles.nav} aria-label="Admin sections">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.match(router.pathname) ? 'page' : undefined}
              className={cx(styles.navItem, item.match(router.pathname) && styles.navItemActive)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
            {description !== undefined && <p className={styles.description}>{description}</p>}
          </div>
          {actions !== undefined && <div className={styles.actions}>{actions}</div>}
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
