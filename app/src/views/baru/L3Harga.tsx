import { Fragment, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Blok, Hero, Ringkas, Rentang, Keadaan } from './ui'
import { useJson, angka, bertanda, arah, tanggalPendek } from './data'
import { EMITEN_BAWAAN } from './peta'
import { PilihEmiten } from './l3-pilih'
import { KakiBaru } from './KakiBaru'

interface SR { harga: number; sentuhan: number; terakhir: string }
interface Target { harga: number; pct: number; fp: { p_kena: number; p_stop: number; median_hari: number } }
interface PeriodeAsing { net: number }
interface Kartu {
  tgl: string
  harga: number
  prev: number
  chg: number
  ma20: number
  ma50: number
  ma200: number
  atr_pct: number
  rsi: number
  support: SR[]
  resistance: SR[]
  stop: number
  target: Target[]
  er: number
  er_persentil: number
  er_n_populasi: number
  posisi_bb: number
  ichimoku: { di_atas_kumo: boolean }
  porsi_asing: number
  label_accdist: string
  asing?: { periode?: Record<string, PeriodeAsing> }
  sektor: { nama: string; sektor: string; subsektor: string }
  fundamental?: { week52_high?: number; week52_low?: number }
}
interface Ohlcv { kolom: string[]; bar: (string | number)[][] }

/** EMA sederhana, alpha=2/(n+1), disemai dari nilai pertama — cukup akurat
 *  karena kita punya ribuan bar sejarah dan hanya menampilkan 40 terakhir. */
/** "2026-09-22" → "22 Sep" (tanpa tahun, buat label sumbu/tabel yang ringkas). */
function tglSingkat(iso: string): string {
  return tanggalPendek(iso).replace(/ \d{4}$/, '')
}

function ema(vals: number[], n: number): number[] {
  const k = 2 / (n + 1)
  const out: number[] = new Array(vals.length)
  for (let i = 0; i < vals.length; i++) out[i] = i === 0 ? vals[0] : vals[i] * k + out[i - 1] * (1 - k)
  return out
}

const W = 640
const HP = 220
const HV = 66

/** `kodeTetap` + `sisip`: dipakai StockDetail di tampilan Baru (#228) — kode
 *  datang dari halaman induk, tanpa pemilih emiten dan kaki sendiri. */
