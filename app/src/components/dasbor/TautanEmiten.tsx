import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { urlData } from '../../lib/dasbor/baseData'

/**
 * Kode emiten yang menautkan ke Berkas Emiten — kalau kodenya memang emiten
 * tercatat.
 *
 * Johan, 7 Sep 2026: *"kemudian jika data bisa di link ke hasil panen misal
 * data broker dll yaa link kan"* (#27). Pasangan `TautanBroker`, dengan pola
 * yang sama dan alasan yang sama: daftar dimuat SEKALI lalu dioper ke tiap
 * baris, dan kode yang tak ada di dalamnya dicetak sebagai teks biasa — bukan
 * tautan mati.
 *
 * ## Kenapa daftarnya perlu, padahal "semua kode itu emiten"
 *
 * Tidak semua. Tabel yang memakai komponen ini juga memuat kode yang BUKAN
 * emiten tercatat: emiten yang sudah delisting masih muncul di edisi lama,
 * dan berkas IPO memuat pencatatan yang batal. Tanpa daftar, keduanya jadi
 * tautan yang mendarat di halaman kosong.
 *
 * Tujuannya Berkas Emiten, bukan Grafik: yang ditanyakan dari sebuah kode di
 * tabel biasanya "emiten ini apa dan datanya bagaimana", dan Berkas Emiten
 * menjawab itu sekaligus memuat tautan ke grafiknya. Tautan yang sudah ada
 * dan menuju Grafik SENGAJA dibiarkan — halaman itu jawaban yang benar untuk
 * tabel harga.
 */

let janji: Promise<Set<string>> | null = null

function muatDaftar(): Promise<Set<string>> {
  if (!janji) {
    janji = fetch(urlData('/data-idx/json/daftar_emiten.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { emiten?: Array<{ kode?: string }> } | null) =>
        new Set<string>((j?.emiten ?? []).map((e) => (e.kode ?? '').toUpperCase()).filter(Boolean)))
      .catch(() => new Set<string>())
  }
  return janji
}

/** Hook terpisah supaya satu tabel berisi 60 baris tidak memanggil 60 efek. */
export function useEmitenTerdaftar(): Set<string> {
  const [set, setSet] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    let batal = false
    muatDaftar().then((s) => { if (!batal) setSet(s) })
    return () => { batal = true }
  }, [])
  return set
}

export function TautanEmiten({ kode, punya, className, style, title, children }: {
  kode: string
  /** Hasil `useEmitenTerdaftar()` milik tabel pemanggil. */
  punya: Set<string>
  className?: string
  style?: CSSProperties
  title?: string
  children?: ReactNode
}) {
  const isi = children ?? kode
  const atas = kode.toUpperCase()
  if (!punya.has(atas)) {
    return <span className={className} style={style} title={title}>{isi}</span>
  }
  return (
    <Link
      to={`/berkas-emiten?kode=${atas}`}
      className={className}
      style={style}
      title={title ? `${title} — buka berkas emitennya` : 'Buka berkas emiten ini'}
    >
      {isi}
    </Link>
  )
}
