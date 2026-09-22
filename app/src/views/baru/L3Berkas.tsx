import { Fragment, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Blok, Keadaan } from './ui'
import { useJson, angka, rupiah, bertanda } from './data'
import { EMITEN_BAWAAN } from './peta'
import { PilihEmiten } from './l3-pilih'
import { KakiBaru } from './KakiBaru'

interface Kartu {
  harga: number
  stop: number
  er_persentil: number
  likuiditas_median20: number
  kualitas: { riwayat: string; likuiditas: string }
  musiman: { n: number; naik: number; mentah: number; median: number; bawah: number; atas: number; total_bulan: number }
  sektor: { nama: string; sektor: string; subsektor: string; papan: string; tercatat: string }
}
interface Fundamental {
  pe?: number; pb?: number; pbv?: number; roe?: number; roa?: number; der_q?: number; npm?: number
  eps?: number; dividend_yield?: number; market_cap?: number; shares?: number
  week52_high?: number; week52_low?: number
}
interface Keystats { rasio: Record<string, string> }
interface PeriodeKeuangan {
  revenue: number | null; net_income: number | null; total_assets: number | null; equity: number | null
}
interface Keuangan { kuartal: Record<string, PeriodeKeuangan> }

function parseRasio(s: string | undefined): number | null {
  if (s == null) return null
  const v = Number(String(s).replace(/%/g, '').replace(/,/g, ''))
  return Number.isFinite(v) ? v : null
}

function labelKuartal(iso: string): string {
  const [y, m] = iso.split('-')
  if (m === '03') return `Q1 ${y}`
  if (m === '06') return `H1 ${y}`
  if (m === '09') return `9 bulan ${y}`
  if (m === '12') return `Tahun penuh ${y}`
  return iso
}

function sahamFmt(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–'
  if (v >= 1e9) return `${angka(v / 1e9, 2)} miliar`
  if (v >= 1e6) return `${angka(v / 1e6, 2)} juta`
  return angka(v, 0)
}

interface BarisRasio { nama: string; satuan: 'x' | '%' | 'rp'; utama: number | null; cadangan: number | null }

