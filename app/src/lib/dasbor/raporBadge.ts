// Rapor & Badge Win Rate — kerangka lintas-spek, docs/spek-dev-papan/adendum_rapor_badge.md.
// Dua ukuran yang JANGAN dicampur (adendum, bagian "Dua ukuran"):
//   1. Rapor emiten (kolom form) — hitungForm(): deret naik/turun harian saham itu sendiri.
//   2. Rapor fitur (BadgeRapor) — win rate BEKU dari bt/index.json, dibaca lewat ambilIndexBt().
// Angka warna/cap/peringatan di sini adalah KONTRAK adendum — jangan diubah tanpa keputusan Johan.

/** Satu baris `parameter_ringkas` di bt/index.json — bentuk longgar karena tiap
 *  strategi punya parameter berbeda; ruas yang dipakai kontrak angka (mulai,
 *  model_keluar) ditulis eksplisit, sisanya lewat index signature. */
export interface ParameterRingkasBt {
  strategi?: string
  mulai?: string | null
  akhir?: string | null
  model_masuk?: string
  model_keluar?: string
  [k: string]: unknown
}

/** Satu entri `run` di data-idx/json/bt/index.json — bentuk NYATA berkas
 *  (diperiksa 26 Agu 2026). `akhir_data` sedang ditambahkan ke pemanen BT
 *  Papan dan belum ada di seluruh entri lama — opsional/nullable dengan aman. */
export interface RunBt {
  strategi: string
  hash: string
  berkas: string
  dibuat: string
  n_trade: number
  win_rate: number
  median_return?: number
  profit_factor?: number
  parameter_ringkas: ParameterRingkasBt
  /** Tanggal bar terakhir yang dipakai backtest ini (rentang data = mulai–akhir_data). */
  akhir_data?: string | null
}

export interface IndexBt {
  run: RunBt[]
}

/** Satu-satunya pintu baca badge MUNDUR (kontrak adendum). 404/jaringan gagal
 *  → `null`, BUKAN galat — pemanggil menafsirkannya sebagai "belum ada rapor". */
export async function ambilIndexBt(pengambil: typeof fetch = fetch): Promise<IndexBt | null> {
  try {
    const r = await pengambil('/data-idx/json/bt/index.json')
    if (!r.ok) return null
    return (await r.json()) as IndexBt
  } catch {
    return null
  }
}

export type WarnaBadge = 'hijau' | 'abu' | 'merah'

/** Hijau >=55% · abu 45-55% (belum terbukti unggul) · merah <45%. Dari
 *  adendum — ambangnya tetap sama walau backtest-nya kelihatan jelek. */
export function warnaBadge(winRate: number): WarnaBadge {
  if (winRate >= 0.55) return 'hijau'
  if (winRate >= 0.45) return 'abu'
  return 'merah'
}

export function capSampelKecil(n: number): boolean {
  return n < 100
}

/** Live jauh di bawah backtest = peringatan dini fitur basi (selisih >10 poin).
 *  Dibulatkan ke basis poin (4 desimal) dulu — 0.55-0.45 di float murni
 *  menjawab 0.09999999999999998, tepat di ambang salah kena "basi". */
export function perluPeringatanBasi(backtest: number | null | undefined, live: number | null | undefined): boolean {
  if (backtest == null || live == null) return false
  const selisih = Math.round((backtest - live) * 10000) / 10000
  return selisih > 0.1
}

const LABEL_HORIZON: Record<string, string> = {
  h1: '1 hari',
  h5: '5 hari',
  h20: '20 hari',
  tp_sl: 'TP/SL',
}

/** Horizon manusiawi dari `parameter_ringkas.model_keluar` — mengikuti label
 *  mesin bila belum dikenal, lebih baik terlihat aneh daripada diam-diam salah. */
export function labelHorizon(modelKeluar: string | undefined): string {
  if (!modelKeluar) return '—'
  return LABEL_HORIZON[modelKeluar] ?? modelKeluar
}

// ── Rapor emiten (kolom form) ──────────────────────────────────────────────

export type ArahHari = 'naik' | 'turun' | 'datar'
export type ModeForm = 'close-open' | 'close-close'

/** Adaptor kecil — bebas sumber selama ada {open, close}. */
export interface BarForm {
  open: number
  close: number
}

export interface HasilForm {
  seri: ArahHari[]
  menang: number
  kalah: number
  /** "4-1" — menang-kalah, 'datar' tak dihitung di kedua sisi. */
  label: string
}

function arah(selisih: number): ArahHari {
  if (selisih > 0) return 'naik'
  if (selisih < 0) return 'turun'
  return 'datar'
}

/**
 * Deret hasil harian saham itu sendiri, jendela N hari bursa terakhir.
 * Bawaan `close-open`: close > open HARI ITU (contoh Johan "sejak harga
 * open"). `close-close`: close vs close hari sebelumnya (butuh bar N+1 di
 * masukan supaya bar pertama jendela ikut terhitung — kalau tak ada, jendela
 * efektifnya lebih pendek, TIDAK melempar).
 */
export function hitungForm(bars: BarForm[], jendela = 5, mode: ModeForm = 'close-open'): HasilForm {
  const dipakai = bars.slice(-jendela - (mode === 'close-close' ? 1 : 0))
  const seri: ArahHari[] =
    mode === 'close-open'
      ? dipakai.map((b) => arah(b.close - b.open))
      : dipakai.slice(1).map((b, i) => arah(b.close - dipakai[i].close))
  const menang = seri.filter((s) => s === 'naik').length
  const kalah = seri.filter((s) => s === 'turun').length
  return { seri, menang, kalah, label: `${menang}-${kalah}` }
}

/** Adaptor dari larik posisi `ohlcv_stockbit` (tanggal idx0, open idx2, close
 *  idx5) ke `BarForm[]` — supaya `hitungForm` sendiri bebas sumber. */
export function dariBarOhlcvStockbit(bar: (readonly (string | number)[])[]): BarForm[] {
  return bar.map((b) => ({ open: Number(b[2]), close: Number(b[5]) }))
}

// ── Gerbang akses ───────────────────────────────────────────────────────────

/** Tier `jenjang` — Diamond (adendum: "akses ... bagi pengguna Papan yang
 *  memiliki badge Diamond saja"). Sistem jenjang sudah ada (tabel `jenjang`,
 *  lihat lib/jenjang.ts); ini BUKAN auth baru, cuma ambang bacanya. */
export const TIER_DIAMOND = 5

export interface KonfigRapor {
  /** Bawaan FALSE sejak 28 Agu 2026 — keputusan final Johan yang memang
   *  ditunggu adendum lewat flag ini: *"dibuka saja gpp, lah saya akun
   *  superadmin malah tidak bisa lihat kan aneh"*. Gerbang lama memeriksa
   *  tier JENJANG kontributor saja, jadi akun admin (perannya admin, tapi
   *  jenjangnya bukan Diamond) ikut terkunci — bukti gerbangnya salah ukur.
   *  Nilai true dipertahankan untuk uji/rollback, bukan untuk dipakai diam-diam. */
  raporDiamondOnly?: boolean
}

export function bolehLihatRapor(tier: number | null | undefined, config: KonfigRapor = {}): boolean {
  const { raporDiamondOnly = false } = config
  if (!raporDiamondOnly) return true
  return (tier ?? 0) >= TIER_DIAMOND
}
