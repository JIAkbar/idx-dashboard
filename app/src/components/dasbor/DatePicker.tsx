import { useEffect, useMemo, useRef, useState } from 'react'
import { IkonMenu, IKON_KALENDER } from './IkonMenu'
import { useSwipe } from './useSwipe'
import { alasanBukanHariBursa } from '../../lib/tanggalBursa'
import './DatePicker.css'

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum']

const pad = (n: number) => String(n).padStart(2, '0')
const keIso = (t: number, b: number, d: number) => `${t}-${pad(b + 1)}-${pad(d)}`

function urai(iso: string): { t: number; b: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? { t: +m[1], b: +m[2] - 1, d: +m[3] } : null
}

/**
 * Date picker custom pengganti `<input type="date">` native — picker bawaan
 * browser tidak ikut token tema Lantai (Chrome selalu putih di mode gelap).
 * Pola buka/tutup meniru Dropdown.tsx (klik luar + Escape menutup), popover
 * menumpang primitif `.dd`/`.dd-menu`; grid bulan meniru layout Kalender.tsx
 * (Senin dulu, akhir pekan diredupkan) tanpa menyentuh file itu.
 * Nilai masuk/keluar tetap string ISO `YYYY-MM-DD` — kompatibel penuh dengan
 * pemakaian input date sebelumnya.
 */
