import { useJson, angka, bertanda, tanggalPendek } from './data'
import { Hero, Blok, Keadaan, Arah } from './ui'
import { KakiBaru } from './KakiBaru'
import { urlData } from '../../lib/dasbor/baseData'

interface AnalisaEmiten { ticker: string; arah: string; skor: number }
interface EdisiRow { kode: string; tanggal: string; tanggal_id: string; pdf: string; analisa?: AnalisaEmiten[] }
interface KeluaranIndex { edisi: EdisiRow[] }

interface Tersentuh { tanggal: string; level: number; arah: string }
interface TerbitanDeepdive {
  kode: string
  tanggal: string
  edisi: string
  harga_acuan: number
  level_bull: number[]
  level_invalid: number[]
  urutan_tersentuh: Tersentuh[]
  harga_h5: number
  gerak_pct: number
  status: string
}
interface TinjauanDeepdive { horizon_hari: number; n: number; terbitan: TerbitanDeepdive[] }

interface TesisVonisRow {
  kode: string
  arah: string
  tanggalSinyal: string
  horizonHari: number
  status: string
  sebab: string | null
  tglKeluar: string | null
  hargaAkhir: number | null
  jendelaTutup: boolean
}
interface TesisVonis { tesis: TesisVonisRow[] }

const LABEL_STATUS_DD: Record<string, string> = { terbukti: 'Terbukti', 'belum terjadi': 'Belum terjadi', invalid: 'Invalid' }
const LABEL_SEBAB: Record<string, string> = { sl: 'kena stop loss', tp: 'kena target profit', horizon: 'habis jendela waktu', manual: 'ditutup manual' }

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function tanggalSingkat(iso: string): string {
  return tanggalPendek(iso).replace(/ \d{4}$/, '')
}

