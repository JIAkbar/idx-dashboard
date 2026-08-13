import { useEffect, useRef, useState } from 'react'
import { IkonMenu, IKON_KALENDER } from './IkonMenu'
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
export function DatePicker({ value, onChange, tersedia, ariaLabel, rata = 'kiri' }: {
  value: string
  onChange: (iso: string) => void
  /** Kalau diisi: hanya tanggal di set ini yang bisa dipilih (hari ber-data),
   *  sisanya disabled — dipakai pemilih tanggal /broker-summary (#79C). */
  tersedia?: ReadonlySet<string>
  ariaLabel?: string
  /** 'kanan' = popover rata kanan tombol — untuk pemicu dekat tepi kanan
   *  layar (header /broker-summary) supaya tidak terpotong viewport. */
  rata?: 'kiri' | 'kanan'
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

  return (
    <div className={`dd dpk${open ? ' open' : ''}${rata === 'kanan' ? ' dpk-kanan' : ''}`} ref={ref}>
      <button type="button" className="inp dpk-btn" aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel} onClick={buka}>
        <IkonMenu d={IKON_KALENDER} size={14} />
        <span>{labelNilai}</span>
      </button>
      <div className="dd-menu dpk-pop" role="dialog" aria-label="Pilih tanggal">
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
            const cls = [
              'dpk-hari',
              iso === isoIni ? ' now' : '',
              iso === value ? ' sel' : '',
            ].join('')
            return (
              <button
                key={iso}
                type="button"
                className={cls}
                disabled={tersedia ? !tersedia.has(iso) : false}
                title={tersedia && !tersedia.has(iso) ? 'Tidak ada data pada tanggal ini' : undefined}
                onClick={() => { onChange(iso); setOpen(false) }}
              >
                {d}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
