import { useEffect, useMemo, useState } from 'react'
import { fN, fp, cls } from '../../../lib/dasbor/format'
import { onlyDigits, formatRibuan, parseRibuan } from '../../../lib/dasbor/kalkulatorFormat'

type AdcMode = 'half' | 'lossmax' | 'endavg' | 'avgqty' | 'avgval'

const MODES: { id: AdcMode; label: string; desc: string }[] = [
  { id: 'half', label: 'Half Loss', desc: 'Kurangi kerugian menjadi setengahnya' },
  { id: 'lossmax', label: 'Loss Max', desc: 'Batasi kerugian maksimal' },
  { id: 'endavg', label: 'End Average', desc: 'Target harga rata-rata akhir yang diinginkan' },
  { id: 'avgqty', label: 'Average Down Qty', desc: 'Beli sejumlah lot tertentu' },
  { id: 'avgval', label: 'Average Down Value', desc: 'Investasikan sejumlah dana' },
]

interface AdcResult {
  buyQty: number
  buyValue: number
  endAvg: number
  endQty: number
  endModal: number
  endGLPct: number
  endGLIdr: number
  halfTargetPct?: number
}

/** Port ADC.calc() switch(mode) (index_live.html baris 3666-3717) — presisi 1:1. */
function computeAdc(
  avg: number,
  qty: number,
  last: number,
  mode: AdcMode,
  lossmax: number,
  endavgTarget: number,
  avgqty: number,
  avgval: number,
): AdcResult {
  let buyQty = 0
  let endAvg = avg
  let halfTargetPct: number | undefined

  switch (mode) {
    case 'half': {
      const curGLPct = ((last - avg) / avg) * 100
      const targetPct = curGLPct / 2
      endAvg = last / (1 + targetPct / 100)
      buyQty = (qty * (avg - endAvg)) / (endAvg - last)
      halfTargetPct = targetPct
      break
    }
    case 'lossmax': {
      const lMax = lossmax || 5
      endAvg = last / (1 - lMax / 100)
      if (endAvg < avg) buyQty = (qty * (avg - endAvg)) / (endAvg - last)
      break
    }
    case 'endavg': {
      endAvg = endavgTarget || avg
      if (endAvg > last && endAvg < avg) buyQty = (qty * (avg - endAvg)) / (endAvg - last)
      break
    }
    case 'avgqty': {
      buyQty = avgqty || 0
      endAvg = (qty * avg + buyQty * last) / (qty + buyQty)
      break
    }
    case 'avgval': {
      buyQty = Math.floor((avgval || 0) / (last * 100))
      endAvg = buyQty > 0 ? (qty * avg + buyQty * last) / (qty + buyQty) : avg
      break
    }
  }

  buyQty = Math.max(0, Math.round(buyQty))
  const buyValue = buyQty * 100 * last
  const endQty = qty + buyQty
  const endModal = qty * 100 * avg + buyQty * 100 * last
  const endGLPct = ((last - endAvg) / endAvg) * 100
  const endGLIdr = endQty * 100 * (last - endAvg)

  return { buyQty, buyValue, endAvg, endQty, endModal, endGLPct, endGLIdr, halfTargetPct }
}

/** Port panel "Average Down" — markup index_live.html baris 1142-1305, objek
 *  ADC baris 3583-3753 (fetchPrice/calc/save/load) + fmtModeInp/parseModeInp
 *  baris 3564-3581. */
