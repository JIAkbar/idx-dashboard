import { useEffect, useMemo, useState } from 'react'
import { fN } from '../../../lib/dasbor/format'
import { hitungBlender, type PosisiBlender } from '../../../lib/dasbor/kalkulatorLanjut'
import { IkonMenu, IKON_TONG, IKON_PERINGATAN } from '../../../components/dasbor/IkonMenu'

const KUNCI_LS = 'kalk_blender'
const RIWAYAT_MAKS = 20
const MAKS_POSISI = 8
interface BarisRiwayat { teks: string; waktu: string }

function bacaRiwayat(): BarisRiwayat[] {
  try { return JSON.parse(localStorage.getItem(KUNCI_LS + '_riwayat') || '[]') as BarisRiwayat[] } catch { return [] }
}
function simpanRiwayat(teks: string): BarisRiwayat[] {
  const baris = [{ teks, waktu: new Date().toLocaleString('id-ID') }, ...bacaRiwayat()].slice(0, RIWAYAT_MAKS)
  try { localStorage.setItem(KUNCI_LS + '_riwayat', JSON.stringify(baris)) } catch { /* kuota penuh: riwayat boleh hilang */ }
  return baris
}

const KOSONG: PosisiBlender[] = Array.from({ length: MAKS_POSISI }, () => ({ harga: 0, lot: 0 }))

/**
 * Blender Posisi (Average Price) — port spek §F.2: sampai 8 posisi (harga,
 * lot) dijadikan satu WAP. Baris ke-9 kosong berikutnya = "simulasi tambah
 * posisi baru" — cukup diisi, WAP & break-even hitung ulang langsung karena
 * seluruh form ini sudah reaktif; tak perlu tombol terpisah.
 */
export function Blender() {
  const [posisi, setPosisi] = useState<PosisiBlender[]>(KOSONG)
  const [feeBeli, setFeeBeli] = useState(0.15)
  const [feeJual, setFeeJual] = useState(0.25)
  const [riwayat, setRiwayat] = useState<BarisRiwayat[]>([])

  useEffect(() => {
    setRiwayat(bacaRiwayat())
    try {
      const s = JSON.parse(localStorage.getItem(KUNCI_LS) || 'null')
      if (s) {
        if (Array.isArray(s.posisi)) setPosisi(s.posisi)
        if (s.feeBeli != null) setFeeBeli(s.feeBeli)
        if (s.feeJual != null) setFeeJual(s.feeJual)
      }
    } catch { /* korup/tidak ada — mulai kosong */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(KUNCI_LS, JSON.stringify({ posisi, feeBeli, feeJual })) } catch { /* abaikan */ }
  }, [posisi, feeBeli, feeJual])

  function ubah(i: number, ruas: 'harga' | 'lot', v: string) {
    const n = parseFloat(v) || 0
    setPosisi((prev) => prev.map((p, idx) => (idx === i ? { ...p, [ruas]: n } : p)))
  }

  const hasil = useMemo(() => hitungBlender(posisi, feeBeli, feeJual), [posisi, feeBeli, feeJual])

  function simpan() {
    if (!hasil) return
    setRiwayat(simpanRiwayat(`WAP ${fN(hasil.wap)} · BEP ${fN(hasil.breakEven)} · ${fN(hasil.totalLot, 0)} lot`))
  }

  return (
    <div className="grid2 kalk-blender">
      <section className="panel">
        <div className="panel-h">
          <span className="lbl"><IkonMenu d={IKON_TONG} size={13} /> Blender Posisi (Average Price)</span>
          <span className="v-note">sampai {MAKS_POSISI} posisi</span>
        </div>
        <div className="panel-b" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr><th>#</th><th className="r">Harga (Rp)</th><th className="r">Lot</th></tr>
            </thead>
            <tbody>
              {posisi.map((p, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td className="r"><input className="inp" type="number" min={0} value={p.harga || ''} placeholder="0"
                    onChange={(e) => ubah(i, 'harga', e.target.value)} style={{ textAlign: 'right' }} /></td>
                  <td className="r"><input className="inp" type="number" min={0} value={p.lot || ''} placeholder="0"
                    onChange={(e) => ubah(i, 'lot', e.target.value)} style={{ textAlign: 'right' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div className="field">
              <span className="lbl">Fee Beli (%)</span>
              <input className="inp" type="number" min={0} max={5} step={0.01} value={feeBeli} onChange={(e) => setFeeBeli(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="field">
              <span className="lbl">Fee Jual (%)</span>
              <input className="inp" type="number" min={0} max={5} step={0.01} value={feeJual} onChange={(e) => setFeeJual(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="v-note" style={{ display: 'block', marginTop: 6, lineHeight: 1.5 }}>
            Default: Beli 0,15% / Jual 0,25% (standar IDX/Stockbit). Break-even = harga jual yang
            menutup modal <b>termasuk fee</b>, dibulatkan NAIK ke tick.
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gap: 14 }}>
        <section className="panel">
          <div className="panel-h"><span className="lbl">Hasil</span></div>
          <div className="panel-b">
            {hasil ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span className="lbl">WAP (Weighted Average Price)</span>
                  <div className="num" style={{ fontSize: 26, fontWeight: 600 }}>Rp {fN(hasil.wap)}</div>
                  <div className="v-note">WAP = Σ(harga × lot) ÷ total lot — belum termasuk fee</div>
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div className="bm"><span className="lbl">Total lot</span><span className="num">{fN(hasil.totalLot, 0)}</span></div>
                  <div className="bm"><span className="lbl">Total modal</span><span className="num">Rp {fN(hasil.totalModal, 0)}</span></div>
                  <div className="bm"><span className="lbl">Break-even (+ fee)</span><span className="num" style={{ color: 'var(--amber)' }}>Rp {fN(hasil.breakEven)}</span></div>
                </div>
                <button className="btn-p btn-p-kecil" onClick={simpan} style={{ alignSelf: 'flex-start' }}>Simpan ke riwayat</button>
              </div>
            ) : (
              <div className="v-note">Isi minimal satu posisi (harga & lot) untuk melihat hasil.</div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><span className="lbl">Preset Cut-Loss</span></div>
          <div className="panel-b">
            <table className="tbl">
              <thead><tr><th>Dari WAP</th><th className="r">Harga (tick)</th><th className="r">Rugi (Rp)</th></tr></thead>
              <tbody>
                {hasil ? (
                  hasil.presetCutLoss.map((p) => (
                    <tr key={p.persen}>
                      <td>{p.persen}%</td>
                      <td className="r num dn">{fN(p.harga)}</td>
                      <td className="r num dn">{fN(p.rugiRupiah, 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={3} style={{ color: 'var(--text3)', textAlign: 'center', padding: 14 }}>Isi posisi di kiri</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><span className="lbl">Riwayat</span></div>
          <div className="panel-b">
            {riwayat.length ? (
              <div className="kp-hist">
                {riwayat.map((b, i) => <div key={i}><span>{b.teks}</span><span className="kp-waktu">{b.waktu}</span></div>)}
              </div>
            ) : (
              <div className="kp-kosong">Belum ada perhitungan tersimpan.</div>
            )}
          </div>
        </section>

        <p className="muted" style={{ fontSize: 11, lineHeight: 1.7, margin: 0 }}>
          <IkonMenu d={IKON_PERINGATAN} size={12} /> Estimasi perencanaan, bukan saran investasi (Not Financial Advice).
        </p>
      </div>
    </div>
  )
}
