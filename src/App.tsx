import { useState } from "react"

type Range = "실시간" | "24시간" | "7일"

const soundData: Record<Range, {
  label: string
  values: number[]
  times: string[]
}> = {
  실시간: {
    label: "최근 30분",
    values: [42, 45, 44, 51, 48, 55, 53, 59, 57, 62, 58, 64, 61, 68, 66, 68],
    times: ["14:00", "14:06", "14:12", "14:18", "14:24", "14:30"],
  },
  "24시간": {
    label: "오늘 00:00부터",
    values: [37, 35, 34, 36, 42, 48, 55, 61, 58, 64, 62, 57, 54, 59, 65, 68],
    times: ["00시", "05시", "10시", "15시", "20시", "현재"],
  },
  "7일": {
    label: "최근 7일 평균",
    values: [48, 52, 46, 58, 55, 63, 59, 61, 57, 64, 60, 67, 62, 58, 65, 68],
    times: ["월", "화", "수", "목", "금", "토"],
  },
}

const ranges: Range[] = ["실시간", "24시간", "7일"]

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
  const [range, setRange] = useState<Range>("실시간")
  const dataset = soundData[range]
  const chartWidth = 720
  const chartHeight = 280
  const padding = { top: 22, right: 18, bottom: 18, left: 42 }
  const minValue = 20
  const maxValue = 100
  const points = dataset.values.map((value, index) => {
    const x =
      padding.left +
      (index / (dataset.values.length - 1)) *
        (chartWidth - padding.left - padding.right)
    const y =
      padding.top +
      ((maxValue - value) / (maxValue - minValue)) *
        (chartHeight - padding.top - padding.bottom)
    return { x, y, value }
  })
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")
  const areaPath = `${linePath} L ${points.at(-1)?.x} ${chartHeight - padding.bottom} L ${points[0].x} ${chartHeight - padding.bottom} Z`
  const average = Math.round(
    dataset.values.reduce((sum, value) => sum + value, 0) /
      dataset.values.length,
  )
  const peak = Math.max(...dataset.values)

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
              <span className="h-2 w-2 rounded-full bg-[#55a762] shadow-[0_0_0_4px_#e4f3e6]" />
            </div>
            <p className="mt-3 text-sm font-extrabold">SOUND-01</p>
            <p className="mt-0.5 text-xs text-[#89928c]">회의실 A · 연결됨</p>
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
            <div className="mt-1 hidden items-center gap-2 rounded-full border border-[#dce2dc] bg-white px-4 py-2 text-xs font-bold text-[#526057] shadow-sm sm:flex">
              <span className="h-2 w-2 rounded-full bg-[#57a964]" />
              실시간 수집 중
            </div>
          </header>

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
                    보통
                  </span>
                </div>

                <div className="my-auto py-10">
                  <div className="flex items-end gap-3">
                    <span className="text-[90px] font-black leading-none tracking-[-0.075em] tabular-nums sm:text-[108px]">
                      68
                    </span>
                    <span className="mb-3 text-xl font-bold text-white/60">
                      dB
                    </span>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
                    <span className="inline-block h-px w-6 bg-[#c7f55b]" />
                    대화 소리와 비슷한 수준이에요
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-[11px] font-bold text-white/45">
                    <span>조용함</span>
                    <span>주의</span>
                    <span>위험</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/10">
                    <div className="h-full w-[60%] rounded-full bg-gradient-to-r from-[#79c88a] to-[#c7f55b]" />
                    <span className="absolute top-1/2 left-[60%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#173e2c] bg-white shadow" />
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
                  <p className="mt-1 text-xs text-[#89918c]">
                    {dataset.label} · 예시 데이터
                  </p>
                </div>
                <div
                  className="flex w-fit rounded-xl bg-[#f1f3f0] p-1"
                  aria-label="조회 기간"
                >
                  {ranges.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={range === item}
                      onClick={() => setRange(item)}
                      className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                        range === item
                          ? "bg-white text-[#173e2c] shadow-sm"
                          : "text-[#89918c] hover:text-[#4e5c53]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 overflow-hidden">
                <svg
                  className="w-full"
                  viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
                  role="img"
                  aria-label={`${dataset.label} 소음 변화 선 그래프`}
                >
                  <defs>
                    <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5f9c70" stopOpacity=".26" />
                      <stop offset="100%" stopColor="#5f9c70" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[20, 40, 60, 80, 100].map((value) => {
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
                  <path d={areaPath} fill="url(#chartArea)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#477b58"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((point, index) => (
                    <circle
                      key={`${point.x}-${point.value}`}
                      cx={point.x}
                      cy={point.y}
                      r={index === points.length - 1 ? 5.5 : 2.5}
                      fill={index === points.length - 1 ? "#c7f55b" : "#ffffff"}
                      stroke="#477b58"
                      strokeWidth={index === points.length - 1 ? 3 : 2}
                    />
                  ))}
                  {dataset.times.map((time, index) => (
                    <text
                      key={time}
                      x={
                        padding.left +
                        (index / (dataset.times.length - 1)) *
                          (chartWidth - padding.left - padding.right)
                      }
                      y={chartHeight + 18}
                      textAnchor={
                        index === 0
                          ? "start"
                          : index === dataset.times.length - 1
                            ? "end"
                            : "middle"
                      }
                      fill="#9aa39d"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {time}
                    </text>
                  ))}
                </svg>
              </div>
            </article>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <article className="rounded-2xl border border-[#e0e5e0] bg-white p-5">
              <p className="text-xs font-bold text-[#8a938d]">평균 소음</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-black tracking-[-0.04em] tabular-nums">
                  {average}
                  <span className="ml-1 text-sm text-[#8a938d]">dB</span>
                </p>
                <span className="text-xs font-bold text-[#568061]">안정적</span>
              </div>
            </article>
            <article className="rounded-2xl border border-[#e0e5e0] bg-white p-5">
              <p className="text-xs font-bold text-[#8a938d]">최고 소음</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-black tracking-[-0.04em] tabular-nums">
                  {peak}
                  <span className="ml-1 text-sm text-[#8a938d]">dB</span>
                </p>
                <span className="text-xs font-medium text-[#8a938d]">
                  14:27 기록
                </span>
              </div>
            </article>
            <article className="rounded-2xl border border-[#e0e5e0] bg-white p-5">
              <p className="text-xs font-bold text-[#8a938d]">측정 주기</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-black tracking-[-0.04em] tabular-nums">
                  2<span className="ml-1 text-sm text-[#8a938d]">초</span>
                </p>
                <span className="rounded-full bg-[#edf5e9] px-2.5 py-1 text-[11px] font-bold text-[#4f7a59]">
                  정상 수집
                </span>
              </div>
            </article>
          </div>

          <footer className="mt-6 flex flex-col justify-between gap-2 border-t border-[#dde3dd] pt-5 text-[11px] text-[#919a94] sm:flex-row">
            <p>마지막 업데이트: 2025. 06. 18. 오후 2:30:12</p>
            <p>현재 표시된 값은 화면 구성을 위한 예시 데이터입니다.</p>
          </footer>
        </section>
      </div>
    </main>
  )
}

export default App
