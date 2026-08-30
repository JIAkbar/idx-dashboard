import { Fragment, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { tipeEdisi, useBulletinList, LABEL_TIPE_EDISI, type TipeEdisi } from '../../lib/dasbor/bulletin'
import { useAksesHalaman } from '../../context/AksesHalamanContext'
import { TombolIkon } from '../../components/dasbor/TombolIkon'
import { IkonMenu, IKON_KUNCI, IKON_SILANG, IKON_MATA } from '../../components/dasbor/IkonMenu'

/** Panah unduh ke tray — lokal view ini, belum ada padanannya di IkonMenu.tsx. */
const IKON_UNDUH = 'M12 4v10M7.5 10.5L12 15l4.5-4.5M5 19h14'
/** Mata (pratinjau PDF, #98) — lokal view ini, sama alasan IKON_UNDUH. */

/** Chrome Android dkk umumnya TIDAK bisa render PDF di iframe (malah memicu
 *  unduhan) — di mobile tombol Lihat membuka tab baru, bukan modal kosong.
 *  Deteksi sederhana saat klik: UA mobile ATAU layar sempit. */
const mobilekah = () =>
  /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) || window.innerWidth <= 768

/**
 * IHSG per tanggal ISO dari data-idx/json/index.json (#78) — index-nya saja
 * sudah memuat close (`ihsg`) + perubahan % (`ihsg_pct`) per hari bursa, jadi
 * tidak perlu fetch berkas per-tanggal. Helper lokal view: dataHarian.ts tidak
 * diubah, cache modul sendiri (pola sama useBulletinList).
 */
interface IhsgHari {
  ihsg: number
  pct: number
}
let cacheIhsg: Map<string, IhsgHari> | null = null

function useIhsgMap() {
  const [peta, setPeta] = useState<Map<string, IhsgHari> | null>(cacheIhsg)

  useEffect(() => {
    if (cacheIhsg) return
    let batal = false
    fetch('/data-idx/json/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ dates?: { date_iso: string; ihsg: number; ihsg_pct: number }[] }>
      })
      .then((j) => {
        if (batal) return
        cacheIhsg = new Map((j.dates ?? []).map((d) => [d.date_iso, { ihsg: d.ihsg, pct: d.ihsg_pct }]))
        setPeta(cacheIhsg)
      })
      // IHSG pelengkap — gagal fetch berarti kolomnya "—", daftar edisi tetap tampil.
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [])

  return peta
}

