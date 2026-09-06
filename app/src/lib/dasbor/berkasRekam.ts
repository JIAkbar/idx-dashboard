/**
 * Blok E — rekam jejak strategi PAPAN pada satu emiten.
 *
 * Rancangan (artifact "Berkas Emiten", blok E): *"Probabilitas — dengan angka
 * kejujurannya. Bukan ramalan. Frekuensi historis, lengkap dengan seberapa
 * sering ia meleset."* Dan satu kalimat yang menentukan bentuk modul ini:
 * *"Dan jumlah sampelnya; 3 dari 4 bukan 75%."*
 *
 * ## Aturan yang ditegakkan di kode, bukan diserahkan ke penyaji
 *
 * Persentase hanya boleh dicetak kalau sampelnya cukup. Di bawah ambang,
 * yang keluar "3 dari 4" — bukan "75%". Alasannya bukan gaya penulisan:
 * satu trade tambahan mengubah 75% jadi 60% atau 80%, dan angka yang berayun
 * belasan poin oleh satu peristiwa dibaca seolah setara dengan angka dari
 * dua ratus peristiwa. Menyerahkan aturan ini ke lapisan tampilan berarti
 * ia akan dilanggar di tempat kedua yang memakai data ini.
 *
 * ## Kalah dipajang sama besar dengan menang
 *
 * Ringkasan ini selalu membawa jumlah kalah dan return terburuk, bukan hanya
 * tingkat menang. Rekam jejak yang cuma menyebut kemenangan bukan rekam
 * jejak, itu iklan.
 */

export interface Trade {
  kode?: string
  tgl_masuk?: string
  tgl_keluar?: string
  harga_masuk?: number
  harga_keluar?: number
  return?: number
  alasan_keluar?: string
}

export interface RekamStrategi {
  strategi: string
  n: number
  menang: number
  kalah: number
  /** Return per trade, urut kecil→besar — dipakai median & terburuk. */
  returns: number[]
  median: number | null
  terburuk: number | null
  terbaik: number | null
  /** `true` bila sampelnya cukup untuk dicetak sebagai persentase. */
  layakPersen: boolean
  /** Kalimat siap tampil yang MENGIKUTI aturan di atas. */
  label: string
  trades: Trade[]
}

/**
 * Ambang sampel sebelum tingkat menang boleh dicetak sebagai persen.
 *
 * 20 dipilih karena di bawah itu satu trade menggeser angkanya lebih dari 5
 * poin — cukup untuk mengubah kesan "sering menang" jadi "kadang menang"
 * tanpa ada yang berubah pada strateginya. Angkanya ikut tercetak di layar
 * supaya pembaca bisa tak setuju dengan ambangnya.
 */
export const MIN_SAMPEL_PERSEN = 20

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const t = [...xs].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}

/**
 * Ringkas trade satu strategi untuk satu emiten.
 *
 * Trade tanpa `return` diabaikan — bukan dihitung sebagai seri, karena tak
 * ada yang tahu bagaimana ia berakhir.
 */
export function ringkasRekam(strategi: string, trades: Trade[], kode: string): RekamStrategi {
  const milik = trades.filter(
    (t) => (t.kode ?? '').toUpperCase() === kode.toUpperCase() && typeof t.return === 'number',
  )
  const returns = milik.map((t) => t.return as number)
  const menang = returns.filter((r) => r > 0).length
  const kalah = returns.filter((r) => r < 0).length
  const n = returns.length
  const layakPersen = n >= MIN_SAMPEL_PERSEN

  const label = n === 0
    ? 'Belum pernah muncul di uji strategi ini.'
    : layakPersen
      ? `${menang} menang · ${kalah} kalah dari ${n} kali (${((menang / n) * 100).toFixed(0)}%)`
      // Sengaja TANPA persen: lihat catatan modul.
      : `${menang} menang · ${kalah} kalah dari ${n} kali — terlalu sedikit untuk dipersenkan`

  return {
    strategi,
    n,
    menang,
    kalah,
    returns,
    median: median(returns),
    terburuk: n ? Math.min(...returns) : null,
    terbaik: n ? Math.max(...returns) : null,
    layakPersen,
    label,
    trades: milik,
  }
}

/** Berkas backtest yang ada di arsip, seperti dicatat `bt/index.json`. */
export interface RunBacktest {
  strategi: string
  berkas: string
  n_trade?: number
  win_rate?: number
  akhir_data?: string
}

/**
 * Muat seluruh run backtest lalu ringkas per strategi untuk satu emiten.
 *
 * Berkas yang gagal dibaca DILEWATI, bukan menggagalkan seluruh blok — satu
 * arsip rusak tak boleh menghapus rekam jejak dari arsip lain yang sehat.
 */
export async function muatRekam(kode: string): Promise<RekamStrategi[]> {
  let indeks: { run?: RunBacktest[] }
  try {
    const r = await fetch('/data-idx/json/bt/index.json')
    if (!r.ok) return []
    indeks = await r.json()
  } catch {
    return []
  }
  const run = indeks?.run ?? []
  const hasil = await Promise.all(
    run.map(async (x) => {
      try {
        const r = await fetch(`/data-idx/json/bt/${x.berkas}`)
        if (!r.ok) return null
        const j = (await r.json()) as { trades?: Trade[] }
        return ringkasRekam(x.strategi, j?.trades ?? [], kode)
      } catch {
        return null
      }
    }),
  )
  // Strategi yang emiten ini tak pernah muncul di dalamnya tetap dikembalikan:
  // "belum pernah diuji di sini" adalah jawaban, dan menyembunyikannya membuat
  // pembaca mengira strateginya memang tak ada.
  return hasil.filter((x): x is RekamStrategi => x !== null)
}

