import { useRef, useState } from 'react'
import { useDataHarian } from './dataHarian'
import { useBulletinList } from './bulletin'
import { useKabar } from './kabar'
import { useKamusEmiten } from './kamusEmiten'
import { fetchFundamental } from './stockDetailData'
import { loadInvestorMap } from './petaInvestorData'
import { muatTambahanKeystats } from './rasioTambahanKeystats'
import { jawab, type Jawaban, type Topik, type DataButuh, type OhlcRingkas } from './tanyaPapan'
import { useTopBrokerHari } from './brokerHarian'
import { tanyaAI, rakitKonteks } from './tanyaAI'
import { useAuth } from '../../context/AuthContext'
import { urlData } from './baseData'

/** Satu baris percakapan — dipakai panel mengambang dan Layar Tanya (#231). */
export interface Baris {
  dari: 'orang' | 'papan'
  teks: string
  ke?: string
  keLabel?: string
  /** Jawaban ini datang dari model bahasa, bukan dari data yang dihitung.
   *  Bedanya WAJIB terlihat pembaca — itu inti janji fitur ini. */
  dariAI?: boolean
  /** Pertanyaan lanjutan yang ditawarkan sebagai chip (lihat `Jawaban.saran`
   *  di tanyaPapan.ts) — klik langsung mengirim teksnya. */
  saran?: string[]
}

/** Jeda minimum sebelum jawaban muncul — lihat catatan di TanyaPapan.tsx lama:
 *  jawaban aturan datang dalam hitungan milidetik dan itu terbaca seperti
 *  templat siap saji, bukan seperti sesuatu yang membaca pertanyaannya. */
const JEDA_MIN = 520

/** Cache modul berkas OHLC per emiten. `null` = 404 (dicache juga supaya tak
 *  fetch ulang percuma). */
const ohlcCache = new Map<string, OhlcRingkas | null>()
function fetchOhlcRingkas(kode: string): Promise<OhlcRingkas | null> {
  const cached = ohlcCache.get(kode)
  if (cached !== undefined) return Promise.resolve(cached)
  return fetch(urlData(`/data-idx/json/ohlc/${kode}.json`))
    .then((r) => (r.ok ? (r.json() as Promise<OhlcRingkas>) : Promise.reject(new Error('not found'))))
    .then((d) => {
      ohlcCache.set(kode, d)
      return d
    })
    .catch(() => {
      ohlcCache.set(kode, null)
      return null
    })
}

/** Tahap-2 mekanisme dua-langkah (lihat komentar `jawab()`/`Jawaban.butuh`
 *  di tanyaPapan.ts): ambil berkas PER-EMITEN yang diminta, sesuai jenisnya.
 *  `jawab()` sendiri sengaja tak fetch apa pun — ini satu-satunya tempat
 *  fetch untuk mesin Tanya PAPAN terjadi. */
async function ambilButuh(butuh: NonNullable<Jawaban['butuh']>): Promise<DataButuh> {
  if (butuh.jenis === 'fundamental') {
    const [payload, tambahan] = await Promise.all([
      fetchFundamental(butuh.kode),
      muatTambahanKeystats(butuh.kode).catch(() => null),
    ])
    return { jenis: 'fundamental', kode: butuh.kode, payload, rasio: tambahan?.rasio ?? null }
  }
  if (butuh.jenis === 'ohlc') {
    return { jenis: 'ohlc', kode: butuh.kode, payload: await fetchOhlcRingkas(butuh.kode) }
  }
  const daftar = await loadInvestorMap().catch(() => [])
  return { jenis: 'investor', kode: butuh.kode, payload: daftar.find((e) => e.code === butuh.kode) ?? null }
}

/**
 * Mesin Tanya PAPAN — dipakai KEDUA-DUANYA: panel mengambang
 * (`components/dasbor/TanyaPapan.tsx`) dan Layar Tanya (`views/baru/LayarTanya.tsx`,
 * #231). Bungkus UI beda, jawabannya harus identik, jadi state riwayat, kirim,
 * ambilButuh dan rakitan konteks tinggal di sini — bukan disalin dua kali.
 */
export function useTanyaPapan() {
  // Lapis AI berbiaya per pertanyaan, jadi hanya untuk yang sudah masuk —
  // gerbang KENYAMANAN saja, gerbang sebenarnya ada di Edge Function.
  const { session } = useAuth()
  const [riwayat, setRiwayat] = useState<Baris[]>([])
  const [berpikir, setBerpikir] = useState(false)
  // Topik & subjek jawaban terakhir — bahan sambungan untuk pertanyaan
  // sependek "kenapa?"/"berapa?". Di ref, bukan state: nilainya tak menggambar
  // apa pun.
  const topikRef = useRef<Topik>(null)
  const subjekRef = useRef<string | null>(null)
  const { hari, tanggalTersedia, tanggalAktif } = useDataHarian()
  const { val: topBroker } = useTopBrokerHari(tanggalAktif ?? null)
  const { daftar: edisi } = useBulletinList()
  const { kabar } = useKabar()
  const kamus = useKamusEmiten()

  async function kirim(pertanyaan: string) {
    const q = pertanyaan.trim()
    if (!q) return
    setRiwayat((r) => [...r, { dari: 'orang', teks: q }])

    const ctx = {
      hari: hari ?? null,
      topBroker: topBroker ?? null,
      seri: tanggalTersedia ?? null,
      edisi: edisi ?? null,
      kabar: kabar?.item ?? null,
      topik: topikRef.current,
      subjek: subjekRef.current,
      kamus,
    }
    setBerpikir(true)
    const mulai = Date.now()

    let j: Jawaban = jawab(q, ctx)
    if (j.butuh) {
      const data = await ambilButuh(j.butuh)
      j = jawab(q, { ...ctx, data })
    }

    let dariAI = false
    if (j.takPaham && session) {
      const ai = await tanyaAI(q, rakitKonteks(hari ?? null, edisi ?? null, kabar?.item ?? null))
      if (ai) {
        j = { ...j, teks: ai.teks, takPaham: false }
        dariAI = ai.dariAI
      }
    } else if (j.takPaham) {
      j = {
        ...j,
        teks: `${j.teks}

Lapis AI-nya khusus yang sudah masuk — tiap pertanyaan ke sana ` +
          'berbiaya, jadi jatahnya dipegang kontributor. Pertanyaan soal angka pasar tetap ' +
          'dijawab dari data tanpa perlu masuk.',
      }
    }

    const sisa = JEDA_MIN - (Date.now() - mulai)
    if (sisa > 0) await new Promise((r) => setTimeout(r, sisa))
    setBerpikir(false)

    if (j.topik) {
      topikRef.current = j.topik
      subjekRef.current = j.subjek ?? null
    }
    setRiwayat((r) => [...r, { dari: 'papan', teks: j.teks, ke: j.ke, keLabel: j.keLabel, dariAI, saran: j.saran }])
  }

  return { riwayat, berpikir, kirim }
}
