import { useParams } from 'react-router-dom'
import { useJson, angka, bertanda } from './data'
import { Blok, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'
import { EMITEN_BAWAAN } from './peta'
import { PilihEmiten } from './l3-pilih'

interface MusimanKartu {
  n: number; naik: number; mentah: number; tersusut: number; bawah: number; atas: number
  median: number; dasar: number; total_bulan: number
}
interface Kartu { tgl: string; musiman?: MusimanKartu }
type SeriImbal = Record<string, Record<string, number>>
interface IhsgBulanan { mulai: string; akhir: string; imbal: Record<string, number> }

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
const BANDING = ['BBRI', 'BMRI', 'TLKM']

interface StatBulan { n: number; naikPct: number; avg: number }
function statBulan(seri: Record<string, number> | undefined, bulan: number): StatBulan | null {
  if (!seri) return null
  const nilai = Object.entries(seri).filter(([ym]) => Number(ym.slice(5, 7)) === bulan).map(([, v]) => v)
  if (nilai.length === 0) return null
  const naik = nilai.filter((v) => v > 0).length
  return { n: nilai.length, naikPct: (naik / nilai.length) * 100, avg: nilai.reduce((a, b) => a + b, 0) / nilai.length }
}

/** Kunci YYYY-MM paling awal dan jumlah bulan sebuah seri. */
function sampel(seri: Record<string, number> | undefined): { mulai: string; n: number } | null {
  if (!seri) return null
  const kunci = Object.keys(seri).sort()
  if (kunci.length === 0) return null
  return { mulai: kunci[0], n: kunci.length }
}

function labelBulanTahun(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${BULAN_PENDEK[m - 1]} ${y}`
}

/** `kodeTetap` + `sisip`: dipakai Seasonality (tab Bulanan) di tampilan Baru
 *  (#228) — kode datang dari halaman induk, tanpa pemilih emiten sendiri. */
export default function L3Musiman({ kodeTetap, sisip = false }: { kodeTetap?: string; sisip?: boolean } = {}) {
  const { kode: kodeParam } = useParams<{ kode: string }>()
  const kode = (kodeTetap ?? kodeParam ?? EMITEN_BAWAAN).toUpperCase()
  const huruf = kode[0]

  const kartu = useJson<Kartu>(`/data-idx/json/kartu/${kode}.json`)
  const utama = useJson<SeriImbal>(`/data-idx/json/seasonality/imbal_${huruf}.json`)
  const seriB = useJson<SeriImbal>('/data-idx/json/seasonality/imbal_B.json')
  const seriT = useJson<SeriImbal>('/data-idx/json/seasonality/imbal_T.json')
  const ihsg = useJson<IhsgBulanan>('/data-idx/json/seasonality/ihsg_bulanan.json')

  const galat = kartu.galat || utama.galat || seriB.galat || seriT.galat || ihsg.galat
  if (galat) return <Keadaan galat={galat} />
  if (!kartu.data || !utama.data || !seriB.data || !seriT.data || !ihsg.data) return <Keadaan />

  const seriUntuk = (kd: string): Record<string, number> | undefined => {
    if (kd === kode) return utama.data?.[kd]
    if (kd[0] === 'B') return seriB.data?.[kd]
    if (kd[0] === 'T') return seriT.data?.[kd]
    return undefined
  }
  const seriKode = seriUntuk(kode)
  const musiman = kartu.data.musiman
  if (!musiman) return <Keadaan kosong={`Belum cukup riwayat musiman untuk ${kode}.`} />

  const bulanIni = Number(kartu.data.tgl.slice(5, 7))
  const namaBandingList = BANDING.filter((k) => k !== kode)
  const daftarTicker = [kode, ...namaBandingList]

  // Rentang historis bulan berjalan (min/max, bukan CI) untuk narasi.
  const nilaiBulanIni = seriKode ? Object.entries(seriKode).filter(([ym]) => Number(ym.slice(5, 7)) === bulanIni).map(([, v]) => v) : []
  const minBulanIni = nilaiBulanIni.length ? Math.min(...nilaiBulanIni) : null
  const maxBulanIni = nilaiBulanIni.length ? Math.max(...nilaiBulanIni) : null
  const lebarRentang = minBulanIni != null && maxBulanIni != null ? maxBulanIni - minBulanIni : 0

  // Kalender 12 bulan.
  const statKode12 = Array.from({ length: 12 }, (_, i) => statBulan(seriKode, i + 1))
  const statIhsg12 = Array.from({ length: 12 }, (_, i) => statBulan(ihsg.data!.imbal, i + 1))
  const maxAbsAvg = Math.max(...statKode12.map((s) => (s ? Math.abs(s.avg) : 0)), 0.01)
  const maxAbsBar = Math.max(...statKode12.map((s) => (s ? Math.abs(s.avg) : 0)), ...statIhsg12.map((s) => (s ? Math.abs(s.avg) : 0)), 0.01)

  const menangCount = statKode12.filter((s, i) => s && statIhsg12[i] && s.avg > statIhsg12[i]!.avg).length
  let bulanTerkuatKode = 0
  let bulanTerkuatIhsg = 0
  statKode12.forEach((s, i) => { if (s && (statKode12[bulanTerkuatKode]?.avg ?? -Infinity) < s.avg) bulanTerkuatKode = i })
  statIhsg12.forEach((s, i) => { if (s && (statIhsg12[bulanTerkuatIhsg]?.avg ?? -Infinity) < s.avg) bulanTerkuatIhsg = i })

  // Bulan mendatang: dua bulan setelah bulan berjalan.
  const depan1 = (bulanIni % 12) + 1
  const depan2 = (depan1 % 12) + 1
  const barisMendatang = daftarTicker.map((kd) => ({
    kode: kd,
    s1: statBulan(seriUntuk(kd), depan1),
    s2: statBulan(seriUntuk(kd), depan2),
  }))
  const lebihSeringDi2 = barisMendatang.filter((b) => b.s1 && b.s2 && b.s2.naikPct > b.s1.naikPct).length
  let bedaTerbesar = barisMendatang[0]
  barisMendatang.forEach((b) => {
    if (b.s1 && b.s2 && (!bedaTerbesar.s1 || !bedaTerbesar.s2 || Math.abs(b.s2.naikPct - b.s1.naikPct) > Math.abs(bedaTerbesar.s2!.naikPct - bedaTerbesar.s1!.naikPct))) bedaTerbesar = b
  })

  const sampelTicker = daftarTicker.map((kd) => ({ kode: kd, s: sampel(seriUntuk(kd)) }))
  const sampelIhsg = { mulai: ihsg.data!.mulai, n: Object.keys(ihsg.data!.imbal).length }

  return (
    <div className="bb-isi">
      {!sisip && <PilihEmiten slug="musiman" />}

      <div className="bb-dua">
        <Blok kelas="polos panel" label={`Bulan berjalan · ${NAMA_BULAN[bulanIni - 1]}, ${musiman.n} tahun`}
          narasi={minBulanIni != null && maxBulanIni != null
            ? `${NAMA_BULAN[bulanIni - 1]} historis condong ${musiman.mentah >= 50 ? 'naik' : 'turun'}; rentang historisnya ${lebarRentang > 15 ? 'lebar' : 'sempit'}, ${bertanda(minBulanIni, 1)}% sampai ${bertanda(maxBulanIni, 1)}%.`
            : undefined}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className={`bb-hero-besar ${musiman.mentah >= 50 ? 'naik' : 'turun'}`} style={{ fontSize: 'clamp(44px,6vw,72px)' }}>{angka(musiman.mentah, 1)}%</span>
            <span className="bb-mono" style={{ color: 'var(--bb-redup)' }}>{musiman.mentah >= 50 ? 'naik' : 'turun'}</span>
          </div>
          <span className="bb-mono" style={{ color: 'var(--bb-redup)', fontSize: 14 }}>
            {musiman.naik} dari {musiman.n} tahun {NAMA_BULAN[bulanIni - 1].toLowerCase()} naik · median {bertanda(musiman.median, 2)}%
          </span>
          <span className="bb-label" style={{ marginTop: 8 }}>Selang kepercayaan kartu musiman</span>
          <div style={{ position: 'relative', height: 10, borderRadius: 999, background: 'var(--bb-garis)' }}>
            <span style={{ position: 'absolute', left: `${musiman.bawah}%`, top: 0, height: 10, width: `${musiman.atas - musiman.bawah}%`, borderRadius: 999, background: 'var(--bb-biru)' }} />
            <span style={{ position: 'absolute', left: `${musiman.tersusut}%`, top: -5, width: 4, height: 20, marginLeft: -2, borderRadius: 2, background: 'var(--bb-emas)' }} />
          </div>
          <div className="bb-mono teks-11" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--bb-redup)' }}>
            <span>{angka(musiman.bawah, 1)}%</span><span>titik saat ini {angka(musiman.tersusut, 1)}%</span><span>{angka(musiman.atas, 1)}%</span>
          </div>
        </Blok>

        <Blok kelas="polos panel" label="Kalender musiman 12 bulan · rata-rata imbal · % naik · n tahun">
          <div className="bb-kartu-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 92px), 1fr))' }}>
            {statKode12.map((s, i) => (
              <div key={i} className={`bb-kartu${i + 1 === bulanIni ? ' sorot' : ''}`} style={{ padding: 12, gap: 4 }}>
                <span className="bb-label" style={i + 1 === bulanIni ? { color: 'var(--bb-emas)' } : undefined}>
                  {BULAN_PENDEK[i]}{i + 1 === bulanIni ? ' · kini' : ''}
                </span>
                <span className={`bb-mono ${s ? (s.avg >= 0 ? 'naik' : 'turun') : ''}`} style={{ fontSize: 15 }}>{s ? bertanda(s.avg, 2) : '–'}%</span>
                <span className="teks-11" style={{ color: 'var(--bb-redup)' }}>{s ? `${angka(s.naikPct, 1)}% · n${s.n}` : 'tidak tersedia'}</span>
                <div className="bb-bb-rel" style={{ height: 5 }}>
                  <span className={`bb-bb-isi ${s && s.avg < 0 ? 'turun' : 'naik'}`} style={{ width: `${s ? (Math.abs(s.avg) / maxAbsAvg) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Blok>
      </div>

      <div className="bb-dua">
        <Blok kelas="panel" judul={`${kode} vs IHSG · rata-rata imbal per bulan`} catatan="biru/emas naik · merah turun · abu IHSG"
          narasi={`${menangCount} dari 12 bulan ${kode} mengalahkan IHSG rata-rata; ${BULAN_PENDEK[bulanTerkuatKode]} paling kuat untuk ${kode} (${statKode12[bulanTerkuatKode] ? bertanda(statKode12[bulanTerkuatKode]!.avg, 2) : '–'}%), ${BULAN_PENDEK[bulanTerkuatIhsg]} paling kuat untuk IHSG (${statIhsg12[bulanTerkuatIhsg] ? bertanda(statIhsg12[bulanTerkuatIhsg]!.avg, 2) : '–'}%).`}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, height: 140 }}>
            {statKode12.map((sK, i) => {
              const sI = statIhsg12[i]
              const hK = sK ? Math.max(0.5, (Math.abs(sK.avg) / maxAbsBar) * 60) : 0
              const hI = sI ? Math.max(0.5, (Math.abs(sI.avg) / maxAbsBar) * 60) : 0
              const kini = i + 1 === bulanIni
              return (
                <div key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderLeft: kini ? '1px solid var(--bb-emas)' : undefined, borderRight: kini ? '1px solid var(--bb-emas)' : undefined }}>
                  <div style={{ height: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }}>
                    {sK && sK.avg >= 0 && <div style={{ width: 8, height: hK, background: kini ? 'var(--bb-emas)' : 'var(--bb-biru)', borderRadius: '2px 2px 0 0' }} />}
                    {sI && sI.avg >= 0 && <div style={{ width: 8, height: hI, background: 'var(--bb-redup)', borderRadius: '2px 2px 0 0' }} />}
                  </div>
                  <div style={{ height: 70, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 3 }}>
                    {sK && sK.avg < 0 && <div style={{ width: 8, height: hK, background: 'var(--bb-turun)', borderRadius: '0 0 2px 2px' }} />}
                    {sI && sI.avg < 0 && <div style={{ width: 8, height: hI, background: 'var(--bb-redup)', borderRadius: '0 0 2px 2px' }} />}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="bb-mono teks-11" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--bb-redup)' }}>
            {BULAN_PENDEK.map((b) => <span key={b}>{b}</span>)}
          </div>
        </Blok>

        <Blok kelas="panel" label={`Bulan mendatang · ${NAMA_BULAN[depan1 - 1]} & ${NAMA_BULAN[depan2 - 1]}`}
          narasi={`${lebihSeringDi2 >= barisMendatang.length - 1 && lebihSeringDi2 > 0 ? `Sebagian besar lebih sering naik di ${NAMA_BULAN[depan2 - 1]}` : `Frekuensi naik antar ${NAMA_BULAN[depan1 - 1]} dan ${NAMA_BULAN[depan2 - 1]} bervariasi antar emiten`}${bedaTerbesar.s1 && bedaTerbesar.s2 ? `; ${bedaTerbesar.kode} paling tajam bedanya, ${angka(bedaTerbesar.s1.naikPct, 1)}% ke ${angka(bedaTerbesar.s2.naikPct, 1)}%.` : '.'}`}>
          <div className="bb-tabel-wrap">
            <table className="bb-tabel">
              <thead><tr><th></th><th>{BULAN_PENDEK[depan1 - 1]}: %naik / median</th><th>{BULAN_PENDEK[depan2 - 1]}: %naik / median</th></tr></thead>
              <tbody>
                {barisMendatang.map((b) => (
                  <tr key={b.kode}>
                    <td className="bb-mono" style={{ fontWeight: 600 }}>{b.kode}</td>
                    <td className={`bb-mono ${b.s1 ? (b.s1.avg >= 0 ? 'naik' : 'turun') : ''}`}>{b.s1 ? `${angka(b.s1.naikPct, 1)}% / ${bertanda(b.s1.avg, 2)}%` : 'tidak tersedia'}</td>
                    <td className={`bb-mono ${b.s2 ? (b.s2.avg >= 0 ? 'naik' : 'turun') : ''}`}>{b.s2 ? `${angka(b.s2.naikPct, 1)}% / ${bertanda(b.s2.avg, 2)}%` : 'tidak tersedia'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Blok>
      </div>

      <Blok kelas="panel" label="Catatan sampel"
        narasi={`${sampelTicker.map((t) => t.s ? `${t.kode} sejak ${labelBulanTahun(t.s.mulai)} (${t.s.n} bulan)` : `${t.kode} tidak tersedia`).join(' · ')} · IHSG sejak ${labelBulanTahun(sampelIhsg.mulai)} (${sampelIhsg.n} bulan). Musiman di sini adalah frekuensi historis, bukan peluang — pola bisa berubah kapan saja.`} />

      {!sisip && <KakiBaru sumber={`Imbal bulanan historis data bursa. Bulan berjalan (${NAMA_BULAN[bulanIni - 1]}) memuat data belum lengkap.`} />}
    </div>
  )
}
