import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { urlData } from '../../lib/dasbor/baseData'
import { muatWatchlist } from '../../lib/dasbor/watchlist'
import { muatPemicu, LABEL_PEMICU, type Pemicu } from '../../lib/dasbor/pemicuPagi'
import type { BarisOhlc } from '../../lib/dasbor/ihsgOhlc'
import type { BarisAsing } from './cerita-hitung'
import { useDsTerbaru, useJson, angka, bertanda, rupiah, tanggalPendek } from './data'
import { KakiBaru } from './KakiBaru'
import { ruteLayar } from './peta'
import {
  hitungLonjakan, pemicuAsingBeruntun, pemicuDekatStop, pemicuPembeliBerganti, pemicuTembusMa20,
  type HariBrokerPuncak,
} from './pagi-hitung'

/** #231 layar utama "Kartu Pagi" — tiga hal sebelum bursa buka. */

const CONTOH_WATCHLIST = ['BBCA', 'BBRI', 'BUMI', 'AMMN', 'BYAN', 'ISAT']

interface DsPagi {
  ihsg_pct: number
  nf_today_idr?: number
  gainers?: { c: string; p: number }[]
}

interface BerkasBrokerPuncak {
  kode: string
  hari: HariBrokerPuncak[]
}

/** Ambil `broker_puncak/<KODE>.json` untuk tiap kode watchlist — satu efek untuk
 *  daftar, sama polanya dengan `useDataEmiten` di L5Watchlist.tsx. `null` = berkas
 *  belum ada (agen data lain sedang membangunnya) — dibedakan dari "belum dimuat". */
function useBrokerPuncakWatchlist(kodes: string[]): { data: Record<string, HariBrokerPuncak[] | null>; dimuat: boolean } {
  const [data, setData] = useState<Record<string, HariBrokerPuncak[] | null>>({})
  const [dimuat, setDimuat] = useState(false)
  useEffect(() => {
    if (kodes.length === 0) { setDimuat(true); return }
    let hidup = true
    setDimuat(false)
    Promise.all(kodes.map((kode) =>
      fetch(urlData(`/data-idx/json/broker_puncak/${kode}.json`))
        .then((r) => (r.ok ? (r.json() as Promise<BerkasBrokerPuncak>) : null))
        .then((j) => [kode, j?.hari ?? null] as const)
        .catch(() => [kode, null] as const),
    )).then((entries) => { if (hidup) { setData(Object.fromEntries(entries)); setDimuat(true) } })
    return () => { hidup = false }
  }, [kodes.join(',')])
  return { data, dimuat }
}

interface KartuMini { harga: number; stop: number }
interface DataPemicuEmiten { ohlc: BarisOhlc[] | null; asing: BarisAsing[] | null; kartu: KartuMini | null }

/** OHLC + asing + kartu per kode watchlist — cuma untuk menilai pemicu (#236), satu efek untuk daftar. */
function useDataPemicuWatchlist(kodes: string[]): { data: Record<string, DataPemicuEmiten>; dimuat: boolean } {
  const [data, setData] = useState<Record<string, DataPemicuEmiten>>({})
  const [dimuat, setDimuat] = useState(false)
  useEffect(() => {
    if (kodes.length === 0) { setDimuat(true); return }
    let hidup = true
    setDimuat(false)
    Promise.all(kodes.map((kode) =>
      Promise.all([
        fetch(urlData(`/data-idx/json/ohlc/${kode}.json`)).then((r) => (r.ok ? (r.json() as Promise<{ d: BarisOhlc[] }>) : null)).then((j) => j?.d ?? null).catch(() => null),
        fetch(urlData(`/data-idx/json/asing/${kode}.json`)).then((r) => (r.ok ? (r.json() as Promise<{ d: BarisAsing[] }>) : null)).then((j) => j?.d ?? null).catch(() => null),
        fetch(urlData(`/data-idx/json/kartu/${kode}.json`)).then((r) => (r.ok ? (r.json() as Promise<KartuMini>) : null)).catch(() => null),
      ]).then(([ohlc, asing, kartu]) => [kode, { ohlc, asing, kartu }] as const),
    )).then((entries) => { if (hidup) { setData(Object.fromEntries(entries)); setDimuat(true) } })
    return () => { hidup = false }
  }, [kodes.join(',')])
  return { data, dimuat }
}

