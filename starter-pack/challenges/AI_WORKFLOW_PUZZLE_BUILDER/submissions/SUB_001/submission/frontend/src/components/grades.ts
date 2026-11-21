/**
 * Reliability grade metadata: icon, wording and the Tailwind utilities built
 * from the `--grade-*` tokens. A plain module so both the badge and the report
 * dial can read it.
 */

import { HeartPulse, OctagonAlert, TriangleAlert, Trophy, type LucideIcon } from 'lucide-react'
import type { ReliabilityGrade } from '@/api/types'

export interface GradeMeta {
  Icon: LucideIcon
  title: string
  blurb: string
  /** Tailwind colour utilities, both built from the same token. */
  text: string
  bg: string
  stroke: string
}

export const GRADE_META: Record<ReliabilityGrade, GradeMeta> = {
  resilient: {
    Icon: Trophy,
    title: 'Resilient',
    blurb: 'It took a hit and never lost its footing. This is what a production workflow looks like.',
    text: 'text-grade-resilient',
    bg: 'bg-grade-resilient/10',
    stroke: 'stroke-grade-resilient',
  },
  recovered: {
    Icon: HeartPulse,
    title: 'Recovered',
    blurb: 'It wobbled, caught itself, and still reached the finish line. That counts.',
    text: 'text-grade-recovered',
    bg: 'bg-grade-recovered/10',
    stroke: 'stroke-grade-recovered',
  },
  fragile: {
    Icon: TriangleAlert,
    title: 'Fragile',
    blurb: 'It works right up until something goes wrong. Add a guard and run it again.',
    text: 'text-grade-fragile',
    bg: 'bg-grade-fragile/10',
    stroke: 'stroke-grade-fragile',
  },
  broken: {
    Icon: OctagonAlert,
    title: 'Broken',
    blurb: 'The run fell over with nothing there to catch it. Every failure needs an owner.',
    text: 'text-grade-broken',
    bg: 'bg-grade-broken/10',
    stroke: 'stroke-grade-broken',
  },
}
