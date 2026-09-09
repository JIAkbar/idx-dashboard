/**
 * Harga live via proxy server PAPAN (`/api/live-harga`) — token rantai live
 * Stockbit hidup HANYA di server (keputusan Johan 28 Agu 2026); yang sampai
 * ke peramban cuma angka. Gagal dalam bentuk apa pun (503 rantai mati, 404
 * di dev lokal karena fungsi hanya hidup di Vercel, timeout) = null — pemakai
 * WAJIB jatuh diam-diam ke arsip EOD, bukan menampilkan error.
 */
import { useEffect, useState } from 'react'

export interface HargaLive {
  kode: string
  tanggal: string | null
  close: number
  prev: number | null
  pct: number | null
  /** Bar hari berjalan (#97 A). Opsional: null/undefined bila proxy belum
   *  mengirimnya; pemakai memperlakukannya sebagai "tak ada bar berjalan". */
  open?: number | null
  high?: number | null
  low?: number | null
  volume?: number | null
  value?: number | null
  frequency?: number | null
  /** Kapan angkanya sampai di peramban (epoch ms) — label jam di layar
   *  dibaca dari sini, karena server tak mengirim stempel waktu. */
  diambilPada: number
  /** Berapa detik jawabannya sudah duduk di singgahan tepi saat sampai (#156).
   *
   *  Tanpa ini umur di layar akan berbohong ke arah yang menyenangkan: angka
   *  yang tiba 2 detik lalu bisa saja sudah 12 detik umurnya, karena yang
   *  dikirim adalah salinan singgahan.
   *
   *  Dihitung dari stempel di BADAN jawaban, bukan dari header umur: terukur
   *  di produksi, tepi memakan `s-maxage` dan mengirim umur nol walau jawaban
   *  itu jelas dari singgahan. Badan yang disinggah membawa waktunya sendiri,
   *  jadi ia lolos. */
  umurSumber: number
}

/** Umur singgahan dari stempel server, 0 bila tak masuk akal.
 *
 *  Jam perangkat bisa meleset menit atau jam; hasil negatif atau raksasa itu
 *  tanda skew, bukan data basi. Dalam keadaan itu umur singgahan dilepas dan
 *  layar kembali ke umur sisi peramban saja — mengurangkan dua jam yang tak
 *  sinkron akan mencetak "basi 43 menit" pada angka yang baru saja tiba.
 *  Batas 120 detik: singgahan tepi paling lama 15 detik, jadi apa pun di atas
 *  itu bukan singgahan. */
export function umurSinggahan(pada: number | undefined, kini: number): number {
  if (pada == null || !Number.isFinite(pada)) return 0
  const d = Math.round((kini - pada) / 1000)
  return d >= 0 && d <= 120 ? d : 0
}

export async function ambilHargaLive(kode: string): Promise<HargaLive | null> {
  const kendali = new AbortController()
  const batas = setTimeout(() => kendali.abort(), 2500)
  try {
    const r = await fetch(`/api/live-harga?kode=${encodeURIComponent(kode)}`, { signal: kendali.signal })
    if (!r.ok) return null
    const d = (await r.json()) as Omit<HargaLive, 'diambilPada' | 'umurSumber'> & { pada?: number }
    if (!Number.isFinite(d?.close)) return null
    const kini = Date.now()
    return { ...d, diambilPada: kini, umurSumber: umurSinggahan(d.pada, kini) }
  } catch {
    return null
  } finally {
    clearTimeout(batas)
  }
}

/** Umur angka live dalam detik: seberapa lama sejak ia sampai, DITAMBAH
 *  seberapa lama ia sudah duduk di singgahan sebelum sampai. Yang kedua sering
 *  lebih besar daripada yang pertama tepat sesudah tarikan. */
export function umurLiveDetik(h: HargaLive, kini = Date.now()): number {
  return Math.max(0, Math.round((kini - h.diambilPada) / 1000)) + (h.umurSumber ?? 0)
}

/** Segar tiap `jedaDetik` selama halaman terlihat; null selama belum/gagal.
 *
 *  Jeda 10-15 detik sejak #156 A (dulu 45-60). Ukuran 9 Sep 2026 menunjukkan
 *  sumbernya bergerak median 1,77 detik saat ramai, jadi jeda lama membuang
 *  angka yang sebenarnya ada — tundaannya pilihan kita, bukan batas sumber. */
export function useHargaLive(kode: string | null, jedaDetik = 15): HargaLive | null {
  const [harga, setHarga] = useState<HargaLive | null>(null)
  useEffect(() => {
    if (!kode) { setHarga(null); return }
    let batal = false
    let timer: ReturnType<typeof setInterval> | null = null
    const tarik = () => {
      if (document.visibilityState === 'hidden') return
      // Gagal sesaat (timeout 2,5 s, 503 saat rantai token mati) TIDAK
      // menimpa nilai yang sudah baik dengan null — pemakai membaca umurnya
      // dari `diambilPada`. Null hanya saat kode berganti (blok di atas).
      // Temuan tinjauan 8 Sep 2026: tanpa ini bar/label live berkedip hilang
      // 45 detik tiap satu tarikan gagal.
      void ambilHargaLive(kode).then((d) => { if (!batal && d) setHarga(d) })
    }
    setHarga(null)
    tarik()
    timer = setInterval(tarik, jedaDetik * 1000)
    // Tab yang kembali terlihat langsung menarik ulang, supaya angka 10 menit
    // lalu tidak sempat tampil berlabel "tertunda ≤ 2 menit".
    const saatTampak = () => { if (document.visibilityState === 'visible') tarik() }
    document.addEventListener('visibilitychange', saatTampak)
    return () => { batal = true; if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', saatTampak) }
  }, [kode, jedaDetik])
  return harga
}
