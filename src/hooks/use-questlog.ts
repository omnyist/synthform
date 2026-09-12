import { useQuery } from '@tanstack/react-query'

import type { components } from '@/api/generated/questlog'
import type { Paginated } from '@/api/pagination'

const QUESTLOG_URL = import.meta.env.VITE_QUESTLOG_URL || 'http://saya:7176/api'

// Types generated from questlog's OpenAPI spec (see package.json `generate:api`).
type IronMONStats = components['schemas']['IronMONStatsSchema']
type Run = components['schemas']['IronMONRunSchema']

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${QUESTLOG_URL}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export function useIronMONStats(challenge?: string) {
  const params = challenge ? `?challenge=${challenge}` : ''
  return useQuery<IronMONStats>({
    queryKey: ['ironmon', 'stats', challenge],
    queryFn: () => fetchJSON(`/ironmon/stats${params}`),
    staleTime: 30_000,
  })
}

export function useIronMONRuns(challenge?: string, limit = 50) {
  const params = new URLSearchParams()
  if (challenge) params.set('challenge', challenge)
  if (limit !== 50) params.set('limit', String(limit))
  const qs = params.toString() ? `?${params.toString()}` : ''

  return useQuery<Paginated<Run>>({
    queryKey: ['ironmon', 'runs', challenge, limit],
    queryFn: () => fetchJSON(`/ironmon/runs${qs}`),
    staleTime: 30_000,
  })
}
