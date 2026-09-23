import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { urlData } from '../../lib/dasbor/baseData'
import { muatWatchlist } from '../../lib/dasbor/watchlist'
import type { BarisOhlc } from '../../lib/dasbor/ihsgOhlc'
import { useDsTerbaru, useJson, angka, bertanda, rupiah, tanggalPendek } from './data'
import { KakiBaru } from './KakiBaru'
import { ruteLayar } from './peta'
import { cekWatchlistBerubah, hitungLonjakan, type HariBrokerPuncak } from './pagi-hitung'

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

export default function LayarPagi() {
  const [{ kodes, contoh }] = useState<{ kodes: string[]; contoh: boolean }>(() => {
    const item = muatWatchlist()
    return item.length > 0 ? { kodes: item.map((i) => i.kode), contoh: false } : { kodes: CONTOH_WATCHLIST, contoh: true }
  })
  const ds = useDsTerbaru<DsPagi>()
  const broker = useBrokerPuncakWatchlist(kodes)

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

  // (b) watchlist berubah — kode pertama yang pembeli terbesarnya berbalik
  // Tanggal data broker terbaru di watchlist — ditulis di layar supaya
  // arsip yang tertinggal (#232) tak terbaca sebagai "hari ini".
  const tglBroker = Object.values(broker.data).map((h) => h?.[h.length - 1]?.tanggal).filter(Boolean).sort().pop() ?? null
  const kandidatBerubah = kodes
    .map((kode) => ({ kode, hasil: broker.data[kode] ? cekWatchlistBerubah(broker.data[kode]!) : null }))
    .find((x) => x.hasil?.berubah) ?? null
  const adaBerkasBroker = kodes.some((k) => broker.data[k] != null)

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

        {/* (b) watchlist berubah */}
        <div className={`bb-kartu ${kandidatBerubah ? 'sorot' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="bb-mono" style={{ fontWeight: 600, fontSize: 16 }}>
              {kandidatBerubah ? kandidatBerubah.kode : 'Watchlist'} <span style={{ fontWeight: 400, color: 'var(--bb-redup)', fontSize: 12 }}>{kandidatBerubah ? 'watchlist' : ''}{contoh ? ' · contoh' : ''}</span>
            </span>
            {kandidatBerubah && <span className="bb-mono" style={{ color: 'var(--bb-emas)' }}>berubah</span>}
          </div>
          {!broker.dimuat
            ? <span className="bb-catatan">Memuat data broker…</span>
            : !adaBerkasBroker
              ? <span className="bb-catatan">Data pergerakan broker watchlist belum tersedia.</span>
              : kandidatBerubah
                ? (
                  <>
                    <span style={{ fontSize: 14, lineHeight: 1.45 }}>{kandidatBerubah.hasil!.kalimat}</span>
                    <Link to={ruteLayar('emiten', kandidatBerubah.kode)} style={{ fontSize: 13, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>buka ceritanya →</Link>
                  </>
                )
                : <span className="bb-catatan">Tak ada watchlist yang berganti pembeli terbesarnya{tglBroker ? ` (data broker per ${tanggalPendek(tglBroker)})` : ''}.</span>}
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
