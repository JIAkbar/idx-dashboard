import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { BatangPeringkat } from '../../components/dasbor/BatangPeringkat'
import { Kalender, fmtTanggalPendek } from '../../components/dasbor/Kalender'
import { useDataHarian, useDataPembanding } from '../../lib/dasbor/dataHarian'
import { cariTanggalPembanding, hitungPeriodePct, rentangPreset, type RentangTanggal } from '../../lib/dasbor/periode'
import { fN, fp } from '../../lib/dasbor/format'
import type { SectorRow } from '../../lib/dasbor/dataHarian'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { IkonMenu, IKON_JAM, IKON_PERINGATAN, IKON_GRAFIK_BATANG, IKON_GRAFIK_NAIK, IKON_BULAN_SABIT, IKON_KOTAK_ARSIP } from '../../components/dasbor/IkonMenu'

type PeriodeId = 'd' | 'm1' | 'm3' | 'ytd'

const PERIODE: { id: PeriodeId; label: string }[] = [
  { id: 'd', label: 'Hari Ini' },
  { id: 'm1', label: '1 Bulan' },
  { id: 'm3', label: '3 Bulan' },
  { id: 'ytd', label: 'YTD' },
]

const HARI_MUNDUR: Record<'m1' | 'm3', number> = { m1: 30, m3: 91 }

/**
 * Peta sektor IDX-IC (nama tile heatmap, dari `D.sectors`) → sektor pada
 * fundamental/index.json (klasifikasi Yahoo). Dua taksonomi ini BEDA — ini
 * pemetaan terdekat yang jujur, bukan 1:1: Consumer Non-Cyclicals≈Consumer
 * Defensive, Financials≈Financial Services, Infrastructures mencakup
 * Communication Services + Utilities, dan Transportation & Logistic TIDAK
 * punya padanan (Yahoo menggolongkannya ke Industrials) — jadi tile [C] dan
 * [K] menampilkan daftar yang sama, diberi catatan di panel.
 */
const PETA_SEKTOR_FUNDAMENTAL: Record<string, string[]> = {
  Energy: ['Energy'],
  'Basic Materials': ['Basic Materials'],
  Industrials: ['Industrials'],
  'Consumer Non-Cyclicals': ['Consumer Defensive'],
  'Consumer Cyclicals': ['Consumer Cyclical'],
  Healthcare: ['Healthcare'],
  Financials: ['Financial Services'],
  'Properties & Real Estate': ['Real Estate'],
  Technology: ['Technology'],
  Infrastructures: ['Communication Services', 'Utilities'],
  'Transportation & Logistic': ['Industrials'],
}

const CATATAN_UMUM = 'Keanggotaan sektor dari klasifikasi data fundamental (pemetaan terdekat sektor IDX-IC).'
const CATATAN_SEKTOR: Record<string, string> = {
  Industrials: 'Klasifikasi data fundamental menggabungkan Transportation & Logistic ke Industrials — daftar tile [C] dan [K] sama.',
  'Transportation & Logistic': 'Klasifikasi data fundamental menggabungkan Transportation & Logistic ke Industrials — daftar tile [C] dan [K] sama.',
  Infrastructures: 'Mencakup Communication Services + Utilities pada klasifikasi data fundamental.',
}

