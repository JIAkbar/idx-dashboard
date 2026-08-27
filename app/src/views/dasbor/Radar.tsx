import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  tanggalPanjang,
  useArsipRadar,
  type ArsipRadar,
  type BarisRadar,
  type EdisiRadar,
} from '../../lib/radar/arsip'
import { skorRadar } from '../../lib/radar/skor'
import { rollupBulanan, rollupMingguan } from '../../lib/radar/rollup'
import { LangkahTanggal } from '../../components/dasbor/LangkahTanggal'
import { LightboxGambar, type GambarLightbox } from '../../components/dasbor/LightboxGambar'
import { KonteksData } from '../../components/dasbor/KonteksData'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
// Gaya lightbox (.af-lb-*) hidup di AdminShared.css (dulu AdminHome.css,
// pindah folder saat rombak shell tab #shell-tab), ter-scope .lantai —
// diimpor di sini juga supaya pratinjau RBU jalan tanpa mampir halaman admin.
import '../admin/AdminShared.css'

type Tab = 'watch' | 'penny' | 'rbu' | 'mingguan' | 'bulanan' | 'cara'

const TABS: { id: Tab; label: string }[] = [
  { id: 'watch', label: 'Watch List' },
  { id: 'penny', label: 'Penny' },
  { id: 'rbu', label: 'RBU' },
  { id: 'mingguan', label: 'Mingguan' },
  { id: 'bulanan', label: 'Bulanan' },
  { id: 'cara', label: 'Cara Baca' },
]

const fmtPct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1).replace('.', ',')}%`
const fmtHarga = (v: number | null) => (v === null ? '—' : v.toLocaleString('id-ID'))
const fmtVr = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 1 })

/** ISO → "13 Agu" (judul panel pendek). */
function tanggalPendek(iso: string): string {
  const [, b, d] = iso.split('-').map(Number)
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][b - 1]}`
}

