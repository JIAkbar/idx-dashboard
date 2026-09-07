/**
 * Tinjauan H+5 terbitan Deep Dive (#20 B).
 *
 * Skrip `tinjau_deepdive.py` menjalankan ulang tiap terbitan Deep Dive lima
 * hari bursa sesudah terbit: level bullish mana yang tersentuh, tanggal
 * berapa, harga di H+5, dan tertingginya. Sampai 7 Sep 2026 keluarannya tak
 * punya pembaca — angkanya ada, tapi klaim tiap terbitan tetap tak bisa
 * dinilai siapa pun dari layar.
 *
 * Arah gabungnya SENGAJA dari manifest ke tinjauan, bukan sebaliknya:
 * tinjauan memuat terbitan yang DITAHAN (BA-INET-180826-E01 ditahan atas
 * permintaan Johan 19 Agu 2026 — PDF-nya ada, tapi bukan untuk diterbitkan),
 * dan membaca dari sisi tinjauan akan memajangnya di halaman publik. Baris
 * tinjauan tanpa pasangan di manifest dilewati tanpa suara.
 */

export interface LevelTersentuh {
  tanggal: string
  level: number
  arah: string
}

export interface TinjauanTerbitan {
  edisi: string
  kode: string
  tanggal: string
  harga_acuan: number
  level_bull: number[]
  level_invalid: number[]
  urutan_tersentuh: LevelTersentuh[]
  harga_h5: number | null
  tertinggi_h5: number | null
  gerak_pct: number | null
  status: string
}

export interface BerkasTinjauan {
  diperbarui: string
  horizon_hari: number
  n: number
  terbitan: TinjauanTerbitan[]
}

/** Satu-satunya pintu baca. Gagal jaringan/404 → `null`, BUKAN galat: halaman
 *  tetap menampilkan daftar terbitannya, cuma tanpa kolom hasil. */
export async function muatTinjauanDeepDive(pengambil: typeof fetch = fetch): Promise<BerkasTinjauan | null> {
  try {
    const r = await pengambil('/data-idx/json/tinjauan_deepdive.json')
    if (!r.ok) return null
    return (await r.json()) as BerkasTinjauan
  } catch {
    return null
  }
}

/** Peta edisi → tinjauan. Kunci `edisi` cocok verbatim dengan kode terbitan. */
export function petaTinjauan(berkas: BerkasTinjauan | null): Map<string, TinjauanTerbitan> {
  const m = new Map<string, TinjauanTerbitan>()
  for (const t of berkas?.terbitan ?? []) {
    if (t.edisi) m.set(t.edisi, t)
  }
  return m
}

export type WarnaTinjauan = 'naik' | 'netral' | 'turun'

/**
 * Ringkas satu tinjauan jadi label pendek + warnanya.
 *
 * Warna mengikuti STATUS, bukan tanda gerak harga: terbitan yang levelnya tak
 * pernah tersentuh tapi harganya kebetulan naik bukan klaim yang terbukti,
 * dan mewarnainya hijau akan membaca sebaliknya.
 */
export function ringkasTinjauan(t: TinjauanTerbitan): { label: string; warna: WarnaTinjauan; judul: string } {
  // Koma, bukan titik: seluruh angka di halaman terbitan memakai format
  // Indonesia, dan satu pil bertitik terbaca seperti angka dari tempat lain.
  const gerak = t.gerak_pct == null
    ? null
    : `${t.gerak_pct > 0 ? '+' : ''}${t.gerak_pct.toLocaleString('id-ID', {
        minimumFractionDigits: 1, maximumFractionDigits: 1,
      })}%`
  const terbukti = t.status === 'terbukti'
  const gagal = t.status === 'invalid' || t.status === 'gagal'
  const label = `H+5 ${terbukti ? '✓' : gagal ? '✗' : '·'} ${gerak ?? t.status}`

  const sentuh = t.urutan_tersentuh.length > 0
    ? t.urutan_tersentuh.map((x) => `${x.level} (${x.tanggal})`).join(', ')
    : 'belum ada level yang tersentuh'
  const judul = [
    `Status ${t.status}`,
    `acuan ${t.harga_acuan}`,
    t.harga_h5 != null ? `H+5 ${t.harga_h5}` : null,
    t.tertinggi_h5 != null ? `tertinggi ${t.tertinggi_h5}` : null,
    `level tersentuh: ${sentuh}`,
  ].filter(Boolean).join(' · ')

  return { label, warna: terbukti ? 'naik' : gagal ? 'turun' : 'netral', judul }
}
