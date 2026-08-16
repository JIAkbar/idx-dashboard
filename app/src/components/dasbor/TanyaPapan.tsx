import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { useBulletinList } from '../../lib/dasbor/bulletin'
import { useKabar } from '../../lib/dasbor/kabar'
import { jawab, CONTOH_TANYA, type Jawaban } from '../../lib/dasbor/tanyaPapan'
import { IkonMenu, IKON_SILANG } from './IkonMenu'
import './TanyaPapan.css'

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
  const { hari } = useDataHarian()
  const { daftar: edisi } = useBulletinList()
  const { kabar } = useKabar()
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

  function kirim(pertanyaan: string) {
    const q = pertanyaan.trim()
    if (!q) return
    const j: Jawaban = jawab(q, { hari: hari ?? null, edisi: edisi ?? null, kabar: kabar?.item ?? null })
    setRiwayat((r) => [...r, { dari: 'orang', teks: q }, { dari: 'papan', teks: j.teks, ke: j.ke, keLabel: j.keLabel }])
    setTeks('')
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
        <span className="tp-lambang">P</span>
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
