import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTOH_TANYA } from '../../lib/dasbor/tanyaPapan'
import { useTanyaPapan } from '../../lib/dasbor/useTanyaPapan'
import { Blok, Keadaan, Pil } from './ui'
import { KakiBaru } from './KakiBaru'
import { TANYA_PAPAN_AKTIF } from '../../lib/fitur'

/**
 * Layar Tanya (#231, artboard Main) — pakai ulang mesin `useTanyaPapan` yang
 * juga dipakai panel mengambang `TanyaPapan.tsx`; jawabannya identik, cuma
 * bungkus tampilan yang beda: di sini kotak tanya besar dan riwayat sebagai
 * blok penuh, bukan panel kecil.
 */
function LayarTanyaAktif() {
  const [teks, setTeks] = useState('')
  const { riwayat, berpikir, kirim: kirimHook } = useTanyaPapan()
  const akhirRef = useRef<HTMLDivElement>(null)

  useEffect(() => { akhirRef.current?.scrollIntoView({ block: 'end' }) }, [riwayat, berpikir])

  function kirim(pertanyaan: string) {
    if (!pertanyaan.trim()) return
    setTeks('')
    void kirimHook(pertanyaan)
  }

  return (
    <div className="bb-isi">
      <Blok kelas="polos" judul="Tanya pasar dengan bahasa biasa. Jawabannya angka, bukan opini." />

      <form
        onSubmit={(e) => { e.preventDefault(); kirim(teks) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px 6px 22px',
          background: 'var(--bb-panel)', border: '1px solid var(--bb-garis)', borderRadius: 999, maxWidth: 860,
        }}
      >
        <label htmlFor="lt-tanya" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Pertanyaan
        </label>
        <input
          id="lt-tanya"
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder="Tanya soal pasar hari ini…"
          style={{ flexGrow: 1, minWidth: 0, minHeight: 44, background: 'transparent', border: 0, color: 'var(--bb-teks)', font: '400 16px var(--bb-sans)', outline: 'none' }}
        />
        <button
          type="submit"
          disabled={!teks.trim() || berpikir}
          style={{ minHeight: 44, padding: '0 22px', borderRadius: 999, border: 0, background: 'var(--bb-emas)', color: 'var(--bb-latar)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          Bedah
        </button>
      </form>

      <div className="bb-pils">
        {CONTOH_TANYA.map((c) => (
          <Pil key={c} onClick={() => kirim(c)}>{c}</Pil>
        ))}
      </div>

      <Blok label="Riwayat jawaban">
        {riwayat.length === 0 ? (
          <Keadaan kosong="Belum ada pertanyaan — coba salah satu contoh di atas." />
        ) : (
          <div className="bb-daftar">
            {riwayat.map((b, i) => (
              <div
                key={i}
                className="bb-blok panel"
                style={b.dari === 'papan' ? { borderLeft: '3px solid var(--bb-emas)', borderRadius: '0 12px 12px 0' } : undefined}
              >
                <span className="bb-label">
                  {b.dari === 'orang' ? 'Pertanyaan' : 'Jawaban'}
                  {b.dariAI && ' · disusun AI'}
                </span>
                <p className="bb-narasi" style={{ color: 'var(--bb-teks)', whiteSpace: 'pre-line' }}>{b.teks}</p>
                {b.ke && <Link to={b.ke}>{b.keLabel ?? 'Buka halaman'} →</Link>}
                {b.saran && b.saran.length > 0 && (
                  <div className="bb-pils">
                    {b.saran.map((s) => (
                      <Pil key={s} onClick={() => kirim(s)}>{s}</Pil>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {berpikir && <p className="bb-narasi">menelusuri data…</p>}
            <div ref={akhirRef} />
          </div>
        )}
      </Blok>

      <KakiBaru sumber="Statistik resmi bursa dan panen harian PAPAN." />
    </div>
  )
}

/** Tanya PAPAN dimatikan sementara atas perintah Johan 21 Agu 2026 ("takdown
 *  dlu Papan AI"). Layar ini ikut sakelar yang sama: selama mati, mesinnya tak
 *  dijalankan sama sekali (komponen aktif tak dirender, jadi hook-nya tak jalan). */
export default function LayarTanya() {
  if (TANYA_PAPAN_AKTIF) return <LayarTanyaAktif />
  return (
    <div className="bb-isi">
      <Blok
        judul="Layar Tanya belum dibuka"
        narasi="Tanya pasar dengan bahasa biasa sedang disiapkan dan belum dibuka untuk umum. Sementara itu, jawaban berangka tersedia di lapisan Bukti dan di halaman tiap layar."
      >
        <div className="bb-pils">
          <Link to="/baru/bukti" className="bb-tombol">Buka Bukti</Link>
          <Link to="/baru/pasar" className="bb-tombol">Peta pasar</Link>
        </div>
      </Blok>
      <KakiBaru sumber="Statistik resmi bursa dan panen harian PAPAN." />
    </div>
  )
}
