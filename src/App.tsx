import { createClient } from "@supabase/supabase-js"
import { useEffect } from "react"
import { useState } from "react"
import { PRODUCT } from "./product"

interface Reading {
  id: number | string
  value: number
  created_at: string
}

type RealtimeStatus = "disconnected" | "connecting" | "connected" | "error"

const MAX_POINTS = 60
const CHART_WIDTH = 720
const CHART_HEIGHT = 220
const CHART_PADDING = { top: 8, right: 8, bottom: 24, left: 44 }

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

function normalizeReading(row: unknown): Reading | null {
  if (!row || typeof row !== "object") return null
  const record = row as Record<string, unknown>
  const value = Number(record.value)
  if (
    (typeof record.id !== "number" && typeof record.id !== "string") ||
    !Number.isFinite(value) ||
    typeof record.created_at !== "string" ||
    !Number.isFinite(Date.parse(record.created_at))
  ) {
    return null
  }
  return {
    id: record.id,
    value,
    created_at: record.created_at,
  }
}

function mergeReadings(current: Reading[], incoming: Reading[]): Reading[] {
  const byId = new Map(current.map((reading) => [String(reading.id), reading]))
  incoming.forEach((reading) => byId.set(String(reading.id), reading))
  return [...byId.values()]
    .sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at),
    )
    .slice(-MAX_POINTS)
}

function createDemoReadings(): Reading[] {
  const now = Date.now()
  return Array.from({ length: 28 }, (_, index) => ({
    id: `demo-${index}`,
    value: Math.round(
      49 + Math.sin(index / 2.6) * 8 + Math.sin(index / 1.3) * 3,
    ),
    created_at: new Date(now - (27 - index) * 2000).toISOString(),
  }))
}

function formatValue(value: number | undefined): string {
  return value === undefined ? "—" : Math.round(value).toLocaleString("ko-KR")
}

function formatInterval(readings: Reading[]): string {
  if (readings.length < 2) return "—"
  const first = Date.parse(readings[0].created_at)
  const last = Date.parse(readings.at(-1)!.created_at)
  const seconds = (last - first) / (readings.length - 1) / 1000
  if (!Number.isFinite(seconds) || seconds <= 0) return "—"
  return seconds < 10 ? `${seconds.toFixed(1)}초` : `${Math.round(seconds)}초`
}

function statusContent(status: RealtimeStatus) {
  if (status === "connecting") {
    return { label: "연결 중", className: "status status--connecting" }
  }
  if (status === "connected") {
    return { label: "연결됨", className: "status status--connected" }
  }
  if (status === "error") {
    return { label: "연결 실패, 다시 시도", className: "status status--error" }
  }
  return { label: "연결 안 됨", className: "status status--disconnected" }
}

function ProductHeader() {
  return (
    <header className="product-header">
      <h1 className="product-name">{PRODUCT.name}</h1>
      <p className="product-concept">{PRODUCT.concept}</p>
      <p className="product-description">{PRODUCT.description}</p>
    </header>
  )
}

function Metric({
  label,
  value,
  unit,
  emphasis = false,
}: {
  label: string
  value: string
  unit?: string
  emphasis?: boolean
}) {
  return (
    <div className={emphasis ? "metric metric--emphasis" : "metric"}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">
        {value}
        {unit && <span className="metric-unit">{unit}</span>}
      </p>
    </div>
  )
}

function ConnectionControl({
  status,
  power,
  onToggle,
}: {
  status: RealtimeStatus
  power: boolean
  onToggle: () => void
}) {
  const content = statusContent(status)
  const buttonLabel =
    status === "error" ? "다시 연결" : power ? "센서 연결 끊기" : "센서 연결"

  return (
    <section className="connection-control" aria-label="센서 연결">
      <div>
        <p className="control-name">센서</p>
        <p className={content.className} role="status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          {content.label}
        </p>
      </div>
      <button
        className={
          power ? "control-button control-button--off" : "control-button"
        }
        type="button"
        disabled={status === "connecting"}
        onClick={onToggle}
      >
        {buttonLabel}
      </button>
    </section>
  )
}

