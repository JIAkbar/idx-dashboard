import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { PanelAliranAsing } from '../../components/dasbor/PanelAliranAsing'
import { LencanaTurunan } from '../../components/dasbor/LencanaTurunan'
import { IkonMenu, IKON_CARI, IKON_JAM, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import {
  useStockAsing,
  useStockFundamental,
  useStockIndex,
  type StockFundamental,
} from '../../lib/dasbor/stockDetailData'
import { useSektorIdx, sektorEmiten, papanBerisiko } from '../../lib/dasbor/sektorIdx'
import { usePengendali, pengendaliEmiten, labelPengendali } from '../../lib/dasbor/pengendali'
import {
  LABEL_VONIS,
  MIN_TAHUN,
  rasioKini,
  ringkasRasio,
  useValuasiHistoris,
  valuasiEmiten,
  type RingkasRasio,
  type Vonis,
} from '../../lib/dasbor/valuasiHistoris'
import {
  cagr,
  deretKuartal,
  deretTahun,
  kekuatanRisiko,
  konflikSumbu,
  kualitasLaba,
  labelSkor,
  langkahMoneyFlow,
  marjin,
  keP,
  panelKhas,
  ringkasTransaksi,
  sambunganFlow,
  skorPilar,
  skorTotal,
  sumbuSektor,
  type Pilar,
  type Sumbu,
  type TitikTahun,
} from '../../lib/dasbor/bedahEmiten'
import { PanelLaporanKeuangan } from './stock-detail/PanelLaporanKeuangan'
import { fEps, fMC, fRingkas, fv, fvx } from '../../lib/dasbor/stockDetailFormat'
import { tanggalPendek } from '../../lib/dasbor/statistikBerkala'
import { keFraksi } from '../../lib/fraksiHarga'
import { GLOSARIUM } from '../../lib/dasbor/glosarium'
import './BedahEmiten.css'

/**
 * Halaman **Bedah Emiten** (backlog A2 / #153) — dua belas seksi yang membaca
 * satu emiten dari uang masuk sampai vonis, tiap angka membawa periode dan
 * asalnya.
 *
 * Bukan halaman terbitan. `arus-pasar/build_bedah.py` dan tab admin `BedahTab`
 * memakai nama "Bedah" juga, tapi itu **edisi PDF** — tak ada hubungannya
 * dengan halaman ini selain namanya.
 *
 * ## Yang membedakannya dari Stock Detail
 *
 * Stock Detail memajang RUAS: puluhan panel berisi angka, pembacanya yang
 * merangkai. Halaman ini merangkai lebih dulu — lima langkah uang berjalan,
 * dua sumbu valuasi yang konfliknya disebut, lima pilar skor yang aturannya
 * ditulis di layar. Keduanya membaca berkas yang sama; yang berbeda cuma
 * siapa yang mengerjakan perangkaiannya.
 *
 * ## Aturan yang mengikat halaman ini
 *
 * - **Angka arus (pendapatan, laba, arus kas) datang dari SATU sumber**:
 *   `fundamental/{KODE}.json`. `keuangan/` (yfinance, diskret) dan
 *   `keuangan_idx/` (XBRL, kumulatif) berkunci tanggal yang sama tapi
 *   menghitung rentang yang berbeda — menggabungkannya per-ruas memberi angka
 *   hampir dua kali lipat tanpa satu pun galat (terukur TLKM 1,96×). Satu
 *   -satunya tempat keduanya bertemu di halaman ini adalah seksi 9, lewat
 *   `PanelLaporanKeuangan` yang memang sudah punya aturan penggabungannya
 *   sendiri dan menandai asal tiap sel.
 * - **Emiten berdata kurang tak diberi vonis** — "Belum tersedia", tak pernah 0.
 * - **Rule-engine, bukan LLM.** Disclaimer di seksi 10 menyebutnya.
 */

const POPULER = ['BBCA', 'BBRI', 'TLKM', 'ASII', 'AMMN', 'TPIA']

interface DefSeksi {
  id: string
  no: number
  judul: string
}

/** Satu sumber urutan & judul seksi — dipakai bilah lompat DAN kepala tiap
 *  seksi, supaya nomor di bilah tak bisa melenceng dari nomor di badan. */
const SEKSI: DefSeksi[] = [
  { id: 'kepala', no: 1, judul: 'Kepala Emiten' },
  { id: 'transaksi', no: 2, judul: 'Aktivitas Transaksi' },
  { id: 'asing', no: 3, judul: 'Aliran Asing' },
  { id: 'flow', no: 4, judul: 'Lima Langkah Uang' },
  { id: 'lintasan', no: 5, judul: 'Lintasan Laba' },
  { id: 'kuartal', no: 6, judul: 'Denyut Kuartalan' },
  { id: 'kualitas', no: 7, judul: 'Kualitas Laba' },
  { id: 'valuasi', no: 8, judul: 'Vonis Valuasi' },
  { id: 'laporan', no: 9, judul: 'Laporan Keuangan' },
  { id: 'skor', no: 10, judul: 'Skor & Pilar' },
  { id: 'khas', no: 11, judul: 'Panel Khas PAPAN' },
  { id: 'glosarium', no: 12, judul: 'Glosarium' },
]

function Seksi({ def, catatan, children }: { def: DefSeksi; catatan?: ReactNode; children: ReactNode }) {
  return (
    <section className="bdh-seksi" id={`seksi-${def.id}`} aria-labelledby={`judul-${def.id}`}>
      <div className="bdh-kepala">
        <span className="bdh-no">{String(def.no).padStart(2, '0')}</span>
        <h2 className="lbl" id={`judul-${def.id}`}>{def.judul}</h2>
      </div>
      {catatan && <p className="bdh-catatan">{catatan}</p>}
      {children}
    </section>
  )
}

/** Keadaan "belum ada angkanya" yang berkalimat — bukan "—" telanjang. */
function Kosong({ children }: { children: ReactNode }) {
  return <p className="bdh-kosong">{children}</p>
}

function LencanaVonis({ v }: { v: Vonis | null }) {
  if (!v) return null
  return <span className={`bdh-vonis bdh-${v}`}>{LABEL_VONIS[v]}</span>
}

function pct(v: number | null | undefined, d = 1): string {
  return v != null && Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(d)}%` : '—'
}

function pctPolos(v: number | null | undefined, d = 1): string {
  return v != null && Number.isFinite(v) ? `${v.toFixed(d)}%` : '—'
}

function kelasArah(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '' : v >= 0 ? ' up' : ' dn'
}

/** Batang proporsi sederhana — SVG/canvas tak diperlukan untuk satu deret,
 *  dan div berlebar persen ikut tema tanpa kode warna kedua. */
function Batang({ nilai, maks, negatif }: { nilai: number; maks: number; negatif?: boolean }) {
  const w = maks > 0 ? Math.max(1, Math.min(100, (Math.abs(nilai) / maks) * 100)) : 0
  return (
    <div className="bdh-batang">
      <i className={negatif ? 'neg' : undefined} style={{ width: `${w}%` }} />
    </div>
  )
}

/* ───────────────────────── seksi 2 ───────────────────────── */

function SeksiTransaksi({ ticker, fd }: { ticker: string; fd: StockFundamental }) {
  const { data: asing, loading } = useStockAsing(ticker)
  const r = useMemo(() => ringkasTransaksi(asing?.d ?? [], fd.shares), [asing, fd.shares])

  if (loading) return <Kosong>Memuat riwayat transaksi…</Kosong>
  if (!r) {
    return (
      <Kosong>
        Riwayat transaksi harian emiten ini belum dipanen. Panen berjalan bertahap dan belum
        menjangkau seluruh emiten.
      </Kosong>
    )
  }
  return (
    <>
      <div className="rasio">
        <div>
          <span className="lbl">Volume</span>
          <div className="v num">{fRingkas(r.volume)}</div>
          <span className="sub">lembar · {tanggalPendek(r.tanggal)}</span>
        </div>
        <div>
          <span className="lbl">Nilai</span>
          <div className="v num">{fMC(r.value)}</div>
          <span className="sub">rupiah transaksi</span>
        </div>
        <div>
          <span className="lbl">Frekuensi</span>
          <div className="v num">{fv(r.frekuensi)}</div>
          <span className="sub">kali transaksi</span>
        </div>
        <div>
          <span className="lbl">Vs Rerata 20H</span>
          <div className={'v num' + (r.banding20 != null ? (r.banding20 >= 1 ? ' up' : ' dn') : '')}>
            {r.banding20 != null ? `${r.banding20.toFixed(2)}x` : '—'}
          </div>
          <span className="sub">{r.volume20 != null ? `rerata ${fRingkas(r.volume20)}` : 'riwayat < 5 hari'}</span>
        </div>
        <div>
          <span className="lbl">Turnover</span>
          <div className="v num">{r.turnover != null ? `${r.turnover.toFixed(3)}%` : '—'}</div>
          <span className="sub">saham beredar berpindah</span>
        </div>
        <div>
          <span className="lbl">Saham Beredar</span>
          <div className="v num">{fd.shares ? `${(fd.shares / 1e9).toFixed(2)} M` : '—'}</div>
          <span className="sub">lembar tercatat di bursa</span>
        </div>
      </div>
      <p className="bdh-sumber">
        Volume, nilai, dan frekuensi hari bursa terakhir yang terpanen. Jumlah saham beredar dari
        ruas <b>ListedShares</b> bursa, bukan dari agregator.
      </p>
    </>
  )
}

/* ───────────────────────── seksi 4 ───────────────────────── */

function SeksiFlow({ fd }: { fd: StockFundamental }) {
  const langkah = langkahMoneyFlow(fd)
  const sambungan = sambunganFlow(fd)
  const adaIsi = langkah.some((l) => l.nilai != null)
  if (!adaIsi) return <Kosong>Ruas TTM emiten ini belum tersedia — lima langkahnya belum bisa dirangkai.</Kosong>

  return (
    <>
      <ol className="bdh-flow">
        {langkah.map((l, i) => (
          <li key={l.id}>
            <span className="bdh-flow-no num">{i + 1}</span>
            <div className="bdh-flow-isi">
              <span className="lbl">{l.label}</span>
              <div className="bdh-flow-nilai num">
                {l.nilai == null
                  ? 'Belum tersedia'
                  : l.satuan === 'uang'
                    ? fMC(l.nilai)
                    : `Rp ${fEps(l.nilai)}`}
                {l.yoy != null && <span className={'bdh-yoy' + kelasArah(l.yoy)}>{pct(l.yoy)} YoY</span>}
              </div>
              <span className="bdh-arti">{l.arti}</span>
              <span className="sub">{l.periode}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="bdh-sambung">
        {sambungan.map((s) => (
          <div key={s.id}>
            <span className="lbl">{s.label}</span>
            <div className="v num">{pctPolos(s.nilai)}</div>
            <span className="sub">{s.baca ?? 'Belum tersedia'}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/* ───────────────────────── seksi 5 ───────────────────────── */

function BarisTahun({ judul, deret, format }: { judul: string; deret: TitikTahun[]; format: (v: number) => string }) {
  if (deret.length === 0) return null
  const maks = Math.max(...deret.map((t) => Math.abs(t.nilai)))
  const g = cagr(deret)
  return (
    <div className="bdh-deret">
      <div className="bdh-deret-h">
        <span className="lbl">{judul}</span>
        <span className={'num' + kelasArah(g)}>
          {g != null ? `CAGR ${pct(g)}/th` : 'CAGR tak terdefinisi'}
        </span>
      </div>
      <table>
        <tbody>
          {deret.map((t) => (
            <tr key={t.tahun}>
              <td className="bdh-th num">{t.tahun}</td>
              <td className="bdh-tbar"><Batang nilai={t.nilai} maks={maks} negatif={t.nilai < 0} /></td>
              <td className={'r num' + (t.nilai < 0 ? ' dn' : '')}>{format(t.nilai)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SeksiLintasan({ fd }: { fd: StockFundamental }) {
  const rev = deretTahun(fd.hist_revenue)
  const ni = deretTahun(fd.hist_net_income)
  const eps = deretTahun(fd.hist_eps)
  if (rev.length === 0 && ni.length === 0 && eps.length === 0) {
    return <Kosong>Riwayat tahunan emiten ini belum tersedia.</Kosong>
  }
  return (
    <>
      <div className="grid3">
        <BarisTahun judul="Pendapatan" deret={rev} format={fRingkas} />
        <BarisTahun judul="Laba Bersih" deret={ni} format={fRingkas} />
        <BarisTahun judul="EPS" deret={eps} format={(v) => `Rp ${fEps(v)}`} />
      </div>
      <p className="bdh-sumber">
        CAGR dihitung dari titik pertama ke titik terakhir deret yang tampil. Deret yang salah satu
        ujungnya negatif <b>tidak diberi CAGR</b> — pulih dari rugi bukan pertumbuhan, dan angka apa
        pun di situ akan menyesatkan.
      </p>
    </>
  )
}

/* ───────────────────────── seksi 6 ───────────────────────── */

function SeksiKuartal({ fd }: { fd: StockFundamental }) {
  const rev = deretKuartal(fd.q_revenue)
  const ni = deretKuartal(fd.q_net_income)
  if (rev.length === 0 && ni.length === 0) {
    return <Kosong>Rincian kuartalan emiten ini belum tersedia.</Kosong>
  }
  const petaNi = new Map(ni.map((t) => [t.kunci, t.nilai]))
  const maks = Math.max(1, ...rev.map((t) => Math.abs(t.nilai)))
  const barisan = (rev.length ? rev : ni).map((t) => {
    const pendapatan = rev.find((r) => r.kunci === t.kunci)?.nilai ?? null
    const laba = petaNi.get(t.kunci) ?? null
    return {
      kunci: t.kunci,
      label: `${t.q} ${t.tahun}`,
      pendapatan,
      laba,
      marjin: pendapatan != null && laba != null && pendapatan !== 0 ? (laba / pendapatan) * 100 : null,
    }
  })
  return (
    <>
      <div className="bdh-tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Kuartal</th>
              <th className="r">Pendapatan</th>
              <th>Proporsi</th>
              <th className="r">Laba Bersih</th>
              <th className="r">Marjin</th>
            </tr>
          </thead>
          <tbody>
            {barisan.map((b) => (
              <tr key={b.kunci}>
                <td className="num">{b.label}</td>
                <td className="r num">{b.pendapatan != null ? fRingkas(b.pendapatan) : '—'}</td>
                <td className="bdh-tbar">
                  {b.pendapatan != null && <Batang nilai={b.pendapatan} maks={maks} negatif={b.pendapatan < 0} />}
                </td>
                <td className={'r num' + (b.laba != null && b.laba < 0 ? ' dn' : '')}>
                  {b.laba != null ? fRingkas(b.laba) : '—'}
                </td>
                <td className={'r num' + kelasArah(b.marjin)}>{pctPolos(b.marjin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bdh-sumber">
        Kuartal <b>diskret</b> (bukan kumulatif sejak awal tahun). Kuartal yang kosong di sumbernya
        tidak ditampilkan sebagai nol — barisnya memang tidak ada.
      </p>
    </>
  )
}

/* ───────────────────────── seksi 7 ───────────────────────── */

function SeksiKualitas({ fd }: { fd: StockFundamental }) {
  const q = kualitasLaba(fd)
  const baris: { lbl: string; nilai: string; sub: string; cls?: string }[] = [
    {
      lbl: 'ROE (TTM)', nilai: pctPolos(q.roe, 2),
      sub: q.roeRerata != null ? `rerata ${q.roeTahun} tahun ${pctPolos(q.roeRerata, 2)}` : 'rerata historis belum tersedia',
      cls: q.roe != null ? (q.roe >= 15 ? 'up' : q.roe < 5 ? 'dn' : '') : '',
    },
    {
      lbl: 'Marjin Bersih', nilai: pctPolos(q.marjinBersih, 2),
      sub: marjin(fd.opm) != null ? `marjin operasi ${pctPolos(marjin(fd.opm), 2)}` : 'marjin operasi belum tersedia',
    },
    {
      lbl: 'DER', nilai: pctPolos(q.der, 1),
      sub: q.derSumber === 'kuartal' ? 'dari rasio kuartal terakhir' : q.derSumber === 'ttm' ? 'utang terhadap ekuitas' : 'belum tersedia',
      cls: q.der != null ? (q.der > 200 ? 'dn' : q.der < 50 ? 'up' : '') : '',
    },
    {
      lbl: 'Kas Operasi ÷ Laba', nilai: q.akrual != null ? `${q.akrual.toFixed(0)}%` : '—',
      sub: q.akrual == null ? 'butuh laba positif & arus kas' : q.akrual >= 100 ? 'kas melampaui laba akuntansi' : 'sebagian laba belum jadi kas',
      cls: q.akrual != null ? (q.akrual >= 100 ? 'up' : q.akrual < 60 ? 'dn' : '') : '',
    },
    {
      lbl: 'Imbal Hasil Dividen', nilai: pctPolos(q.divYield, 2),
      sub: fd.payout_ratio != null ? `payout ${pctPolos(keP(fd.payout_ratio), 0)} dari laba` : 'payout belum tersedia',
    },
    {
      lbl: 'Rasio Lancar', nilai: fd.current_ratio != null ? fvx(fd.current_ratio) : '—',
      sub: fd.interest_coverage != null ? `bunga tertutup ${fvx(fd.interest_coverage, 1)} laba operasi` : 'penutup bunga belum tersedia',
    },
  ]
  return (
    <>
      <div className="rasio">
        {baris.map((b) => (
          <div key={b.lbl}>
            <span className="lbl">{b.lbl}</span>
            <div className={`v num${b.cls ? ' ' + b.cls : ''}`}>{b.nilai}</div>
            <span className="sub">{b.sub}</span>
          </div>
        ))}
      </div>
      <p className="bdh-sumber">
        <b>DER ditampilkan dalam persen</b> dari ruas yang memang persen; ruas rasio kuartal dikali
        100 lebih dulu. Keduanya berbeda skala 100× di berkas yang sama, dan memilih salah satunya
        tanpa mengubah skala memberi angka yang terlihat wajar dan salah.
      </p>
    </>
  )
}

/* ───────────────────────── seksi 8 ───────────────────────── */

function BlokRasio({ nama, r, vsPct, medianSektor }: {
  nama: string
  r: RingkasRasio
  vsPct: number | null
  medianSektor: number | null
}) {
  const sektor = sumbuSektor(vsPct)
  const bentrok = konflikSumbu(r.vonis, sektor)
  return (
    <div className="panel">
      <div className="panel-h">
        <span className="lbl">{nama}</span>
        <span className="num">{r.kini != null ? fvx(r.kini) : '—'}</span>
      </div>
      <div className="panel-b">
        <table>
          <tbody>
            <tr>
              <td>Vs sejarahnya sendiri</td>
              <td className="r">
                {r.vonis ? <LencanaVonis v={r.vonis} /> : <span className="bdh-tanpa">tanpa vonis</span>}
              </td>
            </tr>
            <tr>
              <td>{r.n ? `Median ${r.tahunAwal}–${r.tahunAkhir} (${r.n} th)` : 'Median historis'}</td>
              <td className="r num">{r.median != null ? fvx(r.median) : '—'}</td>
            </tr>
            <tr>
              <td>Ambang murah / mahal</td>
              <td className="r num">
                {r.n >= MIN_TAHUN ? `< ${fvx(r.q1)} / > ${fvx(r.q3)}` : '—'}
              </td>
            </tr>
            <tr>
              <td>Vs median sektor</td>
              <td className="r">
                {sektor ? <LencanaVonis v={sektor} /> : <span className="bdh-tanpa">tanpa vonis</span>}
              </td>
            </tr>
            <tr>
              <td>Median sektornya</td>
              <td className="r num">
                {medianSektor != null ? fvx(medianSektor) : '—'}
                {vsPct != null && <span className={'bdh-yoy' + kelasArah(-vsPct)}>{pct(vsPct, 0)}</span>}
              </td>
            </tr>
          </tbody>
        </table>
        {r.alasan && <p className="bdh-sumber">{r.alasan}</p>}
        {bentrok && (
          <p className="bdh-konflik">
            <IkonMenu d={IKON_PERINGATAN} size={12} /> Dua sumbu <b>berlawanan</b>: {LABEL_VONIS[r.vonis!].toLowerCase()},
            tapi {sektor} dibanding sektornya. Itu bukan hal yang bisa dipilih salah satunya — emiten
            ini bergerak berbeda dari sektornya, dan justru itu yang perlu ditelusuri.
          </p>
        )}
      </div>
    </div>
  )
}

/* ───────────────────────── seksi 9 ───────────────────────── */

function TabelRasio({ judul, baris }: { judul: string; baris: [string, string][] }) {
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">{judul}</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            {baris.map(([k, v]) => (
              <tr key={k}><td>{k}</td><td className="r num">{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ───────────────────────── seksi 10 ───────────────────────── */

function KartuPilar({ p }: { p: Pilar }) {
  return (
    <div className="bdh-pilar">
      <div className="bdh-pilar-h">
        <span className="lbl">{p.label}</span>
        <span className="num">{p.skor != null ? p.skor.toFixed(0) : '—'}</span>
      </div>
      <div className="bdh-meter"><i style={{ width: `${p.skor ?? 0}%` }} data-skor={p.skor != null ? labelSkor(p.skor) : ''} /></div>
      <span className="sub">{p.skor != null ? labelSkor(p.skor) : 'Belum tersedia'}</span>
      {p.kurang
        ? <p className="bdh-sumber">{p.kurang}</p>
        : <ul className="bdh-alasan">{p.alasan.map((a) => <li key={a}>{a}</li>)}</ul>}
    </div>
  )
}

/* ───────────────────────── seksi 12 ───────────────────────── */

/** Istilah yang benar-benar dipakai halaman ini dan SUDAH ada di glosarium
 *  PAPAN — diambil lewat id, bukan disalin, supaya definisinya tak bercabang
 *  dua kalau glosariumnya diperbarui. */
const ID_GLOSARIUM = ['per', 'pbv', 'eps', 'roe', 'laba-bersih', 'arus-kas', 'kapitalisasi-pasar', 'nilai-transaksi', 'frekuensi', 'net-foreign', 'idx-ic', 'likuiditas', 'vonis', 'laporan-keuangan-xbrl']

/** Istilah yang dipakai halaman ini tapi BELUM ada di glosarium PAPAN.
 *  Ditulis di sini apa adanya alih-alih dibiarkan tanpa penjelasan — dan
 *  sengaja pendek, karena begitu istilahnya masuk glosarium, barisnya di sini
 *  yang dihapus, bukan sebaliknya. */
const TAMBAHAN: { istilah: string; definisi: string }[] = [
  { istilah: 'TTM (Trailing Twelve Months)', definisi: 'Dua belas bulan terakhir yang sudah dilaporkan — bukan tahun buku, bukan satu kuartal. Dipakai supaya angka terbaru tetap sebanding dengan setahun penuh.' },
  { istilah: 'CAGR', definisi: 'Laju pertumbuhan rata-rata per tahun yang, kalau diulang tiap tahun, membawa angka awal ke angka akhir. Tak terdefinisi kalau salah satu ujungnya negatif.' },
  { istilah: 'DPS (Dividen per Saham)', definisi: 'Rupiah dividen untuk tiap satu lembar saham dalam dua belas bulan terakhir.' },
  { istilah: 'DER (Debt to Equity Ratio)', definisi: 'Utang berbunga dibanding ekuitas. Di halaman ini selalu ditampilkan sebagai persen.' },
  { istilah: 'Payout Ratio', definisi: 'Bagian laba yang dibagikan sebagai dividen. Di atas 100% berarti dibagi melebihi laba periode berjalan.' },
  { istilah: 'Altman Z-Score', definisi: 'Skor gabungan lima rasio neraca yang memperkirakan tekanan keuangan. Ambang klasiknya 1,81 dan 2,99. Tidak berlaku untuk bank dan lembaga keuangan.' },
  { istilah: 'Piotroski F-Score', definisi: 'Sembilan kriteria lolos/tidak tentang profitabilitas, leverage, dan efisiensi. Halaman ini menyebut berapa kriteria yang benar-benar bisa dinilai.' },
  { istilah: 'ROIC / ROCE', definisi: 'Imbal hasil atas seluruh modal yang dipakai usaha — utang maupun ekuitas. Melengkapi ROE yang hanya melihat sisi ekuitas.' },
  { istilah: 'Siklus Konversi Kas', definisi: 'Berapa hari sejak kas keluar untuk persediaan sampai kembali sebagai tagihan tertagih. Negatif berarti pemasok membiayai modal kerjanya.' },
  { istilah: 'Turnover Saham', definisi: 'Berapa persen saham beredar berpindah tangan pada satu hari bursa.' },
]

/* ───────────────────────── halaman ───────────────────────── */

export function BedahEmiten() {
  const { index } = useStockIndex()
  const [sp, setSp] = useSearchParams()
  const dariUrl = (sp.get('kode') ?? sp.get('sym'))?.toUpperCase() ?? null
  const [ticker, setTicker] = useState<string | null>(dariUrl)
  const [inputVal, setInputVal] = useState('')

  const { data: fd, loading, error } = useStockFundamental(ticker)
  const daftarSektor = useSektorIdx()
  const idxSektor = sektorEmiten(daftarSektor, ticker ?? '')
  const daftarPengendali = usePengendali()
  const pengendali = pengendaliEmiten(daftarPengendali, ticker ?? '')
  const daftarValuasi = useValuasiHistoris()
  const deret = valuasiEmiten(daftarValuasi, ticker ?? '')

  // URL adalah sumber kebenaran kode emiten: tautan "Bedah BBCA" dari halaman
  // lain harus membuka emitennya, bukan halaman kosong.
  useEffect(() => {
    if (dariUrl && dariUrl !== ticker) setTicker(dariUrl)
  }, [dariUrl, ticker])

  function pilih(raw: string) {
    const kode = raw.trim().toUpperCase().replace('.JK', '')
    if (!kode) return
    setInputVal(kode)
    setTicker(kode)
    setSp((p) => { p.set('kode', kode); return p }, { replace: true })
  }

  const harga = fd?.last_price ?? null
  const pe = ringkasRasio(deret?.pe, rasioKini(harga, deret?.eps_dasar))
  const pb = ringkasRasio(deret?.pb, rasioKini(harga, deret?.bv_dasar))
  const sumbuPe: Sumbu | null = pe.vonis
  const sektorPe = sumbuSektor(fd?.pe_vs_sector_pct ?? null)
  const pilar = useMemo(() => (fd ? skorPilar(fd, sumbuPe, sektorPe) : []), [fd, sumbuPe, sektorPe])
  const total = skorTotal(pilar)
  const kr = kekuatanRisiko(pilar)
  const khas = fd ? panelKhas(fd) : []
  const glosarium = GLOSARIUM.filter((g) => ID_GLOSARIUM.includes(g.id))

  return (
    <div className="lantai bedah-view">
      {ticker && (
        <div>
          <div className="fd-search-wrap" style={{ maxWidth: 480, marginBottom: 6, flexWrap: 'nowrap' }}>
            <StockAutocomplete stocks={index?.stocks ?? []} value={inputVal} onChange={setInputVal} onSelect={pilih} />
            <button type="button" className="btn-p" aria-label="Bedah emiten" style={{ padding: '7px 12px', flexShrink: 0 }} onClick={() => pilih(inputVal)}>
              <IkonMenu d={IKON_CARI} size={14} />
            </button>
          </div>
          <p style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>
            Data delay, bukan harga real-time.{fd?.updated ? ` Terakhir diperbarui ${fd.updated}.` : ''}
          </p>
        </div>
      )}

      {!ticker && (
        <div className="panel">
          <div className="empty">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <p>
              <b>Bedah satu emiten dalam dua belas seksi</b> — dari uang yang masuk sampai vonis
              valuasi, tiap angka membawa periode dan asalnya.
            </p>
            <div className="cari">
              <StockAutocomplete stocks={index?.stocks ?? []} value={inputVal} onChange={setInputVal} onSelect={pilih} />
              <button type="button" className="btn-p" onClick={() => pilih(inputVal)}>Bedah</button>
            </div>
            <div className="chips">
              {POPULER.map((t) => (
                <button key={t} type="button" className="chip-t" onClick={() => pilih(t)}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {ticker && loading && (
        <div className="fd-empty">
          <p><IkonMenu d={IKON_JAM} size={28} /></p>
          <p>Membedah {ticker}…</p>
        </div>
      )}

      {ticker && !loading && error && (
        <div className="fd-empty">
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p>Data <strong>{ticker}</strong> tidak ditemukan.</p>
          <p style={{ fontSize: 10, marginTop: 8 }}>Pastikan kode saham benar (contoh: BBCA, ASII, TLKM)</p>
        </div>
      )}

      {ticker && !loading && !error && fd && (
        <>
          <nav className="bdh-lompat" aria-label="Lompat ke seksi">
            {SEKSI.map((s) => (
              <a key={s.id} href={`#seksi-${s.id}`} className="chip-t">
                <span className="num">{String(s.no).padStart(2, '0')}</span> {s.judul}
              </a>
            ))}
          </nav>

          {/* ── 01 · Kepala emiten + tiga vonis ── */}
          <Seksi def={SEKSI[0]}>
            <div className="panel hero">
              <div className="ident">
                <span className="tk">{fd.ticker} · IDX</span>
                <div className="nm">{fd.name || ''}</div>
                <div className="sek">
                  {idxSektor?.sektor
                    ? <>{idxSektor.sektor}{idxSektor.subsektor ? ' · ' + idxSektor.subsektor : ''}</>
                    : <>{fd.sector || ''}{fd.industry ? ' · ' + fd.industry : ''}</>}
                </div>
                {/* Laporan resmi bursa hanya memuat KATEGORI pengendali, bukan
                    namanya — kalimatnya tak boleh menyiratkan kita tahu siapa.
                    Tanggalnya wajib ikut: kepemilikan berubah, dan sebagian
                    emiten datanya dari laporan 2019. */}
                <div className="bdh-pengendali">
                  Pengendali:{' '}
                  {pengendali
                    ? <><b>{labelPengendali(pengendali.jenis)}</b>{pengendali.tanggal ? ` · per laporan ${tanggalPendek(pengendali.tanggal)}` : ''}</>
                    : 'belum tersedia'}
                </div>
                {idxSektor?.papan && (
                  <span
                    className={`badge${papanBerisiko(idxSektor.papan) ? ' badge-risiko' : ''}`}
                    title={papanBerisiko(idxSektor.papan)
                      ? 'Papan Pemantauan Khusus — bursa menempatkan emiten di sini karena memenuhi kriteria tertentu (mis. harga sangat rendah, likuiditas tipis, opini auditor disclaimer, atau dalam PKPU).'
                      : `Papan pencatatan ${idxSektor.papan}${idxSektor.tercatat ? ` · tercatat ${idxSektor.tercatat}` : ''}`}
                  >
                    {papanBerisiko(idxSektor.papan) ? '⚠ ' : ''}Papan {idxSektor.papan}
                  </span>
                )}
              </div>
              <div className="harga">
                <span className="px num">
                  {harga != null ? `Rp ${keFraksi(harga).toLocaleString('id-ID')}` : '—'}
                </span>
                <div className="rng">
                  <span className="lbl">Kapitalisasi Pasar</span>
                  <div className="bdh-mc num">{fMC(fd.market_cap)}</div>
                  <span className="sub">
                    {fd.float_pct != null ? `free float ${fd.float_pct.toFixed(1)}%` : 'free float belum tersedia'}
                  </span>
                </div>
              </div>
              <div className="statgrid">
                <div>
                  <span className="lbl">P/E vs Sejarah</span>
                  <span className="v">{pe.kini != null ? fvx(pe.kini) : '—'}</span>
                  {pe.vonis ? <LencanaVonis v={pe.vonis} /> : <span className="bdh-tanpa">tanpa vonis</span>}
                </div>
                <div>
                  <span className="lbl">P/BV vs Sejarah</span>
                  <span className="v">{pb.kini != null ? fvx(pb.kini) : '—'}</span>
                  {pb.vonis ? <LencanaVonis v={pb.vonis} /> : <span className="bdh-tanpa">tanpa vonis</span>}
                </div>
                <div>
                  <span className="lbl">Skor Fundamental</span>
                  <span className="v">{total.skor != null ? total.skor.toFixed(0) : '—'}</span>
                  <span className="bdh-tanpa">
                    {total.skor != null ? `${labelSkor(total.skor)} · ${total.n} dari 5 pilar` : 'bahannya belum cukup'}
                  </span>
                </div>
              </div>
            </div>
          </Seksi>

          {/* ── 02 · Aktivitas transaksi ── */}
          <Seksi def={SEKSI[1]} catatan="Seberapa ramai emiten ini benar-benar diperdagangkan — angka valuasi apa pun tak berarti kalau sahamnya tak bisa dilepas.">
            <SeksiTransaksi ticker={fd.ticker} fd={fd} />
          </Seksi>

          {/* ── 03 · Aliran asing ── */}
          <Seksi def={SEKSI[2]} catatan="Beli & jual asing dalam LEMBAR — bursa tidak melaporkan aliran asing dalam rupiah, jadi halaman ini tidak menaksirnya.">
            <PanelAliranAsing ticker={fd.ticker} />
          </Seksi>

          {/* ── 04 · Lima langkah uang ── */}
          <Seksi def={SEKSI[3]} catatan="Uang berjalan dari penjualan sampai rekening pemegang saham. Yang paling memberi tahu bukan kelima angkanya, melainkan rasio antar langkah di bawahnya.">
            <SeksiFlow fd={fd} />
          </Seksi>

          {/* ── 05 · Lintasan laba ── */}
          <Seksi def={SEKSI[4]} catatan="Lima tahun buku terakhir dari laporan tahunan.">
            <SeksiLintasan fd={fd} />
          </Seksi>

          {/* ── 06 · Denyut kuartalan ── */}
          <Seksi def={SEKSI[5]} catatan="Delapan kuartal terakhir — tempat perlambatan terlihat lebih dulu daripada di angka tahunan.">
            <SeksiKuartal fd={fd} />
          </Seksi>

          {/* ── 07 · Kualitas laba ── */}
          <Seksi def={SEKSI[6]} catatan="Bukan seberapa besar labanya, melainkan seberapa bisa dipercaya dan seberapa berulang.">
            <SeksiKualitas fd={fd} />
          </Seksi>

          {/* ── 08 · Vonis valuasi dua sumbu ── */}
          <Seksi def={SEKSI[7]} catatan="Dua sumbu: terhadap sejarah emiten ini sendiri, dan terhadap median sektornya. Kalau keduanya berlawanan, konfliknya disebut — tidak dipilih diam-diam.">
            {deret ? (
              <div className="grid2">
                <BlokRasio nama="P/E" r={pe} vsPct={fd.pe_vs_sector_pct ?? null} medianSektor={fd.sector_pe_median ?? null} />
                <BlokRasio nama="P/BV" r={pb} vsPct={fd.pb_vs_sector_pct ?? null} medianSektor={fd.sector_pb_median ?? null} />
              </div>
            ) : (
              <Kosong>
                {daftarValuasi
                  ? 'Riwayat laporan tahunan emiten ini belum cukup untuk membangun deret valuasi. Vonis butuh minimal lima tahun — dengan tiga titik, kuartil cuma nama lain dari titik terendah dan tertinggi.'
                  : 'Memuat deret valuasi…'}
              </Kosong>
            )}
            <p className="bdh-sumber">
              Rasio "sekarang" dihitung ulang dari harga terkini dibagi laba/ekuitas per lembar pada
              basis hari ini — bukan diambil dari rasio TTM agregator. Membandingkan dua definisi
              laba yang berbeda menampilkan selisih <b>definisi</b> sebagai kalau-kalau perubahan
              valuasi.
            </p>
          </Seksi>

          {/* ── 09 · Laporan keuangan ── */}
          <Seksi def={SEKSI[8]} catatan="Laba rugi, neraca, dan arus kas per periode. Tiap sel menandai asal angkanya; ini satu-satunya seksi yang menggabungkan dua sumber laporan, dan penggabungannya punya aturan tersendiri.">
            <PanelLaporanKeuangan ticker={fd.ticker} />
            <div className="grid2" style={{ marginTop: 12 }}>
              <TabelRasio
                judul="Rasio Keuangan"
                baris={[
                  ['Marjin Kotor', pctPolos(marjin(fd.gpm), 2)],
                  ['Marjin Operasi', pctPolos(marjin(fd.opm), 2)],
                  ['Marjin Bersih', pctPolos(marjin(fd.npm), 2)],
                  ['Marjin EBITDA', pctPolos(marjin(fd.ebitda_margin), 2)],
                  ['ROE', pctPolos(keP(fd.roe), 2)],
                  ['ROA', pctPolos(keP(fd.roa), 2)],
                  ['Rasio Lancar', fd.current_ratio != null ? fvx(fd.current_ratio) : '—'],
                  ['Rasio Cepat', fd.quick_ratio != null ? fvx(fd.quick_ratio) : '—'],
                  ['Perputaran Aset', fd.asset_turnover != null ? fvx(fd.asset_turnover) : '—'],
                ]}
              />
              <TabelRasio
                judul="Rasio Valuasi"
                baris={[
                  ['P/E (TTM)', fvx(fd.pe)],
                  ['P/E Proyeksi', fvx(fd.forward_pe)],
                  ['P/BV', fvx(fd.pb)],
                  ['P/S', fvx(fd.ps)],
                  ['P/FCF', fvx(fd.price_fcf)],
                  ['EV/EBITDA', fvx(fd.ev_ebitda)],
                  ['EV/EBIT', fvx(fd.ev_ebit)],
                  ['PEG', fvx(fd.peg)],
                  ['Nilai Buku per Saham', fd.bv != null ? `Rp ${fv(fd.bv)}` : '—'],
                ]}
              />
            </div>
            <p className="bdh-sumber">
              Marjin yang dilaporkan tepat 0 ditampilkan sebagai belum tersedia: bank dan lembaga
              keuangan tidak melaporkan laba kotor sama sekali, dan "0,00%" di situ memberi tahu
              pembaca sesuatu yang tidak benar.
            </p>
          </Seksi>

          {/* ── 10 · Skor & pilar ── */}
          <Seksi def={SEKSI[9]} catatan="Lima pilar, aturan ambangnya tetap dan ditulis di bawah tiap kartu supaya bisa dibantah.">
            <div className="bdh-skor-total">
              <div>
                <span className="lbl">Skor Fundamental</span>
                <div className="v num">{total.skor != null ? total.skor.toFixed(0) : '—'}</div>
                <span className="sub">
                  {total.skor != null
                    ? `${labelSkor(total.skor)} · rerata ${total.n} pilar yang datanya cukup`
                    : 'Belum satu pun pilar punya bahan yang cukup'}
                </span>
              </div>
              <div className="bdh-kr">
                <div>
                  <span className="lbl">Kekuatan</span>
                  {kr.kuat.length
                    ? <ul>{kr.kuat.map((p) => <li key={p.id}>{p.label} — {p.skor!.toFixed(0)}</li>)}</ul>
                    : <p className="bdh-sumber">Belum ada pilar yang mencapai 70.</p>}
                </div>
                <div>
                  <span className="lbl">Risiko</span>
                  {kr.lemah.length
                    ? <ul>{kr.lemah.map((p) => <li key={p.id}>{p.label} — {p.skor!.toFixed(0)}</li>)}</ul>
                    : <p className="bdh-sumber">Tak ada pilar yang jatuh di bawah 50.</p>}
                </div>
              </div>
            </div>
            <div className="grid3" style={{ marginTop: 12 }}>
              {pilar.map((p) => <KartuPilar key={p.id} p={p} />)}
            </div>
            <p className="bdh-disclaimer">
              Skor ini keluaran <b>aturan tetap (rule engine)</b>, bukan model bahasa. Tiap pilar
              merata-ratakan beberapa ruas yang diberi nilai lewat tangga ambang yang sama untuk
              semua emiten; pilar yang bahannya tak ada <b>dikosongkan</b>, bukan diberi nilai
              tengah, dan tidak ikut menarik skor total. Ini bahan analisa, bukan rekomendasi atau
              saran investasi.
            </p>
          </Seksi>

          {/* ── 11 · Panel khas PAPAN ── */}
          <Seksi def={SEKSI[10]} catatan="Ruas yang tak dipunyai dasbor pembanding. Yang tak bisa dihitung dari data yang ada disebut apa adanya — tak pernah ditambal taksiran.">
            <div className="bdh-tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Ukuran</th><th className="r">Nilai</th><th>Bacaannya</th></tr>
                </thead>
                <tbody>
                  {khas.map((b) => (
                    <tr key={b.label}>
                      <td>{b.label}</td>
                      <td className="r num">{b.nilai}</td>
                      <td className="bdh-baca">{b.baca ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Seksi>

          {/* ── 12 · Glosarium ── */}
          <Seksi def={SEKSI[11]} catatan="Istilah yang dipakai di halaman ini. Yang bertanda PAPAN diambil dari glosarium bersama, bukan disalin.">
            <div className="grid2">
              <div className="panel">
                <div className="panel-h"><span className="lbl">Dari glosarium PAPAN</span></div>
                <div className="panel-b bdh-glos">
                  {glosarium.map((g) => (
                    <div key={g.id}>
                      <b>{g.istilah}</b>
                      <p>{g.definisi}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel">
                <div className="panel-h"><span className="lbl">Khusus halaman ini</span></div>
                <div className="panel-b bdh-glos">
                  {TAMBAHAN.map((g) => (
                    <div key={g.istilah}>
                      <b>{g.istilah}</b>
                      <p>{g.definisi}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="bdh-disclaimer">
              Seluruh isi halaman ini bersifat edukatif dan informasional, bukan rekomendasi atau
              saran investasi. Angka fundamental tertinggal dari harga: laporan terbit berkala,
              harga bergerak tiap hari.
              <LencanaTurunan fd={fd} ruas="eps" />
            </p>
          </Seksi>
        </>
      )}
    </div>
  )
}