/** Senin pekan ISO tanggal itu — kunci pengelompokan rollup mingguan. */
function awalMinggu(iso: string): string {
  const [t, b, d] = iso.split('-').map(Number)
  const dt = new Date(t, b - 1, d)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/**
 * IHSG close per tanggal ISO dari data-idx/json/index.json — benchmark rollup
 * bulanan. Helper lokal view (pola useIhsgMap Bulletin.tsx), cache modul.
 */
let cacheIhsg: Map<string, number> | null = null
function useIhsgClose() {
  const [peta, setPeta] = useState<Map<string, number> | null>(cacheIhsg)
  useEffect(() => {
    if (cacheIhsg) return
    let batal = false
    fetch('/data-idx/json/index.json')
      .then((r) => (r.ok ? (r.json() as Promise<{ dates?: { date_iso: string; ihsg: number }[] }>) : Promise.reject()))
      .then((j) => {
        if (batal) return
        cacheIhsg = new Map((j.dates ?? []).map((d) => [d.date_iso, d.ihsg]))
        setPeta(cacheIhsg)
      })
      // Benchmark pelengkap — gagal fetch berarti baris IHSG "—", rollup tetap tampil.
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [])
  return peta
}

/** Chip sinyal satu baris — pemetaan warna sesuai legenda resmi artifact v2. */
function ChipSinyal({ row }: { row: BarisRadar }) {
  const chips: { txt: string; cls?: string; title?: string }[] = []
  if (row.colors) chips.push({ txt: row.colors, cls: /Greens/.test(row.colors) ? 'g' : 'd', title: 'Colors — warna candle beruntun' })
  if (row.bodies) chips.push({ txt: row.bodies, cls: /Whites/.test(row.bodies) ? 'g' : 'd', title: 'Bodies — body candle beruntun' })
  if (row.osc) chips.push({ txt: row.osc, cls: 'o', title: 'Menyentuh batas oscillator' })
  if (row.candle) chips.push({ txt: row.candle, title: 'Pola candle' })
  if (row.macd) {
    if (row.macd.kode === 'X') chips.push({ txt: 'MACD X', cls: 'o', title: 'Persilangan MACD sedang terjadi' })
    else if (row.macd.kode === 'SW') chips.push({ txt: 'SW', title: 'Pola sideways di grafik' })
    else if (row.macd.arah)
      chips.push({
        txt: `MACD ${row.macd.arah === 'up' ? '↑' : '↓'}${row.macd.n ?? ''}`,
        cls: row.macd.arah === 'up' ? 'o' : undefined,
        title: `MACD ${row.macd.arah === 'up' ? 'naik' : 'turun'}${row.macd.n ? `, ${row.macd.n} hari sejak cross` : ''}`,
      })
  }
  if (row.vr !== null) chips.push({ txt: `VR ${fmtVr(row.vr)}`, cls: row.vr >= 1.5 ? 'b' : undefined, title: 'Volume vs rerata — >1,5 = ramai' })
  if (chips.length === 0) return <span className="muted">—</span>
  return (
    <>
      {chips.map((c) => (
        <span key={c.txt} className={`rdr-chip${c.cls ? ` ${c.cls}` : ''}`} title={c.title}>
          {c.txt}
        </span>
      ))}
    </>
  )
}

/** Tabel papan (Watch List / Penny List) satu edisi — zona asli dipertahankan. */
function TabelPapan({ rows, arsip }: { rows: BarisRadar[]; arsip: ArsipRadar }) {
  return (
    <div className="board-tbl-wrap">
      <table className="tbl rdr-tbl">
        <thead>
          <tr>
            <th>Saham</th>
            <th className="r">S</th>
            <th className="r">Close</th>
            <th className="r">R</th>
            <th>Sinyal</th>
            <th className="r">Skor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const indeks = row.tik === 'IHSG'
            const { skor, komponen } = indeks ? { skor: null, komponen: [] } : skorRadar(row, arsip)
            return (
              <tr key={`${row.tik}-${i}`} className={row.zona ? `rdr-z-${row.zona}` : undefined}>
                <td className="tick">
                  {indeks
                    ? row.tik
                    : <Link className="tick" to={`/grafik?kode=${row.tik}`}>{row.tik}</Link>}
                  {row.hari_ke !== null && <small title={`${row.hari_ke} hari beruntun masuk daftar`}>{row.hari_ke}</small>}
                </td>
                <td className="r num">{fmtHarga(row.s)}</td>
                <td className="r num">{fmtHarga(row.close)}</td>
                <td className="r num">{fmtHarga(row.r)}</td>
                <td><ChipSinyal row={row} /></td>
                <td className="r">
                  {skor === null ? (
                    <span className="muted">—</span>
                  ) : (
                    <span
                      className={`rdr-skor${skor < 50 ? ' rendah' : ''}`}
                      title={komponen.map((k) => `${k.label} ${k.delta >= 0 ? '+' : ''}${k.delta} — ${k.detail}`).join('\n')}
                    >
                      <i style={{ '--p': `${skor}%` } as CSSProperties} />
                      <b>{skor}</b>
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Legenda resmi WDWL — konten tab Cara Baca (port setia artifact v2). */
function CaraBaca() {
  return (
    <>
      <section className="panel">
        <div className="panel-h">
          <span className="lbl">Cara Baca — Legenda Resmi WDWL</span>
        </div>
        <div className="rdr-legenda">
          <div className="rdr-leg">
            <b>Warna saham</b>
            <div className="b"><span className="rdr-sw tua" /> Hijau tua — kandidat <i>Rebound</i></div>
            <div className="b"><span className="rdr-sw muda" /> Hijau muda — kandidat <i>Breakout</i></div>
            <div className="b"><span className="rdr-sw biru" /> Biru — dalam <i>Uptrend</i></div>
            <div className="b"><span className="rdr-sw merah" /> Sel merah — sinyal peringatan/jenuh</div>
          </div>
          <div className="rdr-leg">
            <b>Kolom sinyal</b>
            <div className="b"><code>3-Greens</code> naik 3 hari beruntun (Colors)</div>
            <div className="b"><code>2-Whites</code> body candle putih beruntun (Bodies)</div>
            <div className="b"><code>RSI+BB</code> menyentuh batas oscillator</div>
            <div className="b"><code>V Ratio</code> volume vs rerata — &gt;1,5 = ramai</div>
          </div>
          <div className="rdr-leg">
            <b>Kolom MACD &amp; kode</b>
            <div className="b"><code>↑ 27</code> MACD naik, 27 hari sejak golden cross</div>
            <div className="b"><code>X</code> persilangan MACD sedang terjadi</div>
            <div className="b"><code>SW</code> pola sideways di grafik</div>
            <div className="b"><code>ISAT ¹</code> angka kecil = hari beruntun masuk daftar</div>
          </div>
          <div className="rdr-leg">
            <b>Aturan pasar</b>
            <div className="b">Zona 1 (blok teratas) = prioritas penulis</div>
            <div className="b">Zona 1 ramai sel merah → pasar <i>overheat</i>, rawan koreksi massal</div>
            <div className="b">S / R = level support &amp; resistance harian</div>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-h"><span className="lbl">Panduan</span></div>
        <div className="panel-b">
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7 }}>
            Satu edisi = satu tanggal, tidak pernah digabung — navigasi arsip lewat
            stepper/tombol tanggal di atas. Tab <b>Mingguan</b> menjawab siapa yang
            BERTAHAN di daftar (bukan sekadar muncul sekali), siapa yang naik kelas
            zona, dan bagaimana nasib harga selama bertahan. Tab <b>Bulanan</b> adalah
            leaderboard keandalan sinyal dari arsip — inilah yang menajamkan skor
            probabilitas di tabel harian; makin panjang arsip, makin keras angkanya.
          </p>
          <p className="rdr-kaki" style={{ marginBottom: 0 }}>
            Sumber: WD Watch List® &amp; WD Penny List® — Saptono Widhi, grup Meta-noia
            (arsip langganan pribadi; legenda cara baca dari publikasi resminya di Harian
            Kontan). Skor probabilitas dihitung Papan dari arsipnya sendiri. Analisis
            probabilistik untuk edukasi — bukan ajakan transaksi.
          </p>
        </div>
      </section>
    </>
  )
}

/**
 * Radar Watchlist (/radar) — arsip WD Watch List (Meta-noia) tampil di web:
 * satu edisi per tanggal (tidak pernah digabung), chart RBU per edisi, cara
 * baca resmi, dan analisa mingguan/bulanan dari akumulasi arsip. Port setia
 * artifact papan-radar-wdwl.html v2 ke token lantai.css.
 */
export function Radar() {
  const { arsip, error } = useArsipRadar()
  const ihsg = useIhsgClose()
  const [tab, setTab] = useState<Tab>('watch')
  /** Indeks edisi terpilih; null = belum dipilih → edisi terbaru. */
  const [pilih, setPilih] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<{ items: GambarLightbox[]; index: number } | null>(null)

  const idx = pilih ?? (arsip ? arsip.length - 1 : 0)
  const edisi: EdisiRadar | null = arsip?.[idx] ?? null

  // Subset arsip pekan & bulan edisi terpilih — bahan rollup.
  const arsipMinggu = useMemo(
    () => (arsip && edisi ? arsip.filter((e) => awalMinggu(e.date_iso) === awalMinggu(edisi.date_iso)) : []),
    [arsip, edisi],
  )
  const arsipBulan = useMemo(
    () => (arsip && edisi ? arsip.filter((e) => e.date_iso.slice(0, 7) === edisi.date_iso.slice(0, 7)) : []),
    [arsip, edisi],
  )

  if (error) {
    return (
      <div className="lantai">
        <div className="vhead"><h1>Radar Watchlist</h1></div>
        <p className="muted">Gagal memuat arsip radar: {error}</p>
      </div>
    )
  }
  if (!arsip || !edisi) {
    return (
      <div className="lantai">
        <div className="vhead"><h1>Radar Watchlist</h1></div>
        <p className="muted">Memuat arsip…</p>
      </div>
    )
  }

  const mingguan = rollupMingguan(arsipMinggu)
  const bulanan = rollupBulanan(arsipBulan, ihsg ?? undefined)
  const maxRet = Math.max(0.001, ...mingguan.map((r) => Math.abs(r.ret ?? 0)))
  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][Number(edisi.date_iso.slice(5, 7)) - 1]
  const rentangMinggu = `${tanggalPendek(arsipMinggu[0].date_iso)}–${tanggalPendek(arsipMinggu[arsipMinggu.length - 1].date_iso)}`

  const zonaLabel: Record<NonNullable<BarisRadar['zona']>, string> = {
    rebound: 'Rebound', breakout: 'Breakout', uptrend: 'Uptrend',
  }

  return (
    <div className="lantai">
      <div className="vhead" style={{ justifyContent: 'space-between' }}>
        <div className="vhead-kiri">
          <h1>Radar Watchlist</h1>
          <span className="sub">arsip WD Watch List — satu edisi per tanggal, skor dari arsip sendiri</span>
        </div>
        <div className="rdr-nav">
          <div className="rdr-arsip" aria-label="Arsip edisi">
            {arsip.map((e, i) => (
              <button
                key={e.date_iso}
                type="button"
                className={`chip-t${i === idx ? ' on' : ''}`}
                title={tanggalPanjang(e.date_iso)}
                onClick={() => setPilih(i)}
              >
                {e.date_iso.slice(8)}
              </button>
            ))}
          </div>
          <div className="rdr-stepper">
            <LangkahTanggal arah="mundur" label="Edisi sebelumnya" disabled={idx === 0} onClick={() => setPilih(idx - 1)} />
            <span className="tgl">{tanggalPanjang(edisi.date_iso)}</span>
            <LangkahTanggal arah="maju" label="Edisi berikutnya" disabled={idx === arsip.length - 1} onClick={() => setPilih(idx + 1)} />
          </div>
        </div>
      </div>
      <KonteksData tanggal={edisi.date_iso} />
      <CatatanCakupan />

      <div className="tabs" role="tablist" aria-label="Bagian radar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tab${tab === t.id ? ' on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'watch' || tab === 'penny') && (
        <section className="panel">
          <div className="panel-h">
            <span className="lbl">{tab === 'watch' ? 'WD Watch List' : 'WD Penny List'} — Edisi {tanggalPendek(edisi.date_iso)}</span>
            <span className="bchip" style={{ marginRight: 0 }}>
              {(tab === 'watch' ? edisi.watch : edisi.penny).length} baris · zona asli dipertahankan
            </span>
          </div>
          <TabelPapan rows={tab === 'watch' ? edisi.watch : edisi.penny} arsip={arsip} />
        </section>
      )}

      {tab === 'rbu' && (
        <section className="panel">
          <div className="panel-h">
            <span className="lbl">Chart RBU — Edisi {tanggalPendek(edisi.date_iso)}</span>
            <span className="bchip" style={{ marginRight: 0 }}>dari PDF, dirender di web</span>
          </div>
          <div className="panel-b">
            {edisi.rbu.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Edisi ini tidak menyertakan chart RBU.</p>
            ) : (
              <div className="rdr-rbu">
                {edisi.rbu.map((tik) => {
                  const src = `/data-idx/radar/rbu/${edisi.date_iso}/${tik}.png`
                  return (
                    <div key={tik} className="rdr-rbu-c">
                      <div className="h">
                        <Link className="tick" to={`/grafik?kode=${tik}`}><b>{tik}</b></Link>
                        <span>MetaStock · sorotan penulis</span>
                      </div>
                      <GambarRbu
                        src={src}
                        tik={tik}
                        onBuka={() => {
                          const items = edisi.rbu.map((t) => ({
                            src: `/data-idx/radar/rbu/${edisi.date_iso}/${t}.png`,
                            keterangan: `${t} · Chart RBU · ${tanggalPanjang(edisi.date_iso)}`,
                          }))
                          setLightbox({ items, index: edisi.rbu.indexOf(tik) })
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            )}
            <p className="rdr-catatan" style={{ marginBottom: 0 }}>
              Tiap halaman PDF RBU dikonversi jadi gambar saat unggah — tampil di sini
              per edisi dan bisa dibesarkan (klik gambar).
            </p>
          </div>
        </section>
      )}

      {tab === 'mingguan' && (
        <section className="panel">
          <div className="panel-h">
            <span className="lbl">Analisa Mingguan — {rentangMinggu}</span>
            <span className="bchip" style={{ marginRight: 0 }}>{arsipMinggu.length} edisi pekan ini</span>
          </div>
          <div className="panel-b rdr-rank">
            {mingguan.slice(0, 10).map((r) => (
              <div key={r.tik} className="rdr-rankrow">
                <span className="t">
                  <Link className="tick" to={`/grafik?kode=${r.tik}`}>{r.tik}</Link>
                  <small>
                    {r.zonaAkhir && r.zonaAkhir !== r.zonaAwal
                      ? `naik zona → ${zonaLabel[r.zonaAkhir]}`
                      : r.edisi > 1
                        ? `bertahan ${r.edisi} edisi`
                        : 'baru masuk daftar'}
                  </small>
                </span>
                <span className={`rdr-bar${r.ret !== null && r.ret < 0 ? ' turun' : r.ret === null ? ' netral' : ''}`}>
                  <i style={{ '--p': `${Math.round((Math.abs(r.ret ?? 0) / maxRet) * 100)}%` } as CSSProperties} />
                </span>
                <span className={`v${r.ret !== null ? (r.ret >= 0 ? ' up' : ' dn') : ''}`}>
                  {r.ret !== null ? fmtPct(r.ret) : '—'} · {r.edisi} edisi
                </span>
              </div>
            ))}
            <p className="rdr-catatan">
              Mingguan menjawab: siapa yang BERTAHAN di daftar (bukan sekadar muncul
              sekali), siapa yang naik kelas zona, dan bagaimana nasib harga selama
              bertahan. Return dihitung dari close kemunculan pertama → terakhir pada
              pekan edisi terpilih.
            </p>
          </div>
        </section>
      )}

      {tab === 'bulanan' && (
        <section className="panel">
          <div className="panel-h">
            <span className="lbl">Analisa Bulanan — {namaBulan}</span>
            <span className="bchip" style={{ marginRight: 0 }}>{arsipBulan.length} edisi (indikatif)</span>
          </div>
          <div className="panel-b rdr-rank">
            {bulanan.map((s) => (
              <div key={s.jenis} className="rdr-rankrow">
                <span className="t">
                  {s.label}
                  <small>{s.n === 0 ? 'belum ada kejadian ber-forward-return' : `${s.n} kejadian di arsip bulan ini`}</small>
                </span>
                <span className={`rdr-bar${s.jenis === 'reds_blacks' ? ' turun' : ''}`}>
                  <i style={{ '--p': `${Math.round(s.rate * 100)}%` } as CSSProperties} />
                </span>
                <span className={`v${s.n > 0 ? (s.rerataRet >= 0 ? ' up' : ' dn') : ''}`}>
                  {s.n > 0 ? `${s.hit}/${s.n} · ${fmtPct(s.rerataRet)}` : '—'}
                </span>
              </div>
            ))}
            <p className="rdr-catatan">
              Bulanan = leaderboard keandalan sinyal: berapa kali tiap jenis setup
              diikuti pergerakan searah ramalannya pada edisi berikutnya (Reds+Blacks
              diramal turun). Benchmark IHSG antar edisi bulan ini:{' '}
              <b>{bulanan[0]?.ihsgRet != null ? fmtPct(bulanan[0].ihsgRet) : '—'}</b>.
              Inilah yang menajamkan skor probabilitas di tabel harian — makin panjang
              arsip, makin keras angkanya.
            </p>
          </div>
        </section>
      )}

      {tab === 'cara' && <CaraBaca />}

      {lightbox && (
        <LightboxGambar
          items={lightbox.items}
          index={lightbox.index}
          onIndex={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

/** Gambar RBU satu ticker — placeholder kalau PNG edisi itu belum diunggah. */
function GambarRbu({ src, tik, onBuka }: { src: string; tik: string; onBuka: () => void }) {
  const [gagal, setGagal] = useState(false)
  // src berubah saat pindah edisi — reset status gagal.
  useEffect(() => setGagal(false), [src])
  if (gagal) {
    return <p className="muted" style={{ margin: 0, padding: '28px 13px', fontSize: 11 }}>Gambar RBU {tik} belum tersedia untuk edisi ini.</p>
  }
  return (
    <button type="button" className="g" title={`Perbesar chart RBU ${tik}`} onClick={onBuka}>
      <img src={src} alt={`Chart RBU ${tik}`} loading="lazy" onError={() => setGagal(true)} />
    </button>
  )
}
