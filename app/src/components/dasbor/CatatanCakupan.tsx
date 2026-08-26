import { IkonMenu, IKON_INFO } from './IkonMenu'

/**
 * Keterangan cakupan data (26 Agu 2026 — dibuka ke 2020, ketetapan Johan)
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
      Data sejak 2020 sudah tervalidasi. Angka sebelum 2020 masih dalam tahap penyesuaian dan bisa berubah.
    </p>
  )
}
