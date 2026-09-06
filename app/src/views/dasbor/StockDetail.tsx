import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { useStockFundamental, useStockIndex } from '../../lib/dasbor/stockDetailData'
import { useSektorIdx, sektorEmiten, papanBerisiko } from '../../lib/dasbor/sektorIdx'
import { fMC, fv, fvx } from '../../lib/dasbor/stockDetailFormat'
import { keFraksi } from '../../lib/fraksiHarga'
import { LencanaTurunan } from '../../components/dasbor/LencanaTurunan'
import { FdPercent } from '../../components/dasbor/FdPercent'
import { PanelValuasi, PanelPerSaham, PanelSolvency, PanelEfektivitas, PanelSkor } from './stock-detail/KolomValuasi'
import { PanelKuartalan, PanelProfitabilitas, PanelGrowth, PanelDividen, PanelRiwayatDividen } from './stock-detail/KolomKuartalan'
import { PanelIncome, PanelBalance, PanelCashflow, PanelPerformance, PanelTahunan } from './stock-detail/KolomLaporan'
import { PanelValuasiInteraktif } from './stock-detail/PanelValuasiInteraktif'
import { PanelLaporanKeuangan } from './stock-detail/PanelLaporanKeuangan'
import { PanelValuasiHistoris } from './stock-detail/PanelValuasiHistoris'
import { PanelAliranAsing } from '../../components/dasbor/PanelAliranAsing'
import { PanelAktivitasTransaksi } from '../../components/dasbor/PanelAktivitasTransaksi'
import { PanelLimaLangkahUang } from '../../components/dasbor/PanelLimaLangkahUang'
import { PanelKhasPapan } from '../../components/dasbor/PanelKhasPapan'
import { PanelBandingEmiten } from '../../components/dasbor/PanelBandingEmiten'
import { IkonMenu, IKON_PERINGATAN, IKON_JAM } from '../../components/dasbor/IkonMenu'
import { usePengendali, pengendaliEmiten, labelPengendali } from '../../lib/dasbor/pengendali'
import { tanggalPendek } from '../../lib/dasbor/statistikBerkala'
import { muatTambahanKeystats, type TambahanKeystats } from '../../lib/dasbor/rasioTambahanKeystats'
import './StockDetail.css'

type Tab = 'statistik' | 'valuasi' | 'banding'

/** Chip saham populer di empty state — daftar beku dari mockup. */
const POPULER = ['BBCA', 'BBRI', 'TLKM', 'ASII', 'AMMN', 'TPIA']

/** localStorage "terakhir dilihat" — simpan maks 3 ticker terakhir. */
const RECENT_KEY = 'sd_recent_tickers'

function bacaRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 3) : []
  } catch {
    return []
  }
}

/** Satu sel strip rasio (.rasio mockup): label + nilai + sub. */
function RasioCell({ lbl, v, cls, sub }: { lbl: string; v: ReactNode; cls?: string; sub?: ReactNode }) {
  return (
    <div>
      <span className="lbl">{lbl}</span>
      <div className={`v num${cls ? ' ' + cls : ''}`}>{v}</div>
      <span className="sub">{sub ?? ' '}</span>
    </div>
  )
}

function persen(v: number | null): string {
  return v != null ? Number(v).toFixed(2) + '%' : '—'
}

/** Baris label + nilai rata-kanan — sama pola dengan TR() di KolomValuasi.tsx. */
function BarisTambahan({ lbl, val }: { lbl: string; val: ReactNode }) {
  return (
    <tr>
      <td>{lbl}</td>
      <td className="r num">{val}</td>
    </tr>
  )
}

/**
 * Rasio bank/multifinance — ruas yang TAK DIPUNYAI fundamental lama sama
 * sekali (yfinance tak punya rasio industri spesifik ini). Kosong total
 * untuk ~915 emiten non-keuangan; panel tak dirender kalau begitu, bukan
 * menampilkan baris "—" berbaris-baris.
 */
