import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { TanggalIndex } from '../../lib/dasbor/dataHarian'
import { PRESET_RENTANG, rentangPreset, type RentangTanggal } from '../../lib/dasbor/periode'
import { IkonMenu, IKON_PERINGATAN, IKON_CENTANG } from './IkonMenu'
import { Dropdown } from './Dropdown'
import { useSwipe } from './useSwipe'

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
  /**
   * 'penuh' (default) = panel kalender lengkap seperti semula (IndeksDunia,
   * dipasangkan grid2). 'strip' = bar tipis Konsep 1 mockup
   * kalender-3-konsep.html (.cal-strip-bar/.csb-*): tanggal aktif + IHSG,
   * sesi + jam live, strip 7 hari, tombol expand grid bulan penuh — dipakai
   * halaman standalone /stocks, /broker, /sector.
   */
  varian?: 'strip' | 'penuh'
  /**
   * Mode RENTANG (#75, varian strip): kalau prop ini diberikan, strip
   * menampilkan toggle "Hari | Rentang" + preset (1 Minggu/1 Bulan/3 Bulan/
   * YTD) + klik tanggal A→B di grid. Dipanggil dengan rentang lengkap saat
   * user memilih, dan `null` saat kembali ke mode Hari. Halaman tanpa prop
   * ini (IndeksDunia, varian penuh) TIDAK berubah sama sekali — backward
   * compat mutlak, default tetap mode Hari.
   */
  onRentang?: (r: RentangTanggal | null) => void
  rentangAktif?: RentangTanggal | null
}

const BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
// .dw (cal-strip) & .cg.hdr (cal-grid) sama-sama uppercase lewat CSS
// (text-transform), jadi satu daftar label ini cukup untuk keduanya.
// SEN–JUM saja: akhir pekan dibuang total dari kalender (bursa memang tutup,
// sel "Sab"/"Min" cuma noise — permintaan user, lanjutan #75).
const DOW_LABEL = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum']

/** Tanggal merah manual — port index_live.html baris 2431-2435. */
const HOLIDAYS: Record<string, string> = {
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-05-29': 'Kenaikan Isa Almasih',
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** "HH:MM" dari total menit sejak 00:00 — dipakai label jam sesi bursa
 * (diekspor: LoginModal pakai juga, jangan duplikat). */
export function fmtMenit(min: number) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
}

/**
 * Tanggal hari ini di zona WIB (Asia/Jakarta), BUKAN `toISOString()` (UTC) —
 * itu salah sebelum jam 07:00 WIB karena UTC masih tanggal "kemarin". Pakai
 * `Intl.DateTimeFormat` locale `en-CA` yang defaultnya sudah format
 * YYYY-MM-DD, jadi tidak perlu susun manual.
 */
export function todayIsoJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

/** [label, mulaiMenit, selesaiMenit, warna] — jam resmi IDX pasar reguler,
 * versi user-facing yang disederhanakan (Pra-Penutupan 15:50–16:02 mencakup
 * random closing 15:58–16:00 & matching 16:00–16:02 — detail di tooltip).
 * Jumat sesi lebih pendek, tapi Pra/Pasca-Penutupan sama semua hari (#30).
 * Koreksi feedback strip: Pasca-Penutupan mulai 16:02 (dulu salah 16:01 —
 * Pra-Penutupan matching berjalan s.d. 16:01:59). Batas kontigu, dicek
 * half-open [mulai, selesai) di sesiAktifPada. */
export function sesiUntukHari(isFri: boolean): [string, number, number, string][] {
  return isFri ? [
    ['Pra-Pembukaan', 8 * 60 + 45, 9 * 60, '#94a3b8'],
    ['Sesi I', 9 * 60, 11 * 60 + 30, '#0d9488'],
    ['Istirahat', 11 * 60 + 30, 14 * 60, '#64748b'],
    ['Sesi II', 14 * 60, 15 * 60 + 50, '#2563eb'],
    ['Pra-Penutupan', 15 * 60 + 50, 16 * 60 + 2, '#7c3aed'],
    ['Pasca-Penutupan', 16 * 60 + 2, 16 * 60 + 15, '#a855f7'],
  ] : [
    ['Pra-Pembukaan', 8 * 60 + 45, 9 * 60, '#94a3b8'],
    ['Sesi I', 9 * 60, 12 * 60, '#0d9488'],
    ['Istirahat', 12 * 60, 13 * 60 + 30, '#64748b'],
    ['Sesi II', 13 * 60 + 30, 15 * 60 + 50, '#2563eb'],
    ['Pra-Penutupan', 15 * 60 + 50, 16 * 60 + 2, '#7c3aed'],
    ['Pasca-Penutupan', 16 * 60 + 2, 16 * 60 + 15, '#a855f7'],
  ]
}

