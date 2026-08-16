import { supabase } from '../supabase'
import type { DataHarian } from './dataHarian'
import type { EdisiBulletin } from './bulletin'
import type { KabarItem } from './kabar'

/**
 * Lapis AI Tanya PAPAN — jalur cadangan ketika mesin aturan tak mengenali
 * pertanyaannya.
 *
 * Yang dikerjakan di sini cuma dua: merakit KONTEKS dari data publik, dan
 * memanggil Edge Function `tanya-ai`. Kunci API tak pernah sampai ke
 * peramban, dan sakelar hidup/matinya ada di sisi server (rahasia
 * `TANYA_AI_AKTIF`) supaya bisa dimatikan tanpa deploy ulang.
 *
 * ⚠️ BATAS PRIVASI YANG TAK BOLEH DILANGGAR: konteks dirakit HANYA dari
 * berkas publik (data harian, edisi, kabar). Tak ada satu pun yang berasal
 * dari tabel `profil`/`setoran` — nama, alias, surel, jenjang, atau siapa
 * menyetor apa tak pernah ikut, dengan atau tanpa LLM.
 */

export interface JawabanAI {
  teks: string
  /** `true` kalau jawabannya datang dari model bahasa, bukan dari data. */
  dariAI: boolean
}

/** Konteks dirakit ringkas — bukan menyalin seluruh berkas harian.
 *  Makin panjang konteks, makin mahal DAN makin besar ruang model mengarang
 *  sambungan antar-angka yang sebenarnya tak berhubungan. */
export function rakitKonteks(
  hari: DataHarian | null,
  edisi: EdisiBulletin[] | null,
  kabar: KabarItem[] | null,
): string {
  const bagian: string[] = []

  if (hari) {
    const g = (hari.gainers ?? []).slice(0, 5).map((x) => `${x.c} ${x.p}%`).join(', ')
    const l = (hari.losers ?? []).slice(0, 5).map((x) => `${x.c} ${x.p}%`).join(', ')
    const s = (hari.sectors ?? []).slice(0, 11)
      .map((x) => `${x.n.replace(/^\[[A-Z]\]\s*/, '')} ${x.d}%`).join(', ')
    bagian.push(
      `Tanggal data: ${hari.date_id ?? '-'} (hari bursa ke-${hari.trading_day ?? '-'}).`,
      `IHSG ${hari.ihsg_value ?? '-'} (${hari.ihsg_pct ?? '-'}%), penutupan sebelumnya ${hari.ihsg_prev ?? '-'}.`,
      `Arus asing hari ini ${hari.nf_today_idr ?? '-'} miliar rupiah; tahun berjalan ${hari.nf_ytd_idr ?? '-'} miliar.`,
      g && `Top gainers: ${g}.`,
      l && `Top losers: ${l}.`,
      s && `Sektor: ${s}.`,
    )
  }

  if (edisi?.length) {
    bagian.push(`Edisi terakhir: ${edisi.slice(0, 3).map((e) => `${e.kode} (${e.tanggal_id})`).join(', ')}.`)
  }
  if (kabar?.length) {
    bagian.push(`Kabar terbaru: ${kabar.slice(0, 5).map((k) => `"${k.judul}" (${k.sumber})`).join('; ')}.`)
  }

  bagian.push(
    'Tentang PAPAN: situs data dan informasi Bursa Efek Indonesia. Sumbernya IDX, ' +
    'Yahoo Finance untuk riwayat lama, KSEI untuk kepemilikan, dan setoran kontributor ' +
    'untuk broker summary. PAPAN bukan produk resmi BEI dan tidak memberi rekomendasi ' +
    'beli/jual.',
  )

  return bagian.filter(Boolean).join('\n')
}

/**
 * Kembalikan `null` kalau lapis AI mati, kena batas, ditolak penjaga angka,
 * atau gagal dihubungi — pemanggil tinggal memakai jawaban aturannya. Diamnya
 * disengaja: pengunjung tak perlu tahu ada lapis yang sedang dimatikan.
 */
export async function tanyaAI(pertanyaan: string, konteks: string): Promise<JawabanAI | null> {
  try {
    const { data, error } = await supabase.functions.invoke('tanya-ai', {
      body: { pertanyaan, konteks },
    })
    if (error) return null
    const d = data as { teks?: string; mati?: boolean; batas?: boolean; ditolak?: boolean }
    if (d?.mati) return null
    // Batas harian dan penolakan penjaga angka TETAP disampaikan — keduanya
    // menjelaskan kenapa jawabannya tak seperti biasa, dan itu hak pembaca.
    if (d?.batas || d?.ditolak) return d.teks ? { teks: d.teks, dariAI: false } : null
    if (!d?.teks) return null
    return { teks: d.teks, dariAI: true }
  } catch {
    return null
  }
}
