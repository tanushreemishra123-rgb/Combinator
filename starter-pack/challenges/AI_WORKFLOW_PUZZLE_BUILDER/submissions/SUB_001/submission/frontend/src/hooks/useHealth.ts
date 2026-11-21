/** Polls `/api/health` once so the header can show a live/mock pill. */

import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { HealthResponse } from '../api/types'

export function useHealth(): HealthResponse | null {
  const [health, setHealth] = useState<HealthResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .getHealth()
      .then((result) => {
        if (!cancelled) setHealth(result)
      })
      .catch(() => {
        /* The badge simply stays hidden when health is unreachable. */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return health
}
