import { useEffect, useMemo, useState } from 'react'
import { fN } from '../../../lib/dasbor/format'
import { hitungPiramida, PORSI_LAPIS_PIRAMIDA } from '../../../lib/dasbor/kalkulatorLanjut'
import { IkonMenu, IKON_KUADRAN, IKON_PERINGATAN } from '../../../components/dasbor/IkonMenu'

const KUNCI_LS = 'kalk_piramida'
const RIWAYAT_MAKS = 20
interface BarisRiwayat { teks: string; waktu: string }

function bacaRiwayat(): BarisRiwayat[] {
  try { return JSON.parse(localStorage.getItem(KUNCI_LS + '_riwayat') || '[]') as BarisRiwayat[] } catch { return [] }
}
function simpanRiwayat(teks: string): BarisRiwayat[] {
  const baris = [{ teks, waktu: new Date().toLocaleString('id-ID') }, ...bacaRiwayat()].slice(0, RIWAYAT_MAKS)
  try { localStorage.setItem(KUNCI_LS + '_riwayat', JSON.stringify(baris)) } catch { /* kuota penuh: riwayat boleh hilang */ }
  return baris
}

/**
 * Piramida (Pyramid Entry) — port spek §F.1: risiko per transaksi menentukan
 * lot dasar, lalu dibagi 4 lapis berporsi tetap (konvensi kalkulator ini,
 * bukan aturan bursa) menaik berjenjang saat harga bergerak sesuai rencana.
 */