function PanelRasioBank({ bank }: { bank: TambahanKeystats['bank'] }) {
  if (!bank) return null
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Rasio Perbankan/Multifinance</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            <BarisTambahan lbl="NPL Gross" val={persen(bank.nplGross)} />
            <BarisTambahan lbl="NPL Coverage" val={persen(bank.nplCoverage)} />
            <BarisTambahan lbl="NPF Gross (Syariah)" val={persen(bank.npfGross)} />
            <BarisTambahan lbl="NPF Coverage (Syariah)" val={persen(bank.npfCoverage)} />
            <BarisTambahan lbl="CASA Ratio" val={persen(bank.casaRatio)} />
            <BarisTambahan lbl="Capital Adequacy Ratio" val={persen(bank.capitalAdequacyRatio)} />
            <BarisTambahan lbl="Loan to Deposit Ratio" val={persen(bank.loanToDepositRatio)} />
            <BarisTambahan lbl="Financing to Deposit Ratio" val={persen(bank.financingToDepositRatio)} />
            <BarisTambahan lbl="Net Interest Margin" val={persen(bank.netInterestMargin)} />
            <BarisTambahan lbl="Cost of Credit" val={persen(bank.costOfCredit)} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Posisi persentil emiten di antara seluruh emiten IDX — bukan rasio itu
 * sendiri, tapi rangkingnya. Tak ada padanan di fundamental lama.
 */
function PanelPeringkatPeer({ rank }: { rank: TambahanKeystats['rank'] }) {
  if (!rank) return null
  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Peringkat Antar Emiten IDX</span></div>
      <div className="panel-b">
        <p style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.55 }}>
          Persentil dibanding seluruh emiten tercatat — 100% berarti paling tinggi di deretnya.
        </p>
        <table>
          <tbody>
            <BarisTambahan lbl="Kapitalisasi Pasar" val={persen(rank.marketCap)} />
            <BarisTambahan lbl="P/E (TTM)" val={persen(rank.peTtm)} />
            <BarisTambahan lbl="Earnings Yield" val={persen(rank.earningsYield)} />
            <BarisTambahan lbl="P/S" val={persen(rank.ps)} />
            <BarisTambahan lbl="P/BV" val={persen(rank.pb)} />
            <BarisTambahan lbl="Kedekatan ke Tertinggi 52 Minggu" val={persen(rank.near52wHigh)} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Profil naratif — alamat/kontak resmi, sekretaris perusahaan, ringkasan
 * pencatatan awal. Fundamental lama cuma punya `summary` Inggris dari
 * penyedia lama; ini pelengkap, bukan pengganti.
 */
