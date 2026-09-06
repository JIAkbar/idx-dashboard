import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'
import { hariBursa, tanggalBursaTerakhir } from './tanggalBursa'

/**
 * Tesis kontributor — setoran yang dinilai MESIN, bukan dikurasi tangan.
 *
 * Antrean #3, pemicu Johan *"kerjakan #3"* (6 Sep 2026). Spek:
 * `docs/spek-dev-papan/tesis-kontributor.md`; tabelnya
 * `supabase/migrations/20260906_tesis_kontributor.sql`.
 *
 * **Modul ini tidak memvonis apa pun.** Menang/kalah ditulis hakim di sisi
 * panen (`scripts/riset/nilai_tesis.py`) dan dibaca halaman apa adanya — sama
 * seperti win rate Screener sesudah antrean #7. Yang ada di sini cuma menulis
 * tesis, membatalkannya selagi boleh, dan membaca hasilnya.
 *
 * Aturan yang ditegakkan SERVER, dan sengaja diulang di sini hanya sebagai
 * pesan lebih awal untuk penyetor — bukan sebagai kebenaran kedua:
 * arah/harga yang masuk akal, panjang alasan, dan kuota harian.
 */

/**
 * Pesan galat yang bisa dibaca manusia.
 *
 * Galat PostgREST BUKAN `Error` — ia objek biasa ber-ruas `message`, jadi
 * `String(e)` memberi harfiah "[object Object]" di layar. Terlihat 6 Sep 2026
 * saat tab Tesis dibuka sebelum tabelnya dipasang.
 */