export default function L4Terbitan() {
  const { data: idx, galat: gIdx } = useJson<KeluaranIndex>('/arus-pasar/keluaran/index.json')
  const { data: tj, galat: gTj } = useJson<TinjauanDeepdive>('/data-idx/json/tinjauan_deepdive.json')
  const { data: tv, galat: gTv } = useJson<TesisVonis>('/data-idx/json/tesis_vonis.json')

  const galat = gIdx ?? gTj ?? gTv
  const kaki = `Terbitan dinilai H+${tj?.horizon_hari ?? 5} dari harga penutupan resmi; PDF tetap seperti saat terbit, tidak diedit ulang.`
  if (galat) return <div className="bb-isi"><Keadaan galat={galat} /><KakiBaru sumber={kaki} /></div>
  if (!idx || !tj || !tv) return <div className="bb-isi"><Keadaan /></div>

  const terbukti = tj.terbitan.filter((t) => t.status === 'terbukti')
  const belumTerjadi = tj.terbitan.filter((t) => t.status === 'belum terjadi')
  const invalid = tj.terbitan.filter((t) => t.status === 'invalid')
  const total = tj.terbitan.length
  const pctTerbukti = total > 0 ? (terbukti.length / total) * 100 : 0
  const medianGerak = median(tj.terbitan.map((t) => t.gerak_pct))

  const pdfDeepDive = (edisiKode: string): string | null => idx.edisi.find((e) => e.kode === edisiKode)?.pdf ?? null

  // Edisi dengan rincian skor per emiten (edisi lain hanya berisi ringkasan tanpa `analisa`).
  const edisiSkor = idx.edisi
    .filter((e) => (e.analisa ?? []).length > 0)
    .map((e) => {
      const n = (e.analisa ?? []).length
      const skorSum = (e.analisa ?? []).reduce((s, a) => s + a.skor, 0)
      const naik = (e.analisa ?? []).filter((a) => a.arah === 'naik' || a.arah === 'bull').length
      const netral = (e.analisa ?? []).filter((a) => a.arah === 'netral').length
      return { ...e, n, skorAvg: skorSum / n, skorSum, naik, netral }
    })
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .slice(0, 6)
  const edisiTertinggi = edisiSkor.length ? edisiSkor.reduce((m, e) => (e.skorSum > m.skorSum ? e : m)) : null
  const edisiCondongTurun = edisiSkor.length ? edisiSkor.reduce((m, e) => (e.naik / e.n < m.naik / m.n ? e : m)) : null

  const tesisTertutup = tv.tesis.filter((t) => t.jendelaTutup)
  const tesisBerjalan = tv.tesis.filter((t) => !t.jendelaTutup)

  return (
    <div className="bb-isi">
      <div className="bb-dua">
        <Hero
          label="Deep Dive · dinilai H+5"
          angka={terbukti.length}
          satuan={`dari ${total} terbukti`}
          sub={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', maxWidth: 420 }}>
                <div style={{ width: `${pctTerbukti}%`, background: 'var(--bb-naik)' }} />
                <div style={{ width: `${100 - pctTerbukti}%`, background: 'var(--bb-garis)' }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--bb-redup)' }}>
                {angka(pctTerbukti, 0)}% ({terbukti.length}) terbukti · {angka(100 - pctTerbukti, 0)}% ({total - terbukti.length}) belum terjadi — level bull tersentuh dalam {tj.horizon_hari} hari bursa.
              </span>
            </div>
          }
        />
        <Blok label="Median gerak H+5" narasi="acuan → penutupan H+5, seluruh terbitan Deep Dive">
          <span className="bb-mono" style={{ fontSize: 28, color: medianGerak >= 0 ? 'var(--bb-naik)' : 'var(--bb-turun)' }}>{bertanda(medianGerak)}%</span>
        </Blok>
      </div>

      <Blok label={`${total} Deep Dive, dinilai satu per satu`} catatan="acuan → harga H+5 · level yang dijanjikan">
        <div className="bb-kartu-grid">
          {tj.terbitan.map((t) => {
            const pdf = pdfDeepDive(t.edisi)
            const bull = t.level_bull.map((v) => angka(v)).join('·')
            const inv = t.level_invalid.map((v) => angka(v)).join('·')
            return (
              <div key={t.kode + t.tanggal} className={`bb-kartu${t.status === 'terbukti' ? ' sorot' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span className="bb-mono" style={{ fontWeight: 600, fontSize: 16 }}>{t.kode}</span>
                  <span className={`bb-lencana${t.status === 'terbukti' ? ' naik' : t.status === 'invalid' ? ' turun' : ''}`}>{LABEL_STATUS_DD[t.status] ?? t.status}</span>
                </div>
                <span className="bb-mono" style={{ fontSize: 12, color: 'var(--bb-redup)' }}>{angka(t.harga_acuan)} → {angka(t.harga_h5)}</span>
                <span className="bb-mono" style={{ fontSize: 20, color: t.gerak_pct >= 0 ? 'var(--bb-naik)' : 'var(--bb-turun)' }}>{bertanda(t.gerak_pct)}%</span>
                <span className="teks-11" style={{ color: 'var(--bb-redup)' }}>{bull ? `Bull ${bull}` : 'Bull —'} — Inv {inv || '—'}</span>
                {pdf ? (
                  <a href={urlData('/arus-pasar/keluaran/' + pdf)} target="_blank" rel="noopener" className="bb-tombol" style={{ fontSize: 12 }}>Baca PDF</a>
                ) : (
                  <span className="bb-tombol" aria-disabled style={{ fontSize: 12, opacity: 0.4, pointerEvents: 'none' }}>PDF tak tersedia</span>
                )}
              </div>
            )
          })}
        </div>
        <p className="bb-narasi">
          {terbukti.length}/{total} menyentuh level bull sebelum H+{tj.horizon_hari}
          {belumTerjadi.length > 0 ? `; ${belumTerjadi.map((t) => t.kode).join(' & ')} bergerak searah tapi belum menyentuh levelnya` : ''}
          {invalid.length > 0 ? `; ${invalid.length} menyentuh invalid` : '; tak satu pun menyentuh invalid'}.
        </p>
      </Blok>

      <div className="bb-dua">
        <Blok label="Edisi harian dengan rincian skor" catatan={`dari ${idx.edisi.length} terbitan; sisanya tanpa rincian per emiten`}>
          <div className="bb-tabel-wrap">
            <table className="bb-tabel">
              <thead><tr><th>Edisi</th><th className="kanan">Emiten</th><th>Skor rata-rata</th><th className="kanan">Naik : netral</th><th className="kanan">PDF</th></tr></thead>
              <tbody>
                {edisiSkor.map((e) => (
                  <tr key={e.kode}>
                    <td>{e.tanggal_id}</td>
                    <td className="kanan bb-mono">{e.n}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 7, borderRadius: 999, background: 'var(--bb-garis)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, e.skorAvg)}%`, height: 7, background: e === edisiTertinggi ? 'var(--bb-emas)' : 'var(--bb-biru)' }} />
                        </div>
                        <span className="bb-mono" style={{ fontSize: 12 }}>{angka(e.skorAvg, 1)}</span>
                      </div>
                    </td>
                    <td className="kanan bb-mono">{e.naik} : {e.netral}</td>
                    <td className="kanan"><a href={urlData('/arus-pasar/keluaran/' + e.pdf)} target="_blank" rel="noopener">PDF →</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {edisiTertinggi && edisiCondongTurun && (
            <p className="bb-narasi">
              Skor tertinggi {tanggalSingkat(edisiTertinggi.tanggal)} ({angka(edisiTertinggi.skorAvg, 1)}, {edisiTertinggi.n} emiten, batang emas); {tanggalSingkat(edisiCondongTurun.tanggal)} paling condong turun ({edisiCondongTurun.naik} naik banding {edisiCondongTurun.n - edisiCondongTurun.naik} lainnya).
            </p>
          )}
        </Blok>

        <Blok label="Tesis kontributor · dinilai otomatis H+5">
          <div className="bb-daftar">
            {tesisTertutup.map((t) => (
              <div key={t.kode + t.tanggalSinyal} className="bb-kartu" style={{ borderColor: t.status === 'menang' ? 'var(--bb-naik)' : t.status === 'kalah' ? 'var(--bb-turun)' : 'var(--bb-garis)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="bb-mono" style={{ fontWeight: 600, fontSize: 17 }}>{t.kode} · {t.arah}</span>
                  <span className={`bb-lencana${t.status === 'menang' ? ' naik' : t.status === 'kalah' ? ' turun' : ''}`}>{t.status}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--bb-redup)' }}>Sinyal {t.tanggalSinyal} · keluar {t.tglKeluar ?? '–'} · horizon {t.horizonHari} hari · sebab: {t.sebab ? (LABEL_SEBAB[t.sebab] ?? t.sebab) : '–'}</span>
                <Arah v={t.status === 'menang' ? 1 : t.status === 'kalah' ? -1 : 0}><span className="bb-mono" style={{ fontSize: 18 }}>Rp {angka(t.hargaAkhir)} saat keluar</span></Arah>
              </div>
            ))}
          </div>
          {tesisTertutup.length === 0 && <p className="bb-narasi">Belum ada tesis kontributor yang jendelanya tertutup.</p>}
          {tesisTertutup.length === 1 && <p className="bb-narasi">Satu-satunya tesis kontributor yang jendelanya sudah tutup — tercatat {tesisTertutup[0].status} apa adanya.</p>}
          {tesisTertutup.length > 1 && <p className="bb-narasi">{tesisTertutup.length} tesis kontributor yang jendelanya sudah tutup, dinilai otomatis apa adanya.</p>}
          <p className="bb-narasi">{tesisBerjalan.length === 0 ? 'Belum ada tesis lain yang sedang berjalan (gantung).' : `${tesisBerjalan.length} tesis lain sedang berjalan (gantung): ${tesisBerjalan.map((t) => t.kode).join(', ')}.`}</p>
        </Blok>
      </div>

      <KakiBaru sumber={kaki} />
    </div>
  )
}