export function Piramida() {
  const [modalRaw, setModalRaw] = useState('50000000')
  const [risiko, setRisiko] = useState('1')
  const [masuk, setMasuk] = useState('')
  const [sl, setSl] = useState('')
  const [langkah, setLangkah] = useState('2')
  const [riwayat, setRiwayat] = useState<BarisRiwayat[]>([])

  useEffect(() => {
    setRiwayat(bacaRiwayat())
    try {
      const s = JSON.parse(localStorage.getItem(KUNCI_LS) || 'null')
      if (s) {
        if (s.modal) setModalRaw(String(s.modal))
        if (s.risiko) setRisiko(String(s.risiko))
        if (s.masuk) setMasuk(String(s.masuk))
        if (s.sl) setSl(String(s.sl))
        if (s.langkah) setLangkah(String(s.langkah))
      }
    } catch { /* korup/tidak ada — mulai kosong */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(KUNCI_LS, JSON.stringify({ modal: modalRaw, risiko, masuk, sl, langkah })) } catch { /* abaikan */ }
  }, [modalRaw, risiko, masuk, sl, langkah])

  const modalN = parseFloat(modalRaw) || 0
  const risikoN = parseFloat(risiko) || 0
  const masukN = parseFloat(masuk) || 0
  const slN = parseFloat(sl) || 0
  const langkahN = parseFloat(langkah) || 2

  const hasil = useMemo(
    () => hitungPiramida(modalN, risikoN, masukN, slN, langkahN),
    [modalN, risikoN, masukN, slN, langkahN],
  )

  function simpan() {
    if (!hasil) return
    setRiwayat(simpanRiwayat(
      `Masuk ${fN(masukN)} / SL ${fN(slN)} → ${hasil.lotDasar} lot dasar, 4 lapis`,
    ))
  }

  return (
    <div className="grid2 kalk-piramida">
      <section className="panel">
        <div className="panel-h"><span className="lbl"><IkonMenu d={IKON_KUADRAN} size={13} /> Piramida (Pyramid Entry)</span></div>
        <div className="panel-b" style={{ display: 'grid', gap: 12 }}>
          <div className="field">
            <span className="lbl">Modal (Rp)</span>
            <input className="inp" type="number" inputMode="decimal" min={0} value={modalRaw} onChange={(e) => setModalRaw(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <span className="lbl">Risiko per transaksi (%)</span>
              <input className="inp" type="number" inputMode="decimal" min={0.1} step={0.1} value={risiko} onChange={(e) => setRisiko(e.target.value)} />
            </div>
            <div className="field">
              <span className="lbl">Langkah kenaikan lapis (%)</span>
              <input className="inp" type="number" inputMode="decimal" min={0.1} step={0.5} value={langkah} onChange={(e) => setLangkah(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <span className="lbl">Harga masuk (Rp)</span>
              <input className="inp" type="number" inputMode="decimal" min={0} value={masuk} onChange={(e) => setMasuk(e.target.value)} />
            </div>
            <div className="field">
              <span className="lbl">Stop loss (Rp)</span>
              <input className="inp" type="number" inputMode="decimal" min={0} value={sl} onChange={(e) => setSl(e.target.value)} />
            </div>
          </div>

          <div className="v-note" style={{ display: 'block', lineHeight: 1.6 }}>
            Rumus: risiko (Rp) = modal × risiko% · lot dasar = ⌊risiko ÷ (masuk − SL) ÷ 100⌋.
            Lapis berporsi <b>{PORSI_LAPIS_PIRAMIDA.map((p) => `${p * 100}%`).join(' / ')}</b> dari lot
            dasar — konvensi kalkulator ini, bukan aturan bursa.
          </div>

          {hasil ? (
            <div className="vcard">
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div className="bm"><span className="lbl">Nilai risiko</span><span className="num">Rp {fN(hasil.risikoRupiah, 0)}</span></div>
                <div className="bm"><span className="lbl">Lot dasar</span><span className="num">{fN(hasil.lotDasar, 0)} lot</span></div>
                <div className="bm"><span className="lbl">Lembar dasar</span><span className="num">{fN(hasil.lembarDasar, 0)} lembar</span></div>
              </div>
              <button className="btn-p btn-p-kecil" style={{ marginTop: 10 }} onClick={simpan}>Simpan ke riwayat</button>
            </div>
          ) : (
            <div className="v-note">Isi modal, risiko%, harga masuk, dan stop loss (harus di bawah harga masuk).</div>
          )}

          <p className="muted" style={{ fontSize: 11, lineHeight: 1.7, margin: 0 }}>
            <IkonMenu d={IKON_PERINGATAN} size={12} /> Estimasi perencanaan, bukan saran investasi (Not Financial Advice).
          </p>
        </div>
      </section>

      <div style={{ display: 'grid', gap: 14 }}>
        <section className="panel">
          <div className="panel-h"><span className="lbl">Rencana Lapis</span></div>
          <div className="panel-b" style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Lapis</th>
                  <th className="r">Porsi</th>
                  <th className="r">Lot</th>
                  <th className="r">Harga (tick)</th>
                  <th className="r">Avg kumulatif</th>
                </tr>
              </thead>
              <tbody>
                {hasil ? (
                  hasil.lapis.map((l, i) => (
                    <tr key={i}>
                      <td>Lapis {i + 1}</td>
                      <td className="r num">{PORSI_LAPIS_PIRAMIDA[i] * 100}%</td>
                      <td className="r num">{fN(l.lot, 0)}</td>
                      <td className="r num">{fN(l.harga)}</td>
                      <td className="r num">{fN(l.avgKumulatif)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} style={{ color: 'var(--text3)', textAlign: 'center', padding: 14 }}>Isi masukan di kiri</td></tr>
                )}
              </tbody>
              {hasil && (
                <tfoot>
                  <tr className="t-total">
                    <td><b>Total</b></td>
                    <td className="r num">100%</td>
                    <td className="r num"><b>{fN(hasil.lapis.reduce((s, l) => s + l.lot, 0), 0)}</b></td>
                    <td className="r num">—</td>
                    <td className="r num">{fN(hasil.lapis[hasil.lapis.length - 1]?.avgKumulatif ?? 0)}</td>
                  </tr>
                </tfoot>
              )}
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
      </div>
    </div>
  )
}
