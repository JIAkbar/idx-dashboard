import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { useBulletinList } from '../../lib/dasbor/bulletin'
import { useKabar } from '../../lib/dasbor/kabar'
import { useKamusEmiten } from '../../lib/dasbor/kamusEmiten'
import { fetchFundamental } from '../../lib/dasbor/stockDetailData'
import { loadInvestorMap } from '../../lib/dasbor/petaInvestorData'
import { jawab, CONTOH_TANYA, type Jawaban, type Topik, type DataButuh, type OhlcRingkas } from '../../lib/dasbor/tanyaPapan'
import { tanyaAI, rakitKonteks } from '../../lib/dasbor/tanyaAI'
import { useAuth } from '../../context/AuthContext'
import { IkonMenu, IKON_SILANG } from './IkonMenu'
import './TanyaPapan.css'

/** Cache modul berkas OHLC per emiten dipakai Tanya PAPAN — sama pola dengan
 *  `fundamentalCache`/`loadInvestorMap`, tapi belum ada pemakai lain yang
 *  butuh cache imperatif untuk berkas ini, jadi ditaruh lokal di sini saja
 *  (bukan lib bersama) sampai ada pemakai kedua. `null` = 404 (emiten tak
 *  punya berkas OHLC), dicache juga supaya tak fetch ulang percuma. */