export default function L3Harga({ kodeTetap, sisip = false }: { kodeTetap?: string; sisip?: boolean } = {}) {
  const { kode: kodeParam } = useParams()
  const kode = (kodeTetap ?? kodeParam ?? EMITEN_BAWAAN).toUpperCase()
  const { data: kartu, galat: gk } = useJson<Kartu>(`/data-idx/json/kartu/${kode}.json`)
  const { data: ohlcv, galat: go } = useJson<Ohlcv>(`/data-idx/json/ohlcv_stockbit/${kode}.json`)

  const olah = useMemo(() => {
    if (!ohlcv || ohlcv.bar.length === 0) return null
    const iO = ohlcv.kolom.indexOf('open')
    const iH = ohlcv.kolom.indexOf('high')
    const iL = ohlcv.kolom.indexOf('low')
    const iC = ohlcv.kolom.indexOf('close')
    const iV = ohlcv.kolom.indexOf('volume')
    const closes = ohlcv.bar.map((b) => Number(b[iC]))
    const ema20 = ema(closes, 20)
    const ema50 = ema(closes, 50)
    const n = Math.min(40, ohlcv.bar.length)
    const vis = ohlcv.bar.slice(-n)
    const visEma20 = ema20.slice(-n)
    const visEma50 = ema50.slice(-n)
    const w = ohlcv.bar.slice(-252)
    const hi52 = Math.max(...w.map((b) => Number(b[iH])))
    const lo52 = Math.min(...w.map((b) => Number(b[iL])))
    return { iO, iH, iL, iC, iV, vis, visEma20, visEma50, hi52, lo52, cukup52: w.length >= 200 }
  }, [ohlcv])

  const pilih = sisip ? null : <PilihEmiten slug="harga" />
  const galat = gk ?? go
  if (galat) return <div className="bb-isi">{pilih}<Keadaan galat={galat} />{!sisip && <KakiBaru sumber="Data bursa." />}</div>
  if (!kartu || !ohlcv || !olah) return <div className="bb-isi">{pilih}<Keadaan /></div>

  const { iO, iH, iL, iC, iV, vis, visEma20, visEma50, hi52, lo52, cukup52 } = olah
  const hi = cukup52 ? hi52 : (kartu.fundamental?.week52_high ?? hi52)
  const lo = cukup52 ? lo52 : (kartu.fundamental?.week52_low ?? lo52)
  const posisi52 = hi > lo ? ((kartu.harga - lo) / (hi - lo)) * 100 : 50
  const vsMa20 = ((kartu.harga - kartu.ma20) / kartu.ma20) * 100
  const vsMa50 = ((kartu.harga - kartu.ma50) / kartu.ma50) * 100
  const vsMa200 = ((kartu.harga - kartu.ma200) / kartu.ma200) * 100
  const diffHarga = kartu.harga - kartu.prev
  const jarakStop = ((kartu.stop - kartu.harga) / kartu.harga) * 100

  // Geometri lilin + EMA + volume — skala relatif viewBox (bb-grafik: lebar 100%).
  const resAcu = [kartu.stop, kartu.resistance[0]?.harga, kartu.resistance[1]?.harga, kartu.ma200].filter(
    (v): v is number => typeof v === 'number',
  )
  const highs = vis.map((b) => Number(b[iH]))
  const lows = vis.map((b) => Number(b[iL]))
  const yTop = Math.max(...highs, ...resAcu)
  const yBot = Math.min(...lows, ...resAcu)
  const pad = (yTop - yBot) * 0.06 || 1
  const domTop = yTop + pad
  const domBot = yBot - pad
  const yFor = (v: number) => HP - ((v - domBot) / (domTop - domBot)) * HP
  const slot = W / vis.length
  const bw = Math.min(slot * 0.62, 9)
  const candles = vis.map((b, i) => {
    const o = Number(b[iO])
    const h = Number(b[iH])
    const l = Number(b[iL])
    const c = Number(b[iC])
    const x = i * slot + slot / 2
    const naik = c >= o
    const yo = yFor(o)
    const yc = yFor(c)
    return { x, yh: yFor(h), yl: yFor(l), yTop: Math.min(yo, yc), tinggi: Math.max(1, Math.abs(yo - yc)), naik }
  })
  const ptsEma20 = visEma20.map((v, i) => `${(i * slot + slot / 2).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ')
  const ptsEma50 = visEma50.map((v, i) => `${(i * slot + slot / 2).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ')
  const vols = vis.map((b) => Number(b[iV]))
  const maxVol = Math.max(...vols, 1)
  const refLevels: { v: number; label: string; warna: string }[] = [
    { v: kartu.stop, label: `Stop ${angka(kartu.stop, 0)}`, warna: 'var(--bb-turun)' },
    ...(kartu.resistance[0] ? [{ v: kartu.resistance[0].harga, label: `R ${angka(kartu.resistance[0].harga, 0)}`, warna: 'var(--bb-biru)' }] : []),
    ...(kartu.resistance[1] ? [{ v: kartu.resistance[1].harga, label: `R ${angka(kartu.resistance[1].harga, 0)}`, warna: 'var(--bb-biru)' }] : []),
    { v: kartu.ma200, label: `MA200 ${angka(kartu.ma200, 0)}`, warna: 'var(--bb-redup)' },
  ]

  const puncakIdx = highs.indexOf(Math.max(...highs))
  const puncak = highs[puncakIdx]
  const puncakTgl = String(vis[puncakIdx][0])
  const pctDariPuncak = ((kartu.harga - puncak) / puncak) * 100
  const judulLilin = kartu.resistance[0] && kartu.harga < kartu.resistance[0].harga
    ? `${vis.length} hari lilin terakhir, tertahan di bawah resistance`
    : `${vis.length} hari lilin terakhir, di atas resistance terdekat`

  const chips: { teks: string; tone: 'naik' | 'turun' | null }[] = [
    { teks: kartu.label_accdist === 'Dist' ? 'Distribusi (broker)' : 'Akumulasi (broker)', tone: kartu.label_accdist === 'Dist' ? 'turun' : 'naik' },
    { teks: `Bollinger ${bertanda(kartu.posisi_bb, 2)}`, tone: null },
    { teks: kartu.ichimoku.di_atas_kumo ? 'Di atas awan Ichimoku' : 'Di bawah awan Ichimoku', tone: kartu.ichimoku.di_atas_kumo ? 'naik' : 'turun' },
    { teks: `Porsi asing ${angka(kartu.porsi_asing * 100, 0)}% dari volume`, tone: null },
  ]
  const asing5 = kartu.asing?.periode?.['5']
  if (asing5) {
    chips.push({
      teks: `Asing ${asing5.net < 0 ? 'jual' : 'beli'} 5 hari ${angka(Math.abs(asing5.net) / 1e6, 1)} juta lbr`,
      tone: asing5.net < 0 ? 'turun' : 'naik',
    })
  }
  const arahChip = chips.filter((c) => c.tone).map((c) => c.tone as 'naik' | 'turun')
  const nTurun = arahChip.filter((t) => t === 'turun').length
  const nNaik = arahChip.length - nTurun
  const dominan = nTurun >= nNaik ? 'turun' : 'naik'
  const jmlDominan = Math.max(nTurun, nNaik)

  return (
    <div className="bb-isi">
      {pilih}
      <div className="bb-dua">
        <div className="bb-kolom">
          <Hero
            label={`${kode} · ${kartu.sektor.sektor} · ${kartu.sektor.subsektor}`}
            angka={angka(kartu.harga, 0)}
            nada={arah(kartu.chg)}
            sub={<>
              <span>{diffHarga < 0 ? '−' : diffHarga > 0 ? '+' : ''}Rp {angka(Math.abs(diffHarga), 0)}</span>
              <span>{bertanda(kartu.chg, 2)}%</span>
            </>}
          />
          <p className="bb-narasi" style={{ marginTop: -8 }}>
            sebelumnya {angka(kartu.prev, 0)} · {arah(kartu.chg) === 'turun' ? 'turun' : arah(kartu.chg) === 'naik' ? 'naik' : 'tak berubah'} hari ini
          </p>

          <Blok label="Rentang 52 minggu" narasi={
            `Harga kini ${angka(posisi52, 0)}% dari dasar rentang setahun. ${cukup52 ? 'Dihitung dari data bursa.' : 'Cadangan, bukan sumber utama harian.'}`
          }>
            <Rentang kiri={`terendah ${angka(lo, 0)}`} kanan={`tertinggi ${angka(hi, 0)}`} posisi={posisi52} nada={arah(kartu.chg)} />
          </Blok>

          <Blok label="Indikator momentum" narasi={`vs MA200 (${angka(kartu.ma200, 0)}) ${bertanda(vsMa200, 1)}% — tren ${vsMa200 < 0 ? 'turun' : 'naik'} jangka menengah.`}>
            <Ringkas items={[
              { label: 'RSI 14', nilai: angka(kartu.rsi, 1), sub: kartu.rsi < 30 ? 'jenuh jual' : kartu.rsi > 70 ? 'jenuh beli' : 'netral' },
              { label: 'ATR (rentang harian)', nilai: `${angka(kartu.atr_pct, 2)}%`, sub: 'rata-rata gerak/hari' },
              { label: `vs MA20 (${angka(kartu.ma20, 0)})`, nilai: `${bertanda(vsMa20, 1)}%`, nada: arah(vsMa20), sub: vsMa20 < 0 ? 'di bawah' : 'di atas' },
              { label: `vs MA50 (${angka(kartu.ma50, 0)})`, nilai: `${bertanda(vsMa50, 1)}%`, nada: arah(vsMa50), sub: vsMa50 < 0 ? 'di bawah' : 'di atas' },
            ]} />
          </Blok>

          <Blok
            label="Support & resistance · sentuhan · terakhir"
            narasi={kartu.resistance[0]
              ? `Resistance ${angka(kartu.resistance[0].harga, 0)} tersentuh ${kartu.resistance[0].sentuhan}×; stop di support ${angka(kartu.stop, 0)}, ${angka(Math.abs(jarakStop), 1)}% dari harga.`
              : `Stop di support ${angka(kartu.stop, 0)}, ${angka(Math.abs(jarakStop), 1)}% dari harga.`}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 28px 66px', columnGap: 10, rowGap: 6, fontSize: 13, alignItems: 'baseline' }}>
              {[...kartu.resistance].reverse().map((r) => (
                <Fragment key={`r${r.harga}`}>
                  <span className="turun">R {angka(r.harga, 0)}</span>
                  <span className="bb-mono" style={{ textAlign: 'right', color: 'var(--bb-redup)' }}>{r.sentuhan}×</span>
                  <span className="bb-mono teks-11" style={{ textAlign: 'right', color: 'var(--bb-redup)' }}>{tglSingkat(r.terakhir)}</span>
                </Fragment>
              ))}
              <span style={{ fontWeight: 600 }}>Harga {angka(kartu.harga, 0)}</span><span /><span />
              {kartu.support.map((s) => (
                <Fragment key={`s${s.harga}`}>
                  <span className="naik">S {angka(s.harga, 0)}{s.harga === kartu.stop ? ' · stop' : ''}</span>
                  <span className="bb-mono" style={{ textAlign: 'right', color: 'var(--bb-redup)' }}>{s.sentuhan}×</span>
                  <span className="bb-mono teks-11" style={{ textAlign: 'right', color: 'var(--bb-redup)' }}>{tglSingkat(s.terakhir)}</span>
                </Fragment>
              ))}
            </div>
          </Blok>
        </div>

        <div className="bb-kolom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <span className="bb-judul" style={{ fontWeight: 300, fontSize: 22 }}>{judulLilin}</span>
            <span className="bb-catatan">putih EMA20 · biru EMA50 · putus = level kunci</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(160px,240px)', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <svg viewBox={`0 0 ${W} ${HP}`} className="bb-grafik">
                {refLevels.map((r) => (
                  <g key={r.label}>
                    <line x1={0} x2={W} y1={yFor(r.v)} y2={yFor(r.v)} stroke={r.warna} strokeDasharray="4 3" strokeWidth={1} />
                    <text x={W - 2} y={yFor(r.v) - 4} textAnchor="end" fontFamily="var(--bb-mono)" fontSize={10} fill={r.warna}>{r.label}</text>
                  </g>
                ))}
                {candles.map((c, i) => (
                  <g key={i}>
                    <line x1={c.x} x2={c.x} y1={c.yh} y2={c.yl} stroke={c.naik ? 'var(--bb-naik)' : 'var(--bb-turun)'} strokeWidth={1} />
                    <rect x={c.x - bw / 2} y={c.yTop} width={bw} height={c.tinggi} rx={1} fill={c.naik ? 'var(--bb-naik)' : 'var(--bb-turun)'} />
                  </g>
                ))}
                <polyline points={ptsEma20} fill="none" stroke="var(--bb-teks)" strokeWidth={1.3} />
                <polyline points={ptsEma50} fill="none" stroke="var(--bb-biru)" strokeWidth={1.3} />
              </svg>
              <svg viewBox={`0 0 ${W} ${HV}`} className="bb-grafik">
                {vols.map((v, i) => (
                  <rect key={i} x={i * slot + slot / 2 - bw / 2} y={HV - (v / maxVol) * HV} width={bw} height={Math.max(1, (v / maxVol) * HV)} rx={1} fill="var(--bb-biru)" />
                ))}
              </svg>
              <div className="teks-11" style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--bb-mono)', color: 'var(--bb-redup)' }}>
                <span>{tglSingkat(String(vis[0][0]))}</span><span>volume {vis.length} hari, biru</span><span>{tglSingkat(String(vis[vis.length - 1][0]))}</span>
              </div>
              <p className="bb-narasi">
                Sejak puncak {tglSingkat(puncakTgl)} ({angka(puncak, 0)}) harga {bertanda(pctDariPuncak, 1)}%
                {kartu.resistance[0] ? `, ${kartu.resistance[0].sentuhan}× menguji resistance ${angka(kartu.resistance[0].harga, 0)} tanpa tembus.` : '.'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
              <span className="bb-label">Peluang kena target</span>
              {kartu.target.map((t) => (
                <div key={t.harga} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
                    <span className="bb-mono" style={{ fontWeight: 600 }}>{angka(t.harga, 0)}</span>
                    <span className="bb-mono naik">{bertanda(t.pct, 1)}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--bb-garis)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, t.fp.p_kena))}%`, height: 8, background: 'var(--bb-biru)' }} />
                  </div>
                  <span className="bb-mono teks-11" style={{ color: 'var(--bb-redup)' }}>
                    {angka(t.fp.p_kena, 1)}% kena · {angka(t.fp.p_stop, 1)}% stop dulu · median {angka(t.fp.median_hari, 0)} hari
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 10, borderTop: '1px solid var(--bb-garis)' }}>
                <span className="bb-label" style={{ textTransform: 'none', letterSpacing: 0 }}>Skor ekspektansi (ER)</span>
                <span style={{ fontFamily: 'var(--bb-sans)', fontSize: 28, fontWeight: 700 }}>{angka(kartu.er, 2)}</span>
                <span className="teks-11" style={{ color: 'var(--bb-redup)' }}>persentil {Math.round(kartu.er_persentil)} dari {kartu.er_n_populasi} emiten</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 10, borderTop: '1px solid var(--bb-garis)' }}>
                <span className="bb-label" style={{ textTransform: 'none', letterSpacing: 0 }}>Jarak ke stop</span>
                <span className={`bb-mono ${arah(jarakStop)}`} style={{ fontSize: 28, fontWeight: 700 }}>{bertanda(jarakStop, 1)}%</span>
                <span className="teks-11" style={{ color: 'var(--bb-redup)' }}>{angka(kartu.stop, 0)}</span>
              </div>
            </div>
          </div>

          <Blok label="Sinyal cepat" narasi={arahChip.length > 0 ? `${jmlDominan} dari ${arahChip.length} sinyal terarah searah ${dominan}.` : undefined}>
            <div className="bb-pils">
              {chips.map((c) => (
                <span
                  key={c.teks}
                  className={`bb-lencana ${c.tone ?? ''}`}
                  style={c.tone ? { color: c.tone === 'turun' ? 'var(--bb-turun)' : 'var(--bb-naik)' } : undefined}
                >
                  {c.teks}
                </span>
              ))}
            </div>
          </Blok>
        </div>
      </div>
      {!sisip && <KakiBaru sumber={`Harga tersesuaikan aksi korporasi, data bursa. ${vis.length} lilin terakhir sejak ${tglSingkat(String(vis[0][0]))}.`} />}
    </div>
  )
}
