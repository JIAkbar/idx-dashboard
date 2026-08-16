import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { useBulletinList } from '../../lib/dasbor/bulletin'
import { useKabar } from '../../lib/dasbor/kabar'
import { useKamusEmiten } from '../../lib/dasbor/kamusEmiten'
import { fetchFundamental } from '../../lib/dasbor/stockDetailData'
import { loadInvestorMap } from '../../lib/dasbor/petaInvestorData'
import { jawab, CONTOH_TANYA, type Jawaban, type Topik, type DataButuh, type OhlcRingkas } from '../../lib/dasbor/tanyaPapan'
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
}

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
  const [buka, setBuka] = useState(false)
  const [teks, setTeks] = useState('')
  const [riwayat, setRiwayat] = useState<Baris[]>([])
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
  useEffect(() => { akhirRef.current?.scrollIntoView({ block: 'end' }) }, [riwayat])

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
    let j: Jawaban = jawab(q, ctx)
    // Mekanisme dua-langkah (#lihat tanyaPapan.ts): jawab() minta berkas
    // PER-EMITEN yang belum ada di konteks, di sini diambil, lalu jawab()
    // dipanggil ULANG dengan pertanyaan yang SAMA dan `data` terisi.
    if (j.butuh) {
      const data = await ambilButuh(j.butuh)
      j = jawab(q, { ...ctx, data })
    }
    // Topik hanya diperbarui kalau jawabannya memang mengenali sesuatu —
    // jawaban "tak paham" tak boleh menghapus konteks yang masih berguna.
    if (j.topik) topikRef.current = j.topik
    setRiwayat((r) => [...r, { dari: 'papan', teks: j.teks, ke: j.ke, keLabel: j.keLabel }])
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
                {b.ke && (
                  <Link className="tp-tautan" to={b.ke} onClick={() => setBuka(false)}>
                    {b.keLabel ?? 'Buka halaman'} →
                  </Link>
                )}
              </div>
            ))}
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
            <button type="submit" className="btn-p" disabled={!teks.trim()}>Kirim</button>
          </form>
        </div>
      )}
    </>
  )
}
