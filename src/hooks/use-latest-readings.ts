import { useQuery } from '@tanstack/react-query'
import { fetchLatestReadings } from '@/api/synthhome'

/**
 * Latest value of every metric a Synthhome source reports, keyed by metric.
 * For sources that are polled rather than streamed (Unraid, VeSync) — the
 * streamed ones (tempest, enphase, unifi) have their own WebSocket hooks.
 */
export function useLatestReadings(source: string, refetchMs = 30_000) {
  return useQuery<Record<string, number>>({
    queryKey: ['synthhome', 'readings', 'latest', source],
    queryFn: () => fetchLatestReadings(source),
    staleTime: refetchMs,
    refetchInterval: refetchMs,
  })
}
