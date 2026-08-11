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
    <div className="adc-wrap">
      {/* Stock Position */}
      <div className="card adc-section">
        <div className="ct b">📋 Posisi Saham</div>

        <div className="adc-field" style={{ marginBottom: 10 }}>
          <label>Kode Saham</label>
          <div className="adc-kode-row">
            <input
              className="adc-input"
              type="text"
              placeholder="Contoh: BBCA"
              maxLength={6}
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
            />
            <button className="adc-fetch-btn" onClick={fetchPrice} disabled={fetching}>
              {fetching ? '⏳' : '🔍 Cari Harga'}
            </button>
          </div>
          <div className="adc-name">{name}</div>
        </div>

        <div className="adc-grid2" style={{ marginBottom: 10 }}>
          <div className="adc-field">
            <label>Avg Cost (Harga Beli Rata-rata)</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={avg} onChange={(e) => setAvg(e.target.value)} />
            <div className="adc-unit">IDR per saham</div>
          </div>
          <div className="adc-field">
            <label>Qty Balance</label>
            <input className="adc-input" type="number" placeholder="0" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
            <div className="adc-unit">Lot (1 lot = 100 saham)</div>
          </div>
        </div>

        <div className="adc-field" style={{ marginBottom: 10 }}>
          <label>Last Price (Harga Sekarang)</label>
          <input className="adc-input" type="number" placeholder="0" min={0} value={last} onChange={(e) => setLast(e.target.value)} />
          <div className="adc-price-row">
            <span className={`adc-badge ${priceSrc.kind}`}>{priceSrc.label}</span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>atau klik 🔍 untuk ambil harga otomatis (delay ~15m)</span>
          </div>
        </div>

        <div className="adc-stat-box">
          <div className="adc-stat-left">
            <span className="adc-stat-label">Nilai Investasi</span>
            <span className="adc-stat-val">{current ? fN(current.curVal, 0) : '—'}</span>
            <span className="adc-unit">IDR</span>
            <div style={{ height: 8 }} />
            <span className="adc-stat-label">Unrealized G/L</span>
            <span className="adc-stat-val" style={{ color: 'var(--text2)' }}>
              {current ? `${fN(current.curGLIdr, 0)} IDR` : '—'}
            </span>
          </div>
          <div>
            <div className={`adc-gl-pct ${current ? cls(current.curGLPct) : 'red'}`}>
              {current ? fp(current.curGLPct) : '—'}
            </div>
            <div className="adc-gl-idr">{current ? fp(current.curGLPct) : '—'}</div>
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="card adc-section">
        <div className="ct b">⚙️ Strategi Average Down</div>
        <div className="adc-modes">
          {MODES.map((m) => (
            <div key={m.id} className={`adc-mode${mode === m.id ? ' selected' : ''}`} onClick={() => setMode(m.id)}>
              <input type="radio" name="adc-mode" checked={mode === m.id} readOnly />
              <div style={{ flex: 1 }}>
                <div className="adc-mode-label">{m.label}</div>
                <div className="adc-mode-desc">{m.desc}</div>
                {m.id === 'half' && mode === 'half' && result?.halfTargetPct !== undefined && current && (
                  <div className="adc-mode-sub">
                    Loss saat ini: {fp(current.curGLPct)} → target: {fp(result.halfTargetPct)}
                  </div>
                )}
              </div>
              {m.id === 'lossmax' && mode === 'lossmax' && (
                <div className="adc-mode-inp" onClick={(e) => e.stopPropagation()}>
                  <input type="number" value={lossmax} min={0.1} max={99} step={0.5} onChange={(e) => setLossmax(e.target.value)} />
                  <span>%</span>
                </div>
              )}
              {m.id === 'endavg' && mode === 'endavg' && (
                <div className="adc-mode-inp" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatRibuan(endavgRaw)}
                    onChange={(e) => setEndavgRaw(onlyDigits(e.target.value))}
                  />
                  <span>IDR</span>
                </div>
              )}
              {m.id === 'avgqty' && mode === 'avgqty' && (
                <div className="adc-mode-inp" onClick={(e) => e.stopPropagation()}>
                  <input type="number" value={avgqty} min={0} step={1} onChange={(e) => setAvgqty(e.target.value)} />
                  <span>Lot</span>
                </div>
              )}
              {m.id === 'avgval' && mode === 'avgval' && (
                <div className="adc-mode-inp" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatRibuan(avgvalRaw)}
                    onChange={(e) => setAvgvalRaw(onlyDigits(e.target.value))}
                  />
                  <span>IDR</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Estimation Result */}
      <div className="card adc-section">
        <div className="ct b">📊 Estimasi Hasil</div>
        <div className="adc-result-grid">
          <div className="adc-result-item highlight">
            <div className="adc-result-label">Buy Again Qty</div>
            <div className="adc-result-val">
              {result ? `${fN(result.buyQty, 0)} Lot` : aboveAvg ? 'Harga sudah di atas avg' : '—'}
            </div>
            <div className="adc-result-sub">
              {result ? `${fN(result.buyValue, 0)} IDR` : aboveAvg ? 'Tidak perlu average down' : '—'}
            </div>
          </div>
          <div className="adc-result-item highlight">
            <div className="adc-result-label">Est. End Average</div>
            <div className="adc-result-val">{result ? `${fN(result.endAvg, 2)} IDR` : '—'}</div>
            <div className="adc-result-sub">IDR per saham</div>
          </div>
          <div className="adc-result-item">
            <div className="adc-result-label">End Qty Balance</div>
            <div className="adc-result-val">{result ? fN(result.endQty, 0) : '—'}</div>
            <div className="adc-result-sub">Lot</div>
          </div>
          <div className="adc-result-item">
            <div className="adc-result-label">End Value (Modal)</div>
            <div className="adc-result-val">{result ? fN(result.endModal, 0) : '—'}</div>
            <div className="adc-result-sub">IDR</div>
          </div>
          <div className="adc-result-item" style={{ gridColumn: '1/-1' }}>
            <div className="adc-result-label">End Current G/L</div>
            <div className={`adc-result-val ${result ? cls(result.endGLPct) : ''}`}>
              {result ? fp(result.endGLPct) : '—'}
            </div>
            <div className="adc-result-sub">{result ? `${fN(result.endGLIdr, 0)} IDR` : '—'}</div>
          </div>
        </div>
        <div className="adc-disclaimer">
          ⚠️ Kalkulasi ini bersifat estimasi untuk perencanaan. Bukan saran investasi (Not Financial Advice).
          <br />
          Harga delay ~15 menit. Dapat berbeda dengan harga bursa.
        </div>
      </div>
    </div>
  )
}
