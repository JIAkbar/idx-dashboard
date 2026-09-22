import { useDsTerbaru, angka, bertanda, rupiah, tanggalPendek, arah } from './data'
import { Hero, Blok, BarisBatang, Ringkas, Rentang, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'

interface DsIndeks {
  date_iso: string
  ihsg_value: number
  ihsg_change: number
  ihsg_pct: number
  ihsg_high: number
  ihsg_low: number
  vol_today: number
  val_idr_today: number
  freq_today: number
  mcap_idr: number
  avg_val_idr: number
  nf_today_idr: number
  nf_ytd_idr: number
  mkt_per: number
  mkt_pbv: number
  board: { n: string; v: number; d: number; ytd: number }[]
  sectors: { n: string; v: number; d: number; ytd: number }[]
  world: { r: string; c: string; v: number; d: number; ytd: number; is_idx: boolean }[]
  leaders_today: { c: string; p: number; ih: number }[]
  laggards_today: { c: string; p: number; ih: number }[]
}

const NAMA_PAPAN: Record<string, string> = {
  'Main Board': 'Utama',
  'Development Board': 'Pengembangan',
  'Acceleration Board': 'Akselerasi',
}

const NAMA_SEKTOR: Record<string, string> = {
  Energy: 'Energi',
  'Basic Materials': 'Bahan baku',
  Industrials: 'Industri',
  'Consumer Non-Cyclicals': 'Konsumer primer',
  'Consumer Cyclicals': 'Konsumer sekunder',
  Healthcare: 'Kesehatan',
  Financials: 'Keuangan',
  'Properties & Real Estate': 'Properti',
  Technology: 'Teknologi',
  Infrastructures: 'Infrastruktur',
  'Transportation & Logistic': 'Transportasi',
}
function namaSektor(n: string): string {
  const bersih = n.replace(/^\[.\]\s*/, '')
  return NAMA_SEKTOR[bersih] ?? bersih
}

const NAMA_NEGARA: Record<string, string> = { Japan: 'Jepang', Philippines: 'Filipina', Singapore: 'Singapura' }
function namaNegara(c: string): string { return NAMA_NEGARA[c] ?? c }

export default function L2Indeks() {
  const { data: d, tanggal, galat } = useDsTerbaru<DsIndeks>()
  if (!d || !tanggal) return <Keadaan galat={galat} />

  const posisiRentang = ((d.ihsg_value - d.ihsg_low) / (d.ihsg_high - d.ihsg_low || 1)) * 100

  const papanNaik = d.board.filter((b) => b.ytd > 0).map((b) => NAMA_PAPAN[b.n] ?? b.n)
  const papanNarasi = papanNaik.length === 0
    ? 'Tak satu pun papan pencatatan naik sejak Januari.'
    : papanNaik.length === d.board.length
      ? 'Ketiga papan pencatatan naik sejak Januari.'
      : `Hanya papan ${papanNaik.join(' dan ')} yang naik sejak Januari.`

  const sektorUrut = [...d.sectors].sort((a, b) => a.d - b.d)
  const maxAbsD = Math.max(1, ...sektorUrut.map((s) => Math.abs(s.d)))
  const turunHariIni = d.sectors.filter((s) => s.d < 0).length
  const turunYtd = d.sectors.filter((s) => s.ytd < 0).length
  const terbaikYtd = d.sectors.reduce((a, b) => (b.ytd > a.ytd ? b : a))
  const terburukYtd = d.sectors.reduce((a, b) => (b.ytd < a.ytd ? b : a))
  const sektorNarasi = `${turunYtd} dari ${d.sectors.length} sektor turun sejak Januari — ${namaSektor(terbaikYtd.n)} paling tahan (${bertanda(terbaikYtd.ytd, 1)}%), ${namaSektor(terburukYtd.n)} paling dalam (${bertanda(terburukYtd.ytd, 1)}%). Hari ini ${turunHariIni} dari ${d.sectors.length} sektor merah.`

  const maxIh = Math.max(1, ...d.laggards_today.map((x) => Math.abs(x.ih)), ...d.leaders_today.map((x) => Math.abs(x.ih)))
  const top2 = d.ihsg_change < 0 ? d.laggards_today.slice(0, 2) : d.leaders_today.slice(0, 2)
  const sumTop2 = top2.reduce((s, x) => s + Math.abs(x.ih), 0)
  const gerakNarasi = `${top2.map((x) => x.c).join(' dan ')} ${d.ihsg_change < 0 ? 'menahan' : 'mendorong'} ${angka(sumTop2, 0)} dari ${angka(Math.abs(d.ihsg_change), 0)} poin pergerakan indeks hari ini.`

  const dunia = d.world.filter((w) => w.r === 'ASEAN' || w.r === 'Asia Pacific').sort((a, b) => b.ytd - a.ytd)
  const maxAbsYtdDunia = Math.max(1, ...dunia.map((w) => Math.abs(w.ytd)))
  const rankIndonesia = dunia.findIndex((w) => w.is_idx) + 1
  const idn = dunia.find((w) => w.is_idx)
  const duniaNarasi = idn
    ? `Bursa Indonesia peringkat ${rankIndonesia} dari ${dunia.length} bursa Asia yang dipantau (${bertanda(idn.ytd, 1)}% sejak Januari).`
    : 'Peringkat Indonesia tidak tersedia.'

  return (
    <div className="bb-isi">
      <div className="bb-tanggal" style={{ textAlign: 'right' }}>Statistik resmi bursa · {tanggalPendek(tanggal)} · penutupan</div>
      <div className="bb-dua">
        <div className="bb-kolom">
          <Hero
            label="IHSG"
            angka={angka(d.ihsg_value, 2)}
            nada={arah(d.ihsg_change)}
            sub={<><span>{bertanda(d.ihsg_change, 2)}</span><span>{bertanda(d.ihsg_pct, 2)}%</span></>}
          />
          <Blok kelas="polos">
            <Rentang kiri={`terendah ${angka(d.ihsg_low, 0)}`} kanan={`tertinggi ${angka(d.ihsg_high, 0)}`} posisi={posisiRentang} nada={arah(d.ihsg_change)} />
            <p className="bb-narasi">Bergerak antara {angka(d.ihsg_low, 0)} dan {angka(d.ihsg_high, 0)} sepanjang hari, ditutup {angka(posisiRentang, 0)}% dari dasar rentang.</p>
          </Blok>
          <Blok kelas="polos">
            <Ringkas items={[
              { label: 'Nilai transaksi', nilai: rupiah(d.val_idr_today * 1e9), sub: `rata-rata tahun ini ${rupiah(d.avg_val_idr * 1e9)}` },
              { label: 'Asing bersih', nilai: rupiah(d.nf_today_idr * 1e9), nada: arah(d.nf_today_idr), sub: `sejak Januari ${rupiah(d.nf_ytd_idr * 1e9)}` },
              { label: 'Kapitalisasi', nilai: `Rp ${angka(d.mcap_idr, 0)} T`, sub: `PER ${angka(d.mkt_per, 2)}× · PBV ${angka(d.mkt_pbv, 2)}×` },
              { label: 'Frekuensi', nilai: `${angka(d.freq_today / 1000, 2)} juta`, sub: `${angka(d.vol_today / 1000, 1)} miliar lembar` },
            ]} />
          </Blok>
          <Blok label="Per papan pencatatan · hari ini · sejak Januari" narasi={papanNarasi}>
            <div className="bb-daftar">
              {d.board.map((b) => (
                <div key={b.n} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 70px', alignItems: 'baseline', fontSize: 14, gap: 12 }}>
                  <span>{NAMA_PAPAN[b.n] ?? b.n}</span>
                  <span className={`bb-mono ${arah(b.d)}`} style={{ textAlign: 'right' }}>{bertanda(b.d, 2)}</span>
                  <span className={`bb-mono ${arah(b.ytd)}`} style={{ textAlign: 'right', fontSize: 12 }}>{bertanda(b.ytd, 1)}</span>
                </div>
              ))}
            </div>
          </Blok>
        </div>

        <div className="bb-kolom">
          <Blok judul={`${turunYtd} dari ${d.sectors.length} sektor merah sejak Januari`} catatan="batang = hari ini · kolom kanan = sejak Januari" narasi={sektorNarasi}>
            <div className="bb-daftar">
              {sektorUrut.map((s, i) => (
                <div key={s.n} className="bb-bb" style={{ gridTemplateColumns: '28px minmax(0,1.3fr) minmax(0,1fr) 60px 64px' }}>
                  <span className="bb-bb-kode">{String(i + 1).padStart(2, '0')}</span>
                  <span className="bb-bb-nama">{namaSektor(s.n)}</span>
                  <span className="bb-bb-rel"><span className={`bb-bb-isi ${s.d >= 0 ? 'naik' : 'turun'}`} style={{ width: `${(Math.abs(s.d) / maxAbsD) * 100}%` }} /></span>
                  <span className={`bb-bb-nilai ${arah(s.d)}`}>{bertanda(s.d, 2)}</span>
                  <span className="bb-bb-nilai" style={{ color: 'var(--bb-redup)', fontSize: 12 }}>{bertanda(s.ytd, 1)}%</span>
                </div>
              ))}
            </div>
          </Blok>

          <div className="bb-dua-rata">
            <Blok label="Pemberat indeks · poin">
              <div className="bb-daftar">
                {d.laggards_today.slice(0, 4).map((x) => (
                  <BarisBatang key={x.c} kode={x.c} lebar={(Math.abs(x.ih) / maxIh) * 100} nilai={bertanda(x.ih, 2)} warna="turun" nada="turun" />
                ))}
              </div>
            </Blok>
            <Blok label="Penggerak indeks · poin · skala sama">
              <div className="bb-daftar">
                {d.leaders_today.slice(0, 4).map((x) => (
                  <BarisBatang key={x.c} kode={x.c} lebar={(Math.abs(x.ih) / maxIh) * 100} nilai={bertanda(x.ih, 2)} warna="naik" nada="naik" />
                ))}
              </div>
            </Blok>
          </div>
          <p className="bb-narasi">{gerakNarasi}</p>

          <Blok label="Dibanding tetangga · sejak Januari" narasi={duniaNarasi}>
            <div className="bb-daftar">
              {dunia.map((w, i) => (
                <BarisBatang
                  key={w.c}
                  kode={String(i + 1).padStart(2, '0')}
                  nama={namaNegara(w.c)}
                  lebar={(Math.abs(w.ytd) / maxAbsYtdDunia) * 100}
                  nilai={`${bertanda(w.ytd, 1)}%`}
                  warna={w.is_idx ? 'emas' : w.ytd >= 0 ? 'naik' : 'turun'}
                />
              ))}
            </div>
          </Blok>
        </div>
      </div>

      <KakiBaru sumber="Statistik harian resmi bursa. Sektor mengikuti klasifikasi resmi 11 sektor. Nilai dalam rupiah; T = triliun, M = miliar." />
    </div>
  )
}