const ohlcCache = new Map<string, OhlcRingkas | null>()
function fetchOhlcRingkas(kode: string): Promise<OhlcRingkas | null> {
  const cached = ohlcCache.get(kode)
  if (cached !== undefined) return Promise.resolve(cached)
  return fetch(`/data-idx/json/ohlc/${kode}.json`)
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
 *  fetch untuk fitur Tanya PAPAN terjadi. */
async function ambilButuh(butuh: NonNullable<Jawaban['butuh']>): Promise<DataButuh> {
  if (butuh.jenis === 'fundamental') {
    return { jenis: 'fundamental', kode: butuh.kode, payload: await fetchFundamental(butuh.kode) }
  }
  if (butuh.jenis === 'ohlc') {
    return { jenis: 'ohlc', kode: butuh.kode, payload: await fetchOhlcRingkas(butuh.kode) }
  }
  // investor_map.json satu berkas untuk SEMUA emiten (584 KB) — di-fetch
  // sekali lewat cache modul `loadInvestorMap` (dipakai bareng halaman Peta
  // Investor), lalu disaring ke satu kode di sini.
  const daftar = await loadInvestorMap().catch(() => [])
  return { jenis: 'investor', kode: butuh.kode, payload: daftar.find((e) => e.code === butuh.kode) ?? null }
}

interface Baris {
  dari: 'orang' | 'papan'
  teks: string
  ke?: string
  keLabel?: string
  /** Jawaban ini datang dari model bahasa, bukan dari data yang dihitung.
   *  Bedanya WAJIB terlihat pembaca — itu inti janji panel ini. */
  dariAI?: boolean
}

/** Jeda minimum sebelum jawaban muncul.
 *
 *  Jawaban aturan datang dalam hitungan milidetik, dan itu justru terbaca
 *  seperti templat yang sudah disiapkan, bukan seperti sesuatu yang membaca
 *  pertanyaannya. Jedanya bukan kepura-puraan berpikir — panel memang sedang
 *  menunggu (berkas per-emiten, kadang lapis AI), dan jeda seragam membuat
 *  yang cepat dan yang lambat terasa satu perilaku, bukan dua. */
const JEDA_MIN = 520

/**
 * "Tanya PAPAN" — tombol mengambang berlambang P + panel percakapan.
 *
 * Tahap pertama menjawab DARI DATA, bukan dari model bahasa: tiap jawaban
 * ditarik dari berkas harian, arsip edisi, dan kabar yang memang sudah kita
 * panen, lalu dilengkapi tautan ke halaman yang membuktikannya. Lapisan LLM
 * menyusul untuk pertanyaan bebas yang tak cocok dengan pola mana pun
 * (rencana #167) — dan saat itu tiba, bedanya harus tetap terlihat oleh
 * pembaca, bukan dikaburkan.
 *
 * Dipasang di DasborLayout supaya ikut ke semua halaman publik.
 */
export function TanyaPapan() {
  // Lapis AI berbiaya per pertanyaan, jadi hanya untuk yang sudah masuk.
  // Ini penjaga KENYAMANAN — supaya tamu tak menunggu jeda lalu dapat
  // penolakan; gerbang yang sebenarnya ada di Edge Function, karena
  // fungsi itu bisa dipanggil langsung tanpa lewat halaman ini.
  const { session } = useAuth()
  const [buka, setBuka] = useState(false)
  const [teks, setTeks] = useState('')
  const [riwayat, setRiwayat] = useState<Baris[]>([])
  const [berpikir, setBerpikir] = useState(false)
  // Topik jawaban terakhir — bahan sambungan untuk pertanyaan sependek
  // "kenapa?". Disimpan di ref, bukan state: nilainya tak menggambar apa pun,
  // dan menaruhnya di state berarti satu render tambahan tiap tanya.
  const topikRef = useRef<Topik>(null)
  const { hari, tanggalTersedia } = useDataHarian()
  const { daftar: edisi } = useBulletinList()
  const { kabar } = useKabar()
  const kamus = useKamusEmiten()
  const akhirRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!buka) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false) }
    window.addEventListener('keydown', onKey)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [buka])

  // Gulir ke jawaban terbaru — percakapan yang jawabannya di luar layar
  // terasa seperti tak menjawab.
  useEffect(() => { akhirRef.current?.scrollIntoView({ block: 'end' }) }, [riwayat, berpikir])

  async function kirim(pertanyaan: string) {
    const q = pertanyaan.trim()
    if (!q) return
    // Pertanyaan orang tampil SEGERA (tak menunggu fetch tahap-2 kalau ada)
    // — jeda satu-dua berkas kecil tak boleh terasa seperti panel diam.
    setRiwayat((r) => [...r, { dari: 'orang', teks: q }])
    setTeks('')

    const ctx = {
      hari: hari ?? null,
      seri: tanggalTersedia ?? null,
      edisi: edisi ?? null,
      kabar: kabar?.item ?? null,
      topik: topikRef.current,
      kamus,
    }
    setBerpikir(true)
    const mulai = Date.now()

    let j: Jawaban = jawab(q, ctx)
    // Mekanisme dua-langkah (#lihat tanyaPapan.ts): jawab() minta berkas
    // PER-EMITEN yang belum ada di konteks, di sini diambil, lalu jawab()
    // dipanggil ULANG dengan pertanyaan yang SAMA dan `data` terisi.
    if (j.butuh) {
      const data = await ambilButuh(j.butuh)
      j = jawab(q, { ...ctx, data })
    }

    // Lapis AI cuma dipanggil kalau mesin aturan MENYERAH. Urutannya begitu
    // supaya pertanyaan yang punya jawaban pasti di data kita tak pernah
    // dilempar ke model bahasa — itu membayar token untuk angka yang sudah
    // kita hitung sendiri, sekaligus membuka pintu jawaban yang mengarang.
    let dariAI = false
    if (j.takPaham && session) {
      const ai = await tanyaAI(q, rakitKonteks(hari ?? null, edisi ?? null, kabar?.item ?? null))
      if (ai) {
        j = { ...j, teks: ai.teks, takPaham: false }
        dariAI = ai.dariAI
      }
    } else if (j.takPaham) {
      // Tamu tetap mendapat seluruh mesin aturan — yang ditahan cuma lapis AI.
      // Kalimatnya menyebut sebabnya (berbiaya), bukan sekadar "tidak boleh".
      j = {
        ...j,
        teks: `${j.teks}

Lapis AI-nya khusus yang sudah masuk — tiap pertanyaan ke sana ` +
          'berbiaya, jadi jatahnya dipegang kontributor. Pertanyaan soal angka pasar tetap ' +
          'dijawab dari data tanpa perlu masuk.',
      }
    }

    // Jeda seragam — lihat JEDA_MIN.
    const sisa = JEDA_MIN - (Date.now() - mulai)
    if (sisa > 0) await new Promise((r) => setTimeout(r, sisa))
    setBerpikir(false)

    // Topik hanya diperbarui kalau jawabannya memang mengenali sesuatu —
    // jawaban "tak paham" tak boleh menghapus konteks yang masih berguna.
    if (j.topik) topikRef.current = j.topik
    setRiwayat((r) => [...r, { dari: 'papan', teks: j.teks, ke: j.ke, keLabel: j.keLabel, dariAI }])
  }

  return (
    <>
      <button
        type="button"
        className={`tp-tombol${buka ? ' buka' : ''}`}
        aria-label="Tanya PAPAN"
        title="Tanya PAPAN — jawaban ditarik dari data"
        onClick={() => setBuka((v) => !v)}
      >
        {/* Lambang P + label AI + nama yang memanjang saat disentuh.
            Cincin conic yang berputar SEMPAT dipasang lalu dibuang: begitu
            tombol memanjang jadi pil, gradasinya menyapu ke luar bentuknya —
            animasi yang menuntut bentuk tetap tak cocok dipasang di elemen
            yang berubah lebar. */}
        <span className="tp-lambang">P</span>
        <span className="tp-ai" aria-hidden="true">AI</span>
        <span className="tp-teks">Tanya PAPAN</span>
      </button>

      {buka && (
        <div className="lantai tp-panel" role="dialog" aria-label="Tanya PAPAN">
          <div className="tp-kepala">
            <span className="lbl">Tanya PAPAN</span>
            <button type="button" className="tp-tutup" aria-label="Tutup" onClick={() => setBuka(false)}>
              <IkonMenu d={IKON_SILANG} size={13} />
            </button>
          </div>

          <p className="tp-catatan">
            Menjawab <b>dari data yang sudah dihitung</b> — bukan dari model bahasa.
            Tiap jawaban membawa tautan ke halaman yang membuktikannya.
          </p>

          <div className="tp-isi">
            {riwayat.length === 0 && (
              <div className="tp-contoh">
                <span className="lbl">Coba tanya</span>
                {CONTOH_TANYA.map((c) => (
                  <button key={c} type="button" className="tp-contoh-it" onClick={() => kirim(c)}>{c}</button>
                ))}
              </div>
            )}
            {riwayat.map((b, i) => (
              <div key={i} className={`tp-baris ${b.dari}`}>
                <span className="tp-gelembung">{b.teks}</span>
                {/* Jawaban dari model bahasa DITANDAI. Panel ini berjanji
                    menjawab dari data yang sudah dihitung; begitu ada jawaban
                    yang tidak begitu, pembaca berhak tahu yang mana. */}
                {b.dariAI && (
                  <span className="tp-tanda-ai" title="Disusun model bahasa dari data PAPAN, bukan angka yang dihitung langsung">
                    disusun AI
                  </span>
                )}
                {b.ke && (
                  <Link className="tp-tautan" to={b.ke} onClick={() => setBuka(false)}>
                    {b.keLabel ?? 'Buka halaman'} →
                  </Link>
                )}
              </div>
            ))}
            {berpikir && (
              <div className="tp-baris papan" aria-live="polite">
                <span className="tp-gelembung tp-mikir">
                  <i /><i /><i />
                  <span className="tp-mikir-teks">menelusuri data…</span>
                </span>
              </div>
            )}
            <div ref={akhirRef} />
          </div>

          <form
            className="tp-kirim"
            onSubmit={(e) => { e.preventDefault(); kirim(teks) }}
          >
            <input
              ref={inputRef}
              className="inp"
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              placeholder="Tanya soal pasar hari ini…"
              aria-label="Pertanyaan"
            />
            <button type="submit" className="btn-p" disabled={!teks.trim() || berpikir}>Kirim</button>
          </form>
        </div>
      )}
    </>
  )
}
