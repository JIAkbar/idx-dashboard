import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Kalender, fmtTanggalPendek } from '../../components/dasbor/Kalender'
import { KonteksData } from '../../components/dasbor/KonteksData'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { useDataHarian, useDataRentang } from '../../lib/dasbor/dataHarian'
import type { RentangTanggal } from '../../lib/dasbor/periode'
import { useUrut } from '../../lib/dasbor/useUrut'
import { fN, fp } from '../../lib/dasbor/format'
import type { StockContribRow, StockMoveRow } from '../../lib/dasbor/dataHarian'
import { IkonMenu, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'

/**
 * Reset tombol judul kolom ke tampilan teks polos — padanan `button{font:
 * inherit;color:inherit;background:none;border:none;cursor:pointer;padding:0}`
 * (docs/design-lantai-bursa-reimagined.html:55). Aturan itu ada di "BASE" milik
 * artifact tapi TIDAK ikut disalin ke lantai.css (komentar lantai.css bilang
 * "sudah ditangani di luar .lantai", nyatanya belum — dasbor.css juga tidak
 * punya reset button global). Ditaruh inline di sini, bukan di lantai.css,
 * karena file itu di luar cakupan Task 6.
 */

// Kolom presisi lintas tabel bertumpuk (kemampuan-web-dev §141): table-layout:fixed
// + colgroup proporsi sama + minWidth di <table> supaya menyempit = scroll, bukan kompres.
const tbl3: CSSProperties = { tableLayout: 'fixed', width: '100%', minWidth: 280 }
const tbl4: CSSProperties = { tableLayout: 'fixed', width: '100%', minWidth: 340 }
const kol3 = (
  <colgroup><col style={{ width: '40%' }} /><col style={{ width: '30%' }} /><col style={{ width: '30%' }} /></colgroup>
)
const kol4 = (
  <colgroup><col style={{ width: '28%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /></colgroup>
)

type UrutState<T> = { kunci: keyof T; arah: 'naik' | 'turun'; klik: (k: keyof T) => void }

/** Judul kolom yang bisa diklik untuk mengurutkan; teks & makna kolom tetap sama. */
function thSort<T extends object>(s: UrutState<T>, k: keyof T, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

/**
 * Panel "Top Stocks" — port buildStocksPanel() index_live.html baris 2839-2916,
 * bergaya papan "Lantai Bursa" (docs/design-lantai-bursa-reimagined.html
 * baris 497-557).
 *
 * Enam blok dan urutannya beku — hanya lapisan tampilan yang berubah: Top 10
 * Market Capitalization, Top Gainers, Top Losers, Top Leaders (Kontribusi),
 * Top Leaders YTD, Top Laggards (Kontribusi), Top Laggards YTD.
 *
 * Pengurutan lewat judul kolom (useUrut, Task 6) dipasang di keenam tabel di
 * bawah — TIDAK di Top 10 Market Cap, itu daftar peringkat ber-.mc-row, bukan
 * tabel biasa.
 */
export function TopStocks() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()

  // ─── Mode RENTANG (#75) — JUJUR: daftar top-10 adalah snapshot per-hari
  // (IDX tidak menerbitkan top-10 agregat lintas hari), jadi yang diagregat
  // hanya ringkasan pasar (vol/val/frek harian dari tiap berkas); daftar
  // top-10 tetap tampil untuk tanggal AKHIR rentang, dilabeli banner jelas. ──
  const [rentang, setRentang] = useState<RentangTanggal | null>(null)
  function gantiRentang(r: RentangTanggal | null) {
    setRentang(r)
    if (r) pilihTanggal(r.akhir)
  }
  const rentangTanggal = useMemo(
    () => (rentang ? tanggalTersedia.filter((t) => t.date_iso >= rentang.mulai && t.date_iso <= rentang.akhir) : []),
    [rentang, tanggalTersedia],
  )
  const { days, loading: loadingR, selesai, total, error: errorR } = useDataRentang(rentangTanggal)
  // Agregat ringkasan pasar: satuan mengikuti DataHarian (vol juta lembar,
  // val miliar IDR, freq ribu transaksi). Hari tanpa ruas ringkasan dilewati
  // dan dihitung jujur lewat `n`.
  const agg = useMemo(() => {
    if (!days) return null
    let vol = 0; let val = 0; let frek = 0; let n = 0
    for (const d of days) {
      if (d.vol_today == null && d.val_idr_today == null && d.freq_today == null) continue
      vol += d.vol_today ?? 0
      val += d.val_idr_today ?? 0
      frek += d.freq_today ?? 0
      n += 1
    }
    return { vol, val, frek, n }
  }, [days])
  /** Tanggal yang benar-benar sedang ditampilkan. Judul panel dulu tertulis
   *  "Hari Ini", padahal strip kalender membiarkan pembaca menggeser ke
   *  tanggal mana pun — dan begitu digeser, judulnya berbohong. Menyebut
   *  tanggalnya juga menjawab pertanyaan yang wajar muncul pada data delay:
   *  ini angka kapan? */
  const labelTanggal = tanggalAktif ? fmtTanggalPendek(tanggalAktif) : ''

  const ihsgMulai = rentang ? tanggalTersedia.find((t) => t.date_iso === rentang.mulai)?.ihsg : undefined
  const ihsgAkhir = rentang ? tanggalTersedia.find((t) => t.date_iso === rentang.akhir)?.ihsg : undefined
  const ihsgPctRentang = ihsgMulai && ihsgAkhir ? (ihsgAkhir / ihsgMulai - 1) * 100 : null

  // Hooks dipanggil tanpa syarat sebelum return dini loading/error (Rules of
  // Hooks) — pola sama dengan SektorIndeks.tsx.
  const gainersS = useUrut<StockMoveRow>(hari?.gainers ?? [], 'p')
  const losersS = useUrut<StockMoveRow>(hari?.losers ?? [], 'p')
  const leadersTodayS = useUrut<StockContribRow>(hari?.leaders_today ?? [], 'ih')
  const leadersYtdS = useUrut<StockContribRow>(hari?.leaders_ytd ?? [], 'ih')
  const laggardsTodayS = useUrut<StockContribRow>(hari?.laggards_today ?? [], 'ih')
  const laggardsYtdS = useUrut<StockContribRow>(hari?.laggards_ytd ?? [], 'ih')

  if (loading && !hari) {
    return (
      <div className="lantai">
        <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} onRentang={gantiRentang} rentangAktif={rentang} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 28 }}>⏳</p>
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

  const mcap = hari.mcap ?? []
  const mx = mcap[0]?.v || 1

  const contribRow = (x: StockContribRow, dir: 'up' | 'dn') => (
    <tr key={x.c}>
      <td><Link to={`/grafik?kode=${x.c}`} className={`tick ${dir}`}>{x.c}</Link></td>
      <td className={`r num ${x.p >= 0 ? 'up' : 'dn'}`}>{fp(x.p)}</td>
      <td className={`r num ${x.ih >= 0 ? 'up' : 'dn'}`}>{x.ih >= 0 ? '+' : ''}{x.ih.toFixed(2)}</td>
    </tr>
  )

  const labelRentang = rentang ? `${fmtTanggalPendek(rentang.mulai)} – ${fmtTanggalPendek(rentang.akhir)}` : null

  return (
    <div className="lantai">
      <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} onRentang={gantiRentang} rentangAktif={rentang} />
      <KonteksData tanggal={tanggalAktif} sementara={hari?.sementara === true} />
      <CatatanCakupan />

      {rentang && (
        <div className="panel">
          <div className="panel-h">
            <span className="lbl">Agregat Pasar — {labelRentang} ({rentangTanggal.length} hari bursa)</span>
          </div>
          <div className="panel-b">
            {loadingR && <p className="lbl" style={{ textAlign: 'center', padding: '14px 0' }}>Memuat {selesai}/{total} hari…</p>}
            {errorR && (
              <div className="chip dn" style={{ display: 'flex', whiteSpace: 'normal', height: 'auto', lineHeight: 1.5 }}>
                <span><IkonMenu d={IKON_PERINGATAN} size={14} /> {errorR} — pilih rentang lebih pendek untuk agregat pasar.</span>
              </div>
            )}
            {agg && !loadingR && (
              <div className="grid3">
                <div className="vcard">
                  <span className="lbl">IHSG Rentang</span>
                  <span className={`v-num num ${(ihsgPctRentang ?? 0) >= 0 ? 'up' : 'dn'}`}>
                    {ihsgPctRentang === null ? '—' : fp(ihsgPctRentang)}
                  </span>
                  <span className="v-note">close {labelRentang}</span>
                </div>
                <div className="vcard">
                  <span className="lbl">Total Volume</span>
                  <span className="v-num num">{fN(agg.vol / 1e3, 1)} M lembar</span>
                  <span className="v-note">rata-rata {fN(agg.n ? agg.vol / agg.n / 1e3 : 0, 1)} M/hari · {agg.n} hari berdata</span>
                </div>
                <div className="vcard">
                  <span className="lbl">Total Nilai Transaksi</span>
                  <span className="v-num num">Rp {fN(agg.val / 1e3, 1)} T</span>
                  <span className="v-note">rata-rata Rp {fN(agg.n ? agg.val / agg.n / 1e3 : 0, 1)} T/hari</span>
                </div>
                <div className="vcard">
                  <span className="lbl">Total Frekuensi</span>
                  <span className="v-num num">{fN(agg.frek / 1e3, 1)} jt</span>
                  <span className="v-note">rata-rata {fN(agg.n ? agg.frek / agg.n / 1e3 : 0, 2)} jt/hari</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {rentang && (
        <div className="chip warn" style={{ display: 'flex', whiteSpace: 'normal', height: 'auto', lineHeight: 1.5 }}>
          <span>
            Daftar Top di bawah adalah <strong>snapshot per-hari</strong> (tidak bisa diagregat lintas hari) —
            menampilkan tanggal akhir rentang, <strong>{hari.date_id}</strong>. Pilih mode Hari untuk menelusuri harian.
          </span>
        </div>
      )}

      <div className="panel">
        <div className="panel-h"><span className="lbl">Top 10 Market Capitalization (Triliun IDR)</span></div>
        <div className="panel-b">
          {mcap.map((m, i) => (
            <div className="mc-row" key={m.c}>
              <span className={'mc-rk' + (i < 3 ? ` rk${i + 1}` : '')}>{i + 1}</span>
              <Link to={`/grafik?kode=${m.c}`} className="tick">{m.c}</Link>
              <div className="bar-tr"><div className="bar-fl" style={{ width: `${(m.v / mx * 100).toFixed(0)}%` }} /></div>
              <span className="mc-v num">{m.v}T</span>
              {/* Badge, bukan angka telanjang (#107): kolom ini bersebelahan
                  dengan nilai kapitalisasi yang juga angka, dan dua angka
                  berdampingan tanpa pembeda bentuk terbaca sebagai satu deret.
                  Warnanya juga menjawab "naik atau turun?" tanpa harus membaca
                  tanda minusnya. */}
              <span className={`ytd-bdg mc-p ${m.p >= 0 ? 'u' : 'd'}`}>{fp(m.p)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Gainers</span><span className="muted" style={{ fontSize: 11 }}>{labelTanggal}</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl" style={tbl4}>
              {kol4}
              <thead><tr>
                {thSort(gainersS, 'c', 'Kode')}
                {thSort(gainersS, 'pr', 'Prev', true)}
                {thSort(gainersS, 'td', 'Today', true)}
                {thSort(gainersS, 'p', '% Change', true)}
              </tr></thead>
              <tbody>
                {gainersS.urut.map((x) => (
                  <tr key={x.c}>
                    <td><Link to={`/grafik?kode=${x.c}`} className="tick up">{x.c}</Link></td>
                    <td className="r num muted">{fN(x.pr, 0)}</td>
                    <td className="r num green">{fN(x.td, 0)}</td>
                    <td className="r"><span className={`ytd-bdg ${x.p >= 0 ? 'u' : 'd'}`}>{fp(x.p)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Losers</span><span className="muted" style={{ fontSize: 11 }}>{labelTanggal}</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl" style={tbl4}>
              {kol4}
              <thead><tr>
                {thSort(losersS, 'c', 'Kode')}
                {thSort(losersS, 'pr', 'Prev', true)}
                {thSort(losersS, 'td', 'Today', true)}
                {thSort(losersS, 'p', '% Change', true)}
              </tr></thead>
              <tbody>
                {losersS.urut.map((x) => (
                  <tr key={x.c}>
                    <td><Link to={`/grafik?kode=${x.c}`} className="tick dn">{x.c}</Link></td>
                    <td className="r num muted">{fN(x.pr, 0)}</td>
                    <td className="r num red">{fN(x.td, 0)}</td>
                    <td className="r"><span className={`ytd-bdg ${x.p >= 0 ? 'u' : 'd'}`}>{fp(x.p)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Leaders — Kontribusi IHSG</span><span className="muted" style={{ fontSize: 11 }}>{labelTanggal}</span></div>
          <div className="panel-b">
            <div className="board-tbl-wrap">
              <table className="tbl" style={tbl3}>
                {kol3}
                <thead><tr>
                  {thSort(leadersTodayS, 'c', 'Kode')}
                  {thSort(leadersTodayS, 'p', '%Saham', true)}
                  {thSort(leadersTodayS, 'ih', '+IHSG', true)}
                </tr></thead>
                <tbody>{leadersTodayS.urut.map((x) => contribRow(x, 'up'))}</tbody>
              </table>
            </div>
            <hr className="divider" />
            <div className="lbl" style={{ margin: '10px 0 8px' }}>Top Leaders YTD</div>
            <div className="board-tbl-wrap">
              <table className="tbl" style={tbl3}>
                {kol3}
                <thead><tr>
                  {thSort(leadersYtdS, 'c', 'Kode')}
                  {thSort(leadersYtdS, 'p', '%YTD', true)}
                  {thSort(leadersYtdS, 'ih', '+IHSG', true)}
                </tr></thead>
                <tbody>{leadersYtdS.urut.map((x) => contribRow(x, 'up'))}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Laggards — Kontribusi IHSG</span><span className="muted" style={{ fontSize: 11 }}>{labelTanggal}</span></div>
          <div className="panel-b">
            <div className="board-tbl-wrap">
              <table className="tbl" style={tbl3}>
                {kol3}
                <thead><tr>
                  {thSort(laggardsTodayS, 'c', 'Kode')}
                  {thSort(laggardsTodayS, 'p', '%Saham', true)}
                  {thSort(laggardsTodayS, 'ih', 'IHSG', true)}
                </tr></thead>
                <tbody>{laggardsTodayS.urut.map((x) => contribRow(x, 'dn'))}</tbody>
              </table>
            </div>
            <hr className="divider" />
            <div className="lbl" style={{ margin: '10px 0 8px' }}>Top Laggards YTD</div>
            <div className="board-tbl-wrap">
              <table className="tbl" style={tbl3}>
                {kol3}
                <thead><tr>
                  {thSort(laggardsYtdS, 'c', 'Kode')}
                  {thSort(laggardsYtdS, 'p', '%YTD', true)}
                  {thSort(laggardsYtdS, 'ih', 'IHSG', true)}
                </tr></thead>
                <tbody>{laggardsYtdS.urut.map((x) => contribRow(x, 'dn'))}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
