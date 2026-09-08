/**
 * Penghitung pengunjung PAPAN (#112 A) — sisi klien.
 *
 * Satu POST per TAB per sesi peramban, dikirim sekali saat kerangka dasbor
 * dipasang. Yang menentukan "unik" bukan berkas ini melainkan server (sidik
 * harian ip+peramban+tanggal); `sessionStorage` di sini cuma menahan tab yang
 * sama mengirim berkali-kali saat berpindah halaman — itu murni penghematan
 * permintaan, bukan pengukuran.
 *
 * Semua kegagalan DIAM: penghitung pengunjung tak pernah boleh menghalangi
 * halaman, memunculkan galat, atau menahan render.
 */
import { useEffect, useState } from 'react'

const KUNCI_SESI = 'papan-kunjungan-tercatat'

export interface AngkaKunjungan {
  tanggal: string
  hari_ini: number
  bulan_ini: number
  total: number
}

/** Kirim satu kunjungan — sekali per tab, gagal diam-diam. */
export function catatKunjungan(): void {
  try {
    if (sessionStorage.getItem(KUNCI_SESI)) return
    sessionStorage.setItem(KUNCI_SESI, '1')
  } catch {
    // Penyimpanan sesi ditolak (mode privat/setelan): tetap kirim sekali;
    // server yang menyaring duplikatnya, jadi angkanya tak terpengaruh.
  }
  // `keepalive` supaya permintaan tetap terkirim walau pengunjung langsung
  // menutup tab — kunjungan sekejap tetap terhitung.
  void fetch('/api/kunjungan', { method: 'POST', keepalive: true }).catch(() => {})
}

/**
 * Angka pengunjung untuk ditampilkan. `null` = belum ada / gagal — dan saat
 * itu kartunya WAJIB disembunyikan, bukan menampilkan nol: nol yang dikarang
 * lebih buruk daripada tak ada angka.
 */
export function useKunjungan(aktif = true): AngkaKunjungan | null {
  const [angka, setAngka] = useState<AngkaKunjungan | null>(null)
  useEffect(() => {
    if (!aktif) return
    let batal = false
    fetch('/api/kunjungan')
      .then((r) => (r.ok ? (r.json() as Promise<AngkaKunjungan>) : null))
      .then((d) => {
        if (batal || !d || !Number.isFinite(d.hari_ini)) return
        setAngka(d)
      })
      .catch(() => {})
    return () => { batal = true }
  }, [aktif])
  return angka
}

/** Kalimat batas yang WAJIB menyertai angkanya di layar (tooltip/keterangan).
 *  Ditaruh di sini, bukan diketik di komponen, supaya dua tempat yang
 *  menampilkan angka ini tak bisa menjelaskannya dengan dua cara berbeda. */
export const BATAS_KUNJUNGAN =
  'Unik per hari = kombinasi perangkat + jaringan, bukan orang. '
  + 'Satu orang dengan ponsel dan laptop terhitung dua; satu kantor dengan satu jaringan bisa terhitung satu. '
  + 'Tak ada cookie, tak ada id perangkat, dan alamat IP tak pernah disimpan.'
