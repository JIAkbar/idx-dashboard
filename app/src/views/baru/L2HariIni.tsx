import { useJson, angka, bertanda, rupiah, tanggalPendek } from './data'
import { Hero, Blok, BarisBatang, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'
import { ruteLapisan } from './peta'
import { SEKTOR_URUT, normalisasiSektorHarian, labelSektor } from './l2b-sektor'

interface IndeksHarianPapan { diperbarui: string; tanggal_tersedia: string[] }
interface EmitenHarian { kode: string; nama: string; sektor: string; volume: number; nilai: number; chg_1d: number | null }
interface HarianPapan { tanggal: string; n: number; emiten: EmitenHarian[] }

/** Batang tiga warna (naik–tetap–turun). `tinggi` >= 10 ikut cetak legenda
 *  persen di bawahnya; dipakai untuk hero (tebal) dan baris sektor (tipis). */
function TigaWarna({ naik, tetap, turun, total, tinggi = 12 }: { naik: number; tetap: number; turun: number; total: number; tinggi?: number }) {
  if (!total) return null
  const wN = (naik / total) * 100, wT = (tetap / total) * 100, wD = (turun / total) * 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ height: tinggi, borderRadius: 999, background: 'var(--bb-garis)', overflow: 'hidden', display: 'flex' }}>
        <span style={{ display: 'block', width: `${wN}%`, background: 'var(--bb-naik)' }} />
        <span style={{ display: 'block', width: `${wT}%`, background: 'var(--bb-redup)' }} />
        <span style={{ display: 'block', width: `${wD}%`, background: 'var(--bb-turun)' }} />
      </div>
      {tinggi >= 10 && (
        <div className="bb-mono teks-11" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="naik">naik {angka(wN, 1)}%</span>
          <span className="datar">tetap {angka(wT, 1)}%</span>
          <span className="turun">turun {angka(wD, 1)}%</span>
        </div>
      )}
    </div>
  )
}

/** Satu daftar peringkat 10 baris + narasi. `arah` dipakai untuk pewarnaan
 *  batang saat peringkatnya sendiri berarah (naik/turun); untuk peringkat
 *  tak berarah (volume, nilai) baris 01 emas dan sisanya biru. */
function Peringkat({ judul, catatan, baris, arah, narasi }: {
  judul: string
  catatan: string
  baris: { kode: string; nama: string; nilai: string; lebar: number }[]
  arah?: 'naik' | 'turun'
  narasi: string
}) {
  return (
    <Blok judul={judul} catatan={catatan} narasi={baris.length ? narasi : 'Tidak ada data untuk peringkat ini hari ini.'}>
      <div className="bb-daftar">
        {baris.map((b, i) => (
          <BarisBatang
            key={b.kode}
            kode={b.kode}
            nama={b.nama}
            lebar={b.lebar}
            nilai={b.nilai}
            nada={arah}
            warna={arah ?? (i === 0 ? 'emas' : 'biru')}
            ke={ruteLapisan('harga', b.kode)}
          />
        ))}
      </div>
    </Blok>
  )
}

