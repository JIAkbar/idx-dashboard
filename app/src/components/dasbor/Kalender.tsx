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
// .dw (cal-strip) & .cg.hdr (cal-grid) sama-sama uppercase lewat CSS
// (text-transform), jadi satu daftar label ini cukup untuk keduanya.
const DOW_LABEL = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

/** Tanggal merah manual — port index_live.html baris 2431-2435. */
const HOLIDAYS: Record<string, string> = {
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-05-29': 'Kenaikan Isa Almasih',
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Kalender dasbor: dropdown bulan + week-strip + jam sesi bursa IDX + grid
 * bulan — struktur DOM & className mengikuti markup artifact asli
 * (docs/design-lantai-bursa-reimagined.html:394-417 — `.panel`/`.panel-h`/
 * `.panel-b`/`.dd`/`.cal-strip`/`.cal-d`/`.sesi`/`.cal-grid` `.cg`, semua
 * sudah ada verbatim di lantai.css sejak Task 1). Satu penyimpangan sadar
 * dari artifact: sel `.cg.ada` menampilkan harga+persen IHSG (3 baris),
 * bukan kosong seperti demo statis artifact — instruksi eksplisit
 * sebelumnya ("seperti di web lama ada harga dan persentasenya").
 * Reusable — tidak ada logika spesifik World di sini, cuma butuh
 * {tanggalTersedia, tanggalAktif, onPilih}.
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

  // ─── Dropdown bulan (.dd) ──────────────────────────────────
  const [ddOpen, setDdOpen] = useState(false)
  const ddRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  // ─── Grid bulan ──────────────────────────────────────────
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(calYear, calMonth, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // ─── Notice rentang data ─────────────────────────────────
  // Dipindah taruh (bawah .cal-grid) & bungkusnya sekarang .chip up/dn yang
  // sudah ada, bukan div berwarna inline — logic penentuan pesannya sendiri
  // tidak berubah.
  let notice: { icon: string; ok: boolean; text: ReactNode } | null = null
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
        icon: '⚠️', ok: false,
        text: cur < curStart
          ? <strong>Data belum tersedia.</strong>
          : <><strong>Data belum tersedia untuk periode ini.</strong><br />Data tersedia dari <strong>{bulanStart}</strong> s/d <strong>{bulanEnd}</strong>. Data bulan berikutnya akan diperbarui secara berkala.</>,
      }
    } else {
      notice = {
        icon: '✅', ok: true,
        text: <><strong>Data tersedia:</strong> {bulanStart} — {bulanEnd} · Klik tanggal berdata untuk melihat detail.</>,
      }
    }
  }

  // ─── Week strip (.cal-strip) ─────────────────────────────
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
    <div className="panel">
      <div className="panel-h">
        <span className="lbl">Kalender Bursa</span>
        <div className={`dd${ddOpen ? ' open' : ''}`} ref={ddRef}>
          <button type="button" className="dd-btn" onClick={() => setDdOpen((v) => !v)}>
            {BULAN[calMonth]} {calYear}
            <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div className="dd-menu">
            {bulanTersedia.map(({ y, m }) => {
              const active = y === calYear && m === calMonth
              return (
                <button
                  key={`${y}-${m}`}
                  type="button"
                  className={`dd-it${active ? ' sel' : ''}`}
                  onClick={() => { setCalYear(y); setCalMonth(m); setDdOpen(false) }}
                >
                  {BULAN[m]} {y}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="panel-b">
        <div className="cal-strip">
          {weekDays.map(({ iso, dayNum, data, isWknd }, i) => {
            const isToday = iso === todayIso
            const cls = `cal-d${isToday ? ' today' : ''}${isWknd ? ' off' : ''}`
            const inner = (
              <>
                <div className="dw">{DOW_LABEL[i]}</div>
                <div className="dn2">{dayNum}</div>
              </>
            )
            if (data) {
              const isUp = data.ihsg_pct >= 0
              return (
                <button
                  key={iso}
                  type="button"
                  className={cls}
                  onClick={() => onPilih(iso)}
                  title={`${iso}: IHSG ${data.ihsg.toLocaleString('id-ID')} ${isUp ? '+' : ''}${data.ihsg_pct.toFixed(2)}%`}
                >
                  {inner}
                </button>
              )
            }
            return <div key={iso} className={cls}>{inner}</div>
          })}
        </div>

        <div className="sesi">
          <span>{timeLabels[0]}</span>
          <div className="seg"><i style={{ width: `${cursorPct ?? (curMin < 0 ? 0 : 100)}%` }} /></div>
          <span>{timeLabels[timeLabels.length - 1]}</span>
        </div>

        <div className="cal-grid">
          {DOW_LABEL.map((d, i) => (
            <div key={d} className="cg hdr" style={i >= 5 ? { color: '#d32f2f' } : undefined}>{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} className="cg" />
            const iso = `${calYear}-${pad2(calMonth)}-${pad2(day)}`
            const dow = new Date(calYear, calMonth - 1, day).getDay()
            const isWeekend = dow === 0 || dow === 6
            const isHoliday = !!HOLIDAYS[iso]
            const data = dataMap.get(iso)

            if (data) {
              const isUp = data.ihsg_pct >= 0
              const isAktif = iso === tanggalAktif
              return (
                <button
                  key={iso}
                  type="button"
                  className={`cg ada${isAktif ? ' aktif' : ''}`}
                  onClick={() => onPilih(iso)}
                >
                  <span>{day}</span>
                  <span className="num" style={{ fontSize: 9 }}>
                    {data.ihsg.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </span>
                  <span
                    className="num"
                    style={{ fontSize: 9, fontWeight: 700, color: isAktif ? undefined : `var(--${isUp ? 'green' : 'red'})` }}
                  >
                    {isUp ? '+' : ''}{data.ihsg_pct.toFixed(2)}%
                  </span>
                </button>
              )
            }

            // .cg tanpa .ada didesain artifact untuk 1 baris (28px) — label
            // libur karenanya disingkat supaya muat 2 baris kecil.
            const label = isWeekend ? (dow === 6 ? 'Sab' : 'Min') : isHoliday ? 'Libur' : 'Bursa Libur'
            return (
              <div
                key={iso}
                className="cg"
                title={isHoliday ? HOLIDAYS[iso] : undefined}
                style={{ flexDirection: 'column', height: 'auto', minHeight: 28, lineHeight: 1.15, gap: 1 }}
              >
                <span>{day}</span>
                <span style={{ fontSize: 7 }}>{label}</span>
              </div>
            )
          })}
        </div>

        {notice && (
          <div
            className={`chip ${notice.ok ? 'up' : 'dn'}`}
            style={{ display: 'flex', marginTop: 10, whiteSpace: 'normal', textAlign: 'left', lineHeight: 1.5, height: 'auto' }}
          >
            <span>{notice.icon} {notice.text}</span>
          </div>
        )}
      </div>
    </div>
  )
}
