import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Blok, Keadaan, Ringkas } from './ui'
import { useJson, angka, bertanda, rupiah, tanggalPendek, arah } from './data'
import { EMITEN_BAWAAN, LAYAR, LAPIS_PER_EMITEN, ruteLapisan, ruteLayar } from './peta'
import { PilihEmiten } from './l3-pilih'
import { susunFaktaHarian, susunFaseBroker, type BarisOhlc, type BarisAsing, type HariBrokerPuncak, type FaktaHari } from './cerita-hitung'
import { KakiBaru } from './KakiBaru'

interface Kartu { harga: number; chg: number; tgl: string; sektor?: { nama?: string } }
interface Keystats { rasio: Record<string, string> }
interface Ohlc { d: BarisOhlc[] }
interface Asing { d: BarisAsing[] }
interface BrokerPuncak { hari: HariBrokerPuncak[] }

function parseRasio(s: string | undefined): number | null {
  if (s == null) return null
  const v = Number(String(s).replace(/%/g, '').replace(/,/g, ''))
  return Number.isFinite(v) ? v : null
}

/** Satu kalimat berangka per hari: harga, lalu asing (bila ada), lalu broker
 *  puncak (bila ada). Ruas yang tak dipanen hari itu → "tidak tersedia",
 *  bukan ditebak. */
function KalimatHari({ h }: { h: FaktaHari }) {
  const potongan: ReactNode[] = [
    <span key="h">Tutup <span className="bb-mono">{angka(h.close, 0)}</span>{h.chgPct != null && <> (<span className={`bb-mono ${arah(h.chgPct)}`}>{bertanda(h.chgPct, 2)}%</span>)</>}.</span>,
  ]
  if (h.netAsingLembar != null) {
    const arahAsing = h.netAsingLembar >= 0 ? 'beli' : 'jual'
    potongan.push(<span key="a"> Asing net <span className={`bb-mono ${arah(h.netAsingLembar)}`}>{Math.abs(h.netAsingLembar) >= 1e6 ? `${angka(Math.abs(h.netAsingLembar) / 1e6, 1)} juta` : angka(Math.abs(h.netAsingLembar), 0)} lembar</span> {arahAsing}.</span>)
  }
  if (h.broker) {
    const b = h.broker
    const beliTop = b.beli[0]
    const jualTop = b.jual[0]
    potongan.push(
      <span key="b">
        {' '}{b.accdist === 'Dist' ? 'Distribusi' : 'Akumulasi'} broker.
        {beliTop && <> Pembeli terbesar <span className="bb-mono">{beliTop[0]}</span> ({rupiah(beliTop[1])}).</>}
        {jualTop && <> Penjual terbesar <span className="bb-mono">{jualTop[0]}</span> ({rupiah(Math.abs(jualTop[1]))}).</>}
      </span>,
    )
  }
  return <>{potongan}</>
}

/** #231 layar utama "Emiten sebagai cerita" — kepala + fase broker + valuasi
 *  ringkas di kiri, cerita berurut waktu 10 hari di kanan. */
