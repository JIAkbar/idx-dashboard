import { LABEL_RENTANG } from '../../lib/dasbor/periode'
import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { HARI, ringkasHarian, hariBursaDiRentang, vonisUji, rentangSumbuBalapan, type RingkasHarian } from '../../lib/seasonality'
import { pesanGalat } from '../../lib/pesanGalat'
import { IkonMenu, IKON_PERINGATAN, IKON_SILANG } from '../../components/dasbor/IkonMenu'
import { muatIndeks, type BarisIndeks, muatBelum} from '../../lib/seasonalityData'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { useLayarSempit } from '../../lib/dasbor/useLayarSempit'

/** Hari bursa minimum buat rentang bebas = satu putaran Senin–Jumat penuh
 *  (#170 K9, perintah Johan). Di bawah itu bukan pintu tertutup — cuma pesan
 *  yang menyebut berapa yang ada dan berapa yang dibutuhkan; halaman ini
 *  untuk orang yang sedang MENGUJI, bukan sekadar percaya tombol praset. */
const AMBANG_BEBAS = 5

/** Tiap pilihan menghitung batas bawahnya sendiri saat diklik — bukan disimpan
 *  sebagai tanggal tetap, supaya MTD/YTD tetap benar kalau halaman dibiarkan
 *  terbuka melewati tengah malam atau pergantian bulan. */
const RENTANG: Array<[string, () => string]> = [
  [LABEL_RENTANG.semua, () => ''],
  [LABEL_RENTANG.mtd, () => new Date().toISOString().slice(0, 8) + '01'],
  [LABEL_RENTANG.ytd, () => new Date().getUTCFullYear() + '-01-01'],
  [LABEL_RENTANG.y1, () => geser(1)],
  [LABEL_RENTANG.y2, () => geser(2)],
  [LABEL_RENTANG.y3, () => geser(3)],
  [LABEL_RENTANG.y5, () => geser(5)],
  [LABEL_RENTANG.y10, () => geser(10)],
  [LABEL_RENTANG.y20, () => geser(20)],
]

function geser(tahun: number): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - tahun)
  return d.toISOString().slice(0, 10)
}

