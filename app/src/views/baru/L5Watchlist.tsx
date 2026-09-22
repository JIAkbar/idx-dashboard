import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { urlData } from '../../lib/dasbor/baseData'
import { keFraksi } from '../../lib/fraksiHarga'
import { muatWatchlist } from '../../lib/dasbor/watchlist'
import { useDsTerbaru, useJson, angka, bertanda, rupiah, tanggalPendek, arah } from './data'
import { Hero, Blok, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'
import { ruteLapisan } from './peta'

const CONTOH = ['BBCA', 'BBRI', 'BUMI', 'AMMN', 'BYAN', 'ISAT']

interface Ds { ihsg_value: number }
interface KartuData { harga: number; prev: number; chg: number; stop: number; resistance: { harga: number }[] }
type BrokerRow = [string, number, number, number, number, number, number, string]
interface BrokerHari { broker: BrokerRow[] }
interface BrokerTahunan { hari: Record<string, BrokerHari> }
interface JagoEmiten { kode: string; net_asing_streak: number; tembus_ma20_hari_ini: boolean; net_asing: number }
interface JagoTerbaru { emiten: JagoEmiten[] }

interface EmitenFetch { kartu: KartuData | null; broker: BrokerTahunan | null }

/** Kartu + broker per kode — satu efek untuk seluruh watchlist, bukan satu hook per baris (jumlah kode dinamis). */
function useDataEmiten(kodes: string[], tahun: string | null): Record<string, EmitenFetch> {
  const [data, setData] = useState<Record<string, EmitenFetch>>({})
  useEffect(() => {
    if (!tahun || kodes.length === 0) return
    let hidup = true
    Promise.all(kodes.map((kode) =>
      Promise.all([
        fetch(urlData(`/data-idx/json/kartu/${kode}.json`)).then((r) => (r.ok ? r.json() as Promise<KartuData> : null)).catch(() => null),
        fetch(urlData(`/data-idx/json/broker_tahunan/${kode}/${tahun}.json`)).then((r) => (r.ok ? r.json() as Promise<BrokerTahunan> : null)).catch(() => null),
      ]).then(([kartu, broker]) => [kode, { kartu, broker }] as const),
    )).then((entries) => { if (hidup) setData(Object.fromEntries(entries)) })
    return () => { hidup = false }
  }, [kodes.join(','), tahun])
  return data
}

function topBroker(h: BrokerHari, field: 2 | 4): { kode: string; nilai: number } | null {
  let top: { kode: string; nilai: number } | null = null
  for (const b of h.broker) {
    const nilai = b[field] as number
    if (!top || nilai > top.nilai) top = { kode: b[0], nilai }
  }
  return top
}

export default function L5Watchlist() {
  const [{ kodes, contoh }] = useState<{ kodes: string[]; contoh: boolean }>(() => {
    const item = muatWatchlist()
    return item.length > 0 ? { kodes: item.map((i) => i.kode), contoh: false } : { kodes: CONTOH, contoh: true }
  })
  const ds = useDsTerbaru<Ds>()
  const jago = useJson<JagoTerbaru>('/data-idx/json/jago_papan/terbaru.json')
  const tahun = ds.tanggal ? ds.tanggal.slice(0, 4) : null
  const data = useDataEmiten(kodes, tahun)

  if (!ds.tanggal) return <Keadaan galat={ds.galat} />

  const baris = kodes.map((kode) => {
    const kartu = data[kode]?.kartu ?? null
    const broker = data[kode]?.broker ?? null
    const jagoEmiten = jago.data?.emiten.find((e) => e.kode === kode) ?? null

    let hariTerakhir: string | null = null
    let beliTerbesar: { kode: string; nilai: number } | null = null
    let jualTerbesar: { kode: string; nilai: number } | null = null
    let beliBerganti = false
    let beliSebelumnya: string | null = null
    if (broker) {
      const tgl = Object.keys(broker.hari).sort()
      hariTerakhir = tgl[tgl.length - 1] ?? null
      if (hariTerakhir) {
        beliTerbesar = topBroker(broker.hari[hariTerakhir], 2)
        jualTerbesar = topBroker(broker.hari[hariTerakhir], 4)
      }
      if (tgl.length > 1) {
        const sebelum = topBroker(broker.hari[tgl[tgl.length - 2]], 2)
        beliSebelumnya = sebelum?.kode ?? null
        beliBerganti = !!(beliSebelumnya && beliTerbesar && beliSebelumnya !== beliTerbesar.kode)
      }
    }

    const chg = kartu?.chg ?? 0
    const diLuarAmbang = Math.abs(chg) >= 1
    const berubah = diLuarAmbang || beliBerganti
    const brokerBukanHariIni = hariTerakhir && hariTerakhir !== ds.tanggal

    const bagianAmbang = kartu ? `${diLuarAmbang ? 'Di luar' : 'Dalam'} ambang ±1%.` : ''
    const bagianBroker = beliTerbesar
      ? beliBerganti
        ? `Pembeli terbesar berganti dari ${beliSebelumnya} ke ${beliTerbesar.kode}${brokerBukanHariIni ? ` (arsip ${tanggalPendek(hariTerakhir)})` : ''}.`
        : `Pembeli terbesar tetap ${beliTerbesar.kode}${brokerBukanHariIni ? ` (arsip ${tanggalPendek(hariTerakhir)})` : ''}.`
      : 'Data broker belum tersedia.'

    return { kode, kartu, jagoEmiten, hariTerakhir, beliTerbesar, jualTerbesar, berubah, beliBerganti, narasi: `${bagianAmbang} ${bagianBroker}`.trim() }
  })

  const nBerubah = baris.filter((b) => b.berubah).length
  const nGantiBeli = baris.filter((b) => b.beliBerganti).length
  const tenang = baris.filter((b) => !b.berubah).map((b) => b.kode)

  const netAsing = baris
    .filter((b) => !!b.jagoEmiten)
    .map((b) => ({ kode: b.kode, nilai: b.jagoEmiten!.net_asing }))
  const totalNetAsing = netAsing.reduce((s, x) => s + x.nilai, 0)
  const maxAbsNet = Math.max(1, ...netAsing.map((x) => Math.abs(x.nilai)))
  const dominan = netAsing.reduce((m, x) => (Math.abs(x.nilai) > Math.abs(m?.nilai ?? 0) ? x : m), netAsing[0])
  const arahTotal = totalNetAsing < 0 ? 'jual' : 'beli'
  const lawanArah = netAsing.filter((x) => x.kode !== dominan?.kode && Math.sign(x.nilai) !== Math.sign(totalNetAsing)).length

  return (
    <div className="bb-isi">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 className="bb-judul">Watchlist <span className="bb-catatan" style={{ fontSize: 15, fontWeight: 400 }}>· {kodes.length} emiten{contoh ? ' · contoh' : ''}</span></h1>
        <Link to="/watchlist" className="bb-tombol utama">+ Tambah emiten</Link>
      </div>

      <div className="bb-dua-rata">
        <div className="bb-kolom">
          <Hero label={`Ringkasan hari ini · ${tanggalPendek(ds.tanggal)}`} angka={angka(nBerubah)} satuan={`dari ${kodes.length} emiten berubah`}
            sub={`${nBerubah} dari ${kodes.length} bergerak di luar ambang ±1% hari ini${nGantiBeli ? `; sebagian juga berganti pembeli terbesar` : ''}. ${tenang.length ? `${tenang.join(', ')} tenang — dalam ambang.` : ''}`} />

          <div className="bb-kartu-grid">
            {baris.map((b) => (
              <Link key={b.kode} to={ruteLapisan('harga', b.kode)} className={`bb-kartu ${b.berubah ? 'sorot' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="bb-mono" style={{ fontWeight: 600, fontSize: 17 }}>{b.kode}</span>
                  {b.kartu
                    ? <span className={`bb-mono ${arah(b.kartu.chg)}`} style={{ fontSize: 13 }}>{rupiah(b.kartu.harga)} · {bertanda(b.kartu.chg, 2)}%</span>
                    : <span className="bb-catatan">tidak tersedia</span>}
                </div>
                <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--bb-redup)' }}>{b.narasi}</span>
                {b.kartu && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', paddingTop: 10, borderTop: '1px solid var(--bb-garis)', fontSize: 11 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="bb-catatan">Beli terbesar</span><span className="bb-mono">{b.beliTerbesar ? `${b.beliTerbesar.kode} · ${rupiah(b.beliTerbesar.nilai)}` : 'tidak tersedia'}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="bb-catatan">Jual terbesar</span><span className="bb-mono">{b.jualTerbesar ? `${b.jualTerbesar.kode} · ${rupiah(b.jualTerbesar.nilai)}` : 'tidak tersedia'}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="bb-catatan">Jarak ke stop {angka(keFraksi(b.kartu.stop, 'bawah'))}</span>
                      <span className="bb-mono">{angka(Math.abs((b.kartu.harga / b.kartu.stop - 1) * 100), 1)}% {b.kartu.harga >= b.kartu.stop ? 'di atas' : 'di bawah'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="bb-catatan">Resistance</span><span className="bb-mono">{b.kartu.resistance[0] ? angka(keFraksi(b.kartu.resistance[0].harga, 'atas')) : 'tidak tersedia'}</span></div>
                  </div>
                )}
                <span className={`bb-lencana ${b.berubah ? 'emas' : ''}`}>{b.berubah ? 'berubah' : 'tenang'}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="bb-kolom">
          <Blok kelas="panel" label="Pengaturan pemicu">
            <div className="bb-daftar">
              {['Pembeli terbesar berganti', 'Tembus MA20', 'Asing beruntun ≥ 5 hari', 'Mendekati stop (< 3%)'].map((t) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13 }}>{t}</span>
                  <span className="bb-lencana">segera</span>
                </div>
              ))}
            </div>
            <p className="bb-narasi">Kartu pagi hanya dikirim kalau ada yang berubah — tak ada satu pun pemicu menyala berarti tak ada kartu besok pagi.</p>
          </Blok>

          {netAsing.length > 0 && (
            <Blok kelas="panel" label={`Net asing hari ini · gabungan ${netAsing.length} emiten`}
              narasi={dominan ? `${dominan.kode} menyumbang ${angka(totalNetAsing !== 0 ? Math.abs(dominan.nilai / totalNetAsing) * 100 : 0, 0)}% dari ${arahTotal} bersih gabungan; ${lawanArah} emiten lain bergerak berlawanan arah.` : undefined}>
              <span className={`bb-mono ${arah(totalNetAsing)}`} style={{ fontSize: 22 }}>{rupiah(totalNetAsing)}</span>
              <div className="bb-daftar" style={{ marginTop: 8 }}>
                {netAsing.map((n) => (
                  <div key={n.kode} className="bb-bb">
                    <span className="bb-bb-kode">{n.kode}</span>
                    <span className="bb-bb-rel"><span className={`bb-bb-isi ${arah(n.nilai) === 'turun' ? 'turun' : 'naik'}`} style={{ width: `${(Math.abs(n.nilai) / maxAbsNet) * 100}%` }} /></span>
                    <span className={`bb-bb-nilai ${arah(n.nilai)}`}>{bertanda(n.nilai / 1e9, 1)} M</span>
                  </div>
                ))}
              </div>
            </Blok>
          )}
        </div>
      </div>

      <KakiBaru sumber={`Harga & pemicu dari statistik resmi bursa, ${tanggalPendek(ds.tanggal)}. Broker per hari terakhir yang tersedia per emiten. ${contoh ? 'Watchlist contoh, bukan milik pengguna.' : ''}`} />
    </div>
  )
}