/** Cari sesi yang mencakup `nowMin` (menit sejak 00:00), half-open
 * [mulai, selesai) — batas antar sesi kontigu jadi tiap menit cuma milik
 * satu sesi (16:01 = Pra-Penutupan, 16:02 = Pasca-Penutupan, 16:15 = tutup).
 * Weekend = tutup total, tidak dicek jam sama sekali. */
export function sesiAktifPada(nowMin: number, isFri: boolean, isWeekendNow: boolean) {
  if (isWeekendNow) return undefined
  return sesiUntukHari(isFri).find(([, s, e]) => nowMin >= s && nowMin < e)
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** "2026-08-03" → "3 Agu" — label ringkas rentang (strip kalender + header
 * halaman mode rentang, jangan duplikat). */
export function fmtTanggalPendek(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

/** Label "<Hari> 08:45" pembukaan bursa berikutnya dari `now` — hari kerja
 * berikutnya (hari ini sendiri kalau belum 08:45). Jujur: libur nasional
 * TIDAK terdeteksi (tak ada tabel kalender libur bursa), cuma weekend yang
 * dilewati — pas libur nasional label ini bisa salah sehari. */
export function bukaBerikutnya(now: Date): string {
  const d = new Date(now)
  const lewatJamBuka = d.getHours() * 60 + d.getMinutes() >= 8 * 60 + 45
  if (lewatJamBuka || d.getDay() === 0 || d.getDay() === 6) {
    do { d.setDate(d.getDate() + 1) } while (d.getDay() === 0 || d.getDay() === 6)
  }
  return `${HARI[d.getDay()]} 08:45`
}

/**
 * Satu sumber jam & sesi bursa (feedback #2) — dipakai Kalender (strip +
 * penuh) dan LoginModal. `buka` = ada sesi aktif (istirahat termasuk buka;
 * di luar 08:45–16:15 hari kerja & weekend = tutup). Saat tutup, pemakai
 * WAJIB render info statis "Bursa Tutup · buka <hari> 08:45" alih-alih jam
 * berjalan (interval tetap jalan supaya tampilan bangun sendiri saat bursa
 * buka lagi, mis. tab dibiarkan semalaman).
 */
export function useJamBursa() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const isFri = now.getDay() === 5
  const isWeekendNow = now.getDay() === 0 || now.getDay() === 6
  const sessions = sesiUntukHari(isFri)
  const START = sessions[0][1]
  const END = sessions[sessions.length - 1][2]
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const sesi = sesiAktifPada(nowMin, isFri, isWeekendNow)
  const buka = sesi !== undefined
  return {
    now,
    sessions,
    START,
    END,
    sesi,
    buka,
    cursorPct: buka ? ((nowMin - START) / (END - START)) * 100 : null,
    jam: `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`,
    labelTutup: `buka ${bukaBerikutnya(now)}`,
  }
}

/**
 * Bar sesi bersegmen proporsional durasi nyata (feedback #3) — batas antar
 * segmen kelihatan, istirahat diarsir garis miring, segmen aktif amber +
 * marker posisi "sekarang". Presentational murni: data dari useJamBursa di
 * pemakainya. `labeled` menambah baris nama segmen di bawah bar (cuma segmen
 * lebar ≥15% yang muat teks; sisanya lewat title/tooltip).
 */
export function BarSesi({ sessions, aktif, cursorPct, labeled = false }: {
  sessions: [string, number, number, string][]
  aktif?: string
  cursorPct: number | null
  labeled?: boolean
}) {
  const total = sessions[sessions.length - 1][2] - sessions[0][1]
  const segs = sessions.map(([lbl, s, e]) => ({
    lbl,
    w: ((e - s) / total) * 100,
    title: `${lbl} ${fmtMenit(s)}–${fmtMenit(e)}${lbl === 'Pra-Penutupan' ? ' (random closing 15:58–16:00 · matching 16:00–16:02)' : ''}`,
  }))
  const bar = (
    <div className="sesi-bar">
      {segs.map(({ lbl, w, title }) => (
        <span
          key={lbl}
          className={`sb${lbl === 'Istirahat' ? ' rehat' : ''}${lbl === aktif ? ' on' : ''}`}
          style={{ width: `${w}%` }}
          title={title}
        />
      ))}
      {cursorPct != null && <span className="sb-now" style={{ left: `${cursorPct}%` }} aria-hidden="true" />}
    </div>
  )
  if (!labeled) return bar
  return (
    <div className="sesi-bar-wrap">
      {bar}
      <div className="sesi-bar-names" aria-hidden="true">
        {segs.map(({ lbl, w }) => (
          <span key={lbl} style={{ width: `${w}%` }}>{w >= 15 ? lbl : ''}</span>
        ))}
      </div>
    </div>
  )
}

/** Hari bursa sebelum/sesudah tanggal aktif, dari daftar tanggalTersedia
 * (index.json cuma berisi hari yang benar-benar ada datanya) — otomatis
 * skip weekend/libur tanpa tabel kalender bursa terpisah (#26). */
export function cariHariAdjacent(tanggal: TanggalIndex[], aktif: string | null) {
  const idx = aktif ? tanggal.findIndex((d) => d.date_iso === aktif) : -1
  return {
    sebelum: idx > 0 ? tanggal[idx - 1] : null,
    sesudah: idx >= 0 && idx < tanggal.length - 1 ? tanggal[idx + 1] : null,
  }
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
export function Kalender({ tanggalTersedia, tanggalAktif, onPilih, varian = 'penuh', onRentang, rentangAktif }: KalenderProps) {
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

  // ─── Expand grid bulan pada varian strip (#k1full mockup) ──
  const [stripOpen, setStripOpen] = useState(false)

  // ─── Mode RENTANG (#75) ──────────────────────────────────
  const [modeRentang, setModeRentang] = useState(!!rentangAktif)
  const [awalPilih, setAwalPilih] = useState<string | null>(null)
  const rentang = modeRentang ? (rentangAktif ?? null) : null

  // Sinkron modeRentang kalau rentangAktif berubah dari LUAR tanpa lewat
  // gantiMode/pilih di bawah — mis. tab "Rentang" panel Performa Sektor
  // (SektorIndeks.tsx) memanggil onRentang langsung. useState awal saja
  // cuma jalan sekali saat mount, tak cukup untuk perubahan susulan.
  // Pemakai lain (TopStocks dll) rentangAktif-nya cuma pernah berubah lewat
  // Kalender sendiri, jadi effect ini no-op buat mereka (nilai sudah sama).
  useEffect(() => {
    setModeRentang(!!rentangAktif)
  }, [rentangAktif])

  /** Satu pintu klik tanggal (grid + strip hari): mode Hari → onPilih biasa;
   * mode Rentang → klik pertama = awal, klik kedua = akhir (auto-urut). */
  function pilih(iso: string) {
    if (!modeRentang || !onRentang) {
      onPilih(iso)
      return
    }
    if (!awalPilih) {
      setAwalPilih(iso)
      return
    }
    if (awalPilih === iso) return
    const [a, b] = awalPilih < iso ? [awalPilih, iso] : [iso, awalPilih]
    setAwalPilih(null)
    onRentang({ mulai: a, akhir: b })
  }

  function gantiMode(keRentang: boolean) {
    if (!onRentang) return
    setModeRentang(keRentang)
    setAwalPilih(null)
    if (!keRentang) {
      onRentang(null)
    } else if (!rentangAktif) {
      // Auto-terapkan preset 1 Minggu supaya mode rentang tidak lahir kosong.
      const akhir = tanggalAktif ?? tanggalTersedia[tanggalTersedia.length - 1]?.date_iso
      if (akhir) onRentang(rentangPreset(tanggalTersedia, akhir, 'w1'))
    }
  }


  // ─── Tombol "Hari Ini" (#90) ─────────────────────────────
  // "Hari ini" versi bursa = entri TERAKHIR tanggalTersedia (hari berdata
  // terbaru), BUKAN Date() mentah — akhir pekan/libur tidak punya data.
  const hariTerkini = tanggalTersedia[tanggalTersedia.length - 1]?.date_iso ?? null
  // Redup hanya bila BENAR-BENAR tak ada yang bisa dilompati: tanggal aktif
  // sudah terkini DAN grid sedang menampilkan bulannya (user yang navigasi ke
  // bulan lain tetap bisa klik untuk balik ke bulan berjalan).
  const [thnTerkini, blnTerkini] = hariTerkini ? hariTerkini.split('-').map(Number) : [0, 0]
  const sudahHariIni = !modeRentang && hariTerkini !== null && tanggalAktif === hariTerkini
    && calYear === thnTerkini && calMonth === blnTerkini
  function keHariIni() {
    if (!hariTerkini) return
    if (modeRentang) {
      // Reset ke mode Hari (inline, bukan gantiMode(false) — gantiMode punya
      // guard !onRentang dan auto-preset yang tidak relevan di sini).
      setModeRentang(false)
      setAwalPilih(null)
      onRentang?.(null)
    }
    const [y, m] = hariTerkini.split('-').map(Number)
    setCalYear(y)
    setCalMonth(m)
    onPilih(hariTerkini)
  }

  // ─── Grid bulan (5 kolom SEN–JUM, akhir pekan dibuang) ───
  // Hanya hari kerja yang masuk sel; offset baris pertama = kolom hari kerja
  // pertama bulan itu. Minggu tanpa hari kerja otomatis tidak ada barisnya
  // (mis. bulan yang mulai Sabtu: baris pertamanya langsung Senin).
  const daysInMonth = new Date(calYear, calMonth, 0).getDate()
  const workdays: number[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(calYear, calMonth - 1, d).getDay()
    if (dow !== 0 && dow !== 6) workdays.push(d)
  }
  const startOffset = workdays.length > 0 ? new Date(calYear, calMonth - 1, workdays[0]).getDay() - 1 : 0
  const cells: (number | null)[] = [...Array<null>(startOffset).fill(null), ...workdays]

  // ─── Notice rentang data ─────────────────────────────────
  // Dipindah taruh (bawah .cal-grid) & bungkusnya sekarang .chip up/dn yang
  // sudah ada, bukan div berwarna inline — logic penentuan pesannya sendiri
  // tidak berubah.
  let notice: { icon: ReactNode; ok: boolean; text: ReactNode } | null = null
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
        icon: <IkonMenu d={IKON_PERINGATAN} size={14} />, ok: false,
        text: cur < curStart
          ? <strong>Data belum tersedia.</strong>
          : <><strong>Data belum tersedia untuk periode ini.</strong><br />Data tersedia dari <strong>{bulanStart}</strong> s/d <strong>{bulanEnd}</strong>. Data bulan berikutnya akan diperbarui secara berkala.</>,
      }
    } else {
      notice = {
        icon: <IkonMenu d={IKON_CENTANG} size={14} />, ok: true,
        text: <><strong>Data tersedia:</strong> {bulanStart} — {bulanEnd} · Klik tanggal berdata untuk melihat detail.</>,
      }
    }
  }

  // ─── Week strip (.cal-strip) ─────────────────────────────
  const todayIso = todayIsoJakarta()
  const weekBase = tanggalAktif ? new Date(`${tanggalAktif}T12:00:00`) : new Date()
  const wDow = weekBase.getDay()
  const monday = new Date(weekBase)
  monday.setDate(weekBase.getDate() + (wDow === 0 ? -6 : 1 - wDow))
  // 5 hari kerja saja — SAB/MIN tidak dirender (bursa tutup).
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    return { iso, dayNum: d.getDate(), data: dataMap.get(iso) }
  })

  // ─── Navigasi hari bursa prev/next (#26) ──────────────────
  const { sebelum: hariSebelum, sesudah: hariSesudah } = cariHariAdjacent(tanggalTersedia, tanggalAktif)
  function gotoHari(d: TanggalIndex) {
    const [y, m] = d.date_iso.split('-').map(Number)
    setCalYear(y)
    setCalMonth(m)
    onPilih(d.date_iso)
  }

  // ─── Swipe horizontal (#97, mobile) ──────────────────────
  // Strip hari: swipe kiri = hari bursa berikutnya, kanan = sebelumnya
  // (mode Rentang tidak diubah — swipe diabaikan). Grid bulan: ganti bulan.
  const swipeHari = useSwipe((arah) => {
    if (modeRentang) return
    const t = arah === 1 ? hariSesudah : hariSebelum
    if (t) gotoHari(t)
  })
  const swipeBulan = useSwipe((arah) => {
    const d = new Date(calYear, calMonth - 1 + arah, 1)
    setCalYear(d.getFullYear())
    setCalMonth(d.getMonth() + 1)
  })

  // ─── Jam & sesi bursa — satu sumber useJamBursa (dipakai juga LoginModal) ──
  const { sessions, START, END, sesi: sesiTuple, buka, cursorPct, jam: jamDigital, labelTutup } = useJamBursa()
  const sesiAktif = sesiTuple?.[0] ?? 'Bursa Tutup'

  // ─── Potongan JSX yang dipakai kedua varian (penuh & strip) ──
  // Dropdown bulan — komponen bersama (#82). `placeholder` menjaga perilaku
  // lama: tombol tetap menampilkan bulan berjalan walau di luar rentang data.
  const ddBulan = (
    <Dropdown
      opsi={bulanTersedia.map(({ y, m }) => ({ nilai: `${y}-${m}`, label: `${BULAN[m]} ${y}` }))}
      nilai={`${calYear}-${calMonth}`}
      placeholder={`${BULAN[calMonth]} ${calYear}`}
      ariaLabel="Pilih bulan kalender"
      onGanti={(v) => {
        const [y, m] = v.split('-').map(Number)
        setCalYear(y)
        setCalMonth(m)
      }}
    />
  )

  // Tombol lompat cepat ke tanggal bursa terkini (#90) — dipakai kedua
  // varian; redup bila tanggal aktif sudah hari terkini (mode Hari).
  const btnHariIni = (
    <button
      type="button"
      className="csb-more"
      disabled={sudahHariIni || !hariTerkini}
      onClick={keHariIni}
      title="Lompat ke tanggal bursa terkini"
    >
      Hari Ini
    </button>
  )

  const hariNav = (
    <div className="hari-nav">
          <button
            type="button"
            className="dd-btn"
            disabled={!hariSebelum}
            onClick={() => hariSebelum && gotoHari(hariSebelum)}
            aria-label="Hari bursa sebelumnya"
            title="Hari bursa sebelumnya"
          >
            <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span className="hari-nav-lbl">
            {tanggalAktif ? (dataMap.get(tanggalAktif)?.date_id ?? tanggalAktif) : '—'}
          </span>
          <button
            type="button"
            className="dd-btn"
            disabled={!hariSesudah}
            onClick={() => hariSesudah && gotoHari(hariSesudah)}
            aria-label="Hari bursa berikutnya"
            title="Hari bursa berikutnya"
          >
            <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
          </button>
    </div>
  )

  const calGrid = (
    <div className="cal-grid" {...swipeBulan}>
      {DOW_LABEL.map((d) => (
        <div key={d} className="cg hdr">{d}</div>
      ))}
      {cells.map((day, i) => {
        if (day === null) return <div key={`e${i}`} className="cg" />
        const iso = `${calYear}-${pad2(calMonth)}-${pad2(day)}`
        const isHoliday = !!HOLIDAYS[iso]
        const data = dataMap.get(iso)

        if (data) {
          const isUp = data.ihsg_pct >= 0
          // Mode Rentang: ujung rentang + tanggal awal yang sedang menunggu
          // klik kedua = amber solid (.aktif); tanggal di antaranya = .dlm
          // (amber-dim). Mode Hari: perilaku lama.
          const ujung = rentang !== null && (iso === rentang.mulai || iso === rentang.akhir)
          const isAktif = modeRentang ? (ujung || iso === awalPilih) : iso === tanggalAktif
          const dlm = rentang !== null && !ujung && iso > rentang.mulai && iso < rentang.akhir
          return (
            <button
              key={iso}
              type="button"
              className={`cg ada${isAktif ? ' aktif' : ''}${dlm ? ' dlm' : ''}`}
              onClick={() => pilih(iso)}
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

        // Sel tanpa data BUKAN otomatis "Bursa Libur" (keluhan user 14 Agu:
        // tanggal yang belum terjadi pun ikut dilabeli libur — menyesatkan,
        // apalagi tabel HOLIDAYS cuma memuat segelintir tanggal merah).
        // Empat keadaan dibedakan jujur; akhir pekan sudah dibuang dari `cells`.
        const hariIni = todayIsoJakarta()
        let label: string | null
        let tip: string
        if (isHoliday) {
          label = 'Libur'
          tip = HOLIDAYS[iso]
        } else if (iso > hariIni) {
          label = null // belum terjadi — jangan mengaku tahu apa pun
          tip = 'Belum berlangsung'
        } else if (iso === hariIni) {
          label = 'Menunggu'
          tip = 'Sesi hari ini belum ditutup atau datanya belum masuk'
        } else {
          label = 'Tanpa data'
          tip = 'Tidak ada data untuk tanggal ini — libur bursa atau data belum dipanen'
        }
        return (
          <div
            key={iso}
            className={`cg${label === null ? ' depan' : ''}`}
            title={tip}
            style={{ flexDirection: 'column', height: 'auto', minHeight: 28, lineHeight: 1.15, gap: 1 }}
          >
            <span>{day}</span>
            {label && <span style={{ fontSize: 7 }}>{label}</span>}
          </div>
        )
      })}
    </div>
  )

  const noticeEl = notice && (
    <div
      className={`chip ${notice.ok ? 'up' : 'dn'}`}
      style={{ display: 'flex', marginTop: 10, whiteSpace: 'normal', textAlign: 'left', lineHeight: 1.5, height: 'auto' }}
    >
      <span>{notice.icon} {notice.text}</span>
    </div>
  )

  // ─── Varian STRIP — port Konsep 1 mockup kalender-3-konsep.html ──
  if (varian === 'strip') {
    const aktifData = tanggalAktif ? dataMap.get(tanggalAktif) : undefined
    const tglLabel = tanggalAktif
      ? new Date(`${tanggalAktif}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
      : '—'
    // Ringkasan rentang: close IHSG ujung awal vs akhir (dari index.json,
    // tanpa fetch tambahan).
    const dMulai = rentang ? dataMap.get(rentang.mulai) : undefined
    const dAkhir = rentang ? dataMap.get(rentang.akhir) : undefined
    const pctRentang = dMulai && dAkhir ? (dAkhir.ihsg / dMulai.ihsg - 1) * 100 : null
    // Akhir acuan preset: rentang aktif → ujung akhirnya; kalau belum ada,
    // tanggal aktif / tanggal berdata terbaru.
    const akhirPreset = rentang?.akhir ?? tanggalAktif ?? tanggalTersedia[tanggalTersedia.length - 1]?.date_iso
    return (
      <div className="panel">
        <div className="cal-strip-bar">
          <div className="csb-now">
            {rentang ? (
              <>
                <span className="tgl">{fmtTanggalPendek(rentang.mulai)} – {fmtTanggalPendek(rentang.akhir)}</span>
                {pctRentang != null && (
                  <span className="ihsg num">
                    IHSG{' '}
                    <span className={pctRentang >= 0 ? 'up' : 'dn'}>
                      {pctRentang >= 0 ? '+' : ''}{pctRentang.toFixed(2)}%
                    </span>
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="tgl">{tglLabel}</span>
                {aktifData && (
                  <span className="ihsg num">
                    {aktifData.ihsg.toLocaleString('id-ID', { maximumFractionDigits: 0 })}{' '}
                    <span className={aktifData.ihsg_pct >= 0 ? 'up' : 'dn'}>
                      {aktifData.ihsg_pct >= 0 ? '+' : ''}{aktifData.ihsg_pct.toFixed(2)}%
                    </span>
                  </span>
                )}
              </>
            )}
          </div>
          <div className="csb-sesi">
            <span style={{ color: sesiTuple?.[3], fontWeight: 700, whiteSpace: 'nowrap' }}>{sesiAktif}</span>
            {/* Bar melebar (flex:1) sampai dekat strip hari + berlabel —
                segmen jeda waktu kebaca (feedback ronde 2). */}
            <BarSesi sessions={sessions} aktif={sesiTuple?.[0]} cursorPct={cursorPct} labeled />
            {/* Jam detik cuma jalan selama bursa buka; di luar itu info statis
                pembukaan berikutnya (feedback #2). */}
            {buka
              ? <b className="num">{jamDigital}</b>
              : <span style={{ whiteSpace: 'nowrap' }}>{labelTutup}</span>}
          </div>
          <div className="csb-hari" {...swipeHari}>
            {/* Stepper ‹ › per-hari bursa (#97) — konsisten dengan hariNav
                grid penuh; disembunyikan di mode Rentang (tidak berubah). */}
            {!modeRentang && (
              <button
                type="button"
                className="dd-btn"
                disabled={!hariSebelum}
                onClick={() => hariSebelum && gotoHari(hariSebelum)}
                aria-label="Hari bursa sebelumnya"
                title="Hari bursa sebelumnya"
              >
                <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
            )}
            {weekDays.map(({ iso, dayNum, data }, i) => {
              const isAktifHari = rentang
                ? iso === rentang.mulai || iso === rentang.akhir
                : iso === tanggalAktif
              const cls = `csb-d${isAktifHari ? ' aktif' : ''}${data ? '' : ' off'}`
              const inner = (dp: ReactNode) => (
                <>
                  <span className="dw">{DOW_LABEL[i]}</span>
                  <span className="dd">{dayNum}</span>
                  {dp}
                </>
              )
              if (!data) {
                return <span key={iso} className={cls}>{inner(<span className="dp">·</span>)}</span>
              }
              const isUp = data.ihsg_pct >= 0
              return (
                <button
                  key={iso}
                  type="button"
                  className={cls}
                  onClick={() => pilih(iso)}
                  title={`${iso}: IHSG ${data.ihsg.toLocaleString('id-ID')} ${isUp ? '+' : ''}${data.ihsg_pct.toFixed(2)}%`}
                >
                  {inner(
                    <span className={`dp${isAktifHari ? '' : isUp ? ' up' : ' dn'}`}>
                      {isUp ? '+' : ''}{data.ihsg_pct.toFixed(2)}%
                    </span>,
                  )}
                </button>
              )
            })}
            {!modeRentang && (
              <button
                type="button"
                className="dd-btn"
                disabled={!hariSesudah}
                onClick={() => hariSesudah && gotoHari(hariSesudah)}
                aria-label="Hari bursa berikutnya"
                title="Hari bursa berikutnya"
              >
                <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            )}
          </div>
          {btnHariIni}
          {onRentang && (
            <div className="tabs mode-tgl" role="tablist" aria-label="Mode pemilihan tanggal">
              <button type="button" role="tab" aria-selected={!modeRentang} className={'tab' + (modeRentang ? '' : ' on')} onClick={() => gantiMode(false)}>Hari</button>
              <button type="button" role="tab" aria-selected={modeRentang} className={'tab' + (modeRentang ? ' on' : '')} onClick={() => gantiMode(true)}>Rentang</button>
            </div>
          )}
          <button type="button" className="csb-more" onClick={() => setStripOpen((v) => !v)}>
            {stripOpen ? 'Tutup kalender ▴' : 'Kalender penuh ▾'}
          </button>
        </div>
        {modeRentang && onRentang && (
          <div className="cal-rentang-bar">
            {PRESET_RENTANG.map((p) => {
              const r = akhirPreset ? rentangPreset(tanggalTersedia, akhirPreset, p.id) : null
              const on = !!(r && rentang && r.mulai === rentang.mulai && r.akhir === rentang.akhir)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`chip-t${on ? ' on' : ''}`}
                  disabled={!r}
                  onClick={() => r && onRentang(r)}
                >
                  {p.label}
                </button>
              )
            })}
            <span className="crb-hint">
              {awalPilih
                ? <>Awal: <b>{fmtTanggalPendek(awalPilih)}</b> — klik tanggal akhir di grid kalender</>
                : 'Rentang bebas: klik 2 tanggal di kalender penuh'}
            </span>
          </div>
        )}
        {stripOpen && (
          <div className="csb-full">
            {/* Kolom kiri: grid bulan (cap 448px seperti semula). */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <span className="lbl">Kalender Bursa</span>
                {ddBulan}
              </div>
              {hariNav}
              {calGrid}
            </div>
            {/* Kolom kanan (feedback #1 — dulu kosong melompong): dua sub-blok
                berdampingan yang mengisi sisa lebar strip — bar sesi bersegmen
                berlabel + legenda jam resmi, dan statistik mini tanggal
                terpilih + notice rentang data. Di layar sempit sub-blok turun
                jadi satu kolom (auto-fit). */}
            <div className="csb-kanan">
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <span className="lbl">Sesi Perdagangan</span>
                  <span className="num" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                    {buka ? `${jamDigital} WIB` : `Bursa Tutup · ${labelTutup}`}
                  </span>
                </div>
                <BarSesi sessions={sessions} aktif={sesiTuple?.[0]} cursorPct={cursorPct} labeled />
                <div className="sesi-legend">
                  {sessions.map(([lbl, s, e, warna]) => (
                    <div
                      key={lbl}
                      className={`sl${sesiTuple?.[0] === lbl ? ' on' : ''}`}
                      title={lbl === 'Pra-Penutupan' ? 'Random closing 15:58–16:00 · matching 16:00–16:02' : undefined}
                    >
                      <i style={{ background: warna }} />
                      <span>{lbl}</span>
                      <b className="num">{fmtMenit(s)}–{fmtMenit(e)}</b>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                {aktifData && (
                  <div className="csb-stat">
                    <span className="lbl">Tanggal Terpilih</span>
                    <div className="baris"><span>Tanggal</span><b>{aktifData.date_id || aktifData.date_iso}</b></div>
                    <div className="baris">
                      <span>IHSG Penutupan</span>
                      <b className="num">{aktifData.ihsg.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                    </div>
                    <div className="baris">
                      <span>Perubahan Harian</span>
                      <b className={`num ${aktifData.ihsg_pct >= 0 ? 'up' : 'dn'}`}>
                        {aktifData.ihsg_pct >= 0 ? '+' : ''}{aktifData.ihsg_pct.toFixed(2)}%
                      </b>
                    </div>
                    <div className="baris"><span>Hari bursa ke</span><b className="num">{aktifData.trading_day}</b></div>
                  </div>
                )}
                {noticeEl}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Varian PENUH — tampilan lama, tidak berubah ──
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="lbl">Kalender Bursa</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {btnHariIni}
          {ddBulan}
        </div>
      </div>

      <div className="panel-b">
        {hariNav}

        <div className="cal-strip" {...swipeHari}>
          {weekDays.map(({ iso, dayNum, data }, i) => {
            const isToday = iso === todayIso
            const isAktifHari = iso === tanggalAktif
            const cls = `cal-d${isToday ? ' today' : ''}${isAktifHari ? ' aktif' : ''}`
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

        <div className="sesi-status">
          <span style={{ color: sesiTuple?.[3], fontWeight: 700 }}>{sesiAktif}</span>
          {/* Jam detik cuma jalan selama bursa buka (feedback #2). */}
          <span className="sesi-jam">{buka ? `${jamDigital} WIB` : labelTutup}</span>
        </div>
        <div className="sesi">
          <span>{fmtMenit(START)}</span>
          <BarSesi sessions={sessions} aktif={sesiTuple?.[0]} cursorPct={cursorPct} labeled />
          <span>{fmtMenit(END)}</span>
        </div>

        {calGrid}

        {noticeEl}
      </div>
    </div>
  )
}
