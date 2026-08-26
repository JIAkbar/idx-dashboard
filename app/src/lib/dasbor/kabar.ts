import { useEffect, useState } from 'react'

/** Satu kabar dari `data-idx/json/kabar.json` (ditulis `scripts/panen_kabar.py`). */
export interface KabarItem {
  /** 'IDX' · 'IPOT News' · 'Kontan' — nama yang ditampilkan apa adanya. */
  sumber: string
  jenis: 'berita' | 'pengumuman' | 'snips'
  judul: string
  tautan: string
  /** ISO ber-offset WIB. `null` untuk sumber yang halaman daftarnya tak
   *  memuat tanggal (IPOT) — ditampilkan "—", bukan ditebak jadi hari ini. */
  waktu: string | null
  /** Kode emiten yang disebut pengumuman resmi; kosong untuk berita umum. */
  emiten: string[]
  nomor?: string | null
  /** Kanal topik di sumbernya — sekarang cuma IPOT News yang punya (Saham,
   *  Ekonomi, IPS News, Market/JCI), karena dipanen per kanal. */
  kanal?: string
}

export interface Kabar {
  dipanen: string
  sumber: string[]
  item: KabarItem[]
}

/** Cache modul: pindah halaman lalu kembali tak menarik ulang berkasnya —
 *  pola sama dengan `useBulletinList`. DUA cache, karena isinya beda: yang
 *  ringan (tanpa arsip IPOT) dipakai semua halaman, yang lengkap cuma
 *  `/kabar`. Satu cache saja akan membuat halaman ringan ikut menerima muatan
 *  berat begitu `/kabar` pernah dibuka. */
let cache: Kabar | null = null
let cacheArsip: Kabar | null = null
let cacheSejak = 0
let cacheArsipSejak = 0
// TTL 30 menit (audit kesegaran 27 Agu §2) — pola screener.ts; tanpa ini data halaman membeku sampai muat-ulang penuh.
const UMUR_CACHE_MS = 30 * 60 * 1000

/**
 * Gabung tiga berkas jadi satu daftar, buang yang benar-benar kembar.
 *
 * Kunci kembarnya **tautan + judul + waktu**, bukan tautan saja. Seluruh
 * pengumuman resmi IDX yang tak punya berkas terlampir jatuh ke satu URL
 * generik yang sama (halaman "keterbukaan informasi"), jadi dedup ber-tautan
 * meringkas belasan pengumuman berbeda menjadi satu baris — tanpa galat,
 * tanpa peringatan, cuma daftar yang diam-diam menyusut. Dari layar itu
 * terbaca sebagai "beritanya tidak ada" atau "situsnya mati", bentuk
 * kegagalan yang jauh lebih mahal daripada duplikat yang lolos.
 *
 * Urutan masuk menentukan siapa yang menang: `utama` (paling segar) di depan,
 * lalu snips, lalu arsip.
 */
export function gabungKabar(utama: Kabar, snips: KabarItem[], arsip: KabarItem[]): Kabar {
  const terlihat = new Set<string>()
  const unik = [...utama.item, ...snips, ...arsip].filter((i) => {
    const k = `${i.tautan}|${i.judul}|${i.waktu ?? ''}`
    if (terlihat.has(k)) return false
    terlihat.add(k)
    return true
  })
  return {
    ...utama,
    sumber: [...new Set([...(utama.sumber ?? []), ...unik.map((i) => i.sumber)])],
    item: unik.sort((a, b) => (b.waktu ?? '').localeCompare(a.waktu ?? '')),
  }
}

/**
 * Kabar pasar dari berkas statis, bukan dari peramban pengunjung.
 *
 * Sengaja TIDAK memanggil RSS/endpoint IDX langsung dari klien: sumbernya
 * tidak mengizinkan CORS, endpoint IDX menolak permintaan tanpa header
 * peramban, dan tiap pengunjung memanggil sendiri berarti ratusan permintaan
 * ke server orang untuk data yang sama. Panen dijalankan di mesin rumahan
 * (`scripts/panen_kabar.py`), hasilnya berkas JSON yang ikut ter-deploy.
 */
