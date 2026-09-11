/**
 * Shapes Synthhome's raw Unraid readings (host/*, volume/*) into the numbers
 * the HUD shows. Percentages are 0–100.
 */
export interface UnraidStats {
  cpuUsage: number
  ramUsage: number
  uptime: string
  arrayUsage: number
  disks: number[]
}

const DISKS = ['disk1', 'disk2', 'disk3']

function pct(used: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (used / total) * 100))
}

export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${Math.floor((seconds % 3_600) / 60)}m`
}

export function unraidStats(r: Record<string, number>): UnraidStats {
  const cpuCount = r['host/cpu_count'] ?? 0
  const memTotal = r['host/mem_total_bytes'] ?? 0
  const memAvail = r['host/mem_available_bytes'] ?? 0
  let usedAll = 0
  let totalAll = 0
  const disks = DISKS.map((d) => {
    const used = r[`volume/${d}/used_bytes`] ?? 0
    const free = r[`volume/${d}/free_bytes`] ?? 0
    usedAll += used
    totalAll += used + free
    return pct(used, used + free)
  })
  return {
    cpuUsage: cpuCount > 0 ? pct(r['host/load_1'] ?? 0, cpuCount) : 0,
    ramUsage: pct(memTotal - memAvail, memTotal),
    uptime: formatUptime(r['host/uptime_s'] ?? 0),
    arrayUsage: pct(usedAll, totalAll),
    disks,
  }
}
