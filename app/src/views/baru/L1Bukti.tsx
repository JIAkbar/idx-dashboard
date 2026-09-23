import { Fragment } from 'react'
import { useDsTerbaru, useJson, angka, bertanda, rupiah, tanggalPendek, arah } from './data'
import { Hero, Blok, BarisBatang, Keadaan } from './ui'
import { KakiBaru } from './KakiBaru'
import { ruteLapisan } from './peta'
import { Link } from 'react-router-dom'

interface Sektor { n: string; v: number; d: number; ytd: number }
interface Papan { n: string; v: number; d: number; ytd: number }
interface Kontributor { c: string; p: number; ih: number }
interface Ds {
  ihsg_value: number; ihsg_change: number; ihsg_pct: number; ihsg_prev: number
  trading_day: number
  nf_today_idr: number; nf_ytd_idr: number
  laggards_today: Kontributor[]; leaders_today: Kontributor[]
  sectors: Sektor[]; board: Papan[]
}

interface KabarItem { sumber: string; judul: string; tautan: string; waktu: string; kanal?: string }
interface Kabar { item: KabarItem[] }

interface KandidatEmiten { kode: string; skor: number; sinyal: { nama: string; bukti: string }[] }
interface KandidatDeepdive { ambang: { skor_min: number }; emiten: KandidatEmiten[] }

interface RekomendasiSaham {
  kode: string; close: number; skor: number
  ringkas: { fd: string; label_accdist: string | null }
}
interface RekomendasiPreset { preset: string; saham: RekomendasiSaham[] }
interface Rekomendasi { presets: RekomendasiPreset[] }

function labelPreset(preset: string, accdist: string | null): string {
  if (preset === 'whale-tiket') return 'Tiket whale besar'
  if (preset === 'whale-akdis') return accdist === 'Acc' ? 'Akumulasi whale' : accdist === 'Dist' ? 'Distribusi whale' : 'Pola whale'
  if (preset === 'whale-asing') return 'Arus asing besar'
  return preset
}

const PAPAN_LABEL: Record<string, string> = {
  'Main Board': 'Utama',
  'Development Board': 'Pengembangan',
  'Acceleration Board': 'Akselerasi',
}

