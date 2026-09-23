import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { angka, bertanda, tanggalPendek } from './data'
import { Hero, Blok, Ringkas, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'
import { ruteLapisan } from './peta'
import {
  layakPersen, muatRaporUji,
  type HorizonStat, type Kelompok, type RaporUji, type SumberRapor,
} from '../../lib/dasbor/raporUji'

/**
 * Layar Rekam — "Rekam Jejak Jujur" (#231, artboard Rekam.dc.html). Sumber:
 * pilihan/sinyal dinilai sesudah kejadian (redaksi, OBV, RBS) dan riset
 * formula luar sampel — keduanya lewat `muatRaporUji()`, dipakai apa adanya
 * oleh `/rapor-uji`. Angka di sini murni memformat; hitungannya di skrip.
 */

const LABEL_SUMBER: Record<Kelompok, { judul: string; catatan: string }> = {
  redaksi: { judul: 'Kurasi manusia', catatan: 'Deep Dive & edisi' },
  obv: { judul: 'Sinyal OBV', catatan: 'indikator harian' },
  rbs: { judul: 'Sinyal RBS', catatan: 'indikator harian' },
}
const LABEL_SINGKAT: Record<Kelompok, string> = { redaksi: 'Redaksi', obv: 'OBV', rbs: 'RBS' }
const LABEL_STATUS: Record<'selesai' | 'menunggu', string> = { selesai: 'Selesai', menunggu: 'Menunggu' }

/** Bentuk nyata `riset` (bt_riset digabung ke rapor_uji saat panen) — dibaca
 *  apa adanya, bukan ditebak; kalau bentuknya beda, kartunya kosong senyap. */
interface ArahRiset { nama: string; lulus: boolean; tahun_lulus: number; tahun_uji: number; kalimat: string }

const fPf = (v: number | null): string => (v == null ? '–' : `${angka(v, 2)}×`)
const fpRet = (v: number | null): string => (v == null ? '–' : `${bertanda(v * 100, 2)}%`)

function nadaVonis(s: HorizonStat, n: number): 'naik' | 'turun' | 'datar' {
  if (n < 30 || s.pf == null) return 'datar'
  if (s.acak_p95_pf != null && s.pf > s.acak_p95_pf) return 'naik'
  if (s.acak_p50_pf != null && s.pf <= s.acak_p50_pf) return 'turun'
  return 'datar'
}

/** Vonis jujur H+5: "belum terbukti lebih baik" selama PF belum melewati persentil-95 acak. */
function vonisJujur(s: HorizonStat, n: number): string {
  if (n < 30) return `Belum bisa disimpulkan: baru ${n} pilihan selesai.`
  if (s.pf == null || s.acak_p95_pf == null) return 'Data belum lengkap untuk dibandingkan dengan acak.'
  return s.pf > s.acak_p95_pf
    ? `Sudah melewati 95% pilihan acak pada tanggal yang sama (ambang ${fPf(s.acak_p95_pf)}).`
    : `Belum terbukti lebih baik dari pilihan acak (ambang persentil 95: ${fPf(s.acak_p95_pf)}).`
}

function winRateTeks(s: HorizonStat, n: number): string {
  return layakPersen(n)
    ? `${angka((s.win_rate ?? 0) * 100, 0)}%`
    : `${Math.round((s.win_rate ?? 0) * n)} dari ${n} — terlalu sedikit`
}

function KartuSumber({ kelompok, sumber }: { kelompok: Kelompok; sumber: SumberRapor }) {
  const s = sumber.h5
  const n = sumber.n_selesai_h5
  const l = LABEL_SUMBER[kelompok]
  return (
    <Blok kelas="panel" label={l.judul} catatan={`${l.catatan} · ${sumber.n_total} tesis`} narasi={vonisJujur(s, n)}>
      <span className={`bb-mono ${nadaVonis(s, n)}`} style={{ fontSize: 30, fontWeight: 700 }}>{fPf(s.pf)}</span>
      <Ringkas items={[
        { label: 'Win rate H+5', nilai: winRateTeks(s, n) },
        { label: 'Rata-rata', nilai: fpRet(s.rata) },
        { label: 'Acak p95 PF', nilai: fPf(s.acak_p95_pf) },
        { label: 'IHSG periode sama', nilai: fpRet(s.ihsg_rata) },
      ]} />
    </Blok>
  )
}

export default function LayarRekam() {
  const [data, setData] = useState<RaporUji | null | undefined>(undefined)

  useEffect(() => {
    let hidup = true
    muatRaporUji().then((d) => { if (hidup) setData(d) })
    return () => { hidup = false }
  }, [])

  if (data === undefined) return <div className="bb-isi"><Keadaan /></div>
  if (data === null) return <div className="bb-isi"><Keadaan kosong="Rekam jejak belum tersedia — angkanya baru muncul sesudah panen mesin menuliskannya." /></div>

  const redaksi = data.sumber.redaksi
  const nRedaksi = redaksi.n_selesai_h5

  const riset = data.riset as unknown as { arah?: ArahRiset[]; riset_sebelumnya?: ArahRiset } | null
  const kartuRiset = [...(riset?.arah ?? []), ...(riset?.riset_sebelumnya ? [riset.riset_sebelumnya] : [])]

  const pilihanTerbaru = [...data.pilihan].reverse().slice(0, 10)

  return (
    <div className="bb-isi">
      <Blok kelas="polos" judul="Setiap tesis dinilai mesin yang sama, manusia maupun sinyal." catatan={`Rekam jejak · data per ${tanggalPendek(data.data_per)}`} />

      <Hero
        label="Profit factor kurasi redaksi · H+5"
        angka={fPf(redaksi.h5.pf)}
        nada={nadaVonis(redaksi.h5, nRedaksi)}
        sub={<span>{vonisJujur(redaksi.h5, nRedaksi)}</span>}
      />

      <Blok label="Tiap sumber, dinilai sama" catatan="pilihan/sinyal H+5 vs pilihan acak di tanggal yang sama">
        <div className="bb-tiga">
          {(['redaksi', 'obv', 'rbs'] as Kelompok[]).map((k) => (
            <KartuSumber key={k} kelompok={k} sumber={data.sumber[k]} />
          ))}
        </div>
      </Blok>

      <Blok label="Riset formula · luar sampel" catatan="lulus = PF luar sampel mengalahkan ambang dan acak di tiap tahun">
        {kartuRiset.length === 0
          ? <Keadaan kosong="Belum ada riset formula tercatat." />
          : (
            <div className="bb-kartu-grid">
              {kartuRiset.map((a, i) => (
                <div key={i} className="bb-kartu">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{a.nama}</span>
                    <span className={`bb-lencana ${a.lulus ? 'naik' : 'turun'}`}>{a.tahun_lulus} dari {a.tahun_uji} tahun</span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--bb-redup)' }}>{a.kalimat}</span>
                </div>
              ))}
            </div>
          )}
      </Blok>

      <Blok label="Pilihan terbaru" catatan="10 tesis terakhir, apa pun sumbernya">
        {pilihanTerbaru.length === 0
          ? <Keadaan kosong="Belum ada pilihan tercatat." />
          : (
            <div className="bb-tabel-wrap">
              <table className="bb-tabel">
                <thead>
                  <tr>
                    <th>Tanggal</th><th>Kode</th><th>Sumber</th>
                    <th className="kanan">Masuk</th><th className="kanan">H+5</th><th className="kanan">H+20</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pilihanTerbaru.map((p, i) => (
                    <tr key={`${p.kode}-${p.tanggal}-${p.sumber}-${i}`}>
                      <td className="bb-mono">{tanggalPendek(p.tanggal)}</td>
                      <td><Link to={ruteLapisan('harga', p.kode)}>{p.kode}</Link></td>
                      <td>{LABEL_SINGKAT[p.sumber]}</td>
                      <td className="kanan bb-mono">{p.masuk == null ? '–' : angka(p.masuk, 0)}</td>
                      <td className="kanan bb-mono">{fpRet(p.h5)}</td>
                      <td className="kanan bb-mono">{fpRet(p.h20)}</td>
                      <td>{LABEL_STATUS[p.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <p className="bb-narasi">Peringkat kontributor, rincian per horizon, dan seluruh riwayat ada di <Link to="/rapor-uji" style={{ fontSize: 13, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Rapor Uji</Link>.</p>
      </Blok>

      <KakiBaru sumber="Pilihan dan sinyal dinilai sesudah kejadian, dibandingkan pilihan acak pada tanggal yang sama dan IHSG." />
    </div>
  )
}
