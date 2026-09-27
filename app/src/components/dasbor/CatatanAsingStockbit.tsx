import { IkonMenu, IKON_INFO } from './IkonMenu'
import { tanggalPendek } from '../../lib/dasbor/statistikBerkala'

/**
 * Catatan "isian Stockbit" (#253 A) — sebagian hari di angka asing berasal
 * dari Stockbit (bukan bursa langsung) karena bursa sempat tak bisa diambil.
 * Satu komponen dipakai ulang di tiap tampilan yang membaca
 * `data-idx/json/asing/<KODE>.json` (baris `sumber==='stockbit'`) atau
 * `screener.json` (ruas `asing_isian_stockbit`) — supaya teks & kelasnya
 * seragam (pola awal: AliranAsing.tsx / PanelAliranAsing.tsx).
 * Render `null` kalau daftar tanggalnya kosong — pemanggil tak perlu cek
 * panjang dulu.
 */
export function CatatanAsingStockbit({ tanggal }: { tanggal: readonly string[] | undefined | null }) {
  if (!tanggal || tanggal.length === 0) return null
  return (
    <p className="catatan-cakupan muted">
      <IkonMenu d={IKON_INFO} size={12} />
      Angka asing {tanggal.map(tanggalPendek).join(', ')} dari Stockbit — bursa sedang tak
      bisa diambil; lembar dihitung dari nilai rupiah ÷ harga rata-rata hari itu.
    </p>
  )
}
