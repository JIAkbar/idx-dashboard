/**
 * Jam bursa & helper tanggal untuk halaman harian.
 *
 * Dulu berkas ini rumah hero `Kalender` (861 baris: grid bulan ber-IHSG, bar
 * sesi, panel tanggal terpilih, mode rentang). Hero itu dibuang 2 Sep 2026
 * atas keputusan Johan — *"D + E digabung"* — dan digantikan `BilahTanggal`
 * (komposisi stepper + DatePicker + preset rentang). Yang tersisa di sini
 * murni logika: sesi perdagangan, jam berjalan (`useJamBursa`, dipakai pita
 * kurs untuk status bursa), format tanggal, dan `cariHariAdjacent`. Nama
 * berkasnya dipertahankan supaya pengimpor (tanyaPapan, uji) tak ikut
 * berubah di commit yang sama; boleh diganti `jamBursa.ts` belakangan.
 */
import { useEffect, useState } from 'react'
import type { TanggalIndex } from '../../lib/dasbor/dataHarian'
import { HOLIDAYS, todayIsoJakarta } from '../../lib/tanggalBursa'

export { HOLIDAYS }

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** "HH:MM" dari total menit sejak 00:00 — dipakai label jam sesi bursa
 * (diekspor: LoginModal pakai juga, jangan duplikat). */
export function fmtMenit(min: number) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
}

/** Pindah rumah ke `lib/tanggalBursa.ts` bersama HOLIDAYS — halaman admin
 *  butuh "hari ini WIB" tanpa ikut menyeret komponen kalender dasbor. Diekspor
 *  ulang dari sini karena tanyaPapan.ts & uji Kalender sudah memakai jalur ini. */
export { todayIsoJakarta }

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
