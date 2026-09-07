import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { urlData } from '../../lib/dasbor/baseData'

/**
 * Kode broker yang menautkan ke halaman rinciannya — kalau halamannya memang
 * punya isi.
 *
 * Johan, 7 Sep 2026: *"kemudian jika data bisa di link ke hasil panen misal
 * data broker dll yaa link kan"* (#27).
 *
 * ## Kenapa daftarnya dimuat, bukan diasumsikan
 *
 * Halaman rincian broker (#30) dibangun dari pivot pra-hitung. Broker yang
 * tak pernah muncul di arsip — atau seluruh pivot yang belum dijalankan di
 * lingkungan itu — tak punya berkas, dan tautannya akan mendarat di halaman
 * "belum tersedia". Satu-dua kali itu wajar; puluhan tautan begitu di satu
 * tabel membuat orang berhenti mengklik apa pun.
 *
 * Jadi daftar broker ber-rincian dimuat SEKALI (satu berkas indeks kecil,
 * disinggahkan untuk seluruh umur halaman) dan kode yang tak ada di dalamnya
 * dicetak sebagai teks biasa. Bukan tautan mati, bukan tautan yang
 * mengecewakan — tidak ada tautannya sama sekali.
 *
 * Selagi daftarnya belum tiba, semua dicetak sebagai teks. Berkedip dari
 * teks ke tautan lebih baik daripada sebaliknya: yang kedua berarti orang
 * bisa mengklik sesuatu yang kemudian hilang di bawah jarinya.
 */

let janji: Promise<Set<string>> | null = null

function muatDaftar(): Promise<Set<string>> {
  if (!janji) {
    janji = fetch(urlData('/data-idx/json/broker_pivot/index.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => new Set<string>(Array.isArray(j?.broker) ? j.broker : []))
      .catch(() => new Set<string>())
  }
  return janji
}

/** Hook terpisah supaya satu tabel berisi 88 baris tidak memanggil 88 efek. */
export function useBrokerBerhalaman(): Set<string> {
  const [set, setSet] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    let batal = false
    muatDaftar().then((s) => { if (!batal) setSet(s) })
    return () => { batal = true }
  }, [])
  return set
}

export function TautanBroker({ kode, punya, className, style, title, children }: {
  kode: string
  /** Hasil `useBrokerBerhalaman()` milik tabel pemanggil — dioper, bukan
   *  dimuat sendiri per baris. */
  punya: Set<string>
  className?: string
  style?: CSSProperties
  title?: string
  /** Isi selain kodenya (mis. lencana kecil). Kalau kosong, kodenya sendiri. */
  children?: ReactNode
}) {
  const isi = children ?? kode
  if (!punya.has(kode.toUpperCase())) {
    return <span className={className} style={style} title={title}>{isi}</span>
  }
  return (
    <Link
      to={`/broker/${kode.toUpperCase()}`}
      className={className}
      style={style}
      title={title ? `${title} — buka rinciannya` : 'Buka rincian broker ini'}
    >
      {isi}
    </Link>
  )
}
