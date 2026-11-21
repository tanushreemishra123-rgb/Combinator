import type { CSSProperties, ElementType, ReactNode } from 'react';

import { cx } from '../cx';
import styles from './Typography.module.scss';

export type TypographyVariant =
  | 'eyebrow'
  | 'page-title'
  | 'card-title'
  | 'body'
  | 'body-muted'
  | 'mono'
  | 'label-caps';

export type TypographyColor = 'primary' | 'secondary' | 'muted' | 'success' | 'danger' | 'warning';
export type TypographyWeight = 'regular' | 'medium' | 'semibold' | 'bold';
export type TypographyTag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div' | 'label';

const DEFAULT_TAGS: Record<TypographyVariant, TypographyTag> = {
  eyebrow: 'span',
  'page-title': 'h1',
  'card-title': 'h2',
  body: 'p',
  'body-muted': 'p',
  mono: 'span',
  'label-caps': 'span'
};

export interface TypographyProps {
  variant?: TypographyVariant;
  as?: TypographyTag;
  color?: TypographyColor;
  weight?: TypographyWeight;
  truncate?: boolean | number;
  className?: string;
  id?: string;
  htmlFor?: string;
  children?: ReactNode;
}

export function Typography({
  variant = 'body',
  as,
  color,
  weight,
  truncate,
  className,
  id,
  htmlFor,
  children
}: TypographyProps) {
  const tag = as ?? DEFAULT_TAGS[variant] /* nosemgrep: gitlab.eslint.detect-object-injection */;
  const Tag = tag as ElementType;
  const clampLines = typeof truncate === 'number' && truncate > 1 ? truncate : undefined;
  const singleLineTruncate = truncate === true || truncate === 1;

  return (
    <Tag
      id={id}
      htmlFor={tag === 'label' ? htmlFor : undefined}
      className={cx(
        styles.base,
        styles[variant] /* nosemgrep: gitlab.eslint.detect-object-injection */,
        color ? styles[`color-${color}`] /* nosemgrep: gitlab.eslint.detect-object-injection */ : undefined,
        weight ? styles[`weight-${weight}`] /* nosemgrep: gitlab.eslint.detect-object-injection */ : undefined,
        singleLineTruncate ? styles.truncate : undefined,
        clampLines ? styles.clamp : undefined,
        className
      )}
      style={clampLines ? ({ '--typography-clamp-lines': clampLines } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