/**
 * Panel "Sektor & Indeks" — port buildSectorPanel() index_live.html baris
 * 2970-3023, bergaya papan "Lantai Bursa".
 *
 * Task #75 — dua perombakan sekaligus:
 *
 * 1. MODE RENTANG (via Kalender strip): % perubahan nilai indeks tiap sektor
 *    titik-awal vs titik-akhir rentang (`sectors[].v`, reuse useDataPembanding
 *    untuk berkas titik-awal — cuma 2 fetch, bukan multi). Heatmap tile +
 *    daftar performa ikut, label jujur "Perf 3 Agu – 12 Agu". Saat rentang
 *    aktif, tab periode disembunyikan (rentang menggantikan perannya).
 *
 * 2. RE-LAYOUT (feedback user "tabel-tabel gak rapi"):
 *    (a) Tabel "Performa Sektor" 11 baris full-width → daftar kompak
 *        .rank-wrap 2 kolom (±6+5 berdampingan di desktop, 1 kolom mobile)
 *        dengan bar mini divergen + badge persen; kolom Nilai Indeks tetap.
 *        Urutan menurun sesuai nilai periode terpilih (dulu beku by hari-ini).
 *    (b) Panel "Sektor — YTD vs Hari Ini" DIHAPUS — redundan: tab YTD di
 *        Performa Sektor (yang sekarang juga pakai bar) menampilkan data yang
 *        persis sama.
 *    (c) Indeks Unggulan | Indeks Syariah kini grid 2 kolom sejajar; Board
 *        Indices dipasangkan dengan panel "YTD — Perbandingan Semua Indeks
 *        Utama" di baris grid berikutnya. Mobile tetap 1 kolom (grid2).
 *    (d) Kontras: kolom Nilai tidak lagi .muted (--text3) — angka penting
 *        pakai warna teks utama.
 *
 * Task #87 — relayout ronde 2 (revisi c di atas, tetap murni tata letak):
 *    Baris 1: Performa Sektor PORTRAIT (11 baris 1 kolom, .rank-wrap.potret)
 *             ⟷ "YTD — Perbandingan Semua Indeks Utama" (9 baris) — tinggi
 *             sepadan, tak ada panel setengah kosong.
 *    Baris 2: Indeks Unggulan (8 baris) ⟷ .sec-stack berisi Indeks Syariah
 *             (1 baris) + Board Indices (3 baris) ditumpuk satu kolom.
 *    Bug scrollbar tab periode: subpiksel DPR≠1 bikin scrollWidth >
 *    clientWidth → scrollbar Windows nongol; scrollbar disembunyikan
 *    (swipe mobile tetap jalan), lihat blok "#87 sector r2" lantai.css.
 *
 * Task #88 — tab periode + mode rentang menyetir SEMUA tabel halaman:
 *    Kolom "Hari Ini" di Indeks Unggulan/Syariah/Board jadi kolom periode
 *    dinamis (header ikut pilihan; nilai % titik-awal vs titik-akhir, pola
 *    nilaiPeriode sektor, reuse berkas pembanding yang sama — nol fetch
 *    tambahan). Panel perbandingan indeks utama ikut periode penuh (termasuk
 *    "Hari Ini") — satu kontrol satu makna, tanpa pengecualian tersembunyi;
 *    data YTD tetap selalu terlihat di kolom YTD tiap tabel. Pembanding tak
 *    tersedia → "—".
 */
/** Nama sektor IDX-IC (tanpa prefiks "[X] ") → simbol TradingView sektoral —
 *  daftar teraudit #89 (ChartIndeks TV_GROUPS.sektoral). */
const SYM_SEKTOR: Record<string, string> = {
  Energy: 'IDXENERGY',
  'Basic Materials': 'IDXBASIC',
  Industrials: 'IDXINDUST',
  'Consumer Non-Cyclicals': 'IDXNONCYC',
  'Consumer Cyclicals': 'IDXCYCLIC',
  Healthcare: 'IDXHEALTH',
  Financials: 'IDXFINANCE',
  'Properties & Real Estate': 'IDXPROPERT',
  Technology: 'IDXTECHNO',
  Infrastructures: 'IDXINFRA',
  'Transportation & Logistic': 'IDXTRANS',
}

/** Nama indeks di ds featured/sharia → simbol TradingView. HANYA yang
 *  simbolnya sudah terverifikasi ada di TV (#51/#89); sisanya sengaja tidak
 *  diklik daripada mengirim user ke chart error. */
