import { useEffect, useMemo, useRef, useState } from 'react'
import { BULAN, ringkasEmiten, vonisUji, type RingkasBulan, type RingkasEmiten, type SeriImbal } from '../../lib/seasonality'
import { muatIndeks, muatIhsg, muatSeri, type BarisIndeks } from '../../lib/seasonalityData'
import { pesanGalat } from '../../lib/pesanGalat'
import { SeasonalityHarian } from './SeasonalityHarian'
import { IkonMenu, IKON_CARI, IKON_SILANG, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'

const MAKS = 5
const BLN3 = BULAN.map((b) => b.slice(0, 3))

/** Warna sel dari peluang TERSUSUT, bukan mentah — sel yang menyala terang
 *  karena 4-dari-4 adalah persis jenis kesalahan yang halaman ini ada untuk
 *  mencegahnya. */
function tingkat(p: number, n: number): string {
  if (n === 0) return 'kosong'
  if (p < 38) return 'd2'
  if (p < 46) return 'd1'
  if (p < 54) return 'n'
  if (p < 62) return 'u1'
  return 'u2'
}

export function Seasonality() {
  const [indeks, setIndeks] = useState<BarisIndeks[] | null>(null)
  const [ihsg, setIhsg] = useState<SeriImbal>({})
  const [galat, setGalat] = useState<string | null>(null)

  const [cari, setCari] = useState('')
  const [dipilih, setDipilih] = useState<string[]>([])
  const [seri, setSeri] = useState<Record<string, SeriImbal>>({})
  const [sejak, setSejak] = useState(0)
  const [fokus, setFokus] = useState<{ kode: string; bulan: number } | null>(null)
  const [tab, setTab] = useState<'bulan' | 'hari'>('bulan')
  const kotak = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([muatIndeks(), muatIhsg()])
      .then(([i, h]) => { setIndeks(i); setIhsg(h) })
      .catch((e: unknown) => setGalat(pesanGalat(e, 'Gagal memuat data seasonality.')))
  }, [])

  const saran = useMemo(() => {
    const q = cari.trim().toUpperCase()
    if (!indeks || q.length < 1) return []
    return indeks
      .filter((b) => !dipilih.includes(b.k))
      .filter((b) => b.k.startsWith(q) || b.n.toUpperCase().includes(q))
      // Kode yang cocok didahulukan: yang sudah tahu kodenya tidak boleh
      // disodori perusahaan lain yang kebetulan namanya memuat huruf itu.
      .sort((a, b) => Number(b.k.startsWith(q)) - Number(a.k.startsWith(q)))
      .slice(0, 8)
  }, [indeks, cari, dipilih])

  async function tambah(kode: string) {
    if (dipilih.length >= MAKS || dipilih.includes(kode)) return
    setCari('')
    setDipilih((d) => [...d, kode])
    try {
      const s = await muatSeri(kode)
      setSeri((lama) => ({ ...lama, [kode]: s }))
    } catch (e) {
      setGalat(pesanGalat(e, `Gagal memuat data ${kode}.`))
      setDipilih((d) => d.filter((k) => k !== kode))
    }
  }

  function buang(kode: string) {
    setDipilih((d) => d.filter((k) => k !== kode))
    setFokus((f) => (f?.kode === kode ? null : f))
  }

  const ringkas = useMemo(() => {
    const hasil: RingkasEmiten[] = []
    for (const kode of dipilih) {
      const s = seri[kode]
      if (!s) continue
      const r = ringkasEmiten(kode, s, ihsg, sejak)
      if (r) hasil.push(r)
    }
    return hasil
  }, [dipilih, seri, ihsg, sejak])

  const petaNama = useMemo(
    () => Object.fromEntries((indeks ?? []).map((b) => [b.k, b.n])),
    [indeks],
  )

  const terpilih = fokus && ringkas.find((r) => r.kode === fokus.kode)?.perBulan[fokus.bulan - 1]

  return (
    <div className="lantai seasonality">
      <div className="vhead">
        <h1>Seasonality</h1>
        <span className="sub">pola bulanan {indeks ? indeks.length.toLocaleString('id-ID') : '—'} emiten, diuji lawan kebetulan</span>
      </div>

      {/* Dua sudut waktu dari satu pertanyaan yang sama — "kapan cenderung
          naik?" — jadi satu halaman, bukan dua. Memecahnya berarti orang
          harus tahu lebih dulu sudut mana yang dicari, padahal justru itu
          yang sedang mereka cari. */}
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'bulan'}
          className={'tab' + (tab === 'bulan' ? ' on' : '')} onClick={() => setTab('bulan')}>
          Bulanan
        </button>
        <button type="button" role="tab" aria-selected={tab === 'hari'}
          className={'tab' + (tab === 'hari' ? ' on' : '')} onClick={() => setTab('hari')}>
          Hari dalam Seminggu
        </button>
      </div>

      {tab === 'hari' && <SeasonalityHarian />}

      {tab === 'bulan' && <>
      {galat && <div className="panel panel-b"><p className="muted">{galat}</p></div>}

      <section className="panel">
        <div className="panel-b sea-cari-blok">
          <div className="sea-cari">
            <IkonMenu d={IKON_CARI} size={14} />
            <input
              ref={kotak} className="inp" value={cari} disabled={!indeks || dipilih.length >= MAKS}
              placeholder={dipilih.length >= MAKS ? `Maksimum ${MAKS} emiten — buang satu dulu` : 'Cari kode atau nama emiten…'}
              onChange={(e) => setCari(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && saran[0]) void tambah(saran[0].k) }}
            />
            {saran.length > 0 && (
              <ul className="sea-saran" role="listbox">
                {saran.map((b) => (
                  <li key={b.k}>
                    <button type="button" className="sea-saran-it" onClick={() => void tambah(b.k)}>
                      <span className="kd">{b.k}</span>
                      <span className="nm">{b.n}</span>
                      <span className="rg">{b.m} → {b.a}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="sea-chip-baris">
            {dipilih.map((k) => (
              <button key={k} type="button" className="sea-chip" onClick={() => buang(k)} title={`Buang ${k}`}>
                {k} <IkonMenu d={IKON_SILANG} size={9} />
              </button>
            ))}
            {dipilih.length === 0 && <span className="muted" style={{ fontSize: 11.5 }}>Belum ada emiten dipilih.</span>}
          </div>

          <div className="sea-tahun">
            <span className="lbl">Mulai dari</span>
            {[0, 2010, 2015, 2020].map((t) => (
              <button key={t} type="button" className={'bchip bchip-klik' + (sejak === t ? ' on' : '')}
                onClick={() => setSejak(t)}>{t === 0 ? 'Semua' : t}</button>
            ))}
          </div>
        </div>
      </section>

      {ringkas.length === 0 && !galat && (
        <div className="fd-empty" style={{ padding: '48px 20px' }}>
          <p style={{ fontSize: 14 }}>Cari emiten di atas untuk melihat pola bulanannya.</p>
          <p style={{ fontSize: 11.5, marginTop: 6, maxWidth: '58ch', margin: '6px auto 0', lineHeight: 1.7 }}>
            Bisa sampai {MAKS} emiten sekaligus untuk dibandingkan. Angka yang ditampilkan
            adalah peluang <b>tersusut</b> — 4 dari 5 tahun tidak dibaca sebagai 80%.
          </p>
        </div>
      )}

      {ringkas.length > 0 && (
        <>
          <section className="panel">
            <div className="panel-h">
              <span className="lbl">Peluang naik per bulan</span>
              <span className="v-note">klik sel untuk rinciannya</span>
            </div>
            <div className="panel-b" style={{ overflowX: 'auto' }}>
              <table className="tbl sea-matriks">
                <thead>
                  <tr>
                    <th>Emiten</th>
                    {BLN3.map((b) => <th key={b} className="num">{b}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ringkas.map((r) => (
                    <tr key={r.kode}>
                      <th>
                        <span className="kd">{r.kode}</span>
                        <span className="rg">{r.mulai} → {r.akhir} · {r.totalObservasi} bln</span>
                      </th>
                      {r.perBulan.map((b) => (
                        <td key={b.bulan} className={`sea-sel s-${tingkat(b.tersusut, b.n)}${fokus?.kode === r.kode && fokus.bulan === b.bulan ? ' pilih' : ''}`}>
                          <button type="button" onClick={() => setFokus({ kode: r.kode, bulan: b.bulan })}
                            title={b.n === 0 ? 'Belum ada data' : `${b.naik} dari ${b.n} tahun naik`}>
                            {b.n === 0 ? '·' : Math.round(b.tersusut)}
                            {/* Titik kecil menandai sampel di bawah 5 tahun —
                                angkanya tetap ditampilkan, tapi pembacanya
                                diberi tahu bahwa dasarnya tipis. */}
                            {b.n > 0 && b.n < 5 && <i className="tipis" />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-b sea-legenda">
              <span>Jarang naik</span>
              <span className="skala"><i className="s-d2" /><i className="s-d1" /><i className="s-n" /><i className="s-u1" /><i className="s-u2" /></span>
              <span>Sering naik</span>
              <span className="muted">· <i className="tipis-demo" /> sampel di bawah 5 tahun · angka = peluang tersusut</span>
            </div>
          </section>

          {terpilih && fokus && (
            <LaciBulan kode={fokus.kode} nama={petaNama[fokus.kode] ?? fokus.kode} b={terpilih}
              onTutup={() => setFokus(null)} />
          )}

          <section className="panel">
            <div className="panel-h"><span className="lbl">Apakah polanya nyata?</span></div>
            <div className="panel-b sea-uji">
              {ringkas.map((r) => {
                const v = vonisUji(r.uji)
                return (
                  <div key={r.kode} className={'sea-uji-baris' + (v.kuat ? ' kuat' : '')}>
                    <span className="kd">{r.kode}</span>
                    {r.uji ? (
                      <>
                        <span className="jw">
                          Bulan terkuat <b>{BULAN[r.uji.bulanJuara - 1]}</b> ({r.uji.peluangJuara}%)
                        </span>
                        <span className="pv">p = {r.uji.pValue.toFixed(3)}</span>
                      </>
                    ) : <span className="jw muted">data belum cukup</span>}
                    <span className="ks">{v.teks}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      </>}

      {tab === 'bulan' && <p className="sea-kaki">
        <IkonMenu d={IKON_PERINGATAN} size={12} />{' '}
        <b>Ini frekuensi historis, bukan probabilitas masa depan.</b> Rentang data tiap
        emiten berbeda dan <b>bukan sejak IPO</b> — sumbernya praktis mulai sekitar tahun
        2000, jadi emiten lama kehilangan tahun-tahun awalnya. Harga sudah disesuaikan
        aksi korporasi. Angka peluang sudah <b>disusutkan</b> terhadap sampel tipis, dan
        bulan terkuat diuji lawan 2.000 pengacakan sebelum disebut nyata.
      </p>}
    </div>
  )
}

/** Rincian satu bulan: sebaran per tahun, selang, dan lawan pasar. */
function LaciBulan({ kode, nama, b, onTutup }: {
  kode: string; nama: string; b: RingkasBulan; onTutup: () => void
}) {
  const maks = Math.max(1, ...b.nilai.map((v) => Math.abs(v.persen)))
  return (
    <section className="panel sea-laci">
      <div className="panel-h">
        <span className="lbl">{kode} · {BULAN[b.bulan - 1]}</span>
        <button type="button" className="bchip bchip-klik" onClick={onTutup}>Tutup</button>
      </div>
      <div className="panel-b sea-laci-isi">
        <div className="sea-laci-angka">
          <div>
            <span className="lbl">Peluang naik</span>
            <span className="besar">{b.n === 0 ? '—' : `${b.tersusut.toFixed(0)}%`}</span>
            <span className="v-note">
              {b.n === 0 ? 'belum ada data' : `mentah ${b.naik}/${b.n} · selang ${b.bawah.toFixed(0)}–${b.atas.toFixed(0)}%`}
            </span>
          </div>
          <div>
            <span className="lbl">Imbal tengah</span>
            <span className={'besar ' + (b.median >= 0 ? 'up' : 'dn')}>
              {b.n === 0 ? '—' : `${b.median > 0 ? '+' : ''}${b.median.toFixed(2)}%`}
            </span>
            <span className="v-note">rata-rata {b.rata2.toFixed(2)}%</span>
          </div>
          <div>
            <span className="lbl">Mengalahkan IHSG</span>
            <span className="besar">
              {b.unggul === null ? '—' : `${b.unggul}/${b.unggulDari}`}
            </span>
            {/* Inilah pemisah musiman emiten dari musiman pasar: bulan yang
                sering hijau tapi jarang mengalahkan IHSG cuma ikut arus. */}
            <span className="v-note">{b.unggul === null ? 'pembanding tak tersedia' : 'kali dari bulan yang sama'}</span>
          </div>
        </div>

        <div className="sea-tahun-bar">
          <span className="lbl">Tiap tahun</span>
          {b.nilai.length === 0 && <span className="muted" style={{ fontSize: 11.5 }}>Belum pernah tercatat.</span>}
          {b.nilai.map((v) => (
            <div key={v.tahun} className="sea-bar-baris" title={`${nama} ${BULAN[b.bulan - 1]} ${v.tahun}: ${v.persen}%`}>
              <span className="th">{v.tahun}</span>
              <span className="jalur">
                <i className={v.persen >= 0 ? 'up' : 'dn'}
                  style={{ width: `${(Math.abs(v.persen) / maks) * 100}%` }} />
              </span>
              <span className={'ag ' + (v.persen >= 0 ? 'up' : 'dn')}>
                {v.persen > 0 ? '+' : ''}{v.persen.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