export function DatePicker({ value, onChange, tersedia, maks, ariaLabel, rata = 'kiri', tanda }: {
  value: string
  onChange: (iso: string) => void
  /** Kalau diisi: hanya tanggal di set ini yang bisa dipilih (hari ber-data),
   *  sisanya disabled — dipakai pemilih tanggal /broker-summary (#79C). */
  tersedia?: ReadonlySet<string>
  /** Kalau diisi (ISO YYYY-MM-DD): tanggal setelahnya disabled — dipakai form
   *  unggah admin (#101) supaya orderbook masa depan tak bisa dipilih di UI
   *  (server tetap sumber kebenaran; ini cuma cegah kesalahan klik). */
  maks?: string
  ariaLabel?: string
  /** 'kanan' = popover rata kanan tombol — untuk pemicu dekat tepi kanan
   *  layar (header /broker-summary) supaya tidak terpotong viewport. */
  rata?: 'kiri' | 'kanan'
  /** Opsional — tanggal (ISO) → jumlah, dasar lencana kecil di sudut sel
   *  (mis. setoran menunggu kurasi). Tak diisi = tak ada perubahan tampilan
   *  sama sekali dari perilaku sebelumnya (dipakai banyak halaman lain). */
  tanda?: ReadonlyMap<string, number>
}) {
  const [open, setOpen] = useState(false)
  const kini = new Date()
  const vAwal = urai(value)
  const [tahun, setTahun] = useState(vAwal ? vAwal.t : kini.getFullYear())
  const [bulan, setBulan] = useState(vAwal ? vAwal.b : kini.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Escape saat popover terbuka cuma menutup popover — jangan merambat
        // ke modal induk (ModalKecil juga mendengarkan Escape di window).
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function buka() {
    // Saat dibuka, bulan tampil disinkronkan lagi ke nilai terpilih.
    const v = urai(value)
    if (v) {
      setTahun(v.t)
      setBulan(v.b)
    }
    setOpen((o) => !o)
  }

  function geser(arah: -1 | 1) {
    const d = new Date(tahun, bulan + arah, 1)
    setTahun(d.getFullYear())
    setBulan(d.getMonth())
  }

  // ─── Stepper hari ber-data ‹ › (#97) — cuma saat `tersedia` ada. ────────
  // Set → array terurut sekali per perubahan; prev = terbesar < value,
  // next = terkecil > value — otomatis lompat akhir pekan/tanggal kosong.
  const daftar = useMemo(() => (tersedia ? [...tersedia].sort() : null), [tersedia])
  const isoPrev = daftar && value ? [...daftar].reverse().find((d) => d < value) : undefined
  const isoNext = daftar && value ? daftar.find((d) => d > value) : undefined

  // Panah kiri/kanan saat fokus di trigger juga menggeser (#97).
  function onKeyTrigger(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft' && isoPrev) { e.preventDefault(); onChange(isoPrev) }
    else if (e.key === 'ArrowRight' && isoNext) { e.preventDefault(); onChange(isoNext) }
  }

  // Swipe horizontal di popover = ganti bulan tampil (#97, mobile).
  const swipeBulan = useSwipe(geser)

  // Grid 5 kolom SEN–JUM — Sabtu/Minggu dibuang (bursa tutup), konsisten
  // dengan Kalender dasbor. Setiap pekan menyumbang tepat 5 hari kerja,
  // jadi setelah offset baris pertama, aliran grid otomatis rapi.
  const jumlahHari = new Date(tahun, bulan + 1, 0).getDate()
  const hariKerja: number[] = []
  for (let d = 1; d <= jumlahHari; d++) {
    if (((new Date(tahun, bulan, d).getDay() + 6) % 7) < 5) hariKerja.push(d)
  }
  // Kolom (0=Sen..4=Jum) hari kerja pertama bulan ini → sel kosong pembuka.
  const offset = hariKerja.length ? (new Date(tahun, bulan, hariKerja[0]).getDay() + 6) % 7 : 0
  const isoIni = keIso(kini.getFullYear(), kini.getMonth(), kini.getDate())

  const v = urai(value)
  const labelNilai = v ? `${v.d} ${NAMA_BULAN[v.b].slice(0, 3)} ${v.t}` : 'Pilih tanggal'

  // Stepper dirender mengapit field, di luar .dd supaya popover tetap
  // menempel pas di bawah field (bukan di bawah stepper).
  const stepper = (arah: -1 | 1) => {
    const iso = arah === -1 ? isoPrev : isoNext
    const label = arah === -1 ? 'Tanggal ber-data sebelumnya' : 'Tanggal ber-data berikutnya'
    return (
      <button type="button" className="dpk-step" disabled={!iso} aria-label={label} title={label} onClick={() => iso && onChange(iso)}>
        <svg viewBox="0 0 24 24"><path d={arah === -1 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} /></svg>
      </button>
    )
  }

  return (
    <div className="dpk-wrap" ref={ref}>
      {daftar && stepper(-1)}
      <div className={`dd dpk${open ? ' open' : ''}${rata === 'kanan' ? ' dpk-kanan' : ''}`}>
      <button type="button" className="inp dpk-btn" aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel} onClick={buka} onKeyDown={onKeyTrigger}>
        <IkonMenu d={IKON_KALENDER} size={14} />
        <span>{labelNilai}</span>
      </button>
      <div className="dd-menu dpk-pop" role="dialog" aria-label="Pilih tanggal" {...swipeBulan}>
        <div className="dpk-head">
          <button type="button" className="dpk-nav" aria-label="Bulan sebelumnya" onClick={() => geser(-1)}>
            <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span className="dpk-bulan">{NAMA_BULAN[bulan]} {tahun}</span>
          <button type="button" className="dpk-nav" aria-label="Bulan berikutnya" onClick={() => geser(1)}>
            <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
        <div className="dpk-grid">
          {NAMA_HARI.map((h) => <span key={h} className="dpk-dow">{h}</span>)}
          {Array.from({ length: offset }, (_, i) => <span key={`k${i}`} />)}
          {hariKerja.map((d) => {
            const iso = keIso(tahun, bulan, d)
            const jmlTanda = tanda?.get(iso) ?? 0
            // Hari libur bursa DIREDUPKAN, bukan dimatikan. Ia tetap bisa
            // diklik: aturannya "peringatan, bukan larangan" — mungkin ada
            // kasus sah yang belum terbayang, dan mengunci tanggalnya cuma
            // menghasilkan orang buntu tanpa jalan keluar. Semua DatePicker di
            // aplikasi ini memilih tanggal bursa, jadi tandanya benar di semua
            // pemakaian dan tak perlu prop baru untuk menyalakannya.
            const alasanLibur = alasanBukanHariBursa(iso)
            const cls = [
              'dpk-hari',
              iso === isoIni ? ' now' : '',
              iso === value ? ' sel' : '',
              jmlTanda > 0 ? ' bertanda' : '',
              alasanLibur ? ' libur' : '',
            ].join('')
            const lewatMaks = maks !== undefined && iso > maks
            const nonaktif = (tersedia ? !tersedia.has(iso) : false) || lewatMaks
            const judul = lewatMaks
              ? 'Tanggal masa depan tidak diterima'
              : tersedia && !tersedia.has(iso)
                ? 'Tidak ada data pada tanggal ini'
                : alasanLibur
                  ? `${alasanLibur} — bukan hari bursa`
                  : jmlTanda > 0
                    ? `${jmlTanda} setoran menunggu kurasi`
                    : undefined
            return (
              <button
                key={iso}
                type="button"
                className={cls}
                disabled={nonaktif}
                title={judul}
                aria-label={judul ? `${d} — ${judul}` : undefined}
                onClick={() => { onChange(iso); setOpen(false) }}
              >
                {d}
                {jmlTanda > 0 && <span className="dpk-tanda" aria-hidden="true">{jmlTanda > 9 ? '9+' : jmlTanda}</span>}
              </button>
            )
          })}
        </div>
      </div>
      </div>
      {daftar && stepper(1)}
    </div>
  )
}