const SYM_INDEKS: Record<string, string> = {
  'IDX Composite (IHSG)': 'COMPOSITE',
  'IDX SMC Composite': 'IDXSMC_COM',
  'IDX SMC Liquid': 'IDXSMC_LIQ',
  'SRI-KEHATI': 'SRI_KEHATI',
  'Pefindo I-Grade': 'I_GRADE',
  // Dikonfirmasi lewat symbol-search TradingView (14 Agu), bukan tebakan:
  'ESG Sctr Ldrs IDX KEHATI': 'ESGSKEHATI',
  // Board Indices — nama di ds sudah di-rename ke bahasa Indonesia.
  'Papan Utama': 'MBX',
  'Papan Pengembangan': 'DBX',
  'Papan Akselerasi': 'ABX',
  // TIDAK dipetakan (symbol-search tak menemukan padanannya, jadi barisnya
  // sengaja tidak bisa diklik daripada mengirim pembaca ke chart kosong):
  // 'IDX KEHATI' (ambigu antara ESG Quality 45 / lainnya),
  // 'IDX-PEFINDO Prime Bank', 'IDX Sharia Growth'.
}

export function SektorIndeks() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()
  const [periode, setPeriode] = useState<PeriodeId>('d')
  const [rentang, setRentang] = useState<RentangTanggal | null>(null)
  /** Nama sektor IDX-IC (tanpa prefiks "[X] ") yang tile-nya diklik — panel daftar saham sektor itu tampil di bawah heatmap. */
  const [sektorTerpilih, setSektorTerpilih] = useState<string | null>(null)
  // Daftar {ticker, name, sector} 965 saham — reuse index autocomplete Stock
  // Detail (fetch sekali, cache modul); di-load saat halaman dibuka.
  const { index: indexSaham } = useStockIndex()
  // Strip Kalender — target scroll halus saat tab "Rentang" panel Performa
  // Sektor diklik (#1 revisi user 14 Agu).
  const kalenderRef = useRef<HTMLDivElement>(null)

  // Rentang dipilih → data utama pindah ke tanggal AKHIR rentang (nilai
  // indeks & tile dihitung akhir vs awal).
  function gantiRentang(r: RentangTanggal | null) {
    setRentang(r)
    if (r) pilihTanggal(r.akhir)
  }

  /** Tab "Rentang" panel Performa Sektor: buka mode rentang di Kalender strip
   * (preset 1 Minggu, sama seperti toggle "Rentang" di dalam Kalender sendiri)
   * lalu scroll halus ke strip supaya user langsung lihat kontrolnya. */
  function bukaTabRentang() {
    if (!rentang) {
      const akhir = tanggalAktif ?? tanggalTersedia[tanggalTersedia.length - 1]?.date_iso
      if (akhir) gantiRentang(rentangPreset(tanggalTersedia, akhir, 'w1'))
    }
    kalenderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const tanggalPembanding = useMemo(() => {
    if (rentang) return tanggalTersedia.find((t) => t.date_iso === rentang.mulai) ?? null
    if ((periode !== 'm1' && periode !== 'm3') || !tanggalAktif) return null
    return cariTanggalPembanding(tanggalTersedia, tanggalAktif, HARI_MUNDUR[periode])
  }, [rentang, periode, tanggalAktif, tanggalTersedia])

  // Hooks dipanggil tanpa syarat sebelum return dini loading/error (Rules of
  // Hooks) — pola sama dengan TopStocks.tsx.
  const { data: pembanding } = useDataPembanding(tanggalPembanding?.stem ?? null)

  if (loading && !hari) {
    return (
      <div className="lantai">
        <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} onRentang={gantiRentang} rentangAktif={rentang} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_JAM} size={28} /></p>
          <p className="lbl">Memuat data…</p>
        </div>
      </div>
    )
  }

  if (error || !hari) {
    return (
      <div className="lantai">
        <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} onRentang={gantiRentang} rentangAktif={rentang} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Data tidak tersedia untuk tanggal ini</p>
        </div>
      </div>
    )
  }

  const sectors = hari.sectors ?? []
  const featured = hari.featured ?? []
  const sharia = hari.sharia ?? []
  const board = hari.board ?? []

  const labelRentang = rentang ? `Perf ${fmtTanggalPendek(rentang.mulai)} – ${fmtTanggalPendek(rentang.akhir)}` : null
  // Performa = akhir vs awal; hari mulai cuma titik pembanding, jadi yang
  // dilaporkan jumlah hari PERGERAKAN (inklusif − 1). Preset 1 Minggu 5–12 Agu
  // berisi 6 hari bursa tapi pergerakannya 5 hari, sesuai konvensi "1 minggu".
  const nHariRentang = rentang
    ? Math.max(1, tanggalTersedia.filter((t) => t.date_iso >= rentang.mulai && t.date_iso <= rentang.akhir).length - 1)
    : 0
  /** % perubahan untuk periode/rentang terpilih dari daftar `sumber` di
   * berkas pembanding — null = pembanding belum ada/tidak ketemu, tampilkan
   * "—" (bukan 0). #88: digeneralisasi dari sektor ke featured/sharia/board. */
  function nilaiPeriodeDari(x: SectorRow, sumber: 'sectors' | 'featured' | 'sharia' | 'board'): number | null {
    if (!rentang) {
      if (periode === 'd') return x.d
      if (periode === 'ytd') return x.ytd
      if (!tanggalPembanding) return null
    }
    const cmp = pembanding?.[sumber]?.find((s) => s.n === x.n)?.v
    return hitungPeriodePct(x.v, cmp)
  }
  const nilaiPeriode = (x: SectorRow) => nilaiPeriodeDari(x, 'sectors')

  // Label pendek periode/rentang untuk header kolom & judul panel (#88) —
  // rentang sebulan sama dipadatkan "5–12 Agu", beda bulan "28 Jul – 12 Agu".
  const labelPeriode = rentang
    ? (rentang.mulai.slice(0, 7) === rentang.akhir.slice(0, 7)
        ? `${Number(rentang.mulai.slice(8))}–${fmtTanggalPendek(rentang.akhir)}`
        : `${fmtTanggalPendek(rentang.mulai)} – ${fmtTanggalPendek(rentang.akhir)}`)
    : PERIODE.find((p) => p.id === periode)!.label

  // ─── Daftar Performa Sektor kompak (re-layout a) ─────────
  const secVals = sectors.map((s) => ({ s, val: nilaiPeriode(s) }))
    .sort((a, b) => (b.val ?? -Infinity) - (a.val ?? -Infinity))
  const angka = secVals.map((x) => x.val).filter((v): v is number => v !== null)
  const lo = Math.min(0, ...angka)
  const hi = Math.max(0, ...angka)
  const span = hi - lo || 1
  const nol = ((0 - lo) / span) * 100

  // Baris tabel 4-kolom (Nama | Nilai | Periode | YTD) — dipakai Indeks
  // Unggulan/Syariah/Board Indices. #88: kolom ke-3 dinamis ikut periode/
  // rentang; valP dihitung pemanggil (Board di-rename SETELAH hitung, supaya
  // pencocokan nama vs berkas pembanding tetap kena).
  const perfRowFull = (x: SectorRow, valP: number | null) => {
    const sym = SYM_INDEKS[x.n] ?? null
    return (
      <tr key={x.n}>
        <td>
          {sym
            ? <Link to={`/chart?sym=${sym}`} className="rk-link" style={{ display: 'inline-block' }} title={`Buka chart ${x.n}`}>{x.n}</Link>
            : x.n}
        </td>
        <td className="r num">{fN(x.v)}</td>
        {valP === null
          ? <td className="r num">—</td>
          : <td className={`r num ${valP >= 0 ? 'up' : 'dn'}`}>{fp(valP)}</td>}
        <td className="r"><span className={`ytd-bdg ${x.ytd >= 0 ? 'u' : 'd'}`}>{fp(x.ytd)}</span></td>
      </tr>
    )
  }

  const indeksUtama = [...featured, ...sharia]
  const sorotUtama = indeksUtama.find((x) => x.n.includes('IDX Composite') || x.n.includes('IHSG'))?.n
  // Panel perbandingan indeks utama ikut periode (#88) — featured & sharia
  // dicari di daftar masing-masing di berkas pembanding.
  const barisUtama = [
    ...featured.map((x) => ({ nama: x.n, nilai: nilaiPeriodeDari(x, 'featured') })),
    ...sharia.map((x) => ({ nama: x.n, nilai: nilaiPeriodeDari(x, 'sharia') })),
  ]

  return (
    <div className="lantai">
      <div ref={kalenderRef}>
        <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} onRentang={gantiRentang} rentangAktif={rentang} />
      </div>

      {labelRentang && (
        <div className="lbl" style={{ margin: '2px 2px -8px' }}>
          Heatmap Sektor — {labelRentang} ({nHariRentang} hari pergerakan)
        </div>
      )}
      <div className="tiles">
        {sectors.map((s) => {
          const kode = s.n.match(/^\[(.)\]/)?.[1] ?? ''
          const nama = s.n.replace(/^\[.\] /, '')
          // Mode rentang: tile pakai % rentang (bukan harian). null = netral.
          const v = rentang ? nilaiPeriode(s) : s.d
          const naik = (v ?? 0) >= 0
          // Intensitas warna: port rumus tile artifact lama (design-lantai-
          // bursa-reimagined.html baris 980) — alpha 0,06-0,38 sebanding |v|,
          // dijenuhkan di 2,2%.
          const alpha = Math.min(Math.abs(v ?? 0) / 2.2, 1) * 0.32 + 0.06
          return (
            <button
              key={s.n}
              type="button"
              className={'tile' + (sektorTerpilih === nama ? ' on' : '')}
              aria-pressed={sektorTerpilih === nama}
              title={`Lihat saham sektor ${nama}`}
              onClick={() => setSektorTerpilih(sektorTerpilih === nama ? null : nama)}
              style={{ background: v === null ? undefined : `color-mix(in srgb, var(${naik ? '--green' : '--red'}) ${(alpha * 100).toFixed(0)}%, transparent)` }}
            >
              <span className="t-code">{kode}</span>
              <span className="t-name">{nama}</span>
              <span className={`t-val ${naik ? 'up' : 'dn'}`}>{v === null ? '—' : fp(v)}</span>
            </button>
          )
        })}
      </div>

      {sektorTerpilih && (() => {
        const target = PETA_SEKTOR_FUNDAMENTAL[sektorTerpilih] ?? []
        const daftar = (indexSaham?.stocks ?? [])
          .filter((e) => target.includes(e.sector))
          .sort((a, b) => a.ticker.localeCompare(b.ticker))
        return (
          <div className="panel">
            <div className="panel-h">
              <span className="lbl"><IkonMenu d={IKON_GRAFIK_BATANG} size={13} /> Saham Sektor {sektorTerpilih}{indexSaham ? ` · ${daftar.length} emiten` : ''}</span>
              <button type="button" className="tab" onClick={() => setSektorTerpilih(null)}>Tutup</button>
            </div>
            {!indexSaham ? (
              <p className="lbl" style={{ padding: '10px 2px' }}>Memuat daftar saham…</p>
            ) : (
              <>
                <div className="sek-emiten">
                  {daftar.map((e) => (
                    <Link key={e.ticker} to={`/chart?sym=${e.ticker}`} className="sek-em">
                      <span className="tick">{e.ticker}</span>
                      <span className="sek-em-nm">{e.name}</span>
                    </Link>
                  ))}
                </div>
                <div className="sek-cat">{CATATAN_SEKTOR[sektorTerpilih] ?? CATATAN_UMUM}</div>
              </>
            )}
          </div>
        )
      })()}

      <div className="grid2">
      <div className="panel">
        <div className="panel-h">
          <span className="lbl"><IkonMenu d={IKON_GRAFIK_BATANG} size={13} /> Performa Sektor</span>
          <div className="tabs sek-periode-tabs" role="tablist" aria-label="Periode Performa Sektor">
            {PERIODE.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={!rentang && periode === p.id}
                className={'tab' + (!rentang && periode === p.id ? ' on' : '')}
                onClick={() => {
                  setPeriode(p.id)
                  if (rentang) gantiRentang(null)
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={!!rentang}
              className={'tab' + (rentang ? ' on' : '')}
              title={rentang ? labelRentang ?? undefined : undefined}
              onClick={bukaTabRentang}
            >
              Rentang
            </button>
          </div>
        </div>
        {/* Daftar portrait 1 kolom (#87): nama | nilai indeks | bar mini
            | badge %. Sumbu nol proporsional, pola BatangPeringkat. */}
        <div className="rank-wrap potret">
          {secVals.map(({ s, val }) => {
            const positif = (val ?? 0) >= 0
            const lebar = val === null ? 0 : (Math.abs(val) / span) * 100
            const nama = s.n.replace(/^\[.\] /, '')
            const sym = SYM_SEKTOR[nama] ?? null
            const isi = (
              <>
                <span className="rk-nm" title={s.n}>{nama}</span>
                <span className="rk-nv num" title="Nilai indeks">{fN(s.v)}</span>
                <span className="rk-tr" style={{ '--nol': `${nol}%` } as CSSProperties}>
                  {val !== null && (
                    <i
                      className={`rk-b ${positif ? 'p' : 'n'}`}
                      style={positif ? { left: `${nol}%`, width: `${lebar}%` } : { right: `${100 - nol}%`, width: `${lebar}%` }}
                    />
                  )}
                </span>
                {val === null
                  ? <span className="rk-v">—</span>
                  : <span className={`ytd-bdg ${positif ? 'u' : 'd'}`}>{fp(val)}</span>}
              </>
            )
            return sym ? (
              <Link className="rk-row sek rk-link" key={s.n} to={`/chart?sym=${sym}`} title={`Buka chart sektor ${nama}`}>
                {isi}
              </Link>
            ) : (
              <div className="rk-row sek" key={s.n}>{isi}</div>
            )
          })}
        </div>
      </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl">{labelPeriode} — Perbandingan Semua Indeks Utama</span></div>
          <BatangPeringkat baris={barisUtama} sorot={sorotUtama} symUntuk={(n) => SYM_INDEKS[n] ?? null} potret />
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-h"><span className="lbl"><IkonMenu d={IKON_GRAFIK_NAIK} size={13} /> Indeks Unggulan</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Indeks</th><th className="r">Nilai</th><th className="r">{labelPeriode}</th><th className="r">YTD</th></tr></thead>
              <tbody>{featured.map((x) => perfRowFull(x, nilaiPeriodeDari(x, 'featured')))}</tbody>
            </table>
          </div>
        </div>
        <div className="sec-stack">
          <div className="panel">
            <div className="panel-h"><span className="lbl"><IkonMenu d={IKON_BULAN_SABIT} size={13} /> Indeks Syariah</span></div>
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Indeks</th><th className="r">Nilai</th><th className="r">{labelPeriode}</th><th className="r">YTD</th></tr></thead>
                <tbody>{sharia.map((x) => perfRowFull(x, nilaiPeriodeDari(x, 'sharia')))}</tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <div className="panel-h"><span className="lbl"><IkonMenu d={IKON_KOTAK_ARSIP} size={13} /> Board Indices</span></div>
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Board</th><th className="r">Nilai</th><th className="r">{labelPeriode}</th><th className="r">YTD</th></tr></thead>
                <tbody>
                  {board.map((x) => perfRowFull({
                    ...x,
                    n: x.n.replace('Main Board', 'Papan Utama').replace('Development Board', 'Papan Pengembangan').replace('Acceleration Board', 'Papan Akselerasi'),
                  }, nilaiPeriodeDari(x, 'board')))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