function PanelProfilPerusahaan({ profil }: { profil: TambahanKeystats['profil'] }) {
  if (!profil) return null
  const { alamat, telepon, email, website, latarBelakang, sekretaris, pencatatanAwal } = profil
  if (!alamat && !latarBelakang && !sekretaris && !pencatatanAwal) return null
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-h"><span className="lbl">Profil Perusahaan</span></div>
      <div className="panel-b">
        {latarBelakang && (
          <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {latarBelakang}
          </p>
        )}
        <div className="duo">
          {(alamat || telepon || email || website) && (
            <div className="panel">
              <div className="panel-h"><span className="lbl">Kantor Pusat</span></div>
              <div className="panel-b" style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
                {alamat && <div style={{ whiteSpace: 'pre-line' }}>{alamat}</div>}
                {telepon && <div>Telepon: {telepon}</div>}
                {email && <div>Email: {email}</div>}
                {website && <div>Situs: {website}</div>}
              </div>
            </div>
          )}
          {sekretaris && (
            <div className="panel">
              <div className="panel-h"><span className="lbl">Sekretaris Perusahaan</span></div>
              <div className="panel-b" style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
                <div>{sekretaris.nama}</div>
                {sekretaris.telepon && <div>Telepon: {sekretaris.telepon}</div>}
                {sekretaris.email && <div>Email: {sekretaris.email}</div>}
              </div>
            </div>
          )}
          {pencatatanAwal && (
            <div className="panel">
              <div className="panel-h"><span className="lbl">Pencatatan Awal (IPO)</span></div>
              <div className="panel-b">
                <table>
                  <tbody>
                    {pencatatanAwal.tanggal && <BarisTambahan lbl="Tanggal" val={pencatatanAwal.tanggal} />}
                    {pencatatanAwal.harga && <BarisTambahan lbl="Harga Perdana" val={'Rp ' + pencatatanAwal.harga} />}
                    {pencatatanAwal.jumlahSaham && <BarisTambahan lbl="Jumlah Saham" val={pencatatanAwal.jumlahSaham} />}
                    {pencatatanAwal.underwriters.length > 0 && (
                      <BarisTambahan lbl="Penjamin Emisi" val={pencatatanAwal.underwriters.join(', ')} />
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Panel "Stock Detail" — search custom-autocomplete → fetch on-demand
 * data-idx/json/fundamental/{KODE}.json. Re-layout mockup
 * stock-detail-relayout.html:
 * - Empty state: pencarian jadi panggung tengah (.empty) + chip populer +
 *   terakhir dilihat (localStorage); kotak cari atas DISEMBUNYIKAN di state
 *   ini (dobel fungsi), tampil lagi begitu ada ticker aktif.
 * - Halaman data: hero 3 zona (.hero) + strip rasio (.rasio) + konten 2
 *   kolom seimbang (.duo) menggantikan .fd-layout 3 kolom lama.
 *
 * Task 11: dipecah jadi 2 tab lewat `?tab=` (bukan modal) — isian simulasi
 * Graham/DDM di tab valuasi harus tetap bisa dibagikan lewat tautan, dan
 * modal akan membuang hasil simulasi saat ditutup.
 */
export function StockDetail() {
  const { index } = useStockIndex()
  const [inputVal, setInputVal] = useState('')
  // Emiten boleh datang dari URL. Tanpa ini, `?sym=BBCA` diabaikan dan halaman
  // terbuka KOSONG tanpa satu pun galat — dan itu tujuan setiap tautan "Buka
  // Stock Detail" dari Tanya PAPAN. Terima `kode` juga, karena seluruh aplikasi
  // memakai `?kode=` untuk emiten (aturan "semua kode emiten ke chart"); nama
  // lama `sym` DIPERTAHANKAN, bukan diganti — mengganti nilai tanpa menyapu
  // pembacanya persis regresi #142.
  const [activeTicker, setActiveTicker] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('sym')?.toUpperCase()
      ?? new URLSearchParams(window.location.search).get('kode')?.toUpperCase()
      ?? null,
  )
  const { data: fd, loading, error } = useStockFundamental(activeTicker)
  // Klasifikasi IDX-IC resmi (B1) — berkasnya kecil & di-cache modul.
  const daftarSektor = useSektorIdx()
  const idxSektor = sektorEmiten(daftarSektor, activeTicker || '')
  // Pemegang saham pengendali (B3) — laporan resmi bursa hanya memuat KATEGORI
  // pengendali, bukan namanya (lihat lib/dasbor/pengendali.ts).
  const daftarPengendali = usePengendali()
  const pengendali = pengendaliEmiten(daftarPengendali, activeTicker || '')
  const [sp, setSp] = useSearchParams()
  const tabUrl = sp.get('tab')
  const tab: Tab = tabUrl === 'valuasi' ? 'valuasi' : tabUrl === 'banding' ? 'banding' : 'statistik'

  // Ruas tambahan Stockbit (rasio bank/multifinance, peringkat peer, profil
  // naratif) — hanya yang belum tayang dari fundamental lama, lihat
  // `lib/dasbor/rasioTambahanKeystats.ts`.
  const [tambahan, setTambahan] = useState<TambahanKeystats | null>(null)
  useEffect(() => {
    let batal = false
    setTambahan(null)
    if (activeTicker) muatTambahanKeystats(activeTicker).then((d) => { if (!batal) setTambahan(d) })
    return () => { batal = true }
  }, [activeTicker])

  const [recent, setRecent] = useState<string[]>(bacaRecent)
  useEffect(() => {
    if (!fd) return
    setRecent((prev) => {
      const next = [fd.ticker, ...prev.filter((t) => t !== fd.ticker)].slice(0, 3)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* storage penuh/privat — abaikan */ }
      return next
    })
  }, [fd])

  function handleSubmit(raw: string) {
    const kode = raw.trim().toUpperCase().replace('.JK', '')
    if (!kode) return
    setInputVal(kode)
    setActiveTicker(kode)
  }

  // ── Turunan hero & rasio ──
  const lo = fd?.week52_low ?? null
  const hi = fd?.week52_high ?? null
  const px = fd?.last_price ?? null
  const pos52 = lo != null && hi != null && px != null && hi !== lo
    ? Math.max(2, Math.min(98, ((px - lo) / (hi - lo)) * 100))
    : null
  // financial_currency dari JSON fundamental; fallback ke currency (saat ini
  // financial_currency masih null di semua file — currency terisi "IDR").
  const mataUang = (fd?.financial_currency as string | undefined) ?? fd?.currency ?? null
  const earningsYield = fd?.eps && fd.last_price ? (fd.eps / fd.last_price) * 100 : null

  return (
    <div className="lantai">
      {activeTicker && (
        <div>
          {/* Proporsi #81: input dominan (flex:1 di StockAutocomplete, cap
              lebar wajar di wrap), tombol ramping ikon-saja + aria-label. */}
          <div className="fd-search-wrap" style={{ maxWidth: 480, marginBottom: 6, flexWrap: 'nowrap' }}>
            <StockAutocomplete stocks={index?.stocks ?? []} value={inputVal} onChange={setInputVal} onSelect={handleSubmit} />
            <button
              type="button" className="btn-p" aria-label="Tampilkan"
              style={{ padding: '7px 12px', flexShrink: 0 }}
              onClick={() => handleSubmit(inputVal)}
            >
            </button>
          </div>
          {/* "Data delay" saja menyisakan pertanyaan yang justru menentukan:
              tertinggal lima belas menit atau tiga hari? Tanggalnya membuat
              pembaca menilai sendiri, bukan menebak. Ditempel hanya kalau
              memang ada — "Terakhir diperbarui —" lebih buruk daripada diam. */}
          <p style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>
            Data delay, bukan harga real-time.{fd?.updated ? ` Terakhir diperbarui ${fd.updated}.` : ''}
          </p>
        </div>
      )}

      {!activeTicker && (
        <div className="panel">
          <div className="empty">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <p><b>Cari kode saham IDX</b> untuk membedah data fundamentalnya — valuasi, laporan kuartalan, dividen, arus kas.</p>
            <div className="cari">
              <StockAutocomplete stocks={index?.stocks ?? []} value={inputVal} onChange={setInputVal} onSelect={handleSubmit} />
              <button type="button" className="btn-p" onClick={() => handleSubmit(inputVal)}>Tampilkan</button>
            </div>
            <div className="chips">
              {POPULER.map((t) => (
                <button key={t} type="button" className="chip-t" onClick={() => handleSubmit(t)}>{t}</button>
              ))}
            </div>
            {recent.length > 0 && (
              <span className="lbl">
                Terakhir dilihat:{' '}
                {recent.map((t, i) => (
                  <span key={t}>
                    {i > 0 && ' · '}
                    <button type="button" className="chip-r" onClick={() => handleSubmit(t)}>{t}</button>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      )}

      {activeTicker && loading && (
        <div className="fd-empty">
          <p><IkonMenu d={IKON_JAM} size={28} /></p>
          <p>Mengambil data {activeTicker}…</p>
        </div>
      )}

      {activeTicker && !loading && error && (
        <div className="fd-empty">
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p>Data <strong>{activeTicker}</strong> tidak ditemukan.</p>
          <p style={{ fontSize: 10, marginTop: 8 }}>Pastikan kode saham benar (contoh: BBCA, ASII, TLKM)</p>
        </div>
      )}

      {activeTicker && !loading && !error && fd && (
        <>
          {/* Hero 3 zona: identitas | harga + rentang 52 minggu | grid 6 stat */}
          <div className="panel hero">
            <div className="ident">
              <span className="tk">{fd.ticker} · IDX</span>
              <div className="nm">{fd.name || ''}</div>
              {/* Klasifikasi IDX-IC RESMI kalau ada, turun sampai subsektor.
                  Yang lama (`fd.sector`/`fd.industry`) berasal dari Yahoo dan
                  bukan IDX-IC — dipakai sebagai cadangan supaya emiten yang
                  belum terpanen tak jadi kosong. */}
              <div className="sek">
                {/* Nilai klasifikasi = nama RESMI Inggris IDX (Johan 27 Agu);
                    _en kosong -> jatuh ke Indonesia, jangan kosong. */}
                {idxSektor?.sektor
                  ? <>{idxSektor.sektor_en ?? idxSektor.sektor}{(idxSektor.subsektor_en ?? idxSektor.subsektor) ? ' · ' + (idxSektor.subsektor_en ?? idxSektor.subsektor) : ''}</>
                  : <>{fd.sector || ''}{fd.industry ? ' · ' + fd.industry : ''}</>}
              </div>
              {/* Pemegang saham pengendali. Yang dilaporkan bursa cuma
                  KATEGORInya — laporan resmi tak memuat nama, jadi kalimatnya
                  tak boleh menyiratkan kita tahu siapa. Tanggal laporan ikut
                  tampil karena kepemilikan berubah: tanpa itu kategori dari
                  laporan 2019 terbaca sebagai posisi hari ini. */}
              <div className="sd-pengendali">
                Pengendali:{' '}
                {pengendali
                  ? <>
                      <b>{labelPengendali(pengendali.jenis)}</b>
                      {pengendali.tanggal ? ` · per laporan ${tanggalPendek(pengendali.tanggal)}` : ''}
                    </>
                  : 'belum tersedia'}
              </div>
              {/* Papan pencatatan. "Pemantauan Khusus" ditandai dan ditaruh di
                  KEPALA halaman — itu penanda risiko dari bursa (154 dari 962
                  emiten), dan angka fundamental apa pun tentang emiten itu
                  harus dibaca dengan penanda ini terlihat lebih dulu, bukan
                  sesudah pembacanya menyimpulkan sesuatu. */}
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
              {mataUang && <span className="badge">Laporan: {mataUang}</span>}
            </div>
            <div className="harga">
              {/* Harga tampil WAJIB lewat `keFraksi()` (aturan proyek) — angka
                  yang tak jatuh di tick BEI adalah harga yang tak pernah bisa
                  dipesan. Diukur 21 Agu 2026 atas 300 berkas fundamental:
                  `last_price` memang SUDAH sejajar tick (0 pelanggaran), jadi
                  di sini keFraksi tak mengubah angka hari ini — ia jaring
                  pengaman kalau sumbernya berubah. Yang benar-benar melenceng
                  justru low/high 52 minggu di bawah (harga hasil penyesuaian
                  dividen/split Yahoo, mis. 66,553955 dan 5.312,497). */}
              <span className="px num">{px != null ? 'Rp ' + keFraksi(Number(px), 'dekat').toLocaleString('id-ID') : '—'}</span>
              <div className="rng">
                <span className="lbl">
                  Rentang 52 Minggu{fd.week52_change_pct != null && <> · <FdPercent v={fd.week52_change_pct} d={2} /></>}
                </span>
                <div className="rngbar">{pos52 != null && <i style={{ left: `calc(${pos52}% - 5px)` }} />}</div>
                <div className="mm">
                  <span>{lo != null ? keFraksi(Number(lo), 'dekat').toLocaleString('id-ID') : '—'}</span>
                  <span>{hi != null ? keFraksi(Number(hi), 'dekat').toLocaleString('id-ID') : '—'}</span>
                </div>
              </div>
            </div>
            <div className="statgrid">
              <div><span className="lbl">Mkt Cap</span><span className="v">{fMC(fd.market_cap)}</span></div>
              <div><span className="lbl">EV</span><span className="v">{fMC(fd.enterprise_value)}</span></div>
              <div><span className="lbl">Vol Avg</span><span className="v">{fd.avg_volume ? (fd.avg_volume / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' Jt' : '—'}</span></div>
              <div><span className="lbl">Free Float</span><span className="v">{fd.float_pct ? fd.float_pct.toFixed(2) + '%' : '—'}</span></div>
              <div><span className="lbl">Saham Beredar</span><span className="v">{fd.shares ? (fd.shares / 1e9).toFixed(2) + ' M' : '—'}</span></div>
              <div><span className="lbl">Beta</span><span className="v">{fd.beta ?? '—'}</span></div>
            </div>
          </div>

          {/* Strip rasio full-width 6 sel */}
          <div className="rasio">
            <RasioCell lbl="P/E (TTM)" v={<>{fvx(fd.pe)}<LencanaTurunan fd={fd} ruas="pe" /></>} sub={fd.forward_pe != null ? `fwd ${fvx(fd.forward_pe)}` : null} />
            <RasioCell lbl="P/B" v={fvx(fd.pb)} sub={fd.bv != null ? `BV Rp ${fv(fd.bv)}` : null} />
            <RasioCell lbl="P/S (TTM)" v={fvx(fd.ps)} sub={fd.rev_ps != null ? `Rev/shr Rp ${fv(fd.rev_ps)}` : null} />
            <RasioCell
              lbl="Earnings Yield"
              v={<>{earningsYield != null ? (earningsYield >= 0 ? '+' : '') + earningsYield.toFixed(2) + '%' : '—'}<LencanaTurunan fd={fd} ruas="eps" /></>}
              cls={earningsYield != null ? (earningsYield >= 0 ? 'up' : 'dn') : undefined}
              sub={fd.eps != null ? `EPS Rp ${fv(fd.eps)}` : null}
            />
            <RasioCell
              lbl="Div Yield"
              v={<>{fd.dividend_yield != null ? '+' + fd.dividend_yield.toFixed(2) + '%' : '—'}<LencanaTurunan fd={fd} ruas="dividend_yield" /></>}
              cls={fd.dividend_yield != null ? 'up' : undefined}
              sub={fd.dividend != null
                ? `Rp ${fv(fd.dividend)}${fd.payout_ratio != null ? ` · payout ${(fd.payout_ratio * 100).toFixed(0)}%` : ''}`
                : null}
            />
            <RasioCell lbl="FCF/Share" v={fd.fcf_ps != null ? `Rp ${fv(fd.fcf_ps)}` : '—'} sub={fd.cash_ps != null ? `Cash/shr Rp ${fv(fd.cash_ps)}` : null} />
          </div>

          <div style={{ fontSize: 9, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span><IkonMenu d={IKON_JAM} size={11} /> Data delay · Diperbarui: {fd.updated || '—'}</span>
          </div>

          <div className="tabs" role="tablist" aria-label="Tab Detail Saham">
            <button
              type="button" role="tab" aria-selected={tab === 'statistik'}
              className={'tab' + (tab === 'statistik' ? ' on' : '')}
              /* Bentuk FUNGSIONAL, bukan objek: setSp({tab}) MENGGANTI seluruh
                 query string, jadi ?sym= hilang begitu pengguna pindah tab dan
                 halaman jadi kosong lagi. */
              onClick={() => setSp((p) => { p.set('tab', 'statistik'); return p }, { replace: true })}
            >
              Statistik
            </button>
            <button
              type="button" role="tab" aria-selected={tab === 'valuasi'}
              className={'tab' + (tab === 'valuasi' ? ' on' : '')}
              onClick={() => setSp((p) => { p.set('tab', 'valuasi'); return p }, { replace: true })}
            >
              Valuasi
            </button>
            <button
              type="button" role="tab" aria-selected={tab === 'banding'}
              className={'tab' + (tab === 'banding' ? ' on' : '')}
              onClick={() => setSp((p) => { p.set('tab', 'banding'); return p }, { replace: true })}
            >
              Banding
            </button>
          </div>

          {tab === 'statistik' && (
            /* Aktivitas Transaksi — dipindah dari Bedah Emiten (pensiun 21
               Agu 2026, backlog A2 / #153): seberapa ramai emiten ini
               benar-benar diperdagangkan, sebelum angka valuasi apa pun. */
            <PanelAktivitasTransaksi ticker={fd.ticker} fd={fd} />
          )}

          {tab === 'statistik' && (
            /* #99: panel Laporan Keuangan (chart + breakdown kuartal/tahunan)
               di luar .duo — perlu lebar penuh untuk chart & tabel periode,
               bukan kolom sempit 340px seperti panel ringkas lain. */
            <PanelLaporanKeuangan ticker={fd.ticker} />
          )}

          {tab === 'statistik' && (
            /* Aliran Asing — panen terpisah (data-idx/json/asing/), lebar
               penuh sama seperti Laporan Keuangan (grafik + tabel butuh
               ruang, bukan kolom sempit .duo). */
            <PanelAliranAsing ticker={fd.ticker} />
          )}

          {tab === 'statistik' && (
            /* Lima Langkah Uang — dipindah dari Bedah Emiten: penjualan →
               laba → EPS → kas operasi → dividen, dan rasio antar langkahnya. */
            <PanelLimaLangkahUang fd={fd} />
          )}

          {tab === 'statistik' && (
            /* #93 Key Stats — panel anak langsung .duo (multicol), urutan
               kiri→kanan ala referensi Stockbit: valuasi & per-saham dulu,
               solvabilitas & efektivitas, profitabilitas/growth/dividen,
               lalu kuartalan + laporan ringkas + skor + performance. */
            <div className="duo">
              {/* A1 — pembanding historis ditaruh SEBELUM panel Valuasi mentah:
                  angka telanjang lebih mudah disalahbaca kalau pembandingnya
                  baru muncul di bawahnya. */}
              <PanelValuasiHistoris fd={fd} />
              <PanelValuasi fd={fd} />
              <PanelPerSaham fd={fd} />
              <PanelSolvency fd={fd} />
              <PanelEfektivitas fd={fd} />
              <PanelProfitabilitas fd={fd} />
              <PanelGrowth fd={fd} />
              <PanelDividen fd={fd} />
              <PanelRiwayatDividen fd={fd} />
              <PanelKuartalan fd={fd} />
              <PanelTahunan fd={fd} />
              <PanelIncome fd={fd} />
              <PanelBalance fd={fd} />
              <PanelCashflow fd={fd} />
              <PanelSkor fd={fd} />
              <PanelPerformance fd={fd} />
            </div>
          )}

          {tab === 'statistik' && (
            /* Panel Khas PAPAN — dipindah dari Bedah Emiten: Altman Z-Score,
               Piotroski F-Score, ROIC, ROCE, siklus konversi kas, tiap angka
               disertai satu kalimat bacaan (beda dari angka mentah yang sudah
               ada di panel Solvabilitas/Efektivitas/Skor di atas). */
            <PanelKhasPapan fd={fd} />
          )}

          {tab === 'statistik' && (
            /* Tambahan Stockbit 24 Agu 2026 (Papan Pekerjaan #313): rasio
               perbankan/multifinance + peringkat peer, dua-duanya pure
               tambahan (tak dipunyai fundamental lama). Panel bank tak
               dirender sama sekali untuk emiten non-keuangan. */
            <div className="duo">
              <PanelRasioBank bank={tambahan?.bank ?? null} />
              <PanelPeringkatPeer rank={tambahan?.rank ?? null} />
            </div>
          )}

          {tab === 'statistik' && <PanelProfilPerusahaan profil={tambahan?.profil ?? null} />}

          {tab === 'valuasi' && <PanelValuasiInteraktif key={fd.ticker} fd={fd} />}

          {tab === 'banding' && (
            /* Banding Emiten — dipindah dari Bedah Emiten. Tab sendiri
               (bukan panel di dalam Statistik): berat (sampai 5× fetch
               fundamental+asing) dan dirender HANYA saat tabnya aktif. */
            <PanelBandingEmiten key={fd.ticker} awal={fd.ticker} />
          )}
        </>
      )}
    </div>
  )
}
