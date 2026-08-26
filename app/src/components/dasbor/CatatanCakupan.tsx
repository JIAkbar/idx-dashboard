import { IkonMenu, IKON_INFO } from './IkonMenu'

/**
 * Keterangan cakupan data (27 Agu 2026 — broker dibuka ke 2016, ketetapan
 * Johan "gpp sampai 2016"; sebelumnya 2020)
 * — satu kalimat dipakai ulang di tiap halaman yang membaca harga
 * harian (OHLC/OHLCV) dan/atau rincian broker, supaya pembaca tahu batas
 * kepercayaan angkanya tanpa perlu menebak. Sengaja TIDAK menyebut
 * proses/sumber di baliknya (dilarang proyek) — hanya apa artinya bagi
 * pembaca. Satu tempat, satu suntingan kalau kalimatnya berubah.
 */
export function CatatanCakupan() {
  return (
    <p className="catatan-cakupan muted">
      <IkonMenu d={IKON_INFO} size={12} />
      Rincian broker tersedia dan tervalidasi sejak 2016. Riwayat harga tersedia sejak emiten tercatat di bursa.
    </p>
  )
}
