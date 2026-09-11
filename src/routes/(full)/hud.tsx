import { createFileRoute } from '@tanstack/react-router'

import { Canvas } from '@/components/ui/canvas'
import { useLatestReadings } from '@/hooks/use-latest-readings'
import { useTempest, useTempestForecast, useTempestCurrent } from '@/hooks/use-tempest'
import { useEnphase, useEnphaseBatteries, useEnphaseToday, useEnphaseCurrent, useEnphaseMicroinverters } from '@/hooks/use-enphase'
import { useNetwork, useNetworkDevices, usePduOutlets } from '@/hooks/use-network'
import { useGitHubCommits } from '@/hooks/use-github'
import { useSteamPlayer, useSteamRecentGames } from '@/hooks/use-steam'
import { useSparkline } from '@/hooks/use-sparkline'
import { useAlertQueue } from '@/hooks/use-alerts'
import { useStatus } from '@/hooks/use-status'
import { useMusic } from '@/hooks/use-music'
import { useLimitbreak } from '@/hooks/use-limitbreak'
import { unraidStats } from '@/lib/unraid'

export const Route = createFileRoute('/(full)/hud')({
  component: HUD,
})

function HUD() {
  // ---------------------------------------------------------------------------
  // Synthfunc (existing overlay data)
  // ---------------------------------------------------------------------------
  useAlertQueue({ soundEnabled: false })
  const { status } = useStatus()
  const { current: musicTrack, source: musicSource, isPlaying } = useMusic()
  const limitbreak = useLimitbreak()

  // ---------------------------------------------------------------------------
  // House telemetry (Synthhome REST, polled)
  // ---------------------------------------------------------------------------
  const { data: vesync } = useLatestReadings('vesync')
  const { data: unraidReadings } = useLatestReadings('unraid')

  // Air purifier (Levoit via VeSync)
  const pm25 = vesync?.pm25 ?? 0
  const filterLife = vesync?.filter_life ?? 0

  // Server (Unraid)
  const { cpuUsage, ramUsage, uptime, arrayUsage, disks } = unraidStats(unraidReadings ?? {})
  const [disk1 = 0, disk2 = 0, disk3 = 0] = disks

  // ---------------------------------------------------------------------------
  // Weather (Synthhome WebSocket + REST)
  // ---------------------------------------------------------------------------
  const { observation, rapidWind, lastStrike, isRaining, isConnected: tempestConnected } = useTempest()
  const { data: forecast } = useTempestForecast()
  useTempestCurrent()

  const weatherReadings = observation?.readings ?? {}
  const outdoorTemp = (weatherReadings.temp_f as number) ?? 0
  const outdoorHumidity = (weatherReadings.humidity as number) ?? 0
  const windAvg = rapidWind?.windSpeedMph ?? (weatherReadings.wind_avg_mph as number) ?? 0
  const windGust = (weatherReadings.wind_gust_mph as number) ?? 0
  const windDir = rapidWind?.windDir ?? (weatherReadings.wind_dir as number) ?? 0
  const pressure = (weatherReadings.pressure as number) ?? 0
  const uv = (weatherReadings.uv as number) ?? 0
  const solarRadiation = (weatherReadings.solar_radiation as number) ?? 0
  const illuminance = (weatherReadings.illuminance as number) ?? 0
  const dailyRain = (weatherReadings.daily_rain as number) ?? 0

  const forecastHourly = (forecast?.hourly ?? []).slice(0, 24)
  const forecastDaily = forecast?.daily ?? []
  const forecastCurrent = forecast?.current ?? {}

  // ---------------------------------------------------------------------------
  // Energy (Synthhome WebSocket + REST)
  // ---------------------------------------------------------------------------
  const { snapshot: energySnapshot, events: energyEvents, hasFault: energyHasFault, isConnected: enphaseConnected } = useEnphase()
  const { data: energyCurrent } = useEnphaseCurrent()
  const { data: energyToday } = useEnphaseToday()
  const { data: batteries } = useEnphaseBatteries()
  const { data: inverters } = useEnphaseMicroinverters()

  const energy = energySnapshot?.readings ?? {}
  const solarProd = (energy.pv_production_w as number) ?? 0
  const houseConsumption = (energy.house_consumption_w as number) ?? 0
  const gridImport = (energy.grid_import_w as number) ?? 0
  const gridExport = (energy.grid_export_w as number) ?? 0
  const gridNet = (energy.grid_net_w as number) ?? 0
  const batteryPower = (energy.battery_agg_power_w as number) ?? 0
  const batterySoc = (energy.battery_soc as number) ?? 0
  const batteryAvailWh = (energy.battery_avail_wh as number) ?? 0
  const selfConsumption = (energy.self_consumption_w as number) ?? 0

  // Daily totals and peaks
  const productionTodayWh = energyToday?.grid_export_today_wh != null ? (energyCurrent?.production_today_wh ?? null) : null
  const consumptionTodayWh = energyCurrent?.consumption_today_wh ?? null
  const gridImportTodayWh = energyToday?.grid_import_today_wh ?? null
  const gridExportTodayWh = energyToday?.grid_export_today_wh ?? null
  const batteryChargedTodayWh = energyToday?.battery_charged_today_wh ?? null
  const batteryDischargedTodayWh = energyToday?.battery_discharged_today_wh ?? null
  const peakProductionW = energyToday?.peak_production_w_today ?? null
  const peakConsumptionW = energyToday?.peak_consumption_w_today ?? null
  const maxSocToday = energyToday?.max_soc_today ?? null
  const minSocToday = energyToday?.min_soc_today ?? null

  // ---------------------------------------------------------------------------
  // Network (Synthhome WebSocket + REST)
  // ---------------------------------------------------------------------------
  const { snapshot: networkSnapshot, events: networkEvents, isConnected: unifiConnected } = useNetwork()
  const { data: networkDevices } = useNetworkDevices()
  const { data: pduOutlets } = usePduOutlets()

  const wanDownload = networkSnapshot?.wanRxBytesPs ?? 0
  const wanUpload = networkSnapshot?.wanTxBytesPs ?? 0
  const wanLatency = networkSnapshot?.wanLatencyAvgMs ?? 0
  const rackPower = networkSnapshot?.pduTotalPowerW ?? 0
  const wifiClients = networkSnapshot?.wifiClientsTotal ?? 0

  // ---------------------------------------------------------------------------
  // GitHub (direct REST)
  // ---------------------------------------------------------------------------
  const { data: commits } = useGitHubCommits(20)

  // ---------------------------------------------------------------------------
  // Steam (direct REST)
  // ---------------------------------------------------------------------------
  const { data: steamPlayer } = useSteamPlayer()
  const { data: steamGames } = useSteamRecentGames(5)

  // ---------------------------------------------------------------------------
  // Sparklines (Synthhome-backed with history backfill)
  // ---------------------------------------------------------------------------
  const outdoorTempSparkline = useSparkline('tempest', 'temp_f', outdoorTemp)
  const windSparkline = useSparkline('tempest', 'rapid_wind_speed', windAvg)
  const solarSparkline = useSparkline('enphase', 'pv_production_w', solarProd)
  const consumptionSparkline = useSparkline('enphase', 'house_consumption_w', houseConsumption)

  // ---------------------------------------------------------------------------
  // Render — this is your canvas
  // ---------------------------------------------------------------------------
  const debugPayloads = {
    connections: { tempestConnected, enphaseConnected, unifiConnected },
    status,
    music: { track: musicTrack, source: musicSource, isPlaying },
    limitbreak,
    airPurifier: { pm25, filterLife },
    server: { cpuUsage, ramUsage, uptime, arrayUsage, disk1, disk2, disk3 },
    network: {
      wanDownload, wanUpload, wanLatency, rackPower, wifiClients,
      devices: networkDevices?.map((d) => ({ name: d.name, type: d.device_type, cpu: d.cpu_pct, mem: d.mem_pct })),
      pdu: pduOutlets?.filter((o) => o.has_metering && (o.power_w ?? 0) > 0).map((o) => ({ index: o.index, name: o.name, power: o.power_w })),
      events: networkEvents.slice(0, 5),
    },
    weather: {
      outdoorTemp, outdoorHumidity, windAvg, windGust, windDir,
      pressure, uv, solarRadiation, illuminance, dailyRain,
      isRaining, lastStrike,
    },
    forecastCurrent,
    forecastHourly: forecastHourly.slice(0, 6),
    forecastDaily: forecastDaily.slice(0, 3),
    energy: {
      solarProd, houseConsumption, gridImport, gridExport, gridNet,
      batteryPower, batterySoc, batteryAvailWh, selfConsumption,
    },
    energyToday: {
      productionTodayWh, consumptionTodayWh,
      gridImportTodayWh, gridExportTodayWh,
      batteryChargedTodayWh, batteryDischargedTodayWh,
      peakProductionW, peakConsumptionW, maxSocToday, minSocToday,
    },
    batteries: batteries?.map((b) => ({ serial: b.serial, soc: b.soc, temp_c: b.temp_c })),
    inverters: { total: inverters?.length, producing: inverters?.filter((i) => (i.last_w ?? 0) > 0).length },
    energyEvents: energyEvents.slice(0, 5),
    energyHasFault,
    github: commits?.slice(0, 5),
    steam: { player: steamPlayer, recentGames: steamGames?.slice(0, 3) },
    sparklines: {
      outdoorTemp: `${outdoorTempSparkline.length} pts`,
      wind: `${windSparkline.length} pts`,
      solar: `${solarSparkline.length} pts`,
      consumption: `${consumptionSparkline.length} pts`,
    },
  }

  return (
    <Canvas>
      <div className="size-full overflow-auto bg-[#0a0e14] p-4 font-mono text-[11px] text-gray-200">
        <pre className="whitespace-pre-wrap break-words text-gray-400">
          {JSON.stringify(debugPayloads, null, 2)}
        </pre>
      </div>
    </Canvas>
  )
}
