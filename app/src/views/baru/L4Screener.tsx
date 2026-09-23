import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useJson, angka, bertanda, tanggalPendek } from './data'
import { Blok, Keadaan, Arah, Pil } from './ui'
import { KakiBaru } from './KakiBaru'
import { ruteLapisan } from './peta'

interface ScreenerEmiten { kode: string; likuiditas: number }
interface ScreenerData { tanggal: string; n: number; emiten: ScreenerEmiten[] }

interface SinyalKandidat { nama: string }
interface KandidatEmiten {
  kode: string
  skor: number
  sinyal: SinyalKandidat[]
  harga: number
  likuiditas: number
  ret10: number
  rvol_med: number
  net_asing_20h: number
}
interface KandidatDeepdive { tanggal: string; ambang: { skor_min: number; likuiditas_min: number; jendela: number }; n: number; emiten: KandidatEmiten[] }

/** [pola, arah, tanggal, harga_pola, harga_kini] */
type PolaBaris = [string, string, string, number, number]
interface PolaScreener { akhir: string; n: number; d: Record<string, PolaBaris> }

interface RekSaham {
  kode: string; close: number; entry: [number, number] | null; tp1?: number | null; sl?: number | null; skor?: number | null
  ringkas: { freq: number; label_accdist?: string | null }
}
interface RekPreset { preset: string; saham: RekSaham[]; n_lolos: number }
interface Rekomendasi { tanggal: string; presets: RekPreset[] }
interface RekIndex { tanggal: string[] }

const LABEL_POLA: Record<string, string> = {
  'rising-wedge': 'baji naik',
  'falling-wedge': 'baji turun',
  'double-top': 'puncak ganda',
  'double-bottom': 'dasar ganda',
  'triple-top': 'puncak tiga',
  'triple-bottom': 'tiga dasar',
  rectangle: 'persegi',
  'symmetrical-triangle': 'segitiga simetris',
  'ascending-triangle': 'segitiga naik',
  'descending-triangle': 'segitiga turun',
  'head-shoulders': 'kepala-bahu',
  'inv-head-shoulders': 'kepala-bahu terbalik',
  'bearish-flag': 'bendera turun',
  'bullish-pennant': 'panji naik',
  'bearish-pennant': 'panji turun',
}
const LABEL_PRESET_PIL: Record<string, string> = {
  'whale-tiket': 'Whale tiket', 'whale-akdis': 'Whale akdis', 'whale-asing': 'Whale asing', scalping: 'Scalping', swing: 'Swing',
}

