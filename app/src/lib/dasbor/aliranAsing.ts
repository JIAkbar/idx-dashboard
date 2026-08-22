import type { BarisScreener } from './screener'
import { saring } from './screener'
import { kodePeringkatTeratas, ujiLikuiditas } from './likuiditas'

/**
 * Halaman Aliran Asing (`/aliran-asing`, Johan 22 Agu 2026: "aliran asing ini
 * bisa di adaptasi di page apa ya enaknya? daripada ada di stock detail yang
 * jarang dibuka?") — daftar emiten diurut net asing, dari `screener.json`
 * (satu-satunya berkas yang murah dibaca untuk SEMUA emiten sekaligus;
 * `asing/<KODE>.json` per emiten cuma untuk panel detail sesudah dipilih).
 *
 * `net_asing_lembar` di `screener.json` adalah jumlah 20 HARI BURSA, bukan
 * 1 hari — `bangun-screener.mjs` belum menghitung net 1/5 hari terpisah.
 * Kolom net 1H/5H BELUM ditambahkan di sini karena itu; lihat catatan kaki
 * di halaman.
 *
 * Filter cari + likuiditas dipakai ulang dari screener.ts/likuiditas.ts
 * (sudah teruji di sana) — cuma dikomposisikan di sini supaya komponen React
 * tak perlu tahu urutan panggilannya.
 */
export function saringAliranAsing<T extends BarisScreener>(
  baris: T[], cari: string, tingkatLikuiditas: string,
): T[] {
  const teratas = tingkatLikuiditas === 'semesta'
    ? kodePeringkatTeratas(baris, (b) => b.likuiditas, 150, (b) => b.kode)
    : null
  return saring(baris, [], [], cari)
    .filter((b) => ujiLikuiditas(b, tingkatLikuiditas, (x) => x.likuiditas, teratas, (x) => x.kode))
}
