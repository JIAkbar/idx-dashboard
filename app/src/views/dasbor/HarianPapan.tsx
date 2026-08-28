import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IkonMenu, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { DropdownMulti, type OpsiMulti } from '../../components/dasbor/DropdownMulti'
import { KolomForm } from '../../components/dasbor/BadgeRapor'
import { bandingkanBaris } from '../../lib/dasbor/useUrut'
import { akumulasiRentang, catatanRentang } from '../../lib/dasbor/harianPapanRentang'
import { useLayarSempit } from '../../lib/dasbor/useLayarSempit'
import { useProfilSaya } from '../../lib/profilSaya'
import { bolehLihatRapor, hitungForm } from '../../lib/dasbor/raporBadge'
import { fp } from '../../lib/dasbor/format'
import { fRingkas } from '../../lib/dasbor/stockDetailFormat'
import { keFraksi } from '../../lib/fraksiHarga'
import {
  barisUntukTab, keCsvHarianPapan, sektorUnikHarianPapan,
  useHarianPapan, useHarianPapanRentang, useTanggalHarianPapan,
  type BarisHarianPapan, type TabHarianPapan,
} from '../../lib/dasbor/harianPapan'
import './HarianPapan.css'

const TAB_LABEL: Record<TabHarianPapan, string> = {
  gainer: 'Stock Gainer',
  'net-buy': 'Net Buy Foreign',
  'net-sell': 'Net Sell Foreign',
}

/** Kunci & arah urut BAWAAN tiap tab (spek §Halaman) — direset tiap tab
 *  berganti, BUKAN dipertahankan dari tab sebelumnya (Value besar di gainer
 *  tak berarti apa-apa sebagai urutan bawaan Net Sell). */
const URUT_BAWAAN: Record<TabHarianPapan, { kunci: keyof BarisHarianPapan; arah: 'naik' | 'turun' }> = {
  gainer: { kunci: 'nilai', arah: 'turun' },
  'net-buy': { kunci: 'nbsf_000', arah: 'turun' },
  'net-sell': { kunci: 'nbsf_000', arah: 'naik' },
}

type UrutState = { kunci: keyof BarisHarianPapan; arah: 'naik' | 'turun'; klik: (k: keyof BarisHarianPapan) => void }