export default function LayarEmiten() {
  const { kode: kodeParam } = useParams()
  const kode = (kodeParam ?? EMITEN_BAWAAN).toUpperCase()

  const { data: kartu, galat: gk } = useJson<Kartu>(`/data-idx/json/kartu/${kode}.json`)
  const { data: keystats } = useJson<Keystats>(`/data-idx/json/keystats_stockbit/${kode}.json`)
  const { data: ohlc, galat: go } = useJson<Ohlc>(`/data-idx/json/ohlc/${kode}.json`)
  const { data: asing } = useJson<Asing>(`/data-idx/json/asing/${kode}.json`)
  // broker_puncak sedang dibangun agen data lain (#231 bagian D) — bila belum
  // ada, 404-nya masuk galat lokal dan cerita tetap tampil tanpa bagian broker.
  const { data: brokerPuncak } = useJson<BrokerPuncak>(`/data-idx/json/broker_puncak/${kode}.json`)

  const fakta = useMemo(
    () => (ohlc ? susunFaktaHarian(ohlc.d, asing?.d ?? null, brokerPuncak?.hari ?? null, 10) : []),
    [ohlc, asing, brokerPuncak],
  )
  const fase = useMemo(() => susunFaseBroker(brokerPuncak?.hari ?? null, 5), [brokerPuncak])

  const pilih = <PilihEmiten />
  const galat = gk ?? go
  if (galat) return <div className="bb-isi">{pilih}<Keadaan galat={galat} /></div>
  if (!kartu || !ohlc) return <div className="bb-isi">{pilih}<Keadaan /></div>

  const per = parseRasio(keystats?.rasio['Current PE Ratio (TTM)'])
  const pbv = parseRasio(keystats?.rasio['Current Price to Book Value'])
  const roe = parseRasio(keystats?.rasio['Return on Equity (TTM)'])

  const faseJudul = fase.total === 0 ? 'Belum tersedia' : fase.dist > fase.total / 2 ? 'Distribusi' : 'Akumulasi'
  const faseTeks = fase.total === 0
    ? 'Arsip arus broker per emiten belum tersedia untuk kode ini.'
    : `${fase.dist} dari ${fase.total} hari terakhir distribusi.`

  const lapisanEmiten = LAYAR.find((l) => l.id === 'emiten')?.lapisan.filter((p) => LAPIS_PER_EMITEN.has(p.slug)) ?? []

  return (
    <div className="bb-isi">
      <div className="bb-dua">
        <div className="bb-kolom">
          {pilih}
          <div className="bb-hero">
            <span className="bb-label">Harga penutupan</span>
            <div className="bb-hero-angka"><span className={`bb-hero-besar ${arah(kartu.chg)}`}>{angka(kartu.harga, 0)}</span></div>
            <div className="bb-hero-sub">
              <span className={`bb-mono ${arah(kartu.chg)}`}>{bertanda(kartu.chg, 2)}%</span>
              <span>· {tanggalPendek(kartu.tgl)}</span>
            </div>
          </div>

          <Blok kelas="panel" label="Fase broker" narasi="Bukan sinyal; sekadar keadaan.">
            <span className="bb-judul" style={{ fontSize: 20 }}>{faseJudul}</span>
            <p className="bb-narasi" style={{ margin: 0 }}>{faseTeks}</p>
          </Blok>

          <Blok kelas="panel" label="Valuasi" narasi="Sumber utama: rasio bursa.">
            <Ringkas items={[
              { label: 'PER', nilai: per != null ? `${angka(per, 2)}×` : '–' },
              { label: 'PBV', nilai: pbv != null ? `${angka(pbv, 2)}×` : '–' },
              { label: 'ROE', nilai: roe != null ? `${angka(roe, 2)}%` : '–' },
            ]} />
          </Blok>

          <div className="bb-pils">
            {lapisanEmiten.map((l) => <Link key={l.slug} to={ruteLapisan(l.slug, kode)}>{l.label}</Link>)}
          </div>
        </div>

        <div className="bb-kolom">
          <Blok judul="Apa yang terjadi, urut waktu" catatan="bukan tabel; cerita dengan angka di tiap kalimat">
            <div className="bb-daftar">
              {fakta.length === 0 && <Keadaan kosong="Riwayat harga belum tersedia." />}
              {fakta.slice().reverse().map((h) => (
                <div key={h.tanggal} style={{ display: 'grid', gridTemplateColumns: 'minmax(84px,auto) minmax(0,1fr)', columnGap: 16, paddingBottom: 14, borderBottom: '1px solid var(--bb-garis)' }}>
                  <span className="bb-mono" style={{ fontSize: 13, color: 'var(--bb-redup)', paddingTop: 2 }}>{tanggalPendek(h.tanggal)}</span>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}><KalimatHari h={h} /></p>
                </div>
              ))}
            </div>
          </Blok>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link className="bb-tombol utama" to={ruteLayar('rekam')}>Tulis tesis saya</Link>
            <Link className="bb-tombol" to={ruteLayar('pagi')}>Ikuti di kartu pagi</Link>
          </div>
        </div>
      </div>

      <KakiBaru sumber="Harga & arus asing dari statistik resmi bursa. Arus broker dari arsip broker per emiten, bila tersedia." />
    </div>
  )
}