function SensorChart({ readings }: { readings: Reading[] }) {
  const values = readings.map((reading) => reading.value)
  const dataMin = values.length ? Math.min(...values) : 20
  const dataMax = values.length ? Math.max(...values) : 80
  const scalePadding = Math.max((dataMax - dataMin) * 0.18, 6)
  const minValue = Math.max(0, Math.floor((dataMin - scalePadding) / 10) * 10)
  const maxValue = Math.max(
    minValue + 20,
    Math.ceil((dataMax + scalePadding) / 10) * 10,
  )
  const gridValues = [maxValue, Math.round((maxValue + minValue) / 2), minValue]
  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? CHART_WIDTH - CHART_PADDING.right
        : CHART_PADDING.left +
          (index / (values.length - 1)) *
            (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right)
    const y =
      CHART_PADDING.top +
      ((maxValue - value) / (maxValue - minValue)) *
        (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom)
    return { x, y }
  })
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")
  const currentValue = values.at(-1)

  return (
    <section className="chart" aria-label="실시간 소음 변화">
      {values.length ? (
        <svg
          className="chart-svg"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={`소음 변화, 현재 ${formatValue(currentValue)} 데시벨`}
        >
          {gridValues.map((value) => {
            const y =
              CHART_PADDING.top +
              ((maxValue - value) / (maxValue - minValue)) *
                (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom)
            return (
              <g key={value}>
                <line
                  className="chart-grid"
                  x1={CHART_PADDING.left}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y1={y}
                  y2={y}
                />
                <text
                  className="chart-axis"
                  x={CHART_PADDING.left - 8}
                  y={y + 4}
                  textAnchor="end"
                >
                  {value}
                </text>
              </g>
            )
          })}
          <path className="chart-line" d={linePath} />
          {points.at(-1) && (
            <circle
              className="chart-point"
              cx={points.at(-1)!.x}
              cy={points.at(-1)!.y}
              r="5"
            />
          )}
          <text
            className="chart-axis"
            x={CHART_PADDING.left}
            y={CHART_HEIGHT - 2}
          >
            이전
          </text>
          <text
            className="chart-axis"
            x={CHART_WIDTH - CHART_PADDING.right}
            y={CHART_HEIGHT - 2}
            textAnchor="end"
          >
            지금
          </text>
        </svg>
      ) : (
        <p className="chart-empty">
          센서를 연결하면 소음 변화가 여기에 그려집니다.
        </p>
      )}
    </section>
  )
}

function App() {
  const [status, setStatus] = useState<RealtimeStatus>("disconnected")
  const [power, setPower] = useState(true)
  const [readings, setReadings] = useState<Reading[]>([])

  useEffect(() => {
    document.title = PRODUCT.name
  }, [])

  useEffect(() => {
    let active = true
    let demoTimer: ReturnType<typeof setInterval> | undefined

    if (!power) {
      setStatus("disconnected")
      return
    }

    setStatus("connecting")

    if (!supabase) {
      setReadings((current) =>
        current.length ? current : createDemoReadings(),
      )
      setStatus("connected")
      demoTimer = setInterval(() => {
        const time = Date.now()
        const next: Reading = {
          id: `demo-${time}`,
          value: Math.round(
            50 + Math.sin(time / 4800) * 9 + Math.sin(time / 1700) * 3,
          ),
          created_at: new Date(time).toISOString(),
        }
        setReadings((current) => mergeReadings(current, [next]))
      }, 2000)
      return () => clearInterval(demoTimer)
    }

    const channel = supabase
      .channel("readings-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings" },
        (payload) => {
          if (!active) return
          const reading = normalizeReading(payload.new)
          if (!reading) {
            setStatus("error")
            return
          }
          setReadings((current) => mergeReadings(current, [reading]))
        },
      )
      .subscribe((nextStatus) => {
        if (!active) return
        if (nextStatus === "SUBSCRIBED") {
          setStatus("connected")
        } else if (
          nextStatus === "CHANNEL_ERROR" ||
          nextStatus === "TIMED_OUT" ||
          nextStatus === "CLOSED"
        ) {
          setStatus("error")
        }
      })

    const loadReadings = async () => {
      try {
        const { data, error } = await supabase
          .from("readings")
          .select("id, value, created_at")
          .order("created_at", { ascending: false })
          .limit(MAX_POINTS)
        if (!active) return
        if (error) {
          setStatus("error")
          return
        }
        const initialReadings = (data ?? [])
          .map((row) => normalizeReading(row))
          .filter((row): row is Reading => row !== null)
        setReadings((current) => mergeReadings(current, initialReadings))
      } catch {
        if (active) setStatus("error")
      }
    }
    void loadReadings()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [power])

  const values = readings.map((reading) => reading.value)
  const currentValue = values.at(-1)
  const average = values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : undefined
  const peak = values.length ? Math.max(...values) : undefined
  const latest = readings.at(-1)

  const handleConnectionToggle = () => {
    if (status === "error") {
      setPower(false)
      window.setTimeout(() => setPower(true), 0)
      return
    }
    setPower((current) => !current)
  }

  return (
    <main className="app-shell">
      <ProductHeader />

      <section className="current-reading" aria-label="현재 소음 수치">
        <Metric
          label="현재 소음"
          value={formatValue(currentValue)}
          unit="dB"
          emphasis
        />
        <p className="current-context">
          {currentValue === undefined
            ? "측정값을 기다리고 있습니다"
            : currentValue < 40
              ? "조용한 공간입니다"
              : currentValue < 70
                ? "일상적인 소음 범위입니다"
                : "주변 소음이 큰 편입니다"}
        </p>
      </section>

      <section className="data-layout" aria-label="소음 측정 정보">
        <div className="metrics">
          <Metric label="평균 소음" value={formatValue(average)} unit="dB" />
          <Metric label="최고 소음" value={formatValue(peak)} unit="dB" />
          <Metric label="측정 주기" value={formatInterval(readings)} />
        </div>
        <SensorChart readings={readings} />
      </section>

      <ConnectionControl
        status={status}
        power={power}
        onToggle={handleConnectionToggle}
      />

      <footer className="app-footer">
        <p>
          {supabase
            ? latest
              ? `마지막 측정 ${new Date(latest.created_at).toLocaleString("ko-KR")}`
              : "측정값 대기 중"
            : "데모 데이터로 표시 중"}
        </p>
        <p>최근 측정값 {readings.length}개</p>
      </footer>
    </main>
  )
}

export default App
