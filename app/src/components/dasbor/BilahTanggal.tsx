import { DatePicker } from './DatePicker'
import { PemilihRentang } from './PemilihRentang'
import type { TanggalIndex } from '../../lib/dasbor/dataHarian'
import { PRESET_RENTANG, rentangPreset, type PresetRentang, type RentangTanggal } from '../../lib/dasbor/periode'

/**
 * Bilah tanggal untuk halaman harian — pengganti hero `Kalender` (861 baris)
 * sesuai keputusan Johan 2 Sep 2026: *"D + E digabung"* (artifact "Enam Arah
 * Kalender Bursa"). D = bilah kendali persis Harian Papan, E = preset rentang
 * di depan, kalender di belakang.
 *
 * Ini KOMPOSISI, bukan kendali baru: stepper `LangkahTanggal`, kalender
 * `DatePicker` (mode rentang menyala hanya bila `onRentang` diberikan — klik
 * pertama memilih hari, klik kedua menaikkannya jadi rentang), dan pil
 * `PemilihRentang` berisi `PRESET_RENTANG` yang sudah ada dan sudah snap ke
 * hari berdata. Tak satu pun bentuk didefinisikan di sini.
 *
 * Prop-nya sengaja SAMA dengan `Kalender` supaya 11 titik panggil di empat
 * halaman cuma berganti nama. Yang tidak ikut: `varian` (hero tak punya
 * varian lagi) dan seluruh isi hero — bar sesi, grid bulan ber-IHSG, panel
 * tanggal terpilih. Status bursa pindah ke pita kurs di kepala halaman,
 * karena ia milik seluruh situs, bukan empat halaman.
 *
 * Rentang hanya ditawarkan ke halaman yang MEMBACANYA. Diperiksa 2 Sep:
 * Sektor & Indeks dan Top Stocks membaca `rentangAktif`; Indeks Dunia dan
 * Top Broker tidak — mereka tak memberi `onRentang`, jadi kalendernya
 * otomatis satu-hari dan pil preset tak dirender. Pemilih rentang di
 * halaman per-hari adalah janji kosong (catatan Fable, review #343).
 */
