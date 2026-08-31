import {
  useBenchmarkAturan, useSelisihPasar, pelemahanPct, barisRezim,
  type AturanUji, type SelisihPasar,
} from '../../lib/dasbor/benchmarkAturan'
import './UjiAturan.css'

/**
 * Panel "Uji Aturan" — di tab Riwayat & Win Rate, di bawah rekam jejak harian.
 *
 * Menjawab pertanyaan yang tab itu SENDIRI tak bisa jawab: rekam jejak harian
 * memberi tahu seberapa sering aturan yang SEKARANG dipakai menang; panel ini
 * memberi tahu apakah ada cara lain yang lebih baik, dan seberapa banyak dari
 * hasilnya sebenarnya cuma arah pasar.
 *
 * ## Tiga hal yang sengaja dipajang berdampingan
 *
 * 1. **Beli-lalu-tahan** ditaruh SEBELUM tabel aturan, bukan sesudahnya.
 *    Kalau pembaca melihat "+1,59% per sinyal" lebih dulu, angka itu sudah
 *    telanjur terbaca sebagai prestasi sebelum ia tahu bahwa membeli apa saja
 *    lalu menahan lima hari memberi +0,87% tanpa aturan sama sekali.
 * 2. **Sesudah biaya** satu kolom dengan sebelum biaya. Enam aturan berbalik
 *    jadi rugi begitu ongkos dipotong, dan semuanya aturan bertarget rapat —
 *    yang justru terlihat paling aman karena win rate-nya tinggi.
 * 3. **Win rate ditaruh di kolom paling kiri dan sengaja TIDAK diurutkan
 *    menurutnya.** Tabel diurut menurut hasil per satuan risiko. Kalau
 *    diurutkan menurut win rate, pembaca akan menyimpulkan yang teratas paling
 *    baik — dan itu persis kesalahan yang panel ini ada untuk mencegahnya.
 *
 * Teks di sini tak menyebut nama berkas, fungsi, endpoint, atau ambang angka
 * internal — halaman ini publik dan aturan proyek melarang istilah mesin
 * tayang. Yang dijelaskan artinya bagi pembaca.
 */

const f2 = (v: number) => v.toFixed(2).replace('.', ',')
const f3 = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3).replace('.', ',')
const pc = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace('.', ',') + '%'

function Baris({ a, maks }: { a: AturanUji; maks: number }) {
  const sekarang = a.id === 'atr-produksi'
  const lebar = Math.max(1, Math.round((Math.abs(a.eksR) / maks) * 78))
  return (
    <tr className={sekarang ? 'ua-kini' : undefined}>
      <td className="ua-nama">
        {a.nama}
        {sekarang && <span className="ua-tag">dipakai sekarang</span>}
      </td>
      <td className="r ua-lemah">{f2(a.wr)}%</td>
      <td className="r ua-lemah">{f2(a.risiko)}%</td>
      <td className="r">
        <span className={'ua-bar ' + (a.eksR > 0 ? 'up' : 'dn')} style={{ width: `${lebar}px` }} />
        <b className={a.eksR > 0 ? 'up' : 'dn'}>{f3(a.eksR)}</b>
      </td>
      <td className="r">
        {a.eksR_biaya == null ? (
          <span className="ua-lemah">—</span>
        ) : (
          <span className={a.eksR_biaya > 0 ? 'up' : 'dn'}>{f3(a.eksR_biaya)}</span>
        )}
      </td>
    </tr>
  )
}

/**
 * Selisih terhadap pasar, dipecah menurut arah IHSG pada hari sinyal.
 *
 * Menjawab pertanyaan Johan langsung: saat pasar turun, apakah saham pilihan
 * tetap unggul? Kolom "IHSG turun" sengaja ditaruh PALING KIRI karena itu
 * pertanyaannya — bukan diurut naik-datar-turun seperti kebiasaan.
 *
 * Baris kontrol ("semua hari") ditampilkan dan TIDAK disembunyikan walau
 * nilainya nol: nol itu justru buktinya bahwa pengukurannya terkalibrasi —
 * seluruh emiten dibanding mediannya sendiri memang harus nol. Menyembunyikan
 * baris yang "tidak menarik" akan menghapus satu-satunya bukti bahwa angka di
 * baris lain bisa dipercaya.
 */
