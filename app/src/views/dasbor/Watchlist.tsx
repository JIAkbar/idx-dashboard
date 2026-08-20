import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IkonMenu, IKON_CARI, IKON_TONG } from '../../components/dasbor/IkonMenu'
import { TombolIkon } from '../../components/dasbor/TombolIkon'
import { useKamusEmiten } from '../../lib/dasbor/kamusEmiten'
import { useUrut } from '../../lib/dasbor/useUrut'
import { fp } from '../../lib/dasbor/format'
import { keFraksi } from '../../lib/fraksiHarga'
import {
  muatWatchlist, tambahEmiten, hapusEmiten, simpanHargaMilik,
  fetchDeret, ambilHargaTerakhir, hargaRataRata, untungRugi,
  type WatchlistItem, type HargaTerakhir,
} from '../../lib/dasbor/watchlist'
import { posisiEma, labelKeadaan, HORIZON, PERIODE, type PosisiEma } from '../../lib/dasbor/emaWatchlist'
import {
  ringkasAd, ringkasAsing, LABEL_VONIS, ARTI_VONIS, JENDELA,
  type RingkasAd, type RingkasAsing,
} from '../../lib/dasbor/akumulasi'
import { fetchAsing } from '../../lib/dasbor/stockDetailData'
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
  const [asing, setAsing] = useState<Record<string, RingkasAsing | null>>({})
  const [cari, setCari] = useState('')

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
        if (!batal) setAsing((x) => ({ ...x, [it.kode]: a ? ringkasAsing(a.d) : null }))
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
      asing: asing[it.kode] ?? null,
      asingNet: asing[it.kode]?.netLembar ?? null,
    }
  }), [items, deret, asing, namaKode])

  const s = useUrut(baris, 'kode', 'naik')

  return (
    <div className="lantai">
      <div className="vhead">
        <div>
          <h1>Watchlist</h1>
          <span className="sub">Daftar pantau yang bergerak mengikuti harga harian — isi harga milik untuk melihat untung-rugi.</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-b wl-alat">
          <span className="af-cari wl-cari">
            <IkonMenu d={IKON_CARI} size={13} />
            <input
              className="inp" type="search" placeholder="Tambah kode emiten…" value={cari}
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
                  <th className="r">Akum/Dist</th>
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
        )}
      </div>

      <p className="wl-catatan muted">
        Kolom <b>EMA {PERIODE.join('/')}</b> menandai posisi harga terhadap tiap rata-rata bergerak eksponensial
        (▲ di atas, ▼ di bawah). <b>Peluang {HORIZON}H</b> bukan ramalan: ia menghitung, dari riwayat emiten itu
        sendiri, berapa persen kejadian dengan posisi EMA yang sama ditutup lebih tinggi {HORIZON} hari bursa
        kemudian — angka masa lalu, dan masa lalu tidak mengikat masa depan. Ditampilkan hanya kalau sampelnya cukup.
      </p>
      <p className="wl-catatan muted">
        <b>Asing {JENDELA}H</b> menjumlahkan beli dikurangi jual investor asing selama {JENDELA} hari bursa terakhir,
        dalam <b>lembar</b> — IDX tidak melaporkan aliran asing dalam rupiah. <b>Akum/Dist</b> membandingkan arah garis
        Accumulation/Distribution dengan arah harga di periode yang sama: "diam-diam" berarti keduanya berlawanan —
        harga turun sementara uang masuk, atau sebaliknya. Keduanya menyajikan keadaan, bukan saran beli atau jual.
      </p>
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
        <TombolIkon
          d={IKON_TONG} label="Hapus dari watchlist" ariaLabel={`Hapus ${b.kode} dari watchlist`}
          nada="merah" onClick={onHapus}
        />
      </td>
    </tr>
  )
}