export default function LayarPagi() {
  const [{ kodes, contoh }] = useState<{ kodes: string[]; contoh: boolean }>(() => {
    const item = muatWatchlist()
    return item.length > 0 ? { kodes: item.map((i) => i.kode), contoh: false } : { kodes: CONTOH_WATCHLIST, contoh: true }
  })
  const [setelan] = useState(muatPemicu)
  const ds = useDsTerbaru<DsPagi>()
  const broker = useBrokerPuncakWatchlist(kodes)
  const dataPemicu = useDataPemicuWatchlist(kodes)

  const gainerTerbesar = [...(ds.data?.gainers ?? [])].sort((a, b) => b.p - a.p)[0] ?? null
  const ohlcGainer = useJson<{ d: BarisOhlc[] }>(gainerTerbesar ? `/data-idx/json/ohlc/${gainerTerbesar.c}.json` : null)

  // (a) IHSG
  const dsData = ds.data
  const kalimatIhsg = dsData
    ? `IHSG ${dsData.ihsg_pct >= 0 ? 'naik' : 'turun'} ${angka(Math.abs(dsData.ihsg_pct), 2)}%. ${
        dsData.nf_today_idr != null
          ? `Asing ${dsData.nf_today_idr >= 0 ? 'net beli' : 'net jual'} ${rupiah(Math.abs(dsData.nf_today_idr) * 1e9)}.`
          : 'Net asing tidak tersedia.'
      }`
    : null

  // (b) pemicu watchlist yang menyala (#236) — semua emiten, semua pemicu aktif.
  // Tanggal data broker terbaru di watchlist — ditulis di layar supaya
  // arsip yang tertinggal (#232) tak terbaca sebagai "hari ini".
  const tglBroker = Object.values(broker.data).map((h) => h?.[h.length - 1]?.tanggal).filter(Boolean).sort().pop() ?? null
  const dimuatPemicu = broker.dimuat && dataPemicu.dimuat
  const pemicuPerEmiten = kodes
    .map((kode) => {
      const d = dataPemicu.data[kode]
      const brokerHari = broker.data[kode]
      const menyala: { p: Pemicu; kalimat: string }[] = []
      if (setelan['pembeli-berganti'] && brokerHari) {
        const r = pemicuPembeliBerganti(brokerHari)
        if (r.menyala && r.kalimat) menyala.push({ p: 'pembeli-berganti', kalimat: r.kalimat })
      }
      if (setelan['tembus-ma20'] && d?.ohlc) {
        const r = pemicuTembusMa20(d.ohlc)
        if (r.menyala && r.kalimat) menyala.push({ p: 'tembus-ma20', kalimat: r.kalimat })
      }
      if (setelan['asing-beruntun'] && d?.asing) {
        const r = pemicuAsingBeruntun(d.asing)
        if (r.menyala && r.kalimat) menyala.push({ p: 'asing-beruntun', kalimat: r.kalimat })
      }
      if (setelan['dekat-stop'] && d?.kartu) {
        const r = pemicuDekatStop(d.kartu)
        if (r.menyala && r.kalimat) menyala.push({ p: 'dekat-stop', kalimat: r.kalimat })
      }
      return { kode, menyala }
    })
    .filter((x) => x.menyala.length > 0)

  // (c) lonjakan — kejadian lampau serupa & return H+5
  const ambangPct = gainerTerbesar ? gainerTerbesar.p * 0.8 : null
  const lonjakan = ohlcGainer.data && ambangPct != null ? hitungLonjakan(ohlcGainer.data.d, ambangPct) : null
  const kalimatLonjakan = lonjakan
    ? lonjakan.n < 5
      ? 'terlalu sedikit untuk disimpulkan.'
      : `${lonjakan.n} kejadian, median H+5 ${bertanda(lonjakan.medianH5, 1)}%.`
    : null

  return (
    <div className="bb-isi">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="bb-label">Kartu pagi · {tanggalPendek(ds.tanggal)}</span>
        <h1 className="bb-judul" style={{ fontSize: 28 }}>Tiga hal sebelum bursa buka</h1>
        <p className="bb-narasi" style={{ margin: 0 }}>30 detik. Sisanya bisa ditunda.</p>
      </div>

      <div className="bb-kolom">
        {/* (a) IHSG */}
        <div className="bb-kartu">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="bb-mono" style={{ fontWeight: 600, fontSize: 16 }}>IHSG</span>
            {dsData && <span className={`bb-mono ${dsData.ihsg_pct >= 0 ? 'naik' : 'turun'}`}>{bertanda(dsData.ihsg_pct, 2)}%</span>}
          </div>
          {kalimatIhsg ? <span style={{ fontSize: 14, lineHeight: 1.45 }}>{kalimatIhsg}</span> : <span className="bb-catatan">Data belum bisa dimuat.</span>}
        </div>

        {/* (b) pemicu watchlist */}
        <div className={`bb-kartu ${pemicuPerEmiten.length > 0 ? 'sorot' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="bb-mono" style={{ fontWeight: 600, fontSize: 16 }}>
              Watchlist <span style={{ fontWeight: 400, color: 'var(--bb-redup)', fontSize: 12 }}>pemicu{contoh ? ' · contoh' : ''}</span>
            </span>
            {pemicuPerEmiten.length > 0 && <span className="bb-mono" style={{ color: 'var(--bb-emas)' }}>{pemicuPerEmiten.length} menyala</span>}
          </div>
          {!dimuatPemicu
            ? <span className="bb-catatan">Memuat data watchlist…</span>
            : pemicuPerEmiten.length === 0
              ? <span className="bb-catatan">Tak ada pemicu yang menyala untuk watchlist-mu{tglBroker ? ` (data broker per ${tanggalPendek(tglBroker)})` : ''}.</span>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pemicuPerEmiten.map(({ kode, menyala }) => (
                    <div key={kode} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Link to={ruteLayar('emiten', kode)} className="bb-mono" style={{ fontWeight: 600, fontSize: 13, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{kode} →</Link>
                      {menyala.map((m) => (
                        <span key={m.p} style={{ fontSize: 13, lineHeight: 1.4 }}>{LABEL_PEMICU[m.p]}: {m.kalimat}</span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
        </div>

        {/* (c) lonjakan */}
        <div className="bb-kartu">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="bb-mono" style={{ fontWeight: 600, fontSize: 16 }}>{gainerTerbesar ? gainerTerbesar.c : 'Lonjakan'}</span>
            {gainerTerbesar && <span className="bb-mono naik">+{angka(gainerTerbesar.p, 2)}%</span>}
          </div>
          {!gainerTerbesar
            ? <span className="bb-catatan">Tidak ada data kenaikan harga hari ini.</span>
            : !lonjakan
              ? <span className="bb-catatan">Memuat riwayat harga…</span>
              : (
                <>
                  <span style={{ fontSize: 14, lineHeight: 1.45 }}>{kalimatLonjakan}</span>
                  <Link to={ruteLayar('emiten', gainerTerbesar.c)} style={{ fontSize: 13, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>buka ceritanya →</Link>
                </>
              )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="bb-catatan">Kartu ini dirakit dari panen data harian. Angka dihitung ulang tiap kali halaman dibuka.</span>
        <Link to={ruteLayar('tanya')} className="bb-tombol utama" style={{ alignSelf: 'flex-start' }}>Buka PAPAN</Link>
      </div>

      <KakiBaru sumber="Statistik resmi bursa dan panen broker harian PAPAN." />
    </div>
  )
}
