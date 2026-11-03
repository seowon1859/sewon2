import { createClient } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

interface Reading {
  id: number | string
  value: number
  created_at: string
}

type RealtimeStatus = "connecting" | "connected" | "disconnected"

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
    .slice(-100)
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 13v-2M8 17V7M12 20V4M16 17V7M20 13v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function App() {
  const [readings, setReadings] = useState<Reading[]>([])
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting")
  const [connectionError, setConnectionError] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const values = readings.map((reading) => reading.value)
  const isConnected = realtimeStatus === "connected"
  const chartWidth = 720
  const chartHeight = 280
  const padding = { top: 22, right: 18, bottom: 18, left: 42 }
  const dataMin = values.length ? Math.min(...values) : 20
  const dataMax = values.length ? Math.max(...values) : 100
  const scalePadding = Math.max((dataMax - dataMin) * 0.1, 5)
  const minValue = values.length
    ? Math.floor((dataMin - scalePadding) / 10) * 10
    : 20
  const maxValue = values.length
    ? Math.ceil((dataMax + scalePadding) / 10) * 10
    : 100
  const gridValues = Array.from({ length: 5 }, (_, index) =>
    Math.round(maxValue - ((maxValue - minValue) * index) / 4),
  )
  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? chartWidth - padding.right
        : padding.left +
          (index / (values.length - 1)) *
            (chartWidth - padding.left - padding.right)
    const boundedValue = Math.min(maxValue, Math.max(minValue, value))
    const y =
      padding.top +
      ((maxValue - boundedValue) / (maxValue - minValue)) *
        (chartHeight - padding.top - padding.bottom)
    return { x, y, value }
  })
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")
  const areaPath = points.length
    ? `${linePath} L ${points.at(-1)?.x} ${chartHeight - padding.bottom} L ${points[0].x} ${chartHeight - padding.bottom} Z`
    : ""
  const average = values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null
  const peak = values.length ? Math.max(...values) : null
  const currentValue = values.at(-1)
  const statusLabel =
    currentValue === undefined
      ? "대기 중"
      : currentValue < 40
        ? "조용함"
        : currentValue < 70
          ? "보통"
          : "주의"
  const soundDescription =
    currentValue === undefined
      ? "Supabase에서 측정 데이터를 기다리고 있어요"
      : currentValue < 40
        ? "조용한 환경이에요"
        : currentValue < 70
          ? "대화 소리와 비슷한 수준이에요"
          : "주변 소음이 큰 편이에요"
  const levelPosition =
    currentValue === undefined
      ? 0
      : Math.min(100, Math.max(0, ((currentValue - 30) / 70) * 100))
  const chartLabel =
    readings.length > 0
      ? `최근 ${readings.length}개 · Supabase Realtime`
      : "Supabase에서 측정 데이터를 기다리는 중"
  const realtimeStatusText =
    realtimeStatus === "connected"
      ? "Supabase 실시간 연결됨"
      : realtimeStatus === "connecting"
        ? "Supabase 연결 중"
        : "Supabase 연결 끊김"
  const timeLabels = values.length
    ? Array.from(
        new Set(
          [0, 0.2, 0.4, 0.6, 0.8, 1].map((fraction) =>
            Math.round((values.length - 1) * fraction),
          ),
        ),
      ).map((index) => ({
        index,
        label: new Date(readings[index].created_at).toLocaleTimeString(
          "ko-KR",
          { hour: "2-digit", minute: "2-digit", second: "2-digit" },
        ),
      }))
    : []

  useEffect(() => {
    let active = true
    if (!supabase) {
      setRealtimeStatus("disconnected")
      setConnectionError(
        ".env에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해 주세요.",
      )
      return
    }

    setRealtimeStatus("connecting")
    const channel = supabase
      .channel("readings-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings" },
        (payload) => {
          const reading = normalizeReading(payload.new)
          if (!reading) {
            setConnectionError(
              "새 readings 행에 id, value, created_at 값이 있는지 확인해 주세요.",
            )
            return
          }
          setReadings((current) => mergeReadings(current, [reading]))
          setLastUpdated(new Date(reading.created_at))
        },
      )
      .subscribe((status) => {
        if (!active) return
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected")
          setConnectionError("")
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRealtimeStatus("disconnected")
          setConnectionError(
            "Supabase Realtime 구독에 실패했습니다. readings 테이블을 supabase_realtime publication에 추가하고 SELECT 권한을 확인해 주세요.",
          )
        }
      })

    const loadReadings = async () => {
      try {
        const { data, error } = await supabase
          .from("readings")
          .select("id, value, created_at")
          .order("created_at", { ascending: false })
          .limit(100)
        if (!active) return
        if (error) {
          setConnectionError(`readings 조회 실패: ${error.message}`)
          return
        }

        const initialReadings = (data ?? [])
          .map((row) => normalizeReading(row))
          .filter((row): row is Reading => row !== null)
        setReadings((current) => mergeReadings(current, initialReadings))
        if (initialReadings.length > 0) {
          const newest = initialReadings.reduce((latest, row) =>
            Date.parse(row.created_at) > Date.parse(latest.created_at)
              ? row
              : latest,
          )
          setLastUpdated(new Date(newest.created_at))
        }
      } catch (error) {
        if (!active) return
        setConnectionError(
          `readings 조회 실패: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }
    void loadReadings()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [])

  return (
    <main className="min-h-screen bg-[#f3f5f2] text-[#17201b]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[248px] shrink-0 border-r border-[#dfe4df] bg-[#f9faf8] px-5 py-7 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#173e2c] text-[#c7f55b]">
              <WaveIcon />
            </span>
            <div>
              <p className="text-[15px] font-extrabold tracking-[-0.03em]">
                Soundary
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a958e]">
                Noise Monitor
              </p>
            </div>
          </div>

          <nav className="mt-12 space-y-2 text-sm" aria-label="주요 메뉴">
            <a
              className="flex items-center gap-3 rounded-xl bg-[#e4edd9] px-4 py-3 font-bold text-[#173e2c]"
              href="#dashboard"
            >
              <span className="h-2 w-2 rounded-full bg-[#4b7a55]" />
              대시보드
            </a>
            <a
              className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-[#758078] transition hover:bg-white"
              href="#history"
            >
              <span className="h-2 w-2 rounded-full border border-current" />
              측정 기록
            </a>
            <a
              className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-[#758078] transition hover:bg-white"
              href="#devices"
            >
              <span className="h-2 w-2 rounded-full border border-current" />
              센서 관리
            </a>
          </nav>

          <div className="mt-auto rounded-2xl border border-[#dfe5dd] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">센서 상태</span>
              <span
                className={`h-2 w-2 rounded-full shadow-[0_0_0_4px_#e4f3e6] ${
                  isConnected ? "bg-[#55a762]" : "bg-[#a2aaa4]"
                }`}
              />
            </div>
            <p className="mt-3 text-sm font-extrabold">SOUND-01</p>
            <p className="mt-0.5 text-xs text-[#89928c]">
              회의실 A · {realtimeStatusText}
            </p>
          </div>
        </aside>

        <section
          id="dashboard"
          className="min-w-0 flex-1 px-5 py-5 sm:px-8 sm:py-8 xl:px-12 xl:py-10"
        >
          <header className="flex items-start justify-between gap-5">
            <div>
              <div className="mb-4 flex items-center gap-2 lg:hidden">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#173e2c] text-[#c7f55b]">
                  <WaveIcon />
                </span>
                <span className="text-sm font-extrabold">Soundary</span>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#879089]">
                Live monitoring
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                소리 센서 대시보드
              </h1>
              <p className="mt-2 text-sm text-[#77817a]">
                회의실 A의 소음 상태를 실시간으로 확인하세요.
              </p>
            </div>
            <div
              className="mt-1 flex shrink-0 items-center gap-2 rounded-full border border-[#dce2dc] bg-white px-4 py-2 text-xs font-bold text-[#526057] shadow-sm"
              aria-live="polite"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-[#57a964]" : "bg-[#a2aaa4]"
                }`}
              />
              {realtimeStatusText}
            </div>
          </header>
          {connectionError && (
            <p
              className="mt-3 rounded-xl border border-[#efd5ce] bg-[#fff7f4] px-4 py-3 text-sm text-[#9b4935]"
              role="alert"
            >
              {connectionError}
            </p>
          )}

          <div className="mt-8 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
            <article className="relative min-h-[410px] overflow-hidden rounded-[28px] bg-[#173e2c] p-7 text-white shadow-[0_24px_50px_rgba(29,60,45,0.16)] sm:p-9">
              <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full border-[38px] border-white/[0.035]" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">
                      Current sound level
                    </p>
                    <p className="mt-2 text-sm font-bold text-white/90">
                      현재 소음도
                    </p>
                  </div>
                  <span className="rounded-full bg-[#c7f55b] px-3 py-1.5 text-xs font-extrabold text-[#173e2c]">
                    {statusLabel}
                  </span>
                </div>

                <div className="my-auto py-10">
                  <div className="flex items-end gap-3">
                    <span className="text-[90px] font-black leading-none tracking-[-0.075em] tabular-nums sm:text-[108px]">
                      {currentValue ?? "--"}
                    </span>
                    <span className="mb-3 text-xl font-bold text-white/60">
                      dB
                    </span>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
                    <span className="inline-block h-px w-6 bg-[#c7f55b]" />
                    {soundDescription}
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-[11px] font-bold text-white/45">
                    <span>조용함</span>
                    <span>주의</span>
                    <span>위험</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#79c88a] to-[#c7f55b]"
                      style={{ width: `${levelPosition}%` }}
                    />
                    <span
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#173e2c] bg-white shadow"
                      style={{ left: `${levelPosition}%` }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between text-[10px] tabular-nums text-white/35">
                    <span>30 dB</span>
                    <span>70 dB</span>
                    <span>100 dB</span>
                  </div>
                </div>
              </div>
            </article>

            <article className="min-w-0 rounded-[28px] border border-[#e0e5e0] bg-white p-5 shadow-[0_16px_45px_rgba(31,45,36,0.055)] sm:p-7">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-lg font-extrabold tracking-[-0.025em]">
                    소음 변화
                  </p>
                  <p className="mt-1 text-xs text-[#89918c]">{chartLabel}</p>
                </div>
                <span className="w-fit rounded-xl bg-[#f1f3f0] px-3 py-2 text-xs font-bold text-[#4e5c53]">
                  최근 100개
                </span>
              </div>

              <div className="mt-6 overflow-hidden">
                <svg
                  className="w-full"
                  viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
                  role="img"
                  aria-label={`${chartLabel} 소음 변화 선 그래프`}
                >
                  <defs>
                    <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5f9c70" stopOpacity=".26" />
                      <stop offset="100%" stopColor="#5f9c70" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {gridValues.map((value) => {
                    const y =
                      padding.top +
                      ((maxValue - value) / (maxValue - minValue)) *
                        (chartHeight - padding.top - padding.bottom)
                    return (
                      <g key={value}>
                        <line
                          x1={padding.left}
                          x2={chartWidth - padding.right}
                          y1={y}
                          y2={y}
                          stroke="#e9ede9"
                          strokeWidth="1"
                        />
                        <text
                          x="0"
                          y={y + 4}
                          fill="#9aa39d"
                          fontSize="10"
                          fontWeight="600"
                        >
                          {value} dB
                        </text>
                      </g>
                    )
                  })}
                  {areaPath && <path d={areaPath} fill="url(#chartArea)" />}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#477b58"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {points.slice(-1).map((point) => (
                    <circle
                      key={`${point.x}-${point.value}`}
                      cx={point.x}
                      cy={point.y}
                      r={5.5}
                      fill="#c7f55b"
                      stroke="#477b58"
                      strokeWidth={3}
                    />
                  ))}
                  {timeLabels.map(({ index, label }) => (
                    <text
                      key={`${index}-${label}`}
                      x={
                        values.length === 1
                          ? chartWidth - padding.right
                          : padding.left +
                            (index / (values.length - 1)) *
                              (chartWidth - padding.left - padding.right)
                      }
                      y={chartHeight + 18}
                      textAnchor={
                        index === 0
                          ? "start"
                          : index === values.length - 1
                            ? "end"
                            : "middle"
                      }
                      fill="#9aa39d"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {label}
                    </text>
                  ))}
                  {values.length === 0 && (
                    <text
                      x={chartWidth / 2}
                      y={chartHeight / 2}
                      textAnchor="middle"
                      fill="#89918c"
                      fontSize="13"
                      fontWeight="600"
                    >
                      아직 저장된 측정값이 없습니다
                    </text>
                  )}
                </svg>
              </div>
            </article>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <article className="rounded-2xl border border-[#e0e5e0] bg-white p-5">
              <p className="text-xs font-bold text-[#8a938d]">평균 소음</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-black tracking-[-0.04em] tabular-nums">
                  {average ?? "--"}
                  <span className="ml-1 text-sm text-[#8a938d]">dB</span>
                </p>
                <span className="text-xs font-bold text-[#568061]">안정적</span>
              </div>
            </article>
            <article className="rounded-2xl border border-[#e0e5e0] bg-white p-5">
              <p className="text-xs font-bold text-[#8a938d]">최고 소음</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-black tracking-[-0.04em] tabular-nums">
                  {peak ?? "--"}
                  <span className="ml-1 text-sm text-[#8a938d]">dB</span>
                </p>
                <span className="text-xs font-medium text-[#8a938d]">
                  {lastUpdated
                    ? lastUpdated.toLocaleTimeString("ko-KR")
                    : "기록 없음"}
                </span>
              </div>
            </article>
            <article className="rounded-2xl border border-[#e0e5e0] bg-white p-5">
              <p className="text-xs font-bold text-[#8a938d]">측정 주기</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-black tracking-[-0.04em] tabular-nums">
                  {readings.length}
                  <span className="ml-1 text-sm text-[#8a938d]">개</span>
                </p>
                <span className="rounded-full bg-[#edf5e9] px-2.5 py-1 text-[11px] font-bold text-[#4f7a59]">
                  최대 100개 표시
                </span>
              </div>
            </article>
          </div>

          <footer className="mt-6 flex flex-col justify-between gap-2 border-t border-[#dde3dd] pt-5 text-[11px] text-[#919a94] sm:flex-row">
            <p>
              {lastUpdated
                ? `마지막 업데이트: ${lastUpdated.toLocaleString("ko-KR")}`
                : "마지막 업데이트: 측정값 대기 중"}
            </p>
            <p>Supabase readings의 새 행을 Realtime으로 구독합니다.</p>
          </footer>
        </section>
      </div>
    </main>
  )
}

export default App
