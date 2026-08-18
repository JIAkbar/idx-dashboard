/**
 * Penyimpanan gambar (drawing tools) Grafik Emiten — logika MURNI, dipisah
 * dari komponen supaya bisa diuji tanpa `lightweight-charts-drawing`/DOM,
 * sama seperti `grafikEmiten.ts` dipisah dari `GrafikEmiten.tsx`.
 *
 * Disimpan di localStorage, PER EMITEN — bukan Supabase, bukan satu kunci
 * gabungan. Alasannya sama dengan template (lihat catatan panjang di
 * `grafikEmiten.ts` dekat `KUNCI_TEMPLATE`): ini preferensi tampilan, bukan
 * data bersama, dan tak perlu berpindah perangkat. Per-emiten karena gambar
 * BBCA tak boleh muncul di TLKM — Johan: "gambar BBCA tak boleh muncul di
 * TLKM" (spek tugas). Kunci gabungan satu daftar besar akan memaksa tiap
 * pembacanya menyaring milik emiten mana, dan kesalahan penyaringan sekali
 * saja membuat gambar orang lain bocor ke layar yang salah.
 *
 * Anchor disimpan sebagai `{ waktu, harga }` — `waktu` string INTERNAL
 * (`'yyyy-mm-dd'` harian, `'yyyy-mm-dd HH:mm'` intraday), BUKAN tipe `Time`
 * lightweight-charts (BusinessDay/epoch). Konversi ke/dari `Time` terjadi di
 * `GrafikEmiten.tsx` lewat `keWaktuChart`/`dariWaktuChart` yang sudah ada —
 * satu tempat, sama seperti data lilin. Menyimpan `Time` mentah akan mengunci
 * bentuknya ke representasi kanvas saat itu (epoch detik untuk intraday), dan
 * berkas ini sama sekali tak perlu tahu bedanya.
 */

export interface AnchorTersimpan {
  waktu: string
  harga: number
}

/** Satu gambar tersimpan — bentuknya sengaja LONGGAR untuk `style`/`options`
 *  (Record, bukan tipe pustaka): berkas ini tak boleh mengimpor
 *  `lightweight-charts-drawing` sama sekali (lihat catatan impor dinamis di
 *  `gambarPustaka.ts`), dan validasi bentuknya cukup "objek", bukan skema
 *  penuh — pustaka sendiri yang menolak nilai yang tak dikenalinya. */
export interface GambarTersimpan {
  versi: number
  /** `type` dari `lightweight-charts-drawing` (mis. 'trend-line'). */
  type: string
  id: string
  anchors: AnchorTersimpan[]
  style: Record<string, unknown>
  options: Record<string, unknown>
}

export const VERSI_GAMBAR = 1

/** Kunci localStorage PER EMITEN. Kode yang aneh (kosong, spasi) tetap
 *  menghasilkan kunci yang sah — penyaringan kode yang valid itu tugas
 *  pemanggil (halaman sudah menyaringnya sebelum `kode` sampai sini). */
export function kunciGambar(kode: string): string {
  return `papan:grafik-gambar:${kode}`
}

function anchorSah(a: unknown): a is AnchorTersimpan {
  if (!a || typeof a !== 'object') return false
  const o = a as Record<string, unknown>
  return typeof o.waktu === 'string' && o.waktu.length > 0
    && typeof o.harga === 'number' && Number.isFinite(o.harga)
}

/**
 * Membaca daftar gambar dari teks JSON. Bentuk yang tak dikenal DILEWATI,
 * bukan menjatuhkan seluruh daftar — satu baris gambar yang rusak (mis. hasil
 * tempelan manual, atau versi pustaka lampau yang bentuk anchornya berubah)
 * tak boleh membuat gambar-gambar LAIN yang sah ikut hilang.
 */
export function uraiGambar(raw: string | null): GambarTersimpan[] {
  if (!raw) return []
  let data: unknown
  try { data = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(data)) return []
  const hasil: GambarTersimpan[] = []
  for (const g of data) {
    if (!g || typeof g !== 'object') continue
    const o = g as Record<string, unknown>
    if (o.versi !== VERSI_GAMBAR) continue
    if (typeof o.type !== 'string' || !o.type) continue
    if (typeof o.id !== 'string' || !o.id) continue
    if (!Array.isArray(o.anchors) || o.anchors.length === 0) continue
    if (!o.anchors.every(anchorSah)) continue
    hasil.push({
      versi: VERSI_GAMBAR,
      type: o.type,
      id: o.id,
      anchors: o.anchors as AnchorTersimpan[],
      style: (o.style && typeof o.style === 'object' ? o.style : {}) as Record<string, unknown>,
      options: (o.options && typeof o.options === 'object' ? o.options : {}) as Record<string, unknown>,
    })
  }
  return hasil
}

/* Dua fungsi berikut satu-satunya yang tahu di mana gambar disimpan — pola
   sama persis dengan `bacaTemplateTersimpan`/`tulisTemplateTersimpan`.
   Keduanya menelan galat: kuota penuh atau localStorage yang dimatikan (mode
   privat) tak boleh menjatuhkan halaman grafik, cukup berarti gambarnya tak
   bertahan. */

export function bacaGambarTersimpan(kode: string): GambarTersimpan[] {
  try { return uraiGambar(localStorage.getItem(kunciGambar(kode))) } catch { return [] }
}

export function tulisGambarTersimpan(kode: string, daftar: GambarTersimpan[]): void {
  try { localStorage.setItem(kunciGambar(kode), JSON.stringify(daftar)) } catch { /* kuota penuh / mode privat */ }
}