export default function L2HariIni({ sisip = false }: { sisip?: boolean } = {}) {
  const idx = useJson<IndeksHarianPapan>('/data-idx/json/harian_papan/index.json')
  const tanggal = idx.data?.tanggal_tersedia[0] ?? null
  const hp = useJson<HarianPapan>(tanggal ? `/data-idx/json/harian_papan/${tanggal}.json` : null)

  const galat = idx.galat ?? hp.galat
  if (galat) return <Keadaan galat={galat} />
  if (!hp.data) return <Keadaan />

  const emiten = hp.data.emiten
  const total = emiten.length
  const naik = emiten.filter((e) => (e.chg_1d ?? 0) > 0).length
  const turun = emiten.filter((e) => (e.chg_1d ?? 0) < 0).length
  const tetap = total - naik - turun

  const dominan: 'naik' | 'turun' | 'datar' = naik >= turun && naik >= tetap ? 'naik' : turun >= tetap ? 'turun' : 'datar'
  const angkaDominan = dominan === 'naik' ? naik : dominan === 'turun' ? turun : tetap
  const labelDominan = dominan === 'datar' ? 'tetap' : dominan

  const bySektor = new Map<string, { naik: number; tetap: number; turun: number }>()
  for (const s of SEKTOR_URUT) bySektor.set(s.id, { naik: 0, tetap: 0, turun: 0 })
  for (const e of emiten) {
    const id = normalisasiSektorHarian(e.sektor)
    const b = id ? bySektor.get(id) : undefined
    if (!b) continue
    if ((e.chg_1d ?? 0) > 0) b.naik++
    else if ((e.chg_1d ?? 0) < 0) b.turun++
    else b.tetap++
  }
  const sektorBaris = SEKTOR_URUT.map((s) => {
    const b = bySektor.get(s.id)!
    const t = b.naik + b.tetap + b.turun
    return { id: s.id, label: s.label, ...b, total: t, persenTurun: t ? (b.turun / t) * 100 : 0 }
  }).filter((s) => s.total > 0)
  const sektorTerburuk = sektorBaris.reduce((a, b) => (b.persenTurun > a.persenTurun ? b : a), sektorBaris[0])
  const sektorTerbaik = sektorBaris.reduce((a, b) => (b.persenTurun < a.persenTurun ? b : a), sektorBaris[0])

  const naikTerbesar = emiten.filter((e) => (e.chg_1d ?? 0) > 0).sort((a, b) => b.chg_1d! - a.chg_1d!).slice(0, 10)
  const turunTerbesar = emiten.filter((e) => (e.chg_1d ?? 0) < 0).sort((a, b) => a.chg_1d! - b.chg_1d!).slice(0, 10)
  const volumeTerbesar = [...emiten].sort((a, b) => b.volume - a.volume).slice(0, 10)
  const nilaiTerbesar = [...emiten].sort((a, b) => b.nilai - a.nilai).slice(0, 10)

  return (
    <div className="bb-isi">
      <div className="bb-dua">
        <div className="bb-kolom">
          <Hero
            label={`Pergerakan harian · ${angka(total)} emiten`}
            angka={angka(angkaDominan)}
            satuan={labelDominan}
            nada={dominan}
            sub={`${angka(naik)} naik · ${angka(tetap)} tetap · ${angka(turun)} turun dari ${angka(total)} emiten`}
          />
          <Blok narasi={`${turun} dari ${total} emiten melemah hari ini (${angka(total ? (turun / total) * 100 : 0, 1)}%), ${naik} menguat, ${tetap} tak berubah.`}>
            <TigaWarna naik={naik} tetap={tetap} turun={turun} total={total} />
          </Blok>
          <Blok
            label="Sebaran per sektor · naik–tetap–turun"
            narasi={sektorBaris.length ? `${labelSektor(sektorTerburuk.id)} paling banyak turun secara proporsi (${angka(sektorTerburuk.persenTurun, 0)}%); ${labelSektor(sektorTerbaik.id)} paling tahan (${angka(sektorTerbaik.persenTurun, 0)}%).` : undefined}
          >
            <div className="bb-daftar">
              {sektorBaris.map((s) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(84px,140px) minmax(0,1fr) 36px', columnGap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--bb-redup)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                  <TigaWarna naik={s.naik} tetap={s.tetap} turun={s.turun} total={s.total} tinggi={8} />
                  <span className="bb-mono teks-11" style={{ textAlign: 'right' }}>{angka(s.persenTurun, 0)}%</span>
                </div>
              ))}
            </div>
          </Blok>
        </div>

        <div className="bb-dua-rata">
          <Peringkat
            judul="Naik terbesar"
            catatan="% hari ini"
            arah="naik"
            baris={naikTerbesar.map((e) => ({ kode: e.kode, nama: e.nama, nilai: `${bertanda(e.chg_1d, 2)}%`, lebar: (e.chg_1d! / naikTerbesar[0].chg_1d!) * 100 }))}
            narasi={`${naikTerbesar[0]?.kode ?? '–'} memimpin kenaikan hari ini, ${bertanda(naikTerbesar[0]?.chg_1d ?? null, 2)}%.`}
          />
          <Peringkat
            judul="Turun terbesar"
            catatan="% hari ini"
            arah="turun"
            baris={turunTerbesar.map((e) => ({ kode: e.kode, nama: e.nama, nilai: `${bertanda(e.chg_1d, 2)}%`, lebar: (Math.abs(e.chg_1d!) / Math.abs(turunTerbesar[0].chg_1d!)) * 100 }))}
            narasi={`${turunTerbesar[0]?.kode ?? '–'} paling tertekan hari ini, ${bertanda(turunTerbesar[0]?.chg_1d ?? null, 2)}%.`}
          />
          <Peringkat
            judul="Volume terbesar"
            catatan="juta lembar"
            baris={volumeTerbesar.map((e) => ({ kode: e.kode, nama: e.nama, nilai: angka(e.volume / 1e6, 1), lebar: (e.volume / volumeTerbesar[0].volume) * 100 }))}
            narasi={`${volumeTerbesar[0]?.kode ?? '–'} diperdagangkan ${angka((volumeTerbesar[0]?.volume ?? 0) / 1e6, 1)} juta lembar, terbanyak hari ini.`}
          />
          <Peringkat
            judul="Nilai transaksi terbesar"
            catatan="rupiah"
            baris={nilaiTerbesar.map((e) => ({ kode: e.kode, nama: e.nama, nilai: rupiah(e.nilai), lebar: (e.nilai / nilaiTerbesar[0].nilai) * 100 }))}
            narasi={`${nilaiTerbesar[0]?.kode ?? '–'} mencatat nilai transaksi terbesar hari ini, ${rupiah(nilaiTerbesar[0]?.nilai ?? null)}.`}
          />
        </div>
      </div>

      {!sisip && <KakiBaru sumber={`Peringkat harian dari statistik resmi bursa, ${tanggalPendek(hp.data.tanggal)}, ${total} emiten dengan data lengkap.`} />}
    </div>
  )
}