export function AvgDown() {
  const [kode, setKode] = useState('')
  const [avg, setAvg] = useState('')
  const [qty, setQty] = useState('')
  const [last, setLast] = useState('')
  const [mode, setMode] = useState<AdcMode>('half')
  const [lossmax, setLossmax] = useState('5')
  const [endavgRaw, setEndavgRaw] = useState('0')
  const [avgqty, setAvgqty] = useState('0')
  const [avgvalRaw, setAvgvalRaw] = useState('0')

  const [name, setName] = useState('—')
  const [priceSrc, setPriceSrc] = useState<{ label: string; kind: 'manual' | 'auto' }>({
    label: 'Input Manual',
    kind: 'manual',
  })
  const [fetching, setFetching] = useState(false)

  // Load posisi tersimpan sekali saat mount — port ADC.load().
  useEffect(() => {
    try {
      const raw = localStorage.getItem('adc')
      if (!raw) return
      const s = JSON.parse(raw)
      if (s.kode) setKode(s.kode)
      if (s.avg) setAvg(String(s.avg))
      if (s.qty) setQty(String(s.qty))
      if (s.last) setLast(String(s.last))
      if (s.mode) setMode(s.mode)
      if (s.lossmax) setLossmax(String(s.lossmax))
      if (s.endavg) setEndavgRaw(String(s.endavg))
      if (s.avgqty) setAvgqty(String(s.avgqty))
      if (s.avgval) setAvgvalRaw(String(s.avgval))
    } catch {
      /* localStorage tidak tersedia / data korup — abaikan, mulai kosong */
    }
  }, [])

  // Simpan tiap perubahan — port ADC.save().
  useEffect(() => {
    try {
      localStorage.setItem(
        'adc',
        JSON.stringify({
          kode, avg, qty, last, mode, lossmax,
          endavg: parseRibuan(endavgRaw),
          avgqty,
          avgval: parseRibuan(avgvalRaw),
        }),
      )
    } catch {
      /* quota penuh / privat mode — abaikan */
    }
  }, [kode, avg, qty, last, mode, lossmax, endavgRaw, avgqty, avgvalRaw])

  async function fetchPrice() {
    const kodeTrim = kode.trim().toUpperCase()
    if (!kodeTrim) {
      alert('Masukkan kode saham terlebih dahulu')
      return
    }
    setFetching(true)
    setPriceSrc({ label: 'Mengambil data...', kind: 'manual' })
    try {
      const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${kodeTrim}.JK?interval=1d&range=1d`
      const proxy = `https://corsproxy.io/?url=${encodeURIComponent(yUrl)}`
      const r = await fetch(proxy, { signal: AbortSignal.timeout(10000) })
      const j = await r.json()
      const res = j?.chart?.result?.[0]
      const price = res?.meta?.regularMarketPrice
      const priceName: string = res?.meta?.longName || res?.meta?.shortName || kodeTrim
      if (price && price > 0) {
        setLast(String(price))
        setName(priceName)
        setPriceSrc({ label: 'Auto • harga delay ~15m', kind: 'auto' })
      } else {
        throw new Error('no price')
      }
    } catch {
      setPriceSrc({ label: 'Gagal — isi harga manual', kind: 'manual' })
      setName('Tidak dapat mengambil data otomatis')
    } finally {
      setFetching(false)
    }
  }

  const avgN = parseFloat(avg) || 0
  const qtyN = parseFloat(qty) || 0
  const lastN = parseFloat(last) || 0
  const lossmaxN = parseFloat(lossmax) || 0
  const avgqtyN = parseFloat(avgqty) || 0
  const endavgN = parseRibuan(endavgRaw)
  const avgvalN = parseRibuan(avgvalRaw)

  const current = avgN > 0 && qtyN > 0 && lastN > 0
    ? {
        curVal: qtyN * 100 * avgN,
        curGLIdr: qtyN * 100 * (lastN - avgN),
        curGLPct: ((lastN - avgN) / avgN) * 100,
      }
    : null

  // "Harga sudah di atas avg" tidak mensyaratkan qty>0 di sumber asli (baris 3652) — port apa adanya.
  const aboveAvg = avgN > 0 && lastN > 0 && lastN >= avgN
  const canCompute = !!current && lastN < avgN

  const result = useMemo(() => {
    if (!canCompute) return null
    return computeAdc(avgN, qtyN, lastN, mode, lossmaxN, endavgN, avgqtyN, avgvalN)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCompute, avgN, qtyN, lastN, mode, lossmaxN, endavgN, avgqtyN, avgvalN])

  return (
    <div className="grid2 w-kiri">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Stock Position */}
        <div className="panel">
          <div className="panel-h"><span className="lbl">📋 Posisi Saham</span></div>
          <div className="panel-b">
            <div className="field" style={{ marginBottom: 10 }}>
              <span className="lbl">Kode Saham</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="inp"
                  style={{ flex: 1, minWidth: 0 }}
                  type="text"
                  placeholder="Contoh: BBCA"
                  maxLength={6}
                  value={kode}
                  onChange={(e) => setKode(e.target.value.toUpperCase())}
                />
                <button className="btn-p" style={{ whiteSpace: 'nowrap' }} onClick={fetchPrice} disabled={fetching}>
                  {fetching ? '⏳' : '🔍 Cari Harga'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{name}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
              <div className="field">
                <span className="lbl">Avg Cost (Harga Beli Rata-rata)</span>
                <input className="inp" type="number" placeholder="0" min={0} value={avg} onChange={(e) => setAvg(e.target.value)} />
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>IDR per saham</div>
              </div>
              <div className="field">
                <span className="lbl">Qty Balance</span>
                <input className="inp" type="number" placeholder="0" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>Lot (1 lot = 100 saham)</div>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 10 }}>
              <span className="lbl">Last Price (Harga Sekarang)</span>
              <input className="inp" type="number" placeholder="0" min={0} value={last} onChange={(e) => setLast(e.target.value)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                <span className={`chip ${priceSrc.kind === 'auto' ? 'up' : 'warn'}`}>{priceSrc.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>atau klik 🔍 untuk ambil harga otomatis (delay ~15m)</span>
              </div>
            </div>

            <div className="vcard">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <span className="lbl">Nilai Investasi</span>
                  <div className="num" style={{ fontSize: 17, fontWeight: 600 }}>{current ? fN(current.curVal, 0) : '—'}</div>
                  <div className="v-note">
                    IDR &middot; G/L {current ? `${fN(current.curGLIdr, 0)} IDR` : '—'}
                  </div>
                </div>
                <div className={`num ${current ? cls(current.curGLPct) : ''}`} style={{ fontSize: 20, fontWeight: 600 }}>
                  {current ? fp(current.curGLPct) : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="panel">
          <div className="panel-h"><span className="lbl">⚙️ Strategi Average Down</span></div>
          <div className="panel-b">
            <div className="tabs" role="radiogroup" aria-label="Strategi Average Down" style={{ flexDirection: 'column', width: '100%' }}>
              {MODES.map((m) => (
                <label
                  key={m.id}
                  className={'tab' + (mode === m.id ? ' on' : '')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                >
                  <input type="radio" name="adc-mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
                  {m.label}
                </label>
              ))}
            </div>

            <div className="vcard" style={{ marginTop: 10 }}>
              <div className="v-note">{MODES.find((m) => m.id === mode)?.desc}</div>
              {mode === 'half' && result?.halfTargetPct !== undefined && current && (
                <div className="v-note">
                  Loss saat ini: {fp(current.curGLPct)} → target: {fp(result.halfTargetPct)}
                </div>
              )}
              {mode === 'lossmax' && (
                <div className="field" style={{ maxWidth: 160 }}>
                  <span className="lbl">Loss Max</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input className="inp" type="number" value={lossmax} min={0.1} max={99} step={0.5} onChange={(e) => setLossmax(e.target.value)} />
                    <span className="num">%</span>
                  </div>
                </div>
              )}
              {mode === 'endavg' && (
                <div className="field" style={{ maxWidth: 200 }}>
                  <span className="lbl">Target End Average</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      className="inp"
                      type="text"
                      inputMode="numeric"
                      value={formatRibuan(endavgRaw)}
                      onChange={(e) => setEndavgRaw(onlyDigits(e.target.value))}
                    />
                    <span className="num">IDR</span>
                  </div>
                </div>
              )}
              {mode === 'avgqty' && (
                <div className="field" style={{ maxWidth: 160 }}>
                  <span className="lbl">Jumlah Lot</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input className="inp" type="number" value={avgqty} min={0} step={1} onChange={(e) => setAvgqty(e.target.value)} />
                    <span className="num">Lot</span>
                  </div>
                </div>
              )}
              {mode === 'avgval' && (
                <div className="field" style={{ maxWidth: 200 }}>
                  <span className="lbl">Dana Tambahan</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      className="inp"
                      type="text"
                      inputMode="numeric"
                      value={formatRibuan(avgvalRaw)}
                      onChange={(e) => setAvgvalRaw(onlyDigits(e.target.value))}
                    />
                    <span className="num">IDR</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Estimation Result — menempel, terlihat langsung saat isian kiri berubah */}
      <div style={{ position: 'sticky', top: 60, alignSelf: 'start' }}>
        <div className="panel">
          <div className="panel-h"><span className="lbl">📊 Estimasi Hasil</span></div>
          <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span className="lbl">Est. End Average</span>
              <div className="num" style={{ fontSize: 28, fontWeight: 600, color: 'var(--amber)' }}>
                {result ? `${fN(result.endAvg, 2)} IDR` : '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div className="bm">
                <span className="lbl">Buy Again Qty</span>
                <span className="num">
                  {result ? `${fN(result.buyQty, 0)} Lot` : aboveAvg ? 'Sudah di atas avg' : '—'}
                </span>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                  {result ? `${fN(result.buyValue, 0)} IDR` : aboveAvg ? 'Tidak perlu average down' : '—'}
                </div>
              </div>
              <div className="bm">
                <span className="lbl">End Qty Balance</span>
                <span className="num">{result ? `${fN(result.endQty, 0)} Lot` : '—'}</span>
              </div>
              <div className="bm">
                <span className="lbl">End Value (Modal)</span>
                <span className="num">{result ? `${fN(result.endModal, 0)} IDR` : '—'}</span>
              </div>
            </div>
            <div>
              <span className="lbl">End Current G/L</span>
              <div className={`num ${result ? cls(result.endGLPct) : ''}`} style={{ fontSize: 18, fontWeight: 600 }}>
                {result ? fp(result.endGLPct) : '—'}
              </div>
              <div className="v-note">{result ? `${fN(result.endGLIdr, 0)} IDR` : '—'}</div>
            </div>
            <div className="v-note">
              ⚠️ Kalkulasi ini bersifat estimasi untuk perencanaan. Bukan saran investasi (Not Financial Advice).
              <br />
              Harga delay ~15 menit. Dapat berbeda dengan harga bursa.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