function thSort(s: UrutState, k: keyof BarisHarianPapan, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

function panah(posisi: 'atas' | 'bawah' | null) {
  if (posisi == null) return <span className="muted">—</span>
  return <span className={posisi === 'atas' ? 'up' : 'dn'}>{posisi === 'atas' ? '▲' : '▼'}</span>
}

function labelSkor(v: BarisHarianPapan['skor_d']) {
  if (v == null) return <span className="muted">—</span>
  const kuat = v === 'Strong Buy' || v === 'Strong Sell'
  const cls = v.includes('Buy') ? 'up' : v.includes('Sell') ? 'dn' : undefined
  return kuat ? <b className={cls}>{v}</b> : <span className={cls}>{v}</span>
}

function unduhCsv(baris: BarisHarianPapan[], tanggal: string, tab: TabHarianPapan) {
  const csv = keCsvHarianPapan(baris)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `harian-papan_${tab}_${tanggal}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Harian Papan (`/harian-papan`, docs/spek-dev-papan/spek_harian_papan.md) —
 * tiga tab peringkat harian satu bursa satu tanggal: Stock Gainer, Net Buy
 * Foreign, Net Sell Foreign. Angkanya dari `lib/dasbor/harianPapan.ts`
 * (cross-section pracetak `data-idx/json/harian_papan/<tanggal>.json`, bukan
 * dihitung ulang di sini) — halaman ini murni saring/urut/format tampilan,
 * pola sama Screener.tsx.
 */
export function HarianPapan() {
  const tanggalData = useTanggalHarianPapan()
  const sempit = useLayarSempit()
  const { profil } = useProfilSaya()
  const bolehForm = bolehLihatRapor(profil?.tier)

  const [tanggal, setTanggal] = useState<string | null>(null)
  useEffect(() => {
    // Bawaan: hari bursa terakhir yang datanya lengkap = elemen [0]
    // (tanggal_tersedia terurut baru→lama, lihat harianPapan.ts).
    if (tanggal === null && tanggalData?.tanggal_tersedia.length) setTanggal(tanggalData.tanggal_tersedia[0])
  }, [tanggal, tanggalData])

  // Mode rentang (Johan 29 Agu). null = mode satu tanggal, yang tetap bawaan:
  // Harian Papan pada dasarnya papan HARIAN, dan rentang itu pertanyaan lain
  // ("siapa mengumpulkan selama seminggu"), bukan pengganti.
  const [rentang, setRentang] = useState<{ dari: string; sampai: string } | null>(null)
  const { data, muat } = useHarianPapan(tanggal)
  const { perTanggal, muat: muatRentang } = useHarianPapanRentang(rentang?.dari ?? null, rentang?.sampai ?? null)
  const akum = useMemo(() => akumulasiRentang(perTanggal), [perTanggal])
  const [tab, setTab] = useState<TabHarianPapan>('gainer')
  const [sektorAktif, setSektorAktif] = useState<string[]>([])
  const tanggalTersedia = useMemo(
    () => (tanggalData ? new Set(tanggalData.tanggal_tersedia) : undefined),
    [tanggalData],
  )
  const [cari, setCari] = useState('')
  const { index: indeksEmiten } = useStockIndex()
  const [urutKunci, setUrutKunci] = useState<keyof BarisHarianPapan>(URUT_BAWAAN.gainer.kunci)
  const [urutArah, setUrutArah] = useState<'naik' | 'turun'>(URUT_BAWAAN.gainer.arah)

  // Ganti tab = urut bawaan tab itu, bukan urutan tab sebelumnya yang
  // dipertahankan (spek: tiap tab punya urutan bawaan sendiri).
  useEffect(() => {
    setUrutKunci(URUT_BAWAAN[tab].kunci)
    setUrutArah(URUT_BAWAAN[tab].arah)
  }, [tab])

  function klikUrut(k: keyof BarisHarianPapan) {
    if (k === urutKunci) setUrutArah((a) => (a === 'naik' ? 'turun' : 'naik'))
    else { setUrutKunci(k); setUrutArah('turun') }
  }

  const emiten = data?.emiten ?? []
  const daftarSektor = useMemo(() => sektorUnikHarianPapan(emiten), [emiten])
  const sektorOpsi = useMemo<OpsiMulti[]>(
    () => daftarSektor.map((s) => ({ nilai: s, label: s === '-' ? 'Tanpa sektor' : s })),
    [daftarSektor],
  )
  const barisTab = useMemo(() => barisUntukTab(emiten, tab), [emiten, tab])
  const barisSektor = useMemo(
    () => (sektorAktif.length ? barisTab.filter((b) => sektorAktif.includes(b.sektor)) : barisTab),
    [barisTab, sektorAktif],
  )
  // Pencarian dicocokkan ke KODE dan NAMA: orang mengetik "BBCA" maupun
  // "bank central". Disaring SESUDAH sektor supaya kedua saringan menumpuk,
  // bukan saling membatalkan.
  const barisCari = useMemo(() => {
    const q = cari.trim().toLowerCase()
    if (!q) return barisSektor
    return barisSektor.filter(
      (b) => b.kode.toLowerCase().includes(q) || (b.nama ?? '').toLowerCase().includes(q),
    )
  }, [barisSektor, cari])
  const urut = useMemo(
    () => [...barisCari].sort((a, b) => bandingkanBaris(a, b, urutKunci, urutArah)),
    [barisCari, urutKunci, urutArah],
  )
  // 50 baris sekali muat (Johan 29 Agu: "data tampilkan 50 saja sisanya
  // lazyload di klik"). Ponsel tetap lebih sedikit — 50 baris di layar sempit
  // sudah beberapa layar gulir sebelum tombolnya terlihat.
  const ukuranHalaman = sempit ? 25 : 50
  const [tampil, setTampil] = useState(ukuranHalaman)
  useEffect(() => setTampil(ukuranHalaman), [tab, sektorAktif, tanggal, cari, ukuranHalaman])

  if (!tanggalData) {
    return (
      <div className="lantai">
        <div className="vhead"><h1>Harian Papan</h1></div>
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Memuat data Harian Papan…</p>
        </div>
      </div>
    )
  }

  const urutState: UrutState = { kunci: urutKunci, arah: urutArah, klik: klikUrut }
  const tampilBaris = urut.slice(0, tampil)
  const sisa = urut.length - tampilBaris.length

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Harian Papan</h1>
        <span className="sub">Peringkat harian satu bursa — Stock Gainer, Net Buy/Sell Foreign.</span>
        <CatatanCakupan inline />
      </div>

      <div className="panel">
        <div className="panel-b">
          {/* Bilah kendali berkelompok — sistem tata C+A (lantai.css). Tab ·
              Tanggal · Saring; Unduh CSV + jumlah emiten di grup-kanan. */}
          <div className="bilah-kendali hp-alat">
            {/* Pencarian emiten di paling kiri — sebelum tab, karena "cari
                satu kode" adalah niat yang mendahului "lihat papan mana".
                Label "Tab" dihapus (Johan 29 Agu): ketiga tombolnya sudah
                menyebut dirinya sendiri, labelnya cuma memakan lebar. */}
            <div className="grup-k">
              {/* Pencari emiten KANONIS — `StockAutocomplete`, komponen yang
                  sama dengan Stock Detail, Whales Papan, dan Berkas Emiten.
                  Sempat dibuat sebagai <input> polos di sini; itu salah:
                  hasilnya tak bisa dipilih dari saran, dan halaman ini jadi
                  satu-satunya yang punya cara mencari emiten sendiri.
                  Mengetik menyaring tabel; memilih saran menyaring ke satu
                  kode itu saja. */}
              <div className="hp-cari">
                <StockAutocomplete
                  stocks={indeksEmiten?.stocks ?? []}
                  value={cari}
                  onChange={setCari}
                  onSelect={(kode) => setCari(kode)}
                  placeholder="Cari emiten…"
                />
              </div>
              <div className="tabs" role="tablist">
                {(Object.keys(TAB_LABEL) as TabHarianPapan[]).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t}
                    className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
                    {TAB_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k">
              <span className="grup-lbl">Tanggal</span>
              <DatePicker
                value={tanggal ?? ''}
                onChange={(iso) => { setRentang(null); setTanggal(iso) }}
                tersedia={tanggalTersedia}
                ariaLabel="Tanggal"
                rentang={rentang}
                onGantiRentang={(dari, sampai) => setRentang({ dari, sampai })}
              />
              {rentang && (
                <button type="button" className="chip-t" onClick={() => setRentang(null)}>
                  Kembali ke satu hari
                </button>
              )}
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k">
              <span className="grup-lbl">Saring</span>
              <DropdownMulti
                label="Sektor"
                ariaLabel="Saring sektor"
                opsi={sektorOpsi}
                nilai={sektorAktif}
                onGanti={setSektorAktif}
                ringkasKosong="Semua sektor"
              />
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k grup-kanan">
              <span className="grup-lbl">Aksi</span>
              <button type="button" className="btn-p" disabled={urut.length === 0}
                onClick={() => tanggal && unduhCsv(urut, tanggal, tab)}>
                Unduh CSV
              </button>
              <span className="muted hp-jumlah">{urut.length} emiten</span>
            </div>
          </div>
        </div>

        {/* MODE RENTANG — tabel BERBEDA, bukan tabel harian dengan angka
            dijumlahkan diam-diam. Hanya tiga kolom yang memang aditif yang
            ditampilkan; alasannya dicetak di bawah tabel, bukan disembunyikan.
            Lihat `harianPapanRentang.ts` untuk daftar kolom yang TAK boleh
            dijumlahkan dan kenapa. */}
        {rentang ? (
          muatRentang ? (
            <p className="muted" style={{ padding: '10px 14px' }}>Memuat {akum.tanggalDipakai.length || ''} hari…</p>
          ) : (
            <>
              <div className="board-tbl-wrap">
                <table className="tbl hp-tbl">
                  <thead>
                    <tr>
                      <th>Kode</th><th>Sektor</th>
                      <th style={{ textAlign: 'right' }}>Volume total</th>
                      <th style={{ textAlign: 'right' }}>Nilai total</th>
                      <th style={{ textAlign: 'right' }}>Net asing (000)</th>
                      <th style={{ textAlign: 'right' }}>Hari</th>
                      <th style={{ textAlign: 'right' }}>Harga akhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...akum.baris]
                      .filter((b) => {
                        const q = cari.trim().toLowerCase()
                        if (q && !b.kode.toLowerCase().includes(q) && !(b.nama ?? '').toLowerCase().includes(q)) return false
                        return sektorAktif.length === 0 || sektorAktif.includes(b.sektor)
                      })
                      .sort((a, b) => b.nilai - a.nilai)
                      .slice(0, tampil)
                      .map((b) => (
                        <tr key={b.kode}>
                          <td className="hp-kode">{b.kode}</td>
                          <td>{b.sektor}</td>
                          <td className="num">{b.volume.toLocaleString('id-ID')}</td>
                          <td className="num">{b.nilai.toLocaleString('id-ID')}</td>
                          <td className={`num ${b.nbsf_000 >= 0 ? 'up' : 'dn'}`}>
                            {b.nbsf_000 >= 0 ? '+' : ''}{b.nbsf_000.toLocaleString('id-ID')}
                          </td>
                          <td className="num">{b.nHari}</td>
                          <td className="num">{b.harga_akhir?.toLocaleString('id-ID') ?? '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ padding: '10px 14px' }}>{catatanRentang(akum)}</p>
            </>
          )
        ) : muat ? (
          <p className="muted" style={{ padding: '10px 14px' }}>Memuat…</p>
        ) : (
          <>
            <div className="board-tbl-wrap">
              <table className="tbl hp-tbl">
                <thead>
                  <tr>
                    {thSort(urutState, 'kode', 'Kode')}
                    {thSort(urutState, 'sektor', 'Sektor')}
                    {thSort(urutState, 'harga', 'Price', true)}
                    {thSort(urutState, 'tdm_persen', 'TDM%', true)}
                    {thSort(urutState, 'volume', 'Volume', true)}
                    {thSort(urutState, 'rvol10', 'RVol(10)', true)}
                    {thSort(urutState, 'nilai', 'Value', true)}
                    {thSort(urutState, 'nbsf_000', 'NBSF (000)', true)}
                    {thSort(urutState, 'free_float', 'Free Float', true)}
                    {thSort(urutState, 'ma20_arah', 'MA20 Head')}
                    {thSort(urutState, 'close_gap', 'Close Gap', true)}
                    {thSort(urutState, 'chg_1d', '1D', true)}
                    {thSort(urutState, 'chg_wtd', '1WTD', true)}
                    {thSort(urutState, 'chg_mtd', '1MTD', true)}
                    {thSort(urutState, 'posisi_ema5', 'vs EMA5')}
                    {thSort(urutState, 'posisi_ma10', 'vs MA10')}
                    {thSort(urutState, 'posisi_ma20', 'vs MA20')}
                    {thSort(urutState, 'skor_d', 'Skor Papan D')}
                    {thSort(urutState, 'skor_w', 'Skor Papan W')}
                    {thSort(urutState, 'skor_m', 'Skor Papan M')}
                    {thSort(urutState, 'form_skor', 'Form')}
                  </tr>
                </thead>
                <tbody>
                  {tampilBaris.map((b) => (
                    <BarisHp key={b.kode} b={b} bolehForm={bolehForm} />
                  ))}
                </tbody>
              </table>
            </div>
            {tampilBaris.length === 0 && (
              <p className="muted" style={{ padding: '10px 14px' }}>Tak ada emiten cocok saringan ini.</p>
            )}
            {sisa > 0 && (
              <div className="hp-lebih">
                <button type="button" className="btn-p" onClick={() => setTampil((t) => t + ukuranHalaman)}>
                  Tampilkan {Math.min(sisa, ukuranHalaman)} lagi
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="asal">
        Data <b>{data?.tanggal ?? tanggal}</b> · <b>{emiten.length}</b> emiten. <b>TDM%</b> = perubahan harga
        sejak penutupan hari bursa terakhir bulan sebelumnya (harga tersesuaikan aksi korporasi).{' '}
        <b>NBSF</b> = net asing dalam ribu rupiah, tanda apa adanya (positif = net beli). Tab{' '}
        <b>Stock Gainer</b> mengeluarkan emiten yang tak ada transaksi pada tanggal terpilih — harga yang
        tercatat tak berubah bukan berarti sedang menguat. <b>Skor Papan</b> menyajikan keadaan teknikal
        gabungan, <b>bukan saran beli atau jual</b>; metodenya ada di halaman Metodologi.
        {!bolehForm && ' Kolom Form (rekam jejak harian) khusus pengguna jenjang Diamond.'}
      </div>
    </div>
  )
}

function BarisHp({ b, bolehForm }: { b: BarisHarianPapan; bolehForm: boolean }) {
  const hasilForm = useMemo(() => hitungForm(b.bar5), [b.bar5])
  return (
    <tr>
      <td>
        <Link to={`/grafik?kode=${b.kode}`} className="tick">{b.kode}</Link>
        {b.tidak_diperdagangkan && (
          <span className="muted hp-beku" title="Tak ada transaksi pada tanggal ini">⏸</span>
        )}
      </td>
      <td>{b.sektor}</td>
      <td className="r num">{b.harga == null ? '—' : keFraksi(b.harga, 'dekat').toLocaleString('id-ID')}</td>
      <td className={`r num ${b.tdm_persen == null ? '' : b.tdm_persen >= 0 ? 'up' : 'dn'}`}>
        {b.tdm_persen == null ? '—' : fp(b.tdm_persen)}
      </td>
      <td className="r num" title={b.volume == null ? undefined : `${b.volume.toLocaleString('id-ID')} lembar`}>
        {b.volume == null ? '—' : fRingkas(b.volume)}
      </td>
      <td className="r num">{b.rvol10 == null ? '—' : `${b.rvol10.toLocaleString('id-ID', { maximumFractionDigits: 2 })}×`}</td>
      <td className="r num" title={b.nilai == null ? undefined : `Rp${b.nilai.toLocaleString('id-ID')}`}>
        {b.nilai == null ? '—' : `Rp${fRingkas(b.nilai)}`}
      </td>
      <td className={`r num ${b.nbsf_000 == null ? '' : b.nbsf_000 >= 0 ? 'up' : 'dn'}`}
        title={b.nbsf_000 == null ? undefined : `Rp${Math.round(b.nbsf_000 * 1000).toLocaleString('id-ID')}`}>
        {b.nbsf_000 == null ? '—' : `${b.nbsf_000 >= 0 ? '+' : ''}${fRingkas(b.nbsf_000)}`}
      </td>
      <td className="r num">{b.free_float == null ? '—' : `${b.free_float.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`}</td>
      <td className={b.ma20_arah === 'naik' ? 'up' : b.ma20_arah === 'turun' ? 'dn' : undefined}>
        {b.ma20_arah == null ? <span className="muted">—</span> : b.ma20_arah}
      </td>
      <td className={`r num ${b.close_gap == null ? '' : b.close_gap > 0 ? 'up' : b.close_gap < 0 ? 'dn' : ''}`}>
        {b.close_gap == null ? '—' : fp(b.close_gap)}
      </td>
      <td className={`r num ${b.chg_1d == null ? '' : b.chg_1d >= 0 ? 'up' : 'dn'}`}>{b.chg_1d == null ? '—' : fp(b.chg_1d)}</td>
      <td className={`r num ${b.chg_wtd == null ? '' : b.chg_wtd >= 0 ? 'up' : 'dn'}`}>{b.chg_wtd == null ? '—' : fp(b.chg_wtd)}</td>
      <td className={`r num ${b.chg_mtd == null ? '' : b.chg_mtd >= 0 ? 'up' : 'dn'}`}>{b.chg_mtd == null ? '—' : fp(b.chg_mtd)}</td>
      <td className="r">{panah(b.posisi_ema5)}</td>
      <td className="r">{panah(b.posisi_ma10)}</td>
      <td className="r">{panah(b.posisi_ma20)}</td>
      <td>{labelSkor(b.skor_d)}</td>
      <td>{labelSkor(b.skor_w)}</td>
      <td>{labelSkor(b.skor_m)}</td>
      <td>{bolehForm ? <KolomForm hasil={hasilForm} /> : <span className="br-badge br-kunci">🔒 Diamond</span>}</td>
    </tr>
  )
}
