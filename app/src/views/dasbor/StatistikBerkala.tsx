import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { LangkahTanggal } from '../../components/dasbor/LangkahTanggal'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { IkonMenu, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { LABEL_RENTANG } from '../../lib/dasbor/periode'
import {
  angka,
  belahDua,
  bulananKeBanding,
  bulananKePeringkat,
  labelEdisi,
  pangsa,
  persen,
  persenBanding,
  selisihBanding,
  useStatistikBerkala,
  type Banding,
  type BarisKinerjaIndeks,
  type BarisPeringkat,
  type BarisSektor,
  type EdisiBerkala,
  type EdisiBulanan,
  type JenisPeriode,
  type RuasBulanan,
} from '../../lib/dasbor/statistikBerkala'
import './StatistikBerkala.css'

/**
 * Statistik Berkala — satu pekan ATAU satu bulan bursa dari terbitan resmi
 * IDX, yang selama ini sudah dipanen tapi tak pernah punya layar.
 *
 * Kenapa bentuknya "pilih satu edisi, lihat isinya" dan bukan grafik deret
 * panjang: hampir setiap angka di berkasnya SUDAH berpasangan dengan angka
 * periode sebelumnya (rata-rata harian, IHSG, net asing, gainers/losers,
 * indeks global). Pembandingan yang diminta karena itu tidak perlu dirakit
 * dari beberapa berkas — ia sudah ada di dalam satu edisi, dan merakitnya
 * ulang dari edisi tetangga justru akan menghasilkan angka yang berbeda dari
 * terbitan resminya (arsip kita punya pekan yang cuma dua hari bursa).
 *
 * Deret lintas-edisi (mis. tren nilai transaksi 33 pekan) sengaja belum
 * dibuat, dan tata letak ini tidak menghalanginya: pemilih edisi berdiri di
 * kepala halaman, jadi panel deret cukup ditambahkan sebagai tab baru tanpa
 * menyentuh yang sudah ada.
 */

type Tab = 'ringkas' | 'saham' | 'broker' | 'indeks' | 'transaksi'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ringkas', label: 'Ringkasan' },
  { id: 'saham', label: 'Saham' },
  { id: 'broker', label: 'Broker' },
  { id: 'indeks', label: 'Indeks' },
  { id: 'transaksi', label: 'Transaksi' },
]

/** Nama ruas → judul yang bisa dibaca. Ruas yang tak terdaftar TIDAK
 *  disembunyikan — ia tampil dengan nama apa adanya (garis bawah jadi spasi),
 *  supaya ruas baru dari pemanen langsung kelihatan alih-alih hilang senyap. */
const LABEL_RUAS: Record<string, string> = {
  volume_juta_lembar: 'Volume (juta lembar)',
  nilai_miliar_idr: 'Nilai (miliar IDR)',
  nilai_juta_usd: 'Nilai (juta USD)',
  frekuensi_ribu_kali: 'Frekuensi (ribu kali)',
  kapitalisasi_triliun_idr: 'Kapitalisasi (triliun IDR)',
  kapitalisasi_miliar_usd: 'Kapitalisasi (miliar USD)',
  penutupan: 'Penutupan',
  terendah: 'Terendah',
  tertinggi: 'Tertinggi',
  reguler: 'Pasar Reguler',
  tunai: 'Pasar Tunai',
  negosiasi: 'Pasar Negosiasi',
  saham: 'Saham',
  right: 'Right',
  waran: 'Waran',
  waran_terstruktur: 'Waran Terstruktur',
  etf: 'ETF',
  reit: 'REIT',
  total: 'Total',
  beli: 'Beli',
  jual: 'Jual',
  volume: 'Volume',
  value: 'Nilai',
  frekuensi: 'Frekuensi',
  pasar_saham_triliun: 'Pasar saham (triliun IDR)',
  pasar_obligasi_triliun: 'Pasar obligasi (triliun IDR)',
  obligasi_korporasi_idr: 'Obligasi korporasi (IDR)',
  obligasi_korporasi_usd: 'Obligasi korporasi (USD)',
  obligasi_pemerintah_idr: 'Obligasi pemerintah (IDR)',
  obligasi_pemerintah_usd: 'Obligasi pemerintah (USD)',
  rights: 'Rights',
  dinfra: 'DINFRA',
  ihsg: 'IHSG',
  lq45: 'LQ45',
  kapitalisasi: 'Kapitalisasi',
  futures: 'Futures',
}

function labelRuas(k: string): string {
  return LABEL_RUAS[k] ?? k.replace(/_/g, ' ')
}

/** Kelas warna hijau/merah — null TIDAK diwarnai (tak diketahui itu bukan turun). */
function warna(v: number | null): string {
  if (v == null) return 'muted'
  return v >= 0 ? 'green' : 'red'
}

/** Tabel "periode lalu vs periode ini" — bentuk yang dipakai ulang oleh
 *  rata-rata harian, IHSG, gainers/losers, dan indeks global. Satu bentuk,
 *  bukan empat salinan yang lambat laun berbeda. */
