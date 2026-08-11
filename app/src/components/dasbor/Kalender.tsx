import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { TanggalIndex } from '../../lib/dasbor/dataHarian'

interface KalenderProps {
  /**
   * Daftar tanggal tersedia (dari index.json — bukan spesifik World, dipakai
   * bersama Stocks/Broker/Sector). Catatan: instruksi awal menyebut
   * `string[]`, tapi badge nilai IHSG di tiap sel butuh {ihsg, ihsg_pct}, jadi
   * dipakai TanggalIndex[] (data index generik, tetap bukan World-specific).
   */
  tanggalTersedia: TanggalIndex[]
  tanggalAktif: string | null
  onPilih: (iso: string) => void
}

const BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const DOW_LABEL = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const WK_LABEL = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN']

/** Tanggal merah manual — port index_live.html baris 2431-2435. */
const HOLIDAYS: Record<string, string> = {
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-05-29': 'Kenaikan Isa Almasih',
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Kalender dasbor: week-strip + grid bulan + jam sesi bursa IDX + navigasi.
 * Port index_live.html baris 2413-2664. Reusable — tidak ada logika spesifik
 * World di sini, cuma butuh {tanggalTersedia, tanggalAktif, onPilih}.
 */
export function Kalender({ tanggalTersedia, tanggalAktif, onPilih }: KalenderProps) {
  const dataMap = useMemo(() => {
    const m = new Map<string, TanggalIndex>()
    tanggalTersedia.forEach((d) => m.set(d.date_iso, d))
    return m
  }, [tanggalTersedia])

  const bulanTersedia = useMemo(() => {
    const seen = new Map<string, { y: number; m: number }>()
    tanggalTersedia.forEach((d) => {
      const [y, m] = d.date_iso.split('-').map(Number)
      const key = `${y}-${m}`
      if (!seen.has(key)) seen.set(key, { y, m })
    })
    return [...seen.values()].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.m - b.m))
  }, [tanggalTersedia])

  const now0 = new Date()
  const [calYear, setCalYear] = useState(now0.getFullYear())
  const [calMonth, setCalMonth] = useState(now0.getMonth() + 1)

  // Loncat ke bulan tanggal aktif sekali saja saat data pertama kali masuk
  // (bukan tiap tanggalAktif berubah — supaya navigasi manual user tidak
  // ketimpa balik ke bulan data terbaru).
  const didInit = useRef(false)
  useEffect(() => {
    if (didInit.current || !tanggalAktif) return
    didInit.current = true
    const [y, m] = tanggalAktif.split('-').map(Number)
    setCalYear(y)
    setCalMonth(m)
  }, [tanggalAktif])

  function calNav(dir: number) {
    let y = calYear
    let m = calMonth + dir
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setCalYear(y)
    setCalMonth(m)
  }

  function calToday() {
    const n = new Date()
    setCalYear(n.getFullYear())
    setCalMonth(n.getMonth() + 1)
  }

  // ─── Grid bulan ──────────────────────────────────────────
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(calYear, calMonth, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // ─── Notice rentang data ─────────────────────────────────
  let notice: { icon: string; bg: string; border: string; color: string; text: ReactNode } | null = null
  if (bulanTersedia.length > 0) {
    const start = bulanTersedia[0]
    const end = bulanTersedia[bulanTersedia.length - 1]
    const cur = calYear * 100 + calMonth
    const curStart = start.y * 100 + start.m
    const curEnd = end.y * 100 + end.m
    const bulanStart = `${BULAN[start.m]} ${start.y}`
    const bulanEnd = `${BULAN[end.m]} ${end.y}`
    if (cur < curStart || cur > curEnd) {
      notice = {
        icon: '⚠️', bg: 'var(--red-bg)', border: 'var(--red)', color: 'var(--red-txt)',
        text: cur < curStart
          ? <strong>Data belum tersedia.</strong>
          : <><strong>Data belum tersedia untuk periode ini.</strong><br />Data tersedia dari <strong>{bulanStart}</strong> s/d <strong>{bulanEnd}</strong>. Data bulan berikutnya akan diperbarui secara berkala.</>,
      }
    } else {
      notice = {
        icon: '✅', bg: 'var(--green-bg)', border: 'var(--green)', color: 'var(--green-txt)',
        text: <><strong>Data tersedia:</strong> {bulanStart} — {bulanEnd} · Klik tanggal dengan latar hijau untuk melihat detail.</>,
      }
    }
  }

  // ─── Week strip ──────────────────────────────────────────
  const todayIso = new Date().toISOString().slice(0, 10)
  const weekBase = tanggalAktif ? new Date(`${tanggalAktif}T12:00:00`) : new Date()
  const wDow = weekBase.getDay()
  const monday = new Date(weekBase)
  monday.setDate(weekBase.getDate() + (wDow === 0 ? -6 : 1 - wDow))
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    return { iso, dayNum: d.getDate(), data: dataMap.get(iso), isWknd: i >= 5 }
  })

  // ─── Jam & sesi bursa ────────────────────────────────────
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const isFri = now.getDay() === 5
  const START = 8 * 60 + 45
  const sessions: [string, number, number, string][] = isFri ? [
    ['Pra', 8 * 60 + 45, 9 * 60, '#94a3b8'],
    ['Sesi I  09:00–11:30', 9 * 60, 11 * 60 + 30, '#0d9488'],
    ['Istirahat', 11 * 60 + 30, 14 * 60, '#64748b'],
    ['Sesi II  14:00–15:50', 14 * 60, 15 * 60 + 50, '#2563eb'],
    ['P', 15 * 60 + 50, 16 * 60, '#7c3aed'],
  ] : [
    ['Pra', 8 * 60 + 45, 9 * 60, '#94a3b8'],
    ['Sesi I  09:00–12:00', 9 * 60, 12 * 60, '#0d9488'],
    ['Istirahat', 12 * 60, 13 * 60 + 30, '#64748b'],
    ['Sesi II  13:30–15:50', 13 * 60 + 30, 15 * 60 + 50, '#2563eb'],
    ['P', 15 * 60 + 50, 16 * 60 + 15, '#7c3aed'],
  ]
  const timeLabels = isFri
    ? ['08:45', '09:00', '11:30', '14:00', '15:50', '16:00']
    : ['08:45', '09:00', '12:00', '13:30', '15:50', '16:15']
  const END = sessions[sessions.length - 1][2]
  const TOTAL = END - START
  const curMin = now.getHours() * 60 + now.getMinutes() - START
  const cursorPct = curMin >= 0 && curMin <= TOTAL ? (curMin / TOTAL) * 100 : null

  return (
    <div className="cal-wrap">
      <div className="wk-strip">
        {weekDays.map(({ iso, dayNum, data, isWknd }, i) => {
          const isToday = iso === todayIso
          const isSel = iso === (tanggalAktif ?? todayIso)
          const label = WK_LABEL[i]
          if (data) {
            const isUp = data.ihsg_pct >= 0
            return (
              <button
                key={iso}
                type="button"
                className={`wk-day wd-has${isSel ? ' wd-sel' : ''}${isToday ? ' wd-today' : ''}`}
                onClick={() => onPilih(iso)}
                title={`${iso}: IHSG ${data.ihsg.toLocaleString('id-ID')} ${isUp ? '+' : ''}${data.ihsg_pct.toFixed(2)}%`}
              >
                <span className="wd-lbl">{label}</span>
                <span className="wd-num">{dayNum}</span>
                <span className={`wd-pct ${isUp ? 'up' : 'dn'}`}>{isUp ? '+' : ''}{data.ihsg_pct.toFixed(2)}%</span>
              </button>
            )
          }
          return (
            <div key={iso} className={`wk-day wd-off${isToday ? ' wd-today' : ''}`}>
              <span className="wd-lbl" style={{ color: isWknd ? '#d32f2f' : undefined }}>{label}</span>
              <span className="wd-num">{dayNum}</span>
              <span className="wd-pct neu">—</span>
            </div>
          )
        })}
      </div>

      <div className="cal-header">
        <span className="cal-title">{BULAN[calMonth]} {calYear}</span>
        <div className="cal-nav">
          <button type="button" onClick={() => calNav(-1)}>‹ Prev</button>
          <button type="button" className="today" onClick={calToday}>Today</button>
          <button type="button" onClick={() => calNav(1)}>Next ›</button>
        </div>
      </div>

      {bulanTersedia.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {bulanTersedia.map(({ y, m }) => {
            const active = y === calYear && m === calMonth
            return (
              <button
                key={`${y}-${m}`}
                type="button"
                onClick={() => { setCalYear(y); setCalMonth(m) }}
                style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                  border: '0.5px solid var(--border2)', fontFamily: 'inherit',
                  background: active ? 'var(--accent)' : 'var(--bg3)',
                  color: active ? '#fff' : 'var(--text2)',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {BULAN[m].slice(0, 3)} {String(y).slice(2)}
              </button>
            )
          })}
        </div>
      )}

      <div className="cal-grid">
        {DOW_LABEL.map((d, i) => (
          <div key={d} className="cal-dow" style={i >= 5 ? { color: '#d32f2f' } : undefined}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="cal-day empty" />
          const iso = `${calYear}-${pad2(calMonth)}-${pad2(day)}`
          const dow = new Date(calYear, calMonth - 1, day).getDay()
          const isWeekend = dow === 0 || dow === 6
          const isHoliday = !!HOLIDAYS[iso]
          const data = dataMap.get(iso)
          const numEl = <span className="cal-day-num">{day}</span>

          if (data) {
            const isUp = data.ihsg_pct >= 0
            const pctStr = `${isUp ? '+' : ''}${data.ihsg_pct.toFixed(2)}%`
            return (
              <button
                key={iso}
                type="button"
                className={`cal-day has-data${iso === tanggalAktif ? ' selected' : ''}`}
                onClick={() => onPilih(iso)}
              >
                {numEl}
                <span className="cal-ihsg">{data.ihsg.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                <span className={`cal-pct ${isUp ? 'up' : 'dn'}`}>{pctStr}</span>
              </button>
            )
          }
          if (isWeekend) {
            return <div key={iso} className="cal-day holiday">{numEl}<span className="cal-label">{dow === 6 ? 'Sabtu' : 'Minggu'}</span></div>
          }
          if (isHoliday) {
            return <div key={iso} className="cal-day holiday">{numEl}<span className="cal-label">{HOLIDAYS[iso]}</span></div>
          }
          return <div key={iso} className="cal-day holiday">{numEl}<span className="cal-label">Bursa Libur</span></div>
        })}
      </div>

      {notice && (
        <div style={{ display: 'block', marginTop: 8, padding: '7px 10px', borderRadius: 6, fontSize: 10.5, lineHeight: 1.5, background: notice.bg, color: notice.color, border: `0.5px solid ${notice.border}` }}>
          {notice.icon} {notice.text}
        </div>
      )}

      <div className="sess-bar-wrap">
        <div className="sess-bar-title">
          <span>🕐 Sesi Bursa IDX (WIB)</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())} WIB
          </span>
        </div>
        <div className="sess-bar">
          {sessions.map(([lbl, s, e, col]) => (
            <div key={lbl} className="sess-seg" style={{ width: `${((e - s) / TOTAL * 100).toFixed(2)}%`, background: col }} title={lbl}>{lbl}</div>
          ))}
          {cursorPct !== null && <div className="sess-cursor" style={{ left: `${cursorPct}%` }} />}
        </div>
        <div className="sess-time-row">
          {timeLabels.map((l) => <span key={l} className="sess-time">{l}</span>)}
        </div>
      </div>
    </div>
  )
}
