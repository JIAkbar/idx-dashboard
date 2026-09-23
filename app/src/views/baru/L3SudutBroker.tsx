import { Fragment, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Blok, Keadaan } from './ui'
import { useJson, angka, rupiah } from './data'
import { EMITEN_BAWAAN, ruteLapisan } from './peta'
import { PilihEmiten } from './l3-pilih'
import { KakiBaru } from './KakiBaru'

interface Kartu { tgl: string }
type BarisBroker = [string, number, number, number, number, number, number, string]
interface HariBroker {
  ringkas: { n_beli: number; n_jual: number; total_lot: number; total_nilai: number; top1_pct: number; accdist: string }
  broker: BarisBroker[]
  asing: { broker: BarisBroker[] }
}
interface BrokerTahunan { hari: Record<string, HariBroker> }
interface Bandarmologi {
  d: {
    kode: string
    lot_per_tx: number
    z_lot: number
    rasio_offer_bid: number
    accdist: string
    fase: { hhi_beli: number; hhi_jual: number; top3_beli_pct: number; top3_jual_pct: number }
    key_account: { broker: string; hari: number; net: number }[]
  }[]
}
interface DsBrokerVal { broker_val?: { cd: string; nm: string }[] }

const SUDUT = [
  { label: 'Bandarmologi', aktif: true, href: null as string | null },
  { label: 'Whales', aktif: false, href: '/whales-papan' },
  { label: 'Trader', aktif: false, href: '/trader-papan' },
  { label: 'Stalker', aktif: false, href: '/bandarmologi' },
  { label: 'Kuli', aktif: false, href: '/kalkulator?bagian=kuli-papan' },
]