const fmtIhsg = (v: number) =>
  v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`

// tipeEdisi() pindah ke lib/dasbor/bulletin.ts — Rak Terbitan di admin
// menyaring dengan aturan yang sama persis.

/**
 * Pengganti tabel Probabilitas/VolVal utk pengunjung terkunci (kunci
 * 'probvv', Fase 6) — baris & angka di bawah ini SENGAJA hardcode/tiruan,
 * BUKAN `e.analisa` (data sungguhan). Diburamkan + kartu ajakan jenjang di
 * tengahnya, sama prinsip PenjagaHalaman.tsx: kalau kunci ini "dioptimalkan"
 * nanti supaya kerangkanya pakai data asli, itu MEMBOCORKAN data yang
 * seharusnya terkunci — jangan.
 */
function TabelProbabilitasTerkunci({ alasan }: { alasan: { judul: string; kalimat: string } }) {
  return (
    <div className="pgh-mini">
      <div className="pgh-blur" aria-hidden="true">
        <table className="tbl" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th>Ticker</th><th>Bias</th><th className="r">Close</th><th className="r">±%</th>
              <th className="r">Skor</th><th className="r">Prob 5h</th><th className="r">P ≥3%</th>
              <th className="r">n</th><th>VolVal</th>
            </tr>
          </thead>
          <tbody>
            {['AAAA', 'BBBB', 'CCCC'].map((t) => (
              <tr key={t}>
                <td><span className="tick">{t}</span></td>
                <td style={{ fontSize: 11 }}>bullish</td>
                <td className="r num">1.234</td>
                <td className="r num up">+1,2%</td>
                <td className="r num" style={{ fontWeight: 700 }}>72</td>
                <td className="r num">64%</td>
                <td className="r num">38%</td>
                <td className="r num">42</td>
                <td className="num">z+1,4</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pgh-cta">
        <IkonMenu d={IKON_KUNCI} size={18} />
        <p className="pgh-judul">{alasan.judul}</p>
        <p className="pgh-kalimat">{alasan.kalimat}</p>
      </div>
    </div>
  )
}

/**
 * Bulletin Arus Pasar — daftar publik edisi analisa teknikal & arus dana
 * broker terbit (#37a). Sumber data: arus-pasar/keluaran/index.json, dibuat
 * arus-pasar/generate_index.py dari edisi/*.json yang sudah punya PDF
 * dirender di keluaran/. Diserve dev server lewat middleware vite.config.ts
 * (mount /arus-pasar/keluaran, sama pola dengan /data).
 *
 * #92: pencarian per emiten di header panel (chip emiten di baris juga bisa
 * diklik untuk mengisi filter), kolom Tipe (Harian/Mingguan/Bulanan dari kode
 * edisi), dan IHSG + Δ% digabung satu kolom (badge pola .ytd-bdg).
 */
export function Bulletin() {
  const { daftar, error } = useBulletinList()
  const peta = useIhsgMap()
  const [cari, setCari] = useState('')
  const [tipe, setTipe] = useState<'Semua' | 'Harian' | 'Mingguan' | 'Bulanan' | 'Bedah'>('Semua')
  // #98: viewer PDF inline — modal iframe di desktop; null = tertutup.
  const [lihat, setLihat] = useState<{ kode: string; pdf: string } | null>(null)
  // Kolom Probabilitas (permintaan user 14 Agu): kode edisi yang baris
  // detailnya (tabel analitik per emiten dari sidecar) sedang terbuka.
  const [detail, setDetail] = useState<string | null>(null)
  // Fase 6 — kolom Probabilitas & VolVal terkunci per jenjang (kunci 'probvv').
  // `daftar === null` (jawaban belum datang) SENGAJA diperlakukan sbg "belum
  // boleh" (bukan fail-open) — `e.analisa` (data asli) sudah nemplok di
  // memori (ikut payload index.json yg publik), beda dari PenjagaHalaman yg
  // bisa menahan mount children; di sini yang bisa dijaga cuma RENDER-nya,
  // jadi harus aman-default (terkunci) sampai kepastian datang.
  const { daftar: daftarAkses, boleh, alasan } = useAksesHalaman()
  const probvvBoleh = daftarAkses !== null && boleh('probvv')

  useEffect(() => {
    if (!lihat) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setLihat(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lihat])

  function bukaPdf(kode: string, pdf: string) {
    if (mobilekah()) window.open(`/arus-pasar/keluaran/${pdf}`, '_blank', 'noopener')
    else setLihat({ kode, pdf })
  }

  // Filter: kode emiten yang dibahas ATAU kode edisi (case-insensitive).
  const q = cari.trim().toUpperCase()
  // Nomor dihitung dari daftar penuh (index.json urut tanggal turun,
  // generate_index.py) SEBELUM difilter — nomor tiap edisi stabil.
  const baris = (daftar ?? []).map((e, i, arr) => ({ e, no: arr.length - i }))
  const tampil = baris.filter(
    ({ e }) =>
      (tipe === 'Semua' || tipeEdisi(e.kode) === tipe) &&
      (!q ||
        e.emiten.some((t) => t.toUpperCase().includes(q)) ||
        e.kode.toUpperCase().includes(q)),
  )

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Bulletin Arus Pasar</h1>
        <span className="sub">analisa teknikal &amp; arus dana broker, terbit berkala</span>
      </div>

      <div className="panel">
        <div className="panel-h blt-h">
          <span className="lbl">Edisi Terbit</span>
          {daftar && daftar.length > 0 && (
            <span className="tabs blt-tabs" role="tablist" aria-label="Filter tipe edisi">
              {(['Semua', 'Harian', 'Mingguan', 'Bulanan', 'Bedah'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tipe === t}
                  className={`tab${tipe === t ? ' on' : ''}`}
                  onClick={() => setTipe(t)}
                >
                  {t === 'Semua' ? t : LABEL_TIPE_EDISI[t as TipeEdisi]}
                </button>
              ))}
            </span>
          )}
          {daftar && daftar.length > 0 && (
            <span className="af-cari blt-cari">
              {/* Kotak CARI CAMPURAN (bukan picker emiten) — sengaja BUKAN StockAutocomplete: menyaring lebih dari satu ruas sekaligus. Jangan "diperbaiki" jadi picker; riwayat: sweep Papan Pekerjaan #355. */}
              <input
                className="inp"
                type="search"
                value={cari}
                onChange={(ev) => setCari(ev.target.value)}
                placeholder="Cari emiten: BUMI, BBCA…"
                aria-label="Cari emiten atau kode edisi"
              />
              {cari !== '' && (
                <TombolIkon
                  d={IKON_SILANG}
                  ukuranIkon={11}
                  label="Bersihkan pencarian"
                  onClick={() => setCari('')}
                  className="blt-cari-x"
                />
              )}
            </span>
          )}
        </div>
        <div className="panel-b">
          {error && <p className="muted">Gagal memuat daftar edisi: {error}</p>}
          {!error && daftar === null && <p className="muted">Memuat…</p>}
          {daftar && daftar.length === 0 && <p className="muted">Belum ada edisi terbit.</p>}
          {daftar && daftar.length > 0 && tampil.length === 0 && (
            <p className="muted">
              {q
                ? `Tidak ada edisi ${tipe === 'Semua' ? '' : LABEL_TIPE_EDISI[tipe as TipeEdisi].toLowerCase() + ' '}yang membahas “${cari.trim()}”.`
                : `Belum ada edisi ${LABEL_TIPE_EDISI[tipe as TipeEdisi]?.toLowerCase() ?? tipe.toLowerCase()}.`}{' '}
              <button
                type="button"
                className="blt-reset"
                onClick={() => {
                  setCari('')
                  setTipe('Semua')
                }}
              >
                Tampilkan semua
              </button>
            </p>
          )}
          {tampil.length > 0 && (
            <div className="blt-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="r">No</th>
                    <th>Edisi</th>
                    <th>Tipe</th>
                    <th>Tanggal</th>
                    <th className="r">IHSG</th>
                    <th>Emiten Dibahas</th>
                    <th className="r">Unduh</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map(({ e, no }) => {
                    const h = peta?.get(e.tanggal)
                    const buka = detail === e.kode
                    return (
                      <Fragment key={e.kode}>
                      <tr>
                        <td className="r blt-no">{no}</td>
                        <td>
                          <span className="tick">{e.kode}</span>
                          {e.update_dari != null && e.emiten.length > e.update_dari && (
                            <span
                              className="bchip"
                              title={`Edisi dirilis ulang: cakupan diperluas dari ${e.update_dari} menjadi ${e.emiten.length} emiten`}
                              style={{
                                marginLeft: 6, fontFamily: 'var(--mono)', fontWeight: 700,
                                background: 'var(--amber-dim)', color: 'var(--amber)', borderColor: 'var(--amber)' }}
                            >
                              Update {e.update_dari}→{e.emiten.length}
                            </span>
                          )}
                        </td>
                        <td><span className={`bchip blt-tipe tipe-edisi t-${tipeEdisi(e.kode).toLowerCase()}`}>{LABEL_TIPE_EDISI[tipeEdisi(e.kode)]}</span></td>
                        <td>{e.tanggal_id}</td>
                        <td className="r num blt-ihsg">
                          {h ? (
                            <>
                              {fmtIhsg(h.ihsg)}{' '}
                              <span className={`ytd-bdg ${h.pct >= 0 ? 'u' : 'd'}`}>
                                {fmtPct(h.pct)}
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {e.emiten.slice(0, 5).map((t) => (
                            <button
                              key={t}
                              type="button"
                              className="bchip blt-em"
                              onClick={() => setCari(t)}
                              title={`Cari edisi yang membahas ${t}`}
                            >
                              {t}
                            </button>
                          ))}
                          {/* ponytail: potong flat di 5 chip, tanpa ResizeObserver — "+N" statis cukup */}
                          {e.emiten.length > 5 && (
                            <span className="bchip blt-tipe" title={e.emiten.slice(5).join(', ')}>
                              +{e.emiten.length - 5}
                            </span>
                          )}
                        </td>
                        <td className="r">
                          <span className="blt-aksi">
                            {e.analisa && e.analisa.length > 0 && (
                              <button
                                type="button"
                                className={`blt-dl${buka ? ' on' : ''}`}
                                onClick={() => setDetail(buka ? null : e.kode)}
                                title={
                                  !probvvBoleh
                                    ? alasan('probvv').kalimat
                                    : buka ? 'Tutup tabel probabilitas' : 'Tabel probabilitas per emiten'
                                }
                              >
                                {!probvvBoleh && <IkonMenu d={IKON_KUNCI} size={11} />}
                                {buka ? 'Tutup' : 'Prob'}
                              </button>
                            )}
                            <button
                              type="button"
                              className="blt-dl"
                              onClick={() => bukaPdf(e.kode, e.pdf)}
                              title={`Lihat ${e.pdf}`}
                            >
                              <IkonMenu d={IKON_MATA} size={13} />
                              Lihat
                            </button>
                            <a
                              className="blt-dl"
                              href={`/arus-pasar/keluaran/${e.pdf}`}
                              download
                              title={`Unduh ${e.pdf}`}
                            >
                              <IkonMenu d={IKON_UNDUH} size={13} />
                              PDF
                            </a>
                          </span>
                        </td>
                      </tr>
                      {buka && e.analisa && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0 0 14px', background: 'var(--bg2)' }}>
                            <div style={{ overflowX: 'auto', padding: '10px 14px 4px' }}>
                              <div className="lbl" style={{ marginBottom: 6 }}>
                                Probabilitas Historis — {e.kode} · backtest setup teknikal, sampel (n) selalu tercetak
                              </div>
                              {!probvvBoleh ? (
                                <TabelProbabilitasTerkunci alasan={alasan('probvv')} />
                              ) : (
                              <>
                              <table className="tbl" style={{ minWidth: 640 }}>
                                <thead>
                                  <tr>
                                    <th>Ticker</th>
                                    <th>Bias</th>
                                    <th className="r">Close</th>
                                    <th className="r" title="Perubahan harga pada hari edisi">±%</th>
                                    <th className="r" title="Skor komposit 0–100: Teknikal 35% · Flow 30% · Risk/Reward 20% · Likuiditas 10% · IHSG 5%">Skor</th>
                                    <th className="r" title="Peluang close lebih tinggi dalam 5 hari bursa — dihitung dari seluruh kejadian historis yang setup teknikalnya serupa (posisi vs EMA50, pivot, rasio volume, posisi rentang 20 hari)">Prob 5h ⓘ</th>
                                    <th className="r" title="Peluang harga SEMPAT naik ≥3% dalam 5 hari bursa pada setup serupa">P ≥3% ⓘ</th>
                                    <th className="r" title="Jumlah sampel historis di balik angka probabilitas — makin besar makin bisa dipercaya. 'k/4' berarti pencocokan setup diperlonggar karena sampel persis terlalu sedikit">n ⓘ</th>
                                    <th title="z-score nilai transaksi (harga×volume) vs 60 hari. Badge menyala kalau nilai melonjak (z≥2,0) tapi harga nyaris datar (|Δharga|≤1%)">VolVal ⓘ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {e.analisa.map((a) => (
                                    <tr key={a.ticker}>
                                      <td><Link className="tick" to={`/grafik?kode=${a.ticker}`}>{a.ticker}</Link></td>
                                      <td style={{ fontSize: 11, color: 'var(--text2)' }}>{a.label}</td>
                                      <td className="r num">{a.close.toLocaleString('id-ID')}</td>
                                      <td className={`r num ${a.pct >= 0 ? 'up' : 'dn'}`}>{fmtPct(a.pct)}</td>
                                      <td className="r num" style={{ fontWeight: 700 }}>{a.skor}</td>
                                      <td className="r num">
                                        {a.p5 == null ? '—' : `${Math.round(a.p5 * 100)}%`}
                                        {a.pR1 != null && (
                                          <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text3)' }}>
                                            R1 {Math.round(a.pR1 * 100)}%
                                          </div>
                                        )}
                                      </td>
                                      <td className="r num">{a.p3 == null ? '—' : `${Math.round(a.p3 * 100)}%`}</td>
                                      <td className="r num" style={{ color: 'var(--text3)', fontSize: 11 }}>
                                        {a.n == null ? '—' : a.n}
                                        {a.cocok != null && a.cocok < (a.total_fitur ?? 4) &&
                                          ` · ${a.cocok}/${a.total_fitur ?? 4}`}
                                      </td>
                                      <td style={{ fontSize: 11 }}>
                                        {a.vv_z == null ? '—' : (
                                          <>
                                            <span className="num">z{a.vv_z >= 0 ? '+' : ''}{a.vv_z.toFixed(1)}</span>
                                            {a.vv_sinyal && (
                                              <span
                                                className="bchip"
                                                title="Nilai transaksi melonjak (z≥2,0) tapi harga nyaris datar (|Δharga|≤1%)"
                                                style={{ marginLeft: 6, background: 'var(--amber-dim)', color: 'var(--amber)', borderColor: 'var(--amber)', fontWeight: 700 }}
                                              >
                                                nilai tinggi, datar
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div
                                style={{
                                  margin: '10px 2px 0', padding: '8px 12px', fontSize: 10.5, lineHeight: 1.6,
                                  color: 'var(--text2)', background: 'var(--bg3)',
                                  borderLeft: '3px solid var(--amber)', borderRadius: 4 }}
                              >
                                <b style={{ color: 'var(--text)', letterSpacing: '.06em' }}>CARA BACA</b> — angka
                                probabilitas BUKAN ramalan hari ini: mesin mencari seluruh kejadian di riwayat harga
                                yang <i>setup teknikalnya serupa</i> (posisi vs EMA50 &amp; pivot, rasio volume, posisi
                                di rentang 20 hari), lalu menghitung berapa persen yang lanjut naik. <b>Prob 5h</b> =
                                close lebih tinggi dalam 5 hari; <b>P ≥3%</b> = sempat naik ≥3%; <b>n</b> = jumlah
                                sampel di baliknya (angka tanpa n besar = lemah); <b>VolVal</b> = lonjakan nilai
                                transaksi — badge "nilai tinggi, datar" menandai value besar (z≥2,0) saat harga nyaris
                                tak bergerak (|Δharga|≤1%).
                                Arahkan kursor / tahan di judul kolom ⓘ untuk detail. Probabilistik, bukan kepastian —
                                bukan ajakan transaksi.
                              </div>
                              </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* #98: modal viewer PDF — backdrop numpang .dasbor-modal-bg (Escape via
          effect di atas, klik luar lewat cek target). Hanya jalur desktop;
          mobile sudah dibelokkan ke tab baru di bukaPdf().
          Portal ke .dasbor-shell (bukan body): .dasbor-main ber-view-transition-name
          = stacking context sendiri, z-index 90 di dalamnya kalah dari rail/topbar
          (z 25/20 di context shell) — modal terpotong kalau tidak diangkat.
          Tetap di dalam shell supaya [data-theme] berlaku; kelas "lantai" di
          backdrop menyediakan token & scope selector .lantai .blt-*. */}
      {lihat && createPortal(
        <div
          className="dasbor-modal-bg lantai"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setLihat(null)
          }}
        >
          <div className="blt-modal" role="dialog" aria-modal="true" aria-label={`Pratinjau ${lihat.kode}`}>
            <div className="blt-modal-h">
              <span className="tick">{lihat.kode}</span>
              <a className="blt-dl" href={`/arus-pasar/keluaran/${lihat.pdf}`} download title={`Unduh ${lihat.pdf}`}>
                <IkonMenu d={IKON_UNDUH} size={13} />
                Unduh
              </a>
              <TombolIkon d={IKON_SILANG} label="Tutup pratinjau" onClick={() => setLihat(null)} />
            </div>
            <iframe className="blt-frame" src={`/arus-pasar/keluaran/${lihat.pdf}`} title={`PDF ${lihat.kode}`} />
          </div>
        </div>,
        document.querySelector('.dasbor-shell') ?? document.body,
      )}
    </div>
  )
}