function TabelBanding({
  kolomPertama,
  labelLalu,
  labelIni,
  desimal = 0,
  baris,
}: {
  kolomPertama: string
  labelLalu: string
  labelIni: string
  desimal?: number
  baris: { kunci: string; label: string; tautanKode?: string; b: Banding }[]
}) {
  return (
    <div className="board-tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>{kolomPertama}</th>
            <th className="r">{labelLalu}</th>
            <th className="r">{labelIni}</th>
            <th className="r">Selisih</th>
            <th className="r">%</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((r) => {
            const d = selisihBanding(r.b)
            const p = persenBanding(r.b)
            return (
              <tr key={r.kunci}>
                <td>
                  {r.tautanKode
                    ? <Link to={`/grafik?kode=${r.tautanKode}`} className="tick">{r.label}</Link>
                    : r.label}
                </td>
                <td className="r num muted">{angka(r.b.minggu_lalu, desimal)}</td>
                <td className="r num">{angka(r.b.minggu_ini, desimal)}</td>
                <td className={`r num ${warna(d)}`}>{angka(d, desimal)}</td>
                <td className={`r num ${warna(p)}`}>{persen(p)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Tabel peringkat sederhana (top saham / top broker): kode, nama, nilai, %. */
function TabelPeringkat({ judul, baris, tautan }: { judul: string; baris: BarisPeringkat[]; tautan: boolean }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">{judul}</span></div>
      <div className="board-tbl-wrap">
        {baris.length === 0 ? (
          <p className="muted stb-kosong">Tidak tercantum di edisi ini.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Kode</th>
                {!tautan && <th>Nama</th>}
                <th className="r">Nilai</th>
                <th className="r">% pasar</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((r) => (
                <tr key={r.kode}>
                  <td>
                    {tautan
                      ? <Link to={`/grafik?kode=${r.kode}`} className="tick">{r.kode}</Link>
                      : <span className="bchip">{r.kode}</span>}
                  </td>
                  {!tautan && <td className="muted">{r.nama ?? '—'}</td>}
                  <td className="r num">{angka(r.nilai)}</td>
                  <td className="r num muted">{pangsa(r.persen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function PanelKosong({ judul, alasan }: { judul: string; alasan: string }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">{judul}</span></div>
      <div className="panel-b"><p className="muted stb-kosong">{alasan}</p></div>
    </div>
  )
}

export function StatistikBerkala() {
  const [jenis, setJenis] = useState<JenisPeriode>('minggu')
  const [tab, setTab] = useState<Tab>('ringkas')
  const { daftar, idx, edisi, galat, pilih } = useStatistikBerkala(jenis)

  // Bulanan dan mingguan punya bentuk berkas yang beda (lihat statistikBerkala.ts),
  // jadi tab di bawah bercabang lewat `edisiBulanan` — bukan berarti chipnya
  // perlu dimatikan lagi.
  const opsiJenis = useMemo(() => ([
    { id: 'minggu' as const, label: LABEL_RENTANG.w1, judul: 'Rekap per pekan bursa' },
    { id: 'bulan' as const, label: LABEL_RENTANG.b1, judul: 'Rekap per bulan bursa' },
  ]), [])

  // Pemilih edisi: yang TERBARU di atas (yang dicari orang lebih dulu),
  // sementara `daftar` tetap urut naik supaya "berikutnya" = indeks + 1.
  const opsiEdisi = useMemo(
    () => (daftar ?? []).map((e, i) => ({ nilai: String(i), label: labelEdisi(e) })).reverse(),
    [daftar],
  )

  const kataPeriode = jenis === 'minggu' ? 'pekan' : 'bulan'
  const labelLalu = jenis === 'minggu' ? 'Pekan lalu' : 'Bulan lalu'
  const labelIni = jenis === 'minggu' ? 'Pekan ini' : 'Bulan ini'

  const kepala = (
    <div className="vhead stb-head">
      <div>
        <h1>Statistik {jenis === 'minggu' ? 'Mingguan' : 'Bulanan'}</h1>
        <span className="sub">
          rekap satu {kataPeriode} bursa — tiap angka berpasangan dengan {kataPeriode} sebelumnya
        </span>
      </div>
      <div className="stb-nav">
        <PemilihRentang opsi={opsiJenis} nilai={jenis} onGanti={setJenis} ariaLabel="Panjang periode" />
        {daftar && idx != null && (
          <div className="stb-langkah">
            <LangkahTanggal
              arah="mundur"
              ukuran="sebaris"
              label={`${labelIni === 'Pekan ini' ? 'Pekan' : 'Bulan'} sebelumnya`}
              disabled={idx === 0}
              onClick={() => pilih(idx - 1)}
            />
            <Dropdown
              opsi={opsiEdisi}
              nilai={String(idx)}
              onGanti={(v) => pilih(Number(v))}
              ariaLabel={`Pilih ${kataPeriode}`}
              rata="kanan"
            />
            <LangkahTanggal
              arah="maju"
              ukuran="sebaris"
              label={`${labelIni === 'Pekan ini' ? 'Pekan' : 'Bulan'} berikutnya`}
              disabled={idx === daftar.length - 1}
              onClick={() => pilih(idx + 1)}
            />
          </div>
        )}
      </div>
    </div>
  )

  if (galat) {
    return (
      <div className="lantai">
        {kepala}
        <div className="panel">
          <div className="panel-b stb-pesan">
            <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
            <p className="lbl">{galat}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!edisi) {
    return (
      <div className="lantai">
        {kepala}
        <div className="panel"><div className="panel-b stb-pesan"><p className="lbl">Memuat edisi…</p></div></div>
      </div>
    )
  }

  // Bentuk berkas bulanan TIDAK sebangun dengan mingguan (lihat
  // statistikBerkala.ts) — `useStatistikBerkala` memuat keduanya lewat jalur
  // yang sama (`json as EdisiBerkala`), jadi di sini yang membedakannya cuma
  // `jenis`. Cast ini sama longgarnya dengan yang sudah dilakukan si pemuat.
  const edisiBulanan = jenis === 'bulan' ? (edisi as unknown as EdisiBulanan) : null

  return (
    <div className="lantai">
      {kepala}

      <div className="tabs" role="tablist" aria-label="Bagian statistik">
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

      {tab === 'ringkas' && (edisiBulanan
        ? <TabRingkasBulanan edisi={edisiBulanan} />
        : <TabRingkas edisi={edisi} labelLalu={labelLalu} labelIni={labelIni} kataPeriode={kataPeriode} />)}
      {tab === 'saham' && (edisiBulanan
        ? <TabSahamBulanan edisi={edisiBulanan} labelLalu={labelLalu} labelIni={labelIni} />
        : <TabSaham edisi={edisi} labelLalu={labelLalu} labelIni={labelIni} />)}
      {tab === 'broker' && (edisiBulanan ? <TabBrokerBulanan edisi={edisiBulanan} /> : <TabBroker edisi={edisi} />)}
      {tab === 'indeks' && (edisiBulanan
        ? <TabIndeksBulanan edisi={edisiBulanan} />
        : <TabIndeks edisi={edisi} labelLalu={labelLalu} labelIni={labelIni} />)}
      {tab === 'transaksi' && (edisiBulanan ? <TabTransaksiBulanan edisi={edisiBulanan} /> : <TabTransaksi edisi={edisi} />)}

      <p className="muted stb-sumber">
        Sumber: terbitan statistik berkala resmi Bursa Efek Indonesia, edisi {labelEdisi(edisi)}.
        Ruas yang tidak tercantum di edisinya ditulis “—”, bukan nol.{' '}
        <Link to="/metodologi" className="kd-tautan">Metodologi &amp; sumber data →</Link>
      </p>
    </div>
  )
}

function TabRingkas({
  edisi, labelLalu, labelIni, kataPeriode,
}: { edisi: EdisiBerkala; labelLalu: string; labelIni: string; kataPeriode: string }) {
  const total = edisi.minggu_ini ?? {}
  const net = edisi.net_asing
  const rata = Object.entries(edisi.rata_rata_harian ?? {})
  const ihsg = Object.entries(edisi.ihsg ?? {})
  const dana = Object.entries(edisi.dana_dihimpun ?? {})

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <span className="t-code">Total {kataPeriode} ini</span>
          <span className="t-name">Nilai transaksi</span>
          <span className="t-val num">{angka(total.nilai_miliar_idr)} <small className="muted">miliar IDR</small></span>
        </div>
        <div className="tile">
          <span className="t-code">Total {kataPeriode} ini</span>
          <span className="t-name">Volume</span>
          <span className="t-val num">{angka(total.volume_juta_lembar)} <small className="muted">juta lembar</small></span>
        </div>
        <div className="tile">
          <span className="t-code">Total {kataPeriode} ini</span>
          <span className="t-name">Nilai transaksi (USD)</span>
          <span className="t-val num">{angka(total.nilai_juta_usd)} <small className="muted">juta USD</small></span>
        </div>
        <div className="tile">
          <span className="t-code">{net?.minggu_ini?.arah ? `Asing net ${net.minggu_ini.arah}` : 'Asing'}</span>
          <span className="t-name">Net asing</span>
          <span className="t-val num">{angka(net?.minggu_ini?.miliar_idr, 2)} <small className="muted">miliar IDR</small></span>
        </div>
      </div>

      <div className="grid2 stb-jajar">
        <div className="panel">
          <div className="panel-h"><span className="lbl">Rata-rata harian</span></div>
          {rata.length === 0
            ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
            : (
              <TabelBanding
                kolomPertama="Ruas"
                labelLalu={labelLalu}
                labelIni={labelIni}
                baris={rata.map(([k, b]) => ({ kunci: k, label: labelRuas(k), b }))}
              />
            )}
        </div>

        <div className="panel">
          <div className="panel-h"><span className="lbl">IHSG</span></div>
          {ihsg.length === 0
            ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
            : (
              <TabelBanding
                kolomPertama="Ruas"
                labelLalu={labelLalu}
                labelIni={labelIni}
                desimal={3}
                baris={ihsg.map(([k, b]) => ({ kunci: k, label: labelRuas(k), b }))}
              />
            )}
        </div>
      </div>

      <div className="grid2 stb-jajar">
        {net ? (
          <div className="panel">
            <div className="panel-h"><span className="lbl">Net asing</span></div>
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Periode</th><th>Arah</th><th className="r">Miliar IDR</th><th className="r">Juta USD</th></tr>
                </thead>
                <tbody>
                  {([['minggu_lalu', labelLalu], ['minggu_ini', labelIni]] as const).map(([k, l]) => (
                    <tr key={k}>
                      <td>{l}</td>
                      <td className="muted">{net[k]?.arah ?? '—'}</td>
                      <td className="r num">{angka(net[k]?.miliar_idr, 2)}</td>
                      <td className="r num">{angka(net[k]?.juta_usd, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // Terukur: edisi 14 Agu 2026 memang tak memuat net asing sementara
          // 32 edisi lain memuatnya. Nol di sini akan berbunyi "asing tidak
          // bertransaksi" — pernyataan yang salah.
          <PanelKosong judul="Net asing" alasan="Edisi ini tidak memuat rekap net asing." />
        )}

        <div className="panel">
          <div className="panel-h"><span className="lbl">Dana dihimpun</span></div>
          {dana.length === 0
            ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
            : (
              <div className="board-tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Ruas</th><th className="r">Nilai</th></tr></thead>
                  <tbody>
                    {dana.map(([k, v]) => (
                      <tr key={k}>
                        <td>{labelRuas(k)}</td>
                        <td className="r num">{angka(v, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>
    </>
  )
}

function TabSaham({ edisi, labelLalu, labelIni }: { edisi: EdisiBerkala; labelLalu: string; labelIni: string }) {
  const gainers = edisi.top_gainers ?? []
  const losers = edisi.top_losers ?? []
  const top = edisi.top_saham ?? {}
  const movers = Object.entries(edisi.index_movers ?? {})

  return (
    <>
      <div className="grid2 stb-jajar">
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Gainers</span></div>
          {gainers.length === 0
            ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
            : (
              <TabelBanding
                kolomPertama="Kode"
                labelLalu={labelLalu}
                labelIni={labelIni}
                baris={gainers.map((g) => ({ kunci: g.kode, label: g.kode, tautanKode: g.kode, b: g }))}
              />
            )}
        </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Losers</span></div>
          {losers.length === 0
            ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
            : (
              <TabelBanding
                kolomPertama="Kode"
                labelLalu={labelLalu}
                labelIni={labelIni}
                baris={losers.map((g) => ({ kunci: g.kode, label: g.kode, tautanKode: g.kode, b: g }))}
              />
            )}
        </div>
      </div>

      <div className="grid3 stb-jajar">
        {['volume', 'value', 'frekuensi'].map((k) => (
          <TabelPeringkat key={k} judul={`Top Saham — ${labelRuas(k)}`} baris={top[k] ?? []} tautan />
        ))}
      </div>

      <div className="grid2 stb-jajar">
        {movers.map(([indeks, isi]) => (
          <TabelPenggerak
            key={indeks}
            judul={`Penggerak ${labelRuas(indeks)}`}
            labelKapitalisasi="MCFF (triliun)"
            baris={[
              ...(isi.top_leaders ?? []).map((m) => ({
                kode: m.kode, arah: 'Pendorong', hargaPersen: m.harga_persen, kapitalisasi: m.mcff_triliun, poinIndeks: m.poin_indeks,
              })),
              ...(isi.top_laggards ?? []).map((m) => ({
                kode: m.kode, arah: 'Penekan', hargaPersen: m.harga_persen, kapitalisasi: m.mcff_triliun, poinIndeks: m.poin_indeks,
              })),
            ]}
          />
        ))}
      </div>
    </>
  )
}

/** Tabel "pendorong/penekan indeks" — dipakai ulang oleh mingguan (kolom
 *  ketiganya MCFF, kontribusi free-float) dan bulanan (kolom ketiganya
 *  kapitalisasi pasar). Dua metrik itu BEDA artinya, karena itu labelnya
 *  parameter, bukan ditebak sama. */
function TabelPenggerak({
  judul, labelKapitalisasi, baris,
}: {
  judul: string
  labelKapitalisasi: string
  baris: { kode: string; arah: string; hargaPersen?: number | null; kapitalisasi?: number | null; poinIndeks?: number | null }[]
}) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">{judul}</span></div>
      <div className="board-tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Kode</th><th>Arah</th><th className="r">Harga %</th>
              <th className="r">{labelKapitalisasi}</th><th className="r">Poin indeks</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={`${b.arah}-${b.kode}`}>
                <td><Link to={`/grafik?kode=${b.kode}`} className="tick">{b.kode}</Link></td>
                <td className="muted">{b.arah}</td>
                <td className={`r num ${warna(b.hargaPersen ?? null)}`}>{persen(b.hargaPersen)}</td>
                <td className="r num">{angka(b.kapitalisasi, 2)}</td>
                <td className={`r num ${warna(b.poinIndeks ?? null)}`}>{angka(b.poinIndeks, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {baris.length === 0 && <p className="muted stb-kosong">Tidak tercantum di edisi ini.</p>}
      </div>
    </div>
  )
}

function TabBroker({ edisi }: { edisi: EdisiBerkala }) {
  const top = edisi.top_broker ?? {}
  const kunci = Object.keys(top)
  if (kunci.length === 0) return <PanelKosong judul="Top Broker" alasan="Edisi ini tidak memuat peringkat broker." />
  return (
    <div className="grid2 stb-jajar">
      {kunci.map((k) => (
        <TabelPeringkat key={k} judul={`Top Broker — ${labelRuas(k)}`} baris={top[k] ?? []} tautan={false} />
      ))}
    </div>
  )
}

function TabIndeks({ edisi, labelLalu, labelIni }: { edisi: EdisiBerkala; labelLalu: string; labelIni: string }) {
  const lokal = edisi.indeks_mingguan ?? []
  const global = edisi.indeks_global ?? []
  return (
    <>
      <div className="panel">
        <div className="panel-h"><span className="lbl">Indeks IDX</span></div>
        {lokal.length === 0
          ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
          : (
            <div className="board-tbl-wrap stb-panjang">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Indeks</th><th className="r">Tertinggi</th><th className="r">Terendah</th>
                    <th className="r">Penutupan</th><th className="r">%</th>
                  </tr>
                </thead>
                <tbody>
                  {lokal.map((r) => (
                    <tr key={r.nama}>
                      <td>{r.nama}</td>
                      <td className="r num muted">{angka(r.tertinggi, 3)}</td>
                      <td className="r num muted">{angka(r.terendah, 3)}</td>
                      <td className="r num">{angka(r.penutupan, 3)}</td>
                      <td className={`r num ${warna(r.persen ?? null)}`}>{persen(r.persen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Indeks dunia</span></div>
        {global.length === 0
          ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
          : (
            <div className="board-tbl-wrap stb-panjang">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Wilayah</th><th>Negara</th><th>Indeks</th>
                    <th className="r">{labelLalu}</th><th className="r">{labelIni}</th>
                    <th className="r">Selisih</th><th className="r">%</th>
                  </tr>
                </thead>
                <tbody>
                  {global.map((r, i) => {
                    const d = selisihBanding(r)
                    const p = persenBanding(r)
                    return (
                      <tr key={`${r.negara ?? i}-${r.indeks ?? i}`}>
                        <td className="muted">{r.wilayah ?? '—'}</td>
                        <td>{r.negara ?? '—'}</td>
                        <td className="muted">{r.indeks ?? '—'}</td>
                        <td className="r num muted">{angka(r.minggu_lalu, 2)}</td>
                        <td className="r num">{angka(r.minggu_ini, 2)}</td>
                        <td className={`r num ${warna(d)}`}>{angka(d, 2)}</td>
                        <td className={`r num ${warna(p)}`}>{persen(p)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </>
  )
}

function TabTransaksi({ edisi }: { edisi: EdisiBerkala }) {
  const harian = edisi.transaksi_investor ?? []
  const rekap = Object.entries(edisi.rekap_transaksi ?? {})
  const instrumen = Object.entries(edisi.ringkasan_perdagangan?.instrumen ?? {})
  const asing = Object.entries(edisi.ringkasan_perdagangan?.transaksi_asing ?? {})
  // Kode pasangan investor (FF/DF/FD/DD) dibiarkan APA ADANYA seperti di
  // sumbernya. Menerjemahkannya jadi "asing beli–domestik jual" berarti
  // menebak sisi mana yang ditulis lebih dulu, dan tebakan yang salah di sini
  // membalik arti seluruh tabel.
  const kodePasangan = harian[0] ? Object.keys(harian[0].nilai_miliar_idr ?? {}) : []

  return (
    <>
      <div className="panel">
        <div className="panel-h">
          <span className="lbl">Transaksi investor per hari — nilai (miliar IDR)</span>
        </div>
        {harian.length === 0
          ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
          : (
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    {kodePasangan.map((k) => <th className="r" key={k}>{k.toUpperCase()}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {harian.map((h) => (
                    <tr key={h.tanggal_iso}>
                      <td className="num">{h.tanggal_iso}</td>
                      {kodePasangan.map((k) => (
                        <td className="r num" key={k}>{angka(h.nilai_miliar_idr?.[k])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted stb-kosong">
                Kode pasangan investor ditulis persis seperti di terbitan sumber (F = asing, D = domestik).
              </p>
            </div>
          )}
      </div>

      <div className="grid2 stb-jajar">
        <div className="panel">
          <div className="panel-h"><span className="lbl">Rekap per papan</span></div>
          {rekap.length === 0
            ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
            : (
              <div className="board-tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Papan</th><th className="r">Volume</th><th className="r">% pasar</th>
                      <th className="r">Nilai</th><th className="r">% pasar</th>
                      <th className="r">Frekuensi</th><th className="r">% pasar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekap.map(([k, v]) => (
                      <tr key={k}>
                        <td>{labelRuas(k)}</td>
                        <td className="r num">{angka(v.volume)}</td>
                        <td className="r num muted">{pangsa(v.volume_persen)}</td>
                        <td className="r num">{angka(v.nilai)}</td>
                        <td className="r num muted">{pangsa(v.nilai_persen)}</td>
                        <td className="r num">{angka(v.frekuensi)}</td>
                        <td className="r num muted">{pangsa(v.frekuensi_persen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        <div className="panel">
          <div className="panel-h"><span className="lbl">Per instrumen</span></div>
          {instrumen.length === 0
            ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
            : (
              <div className="board-tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Instrumen</th><th className="r">Volume (lembar)</th><th className="r">Nilai (IDR)</th><th className="r">Frekuensi</th></tr>
                  </thead>
                  <tbody>
                    {instrumen.map(([k, v]) => (
                      <tr key={k}>
                        <td>{labelRuas(k)}</td>
                        <td className="r num">{angka(v.volume_lembar)}</td>
                        <td className="r num">{angka(v.nilai_idr)}</td>
                        <td className="r num">{angka(v.frekuensi_kali)}</td>
                      </tr>
                    ))}
                    {asing.map(([k, v]) => (
                      <tr key={`asing-${k}`}>
                        <td>Asing — {labelRuas(k)}</td>
                        <td className="r num">{angka(v.volume_lembar)}</td>
                        <td className="r num">{angka(v.nilai_idr)}</td>
                        <td className="r num">{angka(v.frekuensi_kali)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>
    </>
  )
}

/* ================= Bulanan ================= *
 * Bentuk berkasnya beda dari mingguan (lihat statistikBerkala.ts). Ruas yang
 * bisa diadaptasi ke tipe mingguan (gainers/losers, top saham/broker,
 * penggerak indeks) memakai komponen tabel di atas lewat `bulananKeBanding()`
 * / `bulananKePeringkat()`. Ruas khas bulanan (ringkasan pasar, asing,
 * syariah, sektor, kinerja indeks, rekap transaksi) dapat tabelnya sendiri. */

/** Ringkasan pasar / asing / syariah — sama-sama larik `{label, bulan_ini,
 *  bulan_lalu, tahun_lalu, mom, yoy}`. Satu bentuk tabel untuk ketiganya. */
function TabelRuasBulanan({ judul, baris }: { judul: string; baris: [string, RuasBulanan][] }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">{judul}</span></div>
      {baris.length === 0
        ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
        : (
          <div className="board-tbl-wrap stb-panjang">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ruas</th><th className="r">Bulan lalu</th><th className="r">Bulan ini</th>
                  <th className="r">Tahun lalu</th><th className="r">MoM</th><th className="r">YoY</th>
                </tr>
              </thead>
              <tbody>
                {baris.map(([k, v]) => (
                  <tr key={k}>
                    <td>{v.label ?? labelRuas(k)}</td>
                    <td className="r num muted">{angka(v.bulan_lalu, 3)}</td>
                    <td className="r num">{angka(v.bulan_ini, 3)}</td>
                    <td className="r num muted">{angka(v.tahun_lalu, 3)}</td>
                    <td className={`r num ${warna(v.mom ?? null)}`}>{persen(v.mom)}</td>
                    <td className={`r num ${warna(v.yoy ?? null)}`}>{persen(v.yoy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

function TabelSektor({ baris }: { baris: BarisSektor[] }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Sektor</span></div>
      {baris.length === 0
        ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
        : (
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Sektor</th><th className="r">Saham</th><th className="r">% saham</th>
                  <th className="r">Kapitalisasi (miliar)</th><th className="r">% kap</th>
                  <th className="r">Nilai (miliar)</th><th className="r">% nilai</th>
                  <th className="r">Volume (juta)</th><th className="r">Frekuensi</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((s) => (
                  <tr key={s.kode}>
                    <td>{s.nama}</td>
                    <td className="r num">{angka(s.jumlah_saham)}</td>
                    <td className="r num muted">{pangsa(s.persen_saham)}</td>
                    <td className="r num">{angka(s.kapitalisasi_miliar_idr)}</td>
                    <td className="r num muted">{pangsa(s.persen_kapitalisasi)}</td>
                    <td className="r num">{angka(s.nilai_miliar_idr)}</td>
                    <td className="r num muted">{pangsa(s.persen_nilai)}</td>
                    <td className="r num">{angka(s.volume_juta_lembar)}</td>
                    <td className="r num">{angka(s.frekuensi_kali)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

/** Laporan kinerja indeks (45 indeks × m1/m3/m6/y1/y3/y5/y10 + volatilitas) —
 *  tak ada padanannya di mingguan, jadi tabelnya sendiri. Digulung di dalam
 *  panelnya (pola sama dengan tabel Indeks IDX mingguan). */
function TabelKinerjaIndeks({ baris }: { baris: BarisKinerjaIndeks[] }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Kinerja Indeks</span></div>
      {baris.length === 0
        ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
        : (
          <div className="board-tbl-wrap stb-panjang">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Indeks</th><th>Kelompok</th>
                  <th className="r">1B</th><th className="r">3B</th><th className="r">6B</th>
                  <th className="r">1T</th><th className="r">3T</th><th className="r">5T</th><th className="r">10T</th>
                  <th className="r">Volatilitas</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((r) => (
                  <tr key={r.kode}>
                    <td>{r.nama}</td>
                    <td className="muted">{r.kelompok}</td>
                    <td className={`r num ${warna(r.m1 ?? null)}`}>{persen(r.m1)}</td>
                    <td className={`r num ${warna(r.m3 ?? null)}`}>{persen(r.m3)}</td>
                    <td className={`r num ${warna(r.m6 ?? null)}`}>{persen(r.m6)}</td>
                    <td className={`r num ${warna(r.y1 ?? null)}`}>{persen(r.y1)}</td>
                    <td className={`r num ${warna(r.y3 ?? null)}`}>{persen(r.y3)}</td>
                    <td className={`r num ${warna(r.y5 ?? null)}`}>{persen(r.y5)}</td>
                    <td className={`r num ${warna(r.y10 ?? null)}`}>{persen(r.y10)}</td>
                    <td className="r num muted">{persen(r.volatilitas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

function TabRingkasBulanan({ edisi }: { edisi: EdisiBulanan }) {
  const sek = edisi.sekuritas_tercatat ?? {}
  const ringkas = Object.entries(edisi.ringkasan_pasar ?? {})
  const asingRuas = Object.entries(edisi.asing ?? {})
  const syariah = Object.entries(edisi.syariah ?? {})

  return (
    <>
      <div className="tiles">
        {(['saham', 'waran_terstruktur', 'etf', 'reit', 'futures'] as const).map((k) => (
          <div className="tile" key={k}>
            <span className="t-code">Sekuritas tercatat</span>
            <span className="t-name">{labelRuas(k)}</span>
            <span className="t-val num">{angka(sek[k])}</span>
          </div>
        ))}
      </div>

      <TabelRuasBulanan judul="Ringkasan pasar" baris={ringkas} />

      <div className="grid2 stb-jajar">
        <TabelRuasBulanan judul="Perdagangan asing" baris={asingRuas} />
        <TabelRuasBulanan judul="Pasar syariah" baris={syariah} />
      </div>
    </>
  )
}

function TabSahamBulanan({
  edisi, labelLalu, labelIni,
}: { edisi: EdisiBulanan; labelLalu: string; labelIni: string }) {
  const gainers = (edisi.top_gainers ?? []).map(bulananKeBanding)
  const losers = (edisi.top_losers ?? []).map(bulananKeBanding)
  const gainersLq = (edisi.top_gainers_lq45 ?? []).map(bulananKeBanding)
  const losersLq = (edisi.top_losers_lq45 ?? []).map(bulananKeBanding)
  const top = edisi.top_saham ?? {}
  // `value`/`volume` masing-masing dua peringkat digabung tanpa penanda —
  // lihat catatan `belahDua()` di statistikBerkala.ts. `value` → Nilai
  // bulan/YTD, `volume` → Volume bulan/Frekuensi bulan (BUKAN volume YTD).
  const [nilaiBulan, nilaiYtd] = belahDua(top.value ?? [])
  const [volumeBulan, frekuensiBulan] = belahDua(top.volume ?? [])
  const movers = Object.entries(edisi.index_movers ?? {})
  const sektor = edisi.sektor ?? []

  const panelBanding = (judul: string, baris: ReturnType<typeof bulananKeBanding>[]) => (
    <div className="panel">
      <div className="panel-h"><span className="lbl">{judul}</span></div>
      {baris.length === 0
        ? <div className="panel-b"><p className="muted stb-kosong">Tidak tercantum di edisi ini.</p></div>
        : (
          <TabelBanding
            kolomPertama="Kode"
            labelLalu={labelLalu}
            labelIni={labelIni}
            baris={baris.map((g) => ({ kunci: g.kode, label: g.kode, tautanKode: g.kode, b: g }))}
          />
        )}
    </div>
  )

  return (
    <>
      <div className="grid2 stb-jajar">
        {panelBanding('Top Gainers', gainers)}
        {panelBanding('Top Losers', losers)}
      </div>

      <div className="grid2 stb-jajar">
        {panelBanding('Top Gainers LQ45', gainersLq)}
        {panelBanding('Top Losers LQ45', losersLq)}
      </div>

      <div className="grid3 stb-jajar">
        <TabelPeringkat judul="Top Saham — Kapitalisasi" baris={(top.kapitalisasi ?? []).map(bulananKePeringkat)} tautan />
        <TabelPeringkat judul="Top Saham — Nilai (Bulan)" baris={nilaiBulan.map(bulananKePeringkat)} tautan />
        <TabelPeringkat judul="Top Saham — Nilai (YTD)" baris={nilaiYtd.map(bulananKePeringkat)} tautan />
      </div>
      <div className="grid2 stb-jajar">
        <TabelPeringkat judul="Top Saham — Volume (Bulan)" baris={volumeBulan.map(bulananKePeringkat)} tautan />
        <TabelPeringkat judul="Top Saham — Frekuensi (Bulan)" baris={frekuensiBulan.map(bulananKePeringkat)} tautan />
      </div>

      <TabelSektor baris={sektor} />

      <div className="grid2 stb-jajar">
        {movers.map(([indeks, isi]) => (
          <TabelPenggerak
            key={indeks}
            judul={`Penggerak ${labelRuas(indeks)}`}
            labelKapitalisasi="Kapitalisasi (triliun IDR)"
            baris={[
              ...(isi.top_leaders ?? []).map((m) => ({
                kode: m.kode, arah: 'Pendorong', hargaPersen: m.persen, kapitalisasi: m.kapitalisasi_triliun_idr, poinIndeks: m.poin,
              })),
              ...(isi.top_laggards ?? []).map((m) => ({
                kode: m.kode, arah: 'Penekan', hargaPersen: m.persen, kapitalisasi: m.kapitalisasi_triliun_idr, poinIndeks: m.poin,
              })),
            ]}
          />
        ))}
      </div>
    </>
  )
}

function TabBrokerBulanan({ edisi }: { edisi: EdisiBulanan }) {
  const top = edisi.top_broker ?? {}
  if (!top.value && !top.volume) {
    return <PanelKosong judul="Top Broker" alasan="Edisi ini tidak memuat peringkat broker." />
  }
  // Sama seperti Top Saham: `value`/`volume` masing-masing dua peringkat
  // digabung tanpa penanda — lihat catatan `belahDua()` di statistikBerkala.ts.
  const [nilaiBulan, nilaiYtd] = belahDua(top.value ?? [])
  const [volumeBulan, frekuensiBulan] = belahDua(top.volume ?? [])
  return (
    <>
      <div className="grid2 stb-jajar">
        <TabelPeringkat judul="Top Broker — Nilai (Bulan)" baris={nilaiBulan.map(bulananKePeringkat)} tautan={false} />
        <TabelPeringkat judul="Top Broker — Nilai (YTD)" baris={nilaiYtd.map(bulananKePeringkat)} tautan={false} />
      </div>
      <div className="grid2 stb-jajar">
        <TabelPeringkat judul="Top Broker — Volume (Bulan)" baris={volumeBulan.map(bulananKePeringkat)} tautan={false} />
        <TabelPeringkat judul="Top Broker — Frekuensi (Bulan)" baris={frekuensiBulan.map(bulananKePeringkat)} tautan={false} />
      </div>
    </>
  )
}

function TabIndeksBulanan({ edisi }: { edisi: EdisiBulanan }) {
  return <TabelKinerjaIndeks baris={edisi.indeks_kinerja ?? []} />
}

function TabTransaksiBulanan({ edisi }: { edisi: EdisiBulanan }) {
  const rekap = Object.entries(edisi.rekap_transaksi ?? {})
  if (rekap.length === 0) return <PanelKosong judul="Rekap per papan" alasan="Edisi ini tidak memuat rekap transaksi." />
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Rekap per papan</span></div>
      <div className="board-tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Papan</th>
              <th className="r">Volume (bulan)</th><th className="r">Volume (YTD)</th>
              <th className="r">Nilai (bulan)</th><th className="r">Nilai (YTD)</th>
              <th className="r">Frekuensi (bulan)</th><th className="r">Frekuensi (YTD)</th>
            </tr>
          </thead>
          <tbody>
            {rekap.map(([k, v]) => (
              <tr key={k}>
                <td>{labelRuas(k)}</td>
                <td className="r num">{angka(v.volume?.bulan)}</td>
                <td className="r num muted">{angka(v.volume?.ytd)}</td>
                <td className="r num">{angka(v.nilai?.bulan)}</td>
                <td className="r num muted">{angka(v.nilai?.ytd)}</td>
                <td className="r num">{angka(v.frekuensi?.bulan)}</td>
                <td className="r num muted">{angka(v.frekuensi?.ytd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
