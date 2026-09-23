import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTOH_TANYA } from '../../lib/dasbor/tanyaPapan'
import { useTanyaPapan } from '../../lib/dasbor/useTanyaPapan'
import { IkonMenu, IKON_SILANG } from './IkonMenu'
import './TanyaPapan.css'

/** Kunci localStorage pilihan "tepikan tombol". */
const KUNCI_TEPI = 'papan:tanya-tepi'
/** Panah ke kanan — menepikan tombol ke pinggir layar. */
const IKON_TEPIKAN = 'M9 6l6 6-6 6'

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
  /** Tombol ditepikan ke pinggir layar — disimpan supaya pilihannya
   *  bertahan antar halaman dan antar kunjungan. */
  const [tepi, setTepi] = useState(() => {
    try { return localStorage.getItem(KUNCI_TEPI) === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(KUNCI_TEPI, tepi ? '1' : '0') } catch { /* mode privat */ }
  }, [tepi])
  const [teks, setTeks] = useState('')
  const { riwayat, berpikir, kirim: kirimHook } = useTanyaPapan()
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

  // Pertanyaan orang tampil SEGERA lewat hook (tak menunggu fetch tahap-2
  // kalau ada); di sini cuma mengosongkan kotak ketik begitu terkirim.
  function kirim(pertanyaan: string) {
    if (!pertanyaan.trim()) return
    setTeks('')
    void kirimHook(pertanyaan)
  }

  return (
    <>
      <button
        type="button"
        className={`tp-tombol${buka ? ' buka' : ''}${tepi ? ' tepi' : ''}`}
        aria-label={tepi ? 'Kembalikan tombol Tanya PAPAN' : 'Tanya PAPAN'}
        title={tepi
          ? 'Tanya PAPAN — sedang ditepikan, klik untuk mengembalikan'
          : 'Tanya PAPAN — jawaban ditarik dari data'}
        onClick={() => {
          // Saat ditepikan, klik pertama MENGEMBALIKAN tombolnya — bukan
          // membuka panel. Panel yang terbuka dari sliver 18px akan terasa
          // seperti salah pencet.
          if (tepi) { setTepi(false); return }
          setBuka((v) => !v)
        }}
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
            <span className="ti-grup">
              {/* Menepikan, bukan mematikan: tombolnya menyusut jadi sliver di
                  tepi layar dan tetap satu ketukan dari kembali. Johan 21 Agu
                  2026: *"AI ini menghalangi di bnyk tempat"* — ruang yang
                  dipesan (`--ruang-fab`) menutup tabrakan yang KITA tahu,
                  sakelar ini menutup yang belum kita tahu. */}
              <button type="button" className="tp-tutup" onClick={() => { setTepi(true); setBuka(false) }}
                aria-label="Tepikan tombol" title="Tepikan tombol ke pinggir layar">
                <IkonMenu d={IKON_TEPIKAN} size={13} />
              </button>
              <button type="button" className="tp-tutup" aria-label="Tutup" onClick={() => setBuka(false)}>
                <IkonMenu d={IKON_SILANG} size={13} />
              </button>
            </span>
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
                {b.saran && b.saran.length > 0 && (
                  <div className="tp-saran">
                    {b.saran.map((s) => (
                      <button key={s} type="button" className="tp-contoh-it" onClick={() => kirim(s)}>{s}</button>
                    ))}
                  </div>
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
