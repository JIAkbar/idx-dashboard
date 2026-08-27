import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChartConfiguration } from 'chart.js/auto'
import { IkonMenu, IKON_CARI, IKON_TONG } from '../../components/dasbor/IkonMenu'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { TombolIkon } from '../../components/dasbor/TombolIkon'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { useKamusEmiten } from '../../lib/dasbor/kamusEmiten'
import { useUrut } from '../../lib/dasbor/useUrut'
import { fp } from '../../lib/dasbor/format'
import { keFraksi } from '../../lib/fraksiHarga'
import {
  muatWatchlist, tambahEmiten, hapusEmiten, simpanHargaMilik,
  fetchDeret, ambilHargaTerakhir, hargaRataRata, untungRugi,
  type WatchlistItem, type HargaTerakhir,
} from '../../lib/dasbor/watchlist'
import type { BarisOhlc } from '../../lib/dasbor/ihsgOhlc'
import { posisiEma, labelKeadaan, HORIZON, PERIODE, type PosisiEma } from '../../lib/dasbor/emaWatchlist'
import {
  ringkasAd, ringkasAsing, LABEL_VONIS, ARTI_VONIS, JENDELA,
  type RingkasAd, type RingkasAsing,
} from '../../lib/dasbor/akumulasi'
import { fetchAsing, type AsingHarian } from '../../lib/dasbor/stockDetailData'
import { useScreener } from '../../lib/dasbor/screener'
import { useChartCanvas, bacaTokenTema } from '../../lib/dasbor/useChartJs'
import { useTheme } from '../../context/ThemeContext'
import { labelTanggal } from '../../lib/dasbor/brokerHarian'
import { opsiRentang, potongRentang, captionRentang, type IdRentang } from '../../lib/dasbor/rentang'
import { TOKEN_SERI } from './neo-papan/bersama'
import { warnaBroker, namaBroker } from '../../lib/dasbor/kelompokBroker'
import {
  tanggalUmumWatchlist, hitungIndeksWatchlist, fetchSahamMap, fetchTopBrokerHarian,
  type AnggotaIndeks, type TopBrokerHarian, type MetrikIndeks,
} from '../../lib/dasbor/watchlistIndeks'
import './Watchlist.css'

type UrutState<T> = { kunci: keyof T; arah: 'naik' | 'turun'; klik: (k: keyof T) => void }

/**
 * Angka Indonesia -> number. Titik pemisah RIBUAN, koma pemisah DESIMAL
 * (Johan 20 Agu 2026: "jadi support titik dan koma").
 *
 * Urutannya penting dan satu arah saja yang benar: titik dibuang DULU, baru
 * koma jadi titik. Kebalikannya mengubah "6.000" jadi 6 — harga milik enam
 * ribu tersimpan sebagai enam rupiah, dan untung-ruginya melonjak 100.000%
 * tanpa satu pun galat.
 */
export function keAngka(teks: string): number | null {
  const bersih = teks.trim().replace(/\./g, '').replace(',', '.')
  if (bersih === '') return null
  const v = Number(bersih)
  return Number.isFinite(v) && v > 0 ? v : null
}

/** number -> teks Indonesia berititik ribuan. Desimal dipertahankan apa adanya
 *  sampai 4 angka; harga saham IDX tak pernah lebih halus dari itu. */
export function keTeksAngka(n: number): string {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 4 })
}

/** Lembar dalam bentuk ringkas — kolom tabel tak muat "1.234.567.890 lembar",
 *  dan angka penuhnya tetap ada di `title`. Ambangnya juta/miliar karena itu
 *  rentang nyata net asing harian di IDX. */
