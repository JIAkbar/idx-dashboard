import { Link } from 'react-router-dom'
import { useJson, angka, bertanda, rupiah, tanggalPendek, arah } from './data'
import { Blok, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'
import { ruteLapisan } from './peta'

interface EmitenIpo {
  kode: string; nama: string; tahun: number; tanggal_listing: string
  harga_ipo: number; lembar: number; dana: number; underwriters: string[]
  close_1d: number | null; return_1d: number | null
  close_1w: number | null; return_1w: number | null
  close_1m: number | null; return_1m: number | null
  close_kini: number | null; return_kini: number | null
}
interface HorizonUw { n: number; win: number; median: number }
interface Underwriter { nama: string; n: number; h1d: HorizonUw; h1w: HorizonUw; h1m: HorizonUw; hkini: HorizonUw }
interface IpoJson { tanggal: string; n: number; emiten: EmitenIpo[]; underwriter: Underwriter[] }

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
function tglRingkas(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2, '0')} ${BULAN_PENDEK[m - 1]} ${String(y).slice(2)}`
}

export default function L3Ipo({ sisip = false }: { sisip?: boolean } = {}) {
  const { data, galat } = useJson<IpoJson>('/data-idx/json/ipo.json')
  if (galat) return <Keadaan galat={galat} />
  if (!data) return <Keadaan />
  if (data.emiten.length === 0) return <Keadaan kosong="Belum ada data IPO." />

  const terurut = [...data.emiten].sort((a, b) => (b.tanggal_listing || '').localeCompare(a.tanggal_listing || ''))
  const terbaru = terurut[0]
  const uwNama = terbaru.underwriters[0]
  const uw = data.underwriter.find((u) => u.nama === uwNama)

  const titik = [
    { label: 'IPO', nilai: terbaru.harga_ipo },
    { label: '+1 hari', nilai: terbaru.close_1d },
    { label: '+1 minggu', nilai: terbaru.close_1w },
    { label: '+1 bulan', nilai: terbaru.close_1m },
    { label: 'kini', nilai: terbaru.close_kini },
  ].filter((t) => t.nilai != null) as { label: string; nilai: number }[]
  const nilaiTitik = titik.map((t) => t.nilai)
  const minT = Math.min(...nilaiTitik)
  const maxT = Math.max(...nilaiTitik) || 1
  const rangeT = Math.max(1, maxT - minT)
  const svgY = (v: number) => 90 - ((v - minT) / rangeT) * 80
  const svgX = (i: number) => (titik.length > 1 ? (i / (titik.length - 1)) * 380 : 0)
  const puncakIdx = nilaiTitik.indexOf(maxT)
  const puncakLabel = titik[puncakIdx]?.label ?? '–'
  const puncakReturn = terbaru.harga_ipo > 0 ? ((maxT - terbaru.harga_ipo) / terbaru.harga_ipo) * 100 : 0

  const delapan = terurut.slice(0, 8)
  const maxAbsReturn = Math.max(...delapan.map((e) => Math.abs(e.return_kini ?? 0)), 1)
  const naikDariDelapan = delapan.filter((e) => (e.return_kini ?? 0) > 0).length

  const tahunIni = Math.max(...data.emiten.map((e) => e.tahun))
  const tahunLalu = tahunIni - 1
  function statTahun(th: number) {
    const rows = data!.emiten.filter((e) => e.tahun === th)
    const n = rows.length
    const rk = rows.map((e) => e.return_kini).filter((v): v is number => v != null).sort((a, b) => a - b)
    const median = rk.length ? (rk.length % 2 ? rk[(rk.length - 1) / 2] : (rk[rk.length / 2 - 1] + rk[rk.length / 2]) / 2) : null
    const diatas = n > 0 ? (rows.filter((e) => (e.return_kini ?? 0) > 0).length / n) * 100 : 0
    const dana = rows.reduce((s, e) => s + (e.dana || 0), 0)
    return { n, median, diatas, dana }
  }
  const stIni = statTahun(tahunIni)
  const stLalu = statTahun(tahunLalu)
  const maxN = Math.max(stIni.n, stLalu.n, 1)
  const maxMedian = Math.max(Math.abs(stIni.median ?? 0), Math.abs(stLalu.median ?? 0), 1)
  const maxDiatas = Math.max(stIni.diatas, stLalu.diatas, 1)

  return (
    <div className="bb-isi">
      <div className="bb-dua">
        <Blok kelas="polos" label={`${terbaru.kode} · listing ${tanggalPendek(terbaru.tanggal_listing)}`}>
          <span className={`bb-hero-besar ${arah(terbaru.return_kini)}`}>{bertanda(terbaru.return_kini, 1)}%</span>
          <span className="bb-mono" style={{ color: 'var(--bb-redup)' }}>
            return sejak IPO · Rp{angka(terbaru.harga_ipo, 0)} → Rp{terbaru.close_kini != null ? angka(terbaru.close_kini, 0) : '–'}
          </span>
          <p className="bb-narasi">
            Dana terhimpun {rupiah(terbaru.dana)} dari {angka(terbaru.lembar / 1e9, 2)} miliar lembar.
          </p>
        </Blok>
      </div>

      <div className="bb-dua-rata">
        <Blok label="Garis waktu harga sejak IPO"
          narasi={titik.length > 1 ? `Puncak di ${puncakLabel} (Rp${angka(maxT, 0)}, ${bertanda(puncakReturn, 1)}%)${puncakLabel !== 'kini' ? ', lalu turun dari puncak' : ', masih menguat sejak listing'}; kini ${bertanda(terbaru.return_kini, 1)}% dari harga penawaran.` : undefined}>
          <svg viewBox="0 0 380 100" className="bb-grafik">
            {titik.length > 1 && (
              <polyline points={titik.map((t, i) => `${svgX(i)},${svgY(t.nilai)}`).join(' ')} fill="none" stroke="var(--bb-naik)" strokeWidth={2} />
            )}
            {titik.map((t, i) => (
              <g key={t.label}>
                <circle cx={svgX(i)} cy={svgY(t.nilai)} r={4} fill={i === 0 ? 'var(--bb-teks)' : 'var(--bb-naik)'} />
                <text x={svgX(i)} y={svgY(t.nilai) - 8} fontSize={9} fill="var(--bb-redup)" textAnchor={i === 0 ? 'start' : i === titik.length - 1 ? 'end' : 'middle'}>{angka(t.nilai, 0)}</text>
              </g>
            ))}
          </svg>
          <div className="bb-mono teks-11" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--bb-redup)' }}>
            {titik.map((t) => <span key={t.label}>{t.label}</span>)}
          </div>
        </Blok>

        <Blok label="Penjamin emisi · rekam jejak per horizon"
          narasi={uw ? `${angka(uw.h1d.win * 100, 1)}% menang di +1 hari, turun jadi ${angka(uw.hkini.win * 100, 1)}% sampai kini dari ${uw.n} IPO yang dijamin ${uwNama}; median kini ${bertanda(uw.hkini.median, 1)}%.` : `Rekam jejak ${uwNama} tidak tersedia.`}>
          {uw ? (
            <div className="bb-daftar">
              {([['h1d', '+1 hari'], ['h1w', '+1 minggu'], ['h1m', '+1 bulan'], ['hkini', 'kini']] as const).map(([k, label]) => {
                const h = uw[k]
                return (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '68px minmax(0,1fr) 50px 76px', columnGap: 10, alignItems: 'center' }}>
                    <span className="bb-label" style={k === 'hkini' ? { color: 'var(--bb-teks)', fontWeight: 600 } : undefined}>{label}</span>
                    <span className="bb-bb-rel"><span className={`bb-bb-isi ${k === 'hkini' ? 'emas' : 'biru'}`} style={{ width: `${Math.max(0, Math.min(100, h.win * 100))}%` }} /></span>
                    <span className="bb-mono" style={{ textAlign: 'right' }}>{angka(h.win * 100, 1)}%</span>
                    <span className={`bb-mono ${arah(h.median)}`} style={{ textAlign: 'right', fontSize: 12 }}>med {bertanda(h.median, 1)}</span>
                  </div>
                )
              })}
            </div>
          ) : <Keadaan kosong="tidak tersedia" />}
        </Blok>
      </div>

      <Blok judul={`${delapan.length} IPO terbaru, ${naikDariDelapan} di antaranya masih di atas harga penawaran`} catatan="batang = return sejak IPO, skala sama"
        narasi={`${naikDariDelapan} dari ${delapan.length} IPO terbaru masih di atas harga penawaran.`}>
        <div className="bb-tabel-wrap">
          <table className="bb-tabel">
            <thead><tr><th>Kode</th><th>Emiten</th><th className="kanan">Listing</th><th className="kanan">Hrg IPO</th><th className="kanan">+1 hari</th><th>Batang</th><th className="kanan">Kini</th></tr></thead>
            <tbody>
              {delapan.map((e) => {
                const r = e.return_kini ?? 0
                const w = (Math.abs(r) / maxAbsReturn) * 100
                return (
                  <tr key={e.kode}>
                    <td className="bb-mono"><Link to={ruteLapisan('harga', e.kode)}>{e.kode}</Link></td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nama}</td>
                    <td className="kanan bb-mono" style={{ color: 'var(--bb-redup)' }}>{tglRingkas(e.tanggal_listing)}</td>
                    <td className="kanan bb-mono">{angka(e.harga_ipo, 0)}</td>
                    <td className={`kanan bb-mono ${arah(e.return_1d)}`}>{bertanda(e.return_1d, 1)}%</td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: r >= 0 ? 'flex-start' : 'flex-end', height: 10 }}>
                        <div style={{ width: `${w}%`, height: 10, borderRadius: 2, background: r >= 0 ? 'var(--bb-naik)' : 'var(--bb-turun)' }} />
                      </div>
                    </td>
                    <td className={`kanan bb-mono ${arah(e.return_kini)}`}>{bertanda(e.return_kini, 1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Blok>

      <Blok judul={`IPO ${tahunIni} ${stIni.n < stLalu.n ? 'lebih sedikit' : 'lebih banyak'}, ${(stIni.median ?? 0) > (stLalu.median ?? 0) ? 'lebih untung' : 'lebih rugi'} dari ${tahunLalu}`}
        catatan={`emas = ${tahunIni} · biru = ${tahunLalu}`}
        narasi={`Baru ${stIni.n} emiten listing tahun ini, dibanding ${stLalu.n} di ${tahunLalu} — median return kini ${bertanda(stIni.median, 1)}%, dibanding ${tahunLalu} ${bertanda(stLalu.median, 1)}%. Porsi bertahan di atas harga IPO ${stIni.diatas >= stLalu.diatas ? 'naik' : 'turun'} dari ${angka(stLalu.diatas, 1)}% ke ${angka(stIni.diatas, 1)}%.`}>
        <div className="bb-tabel-wrap">
          <table className="bb-tabel">
            <tbody>
              <tr>
                <td>Jumlah emiten</td>
                <td style={{ width: '50%' }}><div className="bb-bb-rel"><span className="bb-bb-isi emas" style={{ width: `${(stIni.n / maxN) * 100}%` }} /></div></td>
                <td className="kanan bb-mono">{stIni.n}</td>
              </tr>
              <tr>
                <td></td>
                <td><div className="bb-bb-rel"><span className="bb-bb-isi biru" style={{ width: `${(stLalu.n / maxN) * 100}%` }} /></div></td>
                <td className="kanan bb-mono">{stLalu.n}</td>
              </tr>
              <tr>
                <td>Median return kini</td>
                <td><div className="bb-bb-rel"><span className="bb-bb-isi emas" style={{ width: `${(Math.abs(stIni.median ?? 0) / maxMedian) * 100}%` }} /></div></td>
                <td className={`kanan bb-mono ${arah(stIni.median)}`}>{bertanda(stIni.median, 1)}%</td>
              </tr>
              <tr>
                <td></td>
                <td><div className="bb-bb-rel"><span className="bb-bb-isi biru" style={{ width: `${(Math.abs(stLalu.median ?? 0) / maxMedian) * 100}%` }} /></div></td>
                <td className={`kanan bb-mono ${arah(stLalu.median)}`}>{bertanda(stLalu.median, 1)}%</td>
              </tr>
              <tr>
                <td>Masih di atas hrg IPO</td>
                <td><div className="bb-bb-rel"><span className="bb-bb-isi emas" style={{ width: `${(stIni.diatas / maxDiatas) * 100}%` }} /></div></td>
                <td className="kanan bb-mono">{angka(stIni.diatas, 1)}%</td>
              </tr>
              <tr>
                <td></td>
                <td><div className="bb-bb-rel"><span className="bb-bb-isi biru" style={{ width: `${(stLalu.diatas / maxDiatas) * 100}%` }} /></div></td>
                <td className="kanan bb-mono">{angka(stLalu.diatas, 1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="bb-ringkas">
          <div className="bb-ringkas-it"><span className="bb-ringkas-nilai">{stIni.n}</span><span className="bb-ringkas-sub">emiten listing {tahunIni}</span></div>
          <div className="bb-ringkas-it"><span className="bb-ringkas-nilai">{rupiah(stIni.dana)}</span><span className="bb-ringkas-sub">dana terhimpun</span></div>
          <div className="bb-ringkas-it"><span className={`bb-ringkas-nilai ${arah(stIni.median)}`}>{bertanda(stIni.median, 1)}%</span><span className="bb-ringkas-sub">median kini</span></div>
        </div>
      </Blok>

      {!sisip && <KakiBaru sumber={`Harga tak tersesuaikan aksi korporasi. Return kini per ${tanggalPendek(data.tanggal)}, dari statistik resmi bursa.`} />}
    </div>
  )
}
