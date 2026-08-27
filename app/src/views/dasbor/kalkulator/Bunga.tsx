import { useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas, bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { fN } from '../../../lib/dasbor/format'
import { hitungBunga } from '../../../lib/dasbor/kalkulatorLanjut'
import { IkonMenu, IKON_GRAFIK_NAIK, IKON_PERINGATAN } from '../../../components/dasbor/IkonMenu'

const KUNCI_LS = 'kalk_bunga'
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
 * Bunga-Berbunga (Compounding & DCA) — port spek §F.3: modal awal + setoran
 * bulanan majemuk pada imbal tahunan, dibandingkan dengan saldo yang sudah
 * dideflasi inflasi. Grafik pakai `chart.js/auto` — util yang sama dengan
 * panel dasbor lain (`useChartJs.ts`), bukan pustaka baru.
 */
export function Bunga() {
  const [modalRaw, setModalRaw] = useState('10000000')
  const [setoranRaw, setSetoranRaw] = useState('1000000')
  const [imbal, setImbal] = useState('10')
  const [inflasi, setInflasi] = useState('4')
  const [horizon, setHorizon] = useState('10')
  const [riwayat, setRiwayat] = useState<BarisRiwayat[]>([])

  useEffect(() => {
    setRiwayat(bacaRiwayat())
    try {
      const s = JSON.parse(localStorage.getItem(KUNCI_LS) || 'null')
      if (s) {
        if (s.modal) setModalRaw(String(s.modal))
        if (s.setoran) setSetoranRaw(String(s.setoran))
        if (s.imbal) setImbal(String(s.imbal))
        if (s.inflasi) setInflasi(String(s.inflasi))
        if (s.horizon) setHorizon(String(s.horizon))
      }
    } catch { /* korup/tidak ada — mulai kosong */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KUNCI_LS, JSON.stringify({ modal: modalRaw, setoran: setoranRaw, imbal, inflasi, horizon }))
    } catch { /* abaikan */ }
  }, [modalRaw, setoranRaw, imbal, inflasi, horizon])

  const modalN = parseFloat(modalRaw) || 0
  const setoranN = parseFloat(setoranRaw) || 0
  const imbalN = parseFloat(imbal) || 0
  const inflasiN = parseFloat(inflasi) || 0
  const horizonN = Math.max(1, Math.min(50, Math.round(parseFloat(horizon) || 0)))

  const hasil = useMemo(
    () => hitungBunga(modalN, setoranN, imbalN, inflasiN, horizonN),
    [modalN, setoranN, imbalN, inflasiN, horizonN],
  )

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!hasil || hasil.rows.length < 2) return null
    const textColor = bacaTokenTema('--text2')
    return {
      type: 'line',
      data: {
        labels: hasil.rows.map((r) => `Th ${r.tahun}`),
        datasets: [
          { label: 'Saldo nominal', data: hasil.rows.map((r) => r.saldoNominal), borderColor: '#5B94E8', borderWidth: 2.2, pointRadius: 0 },
          { label: 'Saldo riil (terdeflasi)', data: hasil.rows.map((r) => r.saldoRiil), borderColor: '#38B77E', borderWidth: 2, pointRadius: 0 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: textColor, maxTicksLimit: 10 }, grid: { display: false } },
          y: { ticks: { color: textColor, callback: (v) => fN(Number(v), 0) }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [hasil])
  const canvasRef = useChartCanvas(config)

  function simpan() {
    if (!hasil) return
    const akhir = hasil.rows[hasil.rows.length - 1]
    setRiwayat(simpanRiwayat(
      `${horizonN} thn @ ${imbalN}%/${inflasiN}% → nominal Rp ${fN(akhir.saldoNominal, 0)} · riil Rp ${fN(akhir.saldoRiil, 0)}`,
    ))
  }

  return (
    <div className="grid2 kalk-bunga">
      <section className="panel">
        <div className="panel-h"><span className="lbl"><IkonMenu d={IKON_GRAFIK_NAIK} size={13} /> Bunga-Berbunga (Compounding &amp; DCA)</span></div>
        <div className="panel-b" style={{ display: 'grid', gap: 12 }}>
          <div className="field">
            <span className="lbl">Modal awal (Rp)</span>
            <input className="inp" type="number" min={0} value={modalRaw} onChange={(e) => setModalRaw(e.target.value)} />
          </div>
          <div className="field">
            <span className="lbl">Setoran bulanan (Rp)</span>
            <input className="inp" type="number" min={0} value={setoranRaw} onChange={(e) => setSetoranRaw(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <span className="lbl">Imbal tahunan (%)</span>
              <input className="inp" type="number" step={0.1} value={imbal} onChange={(e) => setImbal(e.target.value)} />
            </div>
            <div className="field">
              <span className="lbl">Inflasi tahunan (%)</span>
              <input className="inp" type="number" step={0.1} value={inflasi} onChange={(e) => setInflasi(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <span className="lbl">Horizon (tahun)</span>
            <input className="inp" type="number" min={1} max={50} step={1} value={horizon} onChange={(e) => setHorizon(e.target.value)} />
          </div>

          <div className="v-note" style={{ display: 'block', lineHeight: 1.6 }}>
            Imbal riil tahunan = <b>(1+r)/(1+i) − 1</b>{hasil ? ` = ${(hasil.imbalRiilTahunan * 100).toFixed(2)}%` : ''}.
            Setoran bulanan majemuk pada rate bulanan yang balik ke imbal tahunan persis setelah 12 bulan.
          </div>

          {hasil && (
            <button className="btn-p btn-p-kecil" onClick={simpan} style={{ alignSelf: 'flex-start' }}>Simpan ke riwayat</button>
          )}

          <p className="muted" style={{ fontSize: 11, lineHeight: 1.7, margin: 0 }}>
            <IkonMenu d={IKON_PERINGATAN} size={12} /> Estimasi perencanaan dengan imbal & inflasi TETAP tiap tahun. Bukan saran investasi (Not Financial Advice).
          </p>
        </div>
      </section>

      <div style={{ display: 'grid', gap: 14 }}>
        <section className="panel">
          <div className="panel-h"><span className="lbl">Grafik</span></div>
          <div className="panel-b"><div className="chart-wrap" style={{ height: 260 }}><canvas ref={canvasRef} /></div></div>
        </section>

        <section className="panel">
          <div className="panel-h"><span className="lbl">Tabel Tahunan</span></div>
          <div className="panel-b" style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Tahun</th><th className="r">Saldo nominal</th><th className="r">Saldo riil</th></tr></thead>
              <tbody>
                {hasil?.rows.map((r) => (
                  <tr key={r.tahun}>
                    <td>{r.tahun}</td>
                    <td className="r num">Rp {fN(r.saldoNominal, 0)}</td>
                    <td className="r num">Rp {fN(r.saldoRiil, 0)}</td>
                  </tr>
                ))}
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
      </div>
    </div>
  )
}