export function pesanGalat(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

export type StatusTesis = 'menunggu' | 'menang' | 'kalah' | 'tak_masuk' | 'menggantung' | 'batal'
export type ArahTesis = 'naik' | 'turun'
export const HORIZON_TESIS = [5, 10, 20] as const
export type HorizonTesis = (typeof HORIZON_TESIS)[number]

export interface TesisRow {
  id: string
  penyetor: string
  kode: string
  arah: ArahTesis
  tanggal_sinyal: string
  masuk_bawah: number
  masuk_atas: number
  target: number
  stop: number
  horizon_hari: HorizonTesis
  alasan: string
  lampiran: string | null
  status: StatusTesis
  ambigu: boolean
  dinilai_pada: string | null
  harga_akhir: number | null
  hari_terpakai: number | null
  dibuat_pada: string
}

export type TesisBaru = Pick<TesisRow,
  'kode' | 'arah' | 'tanggal_sinyal' | 'masuk_bawah' | 'masuk_atas' | 'target' | 'stop' | 'horizon_hari' | 'alasan'>

/** Batas bawah/atas panjang alasan — sama persis dengan CHECK di tabel. */
export const ALASAN_MIN = 20
export const ALASAN_MAKS = 280

/**
 * Hari bursa yang barnya sudah FINAL sekarang.
 *
 * Aturan `bar_berisi` spek: bar hari ini baru dianggap final setelah bursa
 * tutup (≥16:45 WIB). Sebelum itu, tesis yang disetor hari ini bersandar pada
 * hari bursa SEBELUMNYA — kalau tidak, hari sinyalnya adalah hari yang masih
 * bergerak, dan hakim akan menilai aturan atas data yang dipakai membuatnya.
 *
 * Jam dibaca di zona Jakarta, bukan zona peramban: kontributor yang membuka
 * PAPAN dari zona lain tak boleh mendapat tanggal sinyal yang berbeda.
 */
export function tanggalSinyalSekarang(kini: Date = new Date()): string {
  const jkt = new Date(kini.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
  const menit = jkt.getHours() * 60 + jkt.getMinutes()
  const iso = tanggalBursaTerakhir(jkt)
  const hariIni = `${jkt.getFullYear()}-${String(jkt.getMonth() + 1).padStart(2, '0')}-${String(jkt.getDate()).padStart(2, '0')}`
  // Hanya hari ini yang bisa "belum final". Kalau hari bursa terakhir sudah
  // kemarin (akhir pekan, libur), barnya sudah lama final.
  if (iso === hariIni && menit < 16 * 60 + 45) {
    const d = new Date(jkt)
    do { d.setDate(d.getDate() - 1) } while (!hariBursa(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return iso
}

/**
 * Periksa tesis SEBELUM dikirim. Mengembalikan alasan penolakan pertama, atau
 * `null` kalau lolos.
 *
 * Isinya sengaja cerminan CHECK di tabel, dan itu bukan duplikasi yang bisa
 * menyimpang diam-diam: server tetap penjaga terakhir dan akan menolak apa pun
 * yang lolos di sini. Gunanya cuma satu — memberi tahu penyetor sebelum ia
 * menekan kirim, alih-alih memantulkan galat basis data ke layar.
 */
export function periksaTesis(t: Partial<TesisBaru>): string | null {
  if (!t.kode || !/^[A-Z]{2,10}$/.test(t.kode)) return 'Kode emiten belum benar.'
  const { masuk_bawah: bawah, masuk_atas: atas, target, stop } = t
  if (!bawah || !atas || !target || !stop) return 'Area masuk, target, dan batas rugi wajib diisi.'
  if (bawah > atas) return 'Batas bawah area masuk melebihi batas atasnya.'
  if (t.arah === 'turun') {
    if (!(target < bawah)) return 'Tesis turun: target harus DI BAWAH area masuk.'
    if (!(stop > atas)) return 'Tesis turun: batas rugi harus DI ATAS area masuk.'
  } else {
    if (!(target > atas)) return 'Tesis naik: target harus DI ATAS area masuk.'
    if (!(stop < bawah)) return 'Tesis naik: batas rugi harus DI BAWAH area masuk.'
  }
  const alasan = (t.alasan ?? '').trim()
  if (alasan.length < ALASAN_MIN) return `Alasan minimal ${ALASAN_MIN} karakter (sekarang ${alasan.length}).`
  if (alasan.length > ALASAN_MAKS) return `Alasan maksimal ${ALASAN_MAKS} karakter.`
  if (!HORIZON_TESIS.includes(t.horizon_hari as HorizonTesis)) return 'Horizon harus 5, 10, atau 20 hari bursa.'
  return null
}

/** Simpan tesis. Server menolak kalau kuota habis atau akun tak aktif. */
export async function kirimTesis(t: TesisBaru, penyetor: string): Promise<TesisRow> {
  const salah = periksaTesis(t)
  if (salah) throw new Error(salah)
  const { data, error } = await supabase
    .from('tesis')
    .insert({ ...t, alasan: t.alasan.trim(), penyetor })
    .select()
    .single()
  if (error) throw error
  return data as TesisRow
}

/**
 * Batalkan tesis yang belum dinilai. Server yang menentukan apakah jendelanya
 * masih terbuka (sebelum bursa berikutnya buka) — di sini tak ada perhitungan
 * jam kedua yang bisa berbeda dari server.
 */
export async function batalkanTesis(id: string): Promise<void> {
  const { error } = await supabase.from('tesis').update({ status: 'batal' }).eq('id', id)
  if (error) throw error
}

/** Tesis milik sendiri, terbaru dulu. */
export async function tesisSaya(penyetor: string): Promise<TesisRow[]> {
  const { data, error } = await supabase
    .from('tesis').select('*').eq('penyetor', penyetor).order('dibuat_pada', { ascending: false })
  if (error) throw error
  return (data ?? []) as TesisRow[]
}

/** Sisa kuota tesis hari ini. `null` = belum terjawab; JANGAN dibaca sebagai 0. */
export function useSisaKuotaTesis(pemicu?: unknown) {
  const { session } = useAuth()
  const [sisa, setSisa] = useState<number | null>(null)
  useEffect(() => {
    if (!session) { setSisa(null); return }
    let batal = false
    supabase.rpc('sisa_kuota_tesis').then(({ data, error }) => {
      if (batal || error) return
      setSisa(typeof data === 'number' ? data : null)
    })
    return () => { batal = true }
  }, [session, pemicu])
  return sisa
}

/** Daftar tesis sendiri + pemuat ulang, untuk tab Tesis. */
export function useTesisSaya() {
  const { session } = useAuth()
  const [baris, setBaris] = useState<TesisRow[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  const muat = useCallback(async () => {
    if (!session?.user?.id) { setBaris(null); return }
    try {
      setBaris(await tesisSaya(session.user.id))
      setGalat(null)
    } catch (e) {
      // Tabel yang belum ada dibedakan dari galat lain: selama migrasi belum
      // diterapkan, pesan "belum tersedia" jauh lebih berguna daripada kode
      // galat PostgREST mentah di layar kontributor.
      const pesan = pesanGalat(e)
      setGalat(/relation .*tesis.* does not exist|schema cache/i.test(pesan)
        ? 'Fitur tesis belum aktif — tabelnya belum dipasang di basis data.'
        : pesan)
      setBaris([])
    }
  }, [session])

  useEffect(() => { void muat() }, [muat])
  return { baris, galat, muat }
}

/** Label layar untuk tiap status. Satu tempat, supaya tab dan kartu tak mengeja sendiri. */
export const LABEL_STATUS: Record<StatusTesis, string> = {
  menunggu: 'Menunggu',
  menang: 'Menang',
  kalah: 'Kalah',
  tak_masuk: 'Tak masuk',
  menggantung: 'Masih berjalan',
  batal: 'Dibatalkan',
}

/**
 * Ringkasan akurasi dari vonis hakim.
 *
 * Penyebutnya tesis yang horizonnya sudah LEWAT (menang + kalah + tak masuk).
 * Yang masih berjalan tidak dihitung — keputusan Johan #3: penyebut yang
 * memuatnya menghukum penyetor yang rajin, bukan yang meleset. `tak_masuk`
 * TETAP di penyebut; tanpanya, asal-tembak jadi gratis.
 */
export function ringkasTesis(baris: TesisRow[]): {
  tuntas: number; menang: number; kalah: number; takMasuk: number; berjalan: number; akurasi: number | null
} {
  const n = (s: StatusTesis) => baris.filter((b) => b.status === s).length
  const menang = n('menang'); const kalah = n('kalah'); const takMasuk = n('tak_masuk')
  const berjalan = n('menunggu') + n('menggantung')
  const tuntas = menang + kalah + takMasuk
  return { tuntas, menang, kalah, takMasuk, berjalan, akurasi: tuntas ? (menang / tuntas) * 100 : null }
}
