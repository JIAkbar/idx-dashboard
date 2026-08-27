import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries, CrosshairMode, HistogramSeries, LineSeries, createChart,
  type IChartApi, type ISeriesApi, type SeriesType, type Time,
} from 'lightweight-charts'
import { muatCandle, type DataCandle } from '../../../lib/dasbor/candleStockbit'
import { muatBrokerHarian, type BrokerHarianEmiten } from '../../../lib/dasbor/neoPapanData'
import { muatRentang } from '../../../lib/dasbor/brokerEmiten'
import {
  agregasiBroker, avgHarga, groupScoreHarian, kumulatifBroker, pilihInvestorHari, topNet,
  type HariStalkerV2, type InvestorStalker,
} from '../../../lib/dasbor/neoPapan'
import { hitungPosisiBroker, trappedTopN, type BarisPosisiHari } from '../../../lib/dasbor/posisiBroker'
import { PemilihRentang } from '../../../components/dasbor/PemilihRentang'
import { DropdownMulti, type OpsiMulti } from '../../../components/dasbor/DropdownMulti'
import { useTheme } from '../../../context/ThemeContext'
import { anggotaKelompok, kelompokBroker, namaBroker } from '../../../lib/dasbor/kelompokBroker'
import { PERINGATAN_PRA_BROKER, praBroker } from '../../../lib/dasbor/brokerEmitenV2'
import { LABEL_KATEGORI, useKategoriBroker, type KategoriBroker } from '../../../lib/dasbor/kategoriBroker'
import { bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { fmtB, num, pct, TOKEN_SERI, OPSI_RENTANG_NP, potongRentang, Kosong, Sumber, type RentangNp } from './bersama'

/** Sparkline net harian — batang mini (pola sama `Spark` di StalkerTab.tsx;
 *  didefinisikan ulang di sini karena berkas itu di luar lingkup sentuh tugas
 *  ini — lihat catatan Papan Pekerjaan). Kelas CSS `.np-spark` sudah bersama. */
function Spark({ seri, n = 10 }: { seri: Array<{ net: number }>; n?: number }) {
  const ekor = seri.slice(-n)
  const puncak = Math.max(1, ...ekor.map((s) => Math.abs(s.net)))
  return (
    <span className="np-spark" aria-hidden="true">
      {ekor.map((s, i) => (
        <span key={i} className={s.net >= 0 ? 'up' : 'dn'}
          style={{ height: `${Math.max(8, (Math.abs(s.net) / puncak) * 100)}%` }} />
      ))}
    </span>
  )
}

const KATEGORI_URUT: KategoriBroker[] = ['whale', 'smart', 'smart_ritel', 'ritel']
/** Jendela "Posisi 6 Bulan" §B.5 — 126 hari bursa, TETAP (tak ikut chip
 *  Rentang chart di atas: itu punya konsep "6 Bulan" sendiri (id 'b6'), tapi
 *  tabel posisi wajib konsisten walau chart di-zoom ke rentang lain). */
const JENDELA_POSISI = 126

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
type PresetBroker = 'akbk' | 'nb' | 'ns' | 'asing' | 'smart' | 'institusi' | 'lokal' | 'manual'
/** Batas garis di chart untuk preset kelompok — 35 anggota smart sekaligus
 *  = benang kusut; ambil N teratas menurut gross nilai pada rentang. */
const GARIS_MAKS = 8

type Ukuran = 'nilai' | 'lot'

export function InventoryTab({ kode }: { kode: string }) {
  const { theme } = useTheme()
  const [candle, setCandle] = useState<DataCandle | null>(null)
  const [harian, setHarian] = useState<BrokerHarianEmiten | null | undefined>(undefined)
  const [tahunan, setTahunan] = useState<{ kunci: string; hari: Record<string, HariStalkerV2> } | null>(null)
  const [rentang, setRentang] = useState<RentangNp>('b1')
  const [ukuran, setUkuran] = useState<Ukuran>('nilai')
  const [investor, setInvestor] = useState<InvestorStalker>('all')
  // Default AK BK (permintaan Johan 27 Agu, spek preset broker §3) — dua
  // broker asing acuan; preset kelompok lain dari kurasi kelompokBroker.
  const [preset, setPreset] = useState<PresetBroker>('akbk')
  const [manual, setManual] = useState<string[]>([])
  /** Broker yang dipilih untuk tabel per-tanggal (klik baris ringkasan). */
  const [brokerRinci, setBrokerRinci] = useState<string | null>(null)
  /** Data mentah "Posisi 6 Bulan" §B.5 — jendela TETAP 126 hari bursa, beda
   *  dari `tahunan` (yang jendelanya ikut chip Rentang chart). */
  const [posisiData, setPosisiData] = useState<{ kunci: string; tanggal: string[]; hari: Record<string, { broker: BarisPosisiHari[] }> } | null>(null)
  const daftarKategori = useKategoriBroker()

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
    setPosisiData(null)
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

  // "Posisi 6 Bulan" §B.5 — jendela TETAP 126 hari bursa dari kalender candle
  // (bukan chip Rentang chart), lewat loader yang sama (`muatRentang`).
  const rentangPosisi = useMemo(() => {
    const n = candle?.lilin.length ?? 0
    if (!n) return null
    return { dari: String(candle!.lilin[Math.max(0, n - JENDELA_POSISI)].time), sampai: String(candle!.lilin[n - 1].time) }
  }, [candle])
  const kunciPosisi = rentangPosisi ? `${kode}~${rentangPosisi.dari}~${rentangPosisi.sampai}` : ''

  useEffect(() => {
    if (!rentangPosisi) return
    if (posisiData?.kunci === kunciPosisi) return
    let batal = false
    muatRentang(kode, rentangPosisi.dari, rentangPosisi.sampai).then((arr) => {
      if (batal) return
      const hari: Record<string, { broker: BarisPosisiHari[] }> = {}
      const tanggal: string[] = []
      for (const [t, h] of arr) {
        tanggal.push(t)
        hari[t] = { broker: h.broker.map(([kd, beliLot, beliNilai, jualLot, jualNilai]) => ({ kode: kd, beliLot, beliNilai, jualLot, jualNilai })) }
      }
      tanggal.sort()
      setPosisiData({ kunci: kunciPosisi, tanggal, hari })
    })
    return () => { batal = true }
  }, [kode, rentangPosisi, kunciPosisi, posisiData?.kunci])

  const hargaKini = candle && candle.lilin.length ? candle.lilin[candle.lilin.length - 1].close : null
  const posisiBroker = useMemo(
    () => (posisiData ? hitungPosisiBroker(posisiData.tanggal, posisiData.hari, hargaKini) : []),
    [posisiData, hargaKini],
  )
  const trapped = useMemo(() => trappedTopN(posisiBroker, 5), [posisiBroker])
  const posisiUrut = useMemo(() => [...posisiBroker].sort((a, b) => b.net - a.net), [posisiBroker])

  // Group Score strip §B.4 — D-10..D0 dari `harian` (jendela geser yang tab
  // ini SUDAH muat saat mount, terpisah dari chip Rentang chart & dari jendela
  // "Posisi 6 Bulan" di atas).
  const kategoriPerBroker = useMemo(() => {
    const m: Record<string, KategoriBroker> = {}
    if (daftarKategori) for (const [kd, p] of Object.entries(daftarKategori.broker)) m[kd] = p.kategori
    return m
  }, [daftarKategori])
  const tanggalSkor = useMemo(() => (harian ? Object.keys(harian.hari).sort().slice(-11) : []), [harian])
  const skorHarian = useMemo(
    () => (harian ? groupScoreHarian(tanggalSkor, harian.hari, kategoriPerBroker) : []),
    [harian, tanggalSkor, kategoriPerBroker],
  )

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

  /** Anggota kelompok yang AKTIF di rentang, urut gross nilai — "aktif
   *  besar" itu relatif terhadap rentang terpilih, bukan daftar tetap. */
  const aktifKelompok = useMemo(() => {
    const urut = [...agg].sort((a, b) => (b.beliNilai + b.jualNilai) - (a.beliNilai + a.jualNilai))
    const per: Record<string, string[]> = { asing: [], smart: [], institusi: [], lokal: [], lain: [] }
    for (const a of urut) {
      const k = kelompokBroker(a.kode)
      if (k === 'asing') per.asing.push(a.kode)
      else per.lokal.push(a.kode)
      if (k === 'smart') per.smart.push(a.kode)
      if (k === 'smart' || k === 'bumn') per.institusi.push(a.kode)
      if (k === 'lain') per.lain.push(a.kode)
    }
    return per
  }, [agg])

  const terpilih = useMemo(() => {
    if (preset === 'akbk') return ['AK', 'BK'].filter((k) => agg.some((a) => a.kode === k))
    if (preset === 'nb') return pembeli.map((a) => a.kode)
    if (preset === 'ns') return penjual.map((a) => a.kode)
    if (preset === 'asing') return aktifKelompok.asing.slice(0, GARIS_MAKS)
    if (preset === 'smart') return aktifKelompok.smart.slice(0, GARIS_MAKS)
    if (preset === 'institusi') return aktifKelompok.institusi.slice(0, GARIS_MAKS)
    if (preset === 'lokal') return aktifKelompok.lokal.slice(0, GARIS_MAKS)
    return manual
  }, [preset, pembeli, penjual, manual, aktifKelompok, agg])

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
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' }, priceScaleId: 'vol',
      // Label "137.59M" menempel tepi kanan-bawah (keluhan Johan 27 Agu) —
      // nilainya tetap terbaca lewat crosshair.
      lastValueVisible: false, priceLineVisible: false,
    })
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
    if (!chart || !lilin || !vol) return
    // Guard lama `|| !candle` KELUAR TANPA MENGOSONGKAN seri — ganti emiten
    // men-set candle null, dan sampai data baru tiba chart masih menggambar
    // candle emiten LAMA di bawah judul emiten baru (bug sumbu/candle basi,
    // spek bug 27 Agu §1). Keadaan kosong kini dieksplisitkan.
    if (!candle) {
      lilin.setData([])
      vol.setData([])
      return
    }
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
        // Label nilai di sumbu kiri DIMATIKAN (spek 27 Agu §2 tata letak):
        // 5 garis kumulatif konvergen membuat pill nilai LWC bertumpukan
        // menempel sumbu — LWC tak punya dodge. Identitas & angka tetap ada
        // di tabel broker (pill warna) dan crosshair.
        lastValueVisible: false,
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
        {praBroker(dari) && <span className="np-parsial"> · {PERINGATAN_PRA_BROKER}</span>}
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
        <button type="button" className={'chip-t' + (preset === 'akbk' ? ' on' : '')}
          title="UBS (AK) & J.P. Morgan (BK) — dua broker asing acuan; bawaan halaman"
          onClick={() => setPreset('akbk')}>AK BK</button>
        <button type="button" className={'chip-t' + (preset === 'nb' ? ' on' : '')}
          title={`Top ${TOP_N} net buyer (${ukuran}) pada rentang terpilih — definisi PAPAN, bukan kutipan NeoBDM`}
          onClick={() => setPreset('nb')}>Top {TOP_N} NB</button>
        <button type="button" className={'chip-t' + (preset === 'ns' ? ' on' : '')}
          onClick={() => setPreset('ns')}>Top {TOP_N} NS</button>
        {/* Preset kelompok dari kurasi PAPAN (kelompokBroker.ts) — bukan
            penggolongan resmi bursa; (aktif/anggota) jujur, nol aktif =
            nonaktif dengan alasan, bukan grafik kosong (spek 27 Agu §3). */}
        {([
          ['asing', 'Asing aktif besar', 'asing' as const],
          ['smart', 'Smart Money', 'smart' as const],
          ['institusi', 'Institusi', null],
          ['lokal', 'Lokal', null],
        ] as const).map(([id, label, kel]) => {
          const aktif = aktifKelompok[id].length
          const anggota = id === 'institusi'
            ? anggotaKelompok('smart') + anggotaKelompok('bumn')
            : id === 'lokal'
              ? null // "semua kecuali asing" — penyebut kurasi tak bermakna
              : anggotaKelompok(kel!)
          const porsiLain = id === 'lokal' && aktifKelompok.lokal.length
            ? Math.round((aktifKelompok.lain.length / aktifKelompok.lokal.length) * 100)
            : 0
          const judul = `Kurasi PAPAN, bukan penggolongan resmi bursa. ${
            id === 'asing' ? `Anggota kelompok asing yang aktif di rentang ini, ${GARIS_MAKS} terbesar menurut nilai.`
            : id === 'smart' ? `Broker kurasi "smart money" yang aktif di rentang ini (maks ${GARIS_MAKS} garis).`
            : id === 'institusi' ? `Smart money + sekuritas BUMN yang aktif (maks ${GARIS_MAKS} garis).`
            : `Semua broker non-asing yang aktif (maks ${GARIS_MAKS} garis)${porsiLain > 30 ? ` — ${porsiLain}% di antaranya belum terkurasi kelompoknya` : ''}.`
          }${aktif === 0 ? ' TIDAK ADA yang aktif di rentang ini.' : ''}`
          return (
            <button key={id} type="button" disabled={aktif === 0}
              className={'chip-t' + (preset === id ? ' on' : '')}
              title={judul}
              onClick={() => setPreset(id)}>
              {label}{anggota != null ? ` (${Math.min(aktif, GARIS_MAKS)}/${anggota})` : ` (${Math.min(aktif, GARIS_MAKS)})`}
            </button>
          )
        })}
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

      <div className="tbl" style={{ marginTop: 20 }}>
        <h3 style={{ margin: '0 0 6px' }}>Group Score — 10 hari terakhir</h3>
        <p className="np-sub">
          Skor harian per kategori perilaku broker: tanda net kategori (naik/turun) × jumlah broker kategori itu yang net searah hari itu —
          penjumlahan tanda, BUKAN skor komposit.
          {daftarKategori && ` Kategori = kurasi PAPAN dari perilaku terukur 120 hari bursa per ${daftarKategori.dibangun.slice(0, 10)} (porsi nilai pasar × keteguhan arah net) — bukan penggolongan resmi bursa, bukan klaim kepintaran.`}
        </p>
        {!daftarKategori && <Kosong>Memuat kategori broker…</Kosong>}
        {daftarKategori && tanggalSkor.length === 0 && <Kosong>Belum ada data broker harian untuk strip ini.</Kosong>}
        {daftarKategori && tanggalSkor.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Kategori</th>
                {tanggalSkor.map((t) => <th key={t} className="r" title={t}>{t.slice(5)}</th>)}
              </tr>
            </thead>
            <tbody>
              {KATEGORI_URUT.map((kat) => (
                <tr key={kat}>
                  <td><b>{LABEL_KATEGORI[kat]}</b></td>
                  {skorHarian.map((h) => {
                    const s = h.skor[kat] ?? 0
                    return (
                      <td key={h.t} className={'r' + (s > 0 ? ' up' : s < 0 ? ' dn' : '')}>
                        {s === 0 ? '·' : (s > 0 ? '+' : '') + s}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="tbl" style={{ marginTop: 20 }}>
        <h3 style={{ margin: '0 0 6px' }}>Posisi 6 Bulan per Broker</h3>
        <p className="np-sub">
          Posisi dihitung dari {posisiData ? posisiData.tanggal.length : JENDELA_POSISI} hari bursa terakhir yang tersedia di arsip
          {rentangPosisi ? ` (${rentangPosisi.dari} → ${rentangPosisi.sampai})` : ''}. Floor = rata-rata tertimbang harga beli seluruh
          jendela; PnL% hanya dihitung untuk broker net-beli.
          {rentangPosisi && praBroker(rentangPosisi.dari) && <span className="np-parsial"> · {PERINGATAN_PRA_BROKER}</span>}
        </p>
        {trapped.total > 0 && (
          <p className="np-sub">
            <span className="badge">TRAPPED {trapped.trapped}/{trapped.total}</span>{' '}
            dari {trapped.total} net-buyer terbesar jendela ini posisinya di bawah floor pada harga sekarang.
          </p>
        )}
        {!posisiData && <Kosong>Memuat arsip broker {kode}…</Kosong>}
        {posisiData && posisiUrut.length === 0 && <Kosong>Tak ada rincian broker pada jendela ini.</Kosong>}
        {posisiData && posisiUrut.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Broker</th><th className="r">Net</th><th className="r">Floor</th><th className="r">PnL%</th>
                <th className="r">Hari</th><th>Status</th><th>Tren 10H</th><th>10 Hari</th>
              </tr>
            </thead>
            <tbody>
              {posisiUrut.map((p) => (
                <tr key={p.kode}>
                  <td><b>{p.kode}</b></td>
                  <td className={'r' + (p.net >= 0 ? ' up' : ' dn')}>{fmtB(p.net)}</td>
                  <td className="r">{p.floor != null ? num(p.floor) : '—'}</td>
                  <td className={'r' + (p.pnlPersen != null ? (p.pnlPersen >= 0 ? ' up' : ' dn') : '')}>
                    {p.pnlPersen != null ? pct(p.pnlPersen * 100) : '—'}
                  </td>
                  <td className="r">{p.hariSejakFlip}</td>
                  <td className={p.status === 'AKUM' ? 'up' : p.status === 'DIST' ? 'dn' : ''}>{p.status}</td>
                  <td>{p.tren ?? '—'}</td>
                  <td><Spark seri={p.seriHarian} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Sumber>
        Rincian broker harian dari arsip, pasar reguler{investor !== 'all' ? ` — investor ${investor} (label "Asing" = klien luar negeri, bukan identitas sekuritas)` : ''}.
        Garis kumulatif memakai palet warna seri yang dibedakan tegas; kode broker tertera di label sumbu kiri.
      </Sumber>
    </section>
  )
}
