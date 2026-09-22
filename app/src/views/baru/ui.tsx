import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { arah } from './data'

/**
 * Blok bangunan PAPAN Baru. Semua halaman lapisan memakai komponen ini,
 * bukan menulis gaya sendiri — kelas ada di baru.css (awalan `bb-`).
 */

/** Angka pahlawan: label kecil, angka besar, baris perubahan. */
export function Hero({ label, angka, satuan, sub, nada }: {
  label: string
  angka: ReactNode
  satuan?: string
  sub?: ReactNode
  nada?: 'naik' | 'turun' | 'datar'
}) {
  return (
    <div className="bb-hero">
      <span className="bb-label">{label}</span>
      <div className="bb-hero-angka">
        <span className={`bb-hero-besar ${nada ?? ''}`}>{angka}</span>
        {satuan && <span className="bb-hero-satuan">{satuan}</span>}
      </div>
      {sub && <div className="bb-hero-sub">{sub}</div>}
    </div>
  )
}

/** Satu blok isi: label kecil / judul, isi, satu kalimat narasi yang menyimpulkan. */
export function Blok({ label, judul, catatan, narasi, children, kelas }: {
  label?: string
  judul?: string
  catatan?: string
  narasi?: ReactNode
  children?: ReactNode
  kelas?: string
}) {
  return (
    <section className={`bb-blok ${kelas ?? ''}`}>
      {(label || judul) && (
        <div className="bb-blok-kepala">
          {judul ? <h2 className="bb-judul">{judul}</h2> : <span className="bb-label">{label}</span>}
          {catatan && <span className="bb-catatan">{catatan}</span>}
        </div>
      )}
      {children}
      {narasi && <p className="bb-narasi">{narasi}</p>}
    </section>
  )
}

/** Satu baris peringkat berbatang. `lebar` 0–100 (persen dari nilai terbesar). */
export function BarisBatang({ kode, nama, lebar, nilai, warna = 'biru', ke, nada }: {
  kode: ReactNode
  nama?: ReactNode
  lebar: number
  nilai: ReactNode
  warna?: 'biru' | 'emas' | 'naik' | 'turun' | 'abu'
  ke?: string
  nada?: 'naik' | 'turun' | 'datar'
}) {
  const isi = (
    <>
      <span className="bb-bb-kode">{kode}</span>
      {nama !== undefined && <span className="bb-bb-nama">{nama}</span>}
      <span className="bb-bb-rel"><span className={`bb-bb-isi ${warna}`} style={{ width: `${Math.max(0, Math.min(100, lebar))}%` }} /></span>
      <span className={`bb-bb-nilai ${nada ?? ''}`}>{nilai}</span>
    </>
  )
  const kelas = `bb-bb ${nama !== undefined ? 'bernama' : ''}`
  return ke ? <Link to={ke} className={kelas}>{isi}</Link> : <div className={kelas}>{isi}</div>
}

/** Pasangan label–nilai ringkas (kisi 2 kolom di telepon, 4 di laptop). */
export function Ringkas({ items }: { items: { label: string; nilai: ReactNode; sub?: ReactNode; nada?: 'naik' | 'turun' | 'datar' }[] }) {
  return (
    <div className="bb-ringkas">
      {items.map((it) => (
        <div key={it.label} className="bb-ringkas-it">
          <span className="bb-label">{it.label}</span>
          <span className={`bb-ringkas-nilai ${it.nada ?? ''}`}>{it.nilai}</span>
          {it.sub && <span className="bb-ringkas-sub">{it.sub}</span>}
        </div>
      ))}
    </div>
  )
}

/** Garis rentang dengan penanda posisi (0–100). */
export function Rentang({ kiri, kanan, posisi, nada }: { kiri: ReactNode; kanan: ReactNode; posisi: number; nada?: 'naik' | 'turun' | 'datar' }) {
  const p = Math.max(0, Math.min(100, posisi))
  return (
    <div className="bb-rentang">
      <div className="bb-rentang-ujung"><span>{kiri}</span><span>{kanan}</span></div>
      <div className="bb-rentang-rel">
        <span className={`bb-rentang-isi ${nada ?? ''}`} style={{ width: `${p}%` }} />
        <span className="bb-rentang-titik" style={{ left: `${p}%` }} />
      </div>
    </div>
  )
}

/** Teks angka berwarna sesuai arah. */
export function Arah({ v, children }: { v: number | null | undefined; children: ReactNode }) {
  return <span className={`bb-mono ${arah(v)}`}>{children}</span>
}

/** Keadaan memuat / gagal / kosong — satu bentuk untuk semua lapisan. */
export function Keadaan({ galat, kosong }: { galat?: string | null; kosong?: string }) {
  if (galat) return <p className="bb-keadaan">Data belum bisa dimuat ({galat}). Coba muat ulang.</p>
  if (kosong) return <p className="bb-keadaan">{kosong}</p>
  return <p className="bb-keadaan">Memuat data…</p>
}

/** Pil pilihan kecil (mis. varian broker, rentang). Aktif = emas. */
export function Pil({ aktif, onClick, children }: { aktif?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`bb-pil ${aktif ? 'aktif' : ''}`} aria-pressed={aktif} onClick={onClick}>
      {children}
    </button>
  )
}