export default function L3SudutBroker() {
  const { kode: kodeParam } = useParams()
  const kode = (kodeParam ?? EMITEN_BAWAAN).toUpperCase()
  const { data: kartu, galat: gk } = useJson<Kartu>(`/data-idx/json/kartu/${kode}.json`)
  const tahun = kartu?.tgl.slice(0, 4) ?? null
  const { data: bt, galat: gbt } = useJson<BrokerTahunan>(tahun ? `/data-idx/json/broker_tahunan/${kode}/${tahun}.json` : null)
  const { data: bd, galat: gbd } = useJson<Bandarmologi>('/data-idx/json/bandarmologi.json')
  const { data: dsIdx } = useJson<{ dates: { stem: string }[] }>('/data-idx/json/index.json')
  const akhirStem = dsIdx?.dates[dsIdx.dates.length - 1]?.stem
  const { data: ds } = useJson<DsBrokerVal>(akhirStem ? `/data-idx/json/${akhirStem}.json` : null)

  const namaBroker = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of ds?.broker_val ?? []) m.set(b.cd, b.nm)
    return m
  }, [ds])

  const olah = useMemo(() => {
    if (!bt) return null
    const hariKeys = Object.keys(bt.hari).sort()
    const n20 = hariKeys.slice(-20)
    if (n20.length === 0) return null
    const hariTerakhir = bt.hari[n20[n20.length - 1]]
    let hariDist = 0
    let netAsing20 = 0
    const netBroker = new Map<string, number>()
    const barChart: { tgl: string; tinggi: number; dist: boolean }[] = []
    for (const k of n20) {
      const h = bt.hari[k]
      if (h.ringkas.accdist === 'Dist') hariDist += 1
      for (const r of h.asing.broker) netAsing20 += r[2] - r[4]
      for (const r of h.broker) netBroker.set(r[0], (netBroker.get(r[0]) ?? 0) + (r[2] - r[4]))
      barChart.push({ tgl: k, tinggi: h.ringkas.top1_pct, dist: h.ringkas.accdist === 'Dist' })
    }
    const urutNet = [...netBroker.entries()].sort((a, b) => b[1] - a[1])
    const pembeli = urutNet.slice(0, 5)
    const penjual = urutNet.slice(-5).reverse()
    const maksBar = Math.max(...barChart.map((b) => b.tinggi), 1)
    const maksBeli = Math.max(...pembeli.map((p) => Math.abs(p[1])), 1)
    const maksJual = Math.max(...penjual.map((p) => Math.abs(p[1])), 1)
    return { n20, hariTerakhir, hariDist, netAsing20, pembeli, penjual, barChart, maksBar, maksBeli, maksJual }
  }, [bt])

  const galat = gk ?? gbt ?? gbd
  if (galat) return <div className="bb-isi"><PilihEmiten slug="broker" /><Keadaan galat={galat} /><KakiBaru sumber="Ringkasan broker resmi bursa." /></div>
  if (!kartu || !bt || !bd || !olah) return <div className="bb-isi"><PilihEmiten slug="broker" /><Keadaan /></div>

  const baris = bd.d.find((r) => r.kode === kode)
  if (!baris) {
    return (
      <div className="bb-isi">
        <PilihEmiten slug="broker" />
        <Keadaan kosong={`${kode} belum punya data broker terkalibrasi — kemungkinan likuiditasnya terlalu tipis.`} />
        <KakiBaru sumber="Ringkasan broker resmi bursa." />
      </div>
    )
  }

  const { n20, hariTerakhir, hariDist, netAsing20, pembeli, penjual, barChart, maksBar, maksBeli, maksJual } = olah
  const namaAtau = (kd: string) => namaBroker.get(kd) ?? kd
  // Emiten tipis bisa tanpa fase/key account (terukur: WBSA 23 Sep) — jangan pecah.
  const fase = baris.fase ?? { hhi_beli: NaN, hhi_jual: NaN, top3_beli_pct: NaN, top3_jual_pct: NaN }
  const kaTerurut = [...(baris.key_account ?? [])].sort((a, b) => b.hari - a.hari).slice(0, 5)
  const maksKa = Math.max(...kaTerurut.map((k) => k.hari), 1)

  return (
    <div className="bb-isi">
      <PilihEmiten slug="broker" />
      <div className="bb-pils">
        {SUDUT.map((s) => (
          s.aktif
            ? <span key={s.label} className="bb-pil aktif">{s.label}</span>
            : <Link key={s.label} to={s.href ?? '#'} className="bb-pil">{s.label}</Link>
        ))}
        <Link to={ruteLapisan('broker-summary', kode)} style={{ marginLeft: 'auto', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>tabel broker hari ini →</Link>
      </div>

      <div className="bb-tiga">
        <div className="bb-blok panel">
          <span className="bb-label">Fase 20 hari terakhir</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--bb-sans)', fontSize: 'clamp(44px,6vw,64px)', fontWeight: 700 }}>{hariDist}</span>
            <span className="bb-mono" style={{ fontSize: 15, color: 'var(--bb-redup)' }}>/ {n20.length} hari distribusi</span>
          </div>
          <span className={`bb-mono ${netAsing20 < 0 ? 'turun' : 'naik'}`} style={{ fontSize: 15 }}>Net asing 20 hari {rupiah(netAsing20)}</span>
          <p className="bb-narasi">
            {hariDist >= n20.length - hariDist ? 'Lebih banyak' : 'Lebih sedikit'} hari distribusi daripada akumulasi ({hariDist} lawan {n20.length - hariDist}); asing {netAsing20 < 0 ? 'jadi penjual bersih' : 'jadi pembeli bersih'} dalam jendela yang sama.
          </p>
        </div>

        <div className="bb-blok panel">
          <span className="bb-label">Fase saat ini · {n20[n20.length - 1].slice(5)}</span>
          <span className="bb-judul" style={{ fontSize: 22, fontWeight: 300 }}>{hariTerakhir.ringkas.accdist === 'Dist' ? 'Distribusi' : 'Akumulasi'}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginTop: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="bb-label">Nilai transaksi</span><span className="bb-mono" style={{ fontSize: 15 }}>{rupiah(hariTerakhir.ringkas.total_nilai)}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="bb-label">Broker aktif</span><span className="bb-mono" style={{ fontSize: 15 }}>{hariTerakhir.ringkas.n_beli} beli · {hariTerakhir.ringkas.n_jual} jual</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="bb-label">Rasio offer/bid</span><span className="bb-mono" style={{ fontSize: 15 }}>{angka(baris.rasio_offer_bid, 2)}</span></div>
          </div>
          <p className="bb-narasi">Broker {hariTerakhir.ringkas.accdist === 'Dist' ? 'jual mendominasi' : 'beli mendominasi'} order book hari ini: rasio offer terhadap bid {angka(baris.rasio_offer_bid, 2)}.</p>
        </div>

        <div className="bb-blok panel">
          <span className="bb-label">Konsentrasi broker · {n20[n20.length - 1].slice(5)}</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--bb-redup)' }}>HHI beli</span><span className="bb-mono" style={{ fontSize: 15 }}>{angka(fase.hhi_beli, 3)}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--bb-redup)' }}>HHI jual</span><span className="bb-mono" style={{ fontSize: 15 }}>{angka(fase.hhi_jual, 3)}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--bb-redup)' }}>Top-3 beli</span><span className="bb-mono" style={{ fontSize: 15 }}>{angka(fase.top3_beli_pct, 1)}%</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--bb-redup)' }}>Top-3 jual</span><span className="bb-mono" style={{ fontSize: 15 }}>{angka(fase.top3_jual_pct, 1)}%</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--bb-redup)' }}>Lot per transaksi</span><span className="bb-mono" style={{ fontSize: 15 }}>{angka(baris.lot_per_tx, 2)} (z {angka(baris.z_lot, 2)})</span></div>
          </div>
          <p className="bb-narasi">Sisi {fase.top3_jual_pct > fase.top3_beli_pct ? 'jual' : 'beli'} lebih terkonsentrasi: {angka(Math.max(fase.top3_jual_pct, fase.top3_beli_pct), 0)}% volume dikuasai 3 broker teratas.</p>
        </div>
      </div>

      <Blok
        label="Akumulasi / distribusi, 20 hari terakhir"
        catatan="tinggi batang = konsentrasi top-1 broker"
        narasi="Batang merah = hari distribusi, hijau = hari akumulasi, tinggi mengikuti konsentrasi broker teratas."
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
          {barChart.map((b) => (
            <div key={b.tgl} title={`${b.tgl} ${b.dist ? 'Dist' : 'Acc'} top1 ${angka(b.tinggi, 0)}%`} style={{ flex: 1, height: `${Math.max(2, (b.tinggi / maksBar) * 100)}%`, background: b.dist ? 'var(--bb-turun)' : 'var(--bb-naik)', borderRadius: '3px 3px 0 0' }} />
          ))}
        </div>
        <div className="teks-11" style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--bb-mono)', color: 'var(--bb-redup)' }}>
          <span>{n20[0].slice(5)}</span><span>{n20[n20.length - 1].slice(5)}</span>
        </div>
      </Blok>

      <div className="bb-tiga">
        <div className="bb-blok panel">
          <span className="bb-label">5 pembeli bersih terbesar · 20 hari</span>
          <div className="bb-daftar" style={{ marginTop: 4 }}>
            {pembeli.map(([kd, v]) => (
              <div key={kd} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) auto', columnGap: 10, alignItems: 'center', fontSize: 13 }}>
                <span className="bb-mono" style={{ fontWeight: 600 }}>{kd}</span>
                <span className="bb-bb-rel"><span className="bb-bb-isi naik" style={{ width: `${Math.min(100, (v / maksBeli) * 100)}%` }} /></span>
                <span className="bb-mono naik" style={{ textAlign: 'right' }}>+{rupiah(v).replace('Rp ', '')}</span>
              </div>
            ))}
          </div>
          {pembeli[0] && <p className="bb-narasi">{namaAtau(pembeli[0][0])} membeli {rupiah(pembeli[0][1])} bersih — pembeli bersih terbesar dalam 20 hari.</p>}
        </div>

        <div className="bb-blok panel">
          <span className="bb-label">5 penjual bersih terbesar · 20 hari</span>
          <div className="bb-daftar" style={{ marginTop: 4 }}>
            {penjual.map(([kd, v]) => (
              <div key={kd} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) auto', columnGap: 10, alignItems: 'center', fontSize: 13 }}>
                <span className="bb-mono" style={{ fontWeight: 600 }}>{kd}</span>
                <span className="bb-bb-rel"><span className="bb-bb-isi turun" style={{ width: `${Math.min(100, (Math.abs(v) / maksJual) * 100)}%` }} /></span>
                <span className="bb-mono turun" style={{ textAlign: 'right' }}>−{rupiah(v).replace('Rp ', '').replace('−', '')}</span>
              </div>
            ))}
          </div>
          {penjual[0] && <p className="bb-narasi">{namaAtau(penjual[0][0])} menjual {rupiah(Math.abs(penjual[0][1]))} bersih — penjual bersih terbesar dalam 20 hari.</p>}
        </div>

        <div className="bb-blok panel">
          <span className="bb-label">Key account · hari aktif dari {n20.length}</span>
          <div className="bb-daftar" style={{ marginTop: 4 }}>
            {kaTerurut.map((k) => (
              <Fragment key={k.broker}>
                <div style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) 30px 84px', columnGap: 8, alignItems: 'center', fontSize: 13 }}>
                  <span className="bb-mono" style={{ fontWeight: 600 }}>{k.broker}</span>
                  <span className="bb-bb-rel"><span className="bb-bb-isi emas" style={{ width: `${Math.min(100, (k.hari / maksKa) * 100)}%` }} /></span>
                  <span className="bb-mono teks-11" style={{ color: 'var(--bb-redup)', textAlign: 'right' }}>{k.hari}h</span>
                  <span className={`bb-mono ${k.net < 0 ? 'turun' : 'naik'}`} style={{ textAlign: 'right' }}>{k.net < 0 ? '−' : '+'}{rupiah(Math.abs(k.net)).replace('Rp ', '')}</span>
                </div>
              </Fragment>
            ))}
          </div>
          {kaTerurut[0] && <p className="bb-narasi">{namaAtau(kaTerurut[0].broker)} muncul di {kaTerurut[0].hari} dari {n20.length} hari dengan net {kaTerurut[0].net < 0 ? '−' : '+'}{rupiah(Math.abs(kaTerurut[0].net))} — paling konsisten pada saham ini.</p>}
        </div>
      </div>

      <KakiBaru sumber="Rincian dari ringkasan broker resmi bursa, 50 baris teratas per sisi. Fase & kategori dihitung dari pola transaksi 20 hari terakhir, bukan sinyal beli/jual." />
    </div>
  )
}