/** `sisip`: dipakai Screener di tampilan Baru (#228) — kaki sendiri disembunyikan. */
export default function L4Screener({ sisip = false }: { sisip?: boolean } = {}) {
  // #230: pil preset dulu <span> statis. Sekarang pilihan aktif mengganti
  // daftar teratas (kanan) dan angka ringkas (kiri).
  const [pilihan, setPilihan] = useState<string>('kandidat')
  const { data: screener, galat: gS } = useJson<ScreenerData>('/data-idx/json/screener.json')
  const { data: kandidat, galat: gK } = useJson<KandidatDeepdive>('/data-idx/json/kandidat_deepdive.json')
  const { data: pola, galat: gP } = useJson<PolaScreener>('/data-idx/json/pola_screener.json')
  const { data: rekIdx } = useJson<RekIndex>('/data-idx/json/rekomendasi/index.json')
  const tglRek = rekIdx && rekIdx.tanggal.length > 0 ? rekIdx.tanggal[rekIdx.tanggal.length - 1] : null
  const { data: rek, galat: gR } = useJson<Rekomendasi>(tglRek ? `/data-idx/json/rekomendasi/${tglRek}.json` : null)

  const galat = gS ?? gK ?? gP ?? gR
  const kaki = `Screener dari statistik resmi bursa; kandidat Deep Dive dari perhitungan sebelumnya. Nilai dalam rupiah; M = miliar, jt = juta lembar.`
  if (galat) return <div className="bb-isi"><Keadaan galat={galat} />{!sisip && <KakiBaru sumber={kaki} />}</div>
  if (!screener || !kandidat || !pola || !rek) return <div className="bb-isi"><Keadaan /></div>

  const totalEmiten = screener.n
  const lolosLikuiditas = screener.emiten.filter((e) => e.likuiditas >= kandidat.ambang.likuiditas_min).length
  const pctLolos = totalEmiten ? (lolosLikuiditas / totalEmiten) * 100 : 0
  const pctKandidat = totalEmiten ? (kandidat.n / totalEmiten) * 100 : 0

  const skorCount = new Map<number, number>()
  for (const e of kandidat.emiten) skorCount.set(e.skor, (skorCount.get(e.skor) ?? 0) + 1)
  const skorRows = [...skorCount.entries()].sort((a, b) => a[0] - b[0])
  const maxSkorCount = Math.max(1, ...skorRows.map(([, c]) => c))
  const maxSkor = Math.max(kandidat.ambang.skor_min, ...kandidat.emiten.map((e) => e.skor))
  const nSkorMaks = kandidat.emiten.filter((e) => e.skor === maxSkor).length

  const sinyalCount = new Map<string, number>()
  for (const e of kandidat.emiten) for (const s of e.sinyal) sinyalCount.set(s.nama, (sinyalCount.get(s.nama) ?? 0) + 1)
  const sinyalRanked = [...sinyalCount.entries()].sort((a, b) => b[1] - a[1])
  const sinyalTerbanyak = sinyalRanked[0]
  const sinyalTerjarang = sinyalRanked[sinyalRanked.length - 1]

  const top10 = [...kandidat.emiten].sort((a, b) => b.skor - a.skor).slice(0, 10)

  const polaCount = new Map<string, number>()
  for (const v of Object.values(pola.d)) polaCount.set(v[0], (polaCount.get(v[0]) ?? 0) + 1)
  const polaRanked = [...polaCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxPola = Math.max(1, ...polaRanked.map(([, c]) => c))
  const bullish5 = Object.entries(pola.d)
    .filter(([, v]) => v[1] === 'bullish')
    .sort((a, b) => b[1][2].localeCompare(a[1][2]))
    .slice(0, 5)

  const preset = pilihan === 'kandidat' ? null : rek.presets.find((p) => p.preset === pilihan) ?? null
  const labelPreset = preset ? (LABEL_PRESET_PIL[preset.preset] ?? preset.preset) : ''
  const presetTop = preset ? [...preset.saham].sort((a, b) => (b.skor ?? 0) - (a.skor ?? 0)).slice(0, 10) : []
  const maxSkorPreset = Math.max(0, ...presetTop.map((e) => e.skor ?? 0))
  const whaleTiket = rek.presets.find((p) => p.preset === 'whale-tiket')
  const whaleTop5 = whaleTiket ? [...whaleTiket.saham].sort((a, b) => b.ringkas.freq - a.ringkas.freq).slice(0, 5) : []
  const maxFreq = Math.max(1, ...whaleTop5.map((s) => s.ringkas.freq))

  return (
    <div className="bb-isi">
      <div className="bb-dua">
        <div className="bb-kolom">
          {preset ? (
          <Blok label={`${labelPreset} · rencana dagang otomatis`} judul={undefined}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 'clamp(44px,6vw,64px)', fontWeight: 800, lineHeight: 0.95 }}>{preset.n_lolos}</span>
              <span style={{ fontSize: 20, color: 'var(--bb-redup)' }}>dari {totalEmiten}</span>
            </div>
            <p className="bb-narasi">{preset.n_lolos} emiten lolos saringan {labelPreset} pada {tanggalPendek(rek.tanggal)}. Daftar di kanan menampilkan {presetTop.length} dengan skor tertinggi. Ini rencana otomatis, bukan rekomendasi beli.</p>
          </Blok>
          ) : (<>
          <Blok label="Kandidat Deep Dive · penyaring otomatis" judul={undefined}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 'clamp(44px,6vw,64px)', fontWeight: 800, lineHeight: 0.95 }}>{kandidat.n}</span>
              <span style={{ fontSize: 20, color: 'var(--bb-redup)' }}>dari {totalEmiten}</span>
            </div>
            <span style={{ fontSize: 13, color: 'var(--bb-redup)' }}>
              skor · {kandidat.ambang.skor_min} dari 6 sinyal · likuiditas · Rp {angka(kandidat.ambang.likuiditas_min / 1e6, 0)} juta/hari · jendela {kandidat.ambang.jendela} hari bursa · data {tanggalPendek(kandidat.tanggal)}
            </span>
          </Blok>

          <Blok>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: `${totalEmiten} semua emiten`, pct: 100, warna: 'var(--bb-biru)' },
                { label: `${lolosLikuiditas} lolos ambang likuiditas`, pct: pctLolos, warna: 'var(--bb-biru)' },
                { label: `${kandidat.n} kandidat skor ≥ ${kandidat.ambang.skor_min}`, pct: pctKandidat, warna: 'var(--bb-emas)' },
              ].map((r) => (
                <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--bb-redup)' }}>
                    <span>{r.label}</span><span className="bb-mono">{angka(r.pct, 1)}%</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: 'var(--bb-garis)', overflow: 'hidden' }}>
                    <div style={{ width: `${r.pct}%`, height: 10, background: r.warna }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="bb-narasi">{totalEmiten} emiten disaring likuiditas dulu, tersisa {lolosLikuiditas}; ambang skor menyisakan {kandidat.n} — sekitar satu dari {angka(kandidat.n > 0 ? totalEmiten / kandidat.n : 0, 0)}.</p>
          </Blok>

          <div className="bb-blok panel" style={{ borderColor: 'var(--bb-emas)' }}>
            <p className="bb-narasi" style={{ color: 'var(--bb-teks)' }}>Screener ini penyaring, bukan peringkat kelayakan; dua Deep Dive yang terbukti (BUMI, DSSA) ada di peringkat 64 dan 57 saat diuji.</p>
          </div>

          <Blok label={`Sebaran skor · ${kandidat.n} kandidat`}
            narasi={sinyalTerbanyak && sinyalTerjarang ? `Sinyal tersering: ${sinyalTerbanyak[0]} (${sinyalTerbanyak[1]}/${kandidat.n}); terjarang: ${sinyalTerjarang[0]} (${sinyalTerjarang[1]}/${kandidat.n}).` : undefined}>
            <div className="bb-daftar">
              {skorRows.map(([skor, c]) => (
                <div key={skor} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 30px', columnGap: 10, alignItems: 'center' }}>
                  <span className="bb-mono" style={{ fontSize: 12 }}>skor {skor}</span>
                  <div style={{ height: 10, borderRadius: 999, background: 'var(--bb-garis)', overflow: 'hidden' }}>
                    <div style={{ width: `${(c / maxSkorCount) * 100}%`, height: 10, background: 'var(--bb-biru)' }} />
                  </div>
                  <span className="bb-mono" style={{ fontSize: 12, textAlign: 'right' }}>{c}</span>
                </div>
              ))}
            </div>
          </Blok>
          </>)}
        </div>

        <div className="bb-kolom">
          <div className="bb-pils" role="group" aria-label="Pilih daftar">
            <Pil aktif={pilihan === 'kandidat'} onClick={() => setPilihan('kandidat')}>Kandidat Deep Dive</Pil>
            {rek.presets.map((p) => (
              <Pil key={p.preset} aktif={pilihan === p.preset} onClick={() => setPilihan(p.preset)}>{LABEL_PRESET_PIL[p.preset] ?? p.preset}</Pil>
            ))}
          </div>

          {preset ? (
          <Blok label={undefined} judul={`${labelPreset} · ${presetTop.length} teratas`} catatan={`dari ${preset.n_lolos} lolos · ${tanggalPendek(rek.tanggal)}`}>
            <div className="bb-daftar">
              {presetTop.map((e) => (
                <div key={e.kode} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderBottom: '1px solid var(--bb-garis)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="bb-mono" style={{ fontWeight: 600, fontSize: 15, minWidth: 52 }}>{e.kode}</span>
                    <span className="bb-mono" style={{ fontSize: 14, minWidth: 60 }}>{angka(e.close)}</span>
                    <span className="bb-bb-rel" style={{ flex: '1 1 100px', minWidth: 60 }}>
                      <span className="bb-bb-isi biru" style={{ width: `${maxSkorPreset > 0 ? ((e.skor ?? 0) / maxSkorPreset) * 100 : 0}%` }} />
                    </span>
                    <Link to={ruteLapisan('harga', e.kode)} className="bb-tombol" style={{ fontSize: 12, padding: '0 14px' }}>jadikan tesis</Link>
                  </div>
                  <span className="bb-mono teks-11" style={{ color: 'var(--bb-redup)' }}>
                    {e.entry ? `masuk ${angka(e.entry[0])}–${angka(e.entry[1])}` : 'masuk tidak tersedia'}
                    {e.tp1 != null ? ` · target ${angka(e.tp1)}` : ''}{e.sl != null ? ` · batas rugi ${angka(e.sl)}` : ''}
                    {` · frekuensi ${angka(e.ringkas.freq)}`}{e.ringkas.label_accdist === 'Acc' ? ' · akumulasi' : e.ringkas.label_accdist === 'Dist' ? ' · distribusi' : ''}
                  </span>
                </div>
              ))}
            </div>
            <p className="bb-narasi">Urut skor saringan {labelPreset}. Rencana dagang otomatis dari harga penutupan terakhir, bukan jaminan.</p>
          </Blok>
          ) : (
          <Blok label={undefined} judul={`${top10.length} skor tertinggi`} catatan="urut skor · batang = skor">
            <div className="bb-daftar">
              {top10.map((e) => (
                <div key={e.kode} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderBottom: '1px solid var(--bb-garis)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="bb-mono" style={{ fontWeight: 600, fontSize: 15, minWidth: 52 }}>{e.kode}</span>
                    <span className="bb-mono" style={{ fontSize: 14, minWidth: 60 }}>{angka(e.harga)}</span>
                    <span className="bb-bb-rel" style={{ flex: '1 1 100px', minWidth: 60 }}>
                      <span className={`bb-bb-isi ${e.skor === maxSkor ? 'emas' : 'biru'}`} style={{ width: `${(e.skor / maxSkor) * 100}%` }} />
                    </span>
                    <Link to={ruteLapisan('harga', e.kode)} className="bb-tombol" style={{ fontSize: 12, padding: '0 14px' }}>jadikan tesis</Link>
                  </div>
                  <span className="bb-mono teks-11" style={{ color: 'var(--bb-redup)' }}>
                    cocok {e.skor}/6 · likuiditas {angka(e.likuiditas / 1e9, 2)} M · ret10 <Arah v={e.ret10}>{bertanda(e.ret10)}%</Arah> · RVOL {angka(e.rvol_med, 2)}× · net asing <Arah v={e.net_asing_20h}>{bertanda(e.net_asing_20h / 1e6, 2)}</Arah> jt
                  </span>
                </div>
              ))}
            </div>
            <p className="bb-narasi">Skor tertinggi {maxSkor} dari 6 sinyal ({nSkorMaks} emiten). Kandidat, bukan jaminan · tetap perlu Deep Dive.</p>
          </Blok>
          )}

          <div className="bb-dua-rata">
            <Blok label={undefined} judul={`Pola teknikal terbanyak · ${pola.n} emiten`}>
              <div className="bb-daftar">
                {polaRanked.map(([kode, c]) => (
                  <div key={kode} style={{ display: 'grid', gridTemplateColumns: '116px minmax(0,1fr) 28px', columnGap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--bb-redup)' }}>{LABEL_POLA[kode] ?? kode}</span>
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--bb-garis)', overflow: 'hidden' }}>
                      <div style={{ width: `${(c / maxPola) * 100}%`, height: 8, background: 'var(--bb-biru)' }} />
                    </div>
                    <span className="bb-mono" style={{ fontSize: 12, textAlign: 'right' }}>{c}</span>
                  </div>
                ))}
              </div>
              {bullish5.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {bullish5.map(([kode, v]) => (
                    <span key={kode} className="bb-lencana naik">{kode} · {LABEL_POLA[v[0]] ?? v[0]} · {v[2].slice(5)}</span>
                  ))}
                </div>
              )}
            </Blok>

            <Blok label={undefined} judul={`Whale-tiket · lima teratas`} catatan={`dari ${whaleTiket?.n_lolos ?? 0} lolos`}>
              <div className="bb-daftar">
                {whaleTop5.map((s) => (
                  <BarisTiket key={s.kode} s={s} maxFreq={maxFreq} />
                ))}
              </div>
              <p className="bb-narasi">Batang = frekuensi transaksi, bukan besar order.</p>
            </Blok>
          </div>
        </div>
      </div>

      {!sisip && <KakiBaru sumber={kaki} />}
    </div>
  )
}

function BarisTiket({ s, maxFreq }: { s: RekSaham; maxFreq: number }) {
  const entri = s.entry ? `${angka(s.entry[0])}–${angka(s.entry[1])}` : angka(s.close)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 60px', columnGap: 8, alignItems: 'center' }}>
      <span className="bb-mono" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.kode} {entri}</span>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--bb-garis)', overflow: 'hidden' }}>
        <div style={{ width: `${(s.ringkas.freq / maxFreq) * 100}%`, height: 8, background: 'var(--bb-biru)' }} />
      </div>
      <span className="bb-mono" style={{ fontSize: 12, textAlign: 'right' }}>{angka(s.ringkas.freq)}</span>
    </div>
  )
}
