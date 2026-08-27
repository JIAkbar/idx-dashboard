import { ambilScreener } from '../../../lib/dasbor/screener'
import { muatOhlcv, muatIndeksEmiten, type BarHarga } from '../../../lib/dasbor/neoPapanData'
import { pilihKandidatSektor } from '../../../lib/dasbor/neoPapan'

/**
 * Universe sampel untuk Rotation Chart & Sector/Index Activity.
 *
 * Membangun indeks sektor/indeks SUNGGUHAN butuh riwayat harga SELURUH ~960
 * emiten pasar — mengunduhnya di peramban tiap kali tab ini dibuka tidak
 * masuk akal (satu berkas riwayat penuh saja ratusan KB; ratusan berkas
 * sekaligus akan macet). Screener (`data-idx/json/screener.json`) sudah jadi
 * satu-satunya sumber lintas-emiten yang dipakai proyek ini justru untuk
 * menghindari pola itu (lihat Screener.tsx) — dipakai ulang di sini untuk
 * memilih SAMPEL emiten paling likuid per sektor, bukan mengunduh semuanya.
 *
 * Konsekuensinya HARUS tertulis di layar: Rotation & Activity di sini
 * dihitung dari sampel, bukan seluruh pasar.
 */
export interface UniverseSektor {
  perSektor: Record<string, string[]>
  bars: Map<string, BarHarga[]>
  indeks: Map<string, string[]>
  perSektorJumlah: number
  /** Sampel emiten per PAPAN pencatatan (PENAJAMAN2 §5 — mode Papan
   *  menggantikan mode Index yang datanya tak dimiliki). */
  perPapan: Record<string, string[]>
  /** Jumlah anggota SEBENARNYA tiap papan (bukan sampel) — wajib tampil
   *  supaya "sampel 10 dari 154" terbaca, bukan mengaku seluruh papan. */
  papanJumlah: Record<string, number>
  /** Jumlah anggota SEBENARNYA tiap sektor — alasan yang sama. */
  sektorJumlah: Record<string, number>
  perPapanJumlah: number
}

const PER_SEKTOR = 8
const PER_PAPAN = 10

let cache: Promise<UniverseSektor | null> | null = null

/** `segar` membuang singgahan — tombol refresh RotasiTab (spek §1.5). */
export function muatUniverseSektor(segar = false): Promise<UniverseSektor | null> {
  if (segar) cache = null
  if (!cache) {
    cache = (async () => {
      const scr = await ambilScreener()
      if (!scr) return null
      // Ukuran likuiditas = `likuiditas` (median 20 hari), BUKAN `nilai`
      // (transaksi hari terakhir): `nilai` sengaja di-strip null saat arsip
      // asing tertinggal sehari dari OHLC (kejujuran tanggal), dan 27 Agu
      // 2026 hal itu mengosongkan SELURUH sampel — Rotation Chart tampil
      // kuadran tanpa satu titik pun. Median 20 hari selalu terisi dan
      // memang ukuran likuiditas yang lebih benar untuk memilih sampel.
      const baris = scr.emiten.map((e) => ({ kode: e.kode, sektor: e.sektor, nilai: e.likuiditas ?? e.nilai }))
      const perSektor = pilihKandidatSektor(baris, PER_SEKTOR)
      // Papan pencatatan dari emiten_sektor.json (IDX resmi) — screener tak
      // membawanya. Sampel per papan = PER_PAPAN terlikuid; jumlah anggota
      // aslinya ikut disimpan untuk kejujuran cakupan.
      const perPapan: Record<string, string[]> = {}
      const papanJumlah: Record<string, number> = {}
      // Jumlah anggota sektor dihitung dari SCREENER (bukan emiten_sektor) —
      // penamaan sektornya yang dipakai perSektor, jadi kuncinya pasti cocok.
      const sektorJumlah: Record<string, number> = {}
      for (const b of baris) if (b.sektor) sektorJumlah[b.sektor] = (sektorJumlah[b.sektor] ?? 0) + 1
      try {
        const r = await fetch('/data-idx/json/emiten_sektor.json')
        if (r.ok) {
          const js = (await r.json()) as { emiten?: Record<string, { papan?: string; sektor?: string }> }
          const papanDari = new Map(Object.entries(js.emiten ?? {}).map(([k, v]) => [k, v?.papan ?? '']))
          for (const p of papanDari.values()) if (p) papanJumlah[p] = (papanJumlah[p] ?? 0) + 1
          const urut = [...baris].filter((b) => b.nilai != null).sort((a, b) => (b.nilai ?? 0) - (a.nilai ?? 0))
          for (const b of urut) {
            const p = papanDari.get(b.kode)
            if (!p) continue
            const isi = (perPapan[p] ??= [])
            if (isi.length < PER_PAPAN) isi.push(b.kode)
          }
        }
      } catch { /* tanpa papan — mode Papan tak tampil, bukan gagal total */ }
      const semua = [...new Set([...Object.values(perSektor).flat(), ...Object.values(perPapan).flat()])]
      const barsArr = await Promise.all(semua.map(async (k) => [k, await muatOhlcv(k)] as const))
      const bars = new Map<string, BarHarga[]>()
      for (const [k, b] of barsArr) if (b) bars.set(k, b)
      const idxArr = await Promise.all(semua.map(async (k) => [k, await muatIndeksEmiten(k)] as const))
      const indeks = new Map(idxArr)
      return { perSektor, bars, indeks, perSektorJumlah: PER_SEKTOR, perPapan, papanJumlah, sektorJumlah, perPapanJumlah: PER_PAPAN }
    })()
  }
  return cache
}