function ringkasLembar(n: number): string {
  const tanda = n > 0 ? '+' : n < 0 ? '−' : ''
  const a = Math.abs(n)
  if (a >= 1e9) return `${tanda}${(a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`
  if (a >= 1e6) return `${tanda}${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (a >= 1e3) return `${tanda}${(a / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
  return `${tanda}${a.toLocaleString('id-ID')}`
}

/** Warna vonis: hijau untuk uang masuk, merah untuk keluar. Yang "diam-diam"
 *  memakai warna ALIRANNYA, bukan warna harganya — arah uang itu justru inti
 *  kolom ini. */
const KELAS_VONIS: Record<string, string> = {
  akumulasi: 'up',
  'akumulasi-diam': 'up',
  distribusi: 'dn',
  'distribusi-diam': 'dn',
  datar: '',
}

/** Judul kolom yang bisa diklik untuk mengurutkan — pola sama TopStocks/TopBroker/KartuAnalisa. */
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

interface BarisTabel {
  kode: string
  nama: string
  harga: number | null
  chgPersen: number | null
  avg: number | null
  untungPersen: number | null
  /** null = deretnya belum termuat. */
  posisi: PosisiEma | null
  /** Peluang naik dalam persen — kolom terurut butuh angka datar, bukan objek. */
  peluang: number | null
  ad: RingkasAd | null
  asing: RingkasAsing | null
  /** Net asing dalam lembar, didatarkan supaya kolomnya bisa diurutkan. */
  asingNet: number | null
  /** Net asing SATU hari terakhir (§E.5 "Asing 1D") — jendela beda dari
   *  `asing`/`asingNet` (JENDELA=20), dihitung dari deret mentah yang sama. */
  asing1D: RingkasAsing | null
  /** `asing1D.netLembar` didatarkan — kolom terurut butuh angka datar. */
  asing1DNet: number | null
  /** RVol10 dari `screener.json` (Volume hari terakhir ÷ rata-rata 10 hari
   *  sebelumnya) — TIDAK dihitung ulang di sini (§E.5). */
  rvol10: number | null
  /** undefined = belum dicoba fetch (tab Tabel belum pernah dibuka atau
   *  masih menunggu jaringan); null = 404 dikonfirmasi (emiten tanpa berkas
   *  broker harian). */
  topBroker: TopBrokerHarian | null | undefined
  /** true = berkas harganya DIKONFIRMASI tak ada (404) — beda dari "belum
   *  termuat". Audit 21 Agu (#16): tanpa pembeda ini, emiten delisting
   *  nangkring selamanya sebagai baris strip tanpa penjelasan. */
  hilang: boolean
}

/**
 * Watchlist dinamis (/watchlist, backlog C8) — bukan daftar kode statis:
 * tiap baris bergerak mengikuti OHLCV harian (`data-idx/json/ohlc/<KODE>.json`,
 * pola fetch sama dengan Grafik Emiten/Tanya PAPAN), dan pengguna bisa mengisi
 * harga miliknya sendiri supaya untung-rugi ikut terhitung.
 *
 * Disimpan di localStorage lewat `lib/dasbor/watchlist.ts` (satu modul
 * muat/tambah/hapus/simpanHargaMilik) — TANPA server, supaya halaman ini
 * tetap bisa dipakai tanpa login. Konsekuensinya disebut jujur di kaki
 * halaman: tak berpindah antar peranti.
 */
export function Watchlist() {
  const kamus = useKamusEmiten()
  const [items, setItems] = useState<WatchlistItem[]>(() => muatWatchlist())
  const [deret, setDeret] = useState<Record<string, {
    harga: HargaTerakhir | null; posisi: PosisiEma; ad: RingkasAd | null
  } | null>>({})
  // Aliran asing datang dari berkas TERPISAH (`asing/<KODE>.json`) dan tak
  // ada untuk semua emiten — 48 dari 963 tak punya berkasnya sama sekali.
  // Karena itu ia state sendiri, bukan digabung ke `deret`: satu emiten tanpa
  // catatan asing tak boleh menahan harga & EMA-nya ikut kosong.
  //
  // Disimpan MENTAH (deret harian), bukan pra-diringkas: kolom lama butuh
  // jendela JENDELA (20) hari, kolom baru "Asing 1D" (§E.5) butuh jendela
  // 1 hari — dua ringkasan dari satu unduhan, bukan dua fetch.
  const [asing, setAsing] = useState<Record<string, AsingHarian[] | null>>({})
  const [cari, setCari] = useState('')
  const [abaTab, setAbaTab] = useState<'tabel' | 'kinerja'>('tabel')

  // RVol10 (§E.5) — SATU berkas bersama (`screener.json`), bukan per anggota;
  // `useScreener()` sudah cache modul 30 menit dan dipakai halaman Screener,
  // jadi dibuka di sini tidak menambah unduhan kalau Screener sudah dikunjungi
  // sesi ini.
  const screener = useScreener()
  const rvol10ByKode = useMemo(() => {
    const m = new Map<string, number | null>()
    screener?.emiten.forEach((e) => m.set(e.kode, e.rvol10))
    return m
  }, [screener])

  // Top Broker chip (§E.5) — PER ANGGOTA (`broker_harian/<KODE>.json`), jadi
  // cuma diambil selagi tab Tabel (yang menampilkan kolomnya) aktif — spek:
  // "fetch per anggota hanya saat kolom tampil".
  const [topBroker, setTopBroker] = useState<Record<string, TopBrokerHarian | null>>({})
  useEffect(() => {
    if (abaTab !== 'tabel') return
    let batal = false
    for (const it of items) {
      if (topBroker[it.kode] !== undefined) continue
      fetchTopBrokerHarian(it.kode).then((tb) => {
        if (!batal) setTopBroker((x) => ({ ...x, [it.kode]: tb }))
      })
    }
    return () => { batal = true }
  }, [items, topBroker, abaTab])

  // Satu fetch per kode (cache modul di watchlist.ts mencegah unduhan ulang).
  // Harga terakhir DAN posisi EMA lahir dari deret yang sama — satu unduhan,
  // dua jawaban.
  useEffect(() => {
    let batal = false
    for (const it of items) {
      if (deret[it.kode] !== undefined) continue
      fetchDeret(it.kode).then((d) => {
        if (batal) return
        const nilai = d ? { harga: ambilHargaTerakhir(d), posisi: posisiEma(d), ad: ringkasAd(d) } : null
        setDeret((x) => ({ ...x, [it.kode]: nilai }))
      })
    }
    return () => { batal = true }
  }, [items, deret])

  useEffect(() => {
    let batal = false
    for (const it of items) {
      if (asing[it.kode] !== undefined) continue
      fetchAsing(it.kode).then((a) => {
        if (!batal) setAsing((x) => ({ ...x, [it.kode]: a ? a.d : null }))
      })
    }
    return () => { batal = true }
  }, [items, asing])

  const namaKode = useMemo(() => {
    const m = new Map<string, string>()
    kamus?.emiten.forEach((e) => m.set(e.kode, e.nama))
    return m
  }, [kamus])

  const sudahAda = useMemo(() => new Set(items.map((i) => i.kode)), [items])
  const saran = useMemo(() => {
    const q = cari.trim().toUpperCase()
    if (!kamus || q.length < 1) return []
    return kamus.emiten
      .filter((e) => !sudahAda.has(e.kode) && (e.kode.startsWith(q) || e.nama.toUpperCase().includes(q)))
      .slice(0, 8)
  }, [kamus, cari, sudahAda])

  function tambah(kode: string) {
    setItems(tambahEmiten(kode))
    setCari('')
  }
  function hapus(kode: string) {
    setItems(hapusEmiten(kode))
    setDeret((x) => { const n = { ...x }; delete n[kode]; return n })
    setAsing((x) => { const n = { ...x }; delete n[kode]; return n })
    setTopBroker((x) => { const n = { ...x }; delete n[kode]; return n })
  }
  function ubahHargaMilik(kode: string, nilai: number | null) {
    setItems(simpanHargaMilik(kode, nilai))
  }

  const baris: BarisTabel[] = useMemo(() => items.map((it) => {
    const isi = deret[it.kode]
    const h = isi?.harga ?? null
    const avg = hargaRataRata(it.beli)
    // Harga pasar yang ditampilkan WAJIB lewat keFraksi() — harga milik (avg)
    // tidak, itu hasil hitungan, bukan harga yang dipesan di bursa.
    const hargaKini = h ? keFraksi(h.harga, 'dekat') : null
    const ur = avg != null && hargaKini != null ? untungRugi(avg, hargaKini) : null
    const asingD = asing[it.kode]
    const asingRingkas = asingD ? ringkasAsing(asingD) : null
    const asing1DRingkas = asingD ? ringkasAsing(asingD, 1) : null
    return {
      kode: it.kode,
      nama: namaKode.get(it.kode) ?? '',
      harga: hargaKini,
      chgPersen: h?.chgPersen ?? null,
      avg,
      untungPersen: ur?.persen ?? null,
      posisi: isi?.posisi ?? null,
      peluang: isi?.posisi.peluang?.persen ?? null,
      ad: isi?.ad ?? null,
      asing: asingRingkas,
      asingNet: asingRingkas?.netLembar ?? null,
      asing1D: asing1DRingkas,
      asing1DNet: asing1DRingkas?.netLembar ?? null,
      rvol10: rvol10ByKode.get(it.kode) ?? null,
      topBroker: topBroker[it.kode],
      // `undefined` = fetch belum jalan; `null` = 404 dikonfirmasi. Dua
      // keadaan yang selama ini dirender sama persis (strip di semua kolom).
      hilang: deret[it.kode] === null,
    }
  }), [items, deret, asing, namaKode, rvol10ByKode, topBroker])

  const s = useUrut(baris, 'kode', 'naik')

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Watchlist</h1>
        <span className="sub">Daftar pantau yang bergerak mengikuti harga harian — isi harga milik untuk melihat untung-rugi.</span>
      </div>
      <CatatanCakupan />

      <div className="panel">
        <div className="panel-b wl-alat">
          <span className="af-cari wl-cari">
            <IkonMenu d={IKON_CARI} size={13} />
            <input
              className="inp" type="search" placeholder="Tambah emiten…" value={cari}
              onChange={(e) => setCari(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter' && saran[0]) tambah(saran[0].kode) }}
            />
            {saran.length > 0 && (
              <ul className="sea-saran" role="listbox">
                {saran.map((e) => (
                  <li key={e.kode}>
                    <button type="button" className="sea-saran-it" onClick={() => tambah(e.kode)}>
                      <span className="kd">{e.kode}</span>
                      <span className="nm">{e.nama}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </span>
        </div>

        {baris.length === 0 ? (
          <div className="panel-b"><p className="muted">Belum ada emiten di watchlist. Cari kode di atas untuk menambahkan.</p></div>
        ) : (
          <>
            <div className="panel-h">
              <div className="tabs" role="tablist" aria-label="Tampilan Watchlist">
                <button type="button" role="tab" aria-selected={abaTab === 'tabel'}
                  className={'tab' + (abaTab === 'tabel' ? ' on' : '')} onClick={() => setAbaTab('tabel')}>
                  Tabel
                </button>
                <button type="button" role="tab" aria-selected={abaTab === 'kinerja'}
                  className={'tab' + (abaTab === 'kinerja' ? ' on' : '')} onClick={() => setAbaTab('kinerja')}>
                  Kinerja
                </button>
              </div>
            </div>
            {abaTab === 'tabel' ? (
              <div className="board-tbl-wrap">
                <table className="tbl wl-tbl">
                  <thead>
                    <tr>
                      {thSort(s, 'kode', 'Kode')}
                      {thSort(s, 'harga', 'Harga', true)}
                      {thSort(s, 'chgPersen', '%chg', true)}
                      <th className="r">Harga Milik</th>
                      {thSort(s, 'untungPersen', 'Untung/Rugi', true)}
                      <th className="r" title={`Posisi harga terhadap EMA ${PERIODE.join('/')}`}>EMA {PERIODE.join('/')}</th>
                      {thSort(s, 'peluang', `Peluang ${HORIZON}H`, true)}
                      {thSort(s, 'asingNet', `Asing ${JENDELA}H`, true)}
                      {thSort(s, 'asing1DNet', 'Asing 1D', true)}
                      {thSort(s, 'rvol10', 'RVol10', true)}
                      <th className="r">Akum/Dist</th>
                      <th>Top Broker</th>
                      <th aria-label="Aksi" />
                    </tr>
                  </thead>
                  <tbody>
                    {s.urut.map((b) => (
                      <BarisWatchlist
                        key={b.kode} b={b}
                        onHapus={() => hapus(b.kode)}
                        onUbahHarga={(v) => ubahHargaMilik(b.kode, v)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="panel-b">
                <TabKinerja items={items} />
              </div>
            )}
          </>
        )}
      </div>

      {abaTab === 'tabel' && (
        <>
          <p className="wl-catatan muted">
            Kolom <b>EMA {PERIODE.join('/')}</b> menandai posisi harga terhadap tiap rata-rata bergerak eksponensial
            (▲ di atas, ▼ di bawah). <b>Peluang {HORIZON}H</b> bukan ramalan: ia menghitung, dari riwayat emiten itu
            sendiri, berapa persen kejadian dengan posisi EMA yang sama ditutup lebih tinggi {HORIZON} hari bursa
            kemudian — angka masa lalu, dan masa lalu tidak mengikat masa depan. Ditampilkan hanya kalau sampelnya cukup.
          </p>
          <p className="wl-catatan muted">
            <b>Asing {JENDELA}H</b> menjumlahkan beli dikurangi jual investor asing selama {JENDELA} hari bursa terakhir,
            <b> Asing 1D</b> cuma hari bursa TERAKHIR — dua jendela beda, keduanya dalam <b>lembar</b> (IDX tidak
            melaporkan aliran asing dalam rupiah). <b>RVol10</b> = volume hari terakhir dibagi rata-rata volume 10 hari
            bursa sebelumnya (di atas 1× berarti lebih ramai dari biasanya). <b>Top Broker</b> menampilkan hingga 3
            broker net-beli dan 3 net-jual terbesar hari terakhir, warna menandai kelompok identitasnya. <b>Akum/Dist</b>{' '}
            membandingkan arah garis Accumulation/Distribution dengan arah harga di periode yang sama: "diam-diam"
            berarti keduanya berlawanan — harga turun sementara uang masuk, atau sebaliknya. Semuanya menyajikan
            keadaan, bukan saran beli atau jual.
          </p>
        </>
      )}
      <p className="wl-catatan muted">
        Watchlist ini tersimpan di peranti ini saja (browser lokal) — tidak berpindah kalau dibuka dari ponsel atau peramban lain.
      </p>
    </div>
  )
}

/** Satu baris tabel, dipisah supaya kotak "harga milik" punya state edit
 *  sendiri (ketikan mentah sebelum disimpan) tanpa memaksa seluruh tabel
 *  render ulang tiap ketukan tombol. */
function BarisWatchlist({
  b, onHapus, onUbahHarga,
}: {
  b: BarisTabel
  onHapus: () => void
  onUbahHarga: (v: number | null) => void
}) {
  const [edit, setEdit] = useState(b.avg != null ? keTeksAngka(b.avg) : '')
  // Sinkron ulang kalau nilai tersimpan berubah dari luar (mis. dua tab).
  useEffect(() => { setEdit(b.avg != null ? keTeksAngka(b.avg) : '') }, [b.avg])

  function simpan() {
    const v = keAngka(edit)
    onUbahHarga(v)
    // Ditulis ulang dalam bentuk baku begitu selesai disunting: "6000" yang
    // diketik jadi "6.000" di layar, sama bentuknya dengan kolom Harga di
    // sebelahnya. Selagi difokus teksnya dibiarkan apa adanya — memasang titik
    // sambil orang mengetik memindahkan kursornya sendiri.
    setEdit(v != null ? keTeksAngka(v) : '')
  }

  return (
    <tr>
      <td>
        <Link to={`/grafik?kode=${b.kode}`} className="tick">{b.kode}</Link>
        {b.nama && <span className="wl-nama">{b.nama}</span>}
        {b.hilang && (
          <span className="wl-nama" style={{ color: 'var(--red)' }}
            title="Berkas harganya tidak ditemukan — kemungkinan delisting atau berganti nama. Baris ini tak akan terisi lagi; hapus kalau sudah tak dipantau.">
            data tak ditemukan — mungkin delisting
          </span>
        )}
      </td>
      <td className="r num">{b.harga != null ? b.harga.toLocaleString('id-ID') : '—'}</td>
      <td className={`r num ${b.chgPersen == null ? '' : b.chgPersen >= 0 ? 'up' : 'dn'}`}>
        {b.chgPersen == null ? '—' : fp(b.chgPersen)}
      </td>
      <td className="r">
        {/* `type="text"` + inputMode, BUKAN type="number": kotak angka native
            memunculkan tombol naik-turun yang menutupi angkanya sendiri saat
            disorot (dilaporkan Johan 20 Agu 2026), roda mouse diam-diam
            mengubah nilainya saat halaman digulir, dan di beberapa locale
            koma desimal ditolak senyap. Penyaringnya cukup satu regex. */}
        <input
          className="inp wl-avg" type="text" inputMode="decimal"
          placeholder="—" value={edit}
          onChange={(e) => setEdit(e.target.value.replace(/[^\d.,]/g, ''))}
          onBlur={simpan}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
          aria-label={`Harga milik ${b.kode}`}
        />
      </td>
      {/* Kolom Untung/Rugi (Rp) DIBUANG 20 Agu 2026 ("rupiah nya tidak perlu,
          cukup munculkan itu saja harga saat ini dan average harga nya").
          Nilai rupiahnya cuma benar kalau jumlah lot ikut disimpan, dan itu
          tak pernah ditanyakan — yang tersimpan cuma harga milik. Persennya
          tetap, karena persen tak butuh jumlah lot untuk jadi benar.

          Baris tanpa harga milik TIDAK boleh menampilkan untung-rugi 0 — itu
          angka yang berbohong (0 berarti "impas", bukan "tak diketahui"). */}
      <td className={`r num ${b.untungPersen == null ? '' : b.untungPersen >= 0 ? 'up' : 'dn'}`}>
        {b.untungPersen == null ? '—' : fp(b.untungPersen)}
      </td>
      <td className="r">
        <span className="wl-ema" title={labelKeadaan(b.posisi?.sandi ?? null)}>
          {PERIODE.map((p, i) => {
            const d = b.posisi?.sandi?.[i]
            return (
              <span key={p} className={`wl-ema-p ${d === '1' ? 'up' : d === '0' ? 'dn' : ''}`}>
                {d === '1' ? '▲' : d === '0' ? '▼' : '·'}
              </span>
            )
          })}
        </span>
      </td>
      {/* Peluang EMPIRIS, bukan skor: berapa persen dari kejadian historis
          dengan posisi EMA yang sama pada emiten ini yang 20 hari bursa
          kemudian ditutup lebih tinggi. Jumlah sampelnya ikut ditampilkan —
          angka tanpa penyebutnya tak bisa ditolak pembaca. */}
      <td className="r num">
        {b.posisi?.peluang == null ? (
          <span className="muted" title="Sampel historisnya belum cukup untuk dilaporkan">—</span>
        ) : (
          <span title={`${b.posisi.peluang.naik} dari ${b.posisi.peluang.n} kejadian serupa di riwayat ${b.kode} ditutup lebih tinggi ${HORIZON} hari bursa kemudian`}>
            {Math.round(b.posisi.peluang.persen)}%
            <span className="wl-n">n={b.posisi.peluang.n}</span>
          </span>
        )}
      </td>
      {/* Net asing dalam LEMBAR, bukan rupiah. IDX tidak melaporkan aliran
          asing dalam rupiah; mengalikannya dengan harga rata-rata memang
          menghasilkan angka berlabel "Rp" yang enak dibaca, tapi itu taksiran
          kita, bukan angka bursa — dan kolom sesempit ini tak punya ruang
          untuk menjelaskan bedanya. */}
      <td className={`r num ${b.asing == null ? '' : b.asing.netLembar >= 0 ? 'up' : 'dn'}`}>
        {b.asing == null ? (
          <span className="muted" title="Emiten ini tak punya berkas aliran asing">—</span>
        ) : (
          <span title={`${b.asing.netLembar >= 0 ? 'Net beli' : 'Net jual'} asing ${Math.abs(b.asing.netLembar).toLocaleString('id-ID')} lembar selama ${b.asing.hari} hari bursa${
            b.asing.porsiPersen == null ? '' : ` — ${fp(b.asing.porsiPersen)} dari seluruh volume di periode yang sama`}`}>
            {ringkasLembar(b.asing.netLembar)}
          </span>
        )}
      </td>
      {/* Asing 1D — SATU hari bursa terakhir, beda jendela dari kolom
          "Asing 20H" di sebelah kiri (yang menjumlahkan 20 hari). */}
      <td className={`r num ${b.asing1D == null ? '' : b.asing1D.netLembar >= 0 ? 'up' : 'dn'}`}>
        {b.asing1D == null ? (
          <span className="muted" title="Emiten ini tak punya berkas aliran asing">—</span>
        ) : (
          <span title={`${b.asing1D.netLembar >= 0 ? 'Net beli' : 'Net jual'} asing ${Math.abs(b.asing1D.netLembar).toLocaleString('id-ID')} lembar hari bursa terakhir`}>
            {ringkasLembar(b.asing1D.netLembar)}
          </span>
        )}
      </td>
      {/* RVol10 dari screener.json — TIDAK dihitung ulang di sini. */}
      <td className="r num">
        {b.rvol10 == null ? <span className="muted">—</span> : `${b.rvol10.toFixed(2)}×`}
      </td>
      {/* Penyajian keadaan, BUKAN saran beli atau jual — larangan yang sama
          sudah berlaku di Screener dan Kartu Analisa. */}
      <td className="r">
        {b.ad == null ? (
          <span className="muted">—</span>
        ) : (
          <span className={`wl-ad ${KELAS_VONIS[b.ad.vonis]}`} title={ARTI_VONIS[b.ad.vonis]}>
            {LABEL_VONIS[b.ad.vonis]}
          </span>
        )}
      </td>
      <td>
        <TopBrokerChips tb={b.topBroker} />
      </td>
      <td>
        <TombolIkon
          d={IKON_TONG} label="Hapus dari watchlist" ariaLabel={`Hapus ${b.kode} dari watchlist`}
          nada="merah" onClick={onHapus}
        />
      </td>
    </tr>
  )
}

/** 3 chip net-beli + 3 chip net-jual terbesar hari terakhir (§E.5), kode
 *  berwarna kelompok identitas (`kelompokBroker.ts`). `undefined` = belum
 *  dicoba fetch (tab Tabel baru dibuka), `null` = emiten tak punya berkas
 *  broker harian. */
function TopBrokerChips({ tb }: { tb: TopBrokerHarian | null | undefined }) {
  if (tb === undefined) return <span className="muted">…</span>
  if (tb === null || (tb.beli.length === 0 && tb.jual.length === 0)) {
    return <span className="muted" title="Emiten ini tak punya berkas broker harian, atau hari terakhirnya nihil transaksi">—</span>
  }
  return (
    <span className="wl-broker" title={`Broker harian ${tb.tanggal}`}>
      {tb.beli.map((br) => (
        <span key={`b-${br.kode}`} className="chip up" style={{ color: warnaBroker(br.kode) }}
          title={`${namaBroker(br.kode)} — net beli Rp ${br.net.toLocaleString('id-ID')}`}>
          {br.kode}
        </span>
      ))}
      {tb.jual.map((br) => (
        <span key={`j-${br.kode}`} className="chip dn" style={{ color: warnaBroker(br.kode) }}
          title={`${namaBroker(br.kode)} — net jual Rp ${Math.abs(br.net).toLocaleString('id-ID')}`}>
          {br.kode}
        </span>
      ))}
    </span>
  )
}

/** Satu baris metrik kartu (pola sama `broker-summary-v2/VsIhsg.tsx` —
 *  disalin, bukan diimpor: di sana ia fungsi privat berkas itu, sama pola
 *  `ringkasLembarBertanda` di screener.ts. */
function Metrik({ k, ket, v, warna }: { k: string; ket?: string; v: string; warna?: string }) {
  return (
    <div>
      <span className="k">{k}{ket && <small>{ket}</small>}</span>
      <span className="v" style={warna ? { color: warna } : undefined}>{v}</span>
    </div>
  )
}

const PILIHAN_RENTANG_KINERJA: IdRentang[] = ['w1', 'b1', 'b3', 'b6', 'ytd', 'y1', 'y3', 'y5', 'semua']

/**
 * Tab "Kinerja" (§E.2-E.4) — anggota watchlist digabung jadi satu indeks
 * harian, dua bobot. Fetch bars per anggota lewat `fetchDeret` (cache modul
 * SAMA dengan tab Tabel — kalau tab Tabel sudah dibuka duluan, harga anggota
 * tak diunduh dua kali), plus IHSG (`ohlc/IHSG.json`, baru di sini) dan
 * lembar saham (`fetchSahamMap`, sekali per sesi).
 */
function TabKinerja({ items }: { items: WatchlistItem[] }) {
  const { theme } = useTheme()
  const [bobot, setBobot] = useState<'setara' | 'kap'>('setara')
  const [rentang, setRentang] = useState<IdRentang>('b3')
  const [barsByKode, setBarsByKode] = useState<Record<string, BarisOhlc[] | null>>({})
  const [ihsgBars, setIhsgBars] = useState<BarisOhlc[] | null>(null)
  const [saham, setSaham] = useState<Record<string, number>>({})

  useEffect(() => {
    let batal = false
    for (const it of items) {
      if (barsByKode[it.kode] !== undefined) continue
      fetchDeret(it.kode).then((d) => { if (!batal) setBarsByKode((x) => ({ ...x, [it.kode]: d })) })
    }
    return () => { batal = true }
  }, [items, barsByKode])

  useEffect(() => {
    let batal = false
    fetchDeret('IHSG').then((d) => { if (!batal) setIhsgBars(d) })
    fetchSahamMap().then((m) => { if (!batal) setSaham(m) })
    return () => { batal = true }
  }, [])

  const semuaTermuat = ihsgBars !== null && items.every((it) => barsByKode[it.kode] !== undefined)

  const anggota: AnggotaIndeks[] = useMemo(() => items.map((it) => ({
    kode: it.kode,
    bars: barsByKode[it.kode] ?? [],
    saham: saham[it.kode] ?? null,
  })), [items, barsByKode, saham])

  const tanggalUmum = useMemo(
    () => (ihsgBars ? tanggalUmumWatchlist(anggota, ihsgBars) : []),
    [anggota, ihsgBars],
  )
  const opsi = useMemo(() => opsiRentang(tanggalUmum.length, PILIHAN_RENTANG_KINERJA), [tanggalUmum.length])
  const tanggalPotong = useMemo(() => potongRentang(tanggalUmum, rentang, (t) => t), [tanggalUmum, rentang])
  const hasil = useMemo(
    () => (ihsgBars ? hitungIndeksWatchlist(anggota, ihsgBars, tanggalPotong) : null),
    [anggota, ihsgBars, tanggalPotong],
  )
  const rebasedIndeks = hasil ? (bobot === 'setara' ? hasil.rebasedSetara : hasil.rebasedKap) : null

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!hasil || !rebasedIndeks) return null
    const isDark = theme === 'dark'
    const textColor = isDark ? '#cfd8e3' : '#1a2733'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    return {
      type: 'line',
      data: {
        labels: hasil.tgl,
        datasets: [
          ...hasil.rebasedAnggota.map((g, i) => ({
            label: g.kode, data: g.nilai,
            borderColor: bacaTokenTema(TOKEN_SERI[i % TOKEN_SERI.length]),
            borderWidth: 1, pointRadius: 0,
          })),
          {
            label: bobot === 'setara' ? 'Indeks (Setara)' : 'Indeks (Kap. pasar)', data: rebasedIndeks,
            borderColor: '#38B77E', borderWidth: 2.6, pointRadius: 0,
          },
          { label: 'IHSG', data: hasil.rebasedIhsg, borderColor: '#5B94E8', borderWidth: 2, borderDash: [5, 4], pointRadius: 0 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { color: textColor, boxWidth: 10, font: { size: 9.5 } } } },
        scales: {
          x: { ticks: { color: text2Color, maxTicksLimit: 8, callback: (_v, i) => labelTanggal(hasil.tgl[i]) }, grid: { display: false } },
          y: { ticks: { color: text2Color, callback: (v) => Number(v).toFixed(0) }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [hasil, rebasedIndeks, theme, bobot])
  const canvasRef = useChartCanvas(config)

  if (items.length === 0) return <p className="muted">Belum ada emiten di watchlist.</p>
  if (!semuaTermuat) return <p className="muted">Memuat riwayat harga anggota…</p>
  if (!hasil) {
    return (
      <p className="muted">
        Tak cukup irisan tanggal antar anggota watchlist (dan IHSG) pada rentang ini — kemungkinan salah satu anggota
        baru listing, sehingga jendela bersamanya terlalu pendek.
      </p>
    )
  }

  const m: MetrikIndeks = bobot === 'setara' ? hasil.metrikSetara : hasil.metrikKap
  const tone = (v: number) => (v >= 0 ? 'var(--green)' : 'var(--red)')

  return (
    <>
      <div className="kendali" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div className="tabs" role="tablist" aria-label="Bobot indeks watchlist">
          <button type="button" role="tab" aria-selected={bobot === 'setara'}
            className={'tab' + (bobot === 'setara' ? ' on' : '')} onClick={() => setBobot('setara')}>
            Setara
          </button>
          <button type="button" role="tab" aria-selected={bobot === 'kap'}
            className={'tab' + (bobot === 'kap' ? ' on' : '')} onClick={() => setBobot('kap')}>
            Kap. pasar
          </button>
        </div>
        <PemilihRentang opsi={opsi} nilai={rentang} onGanti={setRentang} ariaLabel="Rentang indeks watchlist" />
        <span className="lbl">{captionRentang(hasil.tgl, (t) => t)}</span>
      </div>

      {bobot === 'kap' && hasil.tanpaKap.length > 0 && (
        <p className="muted wl-catatan" style={{ margin: '0 0 12px' }}>
          Tanpa data lembar saham (bobotnya disamakan ke rata-rata anggota lain — "bobot setara"): {hasil.tanpaKap.join(', ')}.
        </p>
      )}

      <div className="grid-vs" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 14 }}>
        <section className="panel">
          <div className="panel-h"><h2>Rebased 100</h2><span className="lbl">titik pertama = 100 · garis tebal = indeks · putus-putus = IHSG</span></div>
          <div className="panel-b"><div className="chart-wrap" style={{ height: 340 }}><canvas ref={canvasRef} /></div></div>
        </section>
        <section className="panel">
          <div className="panel-h"><h2>Metrik — bobot {bobot === 'setara' ? 'Setara' : 'Kap. pasar'}</h2></div>
          <div className="panel-b bs2-metrik">
            <Metrik k="Total return" v={`${m.totalReturn >= 0 ? '+' : ''}${m.totalReturn.toFixed(2)}%`} warna={tone(m.totalReturn)} />
            <Metrik k="vs IHSG" ket="selisih return" v={`${m.vsIhsg >= 0 ? '+' : ''}${m.vsIhsg.toFixed(2)}%`} warna={tone(m.vsIhsg)} />
            <Metrik k="Volatilitas" ket="tersetahunkan, σ harian × √252" v={`${m.volatilitas.toFixed(1)}%`} />
            <Metrik k="Max drawdown" ket="penurunan puncak-lembah terbesar" v={`${m.maxDrawdown.toFixed(2)}%`} warna="var(--red)" />
            <Metrik k="Win rate harian" ket={`% hari indeks > IHSG · n=${m.nHari}`} v={`${m.winRateHarian.toFixed(1)}%`} />
          </div>
        </section>
      </div>

      <p className="wl-catatan muted">
        Indeks dihitung dari harga penutupan TERSESUAIKAN aksi korporasi — bukan produk resmi bursa, dan bobotnya
        TETAP sepanjang rentang terpilih (tak direbalans harian). Win rate harian bersifat deskriptif (perbandingan
        riwayat), bukan ramalan.
      </p>
    </>
  )
}
