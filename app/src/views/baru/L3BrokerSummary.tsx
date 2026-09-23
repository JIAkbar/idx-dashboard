import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useJson, useDsTerbaru, angka, rupiah, tanggalPendek } from './data'
import { Blok, BarisBatang, Keadaan, Pil } from './ui'
import { KakiBaru } from './KakiBaru'
import { EMITEN_BAWAAN } from './peta'
import { PilihEmiten } from './l3-pilih'

/** [kode, beli_lot, beli_nilai, jual_lot, jual_nilai, freq_beli, freq_jual, jenis(A/P/L)]. */
type BrokerRow = [string, number, number, number, number, number, number, string]
interface RingkasBroker {
  n_beli: number; n_jual: number; total_lot: number; total_nilai: number; avg: number
  top1_pct: number; top3_pct: number; top5_pct: number
}
interface GrupBroker { ringkas: RingkasBroker; broker: BrokerRow[] }
interface HariBroker extends GrupBroker { asing?: GrupBroker; nego?: GrupBroker }
interface BrokerTahunan { kode: string; tahun: number; hari: Record<string, HariBroker> }
interface DsBrokerVal { broker_val?: { cd: string; nm: string }[] }

const VARIAN: { slug: 'reguler' | 'asing' | 'nego'; label: string }[] = [
  { slug: 'reguler', label: 'Reguler' },
  { slug: 'asing', label: 'Asing' },
  { slug: 'nego', label: 'Nego' },
]
const SEGERA = ['Nego-asing', 'Tunai', 'Tunai-asing']

function warnaJenis(j: string): string {
  return j === 'A' ? 'var(--bb-biru)' : j === 'P' ? 'var(--bb-emas)' : 'var(--bb-redup)'
}

/** Satu baris broker berperingkat: titik jenis + kode + nama + batang + nilai (dan harga rata-rata di bawahnya). */
function BarisBroker({ kode, nama, jenis, lebar, nilai, hargaR, warna }: {
  kode: string; nama: string; jenis: string; lebar: number; nilai: string; hargaR: string
  warna: 'biru' | 'emas' | 'turun'
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '9px 34px minmax(0,1fr) 72px 58px', columnGap: 7, alignItems: 'center', minHeight: 26 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: warnaJenis(jenis), justifySelf: 'center' }} />
      <span className="bb-bb-kode">{kode}</span>
      <span className="bb-bb-nama">{nama}</span>
      <span className="bb-bb-rel"><span className={`bb-bb-isi ${warna}`} style={{ width: `${Math.max(0, Math.min(100, lebar))}%` }} /></span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <span className="bb-bb-nilai">{nilai}</span>
        <span className="bb-mono teks-10" style={{ color: 'var(--bb-redup)' }}>{hargaR}</span>
      </span>
    </div>
  )
}

function hargaRata(nilai: number, lot: number): string {
  return lot > 0 ? angka(nilai / (lot * 100), 0) : '–'
}

/** Rupiah ringkas bertanda: +Rp 67,5 M / −Rp 165,0 M. */
function tandaRupiah(v: number): string {
  return `${v >= 0 ? '+' : '−'}${rupiah(Math.abs(v))}`
}