function PanelSelisih({ d }: { d: SelisihPasar }) {
  const H = 5
  return (
    <>
      <h3>Saat pasar turun, apakah saham pilihan tetap unggul?</h3>
      <p className="ua-sub">
        Selisih terhadap <b>saham median</b> selama {H} hari — bukan terhadap harga
        sendiri. Nol berarti “sama saja dengan saham kebanyakan”. Dipecah menurut arah
        pasar pada hari sinyal, dari {d.nEmiten} emiten.
      </p>
      <div className="ua-gulir">
        <table className="ua-tbl">
          <thead>
            <tr>
              <th>Saringan</th>
              <th className="r">Pasar TURUN</th>
              <th className="r">Datar</th>
              <th className="r">Pasar naik</th>
              <th className="r">Menang</th>
              <th className="r">vs IHSG</th>
            </tr>
          </thead>
          <tbody>
            {d.urutan.map((s) => {
              const b = barisRezim(d, s, H)
              if (b.length < 3) return null
              const kontrol = s === 'semua'
              const kuat = b[0].median > 0.1
              return (
                <tr key={s} className={kuat ? 'ua-kini' : undefined}>
                  <td className="ua-nama">
                    {b[0].label}
                    {kontrol && <span className="ua-tag">kontrol</span>}
                  </td>
                  {b.map((x) => (
                    <td key={x.rezim} className={'r ' + (x.median > 0 ? 'up' : x.median < 0 ? 'dn' : 'ua-lemah')}>
                      {x.median > 0 ? '+' : x.median < 0 ? '−' : ''}
                      {Math.abs(x.median).toFixed(3).replace('.', ',')}%
                    </td>
                  ))}
                  <td className="r ua-lemah">{b[0].menangPct.toFixed(1).replace('.', ',')}%</td>
                  <td className={'r ' + ((b[0].vsIhsg ?? 0) < 0 ? 'dn' : 'up')}>
                    {b[0].vsIhsg == null
                      ? '—'
                      : (b[0].vsIhsg > 0 ? '+' : '−') + Math.abs(b[0].vsIhsg).toFixed(3).replace('.', ',') + '%'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="ua-awas">
        <b>Tiga hal dari tabel itu, dan dua di antaranya membatasi.</b>
        <br />
        <b>Satu:</b> hanya <b>tren tersusun rapi</b> yang memberi selisih nyata, dan
        keunggulannya <b>paling besar justru saat pasar turun</b> — saham bertren
        memang bertahan lebih baik saat pasar jatuh.{' '}
        <b>Dua:</b> saringan lain memberi <b>nol</b>; berada di atas satu garis
        rata-rata saja tak menambah apa pun.{' '}
        <b>Tiga:</b> kolom terakhir negatif di semua baris — saham pilihan{' '}
        <b>mengalahkan saham median tapi kalah dari IHSG</b>. Keduanya benar sekaligus:
        indeks tertimbang kapitalisasi dan didominasi bank besar yang naik lebih kuat
        daripada emiten kebanyakan di periode ini. Angka menangnya pun cuma 50–52%,
        jadi keunggulannya datang dari sebaran, bukan dari sering menang.
      </div>
    </>
  )
}

export function UjiAturan() {
  const d = useBenchmarkAturan()
  const sel = useSelisihPasar()
  if (!d) return null

  const bt5 = d.beliTahan.find((x) => x.saringan === 'semua' && x.horizon === 5)
  const btTren = d.beliTahan.find((x) => x.saringan === 'tersusun' && x.horizon === 5)
  const maks = Math.max(...d.aturan.map((a) => Math.abs(a.eksR)))
  const nRugi = d.aturan.filter((a) => a.eksR_biaya != null && a.eksR_biaya < 0).length

  return (
    <section className="uji-aturan">
      <h2>Uji Aturan — adakah cara yang lebih baik?</h2>
      <p className="ua-sub">
        {d.cakupan.sel} cara berbeda menentukan area beli, target, dan batas rugi, diadu
        pada {d.cakupan.sinyal.toLocaleString('id-ID')} hari sinyal dari{' '}
        {d.cakupan.emiten} emiten likuid — hari yang sama persis untuk semuanya.
      </p>

      <div className="ua-awas">
        <b>Baca angka ini lebih dulu, sebelum tabel mana pun.</b> Pada periode yang
        sama, <b>membeli apa saja lalu menahan lima hari</b> — tanpa target, tanpa batas
        rugi, tanpa aturan — memberi{' '}
        <b className="up">{bt5 ? pc(bt5.rata) : '—'}</b>, dan membeli saham yang trennya
        sedang tersusun rapi memberi{' '}
        <b className="up">{btTren ? pc(btTren.rata) : '—'}</b>. Aturan apa pun harus
        dibaca terhadap angka itu; sebagian dari yang terlihat sebagai keunggulan aturan
        sebenarnya arah pasar yang sedang naik.
      </div>

      <h3>Per keluarga, bukan per baris</h3>
      <p className="ua-sub">
        Juara dan runner-up cuma terpisah {f2(d.ketahanan.jarakSD)} simpangan baku —
        satu kerumunan, bukan dua angka. Yang bisa dipercaya perbandingan
        antar-keluarga, karena keluarga yang unggul di ratusan konfigurasi jauh lebih
        sulit dipalsukan kebetulan.
      </p>
      <div className="ua-gulir">
        <table className="ua-tbl">
          <thead>
            <tr>
              <th>Keluarga aturan</th>
              <th className="r">Cara diuji</th>
              <th className="r">Hasil per risiko</th>
              <th className="r">Paruh awal</th>
              <th className="r">Paruh akhir</th>
            </tr>
          </thead>
          <tbody>
            {d.keluarga.map((k) => {
              const turun = pelemahanPct(k)
              return (
                <tr key={k.nama} className={k.nama === d.keluarga[0].nama ? 'ua-kini' : undefined}>
                  <td className="ua-nama">{k.nama}</td>
                  <td className="r ua-lemah">{k.n}</td>
                  <td className="r"><b>{f3(k.median)}</b></td>
                  <td className="r ua-lemah">{f3(k.lama)}</td>
                  <td className="r dn">
                    {f3(k.baru)}
                    {turun != null && <span className="ua-lemah"> −{turun}%</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="ua-sub ua-catat">
        Kolom dua paruh terakhir itu peringatan, bukan pelengkap:{' '}
        <b>seluruh keluarga melemah</b> di paruh akhir, jadi yang berubah pasarnya —
        bukan aturannya. Angka periode penuh melebih-lebihkan apa yang bisa diharapkan
        sekarang.
      </p>

      {sel && <PanelSelisih d={sel} />}

      <h3>Tiap cara, tanpa saringan apa pun</h3>
      <p className="ua-sub">
        Diurutkan menurut hasil per satuan risiko — <b>bukan</b> menurut win rate.
        Win rate tetap ditampilkan supaya terlihat bahwa peringkat keduanya berbeda.
      </p>
      <div className="ua-gulir">
        <table className="ua-tbl">
          <thead>
            <tr>
              <th>Cara menentukan target &amp; batas rugi</th>
              <th className="r">Win rate</th>
              <th className="r">Risiko</th>
              <th className="r">Hasil per risiko</th>
              <th className="r">Sesudah biaya</th>
            </tr>
          </thead>
          <tbody>
            {d.aturan.map((a) => <Baris key={a.id} a={a} maks={maks} />)}
          </tbody>
        </table>
      </div>
      <p className="ua-sub ua-catat">
        Kolom terakhir memotong ongkos beli+jual 0,40% pulang-pergi.{' '}
        <b>{nRugi} cara berbalik jadi rugi</b> begitu ongkos dihitung — semuanya cara
        bertarget rapat, yang justru terlihat paling aman karena win rate-nya tinggi.
        Ongkos tetap membebani lebih berat kalau batas ruginya dekat.
      </p>

      <div className="ua-netral">
        <b>Kelas bukti.</b> Seluruh angka di panel ini dari sinyal yang{' '}
        <b>direkonstruksi</b> — aturan diterapkan mundur ke harga lama. Ia menjawab
        “aturan mana yang bekerja pada masa lalu”, bukan “apa yang sudah terjadi di
        PAPAN”. Untuk yang kedua, lihat rekam jejak harian di atas: sampelnya jauh lebih
        kecil, tapi setiap barisnya ditulis sebelum harganya terjadi.
      </div>
    </section>
  )
}