export default function L3Berkas() {
  const { kode: kodeParam } = useParams()
  const kode = (kodeParam ?? EMITEN_BAWAAN).toUpperCase()
  const { data: kartu, galat: gk } = useJson<Kartu>(`/data-idx/json/kartu/${kode}.json`)
  const { data: fundamental, galat: gf } = useJson<Fundamental>(`/data-idx/json/fundamental/${kode}.json`)
  const { data: keystats, galat: gks } = useJson<Keystats>(`/data-idx/json/keystats_stockbit/${kode}.json`)
  const { data: keuangan, galat: gkeu } = useJson<Keuangan>(`/data-idx/json/keuangan_idx/${kode}.json`)

  const baris = useMemo((): BarisRasio[] => {
    const r = keystats?.rasio ?? {}
    return [
      { nama: 'PER', satuan: 'x', utama: parseRasio(r['Current PE Ratio (TTM)']), cadangan: fundamental?.pe ?? null },
      { nama: 'PBV', satuan: 'x', utama: parseRasio(r['Current Price to Book Value']), cadangan: fundamental?.pb ?? fundamental?.pbv ?? null },
      { nama: 'ROE', satuan: '%', utama: parseRasio(r['Return on Equity (TTM)']), cadangan: fundamental?.roe != null ? fundamental.roe * 100 : null },
      { nama: 'ROA', satuan: '%', utama: parseRasio(r['Return on Assets (TTM)']), cadangan: fundamental?.roa != null ? fundamental.roa * 100 : null },
      { nama: 'DER', satuan: 'x', utama: parseRasio(r['Debt to Equity Ratio (Quarter)']), cadangan: fundamental?.der_q ?? null },
      { nama: 'Margin laba', satuan: '%', utama: parseRasio(r['Net Profit Margin (Quarter)']), cadangan: fundamental?.npm != null ? fundamental.npm * 100 : null },
      { nama: 'Dividend yield', satuan: '%', utama: parseRasio(r['Dividend Yield']), cadangan: fundamental?.dividend_yield ?? null },
      { nama: 'EPS', satuan: 'rp', utama: parseRasio(r['Current EPS (TTM)']), cadangan: fundamental?.eps ?? null },
    ]
  }, [keystats, fundamental])

  const kuartalTerbaru = useMemo(() => {
    if (!keuangan) return []
    return Object.keys(keuangan.kuartal).sort().slice(-4)
  }, [keuangan])

  // Laporan keuangan tak wajib: emiten tanpa XBRL (mis. IPO baru) tetap tampil tanpa blok kuartal.
  const galat = gk ?? gf ?? gks
  if (galat) return <div className="bb-isi"><PilihEmiten slug="berkas" /><Keadaan galat={galat} /><KakiBaru sumber="Statistik resmi bursa." /></div>
  if (!kartu || !fundamental || !keystats || (!keuangan && !gkeu)) return <div className="bb-isi"><PilihEmiten slug="berkas" /><Keadaan /></div>

  const per = parseRasio(keystats.rasio['Current PE Ratio (TTM)'])
  const perIhsg = parseRasio(keystats.rasio['IHSG PE Ratio TTM (Median)'])
  const earningYield = keystats.rasio['Earnings Yield (TTM)']
  const skalaMax = Math.max(20, Math.ceil(Math.max(per ?? 0, perIhsg ?? 0) / 5) * 5 + 5)
  const posPer = per != null ? Math.min(100, (per / skalaMax) * 100) : 0
  const posIhsg = perIhsg != null ? Math.min(100, (perIhsg / skalaMax) * 100) : 0
  const stopPct = ((kartu.stop - kartu.harga) / kartu.harga) * 100

  const labelSatuan = (b: BarisRasio, v: number) => (b.satuan === 'x' ? `${angka(v, 2)}×` : b.satuan === '%' ? `${angka(v, 2)}%` : `Rp ${angka(v, 0)}`)

  const metrikKuartal: { kunci: keyof PeriodeKeuangan; label: string }[] = [
    { kunci: 'net_income', label: 'laba' },
    { kunci: 'total_assets', label: 'aset' },
    { kunci: 'equity', label: 'ekuitas' },
  ]
  const adaRevenue = !!keuangan && kuartalTerbaru.some((k) => keuangan.kuartal[k].revenue != null)
  if (adaRevenue) metrikKuartal.unshift({ kunci: 'revenue', label: 'pendapatan' })

  return (
    <div className="bb-isi">
      <PilihEmiten slug="berkas" />
      <div className="bb-dua">
        <div className="bb-kolom">
          <div className="bb-blok panel">
            <span className="bb-label">Profil emiten</span>
            <span className="bb-judul" style={{ fontSize: 19 }}>{kartu.sektor.nama}</span>
            <p className="bb-narasi" style={{ margin: 0 }}>
              {kartu.sektor.sektor} · {kartu.sektor.subsektor} · papan {kartu.sektor.papan} · tercatat {kartu.sektor.tercatat}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 10px', fontSize: 13, paddingTop: 10, borderTop: '1px solid var(--bb-garis)', marginTop: 4 }}>
              <span style={{ color: 'var(--bb-redup)' }}>Kapitalisasi</span><span className="bb-mono">{rupiah(fundamental.market_cap)}</span>
              <span style={{ color: 'var(--bb-redup)' }}>Jumlah saham</span><span className="bb-mono">{sahamFmt(fundamental.shares)}</span>
              <span style={{ color: 'var(--bb-redup)' }}>Rentang 52 minggu</span><span className="bb-mono">{angka(fundamental.week52_low, 0)}–{angka(fundamental.week52_high, 0)}</span>
            </div>
          </div>

          <div className="bb-blok panel">
            <span className="bb-label">Kartu analisa</span>
            <div className="bb-pils">
              <span className="bb-lencana">riwayat: {kartu.kualitas.riwayat}</span>
              <span className="bb-lencana">likuiditas: {kartu.kualitas.likuiditas}</span>
            </div>
            <span className="bb-label" style={{ marginTop: 4 }}>Persentil efisiensi risiko</span>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--bb-garis)' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, kartu.er_persentil))}%`, height: 8, borderRadius: 999, background: 'var(--bb-turun)' }} />
            </div>
            <span className="bb-mono" style={{ fontSize: 13 }}>{angka(kartu.er_persentil, 1)} dari 100</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', fontSize: 13, paddingTop: 10, borderTop: '1px solid var(--bb-garis)' }}>
              <span style={{ color: 'var(--bb-redup)' }}>Stop teknikal</span><span className="bb-mono turun">{angka(kartu.stop, 0)} ({bertanda(stopPct, 2)}%)</span>
              <span style={{ color: 'var(--bb-redup)' }}>Likuiditas median 20h</span><span className="bb-mono">{rupiah(kartu.likuiditas_median20)}</span>
            </div>
            <p className="bb-narasi">Persentil efisiensi {angka(kartu.er_persentil, 1)} dari 100 populasi — rasio hasil terhadap risiko dibanding emiten lain, bukan penilaian arah harga.</p>
          </div>

          <div className="bb-blok panel">
            <span className="bb-label">Musiman · {kartu.musiman.n} tahun data</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 10px', fontSize: 13 }}>
              <span style={{ color: 'var(--bb-redup)' }}>Bulan berjalan naik</span><span className="bb-mono naik">{kartu.musiman.naik} / {kartu.musiman.n} ({angka(kartu.musiman.mentah, 1)}%)</span>
              <span style={{ color: 'var(--bb-redup)' }}>Median perubahan</span><span className="bb-mono">{bertanda(kartu.musiman.median, 2)}%</span>
              <span style={{ color: 'var(--bb-redup)' }}>Rentang bawah–atas</span><span className="bb-mono">{angka(kartu.musiman.bawah, 1)}–{angka(kartu.musiman.atas, 1)}</span>
            </div>
            <p className="bb-narasi">Dari {kartu.musiman.n} kejadian bulan yang sama, harga naik {kartu.musiman.naik} kali. Bukan jaminan, hanya kecenderungan historis.</p>
          </div>
        </div>

        <div className="bb-kolom">
          <Blok narasi={`Diperdagangkan pada rasio harga-laba ${per != null && perIhsg != null ? angka(per / perIhsg, 1) : '–'}× median seluruh emiten bursa.`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <span className="bb-label">Valuasi PER (TTM)</span>
              <span className="bb-catatan">titik emas = {kode} · titik redup = median IHSG</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--bb-sans)', fontSize: 'clamp(44px,6vw,72px)', fontWeight: 700 }}>{per != null ? `${angka(per, 2)}×` : '–'}</span>
              <span className="bb-mono" style={{ fontSize: 14, color: 'var(--bb-redup)' }}>median IHSG {perIhsg != null ? `${angka(perIhsg, 2)}×` : '–'}</span>
            </div>
            <div style={{ position: 'relative', height: 24, margin: '4px 0' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 11, height: 2, background: 'var(--bb-garis)' }} />
              <div style={{ position: 'absolute', left: `${posIhsg}%`, top: 6, width: 12, height: 12, borderRadius: 999, background: 'var(--bb-redup)' }} />
              <div style={{ position: 'absolute', left: `${posPer}%`, top: 4, width: 16, height: 16, borderRadius: 999, background: 'var(--bb-emas)' }} />
              <span className="bb-mono" style={{ position: 'absolute', left: 0, top: -2, fontSize: 11, color: 'var(--bb-redup)' }}>0×</span>
              <span className="bb-mono" style={{ position: 'absolute', right: 0, top: -2, fontSize: 11, color: 'var(--bb-redup)' }}>{skalaMax}×</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16, paddingTop: 12, borderTop: '1px solid var(--bb-garis)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="bb-label">PBV</span><span className="bb-mono" style={{ fontSize: 18 }}>{baris[1].utama != null ? `${angka(baris[1].utama, 2)}×` : '–'}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="bb-label">Earnings yield</span><span className="bb-mono" style={{ fontSize: 18 }}>{earningYield ?? '–'}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="bb-label">Dividend yield</span><span className="bb-mono" style={{ fontSize: 18 }}>{baris[6].utama != null ? `${angka(baris[6].utama, 2)}%` : '–'}</span></div>
            </div>
          </Blok>

          <Blok
            judul="Delapan rasio, dua sumber"
            catatan="tanda ≠ bila beda >10% dari nilai bursa"
            narasi="Bursa = rasio resmi bursa (utama); cadangan = penyedia data pasar independen. Selisih besar biasanya beda periode acuan, bukan galat."
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) minmax(48px,auto)', columnGap: 12, rowGap: 8, alignItems: 'center', fontSize: 13 }}>
              <span className="bb-label">Rasio</span><span className="bb-label" style={{ textAlign: 'right' }}>Bursa</span><span className="bb-label" style={{ textAlign: 'right' }}>Cadangan</span><span />
              {baris.map((b) => {
                const beda = b.utama != null && b.cadangan != null ? Math.abs(b.utama - b.cadangan) / Math.max(Math.abs(b.utama), 1e-9) * 100 : null
                return (
                  <Fragment key={b.nama}>
                    <span>{b.nama}</span>
                    <span className="bb-mono" style={{ textAlign: 'right' }}>{b.utama != null ? labelSatuan(b, b.utama) : '–'}</span>
                    <span className="bb-mono" style={{ textAlign: 'right', color: 'var(--bb-redup)' }}>{b.cadangan != null ? labelSatuan(b, b.cadangan) : '–'}</span>
                    <span style={{ color: 'var(--bb-emas)', fontSize: 12 }}>{beda != null && beda > 10 ? `≠ ${angka(beda, 0)}%` : ''}</span>
                  </Fragment>
                )
              })}
            </div>
          </Blok>

          {keuangan ? (
          <Blok
            judul="Empat kuartal terakhir, laporan resmi"
            catatan="interim kumulatif sejak awal tahun fiskal"
            narasi={adaRevenue
              ? 'Nilai kumulatif sejak awal tahun fiskal — kuartal berikutnya selalu lebih besar dari kuartal sebelumnya di tahun yang sama, bukan percepatan kinerja.'
              : 'Pendapatan tidak tersedia pada sumber ini. Nilai kumulatif sejak awal tahun fiskal — kuartal berikutnya selalu lebih besar dari kuartal sebelumnya di tahun yang sama, bukan percepatan kinerja.'}
          >
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kuartalTerbaru.length},minmax(0,1fr))`, columnGap: 12, rowGap: 4, fontSize: 12, color: 'var(--bb-redup)' }}>
              {kuartalTerbaru.map((k) => <span key={k} style={{ textAlign: 'center' }}>{labelKuartal(k)}</span>)}
            </div>
            {metrikKuartal.map((m) => {
              const nilai = kuartalTerbaru.map((k) => keuangan!.kuartal[k][m.kunci])
              const maks = Math.max(...nilai.filter((v): v is number => v != null).map((v) => Math.abs(v)), 1)
              return (
                <div key={m.kunci} style={{ display: 'grid', gridTemplateColumns: `repeat(${kuartalTerbaru.length},minmax(0,1fr))`, columnGap: 12, rowGap: 4, alignItems: 'center', marginTop: 4 }}>
                  {nilai.map((v, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                      <div style={{ width: '100%', height: 8, background: 'var(--bb-garis)', borderRadius: 3, overflow: 'hidden' }}>
                        {v != null && <div style={{ width: `${Math.max(2, (Math.abs(v) / maks) * 100)}%`, height: 8, background: 'var(--bb-biru)' }} />}
                      </div>
                      <span className="bb-mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{v != null ? `${m.label} ${rupiah(v)}` : 'tidak tersedia'}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </Blok>
          ) : (
            <Blok judul="Laporan keuangan" narasi="Laporan keuangan resmi emiten ini belum tersedia di arsip PAPAN." />
          )}
        </div>
      </div>
      <KakiBaru sumber="Valuasi dari statistik resmi bursa, cadangan dari penyedia data pasar independen. Laporan keuangan dari laporan resmi bursa." />
    </div>
  )
}