/** Cari rekomendasi terakhir yang memuat emiten ini. */
export interface RekomendasiEmiten {
  tanggal: string
  preset: string
  close: number | null
  entry: number[] | null
  tp1: number | null
  tp2: number | null
  sl: number | null
}

export async function muatRekomendasi(kode: string): Promise<RekomendasiEmiten[]> {
  try {
    const ri = await fetch('/data-idx/json/rekomendasi/index.json')
    if (!ri.ok) return []
    const { tanggal } = (await ri.json()) as { tanggal?: string[] }
    const daftar = (tanggal ?? []).slice(-5).reverse()
    const out: RekomendasiEmiten[] = []
    for (const t of daftar) {
      const r = await fetch(`/data-idx/json/rekomendasi/${t}.json`)
      if (!r.ok) continue
      const j = (await r.json()) as {
        presets?: Array<{ preset: string; saham?: Array<Record<string, unknown>> }>
      }
      for (const p of j.presets ?? []) {
        for (const s of p.saham ?? []) {
          if (String(s.kode ?? '').toUpperCase() !== kode.toUpperCase()) continue
          out.push({
            tanggal: t,
            preset: p.preset,
            close: typeof s.close === 'number' ? s.close : null,
            entry: Array.isArray(s.entry) ? (s.entry as number[]) : null,
            tp1: typeof s.tp1 === 'number' ? s.tp1 : null,
            tp2: typeof s.tp2 === 'number' ? s.tp2 : null,
            sl: typeof s.sl === 'number' ? s.sl : null,
          })
        }
      }
    }
    return out
  } catch {
    return []
  }
}

// ── Probabilitas historis ──────────────────────────────────────────────────

/**
 * Hasil mesin probabilitas untuk satu emiten.
 *
 * Berdiri sendiri, tak lagi menumpang Deep Dive (Johan 29 Agu 2026: *"P di
 * isi kan datanya sudah ada tidak selalu pakai deep dive biarkan dia berdiri
 * disana sendiri"*). Dibangun `scripts/bangun_prob.py` untuk seluruh emiten.
 */
export interface ProbEmiten {
  kode: string
  /** P(harga 5 hari lagi di atas hari ini). */
  p5: number | null
  /** Angka DASAR pool — berapa persen kejadian itu terjadi tanpa syarat apa
   *  pun. Tanpa ini, p5 tak bisa dinilai: 62% berarti lain kalau dasarnya
   *  60% dibanding kalau dasarnya 30%. */
  base5: number | null
  /** p5 − base5, dalam poin persen. */
  lift5: number | null
  ci5: [number, number] | null
  n: number | null
  cocok: number | null
  total_fitur: number | null
  /** Peluang menyentuh level pivot esok. */
  pR1: number | null
  pR2: number | null
  pS1: number | null
  /** Jarak level itu dari harga sekarang (0,01 = 1%) — tanpa ini, "80% capai
   *  R1" tak bisa dibaca: R1 yang cuma +0,9% memang hampir selalu tersentuh. */
  jarak: { R1?: number; R2?: number; S1?: number } | null
  ret_p25: number | null
  ret_p50: number | null
  ret_p75: number | null
  faktor: Array<{ nama: string; nilai: string; delta_pp: number; n: number }> | null
  pool_n: number | null
  pool_emiten: number | null
}

export interface EvaluasiProb {
  n_uji: number
  mulai_uji: string
  brier: number
  brier_dasar: number
  /** >0 berarti penaksir mengalahkan angka dasar; ≤0 berarti tidak. */
  skill: number | null
  presisi_naik: number | null
  n_yakin: number
}

export async function muatProb(
  kode: string,
): Promise<{ prob: ProbEmiten | null; evaluasi: EvaluasiProb | null }> {
  try {
    const [a, b] = await Promise.all([
      fetch(`/data-idx/json/prob/${kode.toUpperCase()}.json`),
      fetch('/data-idx/json/prob/index.json'),
    ])
    const prob = a.ok ? ((await a.json()) as ProbEmiten) : null
    const idx = b.ok ? ((await b.json()) as { evaluasi?: EvaluasiProb }) : null
    return { prob, evaluasi: idx?.evaluasi ?? null }
  } catch {
    return { prob: null, evaluasi: null }
  }
}

/**
 * Hasil uji penaksir saja, tanpa memuat berkas satu emiten.
 *
 * Dipisah dari `muatProb` karena halaman Bulletin memajang angka peluang untuk
 * BANYAK emiten sekaligus dan tak butuh satu pun berkas per-emiten — ia cuma
 * perlu tahu apakah penaksirnya lolos ujinya. Menyalin ambangnya ke sana akan
 * membuat dua tempat memutuskan hal yang sama, dan yang kedua diam-diam basi
 * begitu yang pertama disetel.
 */
export async function muatEvaluasiProb(): Promise<EvaluasiProb | null> {
  try {
    const r = await fetch('/data-idx/json/prob/index.json')
    if (!r.ok) return null
    const idx = (await r.json()) as { evaluasi?: EvaluasiProb }
    return idx?.evaluasi ?? null
  } catch {
    return null
  }
}

/**
 * Apakah penaksir layak dibaca sebagai sinyal, menurut ujinya sendiri.
 *
 * Dijawab dari `skill`, bukan dari kesan. Uji 29 Agu 2026 menjawab TIDAK
 * (skill −0,023), dan halaman wajib mengatakannya — bukan menampilkan angka
 * yang terlihat meyakinkan sambil menyimpan hasil ujinya.
 */
export function layakSinyal(ev: EvaluasiProb | null): boolean {
  return !!ev && typeof ev.skill === 'number' && ev.skill > 0
}