export default function L3BrokerSummary() {
  const { kode: kodeParam } = useParams<{ kode: string }>()
  const kode = (kodeParam ?? EMITEN_BAWAAN).toUpperCase()
  const [varian, setVarian] = useState<'reguler' | 'asing' | 'nego'>('reguler')

  const { data: ds } = useDsTerbaru<DsBrokerVal>()
  const namaBroker = new Map((ds?.broker_val ?? []).map((b) => [b.cd, b.nm] as const))

  const tahun = new Date().getFullYear()
  const { data, galat } = useJson<BrokerTahunan>(`/data-idx/json/broker_tahunan/${kode}/${tahun}.json`)

  if (galat) return <Keadaan galat={galat} />
  if (!data) return <Keadaan />
  const tgl = Object.keys(data.hari).sort().at(-1)
  const rec = tgl ? data.hari[tgl] : undefined
  if (!rec) return <Keadaan kosong={`Belum ada data broker summary ${kode} tahun ${tahun}.`} />

  const grup: GrupBroker = varian === 'reguler' ? rec : (rec[varian] ?? { ringkas: rec.ringkas, broker: [] })
  const namaUtk = (kd: string) => namaBroker.get(kd) ?? kd

  const beli10 = [...grup.broker].sort((a, b) => b[2] - a[2]).slice(0, 10)
  const jual10 = [...grup.broker].sort((a, b) => b[4] - a[4]).slice(0, 10)
  const maxBeli = Math.max(...beli10.map((b) => b[2]), 1)
  const maxJual = Math.max(...jual10.map((b) => b[4]), 1)
  const topBeli = beli10[0]
  const topJual = jual10[0]
  const totalNilai = grup.ringkas.total_lot > 0 ? grup.ringkas.total_nilai : 0

  const asing = rec.asing
  const asingBeliTot = asing ? asing.broker.reduce((s, b) => s + b[2], 0) : 0
  const asingJualTot = asing ? asing.broker.reduce((s, b) => s + b[4], 0) : 0
  const asingNet = asingBeliTot - asingJualTot
  const asingTop3Beli = asing ? [...asing.broker].sort((a, b) => b[2] - a[2]).slice(0, 3) : []
  const asingTop3Jual = asing ? [...asing.broker].sort((a, b) => b[4] - a[4]).slice(0, 3) : []
  const maxAsingBeli = Math.max(...asingTop3Beli.map((b) => b[2]), 1)
  const maxAsingJual = Math.max(...asingTop3Jual.map((b) => b[4]), 1)
  const asingTopBeliBroker = asingTop3Beli[0]
  const asingTopJualBroker = asingTop3Jual[0]

  const net = rec.broker.map((b) => ({ kode: b[0], jenis: b[7], net: b[2] - b[4] }))
  const net5Beli = [...net].sort((a, b) => b.net - a.net).slice(0, 5).filter((n) => n.net > 0)
  const net5Jual = [...net].sort((a, b) => a.net - b.net).slice(0, 5).filter((n) => n.net < 0)
  const maxNetBeli = Math.max(...net5Beli.map((n) => n.net), 1)
  const maxNetJual = Math.max(...net5Jual.map((n) => Math.abs(n.net)), 1)

  return (
    <div className="bb-isi">
      <PilihEmiten slug="broker-summary" />

      <Blok kelas="polos" label={`Broker summary · ${VARIAN.find((v) => v.slug === varian)?.label}`} catatan={`${tanggalPendek(tgl)} · penutupan`}>
        <div className="bb-pils">
          {VARIAN.map((v) => (
            <Pil key={v.slug} aktif={varian === v.slug} onClick={() => setVarian(v.slug)}>{v.label}</Pil>
          ))}
          {SEGERA.map((s) => (
            <span key={s} className="bb-pil" style={{ opacity: 0.45, cursor: 'not-allowed' }}>{s} · segera</span>
          ))}
        </div>
      </Blok>

      <div className="bb-dua">
        <div className="bb-kolom">
          <span className="bb-label">Nilai transaksi broker summary · {VARIAN.find((v) => v.slug === varian)?.label.toLowerCase()}</span>
          <span className="bb-hero-besar">{rupiah(totalNilai)}</span>
          <span className="bb-mono" style={{ color: 'var(--bb-redup)' }}>
            harga rata-rata Rp {angka(grup.ringkas.avg, 0)} · {grup.ringkas.n_beli} broker beli, {grup.ringkas.n_jual} broker jual
          </span>
        </div>
        <Blok kelas="polos" label="Konsentrasi nilai transaksi"
          narasi={`Broker teratas sendiri menampung ${angka(grup.ringkas.top1_pct, 1)}% nilai transaksi; lima besar ${angka(grup.ringkas.top5_pct, 1)}%.`}>
          <div className="bb-daftar">
            <BarisBatang kode="Top 1" lebar={grup.ringkas.top5_pct > 0 ? (grup.ringkas.top1_pct / grup.ringkas.top5_pct) * 100 : 0} nilai={`${angka(grup.ringkas.top1_pct, 1)}%`} warna="emas" />
            <BarisBatang kode="Top 3" lebar={grup.ringkas.top5_pct > 0 ? (grup.ringkas.top3_pct / grup.ringkas.top5_pct) * 100 : 0} nilai={`${angka(grup.ringkas.top3_pct, 1)}%`} warna="biru" />
            <BarisBatang kode="Top 5" lebar={100} nilai={`${angka(grup.ringkas.top5_pct, 1)}%`} warna="biru" />
          </div>
        </Blok>
      </div>

      <div className="bb-dua-rata">
        <Blok label="Broker beli terbesar" catatan="A asing · P pemerintah · L lokal"
          narasi={topBeli ? `${namaUtk(topBeli[0])} (${topBeli[0]}) membeli ${rupiah(topBeli[2])}, ${angka(totalNilai > 0 ? (topBeli[2] / totalNilai) * 100 : 0, 1)}% dari nilai transaksi hari ini.` : 'Tidak ada transaksi beli.'}>
          <div className="bb-daftar">
            {beli10.map((b, i) => (
              <BarisBroker key={b[0]} kode={b[0]} nama={namaUtk(b[0])} jenis={b[7]}
                lebar={(b[2] / maxBeli) * 100} nilai={rupiah(b[2])} hargaR={hargaRata(b[2], b[1])}
                warna={i === 0 ? 'emas' : 'biru'} />
            ))}
          </div>
        </Blok>
        <Blok label="Broker jual terbesar" catatan="A asing · P pemerintah · L lokal"
          narasi={topJual ? `${namaUtk(topJual[0])} (${topJual[0]}) melepas ${rupiah(topJual[4])}, ${angka(totalNilai > 0 ? (topJual[4] / totalNilai) * 100 : 0, 1)}% dari nilai transaksi hari ini.` : 'Tidak ada transaksi jual.'}>
          <div className="bb-daftar">
            {jual10.map((b, i) => (
              <BarisBroker key={b[0]} kode={b[0]} nama={namaUtk(b[0])} jenis={b[7]}
                lebar={(b[4] / maxJual) * 100} nilai={rupiah(b[4])} hargaR={hargaRata(b[4], b[3])}
                warna={i === 0 ? 'emas' : 'turun'} />
            ))}
          </div>
        </Blok>
      </div>

      <div className="bb-dua-rata">
        <Blok judul="Asing di papan reguler"
          narasi={asing ? `Asing papan reguler ${asingNet >= 0 ? 'beli bersih' : 'jual bersih'} ${rupiah(Math.abs(asingNet))} hari ini${asingNet >= 0
            ? (asingTopBeliBroker ? `; ${namaUtk(asingTopBeliBroker[0])} memimpin akumulasi.` : '.')
            : (asingTopJualBroker ? `; ${namaUtk(asingTopJualBroker[0])} memimpin pelepasan.` : '.')}` : 'Data asing tidak tersedia.'}>
          {asing ? (
            <>
              <div className="bb-ringkas">
                <div className="bb-ringkas-it"><span className="bb-label">Beli asing</span><span className="bb-ringkas-nilai naik">{rupiah(asingBeliTot)}</span></div>
                <div className="bb-ringkas-it"><span className="bb-label">Jual asing</span><span className="bb-ringkas-nilai turun">{rupiah(asingJualTot)}</span></div>
              </div>
              <div className="bb-dua-rata">
                <div className="bb-kolom" style={{ gap: 6 }}>
                  <span className="bb-label" style={{ color: 'var(--bb-naik)' }}>Top 3 beli</span>
                  <div className="bb-daftar">
                    {asingTop3Beli.map((b) => (
                      <BarisBatang key={b[0]} kode={b[0]} lebar={(b[2] / maxAsingBeli) * 100} nilai={rupiah(b[2])} warna="naik" />
                    ))}
                  </div>
                </div>
                <div className="bb-kolom" style={{ gap: 6 }}>
                  <span className="bb-label" style={{ color: 'var(--bb-turun)' }}>Top 3 jual</span>
                  <div className="bb-daftar">
                    {asingTop3Jual.map((b) => (
                      <BarisBatang key={b[0]} kode={b[0]} lebar={(b[4] / maxAsingJual) * 100} nilai={rupiah(b[4])} warna="turun" />
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : <Keadaan kosong="Data asing tidak tersedia." />}
        </Blok>
        <Blok judul="Net per broker · hari ini"
          narasi={[
            net5Beli[0] ? `${namaUtk(net5Beli[0].kode)} akumulasi bersih terbesar ${tandaRupiah(net5Beli[0].net)}` : null,
            net5Jual[0] ? `${namaUtk(net5Jual[0].kode)} distribusi bersih terbesar ${tandaRupiah(net5Jual[0].net)}` : null,
          ].filter(Boolean).join('; ') + '.'}>
          <div className="bb-dua-rata">
            <div className="bb-kolom" style={{ gap: 6 }}>
              <span className="bb-label" style={{ color: 'var(--bb-naik)' }}>5 net beli terbesar</span>
              <div className="bb-daftar">
                {net5Beli.map((n) => (
                  <BarisBatang key={n.kode} kode={n.kode} lebar={(n.net / maxNetBeli) * 100} nilai={tandaRupiah(n.net)} warna="naik" nada="naik" />
                ))}
              </div>
            </div>
            <div className="bb-kolom" style={{ gap: 6 }}>
              <span className="bb-label" style={{ color: 'var(--bb-turun)' }}>5 net jual terbesar</span>
              <div className="bb-daftar">
                {net5Jual.map((n) => (
                  <BarisBatang key={n.kode} kode={n.kode} lebar={(Math.abs(n.net) / maxNetJual) * 100} nilai={tandaRupiah(n.net)} warna="turun" nada="turun" />
                ))}
              </div>
            </div>
          </div>
        </Blok>
      </div>

      <KakiBaru sumber={`Broker summary papan reguler · nilai rupiah · lot = 100 lembar · ${tanggalPendek(tgl)}`} />
    </div>
  )
}