/** `sisip`: dipakai Winrate PAPAN di tampilan Baru (#228) — kaki sendiri disembunyikan. */
export default function L1Bukti({ sisip = false }: { sisip?: boolean } = {}) {
  const ds = useDsTerbaru<Ds>()
  const kabar = useJson<Kabar>('/data-idx/json/kabar.json')
  const kandidat = useJson<KandidatDeepdive>('/data-idx/json/kandidat_deepdive.json')
  const rekomendasi = useJson<Rekomendasi>(ds.tanggal ? `/data-idx/json/rekomendasi/${ds.tanggal}.json` : null)

  if (!ds.data) return <Keadaan galat={ds.galat} />
  const d = ds.data
  const turun = d.ihsg_change < 0
  const kataArah = turun ? 'turun' : 'naik'
  const kontributor = (turun ? d.laggards_today : d.leaders_today).slice(0, 2)
  const maxIh = Math.max(1, ...kontributor.map((k) => Math.abs(k.ih)))
  const sumKontributor = kontributor.reduce((s, k) => s + Math.abs(k.ih), 0)

  const rataHarian = d.nf_ytd_idr / Math.max(1, d.trading_day)
  const porsiAsing = rataHarian !== 0 ? Math.min(100, Math.abs((d.nf_today_idr / rataHarian) * 100)) : 0

  const sektorUrut = [...d.sectors].sort((a, b) => a.d - b.d)
  const sektorLemah = sektorUrut[0]
  const sektorKuat = sektorUrut[sektorUrut.length - 1]
  const bersihkanNama = (n: string) => n.replace(/^\[.\]\s*/, '')

  const kabarIhsg = (kabar.data?.item ?? [])
    .filter((k) => k.judul.toUpperCase().includes('IHSG'))
    .slice(0, 5)

  const kandidatKartu = (kandidat.data?.emiten ?? [])
    .slice(0, 3)
    .map((e) => ({
      kode: e.kode,
      judul: `${e.kode} — ${e.sinyal[0]?.nama ?? 'terdeteksi radar'}`,
      sub: `skor ${angka(e.skor)} · ${e.sinyal[0]?.bukti ?? ''}`,
    }))
  const presetKartu = (rekomendasi.data?.presets ?? [])
    .filter((p) => ['whale-tiket', 'whale-akdis', 'whale-asing'].includes(p.preset))
    .map((p) => p.saham[0] && { p, s: p.saham[0] })
    .filter((x): x is { p: RekomendasiPreset; s: RekomendasiSaham } => !!x)
    .map(({ p, s }) => ({
      kode: s.kode,
      judul: `${labelPreset(p.preset, s.ringkas.label_accdist)} di ${s.kode}`,
      sub: `skor ${angka(s.skor, 2)} · ${s.ringkas.fd} · harga ${angka(s.close)}`,
    }))
  const kartuRadar = [...kandidatKartu, ...presetKartu]

  return (
    <div className="bb-isi">
      <Blok kelas="polos" judul={`Kenapa IHSG ${kataArah} ${angka(Math.abs(d.ihsg_pct), 2)}% hari ini?`} catatan={`Statistik resmi bursa · ${tanggalPendek(ds.tanggal)} · penutupan`} />

      <div className="bb-tiga">
        <div className="bb-kolom">
          <Hero
            label="IHSG · penutupan"
            angka={angka(d.ihsg_value, 2)}
            nada={arah(d.ihsg_change)}
            sub={<>
              <span className={arah(d.ihsg_change)}>{bertanda(d.ihsg_change, 2)}</span>
              <span className={arah(d.ihsg_change)}>{bertanda(d.ihsg_pct, 2)}%</span>
            </>}
          />
          <p className="bb-narasi">{turun ? 'Turun' : 'Naik'} {angka(Math.abs(d.ihsg_change), 2)} poin dari penutupan kemarin di {angka(d.ihsg_prev, 2)}.</p>

          <Blok label={turun ? 'Pemberat indeks · poin' : 'Penggerak indeks · poin'}
            narasi={kontributor.length === 2 ? `${kontributor[0].c} dan ${kontributor[1].c} menyumbang ${angka(sumKontributor, 2)} dari ${angka(Math.abs(d.ihsg_change), 2)} poin ${kataArah}an hari ini.` : undefined}>
            <div className="bb-daftar">
              {kontributor.map((k) => (
                <BarisBatang key={k.c} kode={k.c} lebar={(Math.abs(k.ih) / maxIh) * 100} warna={arah(k.ih) === 'turun' ? 'turun' : 'naik'} nada={arah(k.ih)} nilai={bertanda(k.ih, 2)} />
              ))}
            </div>
          </Blok>

          <Blok label="Asing bersih · hari ini"
            narasi={`${turun ? 'Jual' : 'Beli'} bersih hari ini ${angka(porsiAsing, 0)}% dari rata-rata harian tahun ini ${rupiah(rataHarian * 1e9)}; sejak Januari sudah ${rupiah(d.nf_ytd_idr * 1e9)}.`}>
            <span className={`bb-mono ${arah(d.nf_today_idr)}`} style={{ fontSize: 22 }}>{rupiah(d.nf_today_idr * 1e9)}</span>
            <span className="bb-bb-rel" style={{ display: 'block', marginTop: 6 }}>
              <span className={`bb-bb-isi ${arah(d.nf_today_idr) === 'turun' ? 'turun' : 'naik'}`} style={{ width: `${porsiAsing}%` }} />
            </span>
          </Blok>

          <Blok label={`Sektor terlemah · hari ini`}
            narasi={sektorKuat ? `Sektor terkuat: ${bersihkanNama(sektorKuat.n)} ${bertanda(sektorKuat.d, 2)}%.` : undefined}>
            <span className={`bb-mono ${arah(sektorLemah.d)}`} style={{ fontSize: 22 }}>{bersihkanNama(sektorLemah.n)} {bertanda(sektorLemah.d, 2)}%</span>
          </Blok>

          <Blok label="Per papan pencatatan · hari ini · sejak Januari">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px 70px', columnGap: 12, rowGap: 6, fontSize: 14, alignItems: 'baseline' }}>
              {d.board.map((b) => (
                <Fragment key={b.n}>
                  <span>{PAPAN_LABEL[b.n] ?? b.n}</span>
                  <span className={`bb-mono ${arah(b.d)}`} style={{ textAlign: 'right' }}>{bertanda(b.d, 2)}</span>
                  <span className={`bb-mono ${arah(b.ytd)}`} style={{ textAlign: 'right', fontSize: 12 }}>{bertanda(b.ytd, 1)}</span>
                </Fragment>
              ))}
            </div>
          </Blok>
        </div>

        <div className="bb-kolom">
          <Blok judul="Kabar yang relevan" catatan={`5 berita terbaru yang menyebut IHSG, ${tanggalPendek(ds.tanggal)}`}>
            {kabarIhsg.length === 0
              ? <Keadaan kosong="Belum ada kabar yang menyebut IHSG hari ini." />
              : (
                <div className="bb-daftar">
                  {kabarIhsg.map((k, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--bb-garis)', overflowWrap: 'anywhere' }}>
                      <span className="bb-mono bb-catatan">{new Date(k.waktu).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {k.sumber}</span>
                      {k.tautan
                        ? <a href={k.tautan} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, lineHeight: 1.35, fontWeight: 500, color: 'var(--bb-teks)' }}>{k.judul}</a>
                        : <span style={{ fontSize: 15, lineHeight: 1.35, fontWeight: 500 }}>{k.judul}</span>}
                    </div>
                  ))}
                </div>
              )}
          </Blok>
        </div>

        <div className="bb-kolom">
          <Blok label="Pertanyaan siap dari Radar" catatan="temuan otomatis · penyaring, bukan peringkat">
            {kartuRadar.length === 0
              ? <Keadaan kosong="Belum ada temuan radar hari ini." />
              : (
                <div className="bb-daftar">
                  {kartuRadar.map((k, i) => (
                    <Link key={i} to={ruteLapisan('harga', k.kode)} className="bb-kartu" style={{ gap: 5, padding: '11px 13px', minHeight: 44, justifyContent: 'center' }}>
                      <span style={{ fontSize: 14, lineHeight: 1.3 }}>{k.judul}</span>
                      <span className="bb-mono bb-catatan">{k.sub}</span>
                    </Link>
                  ))}
                </div>
              )}
          </Blok>
        </div>
      </div>

      {!sisip && <KakiBaru sumber="Jawaban ini dirakit dari statistik resmi bursa dan kabar yang dipanen hari ini." />}
    </div>
  )
}