const WARNA = ['var(--red)', 'var(--amber)', 'var(--blue)', 'var(--green)', 'var(--text)']
const BLN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Pola hari dalam seminggu — tab kedua Seasonality.
 *
 * Sumbernya IHSG (ihsg_harian.json, 8.849 hari sejak 1990) ATAU satu emiten
 * (#131b — data OHLC 5 tahun per emiten dipanen di #122). Perhitungannya sama
 * persis untuk keduanya; yang berbeda cuma bentuk berkasnya, dan itu
 * diseragamkan saat dimuat.
 *
 * Grafik balapannya meniru bentuk yang beredar untuk pasar AS, tapi dengan
 * satu tambahan yang justru menentukan: hasilnya diuji lawan pengacakan
 * sebelum disebut pola. Bentuk aslinya cuma menampilkan garis yang menang,
 * dan garis selalu punya pemenang — bahkan pada data acak.
 */
export function SeasonalityHarian() {
  const [tutup, setTutup] = useState<Record<string, number> | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  // Bawaan "1 Tahun" (bukan "Semua"): "Semua" menarik 8.848 hari sejak 1990 dan
  // grafik kumulatifnya jadi didominasi rezim pasar 1990-an yang sudah tak
  // relevan buat pembaca hari ini. Satu tahun terakhir itu jendela yang bisa
  // dinilai orang dari ingatannya sendiri — sejalan dengan alasan utama tab
  // ini: hasilnya harus bisa DIBUKTIKAN, bukan dipercaya begitu saja.
  const [pilih, setPilih] = useState<string>(LABEL_RENTANG.y1)
  // Praset ATAU rentang bebas — praset tetap jalan pintas bawaan, rentang
  // bebas (#170 K9) mengundang pembaca membuktikan sendiri lewat jendela
  // yang ia pilih, bukan yang disodorkan.
  const [modeBebas, setModeBebas] = useState(false)
  const [dariBebas, setDariBebas] = useState('')
  const [sampaiBebas, setSampaiBebas] = useState('')
  // Sumbernya boleh IHSG atau satu emiten (#131b). Berkas OHLC per emiten baru
  // ada setelah #122 dipanen; sebelum itu tab ini memang cuma IHSG.
  const [kode, setKode] = useState('IHSG')
  const [cari, setCari] = useState('')
  const [belum, setBelum] = useState<{ k: string; n: string; j: number; t: string | null }[]>([])
  useEffect(() => { muatBelum().then(setBelum).catch(() => setBelum([])) }, [])
  const [daftar, setDaftar] = useState<BarisIndeks[] | null>(null)

  useEffect(() => { muatIndeks().then(setDaftar).catch(() => {}) }, [])

  useEffect(() => {
    let batal = false
    setTutup(null)
    setGalat(null)
    const alamat = kode === 'IHSG'
      ? '/data-idx/json/ihsg_harian.json'
      : `/data-idx/json/ohlc/${kode}.json`
    fetch(alamat)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      // Dua bentuk berkas: IHSG menyimpan peta {tanggal: tutup}, emiten
      // menyimpan baris OHLCV. Yang dibutuhkan ringkasHarian() cuma
      // penutupannya, jadi baris emiten diperas jadi peta yang sama.
      .then((d: { tutup?: Record<string, number>; d?: Array<[string, number, number, number, number, number]> }) => {
        if (batal) return
        setTutup(d.tutup ?? Object.fromEntries((d.d ?? []).map((b) => [b[0], b[4]])))
      })
      .catch((e: unknown) => {
        if (!batal) setGalat(pesanGalat(e, `Gagal memuat data harian ${kode}.`))
      })
    return () => { batal = true }
  }, [kode])

  // Rentang bebas dikosongkan tiap ganti sumber — IHSG dan satu emiten punya
  // cakupan tanggal yang beda jauh (8.848 hari vs 5 tahun terakhir), jadi
  // pasangan tanggal lama bisa jatuh di luar data yang baru. Kosong lalu
  // diisi ulang oleh keBebas() lebih jujur daripada diam-diam menjepitnya.
  useEffect(() => { setDariBebas(''); setSampaiBebas('') }, [kode])

  const saran = useMemo(() => {
    const q = cari.trim().toUpperCase()
    if (!daftar || q.length < 1) return []
    return daftar.filter((b) => b.k.startsWith(q) || b.n.toUpperCase().includes(q)).slice(0, 8)
  }, [daftar, cari])

  /** Emiten yang cocok TAPI belum setahun penuh, ditampilkan di bawah hasil
   *  biasa dengan alasannya.
   *
   *  Syaratnya sengaja BUKAN "tampilkan kalau hasil biasa kosong". Mengetik
   *  "emas" memunculkan SMKL dan TMAS — keduanya cocok karena "emas" ada di
   *  dalam namanya — sehingga pencarian merasa berhasil sementara EMAS, kode
   *  yang persis diketik, tetap hilang. Jadi yang menentukan adalah apakah
   *  kueri cocok, bukan apakah daftar lain kebetulan terisi. */
  const saranBelum = useMemo(() => {
    const q = cari.trim().toUpperCase()
    if (q.length < 1) return []
    return belum.filter((b) => b.k.startsWith(q) || b.n.toUpperCase().includes(q)).slice(0, 4)
  }, [belum, cari])

  // Hari-hari BERDATA saja, dipakai sebagai `tersedia` DatePicker — kalender
  // otomatis mengunci diri ke rentang data yang sah (tak perlu jepit manual
  // sesudahnya), dan reset tiap ganti sumber supaya IHSG vs satu emiten tak
  // saling mewarisi hari yang tak ada di data yang baru.
  const tersediaSet = useMemo(() => new Set(tutup ? Object.keys(tutup) : []), [tutup])
  const tglTersedia = useMemo(() => [...tersediaSet].sort(), [tersediaSet])
  const akhirData = tglTersedia[tglTersedia.length - 1] ?? ''

  /** Ganti mode ke rentang bebas; kalau belum pernah diisi, mulai dari
   *  jendela yang sama dengan praset bawaan (1 tahun terakhir) supaya kedua
   *  pemilih tak muncul kosong. */
  function keBebas() {
    setModeBebas(true)
    if (!dariBebas || !sampaiBebas) {
      setDariBebas(geser(1))
      setSampaiBebas(akhirData)
    }
  }

  /** Dua ujung ditukar otomatis kalau "dari" dipilih setelah "sampai" —
   *  meniru pola yang sama di /broker-summary (`keRentangBebas`), supaya
   *  klik yang kepeleset urutannya tak perlu diulang dari awal. */
  function ubahBebas(dari: string, sampai: string) {
    if (dari && sampai && dari > sampai) { setDariBebas(sampai); setSampaiBebas(dari) }
    else { setDariBebas(dari); setSampaiBebas(sampai) }
  }

  const sejak = modeBebas ? dariBebas : (RENTANG.find(([n]) => n === pilih)?.[1] ?? (() => ''))()
  const sampai = modeBebas ? sampaiBebas : ''

  const r: RingkasHarian | null = useMemo(
    () => (tutup ? ringkasHarian(kode, tutup, sejak, sampai) : null),
    [tutup, sejak, sampai, kode],
  )

  const hariBursaTerpilih = useMemo(
    () => (tutup ? hariBursaDiRentang(tutup, sejak, sampai) : 0),
    [tutup, sejak, sampai],
  )

  const pemilih = (
    <div className="panel">
      <div className="panel-b sea-hari-sumber">
        <span className="lbl">Sumber</span>
        {/* K10: dulu IHSG memakai .bchip dan emiten terpilih memakai .sea-chip —
            dua kelas, dua bentuk, bersebelahan, untuk pilihan yang sama persis.
            Sekarang keduanya .chip-t, kelas kanonis "pilih satu dari beberapa". */}
        <button type="button" className={`chip-t${kode === 'IHSG' ? ' on' : ''}`}
          onClick={() => { setKode('IHSG'); setCari('') }}>IHSG</button>
        {kode !== 'IHSG' && (
          <button type="button" className="chip-t on sea-chip" onClick={() => { setKode('IHSG'); setCari('') }} title={`Kembali ke IHSG`}>
            {kode} <IkonMenu d={IKON_SILANG} size={9} />
          </button>
        )}
        <div className="af-cari sea-cari sea-cari-hari">
          <input className="inp" value={cari} placeholder="…atau satu emiten: BUMI, BBCA"
            onChange={(e) => setCari(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && saran[0]) { setKode(saran[0].k); setCari('') } }} />
          {/* SATU daftar untuk keduanya. Dua <ul> terpisah saling menimpa —
              `.sea-saran` berposisi absolut, jadi yang kedua menutupi yang
              pertama dan hasil yang bisa dibuka justru hilang dari layar. */}
          {(saran.length > 0 || saranBelum.length > 0) && (
            <ul className="sea-saran" role="listbox">
              {saran.map((b) => (
                <li key={b.k}>
                  <button type="button" className="sea-saran-it" onClick={() => { setKode(b.k); setCari('') }}>
                    <span className="kd">{b.k}</span>
                    <span className="nm">{b.n}</span>
                  </button>
                </li>
              ))}
              {saranBelum.map((b) => (
                <li key={`belum-${b.k}`}>
                  {/* Sengaja BUKAN tombol: tak ada yang bisa dibuka, dan kotak
                      yang bisa ditekan lalu tak melakukan apa-apa lebih
                      membingungkan daripada baris yang jelas tak bisa ditekan. */}
                  <div className="sea-saran-it sea-saran-belum">
                    <span className="kd">{b.k}</span>
                    <span className="nm">{b.n}</span>
                    <span className="ket">
                      belum bisa dihitung — baru {b.j} bulan{b.t ? `, tercatat ${b.t}` : ''}; pola musiman butuh 12
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )

  if (galat) return <>{pemilih}<div className="panel panel-b"><p className="muted">{galat}</p></div></>
  if (!tutup) return <>{pemilih}<div className="fd-empty"><p>Memuat data harian {kode}…</p></div></>

  const v = r ? vonisUji(r.uji) : null
  const urut = r ? [...r.perHari].sort((a, b) => b.kumulatif - a.kumulatif) : []

  return (
    <>
      {pemilih}
      <section className="panel">
        <div className="panel-b sea-hari-kepala">
          <div className="sea-tahun">
            <span className="lbl">Rentang</span>
            {/* Praset ATAU tanggal-ke-tanggal — praset tetap jalan pintas
                bawaan (tab kiri), tapi tak lagi satu-satunya jalan masuk.
                Praset menyuruh percaya; rentang bebas mengundang membuktikan
                sendiri (#170 K9). */}
            <div className="tabs sea-mode" role="tablist" aria-label="Cara memilih rentang">
              <button type="button" role="tab" aria-selected={!modeBebas}
                className={'tab' + (modeBebas ? '' : ' on')} onClick={() => setModeBebas(false)}>
                Praset
              </button>
              <button type="button" role="tab" aria-selected={modeBebas}
                className={'tab' + (modeBebas ? ' on' : '')} onClick={keBebas}>
                Tanggal ke tanggal
              </button>
            </div>
            {!modeBebas && RENTANG.map(([label]) => (
              <button key={label} type="button" className={`chip-t${pilih === label ? ' on' : ''}`}
                onClick={() => setPilih(label)}>{label}</button>
            ))}
            {/* Satu kalender mode rentang (bukan dua DatePicker berdampingan) —
                dua klik di popover yang sama, bukan dua popover yang harus
                dibuka bergantian untuk memilih dua ujung rentang. */}
            {modeBebas && (
              <DatePicker value={dariBebas}
                // `onChange` di kalender RENTANG berarti "pilih satu hari",
                // bukan "ganti ujung awal": komponen memanggilnya saat orang
                // mengklik tanggal yang sama dua kali, dan saat stepper ‹ ›
                // dipakai. Memetakannya ke (iso, akhirLama) membuat klik-ganda
                // menghasilkan rentang panjang yang tak diminta siapa pun.
                onChange={(iso) => ubahBebas(iso, iso)}
                tersedia={tersediaSet} ariaLabel="Rentang bebas: mulai dan akhir"
                rentang={{ dari: dariBebas, sampai: sampaiBebas }}
                onGantiRentang={ubahBebas} />
            )}
          </div>
          <span className="v-note sea-rentang-note">
            {r ? (
              <>
                <span className="sea-rentang-sumber">{kode}</span>
                {' · '}
                <span className="sea-rentang-tanggal">{r.mulai} → {r.akhir}</span>
                {' · '}
                <span className="sea-rentang-jumlah">{r.totalObservasi.toLocaleString('id-ID')}</span>
                {' hari bursa'}
              </>
            ) : (
              <>{kode} · rentang ini belum cukup panjang</>
            )}
          </span>
        </div>
      </section>

      {/* Kalender di atas sudah membatasi pilihan ke hari ber-data lewat
          `tersedia` (DatePicker) — tak ada jalan memilih tanggal di luar
          cakupan ${kode}, jadi tak perlu menjepit apa pun sesudahnya. */}
      {!r && (
        <div className="fd-empty" style={{ padding: '40px 20px' }}>
          <p style={{ fontSize: 14 }}>
            {modeBebas && dariBebas && sampaiBebas
              // Bukan pintu tertutup: sebut angkanya. Orang yang sedang
              // mengetes rentangnya sendiri butuh tahu ADA APA, bukan cuma
              // "gagal" — apalagi kalau sebabnya cuma jarak dua hari.
              ? `Baru ${hariBursaTerpilih} hari bursa di rentang ini — dibutuhkan minimal ${AMBANG_BEBAS} (satu putaran Senin–Jumat penuh) untuk mulai menghitung pola per hari.`
              : 'Rentang ini belum punya satu pun perubahan harga.'}
          </p>
        </div>
      )}

      {/* Ambang 5 hari bursa (#170 K9) — cuma relevan di rentang bebas,
          karena praset praktis selalu jauh di atasnya. Bukan galat merah:
          angkanya tetap dihitung dan ditampilkan di bawah, cuma diberi tahu
          dasarnya setipis apa. */}
      {modeBebas && r && hariBursaTerpilih < AMBANG_BEBAS && (
        <div className="sea-tipis">
          <b>Baru {hariBursaTerpilih} hari bursa — di bawah standar minimal {AMBANG_BEBAS} (satu putaran
          Senin–Jumat penuh).</b> Angka di bawah tetap dihitung dari data yang ada, tapi urutannya
          masih sangat mudah berubah kalau satu hari saja ditambah atau dikurangi. Perlebar
          rentangnya untuk dasar yang lebih stabil.
        </div>
      )}

      {/* Sampel tipis TIDAK disembunyikan — ditampilkan dengan peringatan yang
          menyebut angkanya. Menolak menghitung menyembunyikan mekanismenya;
          yang dibutuhkan pembaca adalah tahu setipis apa dasarnya. */}
      {r && r.totalObservasi < 25 && (
        <div className="sea-tipis">
          <b>Dasarnya tipis: {r.totalObservasi} perubahan harga.</b> Dibagi lima hari, tiap hari
          cuma punya sekitar {Math.round(r.totalObservasi / 5)} pengamatan — satu hari yang
          kebetulan meledak bisa menentukan seluruh urutannya. Angka di bawah benar secara
          hitungan, tapi belum berarti apa-apa sebagai pola.
        </div>
      )}

      {r && v && tutup && <>

      <section className="panel">
        <div className="panel-h">
          <span className="lbl">Kalau hanya memegang di satu hari</span>
          <span className="v-note">pertumbuhan kumulatif sejak {r.mulai.slice(0, 4)}</span>
        </div>
        <div className="panel-b">
          <Balapan r={r} kunci={pilih} tutup={tutup} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-h"><span className="lbl">Rincian per hari</span></div>
        <div className="panel-b" style={{ overflowX: 'auto' }}>
          <table className="tbl sea-hari-tbl">
            <thead>
              <tr>
                <th>Hari</th>
                <th className="num">Kumulatif</th>
                <th className="num">Rata-rata/hari</th>
                <th className="num">Median</th>
                <th className="num">Peluang naik</th>
                <th className="num">Selang 95%</th>
                <th className="num">n</th>
              </tr>
            </thead>
            <tbody>
              {urut.map((h) => (
                <tr key={h.hari}>
                  <td><b style={{ color: WARNA[h.hari] }}>{HARI[h.hari]}</b></td>
                  <td className={'num ' + (h.kumulatif >= 0 ? 'up' : 'dn')}>
                    {h.kumulatif >= 0 ? '+' : ''}{h.kumulatif.toFixed(1)}%
                  </td>
                  <td className={'num ' + (h.rata2 >= 0 ? 'up' : 'dn')}>
                    {h.rata2 >= 0 ? '+' : ''}{h.rata2.toFixed(4)}%
                  </td>
                  <td className="num">{h.median >= 0 ? '+' : ''}{h.median.toFixed(3)}%</td>
                  <td className="num"><b>{h.tersusut.toFixed(1)}%</b></td>
                  <td className="num muted">{h.bawah.toFixed(0)}&ndash;{h.atas.toFixed(0)}%</td>
                  <td className="num muted">{h.n.toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={'panel-b sea-vonis-hari' + (v.kuat ? ' kuat' : '')}>
          {r.uji && (
            <span>
              <b>{HARI[r.uji.bulanJuara - 1]}</b> paling sering naik ({r.uji.peluangJuara}%) ·{' '}
              <span className="pv">p = {r.uji.pValue.toFixed(4)}</span>
            </span>
          )}
          <span className="ks">{v.teks}</span>
        </div>
      </section>

      </>}

      <p className="sea-kaki">
        <IkonMenu d={IKON_PERINGATAN} size={12} />{' '}
        <b>Angka kumulatif mudah disalahbaca.</b> &minus;86% bukan berarti &ldquo;rugi 86%&rdquo; —
        itu hasil pengalian ribuan hari berturut-turut, dan pengali di bawah 1 menghancurkan lebih
        cepat daripada yang di atas 1 membangun. Rata-rata harian lebih jujur menggambarkan
        wataknya. <b>Dan ini bukan strategi:</b> selisih sepersepuluh persen per hari habis oleh fee
        sekali transaksi. Yang dijawab halaman ini adalah <b>kapan pasar cenderung lemah</b>, bukan
        kapan harus membeli.
      </p>
    </>
  )
}

/**
 * Grafik balapan: lima garis kumulatif yang tumbuh bersamaan.
 *
 * Animasinya digerakkan CSS (stroke-dashoffset), BUKAN state React per frame.
 * Versi pertama menyetel state 60 kali per detik, dan tiap penyetelan memaksa
 * seluruh komponen — termasuk tabel tujuh kolomnya — dihitung ulang. Hasilnya
 * tersendat persis di bagian yang seharusnya mulus.
 *
 * Dengan dashoffset, path digambar sekali lalu compositor yang menganimasikan
 * penyingkapannya. Tak ada render ulang sama sekali selama animasi berjalan.
 */
function Balapan({ r, kunci, tutup }: { r: RingkasHarian; kunci: string; tutup: Record<string, number> }) {
  // viewBox lebih sempit di layar kecil. Ukuran teks di dalam SVG ikut
  // diskalakan bersama viewBox-nya: kotak 900 lebar yang dipaksa masuk ke
  // 394px menyusutkan label 12px jadi sekitar 5px — ada di layar, tak terbaca.
  // Kotak yang lebih kecil dan lebih jangkung membuat skalanya mendekati 1:1.
  const sempit = useLayarSempit()
  const W = sempit ? 460 : 900
  const H = sempit ? 320 : 348
  const PAD = sempit
    ? { atas: 12, kanan: 78, bawah: 30, kiri: 42 }
    : { atas: 14, kanan: 104, bawah: 34, kiri: 56 }

  // Filter sembunyi/tampilkan per hari (#182, Johan: "garis line nya itukan
  // saling rapat... jadi saling tumpang tindih, penglihatan jadinya bias").
  // Minimal satu hari selalu tampil — toggleHari menolak menyembunyikan yang
  // terakhir tersisa, supaya sumbu (lewat rentangSumbuBalapan) tak pernah
  // kolaps ke satu titik.
  const [sembunyi, setSembunyi] = useState<Set<number>>(() => new Set())

  function toggleHari(h: number) {
    setSembunyi((prev) => {
      const next = new Set(prev)
      if (next.has(h)) {
        next.delete(h)
      } else {
        if (prev.size >= HARI.length - 1) return prev // jangan sembunyikan yang terakhir
        next.add(h)
      }
      return next
    })
  }

  /** "Cuma ini" — klik dua kali sembunyikan empat hari lainnya sekaligus.
   *  Klik dua kali lagi pada hari yang sama mengembalikan semua (satu
   *  tindakan balik, bukan mengklik ulang tiap hari satu per satu). */
  function soloHari(h: number) {
    setSembunyi((prev) => {
      const sudahSolo = prev.size === HARI.length - 1 && !prev.has(h)
      if (sudahSolo) return new Set()
      return new Set(HARI.map((_, i) => i).filter((i) => i !== h))
    })
  }

  const { min, maks } = rentangSumbuBalapan(r.jejak, sembunyi)
  const x = (i: number) => PAD.kiri + (i / Math.max(1, r.jejak.length - 1)) * (W - PAD.kiri - PAD.kanan)
  const y = (v: number) => PAD.atas + (1 - (v - min) / Math.max(1e-9, maks - min)) * (H - PAD.atas - PAD.bawah)
  const akhir = r.jejak[r.jejak.length - 1]

  // Tooltip/crosshair (#172, Johan: "opsi A" — kursor menyusuri garis, bukan
  // titik/batang per hari). Biaya rendernya cuma menambah satu overlay dan
  // beberapa elemen SVG saat dihover, tak menambah simpul path — jadi batas
  // "maksimal 1Y" yang tadinya dikhawatirkan tak diperlukan untuk fitur ini.
  //
  // Persen perubahan hariannya dihitung dari `tutup` MENTAH (bukan dari
  // r.jejak, yang bisa dijarangkan di rentang sangat panjang) — hari bursa
  // sebelumnya dicari lewat peta tanggal→indeks yang di-memo sekali, supaya
  // tiap pointermove tetap O(1), bukan mencari ulang di seluruh riwayat.
  const [hoverI, setHoverI] = useState<number | null>(null)
  useEffect(() => setHoverI(null), [r])

  const tglUrut = useMemo(() => Object.keys(tutup).sort(), [tutup])
  const idxTgl = useMemo(() => {
    const m = new Map<string, number>()
    tglUrut.forEach((t, i) => m.set(t, i))
    return m
  }, [tglUrut])

  function pindaiTitik(e: ReactPointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = rect.width > 0 ? Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) : 0
    setHoverI(Math.round(frac * (r.jejak.length - 1)))
  }
  function mulaiTitik(e: ReactPointerEvent<SVGRectElement>) {
    // Capture itu cuma supaya jari yang bergeser sedikit ke luar zona tetap
    // "dipegang" elemen ini — bukan syarat supaya titiknya kebaca. Browser
    // bisa menolak capture untuk pointer yang belum ia lacak sendiri (mis.
    // event sintetis), dan penolakan itu tak boleh membatalkan pembacaan.
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* abaikan */ }
    pindaiTitik(e)
  }

  const iAktif = hoverI === null ? null : Math.min(Math.max(hoverI, 0), r.jejak.length - 1)
  const titik = iAktif === null ? null : (() => {
    const j = r.jejak[iAktif]
    const idx = idxTgl.get(j.tgl)
    const prevTgl = idx !== undefined && idx > 0 ? tglUrut[idx - 1] : null
    const perubahan = prevTgl && tutup[prevTgl] > 0 ? (tutup[j.tgl] / tutup[prevTgl] - 1) * 100 : null
    const hari = new Date(j.tgl + 'T00:00:00Z').getUTCDay() - 1 // 0=Senin … 4=Jumat
    const tgl = new Date(j.tgl + 'T00:00:00Z')
    const tglFmt = `${tgl.getUTCDate()} ${BLN_PENDEK[tgl.getUTCMonth()]} ${tgl.getUTCFullYear()}`
    return { i: iAktif, j, hari, perubahan, tglFmt }
  })()

  // Penanda waktu dipilih menurut panjang rentangnya: di bawah 2 tahun tiap
  // bulan (atau tiap 2 bulan kalau padat), di atas itu tiap tahun. Menampilkan
  // 36 label bulan pada rentang 30 tahun cuma menghasilkan pita hitam.
  const tanda = useMemo(() => {
    const hari = r.jejak.length
    const perTahun = hari > 480
    const hasil: Array<{ i: number; tgl: string; label: string }> = []
    let terakhir = ''
    r.jejak.forEach((j, i) => {
      const kunci = perTahun ? j.tgl.slice(0, 4) : j.tgl.slice(0, 7)
      if (kunci === terakhir) return
      terakhir = kunci
      hasil.push({
        i, tgl: j.tgl,
        label: perTahun ? kunci : BLN_PENDEK[Number(j.tgl.slice(5, 7)) - 1] + (j.tgl.slice(5, 7) === '01' ? ` '${j.tgl.slice(2, 4)}` : '') })
    })
    // Kalau masih terlalu rapat, ambil selang seling sampai muat. Label yang
    // saling menimpa lebih buruk daripada label yang lebih jarang.
    const maksLabel = sempit ? 7 : 14
    if (hasil.length <= maksLabel) return hasil
    const lompat = Math.ceil(hasil.length / maksLabel)
    return hasil.filter((_, i) => i % lompat === 0)
  }, [r.jejak, sempit])

  // Panjang jalur ditaksir dari jarak antar titik. Cukup: nilainya cuma perlu
  // TIDAK LEBIH PENDEK dari panjang sebenarnya, karena dipakai sebagai dash
  // yang harus mampu menutupi seluruh garis sebelum disingkap.
  const panjang = HARI.map((_, h) => {
    let L = 0
    for (let i = 1; i < r.jejak.length; i++) {
      const dx = x(i) - x(i - 1)
      const dy = y(r.jejak[i].nilai[h]) - y(r.jejak[i - 1].nilai[h])
      L += Math.hypot(dx, dy)
    }
    return Math.ceil(L) + 10
  })

  // Kotak tooltip menempel di sisi kanan titik, dan lompat ke kiri kalau
  // akan terpotong tepi kanan grafik — pola flip standar, bukan sekadar
  // ditempel selalu di satu sisi.
  const tipW = sempit ? 150 : 178
  const tipH = 54
  let tipX = 0, tipY = 0
  if (titik) {
    const cx = x(titik.i)
    tipX = cx + 10 + tipW > W - 2 ? cx - tipW - 10 : cx + 10
    tipY = PAD.atas + 4
  }

  return (
    <div className="sea-balapan">
      {/* Sakelar per hari — deretan chip (bukan legenda-dalam-SVG): posisi
          label ujung garis bergeser saat sumbu menyesuaikan, jadi tak bisa
          jadi sakelar yang stabil untuk hari yang justru sedang disembunyikan.
          Chip tetap di tempat yang sama terlepas apa yang tampil di grafik. */}
      <div className="sea-hari-filter" role="group" aria-label="Sembunyikan atau tampilkan garis tiap hari">
        {HARI.map((nama, h) => {
          const tampil = !sembunyi.has(h)
          const nilaiAkhir = akhir.nilai[h]
          return (
            <button
              key={nama}
              type="button"
              className="chip-t"
              style={tampil ? { borderColor: WARNA[h], color: WARNA[h] } : { opacity: 0.45 }}
              aria-pressed={tampil}
              aria-label={`${nama}, ${tampil ? 'ditampilkan' : 'disembunyikan'}. Klik untuk ${tampil ? 'menyembunyikan' : 'menampilkan'}, klik dua kali untuk hanya menampilkan ${nama}.`}
              onClick={() => toggleHari(h)}
              onDoubleClick={() => soloHari(h)}
            >
              {nama} {nilaiAkhir >= 0 ? '+' : ''}{Math.round(nilaiAkhir)}%
            </button>
          )
        })}
        {sembunyi.size > 0 && (
          <button type="button" className="chip-t" onClick={() => setSembunyi(new Set())}>
            Tampilkan semua
          </button>
        )}
      </div>
      {/* key memaksa elemen dibuat ulang saat rentang berganti — animasi CSS
          tidak akan mengulang sendiri kalau elemennya cuma diperbarui. */}
      <svg key={kunci} viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Pertumbuhan kumulatif IHSG per hari dalam seminggu">
        <line x1={PAD.kiri} x2={W - PAD.kanan} y1={y(0)} y2={y(0)}
          stroke="var(--line2)" strokeDasharray="3 4" />
        <text x={PAD.kiri - 8} y={y(0) + 4} textAnchor="end" className="sb-sumbu">0%</text>
        <text x={PAD.kiri - 8} y={y(maks) + 10} textAnchor="end" className="sb-sumbu">{Math.round(maks)}%</text>
        {min < -1 && (
          <text x={PAD.kiri - 8} y={y(min) - 2} textAnchor="end" className="sb-sumbu">{Math.round(min)}%</text>
        )}

        {HARI.map((nama, h) => {
          if (sembunyi.has(h)) return null
          return (
            <g key={nama}>
              <path
                className="sb-garis"
                style={{ ['--L' as string]: panjang[h] }}
                d={r.jejak.map((j, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(j.nilai[h]).toFixed(1)}`).join(' ')}
                fill="none" stroke={WARNA[h]} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
              />
              <g className="sb-ujung">
                <circle cx={x(r.jejak.length - 1)} cy={y(akhir.nilai[h])} r="3.5" fill={WARNA[h]} />
                <text x={x(r.jejak.length - 1) + 8} y={y(akhir.nilai[h]) + 4} fill={WARNA[h]} className="sb-label">
                  {nama} {akhir.nilai[h] >= 0 ? '+' : ''}{Math.round(akhir.nilai[h])}%
                </text>
              </g>
            </g>
          )
        })}
        {/* Sumbu waktu: penanda BULAN untuk rentang pendek, TAHUN untuk
            rentang panjang. Tanpa ini, garis yang naik-turun tak punya
            jangkar — orang melihat bentuk tapi tak tahu kapan itu terjadi. */}
        {tanda.map((t) => (
          <g key={t.tgl}>
            <line x1={x(t.i)} x2={x(t.i)} y1={PAD.atas} y2={H - PAD.bawah}
              stroke="var(--line)" strokeWidth="1" opacity="0.5" />
            <text x={x(t.i)} y={H - 6} textAnchor="middle" className="sb-sumbu">{t.label}</text>
          </g>
        ))}

        {/* Zona tangkap kursor/sentuh — satu persegi transparan menutupi
            seluruh area plot. `touch-action: pan-y` (di CSS, lewat kelas
            sb-hit) sengaja dipilih ketimbang preventDefault manual: gulir
            VERTIKAL halaman tetap jalan walau jari menyentuh grafik, cuma
            gestur horizontal yang diserahkan ke JS di sini (#172). */}
        <rect x={PAD.kiri} y={0} width={Math.max(0, W - PAD.kiri - PAD.kanan)} height={H}
          className="sb-hit" pointerEvents="all"
          onPointerDown={mulaiTitik} onPointerMove={pindaiTitik}
          onPointerLeave={() => setHoverI(null)} onPointerCancel={() => setHoverI(null)} />

        {titik && (
          <g className="sb-crosshair" pointerEvents="none">
            <line x1={x(titik.i)} x2={x(titik.i)} y1={PAD.atas} y2={H - PAD.bawah} className="sb-crosshair-garis" />
            <circle cx={x(titik.i)} cy={y(titik.j.nilai[titik.hari])} r="4"
              fill={WARNA[titik.hari]} className="sb-tip-titik" />
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="4" className="sb-tip-box" />
            <text x={tipX + 10} y={tipY + 17} className="sb-tip-tgl">
              <tspan fill={WARNA[titik.hari]} fontWeight="700">{HARI[titik.hari]}</tspan>, {titik.tglFmt}
            </text>
            <text x={tipX + 10} y={tipY + 36} className="sb-tip-pct"
              fill={titik.perubahan === null ? 'var(--text3)' : titik.perubahan >= 0 ? 'var(--green)' : 'var(--red)'}>
              {titik.perubahan === null
                ? 'data hari sebelumnya tak ada'
                : `${titik.perubahan >= 0 ? '+' : ''}${titik.perubahan.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}
            </text>
            <text x={tipX + 10} y={tipY + 49} className="sb-tip-ket">menggerakkan garis {HARI[titik.hari]}</text>
          </g>
        )}
      </svg>
    </div>
  )
}
