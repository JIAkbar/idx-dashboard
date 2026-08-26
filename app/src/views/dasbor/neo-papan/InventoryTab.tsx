import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries, CrosshairMode, HistogramSeries, LineSeries, createChart,
  type IChartApi, type ISeriesApi, type SeriesType, type Time,
} from 'lightweight-charts'
import { muatCandle, type DataCandle } from '../../../lib/dasbor/candleStockbit'
import { muatBrokerHarian, type BrokerHarianEmiten } from '../../../lib/dasbor/neoPapanData'
import { muatRentang } from '../../../lib/dasbor/brokerEmiten'
import {
  agregasiBroker, avgHarga, kumulatifBroker, pilihInvestorHari, topNet,
  type HariStalkerV2, type InvestorStalker,
} from '../../../lib/dasbor/neoPapan'
import { PemilihRentang } from '../../../components/dasbor/PemilihRentang'
import { DropdownMulti, type OpsiMulti } from '../../../components/dasbor/DropdownMulti'
import { useTheme } from '../../../context/ThemeContext'
import { namaBroker } from '../../../lib/dasbor/kelompokBroker'
import { bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { fmtB, num, TOKEN_SERI, OPSI_RENTANG_NP, potongRentang, Kosong, Sumber, type RentangNp } from './bersama'

/**
 * Inventory Chart V2 (spek_neo_papan_revisi.md §3): migrasi ke
 * lightweight-charts — candle harga + garis KUMULATIF net per broker di sumbu
 * KIRI (`leftPriceScale.visible` wajib eksplisit; bawaannya false) + volume.
 *
 * Warna garis dari palet seri DISTINCT (TOKEN_SERI), BUKAN warnaBrokerCanvas —
 * keluhan live Johan 26 Agu: "warna nya masak mirip-mirip". Identitas broker
 * tetap terbaca dari label sumbu kiri (title seri) + legenda tabel.
 *
 * Investor Foreign/Domestik memakai loader §2.3 satu-emiten (`muatRentang`) —
 * murah karena hanya 1-2 berkas tahunan, beda dengan Stalker lintas-962.
 */

const TOP_N = 5

type Ukuran = 'nilai' | 'lot'

export function InventoryTab({ kode }: { kode: string }) {
  const { theme } = useTheme()
  const [candle, setCandle] = useState<DataCandle | null>(null)
  const [harian, setHarian] = useState<BrokerHarianEmiten | null | undefined>(undefined)
  const [tahunan, setTahunan] = useState<{ kunci: string; hari: Record<string, HariStalkerV2> } | null>(null)
  const [rentang, setRentang] = useState<RentangNp>('b1')
  const [ukuran, setUkuran] = useState<Ukuran>('nilai')
  const [investor, setInvestor] = useState<InvestorStalker>('all')
  const [preset, setPreset] = useState<'nb' | 'ns' | 'manual'>('nb')
  const [manual, setManual] = useState<string[]>([])
  /** Broker yang dipilih untuk tabel per-tanggal (klik baris ringkasan). */
  const [brokerRinci, setBrokerRinci] = useState<string | null>(null)

  const bungkusRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lilinRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const volRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const garisRef = useRef<Array<ISeriesApi<SeriesType>>>([])

  useEffect(() => {
    let batal = false
    setCandle(null)
    setHarian(undefined)
    setTahunan(null)
    setBrokerRinci(null)
    muatCandle(kode).then((d) => { if (!batal) setCandle(d) })
    muatBrokerHarian(kode).then((d) => { if (!batal) setHarian(d) })
    return () => { batal = true }
  }, [kode])

  // Candle terpotong rentang — jendela tanggal acuan seluruh tab.
  const lilinRentang = useMemo(() => {
    if (!candle) return []
    return potongRentang(candle.lilin.map((b) => ({ ...b, t: String(b.time) })), rentang)
  }, [candle, rentang])
  const dari = lilinRentang[0]?.t ?? ''
  const sampai = lilinRentang[lilinRentang.length - 1]?.t ?? ''

  // Routing sumber broker (pola Stalker, versi satu-emiten): jendela di dalam
  // cakupan broker_harian & investor ALL → harian; selain itu → tahunan.
  const hariHarianAwal = useMemo(() => {
    const t = harian ? Object.keys(harian.hari).sort() : []
    return t[0] ?? ''
  }, [harian])
  const butuhTahunan = investor !== 'all' || (dari !== '' && hariHarianAwal !== '' && dari < hariHarianAwal)
  const kunciTahunan = `${kode}~${dari}~${sampai}`

  useEffect(() => {
    if (!butuhTahunan || !dari || !sampai) return
    if (tahunan?.kunci === kunciTahunan) return
    let batal = false
    muatRentang(kode, dari, sampai).then((arr) => {
      if (batal) return
      const hari: Record<string, HariStalkerV2> = {}
      for (const [t, h] of arr) {
        hari[t] = {
          ringkas: h.ringkas ? { totalLot: h.ringkas.total_lot ?? null } : null,
          broker: h.broker.map(([kd, beliLot, beliNilai, jualLot, jualNilai]) => ({ kode: kd, beliLot, beliNilai, jualLot, jualNilai })),
          asing: h.asing
            ? { broker: h.asing.broker.map(([kd, beliLot, beliNilai, jualLot, jualNilai]) => ({ kode: kd, beliLot, beliNilai, jualLot, jualNilai })) }
            : null,
        }
      }
      setTahunan({ kunci: kunciTahunan, hari })
    })
    return () => { batal = true }
  }, [butuhTahunan, kunciTahunan, kode, dari, sampai, tahunan?.kunci])

  /** Hari broker efektif pada jendela + investor terpilih. */
  const hariEfektif = useMemo((): Record<string, { broker: HariStalkerV2['broker'] }> | null => {
    if (!dari || !sampai) return null
    if (!butuhTahunan) {
      if (!harian) return null
      const keluar: Record<string, { broker: HariStalkerV2['broker'] }> = {}
      for (const [t, h] of Object.entries(harian.hari)) {
        if (t >= dari && t <= sampai) keluar[t] = { broker: h.broker }
      }
      return keluar
    }
    if (!tahunan || tahunan.kunci !== kunciTahunan) return null
    const keluar: Record<string, { broker: HariStalkerV2['broker'] }> = {}
    for (const [t, h] of Object.entries(tahunan.hari)) {
      const sisi = pilihInvestorHari(h, investor)
      if (sisi) keluar[t] = { broker: sisi.broker }
    }
    return keluar
  }, [butuhTahunan, harian, tahunan, kunciTahunan, dari, sampai, investor])

  const tanggal = useMemo(() => (hariEfektif ? Object.keys(hariEfektif).sort() : []), [hariEfektif])
  const agg = useMemo(() => (hariEfektif ? agregasiBroker(hariEfektif, tanggal) : []), [hariEfektif, tanggal])
  const { pembeli, penjual } = useMemo(() => topNet(agg, TOP_N, ukuran), [agg, ukuran])

  const kodeSemua = useMemo(() => agg.map((a) => a.kode).sort(), [agg])
  const opsiManual = useMemo<OpsiMulti[]>(() => kodeSemua.map((k) => {
    const nama = namaBroker(k)
    return { nilai: k, label: nama === 'belum dikurasi' ? k : `${k} — ${nama}` }
  }), [kodeSemua])

  const terpilih = useMemo(() => {
    if (preset === 'nb') return pembeli.map((a) => a.kode)
    if (preset === 'ns') return penjual.map((a) => a.kode)
    return manual
  }, [preset, pembeli, penjual, manual])

  const kum = useMemo(
    () => (hariEfektif && terpilih.length ? kumulatifBroker(tanggal, hariEfektif, terpilih, ukuran) : null),
    [hariEfektif, tanggal, terpilih, ukuran],
  )

  // ── chart ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = bungkusRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      localization: { locale: 'id-ID', dateFormat: 'dd MMM yyyy' },
      layout: { background: { color: 'transparent' }, attributionLogo: false },
      rightPriceScale: { borderVisible: false },
      // WAJIB eksplisit — bawaan lightweight-charts menyembunyikan sumbu kiri
      // (spek §3.2). Sumbu kiri = kumulatif Rp/Lot, kanan = harga.
      leftPriceScale: { visible: true, borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { labelVisible: true }, horzLine: { labelVisible: true } },
    })
    const lilin = chart.addSeries(CandlestickSeries)
    lilin.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.28 } })
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } })
    chartRef.current = chart
    lilinRef.current = lilin
    volRef.current = vol
    return () => {
      chart.remove()
      chartRef.current = null
      lilinRef.current = null
      volRef.current = null
      garisRef.current = []
    }
  }, [])

  useEffect(() => {
    const el = bungkusRef.current
    const chart = chartRef.current
    if (!el || !chart) return
    const gaya = getComputedStyle(el)
    const c = (v: string, cad: string) => (gaya.getPropertyValue(v) || '').trim() || cad
    chart.applyOptions({
      layout: { textColor: c('--text2', '#9CA0AC') },
      grid: { vertLines: { color: c('--line', '#24262E') }, horzLines: { color: c('--line', '#24262E') } },
    })
  }, [theme])

  useEffect(() => {
    const chart = chartRef.current
    const lilin = lilinRef.current
    const vol = volRef.current
    if (!chart || !lilin || !vol || !candle) return
    lilin.setData(lilinRentang.map(({ t: _t, ...b }) => b))
    const dalam = new Set(lilinRentang.map((b) => b.t))
    vol.setData(candle.volume.filter((v) => dalam.has(String(v.time))))
    chart.timeScale().fitContent()
  }, [candle, lilinRentang])

  // Garis kumulatif — dibongkar-pasang seluruhnya tiap data berubah (pola
  // seri indikator GrafikEmiten). Warna: palet DISTINCT TOKEN_SERI.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    for (const s of garisRef.current) chart.removeSeries(s)
    garisRef.current = []
    if (!kum) return
    kum.seri.forEach((s, i) => {
      const seri = chart.addSeries(LineSeries, {
        priceScaleId: 'left',
        lineWidth: 2,
        color: bacaTokenTema(TOKEN_SERI[i % TOKEN_SERI.length]),
        title: s.broker,
        priceLineVisible: false,
        // Sumbu kiri = rupiah/lot kumulatif — tanpa ini label mentah
        // "2250000000000.00" memakan separuh lebar chart.
        priceFormat: { type: 'custom', formatter: (v: number) => fmtB(v), minMove: 1 },
      })
      seri.setData(kum.tanggal.map((t, j) => ({ time: t as Time, value: s.nilai[j] })))
      garisRef.current.push(seri)
    })
  }, [kum, theme])

  // JANGAN early-return sebelum div chart dirender: efek createChart berjalan
  // sekali; kalau render pertama cuma "Memuat…", ref-nya null selamanya.
  // Area chart selalu ada; pesan keadaan digambar inline.
  const semua = [...agg].sort((a, b) => b.net - a.net)
  const rinci = brokerRinci && hariEfektif
    ? tanggal.map((t) => {
        const b = hariEfektif[t].broker.find((x) => x.kode === brokerRinci)
        return { t, beliLot: b?.beliLot ?? 0, beliNilai: b?.beliNilai ?? 0, jualLot: b?.jualLot ?? 0, jualNilai: b?.jualNilai ?? 0 }
      })
    : null
  let kumRinci = 0

  return (
    <section className="panel panel-b">
      <h2>{kode} — Inventory Chart</h2>
      <p className="np-sub">
        Candle harga (kanan) + kumulatif net {ukuran === 'lot' ? 'lot' : 'nilai'} per broker (kiri),{' '}
        {dari} → {sampai} ({tanggal.length} hari bursa berarsip broker)
        {investor !== 'all' && ` · investor ${investor}`}.
      </p>
      <div className="np-baris">
        <span className="np-lbl">Rentang</span>
        <PemilihRentang opsi={OPSI_RENTANG_NP} nilai={rentang} onGanti={(id) => setRentang(id as RentangNp)} />
        <span className="np-lbl">Ukuran</span>
        {(['nilai', 'lot'] as const).map((u) => (
          <button key={u} type="button" className={'chip-t' + (ukuran === u ? ' on' : '')}
            onClick={() => setUkuran(u)}>{u === 'nilai' ? 'Value' : 'Lot'}</button>
        ))}
        <span className="np-lbl">Investor</span>
        {([['all', 'Semua'], ['asing', 'Asing (klien)'], ['domestik', 'Domestik']] as const).map(([id, label]) => (
          <button key={id} type="button" className={'chip-t' + (investor === id ? ' on' : '')}
            title={id === 'asing' ? 'Investor-type klien luar negeri — bukan identitas kepemilikan sekuritas' : undefined}
            onClick={() => setInvestor(id)}>{label}</button>
        ))}
      </div>
      <div className="np-baris">
        <span className="np-lbl">Broker</span>
        <button type="button" className={'chip-t' + (preset === 'nb' ? ' on' : '')}
          title={`Top ${TOP_N} net buyer (${ukuran}) pada rentang terpilih — definisi PAPAN, bukan kutipan NeoBDM`}
          onClick={() => setPreset('nb')}>Top {TOP_N} NB</button>
        <button type="button" className={'chip-t' + (preset === 'ns' ? ' on' : '')}
          onClick={() => setPreset('ns')}>Top {TOP_N} NS</button>
        <button type="button" className={'chip-t' + (preset === 'manual' ? ' on' : '')}
          onClick={() => setPreset('manual')}>Pilih sendiri</button>
        {preset === 'manual' && (
          <DropdownMulti label="Broker" ariaLabel="Pilih broker" opsi={opsiManual} nilai={manual} onGanti={setManual} ringkasKosong="Belum ada" />
        )}
      </div>

      <div className="chart-wrap" style={{ height: 380 }}><div ref={bungkusRef} style={{ height: '100%' }} /></div>

      {(harian === undefined || !candle) && <Kosong>Memuat…</Kosong>}
      {harian !== undefined && candle && butuhTahunan && !hariEfektif && (
        <Kosong>Memuat arsip broker tahunan {kode}…</Kosong>
      )}
      {harian !== undefined && candle && hariEfektif && tanggal.length === 0 && (
        <Kosong>Rincian broker emiten ini belum tersedia pada rentang/investor terpilih.</Kosong>
      )}

      <div className="tbl" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Broker</th><th className="r">Net</th><th className="r">Beli</th><th className="r">Jual</th><th className="r">B.Avg</th><th className="r">S.Avg</th></tr></thead>
          <tbody>
            {semua.map((a) => (
              <tr key={a.kode} onClick={() => setBrokerRinci((b) => (b === a.kode ? null : a.kode))}
                style={{ cursor: 'pointer' }}
                title="Klik untuk rincian per tanggal">
                <td><b>{a.kode}</b>{brokerRinci === a.kode ? ' ▾' : ''}</td>
                <td className={'r' + (a.net >= 0 ? ' up' : ' dn')}>{fmtB(a.net)}</td>
                <td className="r">{fmtB(a.beliNilai)}</td>
                <td className="r">{fmtB(a.jualNilai)}</td>
                <td className="r">{avgHarga(a.beliNilai, a.beliLot) != null ? num(avgHarga(a.beliNilai, a.beliLot)!) : '—'}</td>
                <td className="r">{avgHarga(a.jualNilai, a.jualLot) != null ? num(avgHarga(a.jualNilai, a.jualLot)!) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rinci && brokerRinci && (
        <div className="tbl" style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 6px' }}>{brokerRinci} — per tanggal</h3>
          <table>
            <thead><tr><th>Tanggal</th><th className="r">Cum</th><th className="r">Net 1D</th><th className="r">B.Avg</th><th className="r">S.Avg</th></tr></thead>
            <tbody>
              {rinci.map((r) => {
                const net1d = ukuran === 'lot' ? r.beliLot - r.jualLot : r.beliNilai - r.jualNilai
                kumRinci += net1d
                return (
                  <tr key={r.t}>
                    <td>{r.t}</td>
                    <td className={'r' + (kumRinci >= 0 ? ' up' : ' dn')}>{fmtB(kumRinci)}</td>
                    <td className={'r' + (net1d >= 0 ? ' up' : ' dn')}>{fmtB(net1d)}</td>
                    <td className="r">{avgHarga(r.beliNilai, r.beliLot) != null ? num(avgHarga(r.beliNilai, r.beliLot)!) : '—'}</td>
                    <td className="r">{avgHarga(r.jualNilai, r.jualLot) != null ? num(avgHarga(r.jualNilai, r.jualLot)!) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sumber>
        Rincian broker harian dari arsip, pasar reguler{investor !== 'all' ? ` — investor ${investor} (label "Asing" = klien luar negeri, bukan identitas sekuritas)` : ''}.
        Garis kumulatif memakai palet warna seri yang dibedakan tegas; kode broker tertera di label sumbu kiri.
      </Sumber>
    </section>
  )
}