export function BilahTanggal({ tanggalTersedia, tanggalAktif, onPilih, onRentang, rentangAktif = null }: {
  /** Urut menaik; elemen terakhir = hari bursa terbaru. */
  tanggalTersedia: TanggalIndex[]
  tanggalAktif: string | null
  onPilih: (iso: string) => void
  /** Ada = halaman membaca rentang; pil preset & mode rentang kalender menyala. */
  onRentang?: (r: RentangTanggal | null) => void
  rentangAktif?: RentangTanggal | null
  memuat?: boolean
}) {
  const tersedia = new Set(tanggalTersedia.map((t) => t.date_iso))
  const terbaru = tanggalTersedia[tanggalTersedia.length - 1]?.date_iso
  // Jangkar stepper & preset: ujung akhir rentang kalau ada, kalau tidak hari aktif.
  const jangkar = rentangAktif?.akhir ?? tanggalAktif ?? terbaru ?? ''

  function keHari(iso: string) {
    onRentang?.(null)
    onPilih(iso)
  }

  // Pil yang menyala = preset yang persis menghasilkan rentang aktif; rentang
  // hasil dua klik di kalender tak cocok dengan preset mana pun → "Kustom",
  // yang hanya muncul saat itu supaya daftar pil tak menyusut/melar diam-diam.
  //
  // TIDAK ADA pil "1 Hari" (keputusan Johan 5 Sep 2026, artifact "Empat Bilah
  // Kendali PAPAN", opsi A: *"kalender jadi penentu, pil jadi pintasan"*).
  // Keadaan satu-hari itu keadaan bawaan, dan kalender di sebelahnya sudah
  // menyatakannya; pil itu juga berdiri persis di samping tombol "Hari ini"
  // milik DatePicker, dua kata nyaris sama untuk dua hal berbeda.
  //
  // Jalan KEMBALI dari rentang ke satu hari tetap ada dua, dan keduanya lewat
  // kalender: klik satu tanggal di dalamnya (`keHari` membuang rentangnya),
  // atau tombol "Hari ini" — yang oleh DatePicker memang selalu dirender
  // selagi rentang aktif, persis supaya jalan keluar itu tak pernah hilang.
  type Pil = PresetRentang | 'kustom' | 'tak-ada'
  const cocok = rentangAktif
    ? PRESET_RENTANG.find((p) => {
        const r = rentangPreset(tanggalTersedia, rentangAktif.akhir, p.id)
        return r?.mulai === rentangAktif.mulai && r?.akhir === rentangAktif.akhir
      })?.id
    : undefined
  // 'tak-ada' sengaja BUKAN salah satu opsi: tanpa rentang, tak ada pil yang
  // menyala sama sekali — itu yang benar, karena yang berlaku saat itu tanggal
  // di kalender, bukan durasi.
  const pilAktif: Pil = !rentangAktif ? 'tak-ada' : (cocok ?? 'kustom')
  const opsiPil: { id: Pil; label: string }[] = [
    ...PRESET_RENTANG,
    ...(pilAktif === 'kustom' ? [{ id: 'kustom' as const, label: 'Kustom' }] : []),
  ]

  function gantiPil(id: Pil) {
    if (!onRentang) return
    if (id === 'kustom' || id === 'tak-ada') return
    onRentang(rentangPreset(tanggalTersedia, jangkar, id))
  }

  // Jumlah hari BURSA di rentang, bukan selisih kalender: rentang 3 bulan
  // memuat ±62 hari berdata, dan angka kalender (91) akan membuat pembaca
  // mengira ada hari yang hilang.
  const hariBursa = rentangAktif
    ? tanggalTersedia.filter((t) => t.date_iso >= rentangAktif.mulai && t.date_iso <= rentangAktif.akhir).length
    : 0

  const bilah = (
    <div className="bilah-kendali bt-bilah">
      <div className="grup-k">
        {/* Stepper ‹ › TIDAK dipasang di sini: DatePicker sudah membawanya
            sendiri (panah + tombol panah keyboard, menapak hanya hari
            berdata). Versi pertama memasang LangkahTanggal di kiri-kanan dan
            hasilnya panah GANDA `‹ ‹ tanggal › ›` — ketahuan dari tangkapan
            layar, bukan dari kode. */}
        <DatePicker
          value={jangkar}
          onChange={keHari}
          tersedia={tersedia}
          maks={terbaru}
          ariaLabel="Tanggal"
          rentang={rentangAktif ? { dari: rentangAktif.mulai, sampai: rentangAktif.akhir } : null}
          onGantiRentang={onRentang ? (dari, sampai) => onRentang({ mulai: dari, akhir: sampai }) : undefined}
        />
        {/* "Hari ini" juga TIDAK dipasang di sini — DatePicker sudah
            merendernya sendiri saat tanggal bukan yang terbaru. Versi pertama
            menambah satu lagi, dan di Top Stocks tampil "Hari ini · Hari ini ·
            Hari" tiga kata beruntun. Johan yang menangkapnya dari layar:
            "apa ini ada hari hari hari ini". Pelajarannya sama dengan panah
            ganda di atas: sebelum menambah kendali di samping DatePicker,
            periksa dulu apa yang sudah ia bawa. */}
      </div>
      {onRentang && (
        <div className="grup-k">
          <PemilihRentang opsi={opsiPil} nilai={pilAktif} onGanti={gantiPil} ariaLabel="Rentang waktu" />
        </div>
      )}
    </div>
  )

  if (!rentangAktif) return bilah
  return (
    <div className="bt-tumpuk">
      {bilah}
      {/* Keterangan hanya muncul selagi rentang aktif — kalimat yang selalu
          ada berhenti dibaca, dan saat satu hari tak ada yang perlu
          diterangkan: tanggalnya sudah tertulis di kalender.

          Kalimat "kolom YTD dihitung bursa" dipasang hanya pada preset
          sejak-1-Januari, satu-satunya keadaan di mana angka pil dan angka
          kolom bisa tertukar. Dua halaman yang merender pil ini (Sektor &
          Indeks, Top Stocks) sama-sama punya kolom itu — diperiksa, bukan
          diasumsikan. */}
      <p className="bt-catatan">
        {hariBursa} hari bursa
        {cocok === 'ytd' && ' · kolom YTD di tabel tetap angka resmi bursa, dihitung terpisah'}
      </p>
    </div>
  )
}
