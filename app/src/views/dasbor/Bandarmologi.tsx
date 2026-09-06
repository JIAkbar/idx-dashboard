import { useMemo, useState } from 'react'
import { KonteksData } from '../../components/dasbor/KonteksData'
import { IkonMenu, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { useKategoriBroker, LABEL_KATEGORI, KETERANGAN_KATEGORI } from '../../lib/dasbor/kategoriBroker'
import { fN } from '../../lib/dasbor/format'
import {
  useBandarmologi, ciriLot, ciriTimpang, ciriFase,
  LABEL_LOT, LABEL_TIMPANG, LABEL_FASE, type BarisBandar,
} from '../../lib/dasbor/bandarmologi'
import './Bandarmologi.css'

/**
 * Bandarmologi — satu halaman yang MEMBAHAS teori dan sekaligus menunjukkan
 * angkanya, atas permintaan Johan 3 Sep 2026: *"teori algo itu coba pelajari
 * dan buatkan 1 page bahas semua teori itu jadi hasil kerja"*.
 *
 * Dua sumber teori (`data ide/`): kelas BidOffer Bandar (Abdullah Ali Akbar)
 * dan spesifikasi kuantitatif Algo/Radar (Rizky Cahya). Keduanya menuntut
 * order book live; halaman ini menghitung bagian yang bisa dijawab data
 * harian yang sudah dipanen, dan **menyebutkan bagian yang tidak bisa**
 * alih-alih diam-diam menggantinya dengan proksi.
 *
 * Nama penyedia data boleh disebut sebagai atribusi; nama endpoint, berkas,
 * dan fungsi tidak pernah muncul di layar (aturan kebocoran CLAUDE.md).
 */

type Saring = 'semua' | 'lot-tebal' | 'offer-tebal' | 'bid-tebal' | 'asing-kuat' | 'beli-terpusat'

const OPSI_SARING = [
  { nilai: 'semua', label: 'Semua emiten' },
  { nilai: 'lot-tebal', label: 'Lot per transaksi tebal' },
  { nilai: 'offer-tebal', label: 'Antrean jual ≥ 3× beli' },
  { nilai: 'bid-tebal', label: 'Antrean beli ≥ 3× jual' },
  { nilai: 'asing-kuat', label: 'Asing ≥ 10% volume' },
  { nilai: 'beli-terpusat', label: 'Beli terpusat di sedikit sekuritas' },
]

function Teori({ nomor, judul, sumber, bunyi, cara, batas, anak }: {
  nomor: string
  judul: string
  sumber: string
  bunyi: string
  cara: string
  batas?: string
  anak?: React.ReactNode
}) {
  return (
    <section className="bm-teori">
      <div className="bm-teori-h">
        <span className="bm-teori-n">{nomor}</span>
        <h2>{judul}</h2>
        <span className="bm-teori-src">{sumber}</span>
      </div>
      <p className="bm-bunyi">“{bunyi}”</p>
      <p className="bm-cara"><b>Cara kami menghitungnya.</b> {cara}</p>
      {batas && (
        <p className="bm-batas">
          <IkonMenu d={IKON_PERINGATAN} size={13} /> <b>Batasnya.</b> {batas}
        </p>
      )}
      {anak}
    </section>
  )
}

export default function Bandarmologi() {
  const { data, memuat, galat } = useBandarmologi()
  const { index: indeksEmiten } = useStockIndex()
  // Kategori PERILAKU broker (120 hari): fondasi yang sudah dibangun tapi belum
  // dibaca halaman mana pun sampai hari ini. Ia pasangan alami teori
  // "sekuritas langganan" — kode broker saja tak berarti apa-apa tanpa tahu
  // broker itu biasanya bergerak besar-tegas atau kecil-bolak-balik.
  const perilaku = useKategoriBroker()
  const [cari, setCari] = useState('')
  const [saring, setSaring] = useState<Saring>('semua')

  const ringkas = useMemo(() => {
    if (!data) return null
    const d = data.d
    const lipat = data.ambang.lipat_timpang
    const pungut = <T,>(f: (b: BarisBandar) => T | null, nilai: T) =>
      d.filter((b) => f(b) === nilai).length
    const shareTertinggi = d.reduce((m, b) => Math.max(m, b.share_nilai ?? 0), 0)
    return {
      lotTebal: pungut((b) => ciriLot(b), 'tebal' as const),
      offerTebal: d.filter((b) => ciriTimpang(b, lipat) === 'offer-tebal').length,
      bidTebal: d.filter((b) => ciriTimpang(b, lipat) === 'bid-tebal').length,
      asingKuat: d.filter((b) => (b.share_asing ?? 0) >= data.ambang.share_asing_min).length,
      punyaFase: d.filter((b) => b.fase).length,
      beliTerpusat: pungut((b) => ciriFase(b), 'akumulasi' as const),
      shareTertinggi,
      lolosNilai: d.filter((b) => (b.share_nilai ?? 0) >= data.ambang.share_nilai_min).length,
    }
  }, [data])

  /** Label kategori perilaku broker, atau kosong kalau brokernya belum
   *  terkurasi. Dibungkus fungsi supaya pengindeksan tipenya aman. */
  const kat = (kode: string): string => {
    const b = perilaku?.broker?.[kode]
    return b ? LABEL_KATEGORI[b.kategori] : ''
  }

  const baris = useMemo(() => {
    if (!data) return []
    const lipat = data.ambang.lipat_timpang
    const q = cari.trim().toUpperCase()
    return data.d.filter((b) => {
      if (q && !b.kode.startsWith(q)) return false
      switch (saring) {
        case 'lot-tebal': return ciriLot(b) === 'tebal'
        case 'offer-tebal': return ciriTimpang(b, lipat) === 'offer-tebal'
        case 'bid-tebal': return ciriTimpang(b, lipat) === 'bid-tebal'
        case 'asing-kuat': return (b.share_asing ?? 0) >= data.ambang.share_asing_min
        case 'beli-terpusat': return ciriFase(b) === 'akumulasi'
        default: return true
      }
    }).slice(0, 150)
  }, [data, cari, saring])

  // Baris "Data per …" TIDAK lagi berdiri sendiri di bawah kepala
  // (Johan 5 Sep 2026: "kenapa teks 2 juni 2026 gak di pindahkan saja
  // 1 baris dengan teks peta investor"). Ia masuk ke .vhead dan
  // didorong ke ujung kanan, jadi satu baris hilang tanpa ada yang
  // dibuang — tautan Metodologi di dalamnya ikut pindah, bukan mati.
  //
  // vhead jadi FUNGSI karena tanggalnya baru diketahui di cabang utama;
  // cabang memuat/galat memanggilnya tanpa argumen dan komponennya
  // menulis "Data per —" apa adanya, bukan menyembunyikan barisnya.
  const vhead = (tgl: string | null = null, sementara = false) => (
    <div className="vhead">
      <h1>Bandarmologi</h1>
      <KonteksData tanggal={tgl} sementara={sementara} />
    </div>
  )

  if (memuat) return <div className="lantai">{vhead()}<div className="panel panel-b">Memuat…</div></div>
  if (galat || !data) {
    return (
      <div className="lantai">{vhead()}
        <div className="panel panel-b bm-kosong">
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Data belum dibangun untuk hari ini.</p>
        </div>
      </div>
    )
  }

  const lipat = data.ambang.lipat_timpang

  return (
    <div className="lantai">
      {vhead(data.tanggal)}

      <p className="bm-pengantar">
        Dua dokumen di arsip ide menjelaskan cara membaca jejak pemain besar: kelas
        <b> bid-offer bandar</b> dan sebuah <b>spesifikasi kuantitatif order-flow</b>.
        Keduanya dirancang untuk dibaca <i>saat pasar berjalan</i>, dari antrean sepuluh
        level dan tiap transaksi yang lewat. Kita tidak punya keduanya. Yang kita punya
        adalah rekaman harian yang lengkap dan panjang — dan sebagian besar teorinya
        ternyata masih bisa dihitung dari situ, sesudah pasar tutup. Halaman ini
        mengerjakan bagian itu, satu teori per bagian, dengan angkanya hari ini.
        Yang tidak bisa dihitung ada di bagian terakhir, beserta sebabnya.
      </p>

      {/* ── Angka hari ini ─────────────────────────────────────────── */}
      <div className="bm-angka">
        <div><b>{fN(data.n, 0)}</b><span>emiten bertransaksi</span></div>
        <div><b>{fN(ringkas?.lotTebal ?? 0, 0)}</b><span>lot per transaksi tebal</span></div>
        <div><b>{fN(ringkas?.offerTebal ?? 0, 0)}</b><span>antrean jual ≥ {lipat}× beli</span></div>
        <div><b>{fN(ringkas?.bidTebal ?? 0, 0)}</b><span>antrean beli ≥ {lipat}× jual</span></div>
        <div><b>{fN(ringkas?.asingKuat ?? 0, 0)}</b><span>asing ≥ 10% volume</span></div>
        <div><b>{fN(ringkas?.beliTerpusat ?? 0, 0)}</b><span>beli terpusat<small> dari {fN(ringkas?.punyaFase ?? 0, 0)} berdata broker</small></span></div>
      </div>

      {/* ── Teori 1 ────────────────────────────────────────────────── */}
      <Teori
        nomor="1"
        judul="Lot besar berfrekuensi kecil = pemain besar"
        sumber="Kelas bid-offer bandar"
        bunyi="Lot besar, frekuensi kecil — bandar. Lot kecil, frekuensi besar — retail."
        cara={
          'Lot rata-rata per transaksi = volume dibagi frekuensi. Angka itu tak bisa ' +
          'diadu antar emiten — 42 lot per transaksi di bank besar dan 42 di saham receh ' +
          'bukan hal yang sama — jadi ia dibandingkan dengan kebiasaan emiten ITU SENDIRI ' +
          'selama 60 hari bursa, memakai median dan sebaran absolut, bukan rata-rata. ' +
          'Skala ini tahan terhadap satu transaksi raksasa yang akan menggeser rata-rata biasa.'
        }
        batas={
          `Baseline dianggap layak dipercaya hanya sesudah ${data.ambang.n_min_kalibrasi} hari berdata; ` +
          'di bawah itu angkanya tetap ditampilkan tapi ditandai belum terkalibrasi.'
        }
      />

      {/* ── Teori 2 ────────────────────────────────────────────────── */}
      <Teori
        nomor="2"
        judul="Ketimpangan antrean beli dan jual"
        sumber="Kelas bid-offer bandar"
        bunyi="Jika ingin membeli, antrean beli lebih tebal. Total antrean jual minimal tiga kali antrean beli sebagai syarat harga bergerak naik impulsif."
        cara={
          'Rasio lot antrean jual dibagi lot antrean beli pada penutupan. Ambang tiga kali ' +
          'dipakai apa adanya seperti di kelasnya, bukan disetel ulang supaya hasilnya enak dilihat.'
        }
        batas={
          'Kelas itu membaca sepuluh level antrean saat pasar berjalan, dan pola “piramida” ' +
          'yang jadi intinya hanya terlihat di sana. Kita hanya punya level terbaik pada saat ' +
          'penutupan, sekali sehari. Jadi angka ini menjawab “siapa lebih tebal saat bel berbunyi”, ' +
          'bukan “apakah ada piramida yang sedang dibangun”. Perbedaan itu besar dan tidak bisa ditutup.'
        }
      />

      {/* ── Teori 3 ────────────────────────────────────────────────── */}
      <Teori
        nomor="3"
        judul="Empat fase: akumulasi, menggoreng, distribusi, guyur"
        sumber="Kelas bid-offer bandar"
        bunyi="Saat akumulasi, nilai beli hanya didominasi beberapa sekuritas sementara jualnya tersebar ke banyak sekuritas. Saat distribusi, kebalikannya."
        cara={
          'Konsentrasi diukur satu angka per sisi — seberapa terpusat nilai beli, dan seberapa ' +
          'terpusat nilai jual — lalu keduanya dibandingkan. Sisi beli yang jauh lebih terpusat ' +
          'daripada sisi jual adalah ciri yang dimaksud kelasnya. Ditampilkan juga pangsa tiga ' +
          'sekuritas teratas di masing-masing sisi.'
        }
        batas={
          'Yang dilaporkan hanya CIRI konsentrasi satu hari, bukan vonis fase. Membedakan ' +
          '“menggoreng” dari “distribusi awal” menuntut arah harga berhari-hari; menyebut ' +
          'empat fase dari data satu hari berarti mengarang. Hari ini rincian sekuritas ' +
          `tersedia untuk ${fN(ringkas?.punyaFase ?? 0, 0)} emiten saja — sisanya menunggu panen ulang.`
        }
      />

      {/* ── Teori 4 ────────────────────────────────────────────────── */}
      <Teori
        nomor="4"
        judul="Sekuritas langganan"
        sumber="Kelas bid-offer bandar"
        bunyi="Bandar biasanya memakai lebih dari satu sekuritas agar tidak mudah dideteksi dan agar dapat saling mengoper barang. Biasanya antara tiga hingga delapan sekuritas."
        cara={
          'Untuk tiap emiten dihitung sekuritas mana yang BERULANG masuk tiga besar nilai beli ' +
          'selama 20 hari bursa terakhir. Yang muncul kurang dari tiga hari dibuang — sekali ' +
          'muncul karena satu transaksi besar bukan pola. Hasilnya delapan teratas, terurut ' +
          'dari yang paling sering. Tiap kode diwarnai menurut PERILAKU sekuritas itu selama ' +
          '120 hari bursa — porsi nilai pasar dikali keteguhan arahnya — supaya kode yang ' +
          'berulang bisa dibedakan antara pemain besar berarah tegas dan lalu lintas dua arah.'
        }
        batas={KETERANGAN_KATEGORI}
      />

      {/* ── Teori 5 ────────────────────────────────────────────────── */}
      <Teori
        nomor="5"
        judul="Target harga dari volume pembeli"
        sumber="Kelas bid-offer bandar"
        bunyi="Target = volume lot pembeli dibagi rata-rata lot tiap tick, dikali fraksi harga, ditambah harga rata-rata pembeli teratas."
        cara={
          'Versi ayunan dari rumus itu memakai volume lot pembeli terbesar dan harga rata-rata ' +
          'tertimbangnya — dua hal yang memang ada di rekaman harian kita — lalu rentang sepuluh ' +
          'tick dihitung dari tabel fraksi resmi bursa, bukan dibaca dari layar.'
        }
        batas={
          'Penyebutnya di kelas itu adalah rata-rata lot per tick di seluruh antrean; kita hanya ' +
          'punya level terbaik saat penutupan, sehingga penyebutnya jauh lebih kecil dan targetnya ' +
          'cenderung lebih jauh dari yang dimaksud penyusunnya. Angka ini disajikan sebagai ' +
          'terjemahan yang jujur atas keterbatasan data, bukan sebagai target yang setara. ' +
          'Versi harian dari rumus yang sama tidak dihitung sama sekali — bahannya hanya ada saat pasar berjalan.'
        }
      />

      {/* ── Teori 6 ────────────────────────────────────────────────── */}
      <Teori
        nomor="6"
        judul="Dua aturan jempol: pangsa nilai dan aliran asing"
        sumber="Kelas bid-offer bandar"
        bunyi="Nilai transaksi emiten 8–10 persen dari nilai pasar berarti emiten itu sedang dimainkan. Sesudah pasar tutup, 10–15 persen dari nilai transaksi biasanya beli bersih asing — kalau ya, layak ditahan berhari-hari."
        cara={
          'Kedua ambang dihitung apa adanya: pangsa nilai transaksi emiten terhadap nilai pasar ' +
          'seharian, dan beli bersih asing terhadap volume emiten.'
        }
        batas={
          'ATURAN INI SUDAH DIUJI DAN TIDAK MEMBERI KEUNGGULAN. Backtest Januari 2025 sampai ' +
          'Agustus 2026 atas seluruh emiten, horizon lima hari bursa: hari-emiten yang lolos ' +
          'saringan pangsa nilai (452 kejadian) menghasilkan median −0,63% dengan 44% menang, ' +
          'dan yang ditambah saringan aliran asing (98 kejadian) −0,87%. Pembandingnya — semua ' +
          'hari-emiten tanpa saringan, 320.309 kejadian — median 0,00% dengan 43% menang. ' +
          'Jadi saringan ini sedikit lebih buruk daripada tidak menyaring sama sekali. Angkanya ' +
          'tetap ditampilkan supaya bisa diperiksa ulang, bukan karena ia layak dipakai. ' +
          `Terpisah dari itu, ambang pangsa nilai juga tak berlaku pada kadens harian: pangsa tertinggi ` +
          `hari ini hanya ${((ringkas?.shareTertinggi ?? 0) * 100).toFixed(1)}% — nol emiten mencapai 8%. ` +
          'Sebabnya jelas begitu diperiksa: aturan itu dirancang untuk lima sampai sepuluh menit ' +
          'pertama perdagangan, saat nilai pasar masih kecil, bukan untuk sehari penuh. Ambangnya ' +
          'tidak kami geser supaya “ada yang lolos” — yang benar adalah menyatakan bahwa aturan ini ' +
          'butuh data menit, dan kita memanennya sesudah pasar tutup. Aturan aliran asing tidak ' +
          `punya masalah itu: ${fN(ringkas?.asingKuat ?? 0, 0)} emiten memenuhinya hari ini.`
        }
      />

      {/* ── Bilah kendali + tabel ──────────────────────────────────── */}
      <div className="bilah-kendali bm-alat">
        <div className="grup-k">
          <StockAutocomplete
            stocks={indeksEmiten?.stocks ?? []}
            value={cari}
            onChange={setCari}
            onSelect={(kode) => setCari(kode)}
            placeholder="Cari emiten: BUMI, BBCA…"
          />
        </div>
        <div className="grup-k">
          <Dropdown
            opsi={OPSI_SARING}
            nilai={saring}
            onGanti={(v) => setSaring(v as Saring)}
            ariaLabel="Saring"
          />
        </div>
        {/* Hitungan hasil TIDAK di sini lagi (keputusan Johan 5 Sep 2026,
            artifact "Empat Bilah Kendali PAPAN", opsi A): ia menerangkan tabel
            di bawah, bukan kendali di sebelahnya, jadi tempatnya di kepala
            panel itu. Di layar sempit `grup-kanan` juga kehilangan posisi
            kanannya (container query 1460px) dan angkanya turun jadi baris
            ketiga sendirian. */}
      </div>

      <div className="panel">
        <div className="panel-h">
          <span className="lbl">Hasil hitung per emiten</span>
          {/* "150 teratas" tak perlu ditulis lagi — angka kiri sudah
              mengatakannya, dan menuliskan dua kali membuat pembaca mencari
              beda yang tak ada. */}
          <span className="num bm-hint">{fN(baris.length, 0)} dari {fN(data.n, 0)} emiten · terurut nilai transaksi</span>
        </div>
        <div className="gulir">
          <table className="tbl bm-tbl">
            <thead>
              <tr>
                <th>Kode</th>
                <th className="r">Lot/transaksi</th>
                <th className="r">vs biasanya</th>
                <th className="r">Antrean jual ÷ beli</th>
                <th className="r">Asing % volume</th>
                <th className="r">Konsentrasi beli</th>
                <th>Sekuritas langganan</th>
                <th className="r">Target ayunan</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => {
                const cl = ciriLot(b)
                const ct = ciriTimpang(b, lipat)
                const cf = ciriFase(b)
                const key3 = (b.key_account ?? []).slice(0, 3)
                return (
                  <tr key={b.kode}>
                    <td className="tick">{b.kode}</td>
                    <td className="r num">
                      {fN(b.lot_per_tx, 1)}
                      <small className="bm-med"> med {fN(b.lot_med, 1)}</small>
                    </td>
                    <td className="r num">
                      {b.z_lot == null ? '—' : (
                        <span className={'bm-pil ' + (cl === 'tebal' ? 'up' : cl === 'tipis' ? 'dn' : '')}>
                          {b.z_lot > 0 ? '+' : ''}{fN(b.z_lot, 1)}
                          {!b.terkalibrasi && <small title="baseline belum cukup hari"> ?</small>}
                        </span>
                      )}
                      {cl && <small className="bm-lbl"> {LABEL_LOT[cl]}</small>}
                    </td>
                    <td className="r num">
                      {b.rasio_offer_bid == null ? '—' : (
                        <span className={'bm-pil ' + (ct === 'offer-tebal' ? 'up' : ct === 'bid-tebal' ? 'dn' : '')}>
                          {fN(b.rasio_offer_bid, 2)}×
                        </span>
                      )}
                      {ct && <small className="bm-lbl"> {LABEL_TIMPANG[ct]}</small>}
                    </td>
                    <td className={'r num ' + ((b.share_asing ?? 0) > 0 ? 'up' : (b.share_asing ?? 0) < 0 ? 'dn' : '')}>
                      {b.share_asing == null ? '—' : `${(b.share_asing * 100).toFixed(1)}%`}
                    </td>
                    <td className="r num">
                      {b.fase ? (
                        <>
                          <span className={'bm-pil ' + (cf === 'akumulasi' ? 'up' : cf === 'distribusi' ? 'dn' : '')}>
                            {b.fase.konsentrasi > 0 ? '+' : ''}{fN(b.fase.konsentrasi, 3)}
                          </span>
                          {cf && <small className="bm-lbl"> {LABEL_FASE[cf]}</small>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="bm-key">
                      {key3.length
                        ? key3.map((k) => (
                            <span
                              key={k.broker}
                              className={'bm-brk kb-' + (perilaku?.broker?.[k.broker]?.kategori ?? 'x')}
                              title={`${k.hari} hari di 3 besar beli` + (kat(k.broker) ? ` · ${kat(k.broker)}` : '')}
                            >
                              {k.broker}<small>{k.hari}h</small>
                            </span>
                          ))
                        : <span className="muted">—</span>}
                    </td>
                    <td className="r num">
                      {b.tmm_swing
                        ? <>{fN(b.tmm_swing.target, 0)}<small className="bm-med"> {b.tmm_swing.jarak_pct != null ? `${b.tmm_swing.jarak_pct > 0 ? '+' : ''}${fN(b.tmm_swing.jarak_pct, 1)}%` : ''}</small></>
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {baris.length === 0 && <div className="panel-b muted">Tak ada emiten yang cocok dengan saringan ini.</div>}
      </div>

      {/* ── Yang tidak bisa dihitung ───────────────────────────────── */}
      <section className="bm-teori bm-takbisa">
        <div className="bm-teori-h">
          <span className="bm-teori-n">—</span>
          <h2>Yang tidak bisa dihitung, dan kenapa</h2>
        </div>
        <p className="bm-cara">
          Bagian ini ada supaya halaman tidak terbaca seolah seluruh teorinya sudah dijalankan.
          Empat hal berikut menuntut data yang tidak kita miliki, dan tidak diganti proksi diam-diam.
        </p>
        <ul className="bm-daftar">
          {data.tak_bisa.map((t) => (
            <li key={t.teori}>
              <b>{t.teori}</b>
              <span className="bm-sumber">{t.sumber}</span>
              <p>{t.sebab}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="bm-kaki">
        Semua angka di halaman ini dihitung sesudah pasar tutup, dari rekaman harian yang
        sudah dipanen — bukan dari umpan langsung. Ambang tiga kali, delapan persen, dan
        sepuluh persen berasal dari kelas yang bersangkutan dan dipakai apa adanya; angka
        mana yang benar-benar berguna baru terjawab lewat pengujian ke hasil, bukan lewat
        kecocokan cerita. Ini bahan analisa, bukan rekomendasi.
      </p>
    </div>
  )
}