function segarKabar(denganArsip: boolean): boolean {
  return denganArsip
    ? cacheArsip !== null && Date.now() - cacheArsipSejak < UMUR_CACHE_MS
    : cache !== null && Date.now() - cacheSejak < UMUR_CACHE_MS
}

export function useKabar(denganArsip = false) {
  const [kabar, setKabar] = useState<Kabar | null>(segarKabar(denganArsip) ? (denganArsip ? cacheArsip : cache) : null)
  const [galat, setGalat] = useState(false)

  useEffect(() => {
    if (segarKabar(denganArsip)) return
    let batal = false
    // DUA berkas, satu aliran. `kabar.json` berumur pendek (retensi 7 hari,
    // dipanen tiap jam); `snips.json` arsip panjang Stockbit Snips setahun
    // yang dipanen jarang. Dipisah di sisi panen supaya retensi kabar tak
    // ikut menghapus arsip — di sini keduanya digabung lagi jadi satu daftar.
    // Snips diperlakukan opsional: kalau berkasnya belum ada, kabar tetap
    // tampil dan cuma kolom Stockbit yang kosong.
    //
    // Berkas ketiga, `ipot_arsip.json`, cuma ditarik kalau diminta
    // (`denganArsip`): isinya arsip IPOT mundur sampai awal tahun, jadi
    // ukurannya berlipat dari dua berkas lain. Halaman `/kabar` memang butuh
    // kedalamannya; Beranda tidak — dan menariknya di semua halaman berarti
    // membayar megabita untuk empat baris kabar terbaru.
    const kosong = Promise.resolve({ item: [] as KabarItem[] })
    Promise.all([
      fetch('/data-idx/json/kabar.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch('/data-idx/json/snips.json')
        .then((r) => (r.ok ? r.json() : { item: [] }))
        .catch(() => ({ item: [] })),
      denganArsip
        ? fetch('/data-idx/json/ipot_arsip.json')
          .then((r) => (r.ok ? r.json() : { item: [] }))
          .catch(() => ({ item: [] }))
        : kosong,
    ])
      .then(([utama, snips, arsip]: [Kabar, { item?: KabarItem[] }, { item?: KabarItem[] }]) => {
        const gabung = gabungKabar(utama, snips.item ?? [], arsip.item ?? [])
        if (denganArsip) { cacheArsip = gabung; cacheArsipSejak = Date.now() }
        else { cache = gabung; cacheSejak = Date.now() }
        if (!batal) setKabar(gabung)
      })
      .catch(() => !batal && setGalat(true))
    return () => { batal = true }
  }, [denganArsip])

  return { kabar, galat }
}

/**
 * Umur kabar dibaca dari ISI daftarnya — stempel waktu item terbaru.
 *
 * Ruas `dipanen` sengaja TIDAK dipakai untuk ini: berkasnya ditulis ulang tiap
 * 2 jam walau tak membawa satu pun kabar baru, jadi "diperbarui 5 menit lalu"
 * bisa terpampang di atas daftar yang isinya berhenti tiga hari lalu. Ini
 * bentuk kegagalan yang sama dengan membaca mtime berkas (CLAUDE.md, kasus
 * broker summary) — pembaca melihat angka yang segar dan menyimpulkan datanya
 * segar.
 */
export function kabarTerbaru(k: Kabar | null): string | null {
  return (k?.item ?? []).reduce<string | null>(
    (maks, i) => (i.waktu && (!maks || i.waktu > maks) ? i.waktu : maks), null)
}

/** "2 jam lalu" / "Kamis, 14 Agu" — waktu relatif cuma sampai sehari, lewat
 *  itu tanggalnya lebih berguna daripada "31 jam lalu". */
export function waktuKabar(iso: string | null, sekarang = new Date()): string {
  if (!iso) return '—'
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '—'
  const menit = Math.round((sekarang.getTime() - t.getTime()) / 60000)
  if (menit < 1) return 'baru saja'
  if (menit < 60) return `${menit} menit lalu`
  if (menit < 24 * 60) return `${Math.round(menit / 60)} jam lalu`
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][t.getMonth()]
  return `${t.getDate()} ${bulan}, ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}
